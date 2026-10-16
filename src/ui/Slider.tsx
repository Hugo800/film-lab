import { useRef } from 'react';
import { RotateCcw } from 'lucide-react';

interface Props {
  id: string;
  label: string;
  /** Fuji-Begriff, klein hinter dem Namen. */
  hint?: string;
  value: number;
  defaultValue: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
  onReset: () => void;
  disabled?: boolean;
  /** Überschreibt den Vergleich mit dem Standardwert (z. B. Weißabgleich „Auto“ gegen Regler 5500 K). */
  changed?: boolean;
}

/** Füllung der Spur: von links, bei Reglern mit Mitte (min < 0) von der Mitte aus. */
function track(value: number, min: number, max: number): string {
  const pct = (v: number) => ((v - min) / (max - min)) * 100;
  const [a, b] = min < 0 ? [Math.min(pct(0), pct(value)), Math.max(pct(0), pct(value))] : [0, pct(value)];
  return `linear-gradient(90deg, var(--color-line) ${a}%, var(--color-accent) ${a}%, var(--color-accent) ${b}%, var(--color-line) ${b}%)`;
}

export function Slider({ id, label, hint, value, defaultValue, min, max, step, format, onChange, onReset, disabled, changed: changedProp }: Props) {
  const lastTap = useRef(0);
  const changed = changedProp ?? Math.abs(value - defaultValue) > step / 2;

  // Doppeltipp auf Name oder Wert setzt zurück; auf dem Regler selbst bliebe er beim Ziehen im Weg.
  const onTap = () => {
    const now = Date.now();
    if (now - lastTap.current < 350) onReset();
    lastTap.current = now;
  };

  return (
    <div className="grid grid-cols-[1fr_44px] items-center">
      <div>
        <div className="flex items-baseline justify-between pr-1 select-none" onPointerUp={onTap}>
          <label htmlFor={id} className="text-sm text-fg">
            {label}
            {hint && <span className="ml-1.5 text-xs text-dim">({hint})</span>}
          </label>
          <output htmlFor={id} className={`text-[13px] tabular-nums ${changed ? 'text-accent' : 'text-dim'}`}>
            {format(value)}
          </output>
        </div>
        <input
          id={id}
          className="regler"
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          style={{ '--track': track(value, min, max) } as React.CSSProperties}
          onChange={(e) => onChange(Number(e.target.value))}
          onDoubleClick={(e) => e.preventDefault()}
        />
      </div>
      <button
        type="button"
        aria-label={`${label} zurücksetzen`}
        title="Auf Look-Standard zurücksetzen (Doppeltipp auf den Namen)"
        disabled={!changed || disabled}
        onClick={onReset}
        className="inline-flex size-11 items-center justify-center rounded-full text-dim hover:bg-raised hover:text-fg disabled:opacity-20"
      >
        <RotateCcw size={16} />
      </button>
    </div>
  );
}
