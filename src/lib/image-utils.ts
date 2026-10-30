'use client';

export function loadImage(src: string | Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.decoding = 'async';
    const url = typeof src === 'string' ? src : URL.createObjectURL(src);
    img.onload = () => {
      if (typeof src !== 'string') URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => reject(new Error('Kunne ikke laste bildet'));
    img.src = url;
  });
}

export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  return (await fetch(dataUrl)).blob();
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

export function canvasToBlob(canvas: HTMLCanvasElement, type = 'image/png', quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob feilet'))), type, quality),
  );
}

/** Skalerer ned slik at lengste side ≤ max. Returnerer canvas. */
export function fitCanvas(source: CanvasImageSource & { width: number; height: number }, max: number) {
  const scale = Math.min(1, max / Math.max(source.width, source.height));
  const c = document.createElement('canvas');
  c.width = Math.round(source.width * scale);
  c.height = Math.round(source.height * scale);
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, 0, 0, c.width, c.height);
  return c;
}

export async function makeThumb(source: CanvasImageSource & { width: number; height: number }) {
  return fitCanvas(source, 360).toDataURL('image/webp', 0.8);
}

/**
 * Gjør et opplastet bilde (f.eks. foto av en strektegning) om til ren svart/hvitt strek.
 * Enkel adaptiv terskel – bra nok for skannede/fotograferte malebøker.
 */
export async function photoToLineArt(file: Blob, max = 2048): Promise<Blob> {
  const img = await loadImage(file);
  const c = fitCanvas(img, max);
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  const d = ctx.getImageData(0, 0, c.width, c.height);
  const p = d.data;
  let sum = 0;
  for (let i = 0; i < p.length; i += 4) sum += 0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2];
  const mean = sum / (p.length / 4);
  const threshold = Math.min(160, mean * 0.72);
  for (let i = 0; i < p.length; i += 4) {
    const l = 0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2];
    const v = l < threshold ? 0 : 255;
    p[i] = p[i + 1] = p[i + 2] = v;
    p[i + 3] = 255;
  }
  ctx.putImageData(d, 0, 0);
  return canvasToBlob(c);
}
