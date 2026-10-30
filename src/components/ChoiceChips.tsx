'use client';
import type { ReactNode } from 'react';
import s from './ChoiceChips.module.css';

/** Store, runde valgknapper som brytes pent på smale skjermer (erstatter ToggleGroup på forsiden). */
export function ChoiceChips<T extends string>({ label, value, onChange, options }: { label: string; value: T; onChange: (v: T) => void; options: { value: T; label: string; icon?: ReactNode }[] }) {
  return (
    <div className={s.group} role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={value === o.value} className={s.chip} onClick={() => onChange(o.value)}>
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  );
}
