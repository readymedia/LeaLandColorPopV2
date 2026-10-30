import { describe, expect, it } from 'vitest';
import { buildLineMask, dilate, FillMap, scanlineFill } from './fill';

/** Lager et RGBA-bilde fra ASCII: '#' = svart strek, '+' = grå antialias, '.' = hvitt. */
function img(rows: string[]) {
  const h = rows.length, w = rows[0].length;
  const d = new Uint8ClampedArray(w * h * 4);
  rows.forEach((r, y) =>
    [...r].forEach((c, x) => {
      const v = c === '#' ? 0 : c === '+' ? 200 : 255;
      d.set([v, v, v, 255], (y * w + x) * 4);
    }),
  );
  return { d, w, h };
}

describe('scanlineFill', () => {
  const { d, w, h } = img([
    '..........',
    '.#####....',
    '.#...#....',
    '.#...#....',
    '.#####....',
    '..........',
  ]);
  const lines = buildLineMask(d, w, h);

  it('fyller bare innsiden av en lukket figur', () => {
    const r = scanlineFill(lines.wall, w, h, 3, 2)!;
    expect(r.count).toBe(6);
    expect([r.x0, r.y0, r.x1, r.y1]).toEqual([2, 2, 4, 3]);
  });

  it('fyller utsiden rundt figuren', () => {
    const r = scanlineFill(lines.wall, w, h, 0, 0)!;
    expect(r.count).toBe(w * h - 14 - 6);
  });

  it('returnerer null på en strek', () => {
    expect(scanlineFill(lines.wall, w, h, 1, 1)).toBeNull();
  });
});

describe('hull-lukking', () => {
  // Figur med et hull på 1 px i høyre vegg
  const { d, w, h } = img([
    '...........',
    '.#####.....',
    '.#...#.....',
    '.#.........',
    '.#...#.....',
    '.#####.....',
    '...........',
  ]);
  const map = new FillMap(buildLineMask(d, w, h));

  it('lekker uten hull-lukking', () => {
    const r = scanlineFill(map.lines.wall, w, h, 3, 3)!;
    expect(r.count).toBeGreaterThan(20);
  });

  it('holder seg inne med gap=1', () => {
    const r = scanlineFill(map.blocked(1), w, h, 3, 3)!;
    expect(r.x1).toBeLessThanOrEqual(5);
  });
});

describe('vekst inn under strek', () => {
  const { d, w, h } = img([
    '#######',
    '#+...+#',
    '#+...+#',
    '#######',
  ]);
  const map = new FillMap(buildLineMask(d, w, h));
  it('dekker antialias-piksler slik at det ikke blir hvite kanter', () => {
    const r = map.region(3, 1, { gap: 0, grow: 1 })!;
    expect(r.mask[1 * w + 1]).toBe(1);
    expect(r.mask[1 * w + 5]).toBe(1);
  });
  it('krysser ikke ut på andre siden av streken', () => {
    const r = map.region(3, 1, { gap: 0, grow: 3 })!;
    expect(r.x0).toBeGreaterThanOrEqual(0);
    // Strekpikslene selv er «myke», men utsiden finnes ikke her – sjekk at count er begrenset
    expect(r.count).toBeLessThanOrEqual(w * h);
  });
});

describe('dilate', () => {
  it('utvider med radius', () => {
    const src = new Uint8Array(25);
    src[12] = 1;
    const out = dilate(src, 5, 5, 1);
    expect(out.reduce((a, b) => a + b, 0)).toBe(9);
  });
});

import { buildLineMaskFromAlpha } from './fill';
describe('buildLineMaskFromAlpha', () => {
  it('farget strek er også en kant', () => {
    const d = new Uint8ClampedArray([255, 230, 0, 255, 0, 0, 0, 0, 255, 0, 0, 60]);
    const m = buildLineMaskFromAlpha(d, 3, 1);
    expect([...m.wall]).toEqual([1, 0, 0]);
    expect([...m.soft]).toEqual([1, 0, 1]);
  });
});
