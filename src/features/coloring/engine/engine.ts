'use client';
import { loadImage } from '@/lib/image-utils';
import { buildLineMask, FillMap } from './fill';
import { History, type Patch } from './history';
import { getPattern, patternTile } from './patterns';
import { SIZES, TOOL_SPECS, type PaintSource, type ToolState } from './tools';

export interface Pt {
  x: number;
  y: number;
  pressure: number;
}

/** Maks lengste side for dokumentet. 2048 gir skarp utskrift på A4 og holder minnet nede på iPad. */
const MAX_DOC = 2048;
const LINE_INK = [29, 27, 46]; // nesten svart, litt varm

/**
 * Fargeleggingsmotoren. Uavhengig av React.
 *
 * Lag (nederst → øverst):  hvitt papir · paint (fargene) · stroke (pågående strøk) · lines (strekene)
 * Strekene ligger alltid øverst, så farge kan aldri dekke over dem, og fyll kan krype litt
 * inn under strekene uten synlige kanter.
 */
export class ColoringEngine {
  width = 0;
  height = 0;
  readonly paint: HTMLCanvasElement;
  readonly stroke: HTMLCanvasElement;
  readonly lines: HTMLCanvasElement;
  private pctx!: CanvasRenderingContext2D;
  private sctx!: CanvasRenderingContext2D;
  private fillMap: FillMap | null = null;
  private history = new History();
  private current: { tool: ToolState; last: Pt; prev: Pt | null; dist: number; bbox: [number, number, number, number]; lastStamp: Pt | null } | null = null;
  private crayonCache = new Map<string, CanvasPattern>();
  onChange: (state: { canUndo: boolean; canRedo: boolean; dirty: boolean }) => void = () => {};

  constructor(paint: HTMLCanvasElement, stroke: HTMLCanvasElement, lines: HTMLCanvasElement) {
    this.paint = paint;
    this.stroke = stroke;
    this.lines = lines;
  }

  async load(lineArt: Blob | string, paint?: Blob) {
    const img = await loadImage(lineArt);
    const scale = Math.min(1, MAX_DOC / Math.max(img.naturalWidth, img.naturalHeight));
    const W = Math.round(img.naturalWidth * scale);
    const H = Math.round(img.naturalHeight * scale);
    this.width = W;
    this.height = H;
    for (const c of [this.paint, this.stroke, this.lines]) {
      c.width = W;
      c.height = H;
    }
    this.pctx = this.paint.getContext('2d', { willReadFrequently: true })!;
    this.sctx = this.stroke.getContext('2d')!;

    // Strekene: les pikslene, lag fyll-kart og et gjennomsiktig strek-lag
    const lctx = this.lines.getContext('2d', { willReadFrequently: true })!;
    lctx.fillStyle = '#fff';
    lctx.fillRect(0, 0, W, H);
    lctx.imageSmoothingQuality = 'high';
    lctx.drawImage(img, 0, 0, W, H);
    const data = lctx.getImageData(0, 0, W, H);
    this.fillMap = new FillMap(buildLineMask(data.data, W, H));
    const px = data.data;
    for (let i = 0; i < px.length; i += 4) {
      const lum = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
      // Fjern grå støy/JPEG-artefakter, gjør strekene rene og mørke
      const ink = lum > 232 ? 0 : Math.min(255, Math.round(((232 - lum) / 232) * 255 * 1.25));
      px[i] = LINE_INK[0];
      px[i + 1] = LINE_INK[1];
      px[i + 2] = LINE_INK[2];
      px[i + 3] = ink;
    }
    lctx.clearRect(0, 0, W, H);
    lctx.putImageData(data, 0, 0);

    this.pctx.clearRect(0, 0, W, H);
    if (paint) {
      const p = await loadImage(paint);
      this.pctx.drawImage(p, 0, 0, W, H);
    }
    this.history.clear();
    this.emit(false);
  }

  // ---------------------------------------------------------------- strøk

