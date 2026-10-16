import { RotateCcw } from 'lucide-react';

interface Option<T> {
  value: T;
  label: string;
}

interface Props<T extends string | number> {
  id: string;
  label: string;
  /** Fujifilm-Begriff, klein hinter dem Namen. */
  hint?: string;
  options: Option<T>[];
  /** Wert, der zu keiner Option passt, markiert nichts. */
  value: T;
  defaultValue: T;
  onChange: (v: T) => void;
  onReset: () => void;
  disabled?: boolean;
  /** Umbrechende Chips statt gleich breiter Segmente (Schnellwahl). */
  wrap?: boolean;
  /** Name nur für Screenreader (eine Überschrift darüber nennt ihn schon). */
  hideLabel?: boolean;
  /** Ohne eigenen Zurücksetzen-Knopf (ein anderer Regler setzt denselben Wert zurück). */
  noReset?: boolean;
}

/** Auswahl aus wenigen Stufen wie im Kameramenü; Zurücksetzen auf den Look-Standard wie beim Regler. */
export function Segmented<T extends string | number>({ id, label, hint, options, value, defaultValue, onChange, onReset, disabled, wrap, hideLabel, noReset }: Props<T>) {
  const changed = value !== defaultValue;
  return (
    <div className="grid grid-cols-[1fr_44px] items-center py-1">
      <div>
        <div id={`${id}-name`} className={hideLabel ? 'sr-only' : 'mb-1 text-sm text-fg select-none'}>
          {label}
          {hint && <span className="ml-1.5 text-xs text-dim/70">{hint}</span>}
        </div>
        <div
          id={id}
          role="radiogroup"
          aria-labelledby={`${id}-name`}
          aria-disabled={disabled}
          className={wrap ? 'flex flex-wrap gap-1.5' : 'flex rounded-xl bg-raised p-0.5'}
        >
          {options.map((o) => {
            const on = o.value === value;
            return (
              <button
                key={String(o.value)}
                type="button"
                role="radio"
                aria-checked={on}
                disabled={disabled}
                onClick={() => onChange(o.value)}
                className={`min-h-11 text-[13px] transition disabled:opacity-40 ${
                  wrap ? 'rounded-full px-3' : 'flex-1 rounded-[10px] px-1'
                } ${on ? 'bg-fg font-medium text-ink' : `text-dim hover:text-fg ${wrap ? 'ring-1 ring-line' : ''}`}`}
              >
                {o.label}
              </button>
            );
          })}
        </div>
      </div>
      {!noReset && <button
        type="button"
        aria-label={`${label} zurücksetzen`}
        title="Auf Look-Standard zurücksetzen"
        disabled={!changed || disabled}
        onClick={onReset}
        className="inline-flex size-11 items-center justify-center self-end mb-0.5 rounded-full text-dim hover:bg-raised hover:text-fg disabled:invisible"
      >
        <RotateCcw size={16} />
      </button>}
    </div>
  );
}
