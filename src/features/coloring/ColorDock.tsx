'use client';
import { useState } from 'react';
import { Dialog, Heading, Tabs, TabsList, TabsPanel, TabsTab } from '@digdir/designsystemet-react';
import { FlaskConical, Pipette, Plus, Grid3x3 } from 'lucide-react';
import { useApp, useT } from '@/store/app';
import { PALETTE, STAMPS, type PaintSource, type ToolState } from './engine/tools';
import { PATTERNS, patternTile } from './engine/patterns';
import { MixerDialog } from '@/features/mixer/MixerDialog';
import s from './ColorDock.module.css';

interface Props {
  tool: ToolState;
  recent: string[];
  onPaint: (p: PaintSource) => void;
  onStamp: (stamp: string) => void;
  onEyedropper: () => void;
  compact: boolean;
}

const tileUrl = (id: string) => {
  const p = PATTERNS.find((x) => x.id === id);
  return p ? `url(${patternTile(p).toDataURL()})` : 'none';
};

export function ColorDock({ tool, recent, onPaint, onStamp, onEyedropper, compact }: Props) {
  const t = useT();
  const custom = useApp((st) => st.customColors);
  const addCustom = useApp((st) => st.addCustomColor);
  const [mixerOpen, setMixerOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  const solid = tool.paint.kind === 'solid' ? tool.paint.color.toLowerCase() : null;
  const patternId = tool.paint.kind === 'pattern' ? tool.paint.id : null;
  const swatch = (c: string, key = c) => (
    <button key={key} className={s.swatch} style={{ background: c }} role="radio" aria-checked={solid === c.toLowerCase()} aria-label={c} onClick={() => onPaint({ kind: 'solid', color: c })} />
  );

  const currentStyle =
    tool.paint.kind === 'solid' ? { background: tool.paint.color } : { backgroundImage: tileUrl(tool.paint.id), backgroundSize: '28px' };

  const stamps = (
    <div className={s.stamps} role="radiogroup" aria-label={t('colors.stamps')}>
      {STAMPS.map((st) => (
        <button key={st} role="radio" aria-checked={tool.stamp === st} className={s.stamp} onClick={() => onStamp(st)}>
          {st}
        </button>
      ))}
    </div>
  );

  const patterns = (
    <div className={s.patterns} role="radiogroup" aria-label={t('colors.patterns')}>
      {PATTERNS.map((p) => (
        <button
          key={p.id}
          role="radio"
          aria-checked={patternId === p.id}
          aria-label={p.id}
          className={s.pattern}
          style={{ backgroundImage: `url(${patternTile(p).toDataURL()})`, backgroundSize: `${p.size / 1.6}px` }}
          onClick={() => onPaint({ kind: 'pattern', id: p.id })}
        />
      ))}
    </div>
  );

  const extras = (
    <div className={s.extras}>
      <button className={s.mixer} onClick={() => setMixerOpen(true)}>
        <FlaskConical aria-hidden size={24} />
        <span>
          <strong>{t('colors.mixer')}</strong>
          {!compact && <small>{t('colors.mixer.desc')}</small>}
        </span>
      </button>
      <div className={s.row2}>
        <button className={s.chipBtn} aria-pressed={tool.tool === 'eyedropper'} onClick={onEyedropper}>
          <Pipette aria-hidden size={20} /> {t('tool.eyedropper')}
        </button>
        <label className={s.chipBtn}>
          <Plus aria-hidden size={20} />
          <span className="ll-visually-hidden">{t('colors.picker')}</span>
          <input type="color" value={solid ?? '#6b4eff'} onChange={(e) => onPaint({ kind: 'solid', color: e.target.value })} onBlur={(e) => addCustom(e.target.value)} />
        </label>
      </div>
    </div>
  );

  const mixer = (
    <MixerDialog
      open={mixerOpen}
      onClose={() => setMixerOpen(false)}
      onUse={(c) => {
        addCustom(c);
        onPaint({ kind: 'solid', color: c });
        setMixerOpen(false);
      }}
    />
  );

  // ---------------- Kompakt: én rad nederst + ark med flere valg
  if (compact) {
    return (
      <div className={s.strip} onPointerDown={(e) => e.stopPropagation()}>
        <span className={s.current} style={currentStyle} aria-hidden />
        <div className={s.stripScroll} role="radiogroup" aria-label={t('colors.title')}>
          {tool.tool === 'stamp'
            ? STAMPS.slice(0, 12).map((st) => (
                <button key={st} role="radio" aria-checked={tool.stamp === st} className={s.stampSmall} onClick={() => onStamp(st)}>
                  {st}
                </button>
              ))
            : [...new Set([...recent, ...PALETTE])].map((c) => swatch(c))}
        </div>
        <button className={s.moreBtn} onClick={() => setSheetOpen(true)} aria-label={t('colors.more')}>
          <Grid3x3 aria-hidden size={22} />
        </button>
        <Dialog open={sheetOpen} onClose={() => setSheetOpen(false)} modal closedby="any" placement="bottom" closeButton={t('common.close')} className={s.sheet}>
          <Heading level={2} data-size="xs">
            {t('colors.more')}
          </Heading>
          <Tabs defaultValue={tool.tool === 'stamp' ? 'stamps' : 'colors'} data-size="sm">
            <TabsList>
              <TabsTab value="colors">{t('colors.title')}</TabsTab>
              <TabsTab value="patterns">{t('colors.patterns')}</TabsTab>
              <TabsTab value="stamps">{t('tool.stamp')}</TabsTab>
            </TabsList>
            <TabsPanel value="colors" className={s.tabPanel}>
              <div className={s.grid}>{PALETTE.map((c) => swatch(c))}</div>
              {custom.length > 0 && <div className={s.grid}>{custom.map((c) => swatch(c, `c${c}`))}</div>}
              {extras}
            </TabsPanel>
            <TabsPanel value="patterns" className={s.tabPanel}>
              {patterns}
            </TabsPanel>
            <TabsPanel value="stamps" className={s.tabPanel}>
              {stamps}
            </TabsPanel>
          </Tabs>
        </Dialog>
        {mixer}
      </div>
    );
  }

  // ---------------- Full: panel til høyre
  return (
    <aside className={s.panel} aria-label={t('colors.title')} onPointerDown={(e) => e.stopPropagation()}>
      <span className={s.currentBig} style={currentStyle} aria-hidden />
      {tool.tool === 'stamp' ? (
        <>
          <h3 className={s.h}>{t('colors.stamps')}</h3>
          {stamps}
        </>
      ) : (
        <Tabs defaultValue="colors" data-size="sm">
          <TabsList>
            <TabsTab value="colors">{t('colors.title')}</TabsTab>
            <TabsTab value="patterns">{t('colors.patterns')}</TabsTab>
          </TabsList>
          <TabsPanel value="colors" className={s.tabPanel}>
            <div className={s.grid} role="radiogroup" aria-label={t('colors.title')}>
              {PALETTE.map((c) => swatch(c))}
            </div>
            {(recent.length > 0 || custom.length > 0) && (
              <>
                <h3 className={s.h}>{t('colors.my')}</h3>
                <div className={s.grid} role="radiogroup" aria-label={t('colors.my')}>
                  {[...new Set([...custom, ...recent])].slice(0, 12).map((c) => swatch(c, `m${c}`))}
                </div>
              </>
            )}
            {extras}
          </TabsPanel>
          <TabsPanel value="patterns" className={s.tabPanel}>
            {patterns}
          </TabsPanel>
        </Tabs>
      )}
      {mixer}
    </aside>
  );
}
