import { describe, expect, it } from 'vitest';
import { recognize } from './shapes';

const jitter = (n: number) => (Math.sin(n * 12.9898) * 43758.5453) % 1 * 3;

function wobblyCircle(cx: number, cy: number, r: number) {
  return Array.from({ length: 80 }, (_, i) => {
    const a = (i / 79) * Math.PI * 2;
    return { x: cx + Math.cos(a) * (r + jitter(i)), y: cy + Math.sin(a) * (r + jitter(i + 7)) };
  });
}

function wobblyPoly(corners: [number, number][]) {
  const out: { x: number; y: number }[] = [];
  const pts = [...corners, corners[0]];
  for (let i = 0; i < pts.length - 1; i++) {
    for (let k = 0; k < 20; k++) {
      const t = k / 20;
      out.push({ x: pts[i][0] + (pts[i + 1][0] - pts[i][0]) * t + jitter(i * 20 + k), y: pts[i][1] + (pts[i + 1][1] - pts[i][1]) * t + jitter(i * 20 + k + 3) });
    }
  }
  out.push({ x: corners[0][0] + 4, y: corners[0][1] + 3 });
  return out;
}

describe('recognize', () => {
  it('rett linje', () => {
    const pts = Array.from({ length: 40 }, (_, i) => ({ x: i * 10, y: 100 + jitter(i) }));
    expect(recognize(pts)?.kind).toBe('line');
  });
  it('sirkel', () => {
    expect(recognize(wobblyCircle(300, 300, 120))?.kind).toBe('circle');
  });
  it('oval', () => {
    const pts = wobblyCircle(300, 300, 100).map((p) => ({ x: (p.x - 300) * 2 + 300, y: p.y }));
    expect(recognize(pts)?.kind).toBe('ellipse');
  });
  it('firkant', () => {
    expect(recognize(wobblyPoly([[100, 100], [500, 100], [500, 400], [100, 400]]))?.kind).toBe('rectangle');
  });
  it('trekant', () => {
    expect(recognize(wobblyPoly([[300, 80], [520, 450], [80, 450]]))?.kind).toBe('triangle');
  });
  it('åpen krusedull blir ikke noe', () => {
    const pts = Array.from({ length: 60 }, (_, i) => ({ x: i * 8, y: Math.sin(i / 4) * 80 + 200 }));
    expect(recognize(pts)).toBeNull();
  });
});
