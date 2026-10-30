'use client';
import { useState } from 'react';
import { Switch } from '@digdir/designsystemet-react';
import { Pencil, PenTool, Highlighter, Paintbrush, SprayCan, Sparkles, Rainbow, PaintBucket, Stamp, Eraser, type LucideIcon } from 'lucide-react';
import { useApp, useT } from '@/store/app';
import type { DictKey } from '@/lib/i18n/dict';
import { SIZES, STAMPS, type ToolId, type ToolState } from './engine/tools';
import s from './ToolRail.module.css';

const TOOLS: { id: ToolId; icon: LucideIcon; label: DictKey }[] = [
  { id: 'bucket', icon: PaintBucket, label: 'tool.bucket' },
  { id: 'pencil', icon: Pencil, label: 'tool.pencil' },
  { id: 'crayon', icon: PenTool, label: 'tool.crayon' },
  { id: 'marker', icon: Highlighter, label: 'tool.marker' },
  { id: 'brush', icon: Paintbrush, label: 'tool.brush' },
  { id: 'spray', icon: SprayCan, label: 'tool.spray' },
  { id: 'glitter', icon: Sparkles, label: 'tool.glitter' },
  { id: 'rainbow', icon: Rainbow, label: 'tool.rainbow' },
  { id: 'stamp', icon: Stamp, label: 'tool.stamp' },
  { id: 'eraser', icon: Eraser, label: 'tool.eraser' },
];

export function ToolRail({ tool, setTool }: { tool: ToolState; setTool: React.Dispatch<React.SetStateAction<ToolState>> }) {
  const t = useT();
  const penOnly = useApp((st) => st.penOnly);
  const set = useApp((st) => st.set);
  const [stampsOpen, setStampsOpen] = useState(false);

  return (
    <aside className={s.rail} aria-label="Verktøy" onPointerDown={(e) => e.stopPropagation()}>
      <div className={s.tools} role="radiogroup" aria-label="Verktøy">
        {TOOLS.map(({ id, icon: Icon, label }) => {
          const active = tool.tool === id;
          const btn = (
            <button
              key={id}
              role="radio"
              aria-checked={active}
              className={s.tool}
              title={t(label)}
              aria-label={t(label)}
              onClick={() => {
                setTool((x) => ({ ...x, tool: id }));
                setStampsOpen(id === 'stamp' ? !stampsOpen || !active : false);
              }}
            >
              {id === 'stamp' && active ? <span className={s.emoji}>{tool.stamp}</span> : <Icon size={26} strokeWidth={2.2} aria-hidden />}
              <span className={s.label}>{t(label)}</span>
            </button>
          );
          return btn;
        })}
      </div>

      {stampsOpen && (
        <div className={s.stampPop} role="dialog" aria-label={t('tool.stamp')}>
          <div className={s.stamps}>
            {STAMPS.map((st) => (
              <button
                key={st}
                className={s.stamp}
                aria-pressed={tool.stamp === st}
                onClick={() => {
                  setTool((x) => ({ ...x, tool: 'stamp', stamp: st }));
                  setStampsOpen(false);
                }}
              >
                {st}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className={s.sizes} role="radiogroup" aria-label={t('tool.size')}>
        {SIZES.map((px, i) => (
          <button
            key={px}
            role="radio"
            aria-checked={tool.size === i}
            aria-label={`${t('tool.size')} ${i + 1}`}
            className={s.size}
            onClick={() => setTool((x) => ({ ...x, size: i }))}
          >
            <span style={{ width: 6 + i * 5, height: 6 + i * 5 }} />
          </button>
        ))}
      </div>

      <div className={s.penOnly}>
        <Switch label={t('tool.pen_only')} checked={penOnly} onChange={(e) => set({ penOnly: e.target.checked })} data-size="sm" />
      </div>
    </aside>
  );
}
