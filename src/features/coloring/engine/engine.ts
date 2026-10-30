'use client';
import { getStroke } from 'perfect-freehand';
import { loadImage } from '@/lib/image-utils';
import { buildLineMaskFromAlpha, FillMap } from './fill';
import { History, type Patch } from './history';
import { getPattern, patternTile } from './patterns';
import { recognize, type ShapeKind } from './shapes';
import { TOOL_SPECS, type Layer, type PaintSource, type StrokeTool, type Symmetry, type ToolSpec, type ToolState } from './tools';

/** Ett inputpunkt fra penn, finger eller mus. */
export interface Pt {
  x: number;
  y: number;
  /** 0–1. Finger/mus = 0.5 */
  pressure: number;
  /** Pennens vinkel mot skjermen: π/2 = loddrett, 0 = flat. */
  altitude: number;
  /** Retning pennen peker (radianer). */
  azimuth: number;
  pen: boolean;
}

const MAX_DOC = 2048;
const LINE_INK = [29, 27, 46];

interface Copy {
  last: Pt | null;
  prev: Pt | null;
  lastStamp: Pt | null;
  carry: number; // avstand siden forrige dab
  dist: number;
}

interface Stroke {
  tool: ToolState;
  spec: ToolSpec;
  target: Layer;
  raw: Pt[];
  copies: Copy[];
  bbox: [number, number, number, number];
  renderedBox: [number, number, number, number] | null;
  shaped: boolean;
}

export interface EngineChange {
  canUndo: boolean;
  canRedo: boolean;
  dirty: boolean;
}

/**
 * Tegne- og fargeleggingsmotoren («verkstedet»).
 *
 * Lag (nederst → øverst):  papir · FARGE · [strøk under arbeid] · STREK · [strøk under arbeid]
 * Det som tegnes på strek-laget blir automatisk kanter for malingsbøtta – uansett farge.
 * Slik kan barnet både tegne sin egen omriss-tegning og fargelegge den (eller en AI-tegning).
 */
export class ColoringEngine {
  width = 0;
  height = 0;
  private pctx!: CanvasRenderingContext2D;
  private lctx!: CanvasRenderingContext2D;
  private sctx!: CanvasRenderingContext2D;
  private backup = document.createElement('canvas');
  private bctx!: CanvasRenderingContext2D;
  private fillMap: FillMap | null = null;
  private maskDirty = true;
  lineDirty = false;
  private history = new History();
  private current: Stroke | null = null;
  private grainCache = new Map<string, CanvasPattern>();
  private tipCache = new Map<string, HTMLCanvasElement>();
  private smudgeTmp = document.createElement('canvas');
  onChange: (s: EngineChange) => void = () => {};

  constructor(
    readonly paint: HTMLCanvasElement,
    readonly stroke: HTMLCanvasElement,
    readonly lines: HTMLCanvasElement,
  ) {}

  // ================================================================ lasting

  async load(opts: { lineArt: Blob | string; lineLayer?: Blob; paint?: Blob }) {
    const base = await loadImage(opts.lineArt);
    const scale = Math.min(1, MAX_DOC / Math.max(base.naturalWidth, base.naturalHeight));
    const W = Math.round(base.naturalWidth * scale);
    const H = Math.round(base.naturalHeight * scale);
    this.width = W;
    this.height = H;
    for (const c of [this.paint, this.stroke, this.lines, this.backup]) {
      c.width = W;
      c.height = H;
    }
    this.pctx = this.paint.getContext('2d', { willReadFrequently: true })!;
    this.lctx = this.lines.getContext('2d', { willReadFrequently: true })!;
    this.sctx = this.stroke.getContext('2d')!;
    this.bctx = this.backup.getContext('2d', { willReadFrequently: true })!;

    if (opts.lineLayer) {
      const l = await loadImage(opts.lineLayer);
      this.lctx.clearRect(0, 0, W, H);
      this.lctx.drawImage(l, 0, 0, W, H);
    } else {
      // Konverter en svart/hvit tegning til et gjennomsiktig strek-lag
      this.lctx.fillStyle = '#fff';
      this.lctx.fillRect(0, 0, W, H);
      this.lctx.imageSmoothingQuality = 'high';
      this.lctx.drawImage(base, 0, 0, W, H);
      const data = this.lctx.getImageData(0, 0, W, H);
      const px = data.data;
      for (let i = 0; i < px.length; i += 4) {
        const lum = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
        const ink = lum > 232 ? 0 : Math.min(255, Math.round(((232 - lum) / 232) * 255 * 1.25));
        px[i] = LINE_INK[0];
        px[i + 1] = LINE_INK[1];
        px[i + 2] = LINE_INK[2];
        px[i + 3] = ink;
      }
      this.lctx.clearRect(0, 0, W, H);
      this.lctx.putImageData(data, 0, 0);
    }

    this.pctx.clearRect(0, 0, W, H);
    if (opts.paint) this.pctx.drawImage(await loadImage(opts.paint), 0, 0, W, H);
    this.maskDirty = true;
    this.lineDirty = false;
    this.history.clear();
    this.emit(false);
  }

