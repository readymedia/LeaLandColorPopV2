'use client';
import { useRef } from 'react';
import s from './VSlider.module.css';

/**
 * Loddrett glidebryter (som i Procreate) – flyter langs venstre kant av lerretet.
 * Egen implementasjon fordi loddrette <input type=range> oppfører seg ulikt i Safari/Chrome.
 */
export function VSlider({ value, onChange, label, valueText, min = 0, max = 100, children }: { value: number; onChange: (v: number) => void; label: string; valueText: string; min?: number; max?: number; children?: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const pct = (value - min) / (max - min);

  const setFrom = (clientY: number) => {
    const r = ref.current!.getBoundingClientRect();
    const k = 1 - Math.max(0, Math.min(1, (clientY - r.top) / r.height));
    onChange(Math.round(min + k * (max - min)));
  };

  return (
    <div className={s.wrap}>
      {children}
      <div
        ref={ref}
        className={s.track}
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-orientation="vertical"
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-valuetext={valueText}
        onPointerDown={(e) => {
          e.stopPropagation();
          e.currentTarget.setPointerCapture(e.pointerId);
          setFrom(e.clientY);
        }}
        onPointerMove={(e) => e.currentTarget.hasPointerCapture(e.pointerId) && setFrom(e.clientY)}
        onKeyDown={(e) => {
          const step = (max - min) / 20;
          if (e.key === 'ArrowUp' || e.key === 'ArrowRight') onChange(Math.min(max, Math.round(value + step)));
          if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') onChange(Math.max(min, Math.round(value - step)));
        }}
      >
        <span className={s.fill} style={{ height: `${pct * 100}%` }} />
        <span className={s.thumb} style={{ bottom: `calc(${pct * 100}% - 15px)` }} />
      </div>
      <span className={s.label}>{label}</span>
    </div>
  );
}
