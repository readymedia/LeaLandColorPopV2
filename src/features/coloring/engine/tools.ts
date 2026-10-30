export type ToolId =
  | 'pencil'
  | 'crayon'
  | 'marker'
  | 'brush'
  | 'spray'
  | 'glitter'
  | 'rainbow'
  | 'bucket'
  | 'stamp'
  | 'eraser'
  | 'hand';

export type PaintSource = { kind: 'solid'; color: string } | { kind: 'pattern'; id: string };

export interface ToolState {
  tool: ToolId;
  paint: PaintSource;
  /** Indeks i SIZES */
  size: number;
  stamp: string;
}

/** Penselstørrelser i dokument-piksler (dokumentet er ~2048 px på lengste side). */
export const SIZES = [8, 16, 30, 56, 96];

export interface ToolSpec {
  /** Opasitet for hele strøket (ikke per segment → ingen mørke flekker der streken krysser seg selv). */
  alpha: number;
  composite: GlobalCompositeOperation;
  sizeFactor: number;
  pressure: boolean;
  usesPaint: boolean;
}

export const TOOL_SPECS: Record<Exclude<ToolId, 'hand' | 'bucket'>, ToolSpec> = {
  pencil: { alpha: 1, composite: 'source-over', sizeFactor: 0.45, pressure: true, usesPaint: true },
  crayon: { alpha: 0.95, composite: 'source-over', sizeFactor: 1, pressure: true, usesPaint: true },
  marker: { alpha: 0.55, composite: 'multiply', sizeFactor: 1.1, pressure: false, usesPaint: true },
  brush: { alpha: 0.85, composite: 'source-over', sizeFactor: 1.2, pressure: true, usesPaint: true },
  spray: { alpha: 1, composite: 'source-over', sizeFactor: 1.6, pressure: false, usesPaint: true },
  glitter: { alpha: 1, composite: 'source-over', sizeFactor: 1.4, pressure: false, usesPaint: true },
  rainbow: { alpha: 0.9, composite: 'source-over', sizeFactor: 1, pressure: true, usesPaint: false },
  stamp: { alpha: 1, composite: 'source-over', sizeFactor: 2.6, pressure: false, usesPaint: false },
  eraser: { alpha: 1, composite: 'destination-out', sizeFactor: 1.3, pressure: false, usesPaint: false },
};

export const STAMPS = ['⭐', '❤️', '🌸', '🦋', '🌈', '☀️', '🌙', '✨', '🍄', '🐞', '🐟', '🐾', '🎈', '👑', '💎', '🍓', '🌻', '🍭', '🎀', '🚀', '🦄', '🐱', '🐶', '🍀'];

export const PALETTE = [
  // Varme
  '#E53935', '#FF6F61', '#FF8A3D', '#FFB31A', '#FFE14D', '#FFF59D',
  // Grønne/blå
  '#2E7D32', '#5BD46A', '#B2F2BB', '#14B8A6', '#2F9BEF', '#90CAF9',
  // Lilla/rosa
  '#3949AB', '#6B4EFF', '#B39DFF', '#C2185B', '#F2559A', '#FFC1DA',
  // Jord/hud/nøytral
  '#5D4037', '#8D6E63', '#D7A36F', '#F3D2B3', '#FCE8D8', '#FFFFFF',
  '#212121', '#616161', '#9E9E9E', '#E0E0E0',
];
