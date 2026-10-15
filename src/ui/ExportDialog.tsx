import { AlertTriangle, Download, Share } from 'lucide-react';
import { Button } from './controls';
import { Dialog } from './Dialog';
import {
  canShareResults,
  cancelExport,
  closeExport,
  download,
  isTouchPrimary,
  setScope,
  shareResults,
  startExport,
} from './exporter';
import { useStore } from './store';

const mb = (bytes: number) => `${(bytes / 1_048_576).toFixed(1).replace('.', ',')} MB`;

export function ExportDialog() {
  const ex = useStore((s) => s.export);
  const photoCount = useStore((s) => s.photos.length);
  if (ex.phase === 'zu') return null;

  if (ex.phase === 'wahl') {
    return (
      <Dialog title="Exportieren" onClose={closeExport}>
        <fieldset className="mb-4 flex flex-col gap-2">
          <legend className="sr-only">Welche Fotos?</legend>
          {(['aktuell', 'alle'] as const).map((scope) => (
            <label
              key={scope}
              className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-4 ${ex.scope === scope ? 'border-accent bg-raised' : 'border-line'}`}
            >
              <input type="radio" name="umfang" className="size-4 accent-[var(--color-accent)]" checked={ex.scope === scope} onChange={() => setScope(scope)} />
              {scope === 'aktuell' ? 'Dieses Foto' : `Alle ${photoCount} Fotos`}
            </label>
          ))}
        </fieldset>
        <p className="mb-4 text-sm leading-relaxed text-dim">
          Volle Auflösung als JPEG (Qualität 92). Farbprofil und Aufnahmedaten bleiben erhalten. Mehrere Fotos werden nacheinander verarbeitet.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={closeExport}>
            Abbrechen
          </Button>
          <Button variant="primary" onClick={() => void startExport(ex.scope)}>
            Exportieren
          </Button>
        </div>
      </Dialog>
    );
  }

  if (ex.phase === 'laeuft') {
    const percent = Math.round(ex.fraction * 100);
    return (
      <Dialog title="Exportiere …">
        <p className="mb-1 truncate text-sm" title={ex.currentName}>
          {ex.currentName}
        </p>
        <p className="mb-3 text-xs text-dim">
          Foto {ex.index + 1} von {ex.total} – bitte diese Seite offen lassen.
        </p>
        <div
          role="progressbar"
          aria-label="Exportfortschritt"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          className="mb-1 h-2 overflow-hidden rounded-full bg-raised"
        >
          <div className="h-full bg-accent transition-[width] duration-200" style={{ width: `${percent}%` }} />
        </div>
        <p className="mb-4 text-right text-xs tabular-nums text-dim">{percent} %</p>
        <div className="flex justify-end">
          <Button variant="secondary" onClick={cancelExport}>
            Abbrechen
          </Button>
        </div>
      </Dialog>
    );
  }

  const n = ex.done.length;
  const total = ex.done.reduce((a, d) => a + d.bytes, 0);
  const touch = isTouchPrimary();
  const share = canShareResults();
  const title = ex.cancelled ? 'Abgebrochen' : n === 0 ? 'Export fehlgeschlagen' : 'Fertig';
  return (
    <Dialog title={title} onClose={closeExport}>
      {n > 0 && (
        <p className="mb-4 text-sm leading-relaxed text-dim">
          {n === 1 ? ex.done[0].name : `${n} Fotos`} · {mb(total)}
          {!touch && ' – der Download wurde gestartet.'}
          {ex.cancelled && ' Fertig geworden sind nur die Fotos bis zum Abbruch.'}
        </p>
      )}
      {ex.errors.length > 0 && (
        <ul className="mb-4 flex flex-col gap-1.5 rounded-xl border border-danger/40 bg-danger/10 p-3 text-sm text-danger" role="alert">
          {ex.errors.map((err) => (
            <li key={err} className="flex gap-2">
              <AlertTriangle size={16} className="mt-0.5 flex-none" />
              <span className="min-w-0 break-words">{err}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-col gap-2">
        {n > 0 && share && (
          <Button variant="primary" onClick={() => void shareResults()}>
            <Share size={18} />
            Teilen / In Fotos sichern
          </Button>
        )}
        {n > 0 && (
          <Button variant={share ? 'secondary' : 'primary'} onClick={download}>
            <Download size={18} />
            {n > 1 ? 'ZIP herunterladen' : 'Herunterladen'}
          </Button>
        )}
        <Button variant="ghost" onClick={closeExport}>
          Schließen
        </Button>
      </div>
    </Dialog>
  );
}
