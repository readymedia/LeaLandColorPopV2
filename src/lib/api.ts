'use client';
import type { DictKey } from './i18n/dict';
import type { GalleryItem, GalleryKind, GalleryPage, GallerySort, VoteType } from './gallery/types';
import type { ArtStyle, Difficulty, Orientation } from './ai/prompts';
import { getDeviceId } from '@/store/app';

export class ApiError extends Error {
  constructor(public key: DictKey) {
    super(key);
  }
}

const ERROR_KEYS: Record<string, DictKey> = {
  inappropriate: 'error.inappropriate',
  rate_limited: 'error.rate_limited',
  quota: 'error.quota',
  not_configured: 'error.not_configured',
};

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) throw new ApiError('error.offline');
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers: { 'Content-Type': 'application/json', 'x-device-id': getDeviceId(), ...(init?.headers ?? {}) },
    });
  } catch {
    throw new ApiError('error.offline');
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(ERROR_KEYS[body?.error] ?? 'error.general');
  return body as T;
}

export interface GenerateResult {
  image: string;
  prompt: string;
  model: string;
}

export function generate(input: { prompt: string; orientation: Orientation; difficulty: Difficulty; style: ArtStyle }) {
  return call<GenerateResult>('/api/generate', { method: 'POST', body: JSON.stringify({ mode: 'generate', ...input }) });
}

export function editImage(input: { prompt: string; image: string }) {
  return call<GenerateResult>('/api/generate', { method: 'POST', body: JSON.stringify({ mode: 'edit', ...input }) });
}

export function fetchWall(kind: GalleryKind, sort: GallerySort, page: number) {
  return call<GalleryPage>(`/api/gallery?kind=${kind}&sort=${sort}&page=${page}`);
}

export function shareToWall(input: { image: string; prompt: string; author: string; kind: GalleryKind; templateId?: string }) {
  return call<{ item: GalleryItem }>('/api/gallery', { method: 'POST', body: JSON.stringify(input) });
}

export function voteOnWall(id: string, type: VoteType | 'use' | null) {
  return call<{ hearts: number; likes: number; myVote: VoteType | null }>(`/api/gallery/${id}/vote`, {
    method: 'POST',
    body: JSON.stringify({ type }),
  });
}
