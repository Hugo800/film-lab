import { useEffect, useMemo, useState, type MouseEvent } from 'react';
import { ArrowRight, ImagePlus, Lock, Sparkles } from 'lucide-react';
import { Button } from './controls';
import { builtinEntries, TRADEMARK_NOTE } from './lookRegistry';
import { zumEditor } from './route';
import { useStore } from './store';
import { AppHinweis } from './start/AppHinweis';
import { beispielInEditor } from './start/beispielLaden';
import { Funktionen } from './start/Funktionen';
import { useFoto, WerkstattContext } from './start/hooks';
import { LookRad } from './start/LookRad';
import { RezeptBeispiel } from './start/RezeptBeispiel';
import { BeispielLadeanzeige, Einblenden, Filmstreifen, SPALTE } from './start/teile';
import { createWerkstatt, type BeispielId } from './start/werkstatt';

const BASE = import.meta.env.BASE_URL;
// Titelbilder vorab gerechnet (scripts/beispiele-erzeugen.mjs), die Engine startet erst weiter unten.
const TITEL = `${BASE}beispiele/titel.jpg`;
const TITEL_HOCH = `${BASE}beispiele/titel-hoch.jpg`;
/** Wie die Variante „hoch“ in index.css: Handy hochkant bekommt das Titelbild hochkant. */
const HOCH = '(orientation: portrait) and (width < 40rem)';
const TITEL_LOOK = 'velvia';

const ABSCHNITTE = [
  ['alle-looks', 'Looks'],
  ['funktionen', 'Funktionen'],
  ['rezepte', 'Rezepte'],
  ['app', 'App'],
] as const;

/** Sprung zu einem Abschnitt im scrollenden <main>, ohne die Adresse zu ändern. */
function springen(e: MouseEvent<HTMLAnchorElement>) {
  e.preventDefault();
  const ziel = document.getElementById(e.currentTarget.hash.slice(1));
  ziel?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
}

