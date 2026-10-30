'use client';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Pagination, Spinner, Tabs, TabsList, TabsTab, ToggleGroup, ToggleGroupItem, usePagination } from '@digdir/designsystemet-react';
import { Heart, ThumbsUp, Palette } from 'lucide-react';
import { useApp, useT } from '@/store/app';
import { ApiError, fetchWall, voteOnWall } from '@/lib/api';
import type { GalleryItem, GalleryKind, GalleryPage, GallerySort, VoteType } from '@/lib/gallery/types';
import { createFromWall } from '@/features/library/actions';
import type { DictKey } from '@/lib/i18n/dict';
import s from './WallView.module.css';

export function WallView() {
  const t = useT();
  const [kind, setKind] = useState<GalleryKind>('artwork');
  const [sort, setSort] = useState<GallerySort>('popular');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<GalleryPage | null>(null);
  const [error, setError] = useState<DictKey | null>(null);

  const load = useCallback(async () => {
    setData(null);
    setError(null);
    try {
      setData(await fetchWall(kind, sort, page));
    } catch (e) {
      setError(e instanceof ApiError ? e.key : 'error.general');
    }
  }, [kind, sort, page]);

  useEffect(() => {
    load();
  }, [load]);

  const { pages, prevButtonProps, nextButtonProps } = usePagination({
    currentPage: page,
    totalPages: data?.totalPages ?? 1,
    onChange: (_e, p) => {
      setPage(p);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    showPages: 5,
  });

  const vote = async (item: GalleryItem, type: VoteType) => {
    if (!data) return;
    const mine = data.myVotes[item.id];
    const next = mine === type ? null : type;
    // Optimistisk oppdatering
    setData((d) => {
      if (!d) return d;
      const items = d.items.map((i) => {
        if (i.id !== item.id) return i;
        const n = { ...i };
        if (mine === 'heart') n.hearts--;
        if (mine === 'like') n.likes--;
        if (next === 'heart') n.hearts++;
        if (next === 'like') n.likes++;
        return n;
      });
      const myVotes = { ...d.myVotes };
      if (next) myVotes[item.id] = next;
      else delete myVotes[item.id];
      return { ...d, items, myVotes };
    });
    try {
      await voteOnWall(item.id, next);
    } catch {
      load();
    }
  };

  const colourIt = async (item: GalleryItem) => {
    const url = item.kind === 'template' ? item.url : item.templateUrl;
    const templateId = item.kind === 'template' ? item.id : item.templateId;
    if (!url || !templateId) return;
    voteOnWall(templateId, 'use').catch(() => undefined);
    await createFromWall(url, item.prompt, templateId);
  };

  return (
    <main className={s.main}>
      <h1 className={s.title}>{t('wall.title')}</h1>

      <div className={s.filters}>
        <Tabs value={kind} onChange={(v) => { setKind(v as GalleryKind); setPage(1); }}>
          <TabsList>
            <TabsTab value="artwork">{t('wall.artworks')}</TabsTab>
            <TabsTab value="template">{t('wall.templates')}</TabsTab>
          </TabsList>
        </Tabs>
        <ToggleGroup aria-label="Sortering" value={sort} onChange={(v) => { setSort(v as GallerySort); setPage(1); }} data-size="sm">
          <ToggleGroupItem value="popular">{t('wall.popular')}</ToggleGroupItem>
          <ToggleGroupItem value="newest">{t('wall.newest')}</ToggleGroupItem>
        </ToggleGroup>
      </div>

      {error && <Alert data-color="warning">{t(error)}</Alert>}
      {!data && !error && (
        <div className={s.center}>
          <Spinner aria-label="…" data-size="lg" />
        </div>
      )}
      {data && !data.enabled && <Alert data-color="info">{t('wall.disabled')}</Alert>}
      {data?.enabled && data.items.length === 0 && <p className={s.empty}>{t('wall.empty')}</p>}

      <ul className={s.wall}>
        {data?.items.map((item, i) => (
          <li key={item.id} className={s.frame} data-tilt={i % 4}>
            <div className={s.pic}>
              <img src={item.url} alt={item.prompt} loading="lazy" decoding="async" />
            </div>
            <div className={s.label}>
              <p className={s.prompt}>{item.prompt}</p>
              <p className={s.by}>
                {t('wall.by')} {item.author}
              </p>
              <div className={s.row}>
                <button className={s.vote} aria-pressed={data.myVotes[item.id] === 'heart'} onClick={() => vote(item, 'heart')} aria-label={`Hjerte, ${item.hearts}`}>
                  <Heart size={20} aria-hidden /> {item.hearts}
                </button>
                <button className={s.vote} aria-pressed={data.myVotes[item.id] === 'like'} onClick={() => vote(item, 'like')} aria-label={`Tommel opp, ${item.likes}`}>
                  <ThumbsUp size={20} aria-hidden /> {item.likes}
                </button>
                {(item.kind === 'template' || item.templateUrl) && (
                  <Button variant="secondary" data-size="sm" className={s.use} onClick={() => colourIt(item)}>
                    <Palette aria-hidden /> {item.kind === 'template' ? t('wall.use') : t('wall.use_template')}
                  </Button>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>

      {data && data.totalPages > 1 && (
        <Pagination aria-label="Sider" className={s.pagination}>
          <ul>
            <li>
              <Button variant="tertiary" {...prevButtonProps}>
                ‹
              </Button>
            </li>
            {pages.map(({ page: p, itemKey, buttonProps }) => (
              <li key={itemKey}>
                {typeof p === 'number' && (
                  <Button variant="tertiary" {...(buttonProps ?? {})}>
                    {p}
                  </Button>
                )}
              </li>
            ))}
            <li>
              <Button variant="tertiary" {...nextButtonProps}>
                ›
              </Button>
            </li>
          </ul>
        </Pagination>
      )}
    </main>
  );
}
