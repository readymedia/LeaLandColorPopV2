'use client';
import { useEffect, useState } from 'react';
import { Button } from '@digdir/designsystemet-react';
import { Palette, Trash2, Sparkles } from 'lucide-react';
import { useApp, useT } from '@/store/app';
import { deletePicture, listPictures, type Picture } from './db';
import s from './LibraryView.module.css';

export function LibraryView() {
  const t = useT();
  const go = useApp((st) => st.go);
  const lang = useApp((st) => st.lang);
  const [items, setItems] = useState<Picture[] | null>(null);

  useEffect(() => {
    listPictures().then(setItems);
  }, []);

  const remove = async (id: string) => {
    if (!window.confirm(`${t('common.delete')}?`)) return;
    await deletePicture(id);
    setItems((x) => x?.filter((p) => p.id !== id) ?? null);
  };

  return (
    <main className={s.main}>
      <h1 className={s.title}>{t('library.title')}</h1>
      <p className={s.note}>{t('library.saved_on_device')}</p>

      {items && items.length === 0 && (
        <div className={s.empty}>
          <p>{t('library.empty')}</p>
          <Button data-size="lg" onClick={() => go({ name: 'home' })}>
            <Sparkles aria-hidden /> {t('nav.create')}
          </Button>
        </div>
      )}

      <ul className={s.grid}>
        {items?.map((p) => (
          <li key={p.id} className={s.card}>
            <button className={s.thumbBtn} onClick={() => go({ name: 'preview', id: p.id })} aria-label={p.prompt}>
              {p.thumb ? <img src={p.thumb} alt="" className={s.thumb} /> : <span className={s.thumb} />}
            </button>
            <div className={s.meta}>
              <p className={s.prompt}>{p.prompt}</p>
              <p className={s.date}>{new Date(p.updatedAt).toLocaleDateString(lang === 'no' ? 'nb-NO' : 'en-GB', { day: 'numeric', month: 'short' })}</p>
            </div>
            <div className={s.actions}>
              <Button data-size="sm" onClick={() => go({ name: 'color', id: p.id })}>
                <Palette aria-hidden /> {p.paint ? t('library.continue') : t('preview.color')}
              </Button>
              <Button variant="tertiary" icon data-size="sm" aria-label={t('common.delete')} onClick={() => remove(p.id)}>
                <Trash2 />
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
