'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, Spinner, Switch, ToggleGroup, ToggleGroupItem, useMediaQuery } from '@digdir/designsystemet-react';
import { ArrowLeft, Undo2, Redo2, ZoomIn, ZoomOut, Maximize2, Download, Trash2, Hand, Printer, Share2, Check, FlipHorizontal2, Settings2, Image as ImageIcon } from 'lucide-react';
import { useApp, useT } from '@/store/app';
import type { DictKey } from '@/lib/i18n/dict';
import { getPicture, updatePicture, type Picture } from '@/features/library/db';
import { canvasToBlob, makeThumb } from '@/lib/image-utils';
import { printImage } from '@/lib/print';
import { ColoringEngine, readPointer, type Pt } from './engine/engine';
import type { Layer, PaintSource, Symmetry, ToolId, ToolState } from './engine/tools';
import { useViewport } from './useViewport';
import { ToolDock, defaultSize } from './ToolDock';
import { ColorDock } from './ColorDock';
import { SaveDialog } from './SaveDialog';
import { Menu } from './Menu';
import { VSlider } from './VSlider';
import { sizeToSlider, sliderToSize } from './engine/tools';
import menu from './Menu.module.css';
import s from './ColoringView.module.css';

const SYMMETRIES: { id: Symmetry; label: DictKey }[] = [
  { id: 'off', label: 'sym.off' },
  { id: 'vertical', label: 'sym.vertical' },
  { id: 'horizontal', label: 'sym.horizontal' },
  { id: 'quad', label: 'sym.quad' },
  { id: 'kaleido', label: 'sym.kaleido' },
];

type Mode = 'none' | 'draw' | 'pan' | 'pinch' | 'tap' | 'pick';