  private ctxFor(layer: Layer) {
    return layer === 'line' ? this.lctx : this.pctx;
  }

  private canvasFor(layer: Layer) {
    return layer === 'line' ? this.lines : this.paint;
  }

  // ================================================================ symmetri

  private mirrors(sym: Symmetry): ((p: Pt) => Pt)[] {
    const W = this.width, H = this.height, cx = W / 2, cy = H / 2;
    const id = (p: Pt) => p;
    const fx = (p: Pt): Pt => ({ ...p, x: W - p.x, azimuth: Math.PI - p.azimuth });
    const fy = (p: Pt): Pt => ({ ...p, y: H - p.y, azimuth: -p.azimuth });
    switch (sym) {
      case 'vertical':
        return [id, fx];
      case 'horizontal':
        return [id, fy];
      case 'quad':
        return [id, fx, fy, (p) => fy(fx(p))];
      case 'kaleido': {
        const out: ((p: Pt) => Pt)[] = [];
        for (let k = 0; k < 6; k++) {
          const a = (k * Math.PI) / 3;
          const rot = (p: Pt): Pt => {
            const dx = p.x - cx, dy = p.y - cy;
            return { ...p, x: cx + dx * Math.cos(a) - dy * Math.sin(a), y: cy + dx * Math.sin(a) + dy * Math.cos(a), azimuth: p.azimuth + a };
          };
          out.push(rot);
        }
        return out;
      }
      default:
        return [id];
    }
  }

  // ================================================================ strøk

  get drawing() {
    return this.current !== null;
  }

  begin(tool: ToolState, pt: Pt) {
    const spec = TOOL_SPECS[tool.tool as StrokeTool];
    if (!spec) return;
    const target: Layer = tool.layer;
    const n = this.mirrors(tool.symmetry).length;
    this.current = {
      tool,
      spec,
      target,
      raw: [],
      copies: Array.from({ length: n }, () => ({ last: null, prev: null, lastStamp: null, carry: 0, dist: 0 })),
      bbox: [Infinity, Infinity, -Infinity, -Infinity],
      renderedBox: null,
      shaped: false,
    };

    if (spec.render === 'live') {
      this.bctx.clearRect(0, 0, this.width, this.height);
      this.bctx.drawImage(this.canvasFor(target), 0, 0);
    } else {
      const s = this.sctx;
      s.setTransform(1, 0, 0, 1, 0, 0);
      s.clearRect(0, 0, this.width, this.height);
      s.globalAlpha = 1;
      s.globalCompositeOperation = 'source-over';
      s.shadowBlur = 0;
      // Forhåndsvisning med samme opasitet/blanding som når strøket «tørker»
      this.stroke.style.opacity = String(spec.alpha * tool.opacity);
      this.stroke.style.mixBlendMode = spec.composite === 'multiply' ? 'multiply' : 'normal';
      this.stroke.style.zIndex = target === 'line' ? '3' : '1';
    }
    this.add([pt]);
  }

  move(points: Pt[]) {
    if (this.current && !this.current.shaped) this.add(points);
  }

  private add(points: Pt[]) {
    const c = this.current!;
    const maps = this.mirrors(c.tool.symmetry);
    for (const raw of points) {
      const last = c.raw[c.raw.length - 1];
      if (last && Math.hypot(raw.x - last.x, raw.y - last.y) < 0.6) continue;
      c.raw.push(raw);
      if (c.spec.render === 'freehand') continue;
      maps.forEach((m, i) => this.segment(c, c.copies[i], m(raw)));
    }
    if (c.spec.render === 'freehand') this.renderFreehand(c, false);
  }

