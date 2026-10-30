export type Layer = 'line' | 'paint';

export type ToolId =
  | 'ink'
  | 'pencil'
  | 'crayon'
  | 'marker'
  | 'brush'
  | 'airbrush'
  | 'spray'
  | 'glitter'
  | 'rainbow'
  | 'smudge'
  | 'stamp'
  | 'bucket'
  | 'eraser'
  | 'eyedropper'
  | 'hand';

export type StrokeTool = Exclude<ToolId, 'bucket' | 'eyedropper' | 'hand'>;

export type PaintSource = { kind: 'solid'; color: string } | { kind: 'pattern'; id: string };

export type Symmetry = 'off' | 'vertical' | 'horizontal' | 'quad' | 'kaleido';

export interface ToolState {
  tool: ToolId;
  paint: PaintSource;
  /** Diameter i dokument-piksler */
  size: number;
  /** 0.1–1 */
  opacity: number;
  stamp: string;
  layer: Layer;
  symmetry: Symmetry;
  /** Hold stille på slutten av en strek for å rette den opp til en form */
  quickShape: boolean;
}

export type Render = 'freehand' | 'dab' | 'line' | 'scatter' | 'live';

export interface ToolSpec {
  render: Render;
  /** Opasitet for hele strøket når det «tørker» (ikke per dab) */
  alpha: number;
  composite: GlobalCompositeOperation;
  pressureSize: number; // hvor mye trykk påvirker størrelse (0–1)
  pressureFlow: number; // hvor mye trykk påvirker opasitet (0–1)
  tilt: boolean; // reagerer på pennevinkel
  usesPaint: boolean;
  shapes: boolean; // kan bli «magisk form»
  defaultSize: number;
}

export const TOOL_SPECS: Record<StrokeTool, ToolSpec> = {
  ink: { render: 'freehand', alpha: 1, composite: 'source-over', pressureSize: 0.65, pressureFlow: 0, tilt: false, usesPaint: true, shapes: true, defaultSize: 12 },
  pencil: { render: 'dab', alpha: 1, composite: 'source-over', pressureSize: 0.4, pressureFlow: 0.7, tilt: true, usesPaint: true, shapes: true, defaultSize: 7 },
  crayon: { render: 'line', alpha: 0.95, composite: 'source-over', pressureSize: 0.5, pressureFlow: 0, tilt: true, usesPaint: true, shapes: true, defaultSize: 26 },
  marker: { render: 'freehand', alpha: 0.6, composite: 'multiply', pressureSize: 0, pressureFlow: 0, tilt: false, usesPaint: true, shapes: true, defaultSize: 30 },
  brush: { render: 'dab', alpha: 0.9, composite: 'source-over', pressureSize: 0.75, pressureFlow: 0.3, tilt: true, usesPaint: true, shapes: false, defaultSize: 40 },
  airbrush: { render: 'dab', alpha: 1, composite: 'source-over', pressureSize: 0.2, pressureFlow: 0.9, tilt: false, usesPaint: true, shapes: false, defaultSize: 90 },
  spray: { render: 'scatter', alpha: 1, composite: 'source-over', pressureSize: 0, pressureFlow: 0.5, tilt: false, usesPaint: true, shapes: false, defaultSize: 60 },
  glitter: { render: 'scatter', alpha: 1, composite: 'source-over', pressureSize: 0, pressureFlow: 0, tilt: false, usesPaint: true, shapes: false, defaultSize: 50 },
  rainbow: { render: 'line', alpha: 0.95, composite: 'source-over', pressureSize: 0.6, pressureFlow: 0, tilt: false, usesPaint: false, shapes: true, defaultSize: 30 },
  smudge: { render: 'live', alpha: 1, composite: 'source-over', pressureSize: 0.3, pressureFlow: 0.6, tilt: false, usesPaint: false, shapes: false, defaultSize: 44 },
  stamp: { render: 'scatter', alpha: 1, composite: 'source-over', pressureSize: 0, pressureFlow: 0, tilt: false, usesPaint: false, shapes: false, defaultSize: 90 },
  eraser: { render: 'live', alpha: 1, composite: 'destination-out', pressureSize: 0.4, pressureFlow: 0, tilt: false, usesPaint: false, shapes: true, defaultSize: 40 },
};

export const MIN_SIZE = 2;
export const MAX_SIZE = 200;

/** Glidebryter 0–100 ↔ størrelse (logaritmisk, så små størrelser er lette å treffe). */
export const sliderToSize = (v: number) => Math.round(MIN_SIZE * Math.pow(MAX_SIZE / MIN_SIZE, v / 100));
export const sizeToSlider = (s: number) => Math.round((Math.log(s / MIN_SIZE) / Math.log(MAX_SIZE / MIN_SIZE)) * 100);

export const STAMPS = ['⭐', '❤️', '🌸', '🦋', '🌈', '☀️', '🌙', '✨', '🍄', '🐞', '🐟', '🐾', '🎈', '👑', '💎', '🍓', '🌻', '🍭', '🎀', '🚀', '🦄', '🐱', '🐶', '🍀', '🌵', '🍕', '⚽', '🎵', '☁️', '❄️'];

export const PALETTE = [
  '#E53935', '#FF6F61', '#FF8A3D', '#FFB31A', '#FFE14D', '#FFF59D',
  '#2E7D32', '#5BD46A', '#B2F2BB', '#14B8A6', '#2F9BEF', '#90CAF9',
  '#3949AB', '#6B4EFF', '#B39DFF', '#C2185B', '#F2559A', '#FFC1DA',
  '#5D4037', '#8D6E63', '#D7A36F', '#F3D2B3', '#FCE8D8', '#FFFFFF',
  '#1D1B2E', '#616161', '#9E9E9E', '#E0E0E0',
];
