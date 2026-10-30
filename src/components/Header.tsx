'use client';
import { Button } from '@digdir/designsystemet-react';
import { Music, Music2, Sparkles, Images, Frame } from 'lucide-react';
import { useApp, useT } from '@/store/app';
import { Logo } from './Logo';
import s from './Header.module.css';

export function Header() {
  const t = useT();
  const view = useApp((st) => st.view);
  const go = useApp((st) => st.go);
  const lang = useApp((st) => st.lang);
  const music = useApp((st) => st.music);
  const set = useApp((st) => st.set);

  const tabs = [
    { id: 'home', label: t('nav.create'), icon: Sparkles, color: 'pink' },
    { id: 'library', label: t('nav.library'), icon: Images, color: 'mint' },
    { id: 'wall', label: t('nav.wall'), icon: Frame, color: 'sky' },
  ] as const;

  const active = view.name === 'generating' || view.name === 'preview' ? 'home' : view.name;

  return (
    <header className={s.header}>
      <button className={s.brand} onClick={() => go({ name: 'home' })} aria-label={t('nav.home')}>
        <Logo tagline={t('app.tagline')} />
      </button>

      <nav className={s.nav} aria-label="Hovedmeny">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={s.tab}
            data-color={tab.color}
            aria-current={active === tab.id ? 'page' : undefined}
            onClick={() => go({ name: tab.id })}
          >
            <tab.icon aria-hidden size={22} />
            <span>{tab.label}</span>
          </button>
        ))}
      </nav>

      <div className={s.tools}>
        <Button
          variant="tertiary"
          icon
          data-size="md"
          aria-pressed={music}
          aria-label={music ? t('settings.music.off') : t('settings.music.on')}
          onClick={() => set({ music: !music })}
        >
          {music ? <Music2 className={s.bounce} /> : <Music />}
        </Button>
        <Button
          variant="secondary"
          data-size="md"
          aria-label={t('settings.language')}
          onClick={() => set({ lang: lang === 'no' ? 'en' : 'no' })}
          lang={lang === 'no' ? 'en' : 'no'}
        >
          {lang === 'no' ? 'English' : 'Norsk'}
        </Button>
      </div>
      <div className={`ll-crayon-bar ${s.bar}`} aria-hidden />
    </header>
  );
}
