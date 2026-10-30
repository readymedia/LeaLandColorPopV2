'use client';
import { useMemo, useState } from 'react';
import { Button, Dialog, Heading, Paragraph } from '@digdir/designsystemet-react';
import { Check, Minus, Plus, RotateCcw } from 'lucide-react';
import { useApp, useT } from '@/store/app';
import type { DictKey } from '@/lib/i18n/dict';
import { mixPaints, nameColour, type Paint } from './ryb';
import s from './MixerDialog.module.css';

const TUBES: { key: keyof Paint; label: DictKey; color: string }[] = [
  { key: 'red', label: 'mixer.red', color: '#E53935' },
  { key: 'yellow', label: 'mixer.yellow', color: '#FFD600' },
  { key: 'blue', label: 'mixer.blue', color: '#1E5BB8' },
  { key: 'white', label: 'mixer.white', color: '#FFFFFF' },
  { key: 'black', label: 'mixer.black', color: '#212121' },
];

const EMPTY: Paint = { red: 0, yellow: 0, blue: 0, white: 0, black: 0 };

/** Fargelaben: barnet heller «dråper» i en gryte og ser fargen endre seg som ekte maling. */
export function MixerDialog({ open, onClose, onUse }: { open: boolean; onClose: () => void; onUse: (hex: string) => void }) {
  const t = useT();
  const lang = useApp((st) => st.lang);
  const [paint, setPaint] = useState<Paint>(EMPTY);
  const hex = useMemo(() => mixPaints(paint), [paint]);
  const total = Object.values(paint).reduce((a, b) => a + b, 0);

  const change = (k: keyof Paint, d: number) => setPaint((p) => ({ ...p, [k]: Math.max(0, Math.min(10, p[k] + d)) }));

  return (
    <Dialog open={open} onClose={onClose} modal closedby="any" closeButton={t('common.close')} className={s.dialog}>
      <Heading level={2} data-size="md" className={s.h}>
        {t('mixer.title')}
      </Heading>
      <Paragraph>{t('mixer.description')}</Paragraph>

      <div className={s.layout}>
        <div className={s.potWrap}>
          <div className={s.pot} style={{ background: hex }} aria-hidden>
            <span className={s.shine} />
          </div>
          <p className={s.result} aria-live="polite">
            {total > 0 ? (
              <>
                {t('mixer.discovered')} <strong>{nameColour(hex, lang)}</strong>!
              </>
            ) : (
              ' '
            )}
          </p>
        </div>

        <ul className={s.tubes}>
          {TUBES.map((tube) => (
            <li key={tube.key} className={s.tube}>
              <span className={s.blob} style={{ background: tube.color }} aria-hidden />
              <span className={s.tubeLabel}>{t(tube.label)}</span>
              <span className={s.drops} aria-label={`${paint[tube.key]}`}>
                {Array.from({ length: 10 }, (_, i) => (
                  <span key={i} className={s.drop} data-on={i < paint[tube.key]} style={{ background: i < paint[tube.key] ? tube.color : undefined }} />
                ))}
              </span>
              <Button variant="secondary" icon data-size="sm" aria-label={`− ${t(tube.label)}`} onClick={() => change(tube.key, -1)} disabled={!paint[tube.key]}>
                <Minus />
              </Button>
              <Button variant="primary" icon data-size="sm" aria-label={`+ ${t(tube.label)}`} onClick={() => change(tube.key, 1)} disabled={paint[tube.key] >= 10}>
                <Plus />
              </Button>
            </li>
          ))}
        </ul>
      </div>

      <div className={s.actions}>
        <Button variant="tertiary" onClick={() => setPaint(EMPTY)}>
          <RotateCcw aria-hidden /> {t('mixer.reset')}
        </Button>
        <Button data-size="lg" disabled={total === 0} onClick={() => onUse(hex)}>
          <Check aria-hidden /> {t('mixer.use')}
        </Button>
      </div>
    </Dialog>
  );
}
