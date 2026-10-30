'use client';
import { useEffect, useState } from 'react';
import { Alert, Button, Dialog, Heading, Paragraph, Textfield } from '@digdir/designsystemet-react';
import { Palette, Tablet, Projector, Printer, Wand2, Sparkles } from 'lucide-react';
import { useApp, useT } from '@/store/app';
import { usePicture } from '@/features/library/usePicture';
import { editPicture } from '@/features/library/actions';
import { printImage } from '@/lib/print';
import s from './PreviewView.module.css';

export function PreviewView({ id }: { id: string }) {
  const t = useT();
  const go = useApp((st) => st.go);
  const error = useApp((st) => st.error);
  const { pic, url } = usePicture(id);
  const [editOpen, setEditOpen] = useState(false);
  const [instruction, setInstruction] = useState('');

  useEffect(() => {
    if (pic === null) go({ name: 'home' });
  }, [pic, go]);
  if (pic === null) return null;

  const actions = [
    { key: 'color', icon: Palette, title: t('preview.color.draw'), desc: t('preview.color.desc'), tint: 'pink', onClick: () => go({ name: 'color', id }) },
    { key: 'light', icon: Tablet, title: t('preview.lighttable'), desc: t('preview.lighttable.desc'), tint: 'sky', onClick: () => go({ name: 'lighttable', id }) },
    { key: 'proj', icon: Projector, title: t('preview.projector'), desc: t('preview.projector.desc'), tint: 'violet', onClick: () => go({ name: 'projector', id }) },
    { key: 'print', icon: Printer, title: t('preview.print'), desc: t('preview.print.desc'), tint: 'sun', onClick: () => url && printImage(url) },
  ];

  return (
    <main className={s.main}>
      <div className={s.paper}>
        {url ? <img src={url} alt={pic?.prompt ?? ''} className={s.img} /> : <div className={s.placeholder} />}
      </div>

      <div className={s.side}>
        <h1 className={s.prompt}>{pic?.prompt}</h1>
        {error && (
          <Alert data-color="warning" role="alert">
            {t(error)}
          </Alert>
        )}
        <h2 className={s.q}>{t('preview.question')}</h2>
        <div className={s.grid}>
          {actions.map((a) => (
            <button key={a.key} className={s.chip} data-tint={a.tint} onClick={a.onClick}>
              <a.icon size={40} strokeWidth={2.2} aria-hidden />
              <span className={s.chipTitle}>{a.title}</span>
              <span className={s.chipDesc}>{a.desc}</span>
            </button>
          ))}
        </div>
        <div className={s.secondary}>
          <Button variant="secondary" data-size="md" onClick={() => setEditOpen(true)}>
            <Wand2 aria-hidden /> {t('preview.edit')}
          </Button>
          <Button variant="tertiary" data-size="md" onClick={() => go({ name: 'home' })}>
            <Sparkles aria-hidden /> {t('preview.new')}
          </Button>
        </div>
      </div>

      <Dialog open={editOpen} onClose={() => setEditOpen(false)} modal closedby="any" closeButton={t('common.close')}>
        <form
          className={s.editForm}
          onSubmit={(e) => {
            e.preventDefault();
            if (instruction.trim().length < 2) return;
            setEditOpen(false);
            editPicture(id, instruction);
            setInstruction('');
          }}
        >
          <Heading level={2} data-size="sm">
            {t('edit.title')}
          </Heading>
          <Paragraph>{t('edit.description')}</Paragraph>
          <Textfield
            label={t('edit.title')}
            placeholder={t('edit.placeholder')}
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            maxLength={200}
            autoFocus
          />
          <div className={s.dialogActions}>
            <Button type="button" variant="tertiary" onClick={() => setEditOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={instruction.trim().length < 2}>
              <Wand2 aria-hidden /> {t('edit.go')}
            </Button>
          </div>
        </form>
      </Dialog>
    </main>
  );
}
