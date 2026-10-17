import { Download, HardDrive, ShieldCheck, SlidersHorizontal, WifiOff, ZoomIn, type LucideIcon } from 'lucide-react';
import { useInView } from './hooks';
import { Einblenden, Kopf, SPALTE } from './teile';

const LUPE = `${import.meta.env.BASE_URL}beispiele/lupe.jpg`;

const FUNKTIONEN: { icon: LucideIcon; title: string; text: string }[] = [
  {
    icon: ZoomIn,
    title: '100-%-Lupe',
    text: 'Korn, Schärfe und Klarheit pixelgenau prüfen – gerechnet wie der Export.',
  },
  {
    icon: SlidersHorizontal,
    title: 'Einstellungen wie in der Kamera',
    text: 'Weißabgleich, Dynamikbereich, Lichter, Schatten, Farbe, Schärfe, Körnung und Color Chrome – in den Stufen des Fuji-Menüs.',
  },
  {
    icon: HardDrive,
    title: 'JPEG, HEIC und Sony-RAW',
    text: 'ARW-Dateien entwickelt Film Lab im Browser. Von der a6000 aufs Handy: Imaging Edge Mobile, Bildgröße „Original“.',
  },
  {
    icon: Download,
    title: 'Export in voller Auflösung',
    text: 'JPEG mit den Aufnahmedaten der Kamera. Mehrere Fotos auf einmal, ein Look für alle.',
  },
  {
    icon: WifiOff,
    title: 'Offline als App',
    text: 'Einmal auf dem Home-Bildschirm, läuft Film Lab auch ohne Netz.',
  },
  {
    icon: ShieldCheck,
    title: 'Kein Upload',
    text: 'Kein Konto, kein Tracking. Deine Fotos verlassen das Gerät nicht.',
  },
];

export function Funktionen() {
  // Ausschnitt erst kurz vor Sicht laden (loading="lazy" greift in Chrome schon Bildschirme vorher).
  const [ref, near] = useInView<HTMLElement>('300px 0px');
  return (
    <section ref={ref} id="funktionen" aria-labelledby="funktionen-titel" className="border-y border-line bg-panel/50 px-5 py-20 sm:py-28">
      <div className={SPALTE}>
        <Kopf id="funktionen-titel" nr="03" name="Funktionen" rechts="Datenblatt" title="Gebaut wie eine Kamera.">
          Was eine Fujifilm beim Auslösen einstellt, stellst du hier nachträglich ein – für jedes Foto.
        </Kopf>

        <div className="mt-12 grid gap-10 sm:mt-16 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-14">
          {/* Die Lupe als Bild: echter 100-%-Ausschnitt aus der RAW-Entwicklung, mit Sucher darüber. */}
          <Einblenden className="lg:h-full">
            <figure className="flex h-full flex-col">
              <div className="relative aspect-[16/10] overflow-hidden rounded-sm bg-raised lg:aspect-auto lg:min-h-80 lg:flex-1">
                {near && (
                  <img
                    src={LUPE}
                    alt="Ausschnitt des Beispielfotos in 100 %, mit Korn des Rezepts Portra 400"
                    decoding="async"
                    className="ueberblenden absolute inset-0 size-full object-cover"
                  />
                )}
                <span aria-hidden className="sucher" />
              </div>
              <figcaption className="mt-3 flex justify-between font-mono text-[11px] tracking-[0.14em] text-dim uppercase">
                <span>100 % · Portra 400</span>
                <span>Lupe</span>
              </figcaption>
            </figure>
          </Einblenden>

          <ul className="grid content-start border-t border-line sm:grid-cols-2">
            {FUNKTIONEN.map(({ icon: Icon, title, text }, i) => (
              <li key={title} className="border-b border-line sm:odd:pr-8 sm:even:pl-8 sm:even:border-l">
                <Einblenden delay={(i % 2) * 90} className="py-6 sm:py-7">
                  <h3 className="flex items-center gap-2.5 text-[17px] font-semibold tracking-tight">
                    <Icon size={18} strokeWidth={1.8} className="flex-none text-accent" aria-hidden />
                    {title}
                  </h3>
                  <p className="mt-2 text-[15px] leading-relaxed text-dim">{text}</p>
                </Einblenden>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
