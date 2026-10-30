'use client';
import { useState } from 'react';
import { Alert, Button, Dialog, Heading, Paragraph, Textfield } from '@digdir/designsystemet-react';
import { Download, Frame } from 'lucide-react';
import { useApp, useT } from '@/store/app';
import { ApiError, shareToWall } from '@/lib/api';
import { fitCanvas, loadImage } from '@/lib/image-utils';
import { updatePicture, type Picture } from '@/features/library/db';
import type { DictKey } from '@/lib/i18n/dict';
import type { ColoringEngine } from './engine/engine';
import s from './SaveDialog.module.css';

interface Props {
  open: boolean;
  onClose: () => void;
  engine: React.RefObject<ColoringEngine | null>;
  picture: React.RefObject<Picture | null>;
  onDownload: () => void;
}

export function SaveDialog({ open, onClose, engine, picture, onDownload }: Props) {
  const t = useT();
  const nickname = useApp((st) => st.nickname);
  const set = useApp((st) => st.set);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; key: DictKey } | null>(null);

  const share = async () => {
    const e = engine.current;
    const pic = picture.current;
    if (!e || !pic) return;
    setBusy(true);
    setMsg(null);
    try {
      // 1) Sørg for at malen (strektegningen) finnes på veggen, så andre kan fargelegge den
      let templateId = pic.wallTemplateId;
      if (!templateId) {
        const lineImg = await loadImage(pic.lineArt);
        const tpl = await shareToWall({
          image: fitCanvas(lineImg, 1600).toDataURL('image/png'),
          prompt: pic.prompt,
          author: nickname,
          kind: 'template',
        });
        templateId = tpl.item.id;
        await updatePicture(pic.id, { wallTemplateId: templateId });
        pic.wallTemplateId = templateId;
      }
      // 2) Selve kunstverket (WebP holder størrelsen nede)
      const art = await shareToWall({
        image: e.composite(1600).toDataURL('image/webp', 0.88),
        prompt: pic.prompt,
        author: nickname,
        kind: 'artwork',
        templateId,
      });
      setMsg({ kind: 'ok', key: art.item.status === 'approved' ? 'save.shared.live' : 'save.shared' });
    } catch (err) {
      setMsg({ kind: 'err', key: err instanceof ApiError ? err.key : 'error.general' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} modal closedby="any" closeButton={t('common.close')} className={s.dialog}>
      <Heading level={2} data-size="md" className={s.h}>
        {t('save.title')}
      </Heading>

      <div className={s.options}>
        <section className={s.card}>
          <Download aria-hidden size={32} />
          <Button data-size="lg" variant="secondary" onClick={onDownload}>
            {t('save.download')}
          </Button>
        </section>

        <section className={s.card}>
          <Frame aria-hidden size={32} />
          <Textfield
            label={t('save.nickname')}
            placeholder={t('save.nickname.placeholder')}
            value={nickname}
            maxLength={20}
            onChange={(ev) => set({ nickname: ev.target.value })}
            autoComplete="off"
          />
          <Paragraph data-size="sm" className={s.info}>
            {t('save.share.info')}
          </Paragraph>
          <Button data-size="lg" onClick={share} loading={busy} disabled={busy}>
            {t('save.share')}
          </Button>
        </section>
      </div>

      {msg && (
        <Alert data-color={msg.kind === 'ok' ? 'success' : 'warning'} className={s.alert}>
          {t(msg.key)}
        </Alert>
      )}
    </Dialog>
  );
}