export function StartView({ onPick }: { onPick: () => void }) {
  const dragging = useStore((s) => s.dragging);
  // Über das Logo im Editor hierher gekommen: die Fotos sind noch geladen.
  const fotos = useStore((s) => s.photos.length);
  // Eigene Engine für die Beispiele; startet erst beim ersten Auftrag, wird beim Wechsel in den Editor freigegeben.
  const werkstatt = useMemo(createWerkstatt, []);
  useEffect(() => () => werkstatt.dispose(), [werkstatt]);
  const [photo, setPhoto] = useState<BeispielId>('klippen');
  const total = builtinEntries().length;
  // Öffnet das Titelfoto in der Fassung, die man sieht (hochkant oder quer), mit dem Look des Titelbilds.
  const titelFoto = useFoto('klippen');
  const tryIt = () => void beispielInEditor(titelFoto, TITEL_LOOK);

  return (
    <WerkstattContext.Provider value={werkstatt}>
      <main className="isolate h-full overflow-x-hidden overflow-y-auto">
        <div aria-hidden className="korn pointer-events-none fixed inset-0 -z-10" />

        {/* Füllt den ersten Bildschirm: Das Look-Rad beginnt darunter, seine Fotos und die Engine laden erst beim Scrollen. */}
        <section className="flex min-h-full flex-col px-5 pt-[env(safe-area-inset-top)] side:px-8">
          <header className="mx-auto flex h-16 w-full max-w-6xl flex-none items-center justify-between [@media(max-height:540px)]:h-12">
            {/* Nur das Zeichen: Der Name steht gleich darunter groß. */}
            <img src={`${BASE}favicon.svg`} alt="Film Lab" className="size-8" />
            <nav aria-label="Abschnitte" className="flex items-center gap-1 text-sm text-dim">
              {ABSCHNITTE.map(([id, name]) => (
                <a key={id} href={`#${id}`} onClick={springen} className="hidden rounded-lg px-3 py-2 transition-colors hover:text-fg sm:block">
                  {name}
                </a>
              ))}
              <a
                href="#app"
                onClick={springen}
                className="flex min-h-9 items-center rounded-full border border-line px-3.5 font-mono text-[11px] tracking-[0.14em] text-fg uppercase sm:hidden"
              >
                Als App
              </a>
            </nav>
          </header>

          <div className="mx-auto my-auto grid w-full max-w-6xl gap-7 pt-2 pb-10 side:grid-cols-[minmax(0,6fr)_minmax(0,7fr)] side:items-center side:gap-12 side:py-12 lg:gap-16 [@media(max-height:540px)]:side:py-3">
            <Filmstreifen
              className="side:order-2"
              bild="aspect-[3/2] hoch:aspect-auto hoch:h-[min(38svh,110vw)]"
              oben={
                <>
                  <span>FILM LAB 400</span>
                  <span>▸ 12</span>
                </>
              }
              unten={
                <>
                  <span>12A</span>
                  <span>▸ 13</span>
                </>
              }
            >
              <picture>
                <source media={HOCH} srcSet={TITEL_HOCH} />
                <img
                  src={TITEL}
                  alt="Beispielfoto Klippen am Meer, links Original, rechts mit Velvia"
                  fetchPriority="high"
                  decoding="async"
                  draggable={false}
                  className="ueberblenden absolute inset-0 size-full object-cover object-[50%_60%]"
                />
              </picture>
              <span className="pointer-events-none absolute top-3 left-3 rounded-sm bg-black/55 px-2 py-1 font-mono text-[10px] tracking-[0.16em] text-white/85 uppercase backdrop-blur-md">
                Original
              </span>
              <span className="pointer-events-none absolute top-3 right-3 rounded-sm bg-black/55 px-2 py-1 font-mono text-[10px] tracking-[0.16em] text-white uppercase backdrop-blur-md">
                Velvia
              </span>
            </Filmstreifen>

            <div className="flex flex-col">
              <p className="font-mono text-[11px] tracking-[0.2em] text-accent uppercase">Fujifilm · Leica · Kodak · Ricoh</p>
              <h1 className="mt-3 text-[52px] leading-none font-medium tracking-[-0.045em] sm:mt-4 sm:text-7xl lg:text-8xl [@media(max-height:540px)]:text-5xl">
                Film Lab
              </h1>
              <p className="mt-3 text-[22px] leading-tight tracking-[-0.02em] text-balance sm:mt-4 sm:text-3xl [@media(max-height:540px)]:text-xl">
                Die Dunkelkammer für deine Fotos.
              </p>
              <p className="mt-3 max-w-md text-[15px] leading-relaxed text-pretty text-dim sm:mt-5 sm:text-lg [@media(max-height:700px)]:hidden">
                {total} Filmlooks für JPEG und RAW – entwickelt im Browser, in voller Auflösung. Ohne Upload, ohne Konto.
              </p>
              <div className="mt-6 flex flex-col gap-2 sm:mt-8 xl:flex-row [@media(max-height:540px)]:mt-5 [@media(max-height:540px)]:flex-row">
                <Button variant="primary" onClick={onPick} className="min-h-14 w-full text-lg whitespace-nowrap xl:w-auto xl:px-8 [@media(max-height:540px)]:min-h-12 [@media(max-height:540px)]:w-auto [@media(max-height:540px)]:px-6">
                  <ImagePlus size={22} />
                  Fotos wählen
                </Button>
                <Button variant="ghost" onClick={tryIt} className="w-full whitespace-nowrap xl:min-h-14 xl:w-auto [@media(max-height:540px)]:w-auto">
                  <Sparkles size={18} />
                  Mit Beispielfoto ausprobieren
                </Button>
              </div>
              {fotos > 0 && (
                <Button variant="ghost" onClick={zumEditor} className="mt-2 w-full xl:w-auto xl:self-start">
                  <ArrowRight size={18} />
                  Weiter bearbeiten ({fotos} {fotos === 1 ? 'Foto' : 'Fotos'})
                </Button>
              )}
              <p className="mt-5 flex gap-2.5 text-sm leading-relaxed text-dim sm:mt-6 [@media(max-height:540px)]:hidden">
                <Lock size={16} className="mt-0.5 flex-none text-accent" aria-hidden />
                <span>
                  Alles läuft in deinem Browser, deine Fotos bleiben auf dem Gerät.
                  <span className="pointer-coarse:hidden"> Fotos einfach ins Fenster ziehen.</span>
                </span>
              </p>
            </div>
          </div>
        </section>

        <LookRad photo={photo} onPhoto={setPhoto} />
        <Funktionen />
        <RezeptBeispiel />
        <AppHinweis />

        <section aria-labelledby="los-titel" className="px-5 py-20 sm:py-28">
          <Einblenden className="mx-auto flex max-w-2xl flex-col items-center text-center">
            <p className="font-mono text-[11px] tracking-[0.2em] text-accent uppercase">▸ Entwickeln</p>
            <h2 id="los-titel" className="mt-5 text-[40px] leading-[1.05] font-medium tracking-[-0.03em] text-balance sm:text-6xl">
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

        <footer className="px-5 pb-[max(2rem,env(safe-area-inset-bottom))]">
          <div className={`${SPALTE} flex flex-col gap-1.5 border-t border-line pt-8 font-mono text-[11px] leading-relaxed text-dim`}>
            <p>{TRADEMARK_NOTE}</p>
            <p>Keine Cookies, kein Tracking. Rezepte und LUTs bleiben im Speicher dieses Browsers.</p>
          </div>
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
