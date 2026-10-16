import { ClipboardPaste, HardDrive, ShieldCheck, SlidersHorizontal, WifiOff, ZoomIn, type LucideIcon } from 'lucide-react';
import { useInView } from './hooks';
import { Einblenden, Kopf } from './teile';

const LUPE = `${import.meta.env.BASE_URL}beispiele/lupe.jpg`;

const FUNKTIONEN: { icon: LucideIcon; title: string; text: string; lupe?: boolean }[] = [
  {
    icon: ZoomIn,
    title: '100-%-Lupe',
    text: 'Korn, Schärfe und Klarheit pixelgenau prüfen – gerechnet wie der Export in voller Auflösung.',
    lupe: true,
  },
  {
    icon: SlidersHorizontal,
    title: 'Bildeinstellungen wie in der Kamera',
    text: 'Weißabgleich mit Verschiebung, DR, Lichter, Schatten, Farbe, Schärfe, Klarheit, Körnung und Color Chrome – Werte und Stufen wie im Fuji-Menü.',
  },
  {
    icon: ClipboardPaste,
    title: 'Rezepte einfach einfügen',
    text: 'Rezepttext von Fuji X Weekly kopieren und einfügen. Film Lab übernimmt, was passt, und zeigt, was es auslässt.',
  },
  {
    icon: HardDrive,
    title: 'JPEG und RAW (ARW)',
    text: 'Sony-RAW wird im Browser entwickelt. Der Export behält Aufnahmedaten wie Kamera, Objektiv und Datum. Von der a6000 aufs Handy: „An Smartphone senden“ in Imaging Edge Mobile, Bildgröße „Original“.',
  },
  {
    icon: WifiOff,
    title: 'Offline als App',
    text: 'Zum Home-Bildschirm hinzufügen oder am PC installieren – danach läuft Film Lab auch ohne Netz.',
  },
  {
    icon: ShieldCheck,
    title: 'Alles bleibt bei dir',
    text: 'Kein Upload, kein Konto, kein Tracking. Deine Fotos verlassen das Gerät nicht.',
  },
];

export function Funktionen() {
  // Ausschnitt erst kurz vor Sicht laden (loading="lazy" greift in Chrome schon Bildschirme vorher).
  const [ref, near] = useInView<HTMLUListElement>('300px 0px');
  return (
    <section aria-labelledby="funktionen-titel" className="border-y border-line bg-panel px-5 py-16 sm:py-24">
      <Kopf id="funktionen-titel" eyebrow="Funktionen" title="Gebaut wie eine Kamera.">
        Was eine Fujifilm in der Kamera einstellt, stellst du hier für jedes Foto ein – auch nachträglich.
      </Kopf>
      {/* Die Lupe führt: breite Karte mit Bildausschnitt, daneben und darunter die übrigen fünf. */}
      <ul ref={ref} className="mx-auto mt-10 grid max-w-6xl gap-3 sm:mt-14 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
        {FUNKTIONEN.map(({ icon: Icon, title, text, lupe }, i) => (
          <li key={title} className={lupe ? 'sm:col-span-2 lg:row-span-2' : i === FUNKTIONEN.length - 1 ? 'sm:col-span-2 lg:col-span-1' : ''}>
            <Einblenden delay={(i % 3) * 90} className="h-full">
              <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-ink/50 transition-colors hover:bg-raised/60">
                {lupe && (
                  <div className="relative aspect-[16/10] overflow-hidden bg-raised lg:aspect-auto lg:flex-1">
                    {near && (
                      <img src={LUPE} alt="Ausschnitt des Beispielfotos in 100 %, mit Korn des Rezepts Portra 400" decoding="async" className="ueberblenden absolute inset-0 size-full object-cover" />
                    )}
                    <span className="pointer-events-none absolute top-3 left-3 rounded-full bg-black/55 px-3 py-1 text-xs font-medium text-white/90 backdrop-blur-md">
                      100 % · Portra 400
                    </span>
                  </div>
                )}
                <div className={`flex gap-4 p-5 sm:p-6 ${lupe ? '' : 'sm:flex-col'}`}>
                  <span className="flex size-11 flex-none items-center justify-center rounded-xl bg-raised text-accent">
                    <Icon size={22} strokeWidth={1.8} aria-hidden />
                  </span>
                  <div>
                    <h3 className="text-[17px] font-semibold tracking-tight">{title}</h3>
                    <p className="mt-1.5 text-[15px] leading-relaxed text-dim">{text}</p>
                  </div>
                </div>
              </div>
            </Einblenden>
          </li>
        ))}
      </ul>
    </section>
  );
}
