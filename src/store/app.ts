'use client';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { dictionaries, type DictKey, type Lang } from '@/lib/i18n/dict';
import type { ArtStyle, Difficulty, Orientation } from '@/lib/ai/prompts';

export type View =
  | { name: 'home' }
  | { name: 'library' }
  | { name: 'wall' }
  | { name: 'generating' }
  | { name: 'preview'; id: string }
  | { name: 'color'; id: string }
  | { name: 'lighttable'; id: string }
  | { name: 'projector'; id: string };

interface Settings {
  lang: Lang;
  music: boolean;
  orientation: Orientation;
  difficulty: Difficulty;
  style: ArtStyle;
  penOnly: boolean;
  nickname: string;
  customColors: string[];
}

interface AppState extends Settings {
  view: View;
  error: DictKey | null;
  go: (v: View) => void;
  setError: (e: DictKey | null) => void;
  set: (s: Partial<Settings>) => void;
  addCustomColor: (c: string) => void;
}

export const useApp = create<AppState>()(
  persist(
    (set) => ({
      lang: 'no',
      music: false,
      orientation: 'portrait',
      difficulty: 'medium',
      style: 'cartoon',
      penOnly: false,
      nickname: '',
      customColors: [],
      view: { name: 'home' },
      error: null,
      go: (view) => {
        set({ view, error: null });
        if (typeof window !== 'undefined') {
          // «generating» er en midlertidig skjerm og skal ikke kunne navigeres tilbake til
          if (view.name !== 'generating') {
            const url = viewToUrl(view);
            if (url !== window.location.pathname + window.location.search) window.history.pushState(window.history.state, '', url);
          }
          window.scrollTo({ top: 0 });
        }
      },
      setError: (error) => set({ error }),
      set: (s) => set(s),
      addCustomColor: (c) =>
        set((st) => ({ customColors: [c, ...st.customColors.filter((x) => x !== c)].slice(0, 12) })),
    }),
    {
      name: 'lealand-settings-v2',
      partialize: ({ view: _v, error: _e, go: _g, setError: _s, set: _set, addCustomColor: _a, ...settings }) => settings,
    },
  ),
);

/** Visningen speiles i URL-en (?v=color&id=…): tilbake-knapp, oppdatering og lenker virker. */
export function viewToUrl(v: View): string {
  if (v.name === 'home' || v.name === 'generating') return '/';
  if ('id' in v) return `/?v=${v.name}&id=${encodeURIComponent(v.id)}`;
  return `/?v=${v.name}`;
}

export function urlToView(search: string): View {
  const q = new URLSearchParams(search);
  const v = q.get('v');
  const id = q.get('id') ?? '';
  if (v === 'library' || v === 'wall') return { name: v };
  if ((v === 'preview' || v === 'color' || v === 'lighttable' || v === 'projector') && /^[a-z0-9]{6,32}$/.test(id)) return { name: v, id };
  return { name: 'home' };
}

/** Oversettelse. `t('loading.tips', true)` gir listen splittet på «|». */
export function useT() {
  const lang = useApp((s) => s.lang);
  const d = dictionaries[lang];
  return (key: DictKey) => d[key];
}

export function getDeviceId(): string {
  try {
    let id = localStorage.getItem('lealand-device');
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem('lealand-device', id);
    }
    return id;
  } catch {
    return 'anon';
  }
}