  begin(tool: ToolState, pt: Pt) {
    const spec = TOOL_SPECS[tool.tool as keyof typeof TOOL_SPECS];
    if (!spec) return;
    this.current = { tool, last: pt, prev: null, dist: 0, bbox: [pt.x, pt.y, pt.x, pt.y], lastStamp: null };
    const ctx = this.sctx;
    ctx.clearRect(0, 0, this.width, this.height);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.shadowBlur = 0;
    // Forhåndsvisning med samme opasitet som strøket får når det «tørker»
    this.stroke.style.opacity = String(tool.tool === 'eraser' ? 1 : spec.alpha);
    this.stroke.style.mixBlendMode = spec.composite === 'multiply' ? 'multiply' : 'normal';
    this.dab(pt, pt);
  }

  move(points: Pt[]) {
    if (!this.current) return;
    for (const pt of points) {
      const c = this.current;
      const d = Math.hypot(pt.x - c.last.x, pt.y - c.last.y);
      if (d < 0.75) continue;
      this.dab(c.last, pt);
      c.prev = c.last;
      c.last = pt;
      c.dist += d;
    }
  }

  end() {
    const c = this.current;
    if (!c) return;
    const spec = TOOL_SPECS[c.tool.tool as keyof typeof TOOL_SPECS];
    // Tegn siste halvsegment (kurven slutter i midtpunktet)
    if (c.prev && !['spray', 'glitter', 'stamp'].includes(c.tool.tool)) {
      const ctx = this.sctx;
      ctx.beginPath();
      ctx.moveTo((c.prev.x + c.last.x) / 2, (c.prev.y + c.last.y) / 2);
      ctx.lineTo(c.last.x, c.last.y);
      ctx.stroke();
    }
    this.current = null;
    const pad = Math.ceil(this.brushSize(c.tool) * 3) + 4;
    const [x0, y0, x1, y1] = this.clampBox(c.bbox[0] - pad, c.bbox[1] - pad, c.bbox[2] + pad, c.bbox[3] + pad);
    const w = x1 - x0, h = y1 - y0;
    if (w <= 0 || h <= 0) return;
    const before = this.pctx.getImageData(x0, y0, w, h);
    this.pctx.save();
    this.pctx.globalAlpha = c.tool.tool === 'eraser' ? 1 : spec.alpha;
    this.pctx.globalCompositeOperation = spec.composite;
    this.pctx.drawImage(this.stroke, x0, y0, w, h, x0, y0, w, h);
    this.pctx.restore();
    this.sctx.clearRect(0, 0, this.width, this.height);
    const after = this.pctx.getImageData(x0, y0, w, h);
    this.history.push({ x: x0, y: y0, before, after });
    this.emit(true);
  }

  /** Avbryt pågående strøk (f.eks. når to fingre lander for å zoome). */
  cancel() {
    if (!this.current) return;
    this.current = null;
    this.sctx.clearRect(0, 0, this.width, this.height);
  }

  get drawing() {
    return this.current !== null;
  }

  private brushSize(t: ToolState) {
    const spec = TOOL_SPECS[t.tool as keyof typeof TOOL_SPECS];
    return SIZES[t.size] * (spec?.sizeFactor ?? 1);
  }

  private style(t: ToolState, ctx: CanvasRenderingContext2D): string | CanvasPattern {
    if (t.tool === 'eraser') return '#ffffff';
    return this.paintStyle(t.paint, ctx, t.tool === 'crayon');
  }

  private paintStyle(p: PaintSource, ctx: CanvasRenderingContext2D, grainy = false): string | CanvasPattern {
    if (p.kind === 'pattern') {
      const def = getPattern(p.id);
      if (def) return ctx.createPattern(patternTile(def), 'repeat') ?? '#000';
      return '#000';
    }
    if (!grainy) return p.color;
    let pat = this.crayonCache.get(p.color);
    if (!pat) {
      // Fargestift: farget flis med tilfeldig «papirkorn»
      const s = 96;
      const c = document.createElement('canvas');
      c.width = c.height = s;
      const g = c.getContext('2d')!;
      g.fillStyle = p.color;
      g.fillRect(0, 0, s, s);
      const id = g.getImageData(0, 0, s, s);
      let seed = 7;
      const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      for (let i = 3; i < id.data.length; i += 4) {
        const r = rnd();
        id.data[i] = r < 0.18 ? 0 : r < 0.4 ? 150 : 255;
      }
      g.putImageData(id, 0, 0);
      pat = this.sctx.createPattern(c, 'repeat')!;
      this.crayonCache.set(p.color, pat);
    }
    return pat;
  }

