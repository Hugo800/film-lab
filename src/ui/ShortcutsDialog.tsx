import { Dialog } from './Dialog';

/** „⌘“ am Mac, sonst „Strg+“. */
const MOD = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Strg+';

const KEYS: [string, string][] = [
  ['← / →', 'Foto zurück / vor'],
  ['↑ / ↓', 'Look zurück / vor'],
  ['Leertaste oder \\ halten', 'Original zeigen'],
  ['B', 'Vorher/Nachher-Teiler'],
  ['Z oder Doppelklick', '100 % ein/aus'],
  [`${MOD}Mausrad`, '100 % am Mauszeiger'],
  ['Esc', '100 % verlassen'],
  [`${MOD}E`, 'Exportieren'],
  ['Entf', 'Foto entfernen'],
  [`${MOD}Z`, 'Rückgängig'],
  ['?', 'Diese Übersicht'],
];

export function ShortcutsDialog({ onClose }: { onClose: () => void }) {
  return (
    <Dialog title="Tastenkürzel" onClose={onClose}>
      <dl className="grid grid-cols-[auto_1fr] gap-x-5 gap-y-2.5 text-sm">
        {KEYS.map(([key, what]) => (
          <div key={key} className="contents">
            <dt className="text-right">
              <kbd className="rounded-md border border-line bg-raised px-1.5 py-0.5 font-sans text-xs text-fg">{key}</kbd>
            </dt>
            <dd className="text-dim">{what}</dd>
          </div>
        ))}
      </dl>
    </Dialog>
  );
}
