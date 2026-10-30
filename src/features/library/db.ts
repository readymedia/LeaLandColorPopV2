'use client';
import { createStore, del, get, keys, set, getMany } from 'idb-keyval';

/**
 * «Mine bilder» lagres lokalt i IndexedDB (ikke i minnet som i v1, der alt forsvant ved
 * oppdatering). Fargeleggingen autolagres slik at barnet kan fortsette senere.
 */
export interface Picture {
  id: string;
  prompt: string;
  createdAt: number;
  updatedAt: number;
  lineArt: Blob;
  /** Strek-laget med gjennomsiktighet (når barnet har tegnet streker selv). */
  lineLayer?: Blob;
  /** Fargelaget (PNG med gjennomsiktighet), hvis barnet har begynt å fargelegge. */
  paint?: Blob;
  /** Liten forhåndsvisning (dataURL) for listevisning. */
  thumb?: string;
  /** Hvis malen er delt/hentet fra Kunstveggen. */
  wallTemplateId?: string;
  source: 'ai' | 'upload' | 'wall' | 'draw';
}

const store = typeof indexedDB !== 'undefined' ? createStore('lealand-v2', 'pictures') : undefined;

export async function savePicture(p: Picture) {
  await set(p.id, p, store);
}

export async function getPicture(id: string): Promise<Picture | undefined> {
  return get<Picture>(id, store);
}

export async function updatePicture(id: string, patch: Partial<Picture>) {
  const current = await getPicture(id);
  if (!current) return;
  await set(id, { ...current, ...patch, updatedAt: Date.now() }, store);
}

export async function deletePicture(id: string) {
  await del(id, store);
}

export async function listPictures(): Promise<Picture[]> {
  const ids = (await keys(store)) as string[];
  const all = (await getMany<Picture | undefined>(ids, store)).filter((p): p is Picture => Boolean(p));
  return all.sort((a, b) => b.updatedAt - a.updatedAt);
}

export function newId() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

/** Ber nettleseren om å ikke slette lagringen automatisk (viktig på iPad/Safari). */
export async function requestPersistence() {
  try {
    if (navigator.storage?.persist && !(await navigator.storage.persisted())) await navigator.storage.persist();
  } catch {
    /* ignorer */
  }
}
