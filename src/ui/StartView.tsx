import { Aperture, ImagePlus, Lock, Smartphone } from 'lucide-react';
import { Button } from './controls';
import { useStore } from './store';

export function StartView({ onPick }: { onPick: () => void }) {
  const dragging = useStore((s) => s.dragging);
  return (
    <main className="flex min-h-full flex-col items-center justify-center overflow-y-auto px-5 py-8 pt-[max(2rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))]">
      <div
        className={`flex w-full max-w-md flex-col items-center gap-7 rounded-3xl p-2 text-center transition lg:max-w-lg lg:border-2 lg:border-dashed lg:p-10 ${
          dragging ? 'lg:border-accent lg:bg-raised/60' : 'lg:border-line'
        }`}
      >
        <div className="flex size-16 items-center justify-center rounded-2xl bg-raised text-accent">
          <Aperture size={34} strokeWidth={1.6} />
        </div>
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Film Lab</h1>
          <p className="mt-2 text-[15px] leading-relaxed text-dim">
            Gib deinen Kamerafotos den Look von Kodak und Fuji – in voller Auflösung.
          </p>
        </div>
        <Button variant="primary" onClick={onPick} className="min-h-14 w-full text-lg">
          <ImagePlus size={22} />
          Fotos wählen
        </Button>
        <p className="hidden text-sm text-dim lg:block">oder Fotos hierher ziehen</p>
        <ul className="flex flex-col gap-3 text-left text-sm leading-relaxed text-dim">
          <li className="flex gap-3">
            <Lock size={18} className="mt-0.5 flex-none text-accent" aria-hidden />
            <span>Alles läuft in deinem Browser. Deine Fotos werden nirgends hochgeladen.</span>
          </li>
          <li className="flex gap-3">
            <Smartphone size={18} className="mt-0.5 flex-none text-accent" aria-hidden />
            <span>
              <strong className="font-medium text-fg">Sony a6000:</strong> Kamera → „An Smartphone senden“ mit Imaging Edge Mobile, Bildgröße „Original“.
              Danach hier aus der Galerie wählen.
            </span>
          </li>
        </ul>
      </div>
    </main>
  );
}
