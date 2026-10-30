'use client';
import { ApiError, editImage, generate } from '@/lib/api';
import { blobToDataUrl, dataUrlToBlob, fitCanvas, loadImage, makeThumb } from '@/lib/image-utils';
import { isPromptAllowed, sanitizePrompt } from '@/lib/safety';
import { useApp } from '@/store/app';
import { newId, savePicture, getPicture, type Picture } from './db';

async function storeImage(dataUrlOrBlob: string | Blob, prompt: string, source: Picture['source'], wallTemplateId?: string) {
  const blob = typeof dataUrlOrBlob === 'string' ? await dataUrlToBlob(dataUrlOrBlob) : dataUrlOrBlob;
  const img = await loadImage(blob);
  const now = Date.now();
  const pic: Picture = {
    id: newId(),
    prompt,
    createdAt: now,
    updatedAt: now,
    lineArt: blob,
    thumb: await makeThumb(img),
    source,
    wallTemplateId,
  };
  await savePicture(pic);
  return pic;
}

export async function createFromPrompt(rawPrompt: string) {
  const app = useApp.getState();
  const prompt = sanitizePrompt(rawPrompt);
  if (prompt.length < 2) return;
  if (!isPromptAllowed(prompt)) {
    app.setError('error.inappropriate');
    return;
  }
  const back = app.view;
  app.go({ name: 'generating' });
  try {
    const res = await generate({ prompt, orientation: app.orientation, difficulty: app.difficulty, style: app.style });
    const pic = await storeImage(res.image, res.prompt, 'ai');
    useApp.getState().go({ name: 'preview', id: pic.id });
  } catch (e) {
    useApp.setState({ view: back.name === 'generating' ? { name: 'home' } : back });
    useApp.getState().setError(e instanceof ApiError ? e.key : 'error.general');
  }
}

export async function editPicture(id: string, instruction: string) {
  const app = useApp.getState();
  const prompt = sanitizePrompt(instruction);
  if (!isPromptAllowed(prompt)) {
    app.setError('error.inappropriate');
    return false;
  }
  const pic = await getPicture(id);
  if (!pic) return false;
  app.go({ name: 'generating' });
  try {
    // Send en nedskalert PNG (strektegning komprimerer godt) – holder oss under 4,5 MB-grensen
    const img = await loadImage(pic.lineArt);
    const small = fitCanvas(img, 1536).toDataURL('image/png');
    const res = await editImage({ prompt, image: small });
    const next = await storeImage(res.image, `${pic.prompt} + ${prompt}`, 'ai');
    useApp.getState().go({ name: 'preview', id: next.id });
    return true;
  } catch (e) {
    useApp.setState({ view: { name: 'preview', id } });
    useApp.getState().setError(e instanceof ApiError ? e.key : 'error.general');
    return false;
  }
}

export async function createFromUpload(file: File, convert: (f: Blob) => Promise<Blob>) {
  const blob = await convert(file);
  const name = file.name.replace(/\.[a-z0-9]+$/i, '').slice(0, 60) || 'Mitt bilde';
  const pic = await storeImage(blob, name, 'upload');
  useApp.getState().go({ name: 'preview', id: pic.id });
}

/** «Tegn selv»: tomt ark i valgt format, åpnes rett i verkstedet på strek-laget. */
export async function createBlank(orientation: 'portrait' | 'landscape' | 'square', title: string) {
  const [w, h] = orientation === 'portrait' ? [1536, 2048] : orientation === 'landscape' ? [2048, 1536] : [2048, 2048];
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, w, h);
  const blob = await new Promise<Blob>((r) => c.toBlob((b) => r(b!), 'image/png'));
  const pic = await storeImage(blob, title, 'draw');
  useApp.getState().go({ name: 'color', id: pic.id });
}

export async function createFromWall(url: string, prompt: string, wallTemplateId: string) {
  const res = await fetch(url);
  const blob = await res.blob();
  const pic = await storeImage(blob, prompt, 'wall', wallTemplateId);
  useApp.getState().go({ name: 'preview', id: pic.id });
}

export { blobToDataUrl };
