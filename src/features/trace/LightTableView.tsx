'use client';
import { TraceScreen } from './TraceScreen';

/** Lysbord: iPad/nettbrett med full lysstyrke, arket legges over skjermen. */
export function LightTableView({ id }: { id: string }) {
  return <TraceScreen id={id} variant="lighttable" />;
}
