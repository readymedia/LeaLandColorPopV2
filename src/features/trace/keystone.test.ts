import { describe, expect, it } from 'vitest';
import { homographyMatrix3d } from './keystone';

function applyMatrix(m: string, x: number, y: number) {
  const v = m.slice(9, -1).split(',').map(Number);
  // kolonne-major 4x4
  const X = v[0] * x + v[4] * y + v[12];
  const Y = v[1] * x + v[5] * y + v[13];
  const W = v[3] * x + v[7] * y + v[15];
  return [X / W, Y / W];
}

describe('homographyMatrix3d', () => {
  it('identitet når hjørnene ikke er flyttet', () => {
    const m = homographyMatrix3d(100, 50, [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 50 },
      { x: 0, y: 50 },
    ]);
    expect(applyMatrix(m, 100, 50).map((n) => Math.round(n))).toEqual([100, 50]);
  });

  it('treffer alle fire målhjørner for et trapes', () => {
    const dst = [
      { x: 10, y: 5 },
      { x: 90, y: 0 },
      { x: 100, y: 60 },
      { x: 0, y: 50 },
    ] as const;
    const m = homographyMatrix3d(100, 50, [...dst] as never);
    const src = [
      [0, 0],
      [100, 0],
      [100, 50],
      [0, 50],
    ];
    src.forEach(([x, y], i) => {
      const [u, v] = applyMatrix(m, x, y);
      expect(u).toBeCloseTo(dst[i].x, 4);
      expect(v).toBeCloseTo(dst[i].y, 4);
    });
  });
});
