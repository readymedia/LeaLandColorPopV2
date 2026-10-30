'use client';
import { useEffect, useState } from 'react';
import { urlToView, useApp } from '@/store/app';
import { requestPersistence } from '@/features/library/db';
import { Header } from './Header';
import { CreateView } from '@/features/create/CreateView';
import { GeneratingView } from '@/features/create/GeneratingView';
import { PreviewView } from '@/features/create/PreviewView';
import { LibraryView } from '@/features/library/LibraryView';
import { WallView } from '@/features/gallery/WallView';
import { ColoringView } from '@/features/coloring/ColoringView';
import { LightTableView } from '@/features/trace/LightTableView';
import { ProjectorView } from '@/features/trace/ProjectorView';
import { MusicPlayer } from './MusicPlayer';

export function App() {
  const view = useApp((s) => s.view);
  const lang = useApp((s) => s.lang);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Innstillinger lagres i localStorage → vent til de er lest inn før vi tegner (unngår hydreringsavvik)
    const done = () => setReady(true);
    if (useApp.persist.hasHydrated()) done();
    const unsub = useApp.persist.onFinishHydration(done);
    requestPersistence();
    useApp.setState({ view: urlToView(window.location.search) });
    const onPop = () => useApp.setState({ view: urlToView(window.location.search), error: null });
    window.addEventListener('popstate', onPop);
    return () => {
      unsub();
      window.removeEventListener('popstate', onPop);
    };
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang === 'no' ? 'no' : 'en';
  }, [lang]);

  if (!ready) return null;

  const fullscreen = view.name === 'color' || view.name === 'lighttable' || view.name === 'projector';

  return (
    <>
      <MusicPlayer />
      {!fullscreen && <Header />}
      {view.name === 'home' && <CreateView />}
      {view.name === 'generating' && <GeneratingView />}
      {view.name === 'preview' && <PreviewView id={view.id} />}
      {view.name === 'library' && <LibraryView />}
      {view.name === 'wall' && <WallView />}
      {view.name === 'color' && <ColoringView id={view.id} />}
      {view.name === 'lighttable' && <LightTableView id={view.id} />}
      {view.name === 'projector' && <ProjectorView id={view.id} />}
    </>
  );
}
