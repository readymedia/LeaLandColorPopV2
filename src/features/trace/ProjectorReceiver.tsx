'use client';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { TraceImage, DEFAULT_TRACE, type TraceState } from './TraceImage';
import type { ProjectorMessage } from './projector-link';
import type { Corners } from './keystone';

/** Vinduet som vises på projektoren. Ingen knapper – bare bildet. Dobbelttrykk = fullskjerm. */
export function ProjectorReceiver() {
  const ch = useSearchParams().get('ch');
  const [image, setImage] = useState<string | null>(null);
  const [remote, setRemote] = useState<{ state: TraceState; frame: { w: number; h: number } }>({ state: DEFAULT_TRACE, frame: { w: 1, h: 1 } });
  const [size, setSize] = useState({ w: 0, h: 0 });
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ch || !/^[a-f0-9-]{8}$/.test(ch)) return;
    const bc = new BroadcastChannel(`lealand-projector-${ch}`);
    bc.onmessage = (e: MessageEvent<ProjectorMessage>) => {
      const m = e.data;
      if (m.type === 'image' && m.image?.startsWith('data:image/')) setImage(m.image);
      if (m.type === 'state' && m.state && m.frame) setRemote({ state: m.state, frame: m.frame });
      if (m.type === 'close') window.close();
    };
    bc.postMessage({ type: 'hello' } satisfies ProjectorMessage);
    return () => bc.close();
  }, [ch]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Skaler posisjoner fra hovedvinduets størrelse til projektorvinduets
  const kx = size.w / remote.frame.w;
  const ky = size.h / remote.frame.h;
  const st = remote.state;
  const state: TraceState = {
    ...st,
    x: st.x * kx,
    y: st.y * ky,
    corners: st.corners ? (st.corners.map((c) => ({ x: c.x * kx, y: c.y * ky })) as Corners) : null,
  };

  return (
    <div
      ref={ref}
      onDoubleClick={() => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen())}
      style={{ position: 'fixed', inset: 0, background: '#000', cursor: 'none', overflow: 'hidden' }}
    >
      {image && size.w > 0 ? (
        <TraceImage src={image} state={state} frame={size} />
      ) : (
        <p style={{ color: '#777', fontFamily: 'sans-serif', textAlign: 'center', marginTop: '40vh' }}>Venter på bilde … / Waiting for a picture …</p>
      )}
    </div>
  );
}
