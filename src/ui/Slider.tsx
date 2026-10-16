import { useRef } from 'react';
import { RotateCcw } from 'lucide-react';

interface Props {
  id: string;
  label: string;
  /** Fujifilm-Begriff, klein hinter dem Namen. */
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
  /** Markierung auf der Spur, z. B. „Rezept“ bei der Vorgabe des Stärke-Reglers. */
  mark?: { value: number; label: string };
}

/** Füllung der Spur: von links, bei Reglern mit Mitte (min < 0) von der Mitte aus. */
function track(value: number, min: number, max: number): string {
  const pct = (v: number) => ((v - min) / (max - min)) * 100;
  const [a, b] = min < 0 ? [Math.min(pct(0), pct(value)), Math.max(pct(0), pct(value))] : [0, pct(value)];
  return `linear-gradient(90deg, var(--color-line) ${a}%, var(--color-accent) ${a}%, var(--color-accent) ${b}%, var(--color-line) ${b}%)`;
}

/** Mitte des Reglerknopfs (24 px, siehe .regler in index.css) beim Wert v. */
function thumbCenter(v: number, min: number, max: number): string {
  return `calc(12px + (100% - 24px) * ${(v - min) / (max - min)})`;
}

export function Slider({ id, label, hint, value, defaultValue, min, max, step, format, onChange, onReset, disabled, changed: changedProp, mark }: Props) {
  const lastTap = useRef(0);
  const changed = changedProp ?? Math.abs(value - defaultValue) > step / 2;

  // Doppeltipp auf Name oder Wert setzt zurück; auf dem Regler selbst bliebe er beim Ziehen im Weg.
  const onTap = () => {
    const now = Date.now();
    if (now - lastTap.current < 350) onReset();
    lastTap.current = now;
  };

  return (
    <div className="grid grid-cols-[1fr_44px] items-end">
      <div>
        <div className="flex items-baseline justify-between pr-1 select-none" onPointerUp={onTap}>
          <label htmlFor={id} className="text-sm text-fg">
            {label}
            {hint && <span className="ml-1.5 text-xs text-dim/70">{hint}</span>}
          </label>
          <output htmlFor={id} className={`text-[13px] tabular-nums ${changed ? 'text-accent' : 'text-dim'}`}>
            {format(value)}
          </output>
        </div>
        <div className="relative">
          {mark && (
            // Vor dem Regler im DOM: Spur und Knopf liegen darüber, der Strich ragt oben und unten heraus.
            <span
              aria-hidden
              className="pointer-events-none absolute top-1/2 h-3 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-dim"
              style={{ left: thumbCenter(mark.value, min, max) }}
            />
          )}
          <input
            id={id}
            className="regler relative block"
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
        {mark && (
          <div className="relative mt-1 h-3 select-none" data-marke={mark.label}>
            <span
              className="absolute -translate-x-1/2 text-[10px] leading-3 text-dim"
              style={{ left: thumbCenter(mark.value, min, max) }}
            >
              {mark.label}
            </span>
          </div>
        )}
      </div>
      <button
        type="button"
        aria-label={`${label} zurücksetzen`}
        title="Auf Look-Standard zurücksetzen (Doppeltipp auf den Namen)"
        disabled={!changed || disabled}
        onClick={onReset}
        // Mit Markierung steht unter dem Regler noch deren Beschriftung (mt-1 + h-3): Knopf bleibt auf Höhe der Spur.
        className={`${mark ? 'mb-3' : '-mb-1'} inline-flex size-11 items-center justify-center rounded-full text-dim hover:bg-raised hover:text-fg disabled:invisible`}
      >
        <RotateCcw size={16} />
      </button>
    </div>
  );
}
