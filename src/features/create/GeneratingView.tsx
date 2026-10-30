'use client';
import { useEffect, useState } from 'react';
import { useT } from '@/store/app';
import s from './GeneratingView.module.css';

export function GeneratingView() {
  const t = useT();
  const tips = t('loading.tips').split('|');
  const [i, setI] = useState(() => Math.floor(Math.random() * tips.length));

  useEffect(() => {
    const id = setInterval(() => setI((x) => (x + 1) % tips.length), 4500);
    return () => clearInterval(id);
  }, [tips.length]);

  return (
    <main className={s.main} aria-busy="true">
      <svg className={s.art} viewBox="0 0 320 220" aria-hidden>
        <path
          className={s.line}
          d="M30 170 C 60 60, 120 60, 140 120 S 210 200, 230 110 S 300 40, 290 150 M70 190 q 40 -30 80 0 t 80 0"
        />
        <circle className={s.dot} data-c="0" cx="60" cy="60" r="10" />
        <circle className={s.dot} data-c="1" cx="260" cy="40" r="7" />
        <circle className={s.dot} data-c="2" cx="180" cy="190" r="8" />
      </svg>
      <h1 className={s.title} role="status">
        {t('loading.title')}
      </h1>
      <p className={s.tip} key={i}>
        {tips[i]}
      </p>
    </main>
  );
}
