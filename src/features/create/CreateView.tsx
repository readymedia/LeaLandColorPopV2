'use client';
import { useMemo, useRef, useState } from 'react';
import { Alert, Button } from '@digdir/designsystemet-react';
import { ChoiceChips } from '@/components/ChoiceChips';
import { Dices, LayoutPanelTop, RefreshCw, Upload, Wand2, RectangleHorizontal, RectangleVertical, Square, PenLine, ImageUp } from 'lucide-react';
import { useApp, useT } from '@/store/app';
import { IDEAS } from '@/lib/i18n/ideas';
import { MAX_PROMPT_LENGTH } from '@/lib/safety';
import { photoToLineArt } from '@/lib/image-utils';
import { createBlank, createFromPrompt, createFromUpload } from '@/features/library/actions';
import type { ArtStyle, Difficulty, Orientation } from '@/lib/ai/prompts';
import { StoryBuilder } from './StoryBuilder';
import s from './CreateView.module.css';

function pick<T>(list: T[], n: number) {
  return [...list].sort(() => Math.random() - 0.5).slice(0, n);
}

export function CreateView() {
  const t = useT();
  const app = useApp();
  const [prompt, setPrompt] = useState('');
  const [seed, setSeed] = useState(0);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [mode, setMode] = useState<'magic' | 'draw' | 'upload'>('magic');
  const fileRef = useRef<HTMLInputElement>(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const ideas = useMemo(() => pick(IDEAS[app.lang], 5), [app.lang, seed]);

  const submit = (text = prompt) => {
    if (text.trim().length >= 2) createFromPrompt(text);
  };

  return (
    <main className={s.main}>
      <h1 className={s.title}>{t('entry.title')}</h1>

      <div className={s.entries} role="tablist" aria-label={t('entry.title')}>
        {(
          [
            { id: 'magic', icon: Wand2, title: t('entry.magic'), desc: t('entry.magic.desc'), tint: 'violet' },
            { id: 'draw', icon: PenLine, title: t('entry.draw'), desc: t('entry.draw.desc'), tint: 'pink' },
            { id: 'upload', icon: ImageUp, title: t('entry.upload'), desc: t('entry.upload.desc'), tint: 'mint' },
          ] as const
        ).map((en) => (
          <button key={en.id} role="tab" aria-selected={mode === en.id} className={s.entry} data-tint={en.tint} onClick={() => setMode(en.id)}>
            <en.icon size={34} strokeWidth={2.2} aria-hidden />
            <span className={s.entryTitle}>{en.title}</span>
            <span className={s.entryDesc}>{en.desc}</span>
          </button>
        ))}
      </div>

      {mode === 'draw' && (
        <section className={s.panel} aria-label={t('entry.draw')}>
          <h2 className={s.h3}>{t('draw.paper')}</h2>
          <ChoiceChips
            label={t('draw.paper')}
            value={app.orientation}
            onChange={(v) => app.set({ orientation: v })}
            options={[
              { value: 'portrait', label: t('create.portrait'), icon: <RectangleVertical aria-hidden /> },
              { value: 'landscape', label: t('create.landscape'), icon: <RectangleHorizontal aria-hidden /> },
              { value: 'square', label: t('create.square'), icon: <Square aria-hidden /> },
            ]}
          />
          <Button data-size="lg" className={s.go} onClick={() => createBlank(app.orientation, prompt.trim() || t('draw.default_title'))}>
            <PenLine aria-hidden /> {t('draw.start')}
          </Button>
        </section>
      )}

      {mode === 'upload' && (
        <section className={s.panel} aria-label={t('entry.upload')}>
          <p className={s.muted}>{t('create.upload.hint')}</p>
          <Button data-size="lg" className={s.go} onClick={() => fileRef.current?.click()}>
            <Upload aria-hidden /> {t('create.upload')}
          </Button>
        </section>
      )}

      {mode === 'magic' && (<>
      <form
        className={s.slate}
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <label htmlFor="prompt" className="ll-visually-hidden">
          {t('create.label')}
        </label>
        <textarea
          id="prompt"
          className={s.input}
          value={prompt}
          maxLength={MAX_PROMPT_LENGTH}
          rows={2}
          placeholder={t('create.placeholder')}
          onChange={(e) => {
            setPrompt(e.target.value);
            if (app.error) app.setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          enterKeyHint="go"
          autoComplete="off"
          spellCheck
        />
        <div className={s.slateActions}>
          <Button type="button" variant="tertiary" data-size="md" onClick={() => setPrompt(pick(IDEAS[app.lang], 1)[0])}>
            <Dices aria-hidden /> {t('create.random')}
          </Button>
          <Button type="button" variant="tertiary" data-size="md" onClick={() => setBuilderOpen(true)}>
            <LayoutPanelTop aria-hidden /> {t('create.builder')}
          </Button>
          <Button type="submit" data-size="lg" className={s.go} disabled={prompt.trim().length < 2}>
            <Wand2 aria-hidden /> {t('create.go')}
          </Button>
        </div>
      </form>

      {app.error && (
        <Alert data-color="warning" className={s.alert} role="alert">
          {t(app.error)}
        </Alert>
      )}

      <section className={s.ideas} aria-labelledby="ideas-h">
        <div className={s.ideasHead}>
          <h2 id="ideas-h" className={s.h2}>
            {t('create.ideas')}
          </h2>
          <Button variant="tertiary" data-size="sm" onClick={() => setSeed((x) => x + 1)}>
            <RefreshCw aria-hidden size={18} /> {t('create.more_ideas')}
          </Button>
        </div>
        <ul className={s.ideaList}>
          {ideas.map((idea, i) => (
            <li key={idea}>
              <button className={s.idea} data-tint={i % 5} onClick={() => setPrompt(idea)}>
                {idea}
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className={s.options} aria-label={t('create.format')}>
        <div className={s.option}>
          <h2 className={s.h3}>{t('create.format')}</h2>
          <ChoiceChips
            label={t('create.format')}
            value={app.orientation}
            onChange={(v) => app.set({ orientation: v })}
            options={[
              { value: 'portrait', label: t('create.portrait'), icon: <RectangleVertical aria-hidden /> },
              { value: 'landscape', label: t('create.landscape'), icon: <RectangleHorizontal aria-hidden /> },
              { value: 'square', label: t('create.square'), icon: <Square aria-hidden /> },
            ]}
          />
        </div>

        <div className={s.option}>
          <h2 className={s.h3}>{t('create.difficulty')}</h2>
          <ChoiceChips
            label={t('create.difficulty')}
            value={app.difficulty}
            onChange={(v) => app.set({ difficulty: v })}
            options={(['easy', 'medium', 'detailed'] as const).map((d) => ({ value: d, label: t(`create.${d}`) }))}
          />
        </div>

        <div className={s.option}>
          <h2 className={s.h3}>{t('create.style')}</h2>
          <ChoiceChips
            label={t('create.style')}
            value={app.style}
            onChange={(v) => app.set({ style: v })}
            options={(['cartoon', 'storybook', 'kawaii', 'mandala'] as const).map((st) => ({ value: st, label: t(`style.${st}`) }))}
          />
        </div>
      </section>

      </>)}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) createFromUpload(f, (b) => photoToLineArt(b)).catch(() => app.setError('error.general'));
          e.target.value = '';
        }}
      />

      <StoryBuilder
        open={builderOpen}
        onClose={() => setBuilderOpen(false)}
        onUse={(text) => {
          setPrompt(text);
          setBuilderOpen(false);
        }}
      />
    </main>
  );
}
