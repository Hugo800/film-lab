import { useRef, useState } from 'react';
import { ExternalLink, FileUp, Trash2 } from 'lucide-react';
import { Button, Spinner } from './controls';
import { Dialog } from './Dialog';
import { FUJI_LUT_PAGE, importOfficialLuts } from './officialLuts';
import { describeError } from './session';
import { saveUseOfficial } from './storage';
import { useStore } from './store';

/** „Fujifilm-Originale“: die offiziellen LUTs selbst bei Fujifilm laden und hier einlesen. */
export function OfficialDialog({ onClose }: { onClose: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const keys = useStore((s) => s.officialKeys);
  const use = useStore((s) => s.useOfficial);
  const [busy, setBusy] = useState<{ fraction: number; text: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function load(files: File[]) {
    if (files.length === 0) return;
    setError(null);
    setInfo(null);
    setBusy({ fraction: 0, text: 'Start …' });
    try {
      const { luts, stored } = await importOfficialLuts(files, (fraction, text) => setBusy({ fraction, text }));
      useStore.getState().setOfficialLuts(luts, true);
      saveUseOfficial(true);
      setInfo(
        `${luts.size} ${luts.size === 1 ? 'Original' : 'Originale'} geladen.` +
          (stored ? '' : ' Dein Browser speichert nichts – die Originale gelten nur, bis du die Seite neu lädst.'),
      );
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Dialog title="Fujifilm-Originale" onClose={busy ? undefined : onClose}>
      <div className="flex flex-col gap-4 text-sm leading-relaxed">
        <p className="text-dim">
          Optional: Fujifilm bietet seine Filmsimulationen als LUT-Pakete an. Lade ein Paket selbst bei Fujifilm (z. B. „GFX ETERNA 55“, enthält Provia, Velvia, Astia,
          Classic Chrome, Reala Ace, Pro Neg. Std, Classic Neg., Eterna und Acros) und wähle die ZIP-Datei hier aus. Film Lab rechnet sie für deine JPEGs um.
          Die Dateien bleiben nur auf diesem Gerät und werden nicht hochgeladen.
        </p>
        <a
          href={FUJI_LUT_PAGE}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center gap-2 self-start text-accent underline underline-offset-2"
        >
          <ExternalLink size={16} aria-hidden />
          fujifilm-x.com: LUT-Downloads
        </a>

        <div className="flex flex-col gap-2">
          <Button variant="secondary" disabled={!!busy} onClick={() => input.current?.click()}>
            {busy ? <Spinner /> : <FileUp size={18} />}
            ZIP oder .cube wählen
          </Button>
          {busy && (
            <div className="flex flex-col gap-1.5" role="status">
              <div role="progressbar" aria-label="Fortschritt" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(busy.fraction * 100)} className="h-1.5 overflow-hidden rounded-full bg-line">
                <div className="h-full bg-accent transition-[width]" style={{ width: `${Math.round(busy.fraction * 100)}%` }} />
              </div>
              <p className="text-xs text-dim">{busy.text}</p>
            </div>
          )}
          {error && (
            <p role="alert" className="text-danger">
              {error}
            </p>
          )}
          {info && <p role="status">{info}</p>}
        </div>

        {keys.length > 0 && (
          <div className="flex flex-col gap-3 border-t border-line pt-3">
            <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3">
              <span>
                Originale verwenden
                <span className="block text-xs text-dim">{keys.length} geladen. Betrifft Fuji-Looks und Rezepte darauf.</span>
              </span>
              <input
                id="originale-verwenden"
                type="checkbox"
                role="switch"
                checked={use}
                onChange={(e) => useStore.getState().setUseOfficial(e.target.checked)}
                className="size-6 accent-[var(--color-accent)]"
              />
            </label>
            <Button variant="ghost" className="self-start text-sm" onClick={() => useStore.getState().removeOfficialLuts()}>
              <Trash2 size={16} />
              Originale von diesem Gerät entfernen
            </Button>
          </div>
        )}
      </div>
      <input
        ref={input}
        type="file"
        multiple
        accept=".zip,.cube,application/zip"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        data-testid="originale-datei"
        onChange={(e) => {
          void load(Array.from(e.target.files ?? []));
          e.target.value = '';
        }}
      />
    </Dialog>
  );
}
