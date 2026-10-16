import { AlertTriangle, Download, Share } from 'lucide-react';
import { Button } from './controls';
import { Dialog } from './Dialog';
import {
  canShareResults,
  cancelExport,
  closeExport,
  download,
  isIos,
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
      <Dialog
        title="Exportieren"
        onClose={closeExport}
        footer={
          <>
            <Button variant="primary" type="submit" form="export-form">
              Exportieren
            </Button>
            <Button variant="ghost" onClick={closeExport}>
              Abbrechen
            </Button>
          </>
        }
      >
        <form
          id="export-form"
          onSubmit={(e) => {
            e.preventDefault();
            void startExport(ex.scope);
          }}
        >
          <fieldset className="mb-4 flex flex-col gap-2">
            <legend className="sr-only">Welche Fotos?</legend>
            {(['aktuell', 'alle'] as const).map((scope) => (
              <label
                key={scope}
                className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-4 ${ex.scope === scope ? 'border-accent bg-raised' : 'border-line'}`}
              >
                <input
                  type="radio"
                  name="umfang"
                  data-autofocus={ex.scope === scope ? '' : undefined}
                  className="size-4 accent-[var(--color-accent)]"
                  checked={ex.scope === scope}
                  onChange={() => setScope(scope)}
                />
                {scope === 'aktuell' ? 'Dieses Foto' : `Alle ${photoCount} Fotos`}
              </label>
            ))}
          </fieldset>
          <p className="text-sm leading-relaxed text-dim">
            Volle Auflösung als JPEG (Qualität 92, sRGB). Aufnahmedaten bleiben erhalten. Mehrere Fotos werden nacheinander verarbeitet.
          </p>
        </form>
      </Dialog>
    );
  }

  if (ex.phase === 'laeuft') {
    const percent = Math.round(ex.fraction * 100);
    return (
      <Dialog
        title="Exportiere …"
        footer={
          <Button variant="secondary" onClick={cancelExport}>
            Abbrechen
          </Button>
        }
      >
        {/* Eigener key: React verwendet den Absatz sonst in der Fertig-Phase wieder, der Fokus fiele auf body. */}
        <p key="laeuft" tabIndex={-1} data-autofocus className="mb-1 truncate text-sm outline-none" title={ex.currentName}>
          {ex.currentName}
        </p>
        <p className="mb-3 text-xs leading-relaxed text-dim">
          Foto {ex.index + 1} von {ex.total} –{' '}
          {isTouchPrimary() ? 'Bildschirm anlassen und in Film Lab bleiben – sonst bricht der Export ab.' : 'bitte diese Seite offen lassen.'}
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
        <p className="text-right text-xs tabular-nums text-dim">{percent} %</p>
      </Dialog>
    );
  }

  const n = ex.done.length;
  const total = ex.done.reduce((a, d) => a + d.bytes, 0);
  const touch = isTouchPrimary();
  const share = canShareResults();
  // Am PC startet der Download von selbst (außer nach einem Abbruch); dann ist „Schließen“ der nächste Schritt.
  const downloaded = !touch && !ex.cancelled;
  const title = ex.cancelled ? 'Export abgebrochen' : n === 0 ? 'Export fehlgeschlagen' : 'Export fertig';
  const downloadLabel = n > 1 ? 'ZIP herunterladen' : 'Herunterladen';
  const downloadButton = (variant: 'primary' | 'secondary', label: string) => (
    <Button variant={variant} data-autofocus={variant === 'primary' ? '' : undefined} onClick={download}>
      <Download size={18} />
      {label}
    </Button>
  );
  const closeButton = (variant: 'primary' | 'ghost') => (
    <Button variant={variant} data-autofocus={variant === 'primary' ? '' : undefined} onClick={closeExport}>
      Schließen
    </Button>
  );
  return (
    <Dialog
      title={title}
      onClose={closeExport}
      footer={
        n > 0 && share ? (
          <>
            <Button variant="primary" data-autofocus onClick={() => void shareResults()}>
              <Share size={18} />
              Teilen / In Fotos sichern
            </Button>
            {downloadButton('secondary', downloadLabel)}
            {closeButton('ghost')}
          </>
        ) : n > 0 && downloaded ? (
          <>
            {closeButton('primary')}
            {downloadButton('secondary', n > 1 ? 'ZIP erneut herunterladen' : 'Erneut herunterladen')}
          </>
        ) : n > 0 ? (
          <>
            {downloadButton('primary', downloadLabel)}
            {closeButton('ghost')}
          </>
        ) : (
          closeButton('primary')
        )
      }
    >
      {n > 0 && (
        <p className="mb-4 text-sm leading-relaxed text-dim">
          {n === 1 ? ex.done[0].name : `${n} Fotos`} · {mb(total)}
          {downloaded && ' – der Download wurde gestartet.'}
          {ex.cancelled && ' Fertig geworden sind nur die Fotos bis zum Abbruch.'}
        </p>
      )}
      {n > 0 && share && isIos() && <p className="mb-4 text-sm leading-relaxed">Im Teilen-Menü „Bild sichern“ wählen.</p>}
      {ex.errors.length > 0 && (
        <ul className="mb-1 flex flex-col gap-1.5 rounded-xl border border-danger/40 bg-danger/10 p-3 text-sm text-danger" role="alert">
          {ex.errors.map((err) => (
            <li key={err} className="flex gap-2">
              <AlertTriangle size={16} className="mt-0.5 flex-none" />
              <span className="min-w-0 break-words">{err}</span>
            </li>
          ))}
        </ul>
      )}
    </Dialog>
  );
}