  /** Avslutter strøket og legger det inn i historikken. */
  end() {
    const c = this.current;
    if (!c) return;
    if (c.spec.render === 'freehand') this.renderFreehand(c, true);
    if (c.spec.render === 'line') {
      // Siste halvsegment
      const maps = this.mirrors(c.tool.symmetry);
      maps.forEach((_, i) => {
        const cp = c.copies[i];
        if (cp.prev && cp.last) this.lineSeg(c, cp, (cp.prev.x + cp.last.x) / 2, (cp.prev.y + cp.last.y) / 2, cp.last, true);
      });
    }
    this.current = null;
    const pad = Math.ceil(c.tool.size * 2) + 6;
    const [x0, y0, x1, y1] = this.clamp(c.bbox[0] - pad, c.bbox[1] - pad, c.bbox[2] + pad, c.bbox[3] + pad);
    const w = x1 - x0, h = y1 - y0;
    if (w <= 0 || h <= 0) return;
    const ctx = this.ctxFor(c.target);
    let before: ImageData;
    if (c.spec.render === 'live') {
      before = this.bctx.getImageData(x0, y0, w, h);
    } else {
      before = ctx.getImageData(x0, y0, w, h);
      ctx.save();
      ctx.globalAlpha = c.spec.alpha * c.tool.opacity;
      ctx.globalCompositeOperation = c.target === 'line' && c.spec.composite === 'multiply' ? 'source-over' : c.spec.composite;
      ctx.drawImage(this.stroke, x0, y0, w, h, x0, y0, w, h);
      ctx.restore();
      this.sctx.setTransform(1, 0, 0, 1, 0, 0);
      this.sctx.clearRect(0, 0, this.width, this.height);
    }
    const after = ctx.getImageData(x0, y0, w, h);
    this.history.push({ layer: c.target, x: x0, y: y0, before, after });
    if (c.target === 'line') this.touchLines();
    this.emit(true);
  }

  /** Avbryt (f.eks. når to fingre lander for å zoome). */
  cancel() {
    const c = this.current;
    if (!c) return;
    this.current = null;
    if (c.spec.render === 'live') {
      const ctx = this.ctxFor(c.target);
      ctx.save();
      ctx.globalCompositeOperation = 'copy';
      ctx.drawImage(this.backup, 0, 0);
      ctx.restore();
    } else {
      this.sctx.setTransform(1, 0, 0, 1, 0, 0);
      this.sctx.clearRect(0, 0, this.width, this.height);
    }
  }

  /** Magisk form: gjør gjeldende strek om til linje/sirkel/firkant … Returnerer formtypen. */
  snapShape(): ShapeKind | null {
    const c = this.current;
    if (!c || c.shaped || !c.spec.shapes || !c.tool.quickShape) return null;
    const shape = recognize(c.raw);
    if (!shape) return null;
    const pressures = c.raw.map((p) => p.pressure).sort((a, b) => a - b);
    const p0 = c.raw[Math.floor(c.raw.length / 2)];
    const pressure = pressures[Math.floor(pressures.length / 2)];
    const pts: Pt[] = shape.points.map((q) => ({ ...p0, x: q.x, y: q.y, pressure }));

    // Tegn på nytt med de rette punktene
    if (c.spec.render === 'live') {
      const ctx = this.ctxFor(c.target);
      ctx.save();
      ctx.globalCompositeOperation = 'copy';
      ctx.drawImage(this.backup, 0, 0);
      ctx.restore();
    } else {
      this.sctx.setTransform(1, 0, 0, 1, 0, 0);
      this.sctx.clearRect(0, 0, this.width, this.height);
    }
    c.raw = [];
    c.copies = c.copies.map(() => ({ last: null, prev: null, lastStamp: null, carry: 0, dist: 0 }));
    c.renderedBox = null;
    this.add(pts);
    c.shaped = true;
    return shape.kind;
  }

  // ---------------------------------------------------------------- rendering per verktøy

  private sizeAt(c: Stroke, p: Pt) {
    const pr = p.pen ? Math.pow(Math.max(0.02, p.pressure), 0.75) : 0.5;
    const s = c.tool.size * (1 - c.spec.pressureSize + c.spec.pressureSize * pr * 1.6);
    return Math.max(1, s);
  }

  private flowAt(c: Stroke, p: Pt) {
    const pr = p.pen ? Math.pow(Math.max(0.02, p.pressure), 0.8) : 0.55;
    return 1 - c.spec.pressureFlow + c.spec.pressureFlow * pr;
  }

  /** 0 når pennen står rett opp, 1 når den ligger nesten flat. */
  private tiltAmount(c: Stroke, p: Pt) {
    if (!c.spec.tilt || !p.pen) return 0;
    return Math.max(0, Math.min(1, 1 - p.altitude / (Math.PI / 2))) ** 1.2;
  }

