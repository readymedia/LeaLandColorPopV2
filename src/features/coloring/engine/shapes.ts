/**
 * «Magisk form» (som QuickShape i Procreate / blekk-forskjønning i Whiteboard):
 * Hold pennen stille på slutten av en strek, så blir den til en pen linje, sirkel, oval,
 * trekant, firkant eller mangekant.
 */
export interface P {
  x: number;
  y: number;
}

export type ShapeKind = 'line' | 'circle' | 'ellipse' | 'triangle' | 'rectangle' | 'polygon';

export interface Shape {
  kind: ShapeKind;
  points: P[]; // tett samplet, klar til å tegnes
}

const dist = (a: P, b: P) => Math.hypot(a.x - b.x, a.y - b.y);

function pathLength(pts: P[]) {
  let l = 0;
  for (let i = 1; i < pts.length; i++) l += dist(pts[i - 1], pts[i]);
  return l;
}

function distToSegment(p: P, a: P, b: P) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (!len2) return dist(p, a);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** Douglas–Peucker forenkling. */
export function simplify(pts: P[], eps: number): P[] {
  if (pts.length < 3) return pts.slice();
  let maxD = 0, idx = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = distToSegment(pts[i], pts[0], pts[pts.length - 1]);
    if (d > maxD) {
      maxD = d;
      idx = i;
    }
  }
  if (maxD <= eps) return [pts[0], pts[pts.length - 1]];
  const a = simplify(pts.slice(0, idx + 1), eps);
  const b = simplify(pts.slice(idx), eps);
  return [...a.slice(0, -1), ...b];
}

function densify(poly: P[], step: number, closed: boolean): P[] {
  const out: P[] = [];
  const n = closed ? poly.length : poly.length - 1;
  for (let i = 0; i < n; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const segs = Math.max(1, Math.ceil(dist(a, b) / step));
    for (let k = 0; k < segs; k++) out.push({ x: a.x + ((b.x - a.x) * k) / segs, y: a.y + ((b.y - a.y) * k) / segs });
  }
  out.push(closed ? { ...poly[0] } : { ...poly[poly.length - 1] });
  return out;
}

function ellipsePoints(cx: number, cy: number, rx: number, ry: number, step: number): P[] {
  const circ = Math.PI * (3 * (rx + ry) - Math.sqrt((3 * rx + ry) * (rx + 3 * ry)));
  const n = Math.max(24, Math.ceil(circ / step));
  const out: P[] = [];
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    out.push({ x: cx + Math.cos(a) * rx, y: cy + Math.sin(a) * ry });
  }
  return out;
}

/** Retter opp nesten-vannrette/loddrette kanter (innen 8°). */
function snapAxis(poly: P[]): P[] {
  const out = poly.map((p) => ({ ...p }));
  for (let i = 0; i < out.length; i++) {
    const a = out[i], b = out[(i + 1) % out.length];
    const ang = Math.abs((Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI) % 180;
    if (ang < 8 || ang > 172) b.y = a.y;
    else if (Math.abs(ang - 90) < 8) b.x = a.x;
  }
  return out;
}

export function recognize(raw: P[]): Shape | null {
  if (raw.length < 4) return null;
  const len = pathLength(raw);
  if (len < 24) return null;
  const xs = raw.map((p) => p.x), ys = raw.map((p) => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const w = maxX - minX, h = maxY - minY;
  const diag = Math.hypot(w, h);
  const start = raw[0], end = raw[raw.length - 1];
  const step = 3;

  // Rett linje
  const maxDev = Math.max(...raw.map((p) => distToSegment(p, start, end)));
  if (maxDev < Math.max(6, dist(start, end) * 0.07)) {
    let e = end;
    // Snapp til vannrett/loddrett/45°
    const ang = Math.atan2(end.y - start.y, end.x - start.x);
    const snap = Math.round(ang / (Math.PI / 4)) * (Math.PI / 4);
    if (Math.abs(ang - snap) < (6 * Math.PI) / 180) {
      const d = dist(start, end);
      e = { x: start.x + Math.cos(snap) * d, y: start.y + Math.sin(snap) * d };
    }
    return { kind: 'line', points: densify([start, e], step, false) };
  }

  const closed = dist(start, end) < Math.max(30, diag * 0.22);
  if (!closed) return null;

  // Ellipse / sirkel: hvor godt ligger punktene på ellipsen innskrevet i boksen?
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2, rx = w / 2, ry = h / 2;
  if (rx > 4 && ry > 4) {
    const errs = raw.map((p) => Math.abs(Math.hypot((p.x - cx) / rx, (p.y - cy) / ry) - 1));
    const meanErr = errs.reduce((a, b) => a + b, 0) / errs.length;
    if (meanErr < 0.1) {
      const ratio = Math.min(rx, ry) / Math.max(rx, ry);
      if (ratio > 0.85) {
        const r = (rx + ry) / 2;
        return { kind: 'circle', points: ellipsePoints(cx, cy, r, r, step) };
      }
      return { kind: 'ellipse', points: ellipsePoints(cx, cy, rx, ry, step) };
    }
  }

  // Mangekant
  const closedPts = [...raw, raw[0]];
  let poly = simplify(closedPts, Math.max(8, diag * 0.07));
  if (poly.length > 1 && dist(poly[0], poly[poly.length - 1]) < diag * 0.25) poly = poly.slice(0, -1);
  // Slå sammen hjørner som ligger veldig nær hverandre
  poly = poly.filter((p, i) => i === 0 || dist(p, poly[i - 1]) > diag * 0.08);
  if (poly.length === 3) return { kind: 'triangle', points: densify(poly, step, true) };
  if (poly.length === 4) {
    const snapped = snapAxis(poly);
    const axisAligned = snapped.every((p, i) => {
      const q = snapped[(i + 1) % 4];
      return Math.abs(p.x - q.x) < 1 || Math.abs(p.y - q.y) < 1;
    });
    if (axisAligned) {
      const sx = snapped.map((p) => p.x), sy = snapped.map((p) => p.y);
      const r = [
        { x: Math.min(...sx), y: Math.min(...sy) },
        { x: Math.max(...sx), y: Math.min(...sy) },
        { x: Math.max(...sx), y: Math.max(...sy) },
        { x: Math.min(...sx), y: Math.max(...sy) },
      ];
      return { kind: 'rectangle', points: densify(r, step, true) };
    }
    return { kind: 'rectangle', points: densify(poly, step, true) };
  }
  if (poly.length >= 5 && poly.length <= 8) return { kind: 'polygon', points: densify(poly, step, true) };
  return null;
}
