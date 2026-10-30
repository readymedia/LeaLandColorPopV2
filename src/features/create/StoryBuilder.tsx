'use client';
import { useState } from 'react';
import { Button, Dialog, Heading, Paragraph } from '@digdir/designsystemet-react';
import { Check } from 'lucide-react';
import { useApp, useT } from '@/store/app';
import { BUILDER } from '@/lib/i18n/ideas';
import s from './StoryBuilder.module.css';

type Slot = 'who' | 'doing' | 'where' | 'extra';
const SLOTS: Slot[] = ['who', 'doing', 'where', 'extra'];

/** Barnet setter sammen en setning: «en drage» + «baker kake» + «på Nordpolen» + «med hatt». */
export function StoryBuilder({ open, onClose, onUse }: { open: boolean; onClose: () => void; onUse: (text: string) => void }) {
  const t = useT();
  const lang = useApp((st) => st.lang);
  const [picked, setPicked] = useState<Record<Slot, string[]>>({ who: [], doing: [], where: [], extra: [] });

  const toggle = (slot: Slot, word: string) =>
    setPicked((p) => ({ ...p, [slot]: p[slot].includes(word) ? p[slot].filter((w) => w !== word) : [...p[slot], word] }));

  const and = lang === 'no' ? ' og ' : ' and ';
  const sentence = SLOTS.map((sl) => picked[sl].join(and)).filter(Boolean).join(' ');
  const pretty = sentence ? sentence[0].toUpperCase() + sentence.slice(1) : '';

  return (
    <Dialog open={open} onClose={onClose} closedby="any" modal className={s.dialog} closeButton={t('common.close')}>
      <Heading level={2} data-size="md" className={s.h}>
        {t('builder.title')}
      </Heading>
      <Paragraph>{t('builder.description')}</Paragraph>

      {SLOTS.map((slot, si) => (
        <fieldset key={slot} className={s.group}>
          <legend className={s.legend}>{t(`builder.${slot}`)}</legend>
          <div className={s.words}>
            {BUILDER[lang][slot].map((w) => {
              const on = picked[slot].includes(w);
              return (
                <button key={w} type="button" className={s.word} data-slot={si} aria-pressed={on} onClick={() => toggle(slot, w)}>
                  {on && <Check size={16} aria-hidden />} {w}
                </button>
              );
            })}
          </div>
        </fieldset>
      ))}

      <div className={s.footer}>
        <p className={s.preview} aria-live="polite">
          {pretty || <span className={s.muted}>{t('builder.empty')}</span>}
        </p>
        <Button data-size="lg" disabled={!pretty} onClick={() => onUse(pretty)}>
          {t('builder.use')}
        </Button>
      </div>
    </Dialog>
  );
}
