/**
 * Fargemiksing som oppfører seg som maling (rødt + gult = oransje, gult + blått = grønt).
 * v1 blandet lineært i RGB, så gult+blått ble grått. Her brukes RYB→RGB trilineær
 * interpolasjon (Gossett & Chen, 2004) – samme modell som brukes i mange tegneprogrammer for barn.
 */

const CORNERS: [number, number, number][] = [
  [1, 1, 1], // 000 hvit
  [1, 1, 0], // 001 gul (y)
  [0.163, 0.373, 0.6], // 010 blå (b)
  [0, 0.66, 0.2], // 011 grønn (y+b)
  [1, 0, 0], // 100 rød (r)
  [1, 0.5, 0], // 101 oransje (r+y)
  [0.5, 0, 0.5], // 110 lilla (r+b)
  [0.2, 0.094, 0], // 111 brun/svart
];

/** r, y, b i [0,1]. */
export function rybToRgb(r: number, y: number, b: number): [number, number, number] {
  const out: [number, number, number] = [0, 0, 0];
  for (let i = 0; i < 8; i++) {
    const wr = i & 4 ? r : 1 - r;
    const wb = i & 2 ? b : 1 - b;
    const wy = i & 1 ? y : 1 - y;
    const w = wr * wb * wy;
    out[0] += CORNERS[i][0] * w;
    out[1] += CORNERS[i][1] * w;
    out[2] += CORNERS[i][2] * w;
  }
  return out;
}

export interface Paint {
  red: number;
  yellow: number;
  blue: number;
  white: number;
  black: number;
}

/** «Dråper» av hver maling → hex. Mengdene normaliseres slik at forholdet teller, ikke totalen. */
export function mixPaints(p: Paint): string {
  const colour = p.red + p.yellow + p.blue;
  const total = colour + p.white + p.black;
  if (total === 0) return '#ffffff';
  let rgb: [number, number, number] = [1, 1, 1];
  if (colour > 0) {
    const max = Math.max(p.red, p.yellow, p.blue);
    rgb = rybToRgb(p.red / max, p.yellow / max, p.blue / max);
  }
  // Hvitt lysner, svart mørkner (andel av total)
  const wt = p.white / total;
  const bk = p.black / total;
  const colourShare = colour / total;
  if (colour === 0) {
    const v = 1 - bk;
    rgb = [v, v, v];
  } else {
    rgb = rgb.map((c) => c * colourShare + 1 * wt) as [number, number, number];
    const sum = colourShare + wt;
    rgb = rgb.map((c) => (c / sum) * (1 - bk)) as [number, number, number];
  }
  return '#' + rgb.map((c) => Math.round(Math.max(0, Math.min(1, c)) * 255).toString(16).padStart(2, '0')).join('');
}

const NAMED: { no: string; en: string; hex: string }[] = [
  { no: 'rød', en: 'red', hex: '#ff0000' },
  { no: 'oransje', en: 'orange', hex: '#ff8000' },
  { no: 'gul', en: 'yellow', hex: '#ffff00' },
  { no: 'grønn', en: 'green', hex: '#00a833' },
  { no: 'blå', en: 'blue', hex: '#2a5f99' },
  { no: 'lilla', en: 'purple', hex: '#800080' },
  { no: 'rosa', en: 'pink', hex: '#ff80c0' },
  { no: 'brun', en: 'brown', hex: '#7a3d10' },
  { no: 'grå', en: 'grey', hex: '#888888' },
  { no: 'svart', en: 'black', hex: '#111111' },
  { no: 'hvit', en: 'white', hex: '#ffffff' },
  { no: 'lyseblå', en: 'light blue', hex: '#9cc6f0' },
  { no: 'lysegrønn', en: 'light green', hex: '#9be3a8' },
  { no: 'turkis', en: 'turquoise', hex: '#1fb5a6' },
  { no: 'beige', en: 'beige', hex: '#f0dcb4' },
];

/** Gir et barnevennlig navn på nærmeste kjente farge. */
export function nameColour(hex: string, lang: 'no' | 'en'): string {
  const parse = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [r, g, b] = parse(hex);
  let best = NAMED[0];
  let bestD = Infinity;
  for (const n of NAMED) {
    const [r2, g2, b2] = parse(n.hex);
    const d = (r - r2) ** 2 * 0.3 + (g - g2) ** 2 * 0.59 + (b - b2) ** 2 * 0.11;
    if (d < bestD) {
      bestD = d;
      best = n;
    }
  }
  return best[lang];
}
