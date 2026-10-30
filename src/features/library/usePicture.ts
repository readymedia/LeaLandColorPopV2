'use client';
import { useEffect, useState } from 'react';
import { getPicture, type Picture } from './db';

/** Laster et bilde fra IndexedDB og lager en objekt-URL for strektegningen. */
export function usePicture(id: string) {
  const [pic, setPic] = useState<Picture | null | undefined>(undefined);
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    let objectUrl: string | null = null;
    getPicture(id).then((p) => {
      if (!alive) return;
      setPic(p ?? null);
      if (p) {
        objectUrl = URL.createObjectURL(p.lineArt);
        setUrl(objectUrl);
      }
    });
    return () => {
      alive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [id]);

  return { pic, url };
}