export function ColoringView({ id }: { id: string }) {
  const t = useT();
  const go = useApp((st) => st.go);
  const settings = useApp();
  const compact = useMediaQuery('(max-width: 900px) and (orientation: portrait), (max-width: 700px)');
  const vp = useViewport();
  const paintRef = useRef<HTMLCanvasElement>(null);
  const strokeRef = useRef<HTMLCanvasElement>(null);
  const linesRef = useRef<HTMLCanvasElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<ColoringEngine | null>(null);
  const picRef = useRef<Picture | null>(null);

  const [loading, setLoading] = useState(true);
  const [hist, setHist] = useState({ canUndo: false, canRedo: false });
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [saveOpen, setSaveOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [recent, setRecent] = useState<string[]>([]);
  const [tool, setTool] = useState<ToolState>({
    tool: 'bucket',
    paint: { kind: 'solid', color: '#FFB31A' },
    size: 26,
    opacity: 1,
    stamp: '⭐',
    layer: 'paint',
    symmetry: 'off',
    quickShape: settings.quickShape,
  });
  const sizes = useRef<Partial<Record<ToolId, number>>>({});
  const toolRef = useRef(tool);
  toolRef.current = tool;
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const say = useCallback((msg: string, ms = 2200) => {
    setToast(msg);
    window.clearTimeout((say as unknown as { h?: number }).h);
    (say as unknown as { h?: number }).h = window.setTimeout(() => setToast(null), ms);
  }, []);

  // ================================================================ last inn
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
      // Tomt ark → start på strek-laget med tusjpenn (settes før lasting, så verktøyet ikke «blinker»)
      if (pic.source === 'draw' && !pic.lineLayer && !pic.paint) {
        setTool((x) => ({ ...x, tool: 'ink', layer: 'line', size: 10, paint: { kind: 'solid', color: '#1D1B2E' } }));
      }
      const engine = new ColoringEngine(paintRef.current!, strokeRef.current!, linesRef.current!);
      engineRef.current = engine;
      await engine.load({ lineArt: pic.lineArt, lineLayer: pic.lineLayer, paint: pic.paint });
      if (!alive) return;
      vp.setDoc(engine.width, engine.height);
      engine.onChange = ({ canUndo, canRedo, dirty }) => {
        setHist({ canUndo, canRedo });
        if (dirty) scheduleSave();
      };
      setLoading(false);
      if (!settingsRef.current.gestureTipShown) {
        setTimeout(() => say(t('toast.gestures'), 4500), 600);
        useApp.getState().set({ gestureTipShown: true });
      }
    })();
    return () => {
      alive = false;
      flushSave();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // ================================================================ autolagring
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef(false);

  const doSave = useCallback(async () => {
    const engine = engineRef.current;
    if (!engine || !pending.current) return;
    pending.current = false;
    setSaveState('saving');
    const patch: Partial<Picture> = {
      paint: engine.isBlank('paint') ? undefined : await canvasToBlob(engine.layerCanvas('paint')),
      thumb: await makeThumb(engine.composite(720)),
    };
    if (engine.lineDirty) {
      patch.lineLayer = await canvasToBlob(engine.layerCanvas('line'));
      patch.lineArt = await canvasToBlob(engine.flattenLines());
      engine.lineDirty = false;
    }
    await updatePicture(id, patch);
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

  // ================================================================ verktøyvalg
  const chooseTool = (next: ToolId) =>
    setTool((x) => {
      if (x.tool !== 'eyedropper' && x.tool !== 'hand') sizes.current[x.tool] = x.size;
      const size = sizes.current[next] ?? (next === 'bucket' || next === 'eyedropper' || next === 'hand' ? x.size : defaultSize(next));
      return { ...x, tool: next, size };
    });

  const choosePaint = (p: PaintSource) => {
    if (p.kind === 'solid') setRecent((r) => [p.color, ...r.filter((c) => c.toLowerCase() !== p.color.toLowerCase())].slice(0, 8));
    setTool((x) => ({
      ...x,
      paint: p,
      // Velger man farge med viskelær/regnbue/stempel/pipette aktivt, bytter vi til et fargeverktøy
      tool: ['eraser', 'hand', 'rainbow', 'stamp', 'eyedropper', 'smudge'].includes(x.tool) ? (x.layer === 'line' ? 'ink' : 'bucket') : x.tool,
    }));
  };

  const chooseLayer = (layer: Layer) =>
    setTool((x) => {
      if (layer === 'line' && (x.tool === 'bucket' || x.tool === 'airbrush' || x.tool === 'spray')) {
        return { ...x, layer, tool: 'ink', size: sizes.current.ink ?? defaultSize('ink') };
      }
      return { ...x, layer };
    });

  useEffect(() => setTool((x) => ({ ...x, quickShape: settings.quickShape })), [settings.quickShape]);

  // ================================================================ tastatur
  useEffect(() => {
    const keys: Record<string, ToolId> = { b: 'brush', p: 'pencil', i: 'ink', m: 'marker', g: 'bucket', e: 'eraser', s: 'smudge', k: 'crayon' };
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest('input, textarea, dialog')) return;
      const mod = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();
      if (mod && k === 'z') {
        e.preventDefault();
        if (e.shiftKey) engineRef.current?.redo();
        else engineRef.current?.undo();
      } else if (mod && k === 'y') {
        e.preventDefault();
        engineRef.current?.redo();
      } else if (!mod && keys[k]) chooseTool(keys[k]);
      else if (k === '[') setTool((x) => ({ ...x, size: Math.max(2, Math.round(x.size / 1.2)) }));
      else if (k === ']') setTool((x) => ({ ...x, size: Math.min(200, Math.round(x.size * 1.2) + 1) }));
      else if (k === '+' || k === '=') vp.zoomCenter(1.25);
      else if (k === '-') vp.zoomCenter(0.8);
      else if (k === '0') vp.fit();
    };
    window.addEventListener('keydown', onKey);
    const onResize = () => vp.fit();
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onResize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vp]);

  // ================================================================ pekere
  const pointers = useRef(new Map<number, { x: number; y: number; type: string }>());
  const g = useRef({
    mode: 'none' as Mode,
    startDist: 0,
    lastMid: { x: 0, y: 0 },
    down: { x: 0, y: 0 },
    // tap-gester (to/tre fingre)
    tapStart: 0,
    tapMax: 0,
    tapMoved: false,
    drawPointer: -1,
    hold: 0 as number | ReturnType<typeof setTimeout>,
    holdAt: { x: 0, y: 0 },
  });
  const spaceDown = useRef(false);

  useEffect(() => {
    const kd = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !(e.target as HTMLElement)?.closest('input,textarea')) spaceDown.current = true;
    };
    const ku = (e: KeyboardEvent) => {
      if (e.code === 'Space') spaceDown.current = false;
    };
    window.addEventListener('keydown', kd);
    window.addEventListener('keyup', ku);
    return () => {
      window.removeEventListener('keydown', kd);
      window.removeEventListener('keyup', ku);
    };
  }, []);

  // iOS: hindre forstørrelsesglass/tekstvalg ved langt trykk på lerretet
  useEffect(() => {
    const el = vp.viewportRef.current;
    if (!el) return;
    const prevent = (e: Event) => e.preventDefault();
    el.addEventListener('touchstart', prevent, { passive: false });
    el.addEventListener('wheel', prevent, { passive: false });
    return () => {
      el.removeEventListener('touchstart', prevent);
      el.removeEventListener('wheel', prevent);
    };
  }, [vp.viewportRef]);

  const toPt = (e: PointerEvent): Pt => readPointer(e, vp.toDoc);

  const midDist = () => {
    const [a, b] = [...pointers.current.values()];
    return { mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, dist: Math.hypot(a.x - b.x, a.y - b.y) };
  };

  const showCursor = (e: PointerEvent, visible: boolean) => {
    const c = cursorRef.current;
    const v = vp.viewportRef.current;
    if (!c || !v) return;
    const cur = toolRef.current;
    const noRing = e.pointerType === 'touch' || ['bucket', 'hand', 'eyedropper', 'stamp'].includes(cur.tool);
    if (!visible || noRing) {
      c.style.opacity = '0';
      return;
    }
    const r = v.getBoundingClientRect();
    const d = Math.max(6, cur.size * vp.transform.current.s);
    c.style.opacity = '1';
    c.style.width = c.style.height = `${d}px`;
    c.style.transform = `translate(${e.clientX - r.left - d / 2}px, ${e.clientY - r.top - d / 2}px)`;
  };

  const clearHold = () => {
    if (g.current.hold) clearTimeout(g.current.hold);
    g.current.hold = 0;
  };

  const armHold = (e: PointerEvent) => {
    clearHold();
    if (!toolRef.current.quickShape) return;
    g.current.holdAt = { x: e.clientX, y: e.clientY };
    g.current.hold = setTimeout(() => {
      const kind = engineRef.current?.snapShape();
      if (kind) {
        say(t(`shape.${kind}` as DictKey), 1400);
        navigator.vibrate?.(12);
      }
    }, 520);
  };

  const onPointerDown = (ev: React.PointerEvent<HTMLDivElement>) => {
    const engine = engineRef.current;
    const e = ev.nativeEvent;
    if (!engine || loading) return;
    ev.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY, type: e.pointerType });
    const st = g.current;
    const prefs = settingsRef.current;

    // Penn oppdaget første gang → håndflate-beskyttelse
    if (e.pointerType === 'pen' && !prefs.penDetected) {
      useApp.getState().set({ penDetected: true });
      if (prefs.fingerMode === 'auto') say(t('toast.pen'), 3500);
    }

    const touches = [...pointers.current.values()].filter((p) => p.type === 'touch').length;
    if (e.pointerType === 'touch') {
      if (touches === 1) {
        st.tapStart = performance.now();
        st.tapMax = 1;
        st.tapMoved = false;
      } else st.tapMax = Math.max(st.tapMax, touches);
    }

    if (pointers.current.size === 2) {
      // Andre finger kom → avbryt strøket og zoom/panorer
      if (st.mode === 'draw') engine.cancel();
      clearHold();
      const md = midDist();
      st.mode = 'pinch';
      st.startDist = md.dist;
      st.lastMid = md.mid;
      return;
    }
    if (pointers.current.size > 2) return;

    const cur = toolRef.current;
    const fingerMoves = e.pointerType === 'touch' && (prefs.fingerMode === 'move' || (prefs.fingerMode === 'auto' && prefs.penDetected));
    st.down = { x: e.clientX, y: e.clientY };
    st.drawPointer = e.pointerId;

    // Pennens viskelær-ende og sideknapp
    const eraserEnd = e.pointerType === 'pen' && (e.button === 5 || (e.buttons & 32) === 32);
    const barrel = e.pointerType === 'pen' && (e.buttons & 2) === 2;

    if (cur.tool === 'hand' || spaceDown.current || e.button === 1 || (fingerMoves && !eraserEnd)) {
      st.mode = 'pan';
      st.lastMid = { x: e.clientX, y: e.clientY };
    } else if (barrel || cur.tool === 'eyedropper') {
      st.mode = 'pick';
      const p = toPt(e);
      setTool((x) => ({ ...x, paint: { kind: 'solid', color: engine.pick(p.x, p.y) } }));
    } else if (cur.tool === 'bucket' && !eraserEnd) {
      st.mode = 'tap';
    } else {
      st.mode = 'draw';
      const active: ToolState = eraserEnd ? { ...cur, tool: 'eraser', size: sizes.current.eraser ?? defaultSize('eraser') } : cur;
      engine.begin(active, toPt(e));
      armHold(e);
    }
    showCursor(e, st.mode === 'draw');
  };

  const onPointerMove = (ev: React.PointerEvent<HTMLDivElement>) => {
    const e = ev.nativeEvent;
    const st = g.current;
    if (!pointers.current.has(e.pointerId)) {
      // Svevende penn/mus: vis penselstørrelsen
      showCursor(e, true);
      return;
    }
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY, type: e.pointerType });
    if (e.pointerType === 'touch' && Math.hypot(e.clientX - st.down.x, e.clientY - st.down.y) > 10) st.tapMoved = true;

    if (st.mode === 'pinch' && pointers.current.size >= 2) {
      const { mid, dist } = midDist();
      vp.panBy(mid.x - st.lastMid.x, mid.y - st.lastMid.y);
      if (st.startDist > 0) vp.zoomAt(dist / st.startDist, mid.x, mid.y);
      if (Math.abs(dist - st.startDist) > 6) st.tapMoved = true;
      st.startDist = dist;
      st.lastMid = mid;
    } else if (st.mode === 'pan') {
      vp.panBy(e.clientX - st.lastMid.x, e.clientY - st.lastMid.y);
      st.lastMid = { x: e.clientX, y: e.clientY };
    } else if (st.mode === 'pick') {
      const p = toPt(e);
      const c = engineRef.current?.pick(p.x, p.y);
      if (c) setTool((x) => ({ ...x, paint: { kind: 'solid', color: c } }));
    } else if (st.mode === 'draw' && e.pointerId === st.drawPointer) {
      const events = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : [];
      engineRef.current?.move((events.length ? events : [e]).map(toPt));
      if (Math.hypot(e.clientX - st.holdAt.x, e.clientY - st.holdAt.y) > 4) armHold(e);
      showCursor(e, true);
    } else if (st.mode === 'tap' && Math.hypot(e.clientX - st.down.x, e.clientY - st.down.y) > 12) {
      st.mode = 'pan';
      st.lastMid = { x: e.clientX, y: e.clientY };
    }
  };

  const onPointerUp = (ev: React.PointerEvent<HTMLDivElement>) => {
    const e = ev.nativeEvent;
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.delete(e.pointerId);
    const st = g.current;
    const engine = engineRef.current;
    clearHold();
    if (st.mode === 'draw' && e.pointerId === st.drawPointer) engine?.end();
    if (st.mode === 'tap' && engine) {
      const p = toPt(e);
      engine.fill(p.x, p.y, toolRef.current.paint, toolRef.current.opacity);
      navigator.vibrate?.(8);
    }
    if (st.mode === 'pick' && toolRef.current.paint.kind === 'solid') {
      const c = toolRef.current.paint.color;
      setRecent((r) => [c, ...r.filter((x) => x !== c)].slice(0, 8));
    }
    if (pointers.current.size === 0) {
      // To/tre-finger-trykk = angre/gjør om (som i Procreate)
      if (e.pointerType === 'touch' && st.tapMax >= 2 && !st.tapMoved && performance.now() - st.tapStart < 350) {
        if (st.tapMax === 2) engine?.undo();
        else engine?.redo();
        say(st.tapMax === 2 ? t('tool.undo') : t('tool.redo'), 700);
      }
      st.mode = 'none';
      st.tapMax = 0;
    } else if (st.mode === 'pinch') {
      st.mode = 'pan';
      const [rest] = [...pointers.current.values()];
      st.lastMid = { x: rest.x, y: rest.y };
    }
    if (e.pointerType !== 'mouse') showCursor(e, false);
  };

  const onWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) vp.zoomAt(Math.exp(-e.deltaY * 0.01), e.clientX, e.clientY);
    else vp.panBy(-e.deltaX, -e.deltaY);
  };

  // ================================================================ handlinger
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
    const layer = toolRef.current.layer;
    if (window.confirm(t(layer === 'line' ? 'tool.clear.confirm.line' : 'tool.clear.confirm'))) engineRef.current?.clearLayer(layer);
  };

  const toPreview = () => {
    flushSave();
    setTimeout(() => go({ name: 'preview', id }), 150);
  };

  const cursor = tool.tool === 'hand' ? 'grab' : tool.tool === 'bucket' ? 'cell' : tool.tool === 'eyedropper' ? 'copy' : 'none';
  const symActive = tool.symmetry !== 'off';

  return (
    <div className={s.root} data-compact={compact}>
      <header className={s.top}>
        <Button variant="tertiary" data-size="md" icon={compact} aria-label={t('nav.back')} onClick={() => window.history.back()}>
          <ArrowLeft aria-hidden /> {!compact && t('nav.back')}
        </Button>
        <p className={s.title}>{picRef.current?.prompt}</p>

        <div className={s.group}>
          <Button variant="tertiary" icon data-size="md" aria-label={t('tool.undo')} title={t('tool.undo')} disabled={!hist.canUndo} onClick={() => engineRef.current?.undo()}>
            <Undo2 />
          </Button>
          <Button variant="tertiary" icon data-size="md" aria-label={t('tool.redo')} title={t('tool.redo')} disabled={!hist.canRedo} onClick={() => engineRef.current?.redo()}>
            <Redo2 />
          </Button>

          <Menu
            label={t('sym.title')}
            trigger={(open, toggle) => (
              <Button variant={symActive ? 'primary' : 'tertiary'} icon data-size="md" aria-label={t('sym.title')} title={t('sym.title')} aria-expanded={open} onClick={toggle}>
                <FlipHorizontal2 />
              </Button>
            )}
          >
            {(close) => (
              <>
                <p className={menu.sectionTitle} style={{ padding: '4px 8px' }}>
                  {t('sym.title')}
                </p>
                {SYMMETRIES.map((o) => (
                  <button
                    key={o.id}
                    className={menu.item}
                    role="menuitemradio"
                    aria-checked={tool.symmetry === o.id}
                    onClick={() => {
                      setTool((x) => ({ ...x, symmetry: o.id }));
                      close();
                    }}
                  >
                    <SymIcon id={o.id} /> {t(o.label)}
                  </button>
                ))}
              </>
            )}
          </Menu>

          <Menu
            label={t('settings.title')}
            trigger={(open, toggle) => (
              <Button variant="tertiary" icon data-size="md" aria-label={t('settings.title')} title={t('settings.title')} aria-expanded={open} onClick={toggle}>
                <Settings2 />
              </Button>
            )}
          >
            {() => (
              <>
                <div className={menu.section}>
                  <Switch label={t('settings.quickshape')} checked={settings.quickShape} onChange={(e) => settings.set({ quickShape: e.target.checked })} />
                  <p className={menu.desc}>{t('settings.quickshape.desc')}</p>
                </div>
                <div className={menu.section}>
                  <p className={menu.sectionTitle}>{t('settings.finger')}</p>
                  <ToggleGroup aria-label={t('settings.finger')} value={settings.fingerMode} onChange={(v) => settings.set({ fingerMode: v as 'auto' | 'draw' | 'move' })} data-size="sm">
                    <ToggleGroupItem value="auto">{t('finger.auto')}</ToggleGroupItem>
                    <ToggleGroupItem value="draw">{t('finger.draw')}</ToggleGroupItem>
                    <ToggleGroupItem value="move">{t('finger.move')}</ToggleGroupItem>
                  </ToggleGroup>
                  <p className={menu.desc}>{t('settings.finger.desc')}</p>
                </div>
                {compact && (
                  <div className={menu.section}>
                    <button className={menu.item} onClick={print}>
                      <Printer aria-hidden /> {t('tool.print')}
                    </button>
                    <button className={menu.item} onClick={download}>
                      <Download aria-hidden /> {t('tool.download')}
                    </button>
                    <button className={menu.item} onClick={clear} style={{ color: 'var(--ds-color-danger-text-default)' }}>
                      <Trash2 aria-hidden /> {t('tool.clear')}
                    </button>
                  </div>
                )}
              </>
            )}
          </Menu>

          {!compact && (
            <Button variant="tertiary" icon data-size="md" aria-label={t('tool.clear')} title={t('tool.clear')} onClick={clear} data-color="danger">
              <Trash2 />
            </Button>
          )}
        </div>

        {!compact && (
          <span className={s.status} aria-live="polite">
            {saveState === 'saved' && (
              <>
                <Check size={16} aria-hidden /> {t('tool.saved')}
              </>
            )}
          </span>
        )}

        <div className={s.group}>
          {!compact && (
            <>
              <Button variant="tertiary" icon data-size="md" aria-label={t('tool.print')} title={t('tool.print')} onClick={print}>
                <Printer />
              </Button>
              <Button variant="tertiary" icon data-size="md" aria-label={t('tool.download')} title={t('tool.download')} onClick={download}>
                <Download />
              </Button>
            </>
          )}
          <Button variant="tertiary" icon data-size="md" aria-label={t('preview.question')} title={t('preview.question')} onClick={toPreview}>
            <ImageIcon />
          </Button>
          <Button variant="primary" data-size="md" icon={compact} aria-label={t('common.save')} onClick={() => setSaveOpen(true)}>
            <Share2 aria-hidden /> {!compact && t('common.save')}
          </Button>
        </div>
      </header>

      <div className={s.body}>
        {!compact && (
          <ToolDock
            tool={tool}
            compact={false}
            onTool={chooseTool}
            onLayer={chooseLayer}
            onSize={(size) => setTool((x) => ({ ...x, size }))}
            onOpacity={(opacity) => setTool((x) => ({ ...x, opacity }))}
          />
        )}

        <div
          ref={vp.viewportRef}
          className={s.viewport}
          style={{ cursor }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onPointerLeave={(e) => !pointers.current.has(e.pointerId) && showCursor(e.nativeEvent, false)}
          onWheel={onWheel}
          onContextMenu={(e) => e.preventDefault()}
        >
          <div ref={vp.stageRef} className={s.stage}>
            <canvas ref={paintRef} className={s.layer} style={{ zIndex: 0 }} />
            <canvas ref={strokeRef} className={s.layer} style={{ zIndex: 1 }} />
            <canvas ref={linesRef} className={s.layer} style={{ zIndex: 2 }} />
            {symActive && <SymGuides sym={tool.symmetry} />}
          </div>
          <div ref={cursorRef} className={s.cursor} aria-hidden />
          {!compact && (
            <div className={s.sliderBar} onPointerDown={(e) => e.stopPropagation()}>
              <VSlider
                label={t('tool.size')}
                value={sizeToSlider(tool.size)}
                valueText={`${tool.size}px`}
                onChange={(v) => setTool((x) => ({ ...x, size: sliderToSize(v) }))}
              >
                <span className={s.sizeDot} aria-hidden>
                  <span
                    style={{
                      width: Math.max(4, Math.min(40, tool.size / 2.5)),
                      height: Math.max(4, Math.min(40, tool.size / 2.5)),
                      background: tool.paint.kind === 'solid' ? tool.paint.color : 'var(--ll-violet)',
                      opacity: tool.opacity,
                    }}
                  />
                </span>
              </VSlider>
              <VSlider
                label={t('tool.opacity')}
                min={10}
                max={100}
                value={Math.round(tool.opacity * 100)}
                valueText={`${Math.round(tool.opacity * 100)}%`}
                onChange={(v) => setTool((x) => ({ ...x, opacity: v / 100 }))}
              />
            </div>
          )}
          {loading && (
            <div className={s.loading}>
              <Spinner aria-label="…" data-size="lg" />
            </div>
          )}
          {toast && (
            <div className={s.toast} role="status">
              {toast}
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
              onClick={() => chooseTool(tool.tool === 'hand' ? (tool.layer === 'line' ? 'ink' : 'bucket') : 'hand')}
            >
              <Hand />
            </Button>
          </div>
        </div>

        {!compact && (
          <ColorDock
            tool={tool}
            recent={recent}
            compact={false}
            onPaint={choosePaint}
            onStamp={(st) => setTool((x) => ({ ...x, tool: 'stamp', stamp: st }))}
            onEyedropper={() => chooseTool(tool.tool === 'eyedropper' ? 'bucket' : 'eyedropper')}
          />
        )}
      </div>

      {compact && (
        <div className={s.bottom}>
          <ToolDock
            tool={tool}
            compact
            onTool={chooseTool}
            onLayer={chooseLayer}
            onSize={(size) => setTool((x) => ({ ...x, size }))}
            onOpacity={(opacity) => setTool((x) => ({ ...x, opacity }))}
          />
          <ColorDock
            tool={tool}
            recent={recent}
            compact
            onPaint={choosePaint}
            onStamp={(st) => setTool((x) => ({ ...x, tool: 'stamp', stamp: st }))}
            onEyedropper={() => chooseTool(tool.tool === 'eyedropper' ? 'bucket' : 'eyedropper')}
          />
        </div>
      )}

      <SaveDialog open={saveOpen} onClose={() => setSaveOpen(false)} engine={engineRef} picture={picRef} onDownload={download} />
    </div>
  );
}

function SymGuides({ sym }: { sym: Symmetry }) {
  return (
    <svg className={s.guides} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
      {(sym === 'vertical' || sym === 'quad') && <line x1="50" y1="0" x2="50" y2="100" />}
      {(sym === 'horizontal' || sym === 'quad') && <line x1="0" y1="50" x2="100" y2="50" />}
      {sym === 'kaleido' &&
        [0, 60, 120].map((a) => {
          const r = (a * Math.PI) / 180;
          return <line key={a} x1={50 - Math.cos(r) * 80} y1={50 - Math.sin(r) * 80} x2={50 + Math.cos(r) * 80} y2={50 + Math.sin(r) * 80} />;
        })}
    </svg>
  );
}

function SymIcon({ id }: { id: Symmetry }) {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <rect x="3" y="3" width="22" height="22" rx="6" opacity="0.35" />
      {(id === 'vertical' || id === 'quad') && <line x1="14" y1="4" x2="14" y2="24" strokeDasharray="3 3" />}
      {(id === 'horizontal' || id === 'quad') && <line x1="4" y1="14" x2="24" y2="14" strokeDasharray="3 3" />}
      {id === 'kaleido' && (
        <>
          <line x1="14" y1="4" x2="14" y2="24" strokeDasharray="3 3" />
          <line x1="5.5" y1="9" x2="22.5" y2="19" strokeDasharray="3 3" />
          <line x1="22.5" y1="9" x2="5.5" y2="19" strokeDasharray="3 3" />
        </>
      )}
      {id === 'off' && <path d="M9 18c2-6 6-8 10-8" />}
    </svg>
  );
}
