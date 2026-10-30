'use client';
import { useEffect, useRef } from 'react';
import { useApp } from '@/store/app';

/** Bakgrunnsmusikk. Starter aldri av seg selv – bare når barnet slår den på (nettlesere krever det uansett). */
export function MusicPlayer() {
  const music = useApp((s) => s.music);
  const ref = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!music) {
      ref.current?.pause();
      return;
    }
    if (!ref.current) {
      ref.current = new Audio('/melody.mp3');
      ref.current.loop = true;
      ref.current.volume = 0.25;
    }
    ref.current.play().catch(() => useApp.getState().set({ music: false }));
  }, [music]);

  useEffect(() => () => ref.current?.pause(), []);
  return null;
}