  private grow(c: Stroke, x: number, y: number, r: number) {
    const b = c.bbox;
    b[0] = Math.min(b[0], x - r);
    b[1] = Math.min(b[1], y - r);
    b[2] = Math.max(b[2], x + r);
    b[3] = Math.max(b[3], y + r);
  }

  private styleFor(c: Stroke, ctx: CanvasRenderingContext2D, grainy = false): string | CanvasPattern {
    if (c.tool.tool === 'eraser') return '#000';
    return this.paintStyle(c.tool.paint, ctx, grainy);
  }

  paintStyle(p: PaintSource, ctx: CanvasRenderingContext2D, grainy = false): string | CanvasPattern {
    if (p.kind === 'pattern') {
      const def = getPattern(p.id);
      return def ? ctx.createPattern(patternTile(def), 'repeat') ?? '#000' : '#000';
    }
    if (!grainy) return p.color;
    let pat = this.grainCache.get(p.color);
    if (!pat) {
      const s = 96;
      const cv = document.createElement('canvas');
      cv.width = cv.height = s;
      const g = cv.getContext('2d')!;
      g.fillStyle = p.color;
      g.fillRect(0, 0, s, s);
      const id = g.getImageData(0, 0, s, s);
      let seed = 7;
      const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
      for (let i = 3; i < id.data.length; i += 4) {
        const r = rnd();
        id.data[i] = r < 0.2 ? 0 : r < 0.42 ? 140 : 255;
      }
      g.putImageData(id, 0, 0);
      pat = this.sctx.createPattern(cv, 'repeat')!;
      this.grainCache.set(p.color, pat);
    }
    return pat;
  }

  /** Myk, farget penselspiss (cache per farge/hardhet). */
  private tip(color: string, hardness: number): HTMLCanvasElement {
    const key = `${color}|${hardness}`;
    let t = this.tipCache.get(key);
    if (!t) {
      const s = 128;
      t = document.createElement('canvas');
      t.width = t.height = s;
      const g = t.getContext('2d')!;
      const grad = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      grad.addColorStop(0, color);
      grad.addColorStop(hardness, color);
      grad.addColorStop(1, color + '00');
      g.fillStyle = grad;
      g.fillRect(0, 0, s, s);
      this.tipCache.set(key, t);
    }
    return t;
  }

  private segment(c: Stroke, cp: Copy, p: Pt) {
    switch (c.spec.render) {
      case 'dab':
        return this.dabSeg(c, cp, p);
      case 'line':
        return this.lineMove(c, cp, p);
      case 'scatter':
        return this.scatterSeg(c, cp, p);
      case 'live':
        return c.tool.tool === 'smudge' ? this.smudgeSeg(c, cp, p) : this.eraseSeg(c, cp, p);
    }
  }

