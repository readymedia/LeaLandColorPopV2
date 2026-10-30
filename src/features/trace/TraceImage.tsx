'use client';
import { useId } from 'react';
import type { Corners } from './keystone';
import { homographyMatrix3d } from './keystone';
import s from './TraceImage.module.css';

export interface TraceState {
  scale: number;
  x: number;
  y: number;
  rotation: number;
  mirror: boolean;
  /** 0 = original, 1–3 = tykkere streker */
  thicken: number;
  invert: boolean;
  grid: boolean;
  corners: Corners | null;
}

export const DEFAULT_TRACE: TraceState = {
  scale: 1,
  x: 0,
  y: 0,
  rotation: 0,
  mirror: false,
  thicken: 0,
  invert: false,
  grid: false,
  corners: null,
};

/**
 * Viser strektegningen for avtegning. Delt mellom lysbord, projektor og egen projektorskjerm.
 * Tykkere streker lages med SVG-morfologi (erode på hvit bakgrunn = fetere svarte streker),
 * slik at de syns gjennom tykt papir.
 */
export function TraceImage({ src, state, frame }: { src: string; state: TraceState; frame: { w: number; h: number } }) {
  const fid = useId().replace(/:/g, '');
  const filters = [state.thicken > 0 ? `url(#${fid})` : '', state.invert ? 'invert(1)' : ''].filter(Boolean).join(' ') || undefined;
  const warp = state.corners ? homographyMatrix3d(frame.w, frame.h, state.corners) : undefined;

  return (
    <div className={s.frame} style={{ width: frame.w, height: frame.h, transform: warp, background: state.invert ? '#000' : '#fff' }}>
      <svg width="0" height="0" className={s.defs} aria-hidden>
        <filter id={fid}>
          <feMorphology operator="erode" radius={state.thicken * 1.2} />
        </filter>
      </svg>
      <div
        className={s.inner}
        style={{
          transform: `translate(${state.x}px, ${state.y}px) rotate(${state.rotation}deg) scale(${state.scale * (state.mirror ? -1 : 1)}, ${state.scale})`,
        }}
      >
        <img src={src} alt="" draggable={false} className={s.img} style={{ filter: filters }} />
      </div>
      {state.grid && <div className={s.grid} data-invert={state.invert} aria-hidden />}
    </div>
  );
}