  private grow(x: number, y: number, r: number) {
    const b = this.current!.bbox;
    b[0] = Math.min(b[0], x - r);
    b[1] = Math.min(b[1], y - r);
    b[2] = Math.max(b[2], x + r);
    b[3] = Math.max(b[3], y + r);
  }

  /** Tegner ett segment fra a til b med aktivt verktøy. */
  private dab(a: Pt, b: Pt) {
    const c = this.current!;
    const t = c.tool;
    const spec = TOOL_SPECS[t.tool as keyof typeof TOOL_SPECS];
    const ctx = this.sctx;
    const base = this.brushSize(t);
    const pressure = spec.pressure ? 0.55 + Math.min(1, b.pressure || 0.5) * 0.9 : 1;
    const size = Math.max(1.5, base * pressure);
    this.grow(b.x, b.y, size * 2);
    this.grow(a.x, a.y, size * 2);

    switch (t.tool) {
      case 'spray': {
        ctx.fillStyle = this.style(t, ctx);
        const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / (size / 3)));
        for (let s = 0; s < steps; s++) {
          const cx = a.x + ((b.x - a.x) * s) / steps;
          const cy = a.y + ((b.y - a.y) * s) / steps;
          for (let i = 0; i < size * 0.8; i++) {
            const ang = Math.random() * Math.PI * 2;
            const rad = Math.sqrt(Math.random()) * size;
            const dot = Math.max(1, size / 22);
            ctx.fillRect(cx + Math.cos(ang) * rad, cy + Math.sin(ang) * rad, dot, dot);
          }
        }
        return;
      }
      case 'glitter': {
        const base = t.paint.kind === 'solid' ? t.paint.color : '#FFD54F';
        const tints = [base, '#FFFFFF', '#FFE58A', base];
        const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / (size / 2)));
        for (let s = 0; s < steps; s++) {
          const cx = a.x + ((b.x - a.x) * s) / steps;
          const cy = a.y + ((b.y - a.y) * s) / steps;
          for (let i = 0; i < 10; i++) {
            const ang = Math.random() * Math.PI * 2;
            const rad = Math.sqrt(Math.random()) * size;
            const x = cx + Math.cos(ang) * rad;
            const y = cy + Math.sin(ang) * rad;
            ctx.fillStyle = tints[(Math.random() * tints.length) | 0];
            const r = Math.random() < 0.12 ? size / 5 : size / 14;
            if (r > size / 8) {
              // liten stjerne-gnist
              ctx.beginPath();
              ctx.moveTo(x, y - r);
              ctx.quadraticCurveTo(x, y, x + r, y);
              ctx.quadraticCurveTo(x, y, x, y + r);
              ctx.quadraticCurveTo(x, y, x - r, y);
              ctx.quadraticCurveTo(x, y, x, y - r);
              ctx.fill();
            } else {
              ctx.beginPath();
              ctx.arc(x, y, Math.max(1, r), 0, Math.PI * 2);
              ctx.fill();
            }
          }
        }
        return;
      }
      case 'stamp': {
        const spacing = base * 1.15;
        if (c.lastStamp && Math.hypot(b.x - c.lastStamp.x, b.y - c.lastStamp.y) < spacing) return;
        c.lastStamp = b;
        ctx.save();
        ctx.font = `${base}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.translate(b.x, b.y);
        ctx.rotate((Math.random() - 0.5) * 0.5);
        ctx.fillText(t.stamp, 0, 0);
        ctx.restore();
        this.grow(b.x, b.y, base);
        return;
      }
    }

    // Linjebaserte verktøy med jevn kurve (kvadratisk gjennom midtpunkter)
    ctx.lineWidth = size;
    ctx.shadowBlur = 0;
    if (t.tool === 'rainbow') {
      ctx.strokeStyle = `hsl(${(c.dist / 3) % 360} 90% 58%)`;
    } else {
      ctx.strokeStyle = this.style(t, ctx);
    }
    if (t.tool === 'brush' && t.paint.kind === 'solid') {
      ctx.shadowBlur = size * 0.5;
      ctx.shadowColor = t.paint.color;
    }
    const prev = c.prev;
    ctx.beginPath();
    if (prev) {
      const m1x = (prev.x + a.x) / 2, m1y = (prev.y + a.y) / 2;
      const m2x = (a.x + b.x) / 2, m2y = (a.y + b.y) / 2;
      ctx.moveTo(m1x, m1y);
      ctx.quadraticCurveTo(a.x, a.y, m2x, m2y);
    } else {
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x + 0.01, b.y);
    }
    ctx.stroke();
  }

  // ---------------------------------------------------------------- fyll

  fill(x: number, y: number, paint: PaintSource, gap = 2): boolean {
    if (!this.fillMap) return false;
    const r = this.fillMap.region(x, y, { gap, grow: 2 });
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
      tctx.translate(-x0, -y0); // mønsteret forankres i dokumentets origo → sømløst med pensel
      tctx.fillStyle = this.paintStyle(paint, tctx);
      tctx.fillRect(x0, y0, w, h);
      src = tctx.getImageData(0, 0, w, h).data;
    }

    const W = this.width;
    const out = after.data;
    for (let yy = 0; yy < h; yy++) {
      const mrow = (y0 + yy) * W + x0;
      for (let xx = 0; xx < w; xx++) {
        if (!r.mask[mrow + xx]) continue;
        const p = (yy * w + xx) * 4;
        out[p] = src[p];
        out[p + 1] = src[p + 1];
        out[p + 2] = src[p + 2];
        out[p + 3] = 255;
      }
    }
    this.pctx.putImageData(after, x0, y0);
    this.history.push({ x: x0, y: y0, before, after });
    this.emit(true);
    return true;
  }

  // ---------------------------------------------------------------- historikk

  undo() {
    const p = this.history.undo();
    if (p) this.apply(p, 'before');
  }

  redo() {
    const p = this.history.redo();
    if (p) this.apply(p, 'after');
  }

  clearAll() {
    const before = this.pctx.getImageData(0, 0, this.width, this.height);
    this.pctx.clearRect(0, 0, this.width, this.height);
    const after = this.pctx.getImageData(0, 0, this.width, this.height);
    this.history.push({ x: 0, y: 0, before, after });
    this.emit(true);
  }

  private apply(p: Patch, which: 'before' | 'after') {
    this.pctx.putImageData(p[which], p.x, p.y);
    this.emit(true);
  }

  private emit(dirty: boolean) {
    this.onChange({ canUndo: this.history.canUndo, canRedo: this.history.canRedo, dirty });
  }

  // ---------------------------------------------------------------- eksport

  /** Ferdig bilde: papir + farger + streker. */
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

  /** Bare fargelaget (for autolagring). */
  paintLayer(): HTMLCanvasElement {
    return this.paint;
  }

  isBlank(): boolean {
    const d = this.pctx.getImageData(0, 0, this.width, this.height).data;
    for (let i = 3; i < d.length; i += 64) if (d[i]) return false;
    return true;
  }

  private clampBox(x0: number, y0: number, x1: number, y1: number): [number, number, number, number] {
    return [
      Math.max(0, Math.floor(x0)),
      Math.max(0, Math.floor(y0)),
      Math.min(this.width, Math.ceil(x1)),
      Math.min(this.height, Math.ceil(y1)),
    ];
  }
}

export function hexToRgb(hex: string): [number, number, number] {
  let h = hex.replace('#', '');
  if (h.length === 3) h = [...h].map((c) => c + c).join('');
  const n = parseInt(h.slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
