import { useMemo, useState } from 'react';
import { findRecipeLook, parseRecipe, RECIPE_EXAMPLE } from './recipeText';
import { builtinEntries } from './lookRegistry';
import { Button } from './controls';
import { Dialog } from './Dialog';
import { useStore } from './store';

/** Rezepttext einfügen (Fuji-X-Weekly-Format), prüfen, anwenden und als eigenes Rezept speichern. */
export function RecipeDialog({ onClose }: { onClose: () => void }) {
  const [text, setText] = useState('');
  const [name, setName] = useState('');
  const [nameTouched, setNameTouched] = useState(false);
  const applyRecipe = useStore((s) => s.applyRecipe);
  const addPreset = useStore((s) => s.addPreset);
  const notify = useStore((s) => s.notify);

  const entries = useMemo(() => builtinEntries(), []);
  const parsed = useMemo(() => parseRecipe(text), [text]);
  const { look, filterIgnored } = useMemo(() => findRecipeLook(parsed, entries), [parsed, entries]);
  const skipped = [...parsed.skipped];
  if (parsed.film && !look) skipped.unshift({ line: `Film Simulation: ${parsed.film}`, reason: 'kein Look dieses Namens – der bisherige Look bleibt' });
  if (filterIgnored) skipped.push({ line: `Farbfilter ${parsed.filmFilter}`, reason: 'dazu gibt es keinen Look, es bleibt beim Look ohne Filter' });
  const usable = !!look || parsed.applied.length > 0;
  const shownName = nameTouched ? name : (parsed.title ?? '');

  const apply = () => {
    applyRecipe(look?.id ?? null, parsed.params);
  };
  const save = () => {
    const n = shownName.trim().slice(0, 40);
    if (!n) return;
    apply();
    addPreset(n);
    notify(`Rezept „${n}“ gespeichert – du findest es unter „Eigene“.`);
    onClose();
  };

  return (
    <Dialog title="Rezept einfügen" onClose={onClose}>
      <div className="flex flex-col gap-3">
        <p className="text-sm leading-relaxed text-dim">
          Füge ein Fuji-Rezept ein (englisch, wie auf Fuji X Weekly). Film Lab liest Simulation, Weißabgleich, Korn, Color Chrome und die übrigen Einstellungen.
        </p>
        <textarea
          id="rezept-text"
          aria-label="Rezepttext"
          value={text}
          rows={8}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          onChange={(e) => setText(e.target.value)}
          placeholder={RECIPE_EXAMPLE}
          className="min-h-40 w-full resize-y rounded-xl border border-line bg-ink p-3 font-mono text-base leading-snug text-fg placeholder:text-dim/50 lg:text-sm"
        />
        {text.trim() && (
          <div aria-live="polite" className="flex flex-col gap-2 text-sm">
            <p className="text-fg">
              Look: <strong className="font-medium">{look ? look.name : 'bleibt unverändert'}</strong>
            </p>
            {parsed.applied.length > 0 && (
              <ul id="rezept-erkannt" className="flex flex-wrap gap-1.5">
                {parsed.applied.map((a) => (
                  <li key={a.label} className="rounded-full bg-raised px-2.5 py-1 text-xs text-fg">
                    <span className="text-dim">{a.label}</span> {a.value}
                  </li>
                ))}
              </ul>
            )}
            {skipped.length > 0 && (
              <div id="rezept-offen" className="rounded-xl border border-line p-2.5">
                <p className="mb-1 text-xs font-medium text-dim">Nicht übernommen</p>
                <ul className="flex flex-col gap-0.5 text-xs leading-snug text-dim">
                  {skipped.map((s, i) => (
                    <li key={i}>
                      <span className="text-fg">{s.line}</span> – {s.reason}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {!usable && <p className="text-danger">Darin steht keine Einstellung, die Film Lab kennt.</p>}
          </div>
        )}
        <label className="flex flex-col gap-1.5 text-sm">
          Name zum Speichern
          <input
            id="rezept-name"
            value={shownName}
            maxLength={40}
            onChange={(e) => {
              setName(e.target.value);
              setNameTouched(true);
            }}
            placeholder="z. B. Mein Classic Chrome"
            className="min-h-11 rounded-xl border border-line bg-ink px-3 text-base text-fg placeholder:text-dim/60"
          />
        </label>
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            variant="secondary"
            disabled={!usable}
            onClick={() => {
              apply();
              onClose();
            }}
          >
            Auf dieses Foto anwenden
          </Button>
          <Button variant="primary" disabled={!usable || !shownName.trim()} onClick={save}>
            Als Rezept speichern
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
