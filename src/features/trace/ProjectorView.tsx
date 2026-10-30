'use client';
import { TraceScreen } from './TraceScreen';

/** Projektor: bildet lyses ned på et ark eller en vegg. */
export function ProjectorView({ id }: { id: string }) {
  return <TraceScreen id={id} variant="projector" />;
}