  // --- Blekk / tusj: glatt kontur med variabel bredde (perfect-freehand), tegnes på nytt hver frame
  private renderFreehand(c: Stroke, last: boolean) {
    const s = this.sctx;
    if (c.renderedBox) {
      const [a, b, x2, y2] = c.renderedBox;
      s.clearRect(a - 2, b - 2, x2 - a + 4, y2 - b + 4);
    }
    if (!c.raw.length) return;
    s.fillStyle = this.styleFor(c, s);
    const pen = c.raw[0].pen;
    const maps = this.mirrors(c.tool.symmetry);
    let box: [number, number, number, number] = [Infinity, Infinity, -Infinity, -Infinity];
    for (const m of maps) {
      const pts = c.raw.map((p) => {
        const q = m(p);
        return [q.x, q.y, pen ? Math.max(0.05, q.pressure) : 0.5];
      });
      const outline = getStroke(pts, {
        size: c.tool.size,
        thinning: c.spec.pressureSize,
        smoothing: 0.62,
        streamline: c.shaped ? 0 : 0.42,
        simulatePressure: !pen && c.spec.pressureSize > 0,
        last,
        // Spisse ender bare for frihånd med penn – former og lukkede figurer skal møtes uten hull
        start: { taper: !c.shaped && pen && c.spec.pressureSize > 0 ? Math.min(30, c.tool.size * 1.5) : 0, cap: true },
        end: { taper: !c.shaped && pen && c.spec.pressureSize > 0 ? Math.min(30, c.tool.size * 1.5) : 0, cap: true },
      });
      if (outline.length < 3) continue;
      const path = new Path2D();
      path.moveTo(outline[0][0], outline[0][1]);
      for (let i = 1; i < outline.length; i++) {
        const [x0, y0] = outline[i];
        const [x1, y1] = outline[(i + 1) % outline.length];
        path.quadraticCurveTo(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
      }
      path.closePath();
      s.fill(path);
      for (const [x, y] of outline) {
        if (x < box[0]) box[0] = x;
        if (y < box[1]) box[1] = y;
        if (x > box[2]) box[2] = x;
        if (y > box[3]) box[3] = y;
      }
    }
    c.renderedBox = box;
    this.grow(c, box[0], box[1], 2);
    this.grow(c, box[2], box[3], 2);
  }

  // --- Blyant, pensel, airbrush: «dabs» langs streken, med trykk og vinkel
  private dabSeg(c: Stroke, cp: Copy, p: Pt) {
    const from = cp.last ?? p;
    const d = Math.hypot(p.x - from.x, p.y - from.y);
    const size0 = this.sizeAt(c, p);
    const spacing = Math.max(0.8, size0 * (c.tool.tool === 'airbrush' ? 0.08 : c.tool.tool === 'pencil' ? 0.18 : 0.1));
    let t = cp.last ? spacing - cp.carry : 0;
    if (!cp.last) this.dab(c, p);
    while (t <= d && cp.last) {
      const k = d ? t / d : 0;
      const q: Pt = {
        ...p,
        x: from.x + (p.x - from.x) * k,
        y: from.y + (p.y - from.y) * k,
        pressure: from.pressure + (p.pressure - from.pressure) * k,
      };
      this.dab(c, q);
      t += spacing;
    }
    cp.carry = cp.last ? (d - (t - spacing)) : 0;
    cp.prev = cp.last;
    cp.last = p;
  }

  private dab(c: Stroke, p: Pt) {
    const s = this.sctx;
    const tilt = this.tiltAmount(c, p);
    let size = this.sizeAt(c, p);
    let flow = this.flowAt(c, p);
    const solid = c.tool.paint.kind === 'solid' ? c.tool.paint.color : null;
    s.save();
    s.translate(p.x, p.y);
    if (c.tool.tool === 'pencil') {
      // Skrå blyant = bred og lys skyggelegging, som en ekte blyant
      size *= 1 + tilt * 3.5;
      flow *= (1 - tilt * 0.6) * 0.55;
      s.rotate(p.azimuth);
      s.scale(1, 1 - tilt * 0.55);
      s.globalAlpha = Math.min(1, flow);
      s.fillStyle = this.paintStyle(c.tool.paint, s, true);
      s.beginPath();
      s.arc(0, 0, size / 2, 0, Math.PI * 2);
      s.fill();
    } else if (solid) {
      const hard = c.tool.tool === 'airbrush' ? 0 : 0.55;
      if (c.tool.tool === 'airbrush') flow *= 0.09;
      else flow *= 0.35;
      // Pensel: flat spiss som følger pennevinkelen
      s.rotate(p.azimuth);
      s.scale(1, 1 - tilt * 0.6);
      s.globalAlpha = Math.min(1, flow);
      const t = this.tip(solid, hard);
      s.drawImage(t, -size / 2, -size / 2, size, size);
    } else {
      s.globalAlpha = Math.min(1, flow * 0.5);
      s.fillStyle = this.paintStyle(c.tool.paint, s);
      s.setTransform(1, 0, 0, 1, 0, 0);
      s.beginPath();
      s.arc(p.x, p.y, size / 2, 0, Math.PI * 2);
      s.fill();
    }
    s.restore();
    this.grow(c, p.x, p.y, size);
  }

  // --- Fargestift og regnbue: segmenter med kvadratisk utjevning
  private lineMove(c: Stroke, cp: Copy, p: Pt) {
    if (!cp.last) {
      cp.last = p;
      this.lineSeg(c, cp, p.x, p.y, { ...p, x: p.x + 0.01 }, false);
      return;
    }
    const a = cp.last;
    const d = Math.hypot(p.x - a.x, p.y - a.y);
    cp.dist += d;
    if (cp.prev) {
      const m1x = (cp.prev.x + a.x) / 2, m1y = (cp.prev.y + a.y) / 2;
      this.lineSeg(c, cp, m1x, m1y, p, false, a);
    } else {
      this.lineSeg(c, cp, a.x, a.y, p, false);
    }
    cp.prev = a;
    cp.last = p;
  }

  private lineSeg(c: Stroke, cp: Copy, fx: number, fy: number, p: Pt, final: boolean, ctrl?: Pt) {
    const s = this.sctx;
    const tilt = this.tiltAmount(c, p);
    const w = this.sizeAt(c, p) * (1 + tilt * 1.5);
    s.lineCap = 'round';
    s.lineJoin = 'round';
    s.lineWidth = w;
    s.strokeStyle = c.tool.tool === 'rainbow' ? `hsl(${(cp.dist / 3) % 360} 90% 58%)` : this.styleFor(c, s, c.tool.tool === 'crayon');
    s.beginPath();
    s.moveTo(fx, fy);
    if (ctrl && !final) s.quadraticCurveTo(ctrl.x, ctrl.y, (ctrl.x + p.x) / 2, (ctrl.y + p.y) / 2);
    else s.lineTo(p.x, p.y);
    s.stroke();
    this.grow(c, p.x, p.y, w);
    this.grow(c, fx, fy, w);
  }

  // --- Spray, glitter, stempler
  private scatterSeg(c: Stroke, cp: Copy, p: Pt) {
    const s = this.sctx;
    const a = cp.last ?? p;
    const size = c.tool.size;
    const t = c.tool.tool;
    if (t === 'stamp') {
      if (cp.lastStamp && Math.hypot(p.x - cp.lastStamp.x, p.y - cp.lastStamp.y) < size * 1.1) {
        cp.last = p;
        return;
      }
      cp.lastStamp = p;
      s.save();
      s.font = `${size}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
      s.textAlign = 'center';
      s.textBaseline = 'middle';
      s.translate(p.x, p.y);
      s.rotate((Math.random() - 0.5) * 0.5);
      s.fillText(c.tool.stamp, 0, 0);
      s.restore();
      this.grow(c, p.x, p.y, size);
      cp.last = p;
      return;
    }
    const steps = Math.max(1, Math.ceil(Math.hypot(p.x - a.x, p.y - a.y) / (size / 3)));
    const base = c.tool.paint.kind === 'solid' ? c.tool.paint.color : '#FFD54F';
    for (let k = 0; k < steps; k++) {
      const cx = a.x + ((p.x - a.x) * k) / steps;
      const cy = a.y + ((p.y - a.y) * k) / steps;
      if (t === 'spray') {
        s.fillStyle = this.styleFor(c, s);
        const n = size * 0.8 * this.flowAt(c, p);
        for (let i = 0; i < n; i++) {
          const ang = Math.random() * Math.PI * 2;
          const rad = Math.sqrt(Math.random()) * size * 0.5;
          const dot = Math.max(1, size / 40);
          s.fillRect(cx + Math.cos(ang) * rad, cy + Math.sin(ang) * rad, dot, dot);
        }
      } else {
        const tints = [base, '#FFFFFF', '#FFE58A', base];
        for (let i = 0; i < 8; i++) {
          const ang = Math.random() * Math.PI * 2;
          const rad = Math.sqrt(Math.random()) * size * 0.5;
          const x = cx + Math.cos(ang) * rad, y = cy + Math.sin(ang) * rad;
          s.fillStyle = tints[(Math.random() * tints.length) | 0];
          const r = Math.random() < 0.12 ? size / 9 : size / 26;
          s.beginPath();
          if (r > size / 12) {
            s.moveTo(x, y - r);
            s.quadraticCurveTo(x, y, x + r, y);
            s.quadraticCurveTo(x, y, x, y + r);
            s.quadraticCurveTo(x, y, x - r, y);
            s.quadraticCurveTo(x, y, x, y - r);
          } else s.arc(x, y, Math.max(1, r), 0, Math.PI * 2);
          s.fill();
        }
      }
    }
    this.grow(c, p.x, p.y, size);
    this.grow(c, a.x, a.y, size);
    cp.last = p;
  }

  // --- Viskelær: direkte på laget (backup for angre/avbryt)
  private eraseSeg(c: Stroke, cp: Copy, p: Pt) {
    const ctx = this.ctxFor(c.target);
    const a = cp.last ?? { ...p, x: p.x + 0.01 };
    const w = this.sizeAt(c, p);
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.lineCap = 'round';
    ctx.lineWidth = w;
    ctx.globalAlpha = c.tool.opacity;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    ctx.restore();
    this.grow(c, p.x, p.y, w);
    this.grow(c, a.x, a.y, w);
    cp.last = p;
  }

  // --- Gnikk/blande: drar med seg fargen som ligger der
  private smudgeSeg(c: Stroke, cp: Copy, p: Pt) {
    if (!cp.last) {
      cp.last = p;
      return;
    }
    const ctx = this.ctxFor(c.target);
    const size = Math.ceil(this.sizeAt(c, p));
    const d = Math.hypot(p.x - cp.last.x, p.y - cp.last.y);
    const spacing = Math.max(1, size * 0.12);
    const tmp = this.smudgeTmp;
    if (tmp.width !== size) {
      tmp.width = tmp.height = size;
    }
    const g = tmp.getContext('2d')!;
    const tip = this.tip('#000000', 0.3);
    let from: { x: number; y: number } = cp.last;
    for (let t = spacing; t <= d; t += spacing) {
      const k = t / d;
      const to = { x: cp.last.x + (p.x - cp.last.x) * k, y: cp.last.y + (p.y - cp.last.y) * k };
      g.globalCompositeOperation = 'copy';
      g.drawImage(this.canvasFor(c.target), from.x - size / 2, from.y - size / 2, size, size, 0, 0, size, size);
      g.globalCompositeOperation = 'destination-in';
      g.drawImage(tip, 0, 0, size, size);
      ctx.save();
      ctx.globalAlpha = 0.75 * this.flowAt(c, p) * c.tool.opacity;
      ctx.drawImage(tmp, to.x - size / 2, to.y - size / 2);
      ctx.restore();
      from = to;
    }
    this.grow(c, p.x, p.y, size);
    this.grow(c, cp.last.x, cp.last.y, size);
    cp.last = p;
  }

  // ================================================================ fyll og pipette

  private ensureMask() {
    if (!this.maskDirty && this.fillMap) return this.fillMap;
    const d = this.lctx.getImageData(0, 0, this.width, this.height);
    this.fillMap = new FillMap(buildLineMaskFromAlpha(d.data, this.width, this.height));
    this.maskDirty = false;
    return this.fillMap;
  }

  private touchLines() {
    this.maskDirty = true;
    this.lineDirty = true;
  }

  fill(x: number, y: number, paint: PaintSource, opacity = 1, gap = 2): boolean {
    const r = this.ensureMask().region(x, y, { gap, grow: 2 });
    if (!r) return false;
    const x0 = r.x0, y0 = r.y0, w = r.x1 - r.x0 + 1, h = r.y1 - r.y0 + 1;
    const before = this.pctx.getImageData(x0, y0, w, h);
    const after = new ImageData(new Uint8ClampedArray(before.data), w, h);

    let src: Uint8ClampedArray;
    if (paint.kind === 'solid') {
      const [cr, cg, cb] = hexToRgb(paint.color);
      src = new Uint8ClampedArray(w * h * 4);
      for (let i = 0; i < src.length; i += 4) {
        src[i] = cr;
        src[i + 1] = cg;
        src[i + 2] = cb;
        src[i + 3] = 255;
      }
    } else {
      const tmp = document.createElement('canvas');
      tmp.width = w;
      tmp.height = h;
      const tctx = tmp.getContext('2d')!;
      tctx.translate(-x0, -y0);
      tctx.fillStyle = this.paintStyle(paint, tctx);
      tctx.fillRect(x0, y0, w, h);
      src = tctx.getImageData(0, 0, w, h).data;
    }

    const a = Math.max(0, Math.min(1, opacity));
    const W = this.width;
    const out = after.data;
    for (let yy = 0; yy < h; yy++) {
      const mrow = (y0 + yy) * W + x0;
      for (let xx = 0; xx < w; xx++) {
        if (!r.mask[mrow + xx]) continue;
        const p = (yy * w + xx) * 4;
        if (a >= 1) {
          out[p] = src[p];
          out[p + 1] = src[p + 1];
          out[p + 2] = src[p + 2];
          out[p + 3] = 255;
        } else {
          // Gjennomsiktig fyll legges oppå det som er der
          const da = out[p + 3] / 255;
          const oa = a + da * (1 - a);
          out[p] = (src[p] * a + out[p] * da * (1 - a)) / oa;
          out[p + 1] = (src[p + 1] * a + out[p + 1] * da * (1 - a)) / oa;
          out[p + 2] = (src[p + 2] * a + out[p + 2] * da * (1 - a)) / oa;
          out[p + 3] = oa * 255;
        }
      }
    }
    this.pctx.putImageData(after, x0, y0);
    this.history.push({ layer: 'paint', x: x0, y: y0, before, after });
    this.emit(true);
    return true;
  }

  /** Farge i et punkt (som barnet ser den: papir + farge + strek). */
  pick(x: number, y: number): string {
    const px = Math.max(0, Math.min(this.width - 1, Math.round(x)));
    const py = Math.max(0, Math.min(this.height - 1, Math.round(y)));
    const p = this.pctx.getImageData(px, py, 1, 1).data;
    const l = this.lctx.getImageData(px, py, 1, 1).data;
    const over = (top: Uint8ClampedArray, bottom: number[]) => {
      const a = top[3] / 255;
      return [0, 1, 2].map((i) => top[i] * a + bottom[i] * (1 - a));
    };
    const rgb = over(l, over(p, [255, 255, 255]));
    return '#' + rgb.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
  }

  // ================================================================ historikk

  undo() {
    const p = this.history.undo();
    if (p) this.apply(p, 'before');
  }

  redo() {
    const p = this.history.redo();
    if (p) this.apply(p, 'after');
  }

  clearLayer(layer: Layer) {
    const ctx = this.ctxFor(layer);
    const before = ctx.getImageData(0, 0, this.width, this.height);
    ctx.clearRect(0, 0, this.width, this.height);
    const after = ctx.getImageData(0, 0, this.width, this.height);
    this.history.push({ layer, x: 0, y: 0, before, after });
    if (layer === 'line') this.touchLines();
    this.emit(true);
  }

  private apply(p: Patch, which: 'before' | 'after') {
    this.ctxFor(p.layer).putImageData(p[which], p.x, p.y);
    if (p.layer === 'line') this.touchLines();
    this.emit(true);
  }

  private emit(dirty: boolean) {
    this.onChange({ canUndo: this.history.canUndo, canRedo: this.history.canRedo, dirty });
  }

  // ================================================================ eksport

  composite(maxSide = MAX_DOC): HTMLCanvasElement {
    const s = Math.min(1, maxSide / Math.max(this.width, this.height));
    const c = document.createElement('canvas');
    c.width = Math.round(this.width * s);
    c.height = Math.round(this.height * s);
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(this.paint, 0, 0, c.width, c.height);
    ctx.drawImage(this.lines, 0, 0, c.width, c.height);
    return c;
  }

  /** Strektegningen alene på hvitt (til lysbord, projektor, utskrift og AI-redigering). */
  flattenLines(): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = this.width;
    c.height = this.height;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(this.lines, 0, 0);
    return c;
  }

  layerCanvas(layer: Layer) {
    return this.canvasFor(layer);
  }

  isBlank(layer: Layer = 'paint'): boolean {
    const d = this.ctxFor(layer).getImageData(0, 0, this.width, this.height).data;
    for (let i = 3; i < d.length; i += 64) if (d[i]) return false;
    return true;
  }

  private clamp(x0: number, y0: number, x1: number, y1: number): [number, number, number, number] {
    return [Math.max(0, Math.floor(x0)), Math.max(0, Math.floor(y0)), Math.min(this.width, Math.ceil(x1)), Math.min(this.height, Math.ceil(y1))];
  }
}

export function hexToRgb(hex: string): [number, number, number] {
  let h = hex.replace('#', '');
  if (h.length === 3) h = [...h].map((c) => c + c).join('');
  const n = parseInt(h.slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** PointerEvent → Pt. Bruker altitude/azimuth der nettleseren har det, ellers tiltX/tiltY. */
export function readPointer(e: PointerEvent, toDoc: (cx: number, cy: number) => { x: number; y: number }): Pt {
  const { x, y } = toDoc(e.clientX, e.clientY);
  const pen = e.pointerType === 'pen';
  let altitude = Math.PI / 2;
  let azimuth = 0;
  const ev = e as PointerEvent & { altitudeAngle?: number; azimuthAngle?: number };
  if (pen && typeof ev.altitudeAngle === 'number' && typeof ev.azimuthAngle === 'number') {
    altitude = ev.altitudeAngle;
    azimuth = ev.azimuthAngle;
  } else if (pen && (e.tiltX || e.tiltY)) {
    const tx = Math.tan((e.tiltX * Math.PI) / 180);
    const ty = Math.tan((e.tiltY * Math.PI) / 180);
    azimuth = Math.atan2(ty, tx);
    altitude = Math.atan(1 / Math.max(1e-6, Math.hypot(tx, ty)));
  }
  return { x, y, pressure: pen ? e.pressure : 0.5, altitude, azimuth, pen };
}
