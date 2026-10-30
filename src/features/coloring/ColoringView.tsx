'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, Spinner, Tooltip } from '@digdir/designsystemet-react';
import { ArrowLeft, Undo2, Redo2, ZoomIn, ZoomOut, Maximize2, Download, Trash2, Hand, Printer, Share2, Check } from 'lucide-react';
import { useApp, useT } from '@/store/app';
import { getPicture, updatePicture, type Picture } from '@/features/library/db';
import { canvasToBlob, makeThumb } from '@/lib/image-utils';
import { printImage } from '@/lib/print';
import { ColoringEngine, type Pt } from './engine/engine';
import type { ToolState } from './engine/tools';
import { useViewport } from './useViewport';
import { ToolRail } from './ToolRail';
import { ColorPanel } from './ColorPanel';
import { SaveDialog } from './SaveDialog';
import s from './ColoringView.module.css';

export function ColoringView({ id }: { id: string }) {
  const t = useT();
  const go = useApp((st) => st.go);
  const penOnly = useApp((st) => st.penOnly);
  const vp = useViewport();
  const paintRef = useRef<HTMLCanvasElement>(null);
  const strokeRef = useRef<HTMLCanvasElement>(null);
  const linesRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<ColoringEngine | null>(null);
  const picRef = useRef<Picture | null>(null);

  const [loading, setLoading] = useState(true);
  const [hist, setHist] = useState({ canUndo: false, canRedo: false });
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [saveOpen, setSaveOpen] = useState(false);
  const [tool, setTool] = useState<ToolState>({ tool: 'bucket', paint: { kind: 'solid', color: '#FFB31A' }, size: 2, stamp: '⭐' });
  const toolRef = useRef(tool);
  toolRef.current = tool;

  // ---------------------------------------------------------------- last inn
  useEffect(() => {
    let alive = true;
    (async () => {
      const pic = await getPicture(id);
      if (!alive) return;
      if (!pic) {
        go({ name: 'home' });
        return;
      }
      picRef.current = pic;
      const engine = new ColoringEngine(paintRef.current!, strokeRef.current!, linesRef.current!);
      engineRef.current = engine;
      await engine.load(pic.lineArt, pic.paint);
      if (!alive) return;
      vp.setDoc(engine.width, engine.height);
      engine.onChange = ({ canUndo, canRedo, dirty }) => {
        setHist({ canUndo, canRedo });
        if (dirty) scheduleSave();
      };
      setLoading(false);
    })();
    return () => {
      alive = false;
      flushSave();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // ---------------------------------------------------------------- autolagring
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef(false);

  const doSave = useCallback(async () => {
    const engine = engineRef.current;
    if (!engine || !pending.current) return;
    pending.current = false;
    setSaveState('saving');
    const paint = engine.isBlank() ? undefined : await canvasToBlob(engine.paintLayer());
    const thumb = await makeThumb(engine.composite(720));
    await updatePicture(id, { paint, thumb });
    setSaveState('saved');
  }, [id]);

  const scheduleSave = useCallback(() => {
    pending.current = true;
    setSaveState('idle');
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(doSave, 1200);
  }, [doSave]);

  const flushSave = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    void doSave();
  }, [doSave]);

  useEffect(() => {
    const onHide = () => document.visibilityState === 'hidden' && flushSave();
    document.addEventListener('visibilitychange', onHide);
    return () => document.removeEventListener('visibilitychange', onHide);
  }, [flushSave]);

  // ---------------------------------------------------------------- tastatur
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest('input, textarea, dialog')) return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) engineRef.current?.redo();
        else engineRef.current?.undo();
      } else if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        engineRef.current?.redo();
      } else if (e.key === '+' || e.key === '=') vp.zoomCenter(1.25);
      else if (e.key === '-') vp.zoomCenter(0.8);
      else if (e.key === '0') vp.fit();
    };
    window.addEventListener('keydown', onKey);
    const onResize = () => vp.fit();
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onResize);
    };
  }, [vp]);

  // ---------------------------------------------------------------- pekere (penn, finger, mus)
  const pointers = useRef(new Map<number, { x: number; y: number; type: string }>());
  const gesture = useRef<{ mode: 'none' | 'draw' | 'pan' | 'pinch' | 'tap'; startDist: number; lastMid: { x: number; y: number }; down: { x: number; y: number } }>({
    mode: 'none',
    startDist: 0,
    lastMid: { x: 0, y: 0 },
    down: { x: 0, y: 0 },
  });
  const spaceDown = useRef(false);

  useEffect(() => {
    const kd = (e: KeyboardEvent) => e.code === 'Space' && !(e.target as HTMLElement)?.closest('input,textarea') && (spaceDown.current = true);
    const ku = (e: KeyboardEvent) => e.code === 'Space' && (spaceDown.current = false);
    window.addEventListener('keydown', kd);
    window.addEventListener('keyup', ku);
    return () => {
      window.removeEventListener('keydown', kd);
      window.removeEventListener('keyup', ku);
    };
  }, []);

  const toPt = (e: PointerEvent | React.PointerEvent): Pt => {
    const p = vp.toDoc(e.clientX, e.clientY);
    return { x: p.x, y: p.y, pressure: e.pointerType === 'pen' ? e.pressure : 0.5 };
  };

  const midDist = () => {
    const [a, b] = [...pointers.current.values()];
    return { mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, dist: Math.hypot(a.x - b.x, a.y - b.y) };
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const engine = engineRef.current;
    if (!engine || loading) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY, type: e.pointerType });
    const g = gesture.current;

    if (pointers.current.size === 2) {
      // To fingre: avbryt eventuelt strøk og zoom/panorer
      if (g.mode === 'draw') engine.cancel();
      const md = midDist();
      g.mode = 'pinch';
      g.startDist = md.dist;
      g.lastMid = md.mid;
      return;
    }
    if (pointers.current.size > 2) return;

    const cur = toolRef.current;
    const navigate = cur.tool === 'hand' || spaceDown.current || e.button === 1 || (penOnly && e.pointerType === 'touch');
    g.down = { x: e.clientX, y: e.clientY };
    if (navigate) {
      g.mode = 'pan';
      g.lastMid = { x: e.clientX, y: e.clientY };
    } else if (cur.tool === 'bucket') {
      g.mode = 'tap';
    } else {
      g.mode = 'draw';
      engine.begin(cur, toPt(e));
    }
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY, type: e.pointerType });
    const g = gesture.current;
    if (g.mode === 'pinch' && pointers.current.size >= 2) {
      const { mid, dist } = midDist();
      vp.panBy(mid.x - g.lastMid.x, mid.y - g.lastMid.y);
      if (g.startDist > 0) vp.zoomAt(dist / g.startDist, mid.x, mid.y);
      g.startDist = dist;
      g.lastMid = mid;
    } else if (g.mode === 'pan') {
      vp.panBy(e.clientX - g.lastMid.x, e.clientY - g.lastMid.y);
      g.lastMid = { x: e.clientX, y: e.clientY };
    } else if (g.mode === 'draw') {
      const native = e.nativeEvent;
      const events = typeof native.getCoalescedEvents === 'function' ? native.getCoalescedEvents() : [native];
      engineRef.current?.move((events.length ? events : [native]).map(toPt));
    } else if (g.mode === 'tap' && Math.hypot(e.clientX - g.down.x, e.clientY - g.down.y) > 12) {
      // Bøtte + dra = flytt bildet
      g.mode = 'pan';
      g.lastMid = { x: e.clientX, y: e.clientY };
    }
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.delete(e.pointerId);
    const g = gesture.current;
    const engine = engineRef.current;
    if (g.mode === 'draw') engine?.end();
    if (g.mode === 'tap' && engine) {
      const p = toPt(e);
      engine.fill(p.x, p.y, toolRef.current.paint);
      if ('vibrate' in navigator) navigator.vibrate?.(8);
    }
    if (pointers.current.size === 0) g.mode = 'none';
    else if (g.mode === 'pinch') {
      // én finger igjen etter zoom → ikke begynn å tegne
      g.mode = 'pan';
      const [rest] = [...pointers.current.values()];
      g.lastMid = { x: rest.x, y: rest.y };
    }
  };

  const onWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) vp.zoomAt(Math.exp(-e.deltaY * 0.01), e.clientX, e.clientY);
    else vp.panBy(-e.deltaX, -e.deltaY);
  };

  // Hindre at nettleseren zoomer hele siden ved ctrl+hjul / pinch på styreflate
  useEffect(() => {
    const el = vp.viewportRef.current;
    if (!el) return;
    const prevent = (e: WheelEvent) => e.preventDefault();
    el.addEventListener('wheel', prevent, { passive: false });
    return () => el.removeEventListener('wheel', prevent);
  }, [vp.viewportRef]);

  // ---------------------------------------------------------------- handlinger
  const download = async () => {
    const engine = engineRef.current;
    if (!engine) return;
    const blob = await canvasToBlob(engine.composite());
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `lealand-${(picRef.current?.prompt ?? 'bilde').replace(/[^\p{L}\p{N}]+/gu, '-').slice(0, 40)}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  };

  const print = () => {
    const engine = engineRef.current;
    if (engine) printImage(engine.composite().toDataURL('image/png'));
  };

  const clear = () => {
    if (window.confirm(t('tool.clear.confirm'))) engineRef.current?.clearAll();
  };

  const cursor = tool.tool === 'hand' ? 'grab' : tool.tool === 'bucket' ? 'cell' : 'crosshair';

  return (
    <div className={s.root}>
      <header className={s.top}>
        <Button variant="tertiary" data-size="md" onClick={() => window.history.back()}>
          <ArrowLeft aria-hidden /> <span className={s.hideSm}>{t('nav.back')}</span>
        </Button>
        <p className={s.title}>{picRef.current?.prompt}</p>
        <div className={s.group}>
          <Tooltip content={t('tool.undo')}>
            <Button variant="tertiary" icon data-size="md" aria-label={t('tool.undo')} disabled={!hist.canUndo} onClick={() => engineRef.current?.undo()}>
              <Undo2 />
            </Button>
          </Tooltip>
          <Tooltip content={t('tool.redo')}>
            <Button variant="tertiary" icon data-size="md" aria-label={t('tool.redo')} disabled={!hist.canRedo} onClick={() => engineRef.current?.redo()}>
              <Redo2 />
            </Button>
          </Tooltip>
          <Tooltip content={t('tool.clear')}>
            <Button variant="tertiary" icon data-size="md" aria-label={t('tool.clear')} onClick={clear} data-color="danger">
              <Trash2 />
            </Button>
          </Tooltip>
        </div>
        <span className={s.status} aria-live="polite">
          {saveState === 'saved' && (
            <>
              <Check size={16} aria-hidden /> {t('tool.saved')}
            </>
          )}
        </span>
        <div className={s.group}>
          <Button variant="tertiary" icon data-size="md" aria-label={t('tool.print')} onClick={print}>
            <Printer />
          </Button>
          <Button variant="tertiary" icon data-size="md" aria-label={t('tool.download')} onClick={download}>
            <Download />
          </Button>
          <Button variant="primary" data-size="md" onClick={() => setSaveOpen(true)}>
            <Share2 aria-hidden /> <span className={s.hideSm}>{t('common.save')}</span>
          </Button>
        </div>
      </header>

      <div className={s.body}>
        <ToolRail tool={tool} setTool={setTool} />

        <div
          ref={vp.viewportRef}
          className={s.viewport}
          style={{ cursor }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onWheel={onWheel}
          onContextMenu={(e) => e.preventDefault()}
        >
          <div ref={vp.stageRef} className={s.stage}>
            <canvas ref={paintRef} className={s.layer} />
            <canvas ref={strokeRef} className={s.layer} />
            <canvas ref={linesRef} className={s.layer} />
          </div>
          {loading && (
            <div className={s.loading}>
              <Spinner aria-label="…" data-size="lg" />
            </div>
          )}
          <div className={s.zoom} onPointerDown={(e) => e.stopPropagation()}>
            <Button variant="secondary" icon data-size="md" aria-label={t('tool.zoom_out')} onClick={() => vp.zoomCenter(0.8)}>
              <ZoomOut />
            </Button>
            <Button variant="secondary" icon data-size="md" aria-label={t('tool.fit')} onClick={vp.fit}>
              <Maximize2 />
            </Button>
            <Button variant="secondary" icon data-size="md" aria-label={t('tool.zoom_in')} onClick={() => vp.zoomCenter(1.25)}>
              <ZoomIn />
            </Button>
            <Button
              variant={tool.tool === 'hand' ? 'primary' : 'secondary'}
              icon
              data-size="md"
              aria-label={t('tool.hand')}
              aria-pressed={tool.tool === 'hand'}
              onClick={() => setTool((x) => ({ ...x, tool: x.tool === 'hand' ? 'bucket' : 'hand' }))}
            >
              <Hand />
            </Button>
          </div>
        </div>

        <ColorPanel tool={tool} setTool={setTool} />
      </div>

      <SaveDialog
        open={saveOpen}
        onClose={() => setSaveOpen(false)}
        engine={engineRef}
        picture={picRef}
        onDownload={download}
      />
    </div>
  );
}
