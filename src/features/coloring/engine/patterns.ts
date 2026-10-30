export type PatternShape = 'dots' | 'stripes' | 'grid' | 'checkers' | 'stars' | 'hearts' | 'waves' | 'zigzag' | 'rainbow' | 'scales';

export interface PatternDef {
  id: string;
  shape: PatternShape;
  fg: string;
  bg: string;
  size: number; // flisstørrelse i dokument-px
}

export const PATTERNS: PatternDef[] = [
  { id: 'stars-blue', shape: 'stars', fg: '#2F6FEF', bg: '#E6F0FF', size: 56 },
  { id: 'stars-gold', shape: 'stars', fg: '#E5A100', bg: '#FFF6D6', size: 56 },
  { id: 'hearts-pink', shape: 'hearts', fg: '#E8457F', bg: '#FFE6F0', size: 52 },
  { id: 'hearts-red', shape: 'hearts', fg: '#E23B3B', bg: '#FFECEC', size: 52 },
  { id: 'dots-mint', shape: 'dots', fg: '#14A38F', bg: '#E2FAF5', size: 36 },
  { id: 'dots-orange', shape: 'dots', fg: '#F07A1A', bg: '#FFF0E0', size: 44 },
  { id: 'stripes-sky', shape: 'stripes', fg: '#4BA3F5', bg: '#DDEFFF', size: 40 },
  { id: 'stripes-candy', shape: 'stripes', fg: '#F05A8C', bg: '#FFFFFF', size: 40 },
  { id: 'checkers-bw', shape: 'checkers', fg: '#2A2840', bg: '#FFFFFF', size: 48 },
  { id: 'checkers-lilac', shape: 'checkers', fg: '#9B7BFF', bg: '#EFE9FF', size: 48 },
  { id: 'grid-red', shape: 'grid', fg: '#E66', bg: '#FFF4F4', size: 36 },
  { id: 'waves-sea', shape: 'waves', fg: '#1C8FD9', bg: '#DFF3FF', size: 48 },
  { id: 'zigzag-sun', shape: 'zigzag', fg: '#F2A100', bg: '#FFF8DD', size: 44 },
  { id: 'scales-mermaid', shape: 'scales', fg: '#16A39A', bg: '#D9FBF5', size: 40 },
  { id: 'rainbow', shape: 'rainbow', fg: '', bg: '', size: 120 },
];

function star(ctx: CanvasRenderingContext2D, cx: number, cy: number, outer: number, inner: number) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? inner : outer;
    const a = (Math.PI / 5) * i - Math.PI / 2;
    ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.fill();
}

function heart(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number) {
  ctx.beginPath();
  ctx.moveTo(cx, cy + s * 0.35);
  ctx.bezierCurveTo(cx - s, cy - s * 0.3, cx - s * 0.4, cy - s, cx, cy - s * 0.45);
  ctx.bezierCurveTo(cx + s * 0.4, cy - s, cx + s, cy - s * 0.3, cx, cy + s * 0.35);
  ctx.fill();
}

const tileCache = new Map<string, HTMLCanvasElement>();

/** Lager (og cacher) en flis for mønsteret. */
export function patternTile(p: PatternDef): HTMLCanvasElement {
  const cached = tileCache.get(p.id);
  if (cached) return cached;
  const s = p.size;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const ctx = c.getContext('2d')!;
  if (p.shape === 'rainbow') {
    const g = ctx.createLinearGradient(0, 0, s, s);
    ['#FF5A5A', '#FFA53D', '#FFE14D', '#5BD46A', '#45A8FF', '#8A6CFF', '#FF5A5A'].forEach((col, i, a) => g.addColorStop(i / (a.length - 1), col));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
  } else {
    ctx.fillStyle = p.bg;
    ctx.fillRect(0, 0, s, s);
    ctx.fillStyle = p.fg;
    ctx.strokeStyle = p.fg;
    ctx.lineCap = 'round';
    switch (p.shape) {
      case 'dots':
        ctx.beginPath();
        ctx.arc(s / 4, s / 4, s / 7, 0, Math.PI * 2);
        ctx.arc((3 * s) / 4, (3 * s) / 4, s / 7, 0, Math.PI * 2);
        ctx.fill();
        break;
      case 'stripes':
        ctx.lineWidth = s / 4;
        ctx.beginPath();
        for (let k = -1; k <= 1; k++) {
          ctx.moveTo(k * s, s);
          ctx.lineTo(k * s + s, 0);
        }
        ctx.stroke();
        break;
      case 'grid':
        ctx.lineWidth = Math.max(2, s / 12);
        ctx.strokeRect(0, 0, s, s);
        break;
      case 'checkers':
        ctx.fillRect(0, 0, s / 2, s / 2);
        ctx.fillRect(s / 2, s / 2, s / 2, s / 2);
        break;
      case 'stars':
        star(ctx, s / 4, s / 4, s / 6, s / 14);
        star(ctx, (3 * s) / 4, (3 * s) / 4, s / 6, s / 14);
        break;
      case 'hearts':
        heart(ctx, s / 4, s / 3, s / 5);
        heart(ctx, (3 * s) / 4, (5 * s) / 6, s / 5);
        break;
      case 'waves':
        ctx.lineWidth = s / 9;
        ctx.beginPath();
        for (const y0 of [s / 4, (3 * s) / 4]) {
          ctx.moveTo(0, y0);
          ctx.bezierCurveTo(s / 4, y0 - s / 6, s / 4, y0 - s / 6, s / 2, y0);
          ctx.bezierCurveTo((3 * s) / 4, y0 + s / 6, (3 * s) / 4, y0 + s / 6, s, y0);
        }
        ctx.stroke();
        break;
      case 'zigzag':
        ctx.lineWidth = s / 9;
        ctx.lineJoin = 'round';
        ctx.beginPath();
        for (const y0 of [s / 4, (3 * s) / 4]) {
          ctx.moveTo(0, y0);
          ctx.lineTo(s / 4, y0 - s / 8);
          ctx.lineTo(s / 2, y0);
          ctx.lineTo((3 * s) / 4, y0 - s / 8);
          ctx.lineTo(s, y0);
        }
        ctx.stroke();
        break;
      case 'scales':
        ctx.lineWidth = s / 14;
        ctx.beginPath();
        for (const [cx, cy] of [[s / 2, 0], [0, s / 2], [s, s / 2], [s / 2, s]]) {
          ctx.moveTo(cx + s / 2, cy);
          ctx.arc(cx, cy, s / 2, 0, Math.PI);
        }
        ctx.stroke();
        break;
    }
  }
  tileCache.set(p.id, c);
  return c;
}

export function getPattern(id: string): PatternDef | undefined {
  return PATTERNS.find((p) => p.id === id);
}
