'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import s from './Menu.module.css';

/** Liten nedtrekksmeny som lukkes ved trykk utenfor eller Escape. */
export function Menu({ trigger, children, align = 'end', label }: { trigger: (open: boolean, toggle: () => void) => ReactNode; children: (close: () => void) => ReactNode; align?: 'start' | 'end'; label: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);
  return (
    <div className={s.wrap} ref={ref}>
      {trigger(open, () => setOpen((o) => !o))}
      {open && (
        <div className={s.panel} data-align={align} role="menu" aria-label={label}>
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}
