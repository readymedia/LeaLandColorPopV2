'use client';
import type { TraceState } from './TraceImage';

/**
 * Egen projektorskjerm: et nytt vindu som dras over til projektoren (utvidet skjerm / HDMI),
 * styrt fra hovedvinduet via BroadcastChannel. Erstatter Chromecast-planen fra v1-veikartet:
 * ingen Google Cast-konto, fungerer i alle moderne nettlesere, og bare bildet vises på projektoren.
 */
export interface ProjectorMessage {
  type: 'image' | 'state' | 'hello' | 'close';
  image?: string;
  state?: TraceState;
  frame?: { w: number; h: number };
}

export interface ProjectorLink {
  send: (m: { state: TraceState; frame: { w: number; h: number } }) => void;
  close: () => void;
}

export function openProjectorWindow(image: string, current: () => { state: TraceState; frame: { w: number; h: number } }): ProjectorLink {
  const channelId = crypto.randomUUID().slice(0, 8);
  const ch = new BroadcastChannel(`lealand-projector-${channelId}`);
  const win = window.open(`/projector?ch=${channelId}`, `lealand-projector`, 'popup,width=1280,height=800');
  ch.onmessage = (e: MessageEvent<ProjectorMessage>) => {
    if (e.data.type === 'hello') {
      ch.postMessage({ type: 'image', image } satisfies ProjectorMessage);
      const c = current();
      ch.postMessage({ type: 'state', state: c.state, frame: c.frame } satisfies ProjectorMessage);
    }
  };
  return {
    send: ({ state, frame }) => ch.postMessage({ type: 'state', state, frame } satisfies ProjectorMessage),
    close: () => {
      ch.postMessage({ type: 'close' } satisfies ProjectorMessage);
      ch.close();
      win?.close();
    },
  };
}
