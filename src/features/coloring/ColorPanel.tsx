'use client';
import { useState } from 'react';
import { Tabs, TabsList, TabsPanel, TabsTab } from '@digdir/designsystemet-react';
import { FlaskConical, Pipette } from 'lucide-react';
import { useApp, useT } from '@/store/app';
import { PALETTE, type ToolState } from './engine/tools';
import { PATTERNS, patternTile } from './engine/patterns';
import { MixerDialog } from '@/features/mixer/MixerDialog';
import s from './ColorPanel.module.css';

export function ColorPanel({ tool, setTool }: { tool: ToolState; setTool: React.Dispatch<React.SetStateAction<ToolState>> }) {
  const t = useT();
  const custom = useApp((st) => st.customColors);
  const addCustom = useApp((st) => st.addCustomColor);
  const [mixerOpen, setMixerOpen] = useState(false);

  const solid = tool.paint.kind === 'solid' ? tool.paint.color.toLowerCase() : null;
  const patternId = tool.paint.kind === 'pattern' ? tool.paint.id : null;

  const pickColor = (color: string) =>
    setTool((x) => ({
      ...x,
      paint: { kind: 'solid', color },
      // Velger man farge med viskelær/regnbue aktivt, er det naturlig å gå tilbake til fargeverktøy
      tool: x.tool === 'eraser' || x.tool === 'hand' || x.tool === 'rainbow' || x.tool === 'stamp' ? 'bucket' : x.tool,
    }));

  const pickPattern = (id: string) =>
    setTool((x) => ({
      ...x,
      paint: { kind: 'pattern', id },
      tool: ['bucket', 'pencil', 'crayon', 'marker', 'brush'].includes(x.tool) ? x.tool : 'bucket',
    }));

  const swatch = (c: string) => (
    <button
      key={c}
      className={s.swatch}
      style={{ background: c }}
      role="radio"
      aria-checked={solid === c.toLowerCase()}
      aria-label={c}
      onClick={() => pickColor(c)}
    />
  );

  return (
    <aside className={s.panel} aria-label={t('colors.title')} onPointerDown={(e) => e.stopPropagation()}>
      <div className={s.current} aria-hidden>
        <span
          className={s.currentDot}
          style={
            tool.paint.kind === 'solid'
              ? { background: tool.paint.color }
              : { backgroundImage: `url(${patternTile(PATTERNS.find((p) => p.id === patternId)!).toDataURL()})`, backgroundSize: '24px' }
          }
        />
      </div>

      <Tabs defaultValue="colors" data-size="sm">
        <TabsList>
          <TabsTab value="colors">{t('colors.title')}</TabsTab>
          <TabsTab value="patterns">{t('colors.patterns')}</TabsTab>
        </TabsList>

        <TabsPanel value="colors" className={s.tabPanel}>
          <div className={s.grid} role="radiogroup" aria-label={t('colors.title')}>
            {PALETTE.map(swatch)}
          </div>

          {custom.length > 0 && (
            <>
              <h3 className={s.h}>{t('colors.my')}</h3>
              <div className={s.grid} role="radiogroup" aria-label={t('colors.my')}>
                {custom.map(swatch)}
              </div>
            </>
          )}

          <div className={s.extra}>
            <button className={s.mixer} onClick={() => setMixerOpen(true)}>
              <FlaskConical aria-hidden size={26} />
              <span>
                <strong>{t('colors.mixer')}</strong>
                <small>{t('colors.mixer.desc')}</small>
              </span>
            </button>
            <label className={s.picker}>
              <Pipette aria-hidden size={20} />
              <span>{t('colors.picker')}</span>
              <input
                type="color"
                value={solid ?? '#6b4eff'}
                onChange={(e) => pickColor(e.target.value)}
                onBlur={(e) => addCustom(e.target.value)}
              />
            </label>
          </div>
        </TabsPanel>

        <TabsPanel value="patterns" className={s.tabPanel}>
          <div className={s.patternGrid} role="radiogroup" aria-label={t('colors.patterns')}>
            {PATTERNS.map((p) => (
              <button
                key={p.id}
                role="radio"
                aria-checked={patternId === p.id}
                aria-label={p.id}
                className={s.pattern}
                style={{ backgroundImage: `url(${patternTile(p).toDataURL()})`, backgroundSize: `${p.size / 1.6}px` }}
                onClick={() => pickPattern(p.id)}
              />
            ))}
          </div>
        </TabsPanel>
      </Tabs>

      <MixerDialog
        open={mixerOpen}
        onClose={() => setMixerOpen(false)}
        onUse={(c) => {
          addCustom(c);
          pickColor(c);
          setMixerOpen(false);
        }}
      />
    </aside>
  );
}
