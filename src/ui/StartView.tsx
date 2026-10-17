import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, ChevronDown, ImagePlus, Lock, Sparkles } from 'lucide-react';
import { Button } from './controls';
import { TRADEMARK_NOTE } from './lookRegistry';
import { zumEditor } from './route';
import { useStore } from './store';
import { beispielInEditor } from './start/beispielLaden';
import { Funktionen } from './start/Funktionen';
import { useFoto, WerkstattContext } from './start/hooks';
import { LookRad } from './start/LookRad';
import { RezeptBeispiel } from './start/RezeptBeispiel';
import { BeispielLadeanzeige, Einblenden } from './start/teile';
import { Vergleich } from './start/Vergleich';
import { createWerkstatt, type BeispielId } from './start/werkstatt';

const TITELBILD = `${import.meta.env.BASE_URL}beispiele/titel.jpg`;

export function StartView({ onPick }: { onPick: () => void }) {
  const dragging = useStore((s) => s.dragging);
  // Über das Logo im Editor hierher gekommen: die Fotos sind noch geladen.
  const fotos = useStore((s) => s.photos.length);
  // Eigene Engine für die Beispiele; startet erst beim ersten Auftrag, wird beim Wechsel in den Editor freigegeben.
  const werkstatt = useMemo(createWerkstatt, []);
  useEffect(() => () => werkstatt.dispose(), [werkstatt]);
  const [photo, setPhoto] = useState<BeispielId>('klippen');
  // Kräftiger Look zuerst: der Unterschied soll auf den ersten Blick sichtbar sein.
  const [look, setLook] = useState('kodak-kodachrome-64');
  // Öffnet die Fassung, die man gerade sieht (hochkant oder quer).
  const foto = useFoto(photo);
  const tryIt = () => void beispielInEditor(foto, look);
  const toLooks = () =>
    document.getElementById('looks-buehne')?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });

  return (
    <WerkstattContext.Provider value={werkstatt}>
      <main className="h-full overflow-x-hidden overflow-y-auto">
        <section className="flex min-h-full flex-col px-5 pt-[max(1.25rem,env(safe-area-inset-top))] pb-2 side:px-8">
          <div className="mx-auto my-auto grid w-full max-w-md gap-6 side:max-w-7xl side:grid-cols-[minmax(0,4fr)_minmax(0,6fr)] xl:grid-cols-[minmax(0,4fr)_minmax(0,7fr)] side:items-center side:gap-12 lg:gap-16">
            {/* Titelbild: vorab gerechnet (scripts/beispiele-erzeugen.mjs), die Engine startet erst weiter unten. */}
            <figure className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-raised shadow-[0_30px_80px_-30px_rgb(0_0_0/0.9)] ring-1 ring-white/5 side:order-2 side:aspect-[3/2] [@media(max-height:700px)]:aspect-[16/9] side:[@media(max-height:700px)]:aspect-[3/2]">
              <img
                src={TITELBILD}
                alt="Beispielfoto Klippen am Meer, links Original, rechts mit Velvia"
                fetchPriority="high"
                decoding="async"
                draggable={false}
                className="ueberblenden absolute inset-0 size-full object-cover"
              />
              <span className="pointer-events-none absolute top-3 left-3 rounded-full bg-black/55 px-3 py-1 text-xs font-medium tracking-wide text-white/90 backdrop-blur-md">
                Original
              </span>
              <span className="pointer-events-none absolute top-3 right-3 rounded-full bg-black/55 px-3 py-1 text-xs font-medium tracking-wide text-white backdrop-blur-md">
                Velvia
              </span>
            </figure>

            <div className="flex flex-col">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-accent">Fujifilm · Leica · Kodak</p>
              <h1 className="mt-3 text-[44px] leading-none font-semibold tracking-[-0.03em] sm:text-6xl lg:text-7xl [@media(max-height:540px)]:text-5xl">
                Film Lab
              </h1>
              <p className="mt-4 text-[17px] leading-relaxed text-pretty text-dim sm:text-lg">
                Filmlooks für deine Fotos – im Browser, in voller Auflösung.
              </p>
              <p className="mt-2 text-sm leading-relaxed text-dim/80 [@media(max-height:700px)]:hidden">
                JPEG und Sony-RAW (ARW) · mehrere Fotos auf einmal · Export mit Aufnahmedaten
              </p>
              <div className="mt-6 flex flex-col gap-2 lg:flex-row">
                <Button variant="primary" onClick={onPick} className="min-h-14 w-full text-lg lg:w-auto lg:px-8">
                  <ImagePlus size={22} />
                  Fotos wählen
                </Button>
                <Button variant="ghost" onClick={tryIt} className="w-full lg:min-h-14 lg:w-auto">
                  <Sparkles size={18} />
                  Mit Beispielfoto ausprobieren
                </Button>
              </div>
              {fotos > 0 && (
                <Button variant="ghost" onClick={zumEditor} className="mt-2 w-full lg:w-auto lg:self-start">
                  <ArrowRight size={18} />
                  Weiter bearbeiten ({fotos} {fotos === 1 ? 'Foto' : 'Fotos'})
                </Button>
              )}
              <p className="mt-5 flex gap-2.5 text-sm leading-relaxed text-dim [@media(max-height:540px)]:hidden">
                <Lock size={17} className="mt-0.5 flex-none text-accent" aria-hidden />
                <span>
                  Alles läuft in deinem Browser. Deine Fotos werden nirgends hochgeladen.
                  <span className="pointer-coarse:hidden"> Fotos einfach ins Fenster ziehen.</span>
                </span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={toLooks}
            className="mx-auto mt-3 flex min-h-11 flex-none flex-col items-center gap-0.5 px-4 text-sm text-dim transition-colors hover:text-fg"
          >
            Looks ansehen
            <ChevronDown size={20} className="wippen" aria-hidden />
          </button>
        </section>

        {/* Warmer Schein hinter dem Vergleich; die Maske blendet ihn oben weich ein (keine harte Kante am Abschnitt). */}
        <div className="relative isolate">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_80%_45%_at_50%_22%,rgb(230_180_80/0.07),transparent)] [mask-image:linear-gradient(to_bottom,transparent,black_160px)]"
          />
          <Vergleich photo={photo} onPhoto={setPhoto} look={look} onLook={setLook} onTry={tryIt} />
        </div>
        <LookRad photo={photo} onPhoto={setPhoto} />
        <Funktionen />
        <RezeptBeispiel />

        <section aria-labelledby="los-titel" className="px-5 py-16 sm:py-24">
          <Einblenden className="mx-auto flex max-w-2xl flex-col items-center text-center">
            <h2 id="los-titel" className="text-[40px] leading-[1.05] font-medium tracking-[-0.03em] text-balance sm:text-6xl">
              Jetzt deine Fotos.
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed text-dim sm:text-lg">
              JPEG oder RAW aus der Kamera wählen, Look aussuchen, exportieren. Kein Konto, kein Upload.
            </p>
            <div className="mt-8 flex w-full max-w-md flex-col gap-2.5">
              <Button variant="primary" onClick={onPick} className="min-h-14 w-full text-lg">
                <ImagePlus size={22} />
                Fotos wählen
              </Button>
              <Button variant="secondary" onClick={tryIt} className="w-full">
                <Sparkles size={18} />
                Mit Beispielfoto ausprobieren
              </Button>
            </div>
          </Einblenden>
        </section>

        <footer className="mx-auto flex max-w-md flex-col gap-1.5 border-t border-line px-5 pt-8 pb-[max(2rem,env(safe-area-inset-bottom))] text-center text-xs leading-relaxed text-dim">
          <p>{TRADEMARK_NOTE}</p>
          <p>Keine Cookies, kein Tracking. Rezepte und LUTs bleiben im Speicher dieses Browsers.</p>
        </footer>

        <BeispielLadeanzeige />

        {/* Beim Ziehen von Dateien: ganze Fläche als Ziel (App.tsx nimmt den Drop entgegen). */}
        {dragging && (
          <div className="pointer-events-none fixed inset-3 z-40 flex flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed border-accent bg-ink/80 text-lg backdrop-blur-sm">
            <ImagePlus size={36} className="text-accent" aria-hidden />
            Zum Öffnen loslassen
          </div>
        )}
      </main>
    </WerkstattContext.Provider>
  );
}
