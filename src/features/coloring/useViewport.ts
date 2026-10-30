'use client';
import { useCallback, useRef } from 'react';

export interface ViewTransform {
  s: number;
  tx: number;
  ty: number;
}

/**
 * Zoom/panorering for et «stage»-element inne i et viewport-element.
 * Oppdaterer CSS-transform direkte (ingen React-render per bevegelse → jevnt på iPad).
 */
export function useViewport() {
  const viewportRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const t = useRef<ViewTransform>({ s: 1, tx: 0, ty: 0 });
  const doc = useRef({ w: 1, h: 1 });

  const apply = useCallback(() => {
    const st = stageRef.current;
    if (!st) return;
    const { s, tx, ty } = t.current;
    st.style.transform = `translate3d(${tx}px, ${ty}px, 0) scale(${s})`;
  }, []);

  const fit = useCallback(() => {
    const vp = viewportRef.current;
    if (!vp) return;
    const r = vp.getBoundingClientRect();
    const pad = 24;
    const s = Math.min((r.width - pad * 2) / doc.current.w, (r.height - pad * 2) / doc.current.h);
    t.current = { s, tx: (r.width - doc.current.w * s) / 2, ty: (r.height - doc.current.h * s) / 2 };
    apply();
  }, [apply]);

  const setDoc = useCallback(
    (w: number, h: number) => {
      doc.current = { w, h };
      const st = stageRef.current;
      if (st) {
        st.style.width = `${w}px`;
        st.style.height = `${h}px`;
      }
      fit();
    },
    [fit],
  );

  /** Zoom med faktor rundt et punkt (klientkoordinater). */
  const zoomAt = useCallback(
    (factor: number, clientX: number, clientY: number) => {
      const vp = viewportRef.current;
      if (!vp) return;
      const r = vp.getBoundingClientRect();
      const px = clientX - r.left;
      const py = clientY - r.top;
      const cur = t.current;
      const minS = Math.min(r.width / doc.current.w, r.height / doc.current.h) * 0.5;
      const s = Math.max(minS, Math.min(8, cur.s * factor));
      const k = s / cur.s;
      t.current = { s, tx: px - (px - cur.tx) * k, ty: py - (py - cur.ty) * k };
      apply();
    },
    [apply],
  );

  const zoomCenter = useCallback(
    (factor: number) => {
      const r = viewportRef.current?.getBoundingClientRect();
      if (r) zoomAt(factor, r.left + r.width / 2, r.top + r.height / 2);
    },
    [zoomAt],
  );

  const panBy = useCallback(
    (dx: number, dy: number) => {
      t.current.tx += dx;
      t.current.ty += dy;
      apply();
    },
    [apply],
  );

  /** Klientkoordinat → dokumentkoordinat. */
  const toDoc = useCallback((clientX: number, clientY: number) => {
    const r = viewportRef.current!.getBoundingClientRect();
    const { s, tx, ty } = t.current;
    return { x: (clientX - r.left - tx) / s, y: (clientY - r.top - ty) / s };
  }, []);

  return { viewportRef, stageRef, transform: t, setDoc, fit, zoomAt, zoomCenter, panBy, toDoc };
}
