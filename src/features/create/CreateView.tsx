'use client';
import { useMemo, useRef, useState } from 'react';
import { Alert, Button, ToggleGroup, ToggleGroupItem } from '@digdir/designsystemet-react';
import { Dices, LayoutPanelTop, RefreshCw, Upload, Wand2, RectangleHorizontal, RectangleVertical, Square } from 'lucide-react';
import { useApp, useT } from '@/store/app';
import { IDEAS } from '@/lib/i18n/ideas';
import { MAX_PROMPT_LENGTH } from '@/lib/safety';
import { photoToLineArt } from '@/lib/image-utils';
import { createFromPrompt, createFromUpload } from '@/features/library/actions';
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
  const fileRef = useRef<HTMLInputElement>(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const ideas = useMemo(() => pick(IDEAS[app.lang], 5), [app.lang, seed]);

  const submit = (text = prompt) => {
    if (text.trim().length >= 2) createFromPrompt(text);
  };

  return (
    <main className={s.main}>
      <h1 className={s.title}>{t('create.title')}</h1>

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
          <ToggleGroup
            aria-label={t('create.format')}
            value={app.orientation}
            onChange={(v) => app.set({ orientation: v as Orientation })}
            data-size="md"
          >
            <ToggleGroupItem value="portrait">
              <RectangleVertical aria-hidden /> {t('create.portrait')}
            </ToggleGroupItem>
            <ToggleGroupItem value="landscape">
              <RectangleHorizontal aria-hidden /> {t('create.landscape')}
            </ToggleGroupItem>
            <ToggleGroupItem value="square">
              <Square aria-hidden /> {t('create.square')}
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        <div className={s.option}>
          <h2 className={s.h3}>{t('create.difficulty')}</h2>
          <ToggleGroup
            aria-label={t('create.difficulty')}
            value={app.difficulty}
            onChange={(v) => app.set({ difficulty: v as Difficulty })}
            data-size="md"
          >
            <ToggleGroupItem value="easy">{t('create.easy')}</ToggleGroupItem>
            <ToggleGroupItem value="medium">{t('create.medium')}</ToggleGroupItem>
            <ToggleGroupItem value="detailed">{t('create.detailed')}</ToggleGroupItem>
          </ToggleGroup>
        </div>

        <div className={s.option}>
          <h2 className={s.h3}>{t('create.style')}</h2>
          <ToggleGroup aria-label={t('create.style')} value={app.style} onChange={(v) => app.set({ style: v as ArtStyle })} data-size="md">
            {(['cartoon', 'storybook', 'kawaii', 'mandala'] as const).map((st) => (
              <ToggleGroupItem key={st} value={st}>
                {t(`style.${st}`)}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      </section>

      <section className={s.upload}>
        <div>
          <h2 className={s.h3}>{t('create.upload')}</h2>
          <p className={s.muted}>{t('create.upload.hint')}</p>
        </div>
        <Button variant="secondary" data-size="md" onClick={() => fileRef.current?.click()}>
          <Upload aria-hidden /> {t('create.upload')}
        </Button>
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
      </section>

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
