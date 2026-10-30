/**
 * Perspektivkorrigering («keystone») for projektor.
 * Står projektoren på skrå, blir bildet et trapes på arket. Barnet/forelderen drar de fire
 * hjørnene til arkets hjørner, og vi beregner en CSS matrix3d som forvrenger bildet motsatt.
 */
export type Corner = { x: number; y: number };
export type Corners = [Corner, Corner, Corner, Corner]; // øverst-venstre, øverst-høyre, nederst-høyre, nederst-venstre

function solve(A: number[][], b: number[]): number[] {
  // Gauss-eliminasjon (8×8)
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = M[r][c] / M[c][c];
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  return M.map((row, i) => row[n] / row[i]);
}

/** Homografi som tar rektangelet (0,0)-(w,h) til de fire hjørnene. */
export function homographyMatrix3d(w: number, h: number, dst: Corners): string {
  const src: Corners = [
    { x: 0, y: 0 },
    { x: w, y: 0 },
    { x: w, y: h },
    { x: 0, y: h },
  ];
  const A: number[][] = [];
  const b: number[] = [];
  for (let i = 0; i < 4; i++) {
    const { x, y } = src[i];
    const { x: u, y: v } = dst[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
    b.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
    b.push(v);
  }
  const [a, bb, c, d, e, f, g, hh] = solve(A, b);
  // CSS matrix3d er kolonne-major
  const m = [a, d, 0, g, bb, e, 0, hh, 0, 0, 1, 0, c, f, 0, 1];
  return `matrix3d(${m.map((v) => +v.toFixed(10)).join(',')})`;
}

export function defaultCorners(w: number, h: number): Corners {
  return [
    { x: 0, y: 0 },
    { x: w, y: 0 },
    { x: w, y: h },
    { x: 0, y: h },
  ];
}
