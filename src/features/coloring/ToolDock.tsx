'use client';
import { PenLine, Palette, Pencil, PenTool, Highlighter, Paintbrush, SprayCan, Sparkles, Rainbow, PaintBucket, Stamp, Eraser, Wind, Fingerprint, Feather, type LucideIcon } from 'lucide-react';
import { useT } from '@/store/app';
import type { DictKey } from '@/lib/i18n/dict';
import { sizeToSlider, sliderToSize, TOOL_SPECS, type Layer, type StrokeTool, type ToolId, type ToolState } from './engine/tools';
import s from './ToolDock.module.css';

export const TOOLS: { id: ToolId; icon: LucideIcon; label: DictKey }[] = [
  { id: 'ink', icon: Feather, label: 'tool.ink' },
  { id: 'pencil', icon: Pencil, label: 'tool.pencil' },
  { id: 'crayon', icon: PenTool, label: 'tool.crayon' },
  { id: 'marker', icon: Highlighter, label: 'tool.marker' },
  { id: 'brush', icon: Paintbrush, label: 'tool.brush' },
  { id: 'airbrush', icon: Wind, label: 'tool.airbrush' },
  { id: 'spray', icon: SprayCan, label: 'tool.spray' },
  { id: 'glitter', icon: Sparkles, label: 'tool.glitter' },
  { id: 'rainbow', icon: Rainbow, label: 'tool.rainbow' },
  { id: 'smudge', icon: Fingerprint, label: 'tool.smudge' },
  { id: 'stamp', icon: Stamp, label: 'tool.stamp' },
  { id: 'bucket', icon: PaintBucket, label: 'tool.bucket' },
  { id: 'eraser', icon: Eraser, label: 'tool.eraser' },
];

interface Props {
  tool: ToolState;
  onTool: (id: ToolId) => void;
  onLayer: (l: Layer) => void;
  onSize: (px: number) => void;
  onOpacity: (o: number) => void;
  compact: boolean;
}

export function ToolDock({ tool, onTool, onLayer, onSize, onOpacity, compact }: Props) {
  const t = useT();
  const color = tool.paint.kind === 'solid' ? tool.paint.color : '#6b4eff';
  const usesSize = tool.tool !== 'bucket' && tool.tool !== 'hand' && tool.tool !== 'eyedropper';
  const previewPx = Math.max(4, Math.min(compact ? 34 : 44, tool.size / 2.4));

  return (
    <aside className={s.dock} data-compact={compact} aria-label="Verktøy" onPointerDown={(e) => e.stopPropagation()}>
      <div className={s.layers} role="radiogroup" aria-label="Lag">
        {(['line', 'paint'] as const).map((l) => (
          <button key={l} role="radio" aria-checked={tool.layer === l} className={s.layer} data-layer={l} onClick={() => onLayer(l)}>
            {l === 'line' ? <PenLine size={20} aria-hidden /> : <Palette size={20} aria-hidden />}
            <span>{t(l === 'line' ? 'layer.line' : 'layer.paint')}</span>
          </button>
        ))}
      </div>
      {!compact && <p className={s.hint}>{t(tool.layer === 'line' ? 'layer.hint.line' : 'layer.hint.paint')}</p>}

      <div className={s.tools} role="radiogroup" aria-label="Verktøy">
        {TOOLS.map(({ id, icon: Icon, label }) => (
          <button key={id} role="radio" aria-checked={tool.tool === id} className={s.tool} title={t(label)} onClick={() => onTool(id)}>
            {id === 'stamp' && tool.tool === 'stamp' ? <span className={s.emoji}>{tool.stamp}</span> : <Icon size={compact ? 22 : 24} strokeWidth={2.2} aria-hidden />}
            <span className={s.label}>{t(label)}</span>
          </button>
        ))}
      </div>

      {compact && (
      <div className={s.sliders}>
        <label className={s.slider} data-disabled={!usesSize}>
          <span className={s.sliderHead}>
            <span>{t('tool.size')}</span>
            <span className={s.previewBox} aria-hidden>
              <span className={s.preview} style={{ width: previewPx, height: previewPx, background: color, opacity: tool.opacity }} />
            </span>
          </span>
          <input
            type="range"
            min={0}
            max={100}
            value={sizeToSlider(tool.size)}
            disabled={!usesSize}
            onChange={(e) => onSize(sliderToSize(Number(e.target.value)))}
            style={{ ['--fill' as string]: `${sizeToSlider(tool.size)}%` }}
          />
        </label>
        <label className={s.slider}>
          <span className={s.sliderHead}>
            <span>{t('tool.opacity')}</span>
            <span className={s.pct}>{Math.round(tool.opacity * 100)}%</span>
          </span>
          <input
            type="range"
            min={10}
            max={100}
            step={5}
            value={Math.round(tool.opacity * 100)}
            onChange={(e) => onOpacity(Number(e.target.value) / 100)}
            style={{ ['--fill' as string]: `${((tool.opacity * 100 - 10) / 90) * 100}%` }}
          />
        </label>
      </div>
      )}
    </aside>
  );
}

export function defaultSize(id: ToolId) {
  return TOOL_SPECS[id as StrokeTool]?.defaultSize ?? 20;
}
