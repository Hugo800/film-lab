import { useState, type FormEvent } from 'react';
import { Bookmark, Dices, RotateCcw } from 'lucide-react';
import type { Level } from '../types';
import { fmtPercent, fmtSigned } from './format';
import { defaultsFor, isMonochrome, NONE_ID } from './lookRegistry';
import { Button } from './controls';
import { Dialog } from './Dialog';
import { Segmented } from './Segmented';
import { Slider } from './Slider';
import { activePhoto, useStore } from './store';

type NumKey = 'strength' | 'exposure' | 'wbKelvin' | 'wbShiftR' | 'wbShiftB' | 'highlightTone' | 'shadowTone' | 'color' | 'sharpness' | 'clarity' | 'monoWarmCool' | 'monoMagentaGreen' | 'halation' | 'vignette' | 'leak';

type SegKey = 'dynamicRange' | 'grainEffect' | 'grainSize' | 'colorChrome' | 'colorChromeBlue';

interface SliderDef {
  key: NumKey;
  label: string;
  hint?: string;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
}

const int = (v: number) => fmtSigned(v, 0);
const half = (v: number) => fmtSigned(v, 1);

const slider = (key: NumKey, label: string, hint: string | undefined, min: number, max: number, step: number, format: (v: number) => string): SliderDef => ({
  key, label, hint, min, max, step, format,
});

const WB_SHIFT = [
  slider('wbShiftR', 'Verschiebung Rot', 'WB Shift R', -9, 9, 1, int),
  slider('wbShiftB', 'Verschiebung Blau', 'WB Shift B', -9, 9, 1, int),
];
const TONE = [
  slider('highlightTone', 'Lichter', 'Highlight Tone', -2, 4, 0.5, half),
  slider('shadowTone', 'Schatten', 'Shadow Tone', -2, 4, 0.5, half),
];
const COLOR = slider('color', 'Farbe', 'Color', -4, 4, 1, int);
const DETAIL = [slider('sharpness', 'Schärfe', 'Sharpness', -4, 4, 1, int), slider('clarity', 'Klarheit', 'Clarity', -5, 5, 1, int)];
const MONO = [
  slider('monoWarmCool', 'Tönung warm ↔ kalt', 'WC', -18, 18, 1, int),
  slider('monoMagentaGreen', 'Tönung Magenta ↔ Grün', 'MG', -18, 18, 1, int),
];
const EXTRAS = [
  slider('strength', 'Stärke', undefined, 0, 1, 0.01, fmtPercent),
  slider('exposure', 'Belichtung', undefined, -2, 2, 0.05, (v) => `${fmtSigned(v, 2)} EV`),
  slider('halation', 'Halation', undefined, 0, 1, 0.01, fmtPercent),
  slider('vignette', 'Vignette', undefined, 0, 1, 0.01, fmtPercent),
  slider('leak', 'Light Leak', undefined, 0, 1, 0.01, fmtPercent),
];

const WB_QUICK = [
  { value: 0, label: 'Auto' },
  { value: 5500, label: 'Tageslicht' },
  { value: 6500, label: 'Bewölkt' },
  { value: 7500, label: 'Schatten' },
  { value: 3200, label: 'Kunstlicht' },
];
const LEVELS: { value: Level; label: string }[] = [
  { value: 0, label: 'Aus' },
  { value: 1, label: 'Schwach' },
  { value: 2, label: 'Stark' },
];

