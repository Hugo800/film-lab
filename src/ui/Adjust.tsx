import { useState, type FormEvent } from 'react';
import { Bookmark, Dices, RotateCcw } from 'lucide-react';
import type { LookParams } from '../types';
import { defaultsFor, NONE_ID } from './lookRegistry';
import { Button } from './controls';
import { Dialog } from './Dialog';
import { Slider } from './Slider';
import { activePhoto, useStore } from './store';

type NumKey = Exclude<keyof LookParams, 'leakSeed'>;

const pct = (v: number) => `${Math.round(v * 100)} %`;
const signed = (v: number) => `${v > 0 ? '+' : ''}${Math.round(v * 100)}`;

const SLIDERS: { key: NumKey; label: string; min: number; max: number; step: number; format: (v: number) => string }[] = [
  { key: 'strength', label: 'Stärke', min: 0, max: 1, step: 0.01, format: pct },
  { key: 'exposure', label: 'Belichtung', min: -2, max: 2, step: 0.05, format: (v) => `${v > 0 ? '+' : ''}${v.toFixed(2)} EV` },
  { key: 'temperature', label: 'Temperatur', min: -1, max: 1, step: 0.01, format: signed },
  { key: 'tint', label: 'Tönung', min: -1, max: 1, step: 0.01, format: signed },
  { key: 'grain', label: 'Korn', min: 0, max: 1, step: 0.01, format: pct },
  { key: 'grainSize', label: 'Korngröße', min: 0.5, max: 3, step: 0.05, format: (v) => `${v.toFixed(2)}×` },
  { key: 'halation', label: 'Halation', min: 0, max: 1, step: 0.01, format: pct },
  { key: 'vignette', label: 'Vignette', min: 0, max: 1, step: 0.01, format: pct },
  { key: 'leak', label: 'Light Leak', min: 0, max: 1, step: 0.01, format: pct },
];

function PresetDialog({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('');
  const addPreset = useStore((s) => s.addPreset);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    addPreset(name.trim().slice(0, 40));
    useStore.getState().notify(`Preset „${name.trim()}“ gespeichert – du findest es unter „Eigene“.`);
    onClose();
  };
  return (
    <Dialog title="Als Preset speichern" onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <p className="text-sm text-dim">Speichert Look und alle Regler dieses Fotos unter „Eigene“.</p>
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

  return (
    <div className="px-4 pb-4 pt-1 lg:px-4">
      <div className="flex flex-col">
        {SLIDERS.map((s) => (
          <div key={s.key}>
            <Slider
              id={`regler-${s.key}`}
              label={s.label}
              value={params[s.key]}
              defaultValue={defaults[s.key]}
              min={s.min}
              max={s.max}
              step={s.step}
              format={s.format}
              disabled={s.key === 'strength' && noLut}
              onChange={(v) => setParam(s.key, v)}
              onReset={() => resetParam(s.key)}
            />
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
      </div>
      <div className="mt-2 flex flex-wrap gap-2 border-t border-line pt-3">
        <Button variant="secondary" onClick={resetAll} className="text-sm">
          <RotateCcw size={16} />
          Zurücksetzen
        </Button>
        <Button variant="secondary" onClick={() => setSaving(true)} className="text-sm">
          <Bookmark size={16} />
          Als Preset speichern
        </Button>
      </div>
      {saving && <PresetDialog onClose={() => setSaving(false)} />}
    </div>
  );
}
