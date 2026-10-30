'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, Switch } from '@digdir/designsystemet-react';
import { ArrowLeft, Lock, LockOpen, ZoomIn, ZoomOut, RotateCw, FlipHorizontal2, Maximize, Grid3x3, MonitorUp, Crop } from 'lucide-react';
import { useT } from '@/store/app';
import { usePicture } from '@/features/library/usePicture';
import { blobToDataUrl } from '@/lib/image-utils';
import { TraceImage, DEFAULT_TRACE, type TraceState } from './TraceImage';
import { defaultCorners, type Corners } from './keystone';
import { openProjectorWindow, type ProjectorLink } from './projector-link';
import s from './TraceScreen.module.css';

type Variant = 'lighttable' | 'projector';

function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    const req = () =>
      navigator.wakeLock
        .request('screen')
        .then((l) => (lock = l))
        .catch(() => undefined);
    req();
    const onVis = () => document.visibilityState === 'visible' && req();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      lock?.release().catch(() => undefined);
    };
  }, [active]);
}

export function TraceScreen({ id, variant }: { id: string; variant: Variant }) {
  const t = useT();
  const { pic, url } = usePicture(id);
  const rootRef = useRef<HTMLDivElement>(null);
  const [frame, setFrame] = useState({ w: 0, h: 0 });
  const [state, setState] = useState<TraceState>({ ...DEFAULT_TRACE, scale: variant === 'projector' ? 0.9 : 1 });
  const [locked, setLocked] = useState(false);
  const [keystoneEdit, setKeystoneEdit] = useState(false);
  const [unlockProgress, setUnlockProgress] = useState(0);
  const linkRef = useRef<ProjectorLink | null>(null);
  const latest = useRef({ state, frame });
  latest.current = { state, frame };

  useWakeLock(true);

  // Rammen fyller hele skjermen
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setFrame({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Lagre justeringer per bilde og modus (nyttig når projektoren står på samme sted neste gang)
  const storageKey = `lealand-trace-${variant}`;
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) setState((st) => ({ ...st, ...JSON.parse(saved), x: 0, y: 0 }));
    } catch {
      /* ignorer */
    }
  }, [storageKey]);
  useEffect(() => {
    try {
      const { corners, thicken, invert, grid, scale } = state;
      localStorage.setItem(storageKey, JSON.stringify({ corners, thicken, invert, grid, scale }));
    } catch {
      /* ignorer */
    }
  }, [state, storageKey]);

  // Synk til egen projektorskjerm
  useEffect(() => {
    linkRef.current?.send({ state, frame });
  }, [state, frame]);
  useEffect(() => () => linkRef.current?.close(), []);

  const update = (patch: Partial<TraceState>) => setState((st) => ({ ...st, ...patch }));
  const zoom = (f: number) => setState((st) => ({ ...st, scale: Math.max(0.2, Math.min(6, st.scale * f)) }));

  // Dra/knip for å flytte og skalere (når ulåst)
  const pts = useRef(new Map<number, { x: number; y: number }>());
  const last = useRef<{ mid: { x: number; y: number }; dist: number } | null>(null);
  const measure = () => {
    const v = [...pts.current.values()];
    if (v.length === 1) return { mid: v[0], dist: 0 };
    return { mid: { x: (v[0].x + v[1].x) / 2, y: (v[0].y + v[1].y) / 2 }, dist: Math.hypot(v[0].x - v[1].x, v[0].y - v[1].y) };
  };
  const onDown = (e: React.PointerEvent) => {
    if (locked || keystoneEdit) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    last.current = measure();
  };
  const onMove = (e: React.PointerEvent) => {
    if (!pts.current.has(e.pointerId) || !last.current) return;
    pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const m = measure();
    const prev = last.current;
    setState((st) => ({
      ...st,
      x: st.x + (m.mid.x - prev.mid.x),
      y: st.y + (m.mid.y - prev.mid.y),
      scale: prev.dist > 0 && m.dist > 0 ? Math.max(0.2, Math.min(6, st.scale * (m.dist / prev.dist))) : st.scale,
    }));
    last.current = m;
  };
  const onUp = (e: React.PointerEvent) => {
    pts.current.delete(e.pointerId);
    last.current = pts.current.size ? measure() : null;
  };

  // Lås opp krever langt trykk (hånden som hviler på arket skal ikke låse opp ved et uhell)
  const holdTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const startHold = () => {
    const t0 = Date.now();
    holdTimer.current = setInterval(() => {
      const p = Math.min(1, (Date.now() - t0) / 1200);
      setUnlockProgress(p);
      if (p >= 1) {
        stopHold();
        setLocked(false);
      }
    }, 30);
  };
  const stopHold = () => {
    if (holdTimer.current) clearInterval(holdTimer.current);
    holdTimer.current = null;
    setUnlockProgress(0);
  };

  const fullscreen = useCallback(() => {
    const el = document.documentElement;
    if (document.fullscreenElement) document.exitFullscreen().catch(() => undefined);
    else el.requestFullscreen?.().catch(() => undefined);
  }, []);

  const openSecond = async () => {
    if (!pic) return;
    const image = await blobToDataUrl(pic.lineArt);
    linkRef.current?.close();
    linkRef.current = openProjectorWindow(image, () => latest.current);
  };

  // Keystone-hjørner
  const corners: Corners = state.corners ?? defaultCorners(frame.w, frame.h);
  const dragCorner = (i: number) => (e: React.PointerEvent) => {
    e.stopPropagation();
    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);
    // Dra relativt (håndtaket kan vises litt innenfor kanten, men hjørnet følger fingeren)
    const start = { x: e.clientX, y: e.clientY };
    const startCorners = [...corners] as Corners;
    const move = (ev: PointerEvent) => {
      const next = [...startCorners] as Corners;
      next[i] = { x: startCorners[i].x + ev.clientX - start.x, y: startCorners[i].y + ev.clientY - start.y };
      update({ corners: next });
    };
    const up = () => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  };
  const handlePos = (c: { x: number; y: number }) => ({
    left: Math.max(30, Math.min(frame.w - 30, c.x)),
    top: Math.max(30, Math.min(frame.h - 30, c.y)),
  });

  const dark = variant === 'projector';

  return (
    <div className={s.root} data-variant={variant} data-locked={locked}>
      <div ref={rootRef} className={s.stage} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
        {url && frame.w > 0 && <TraceImage src={url} state={state} frame={frame} />}
        {keystoneEdit &&
          corners.map((c, i) => (
            <button
              key={i}
              className={s.corner}
              style={handlePos(c)}
              aria-label={`Hjørne ${i + 1}`}
              onPointerDown={dragCorner(i)}
            />
          ))}
      </div>

      {!locked ? (
        <div className={s.controls} data-dark={dark} onPointerDown={(e) => e.stopPropagation()}>
          <div className={s.row}>
            <Button variant="secondary" data-size="md" onClick={() => window.history.back()}>
              <ArrowLeft aria-hidden /> {t('nav.back')}
            </Button>
            <p className={s.hint}>{keystoneEdit ? t('trace.keystone.desc') : t('trace.place_paper')}</p>
            <Button data-size="lg" data-color="success" onClick={() => { setKeystoneEdit(false); setLocked(true); }}>
              <Lock aria-hidden /> {t('trace.lock')}
            </Button>
          </div>
          <div className={s.row}>
            <Button variant="secondary" icon data-size="md" aria-label={t('trace.smaller')} onClick={() => zoom(0.9)}>
              <ZoomOut />
            </Button>
            <Button variant="secondary" icon data-size="md" aria-label={t('trace.bigger')} onClick={() => zoom(1.1)}>
              <ZoomIn />
            </Button>
            <Button variant="secondary" icon data-size="md" aria-label={t('trace.rotate')} onClick={() => update({ rotation: (state.rotation + 90) % 360 })}>
              <RotateCw />
            </Button>
            <Button variant="secondary" icon data-size="md" aria-label={t('trace.mirror')} aria-pressed={state.mirror} onClick={() => update({ mirror: !state.mirror })}>
              <FlipHorizontal2 />
            </Button>
            <Button variant="secondary" icon data-size="md" aria-label={t('trace.grid')} aria-pressed={state.grid} onClick={() => update({ grid: !state.grid })}>
              <Grid3x3 />
            </Button>
            <label className={s.slider}>
              <span>{t('trace.lines')}</span>
              <input type="range" min={0} max={3} step={1} value={state.thicken} onChange={(e) => update({ thicken: Number(e.target.value) })} />
            </label>
            <Switch label={t('trace.invert')} checked={state.invert} onChange={(e) => update({ invert: e.target.checked })} data-size="sm" />
            <Button variant="tertiary" icon data-size="md" aria-label={t('trace.fullscreen')} onClick={fullscreen}>
              <Maximize />
            </Button>
          </div>
          {variant === 'projector' && (
            <div className={s.row}>
              <Button variant={keystoneEdit ? 'primary' : 'secondary'} data-size="md" aria-pressed={keystoneEdit} onClick={() => setKeystoneEdit(!keystoneEdit)}>
                <Crop aria-hidden /> {t('trace.keystone')}
              </Button>
              {state.corners && (
                <Button variant="tertiary" data-size="md" onClick={() => update({ corners: null })}>
                  {t('trace.keystone.reset')}
                </Button>
              )}
              <Button variant="secondary" data-size="md" onClick={openSecond} title={t('trace.second_screen.desc')}>
                <MonitorUp aria-hidden /> {t('trace.second_screen')}
              </Button>
            </div>
          )}
        </div>
      ) : (
        <button
          className={s.unlock}
          data-dark={dark}
          onPointerDown={(e) => {
            e.stopPropagation();
            startHold();
          }}
          onPointerUp={stopHold}
          onPointerLeave={stopHold}
          onPointerCancel={stopHold}
          onKeyDown={(e) => e.key === 'Enter' && setLocked(false)}
          aria-label={t('trace.unlock')}
          style={{ ['--p' as string]: unlockProgress }}
        >
          <LockOpen aria-hidden size={22} />
          <span>{t('trace.unlock')}</span>
        </button>
      )}
    </div>
  );
}