function PresetDialog({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('');
  const addPreset = useStore((s) => s.addPreset);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    addPreset(name.trim().slice(0, 40));
    useStore.getState().notify(`Rezept „${name.trim()}“ gespeichert – du findest es unter „Eigene“.`);
    onClose();
  };
  return (
    <Dialog title="Als Rezept speichern" onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <p className="text-sm text-dim">Speichert Look und alle Einstellungen dieses Fotos unter „Eigene“.</p>
        <label className="flex flex-col gap-1.5 text-sm">
          Name
          <input
            autoFocus
            value={name}
            maxLength={40}
            onChange={(e) => setName(e.target.value)}
            placeholder="z. B. Sommerabend"
            className="min-h-11 rounded-xl border border-line bg-ink px-3 text-base text-fg placeholder:text-dim/60"
          />
        </label>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Abbrechen
          </Button>
          <Button variant="primary" type="submit" disabled={!name.trim()}>
            Speichern
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

function Heading({ children }: { children: string }) {
  return <h3 className="mb-0.5 mt-4 border-b border-line pb-1 text-[11px] font-medium uppercase tracking-wider text-dim first:mt-1">{children}</h3>;
}

export function Adjust() {
  const photo = useStore(activePhoto);
  const setParam = useStore((s) => s.setParam);
  const resetParam = useStore((s) => s.resetParam);
  const resetAll = useStore((s) => s.resetAll);
  const rollLeak = useStore((s) => s.rollLeak);
  const [saving, setSaving] = useState(false);
  if (!photo) return null;
  const { lookId, params } = photo.settings;
  const defaults = defaultsFor(lookId);
  const noLut = lookId === NONE_ID;
  const mono = isMonochrome(lookId);

  const renderSlider = (s: SliderDef, extra?: { disabled?: boolean }) => (
    <Slider
      key={s.key}
      id={`regler-${s.key}`}
      label={s.label}
      hint={s.hint}
      value={params[s.key]}
      defaultValue={defaults[s.key]}
      min={s.min}
      max={s.max}
      step={s.step}
      format={s.format}
      disabled={extra?.disabled}
      onChange={(v) => setParam(s.key, v)}
      onReset={() => resetParam(s.key)}
    />
  );

  // Segmentwahl für einen Parameter; die Optionen passen zum Typ des Parameters.
  const segmented = (key: SegKey, label: string, hint: string, options: { value: string | number; label: string }[], disabled?: boolean) => (
    <Segmented
      id={`regler-${key}`}
      label={label}
      hint={hint}
      options={options}
      value={params[key]}
      defaultValue={defaults[key]}
      disabled={disabled}
      onChange={(v) => setParam(key, v as never)}
      onReset={() => resetParam(key)}
    />
  );

  const kelvinLabel = (v: number) => (params.wbKelvin === 0 ? 'Auto' : `${v} K`);

  return (
    <div className="px-4 pb-4 pt-1 lg:px-4">
      <Heading>Weißabgleich</Heading>
      <Segmented
        id="regler-wbQuick"
        label="Weißabgleich"
        hint="White Balance"
        wrap
        noReset
        options={WB_QUICK}
        value={params.wbKelvin}
        defaultValue={defaults.wbKelvin}
        onChange={(v) => setParam('wbKelvin', v)}
        onReset={() => resetParam('wbKelvin')}
      />
      <Slider
        id="regler-wbKelvin"
        label="Farbtemperatur"
        hint="Kelvin"
        value={params.wbKelvin || 5500}
        defaultValue={defaults.wbKelvin || 5500}
        changed={params.wbKelvin !== defaults.wbKelvin}
        min={2500}
        max={10000}
        step={50}
        format={kelvinLabel}
        onChange={(v) => setParam('wbKelvin', v)}
        onReset={() => resetParam('wbKelvin')}
      />
      {WB_SHIFT.map((s) => renderSlider(s))}

      <Heading>Bildeinstellungen</Heading>
      {segmented('dynamicRange', 'Dynamikbereich', 'Dynamic Range', [
        { value: 100, label: 'DR100' },
        { value: 200, label: 'DR200' },
        { value: 400, label: 'DR400' },
      ])}
      {TONE.map((s) => renderSlider(s))}
      {mono ? MONO.map((s) => renderSlider(s)) : renderSlider(COLOR)}
      {DETAIL.map((s) => renderSlider(s))}

      <Heading>Körnung und Farbeffekte</Heading>
      {segmented('grainEffect', 'Körnung', 'Grain Effect', LEVELS)}
      {segmented(
        'grainSize',
        'Korngröße',
        'Grain Size',
        [
          { value: 'klein', label: 'Klein' },
          { value: 'gross', label: 'Groß' },
        ],
        params.grainEffect === 0,
      )}
      {!mono && segmented('colorChrome', 'Color Chrome', 'Color Chrome Effect', LEVELS)}
      {!mono && segmented('colorChromeBlue', 'Color Chrome FX Blau', 'Color Chrome FX Blue', LEVELS)}

      <Heading>Extras</Heading>
      {EXTRAS.map((s) => (
        <div key={s.key}>
          {renderSlider(s, { disabled: s.key === 'strength' && noLut })}
          {s.key === 'leak' && (
            <div className="-mt-1 mb-1">
              <Button variant="ghost" className="min-h-11 px-3 text-sm" onClick={rollLeak} disabled={params.leak === 0} aria-label="Light Leaks neu würfeln">
                <Dices size={18} />
                Neu würfeln
              </Button>
            </div>
          )}
        </div>
      ))}

      <div className="mt-2 flex flex-wrap gap-2 border-t border-line pt-3">
        <Button variant="secondary" onClick={resetAll} className="text-sm">
          <RotateCcw size={16} />
          Zurücksetzen
        </Button>
        <Button variant="secondary" onClick={() => setSaving(true)} className="text-sm">
          <Bookmark size={16} />
          Als Rezept speichern
        </Button>
      </div>
      {saving && <PresetDialog onClose={() => setSaving(false)} />}
    </div>
  );
}
