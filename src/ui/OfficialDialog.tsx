import { useMemo, useRef, useState, type ReactNode } from 'react';
import { ExternalLink, FileUp, Trash2 } from 'lucide-react';
import { Button, Spinner } from './controls';
import { Dialog } from './Dialog';
import { builtinEntries, TRADEMARK_NOTE } from './lookRegistry';
import { FUJI_LUT_PAGE, importOfficialLuts } from './officialLuts';
import { describeError } from './session';
import { saveUseOfficial } from './storage';
import { useStore } from './store';

/** „Fujifilm-LUTs“: die offiziellen LUTs selbst bei Fujifilm laden und hier einlesen. */
function Step({ n, children }: { n: number; children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span aria-hidden className="flex size-6 flex-none items-center justify-center rounded-full bg-raised text-xs font-medium text-fg">
        {n}
      </span>
      <div className="flex min-w-0 flex-1 flex-col items-start pt-px">{children}</div>
    </li>
  );
}

export function OfficialDialog({ onClose }: { onClose: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const keys = useStore((s) => s.officialKeys);
  const use = useStore((s) => s.useOfficial);
  const [busy, setBusy] = useState<{ fraction: number; text: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const fuji = useMemo(() => builtinEntries().filter((e) => e.category === 'fujifilm'), []);
  const real = fuji.filter((e) => e.officialKey && keys.includes(e.officialKey));
  const fitted = fuji.filter((e) => !real.includes(e));

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
        `${luts.size} ${luts.size === 1 ? 'Fujifilm-LUT' : 'Fujifilm-LUTs'} geladen.` +
          (stored ? '' : ' Dein Browser speichert nichts – sie gelten nur, bis du die Seite neu lädst.'),
      );
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Dialog title="Fujifilm-LUTs" onClose={busy ? undefined : onClose}>
      <div className="flex flex-col gap-4 text-sm leading-relaxed">
        <p className="text-dim">
          Mit den LUTs von Fujifilm rechnet Film Lab die Looks näher am Original statt nur nachempfunden.
        </p>
        <ol className="flex flex-col gap-3">
          <Step n={1}>
            Download-Seite von Fujifilm öffnen:
            <a
              href={FUJI_LUT_PAGE}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center gap-1.5 text-accent underline underline-offset-2"
            >
              fujifilm-x.com: LUT-Downloads
              <ExternalLink size={14} aria-hidden />
            </a>
          </Step>
          <Step n={2}>Dort das Paket „GFX ETERNA 55“ laden.</Step>
          <Step n={3}>
            Die ZIP-Datei hier wählen oder ins Fenster ziehen.
            <span className="block text-xs text-dim">Auf dem iPhone landet sie in der Dateien-App.</span>
          </Step>
        </ol>

        <div className="flex flex-col gap-2">
          <Button variant="secondary" data-autofocus disabled={!!busy} onClick={() => input.current?.click()}>
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
          <p className="text-xs text-dim">Die Dateien bleiben nur auf diesem Gerät und werden nicht hochgeladen.</p>
        </div>

        {keys.length > 0 && (
          <div className="flex flex-col gap-3 border-t border-line pt-3">
            <dl className="flex flex-col gap-2 text-xs leading-relaxed">
              <div>
                <dt className="font-medium text-fg">Echt ({real.length})</dt>
                <dd className="text-dim">{real.map((e) => e.name).join(', ') || '–'}</dd>
              </div>
              <div>
                <dt className="font-medium text-fg">Weiter nachempfunden ({fitted.length})</dt>
                <dd className="text-dim">{fitted.map((e) => e.name).join(', ') || '–'}</dd>
              </div>
            </dl>
            <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3">
              <span>
                Fujifilm-LUTs verwenden
                <span className="block text-xs text-dim">{keys.length} geladen. Betrifft Fujifilm-Looks und Rezepte darauf.</span>
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
              LUTs von diesem Gerät entfernen
            </Button>
          </div>
        )}
        <p className="text-xs leading-relaxed text-dim">{TRADEMARK_NOTE}</p>
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
