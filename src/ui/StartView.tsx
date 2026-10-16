import { Aperture, ImagePlus, Lock } from 'lucide-react';
import { Button } from './controls';
import { TRADEMARK_NOTE } from './lookRegistry';
import { useStore } from './store';

export function StartView({ onPick }: { onPick: () => void }) {
  const dragging = useStore((s) => s.dragging);
  return (
    <main className="flex min-h-full flex-col items-center overflow-y-auto px-5 py-8 pt-[max(2rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))]">
      <div
        className={`my-auto flex w-full max-w-lg flex-col items-center gap-7 rounded-3xl border-2 border-dashed p-10 text-center transition pointer-coarse:max-w-md pointer-coarse:border-0 pointer-coarse:p-2 ${
          dragging ? 'border-accent bg-raised/60' : 'border-line'
        }`}
      >
        <div className="flex size-16 items-center justify-center rounded-2xl bg-raised text-accent">
          <Aperture size={34} strokeWidth={1.6} />
        </div>
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Film Lab</h1>
          <p className="mt-2 text-[15px] leading-relaxed text-dim">
            Filmlooks von Fujifilm, Leica und Kodak für deine Fotos – im Browser, in voller Auflösung.
          </p>
          <p className="mt-2 text-sm leading-relaxed text-dim/80">JPEG und Sony-RAW (ARW) · mehrere Fotos auf einmal · Export mit Aufnahmedaten</p>
        </div>
        <Button variant="primary" onClick={onPick} className="min-h-14 w-full text-lg">
          <ImagePlus size={22} />
          Fotos wählen
        </Button>
        <p className="text-base text-dim pointer-coarse:hidden">oder Fotos hierher ziehen</p>
        <p className="flex gap-3 text-left text-sm leading-relaxed text-dim">
          <Lock size={18} className="mt-0.5 flex-none text-accent" aria-hidden />
          <span>Alles läuft in deinem Browser. Deine Fotos werden nirgends hochgeladen.</span>
        </p>
        <p className="hidden text-left text-xs leading-relaxed text-dim pointer-coarse:block">
          Tipp (Sony a6000): „An Smartphone senden“ mit Imaging Edge Mobile, Bildgröße „Original“. Danach hier aus der Galerie wählen.
        </p>
      </div>
      <footer className="mt-8 flex max-w-md flex-col gap-1.5 text-center text-xs leading-relaxed text-dim">
        <p>{TRADEMARK_NOTE}</p>
        <p>Keine Cookies, kein Tracking. Rezepte und LUTs bleiben im Speicher dieses Browsers.</p>
      </footer>
    </main>
  );
}
