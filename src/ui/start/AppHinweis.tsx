import { useEffect, useState, type ReactNode } from 'react';
import { AlignLeft, Bookmark, BookOpen, Check, ChevronLeft, Copy, Plus, RotateCw, Share, SquarePlus } from 'lucide-react';
import { Button } from '../controls';
import { Dialog } from '../Dialog';
import { diesePlattform, installieren, useInstallweg, type Plattform } from '../install';
import { useStore } from '../store';
import { Einblenden, Kopf, SPALTE } from './teile';

const BASE = import.meta.env.BASE_URL;
const ICON = `${BASE}apple-touch-icon.png`;

const VORTEILE = [
  'Startet ohne Browserleiste, direkt bei deinen Fotos.',
  'Läuft offline, auch unterwegs ohne Netz.',
  'Rezepte und LUTs bleiben dauerhaft gespeichert.',
];

/** Abschnitt „Film Lab als App“: Knopf öffnet den Dialog des Browsers oder, wo es keinen gibt, eine Anleitung. */
export function AppHinweis() {
  const weg = useInstallweg();
  const [anleitung, setAnleitung] = useState<Plattform | null>(null);

  const hinzufuegen = async () => {
    // Chromium: eigener Dialog des Browsers (prompt() noch in diesem Klick).
    const ergebnis = await installieren();
    if (ergebnis === 'accepted') useStore.getState().notify('Film Lab wird installiert …');
    if (ergebnis === null) setAnleitung(diesePlattform());
  };

  return (
    <section id="app" aria-labelledby="app-titel" className="border-t border-line px-5 py-20 sm:py-28">
      <div className={SPALTE}>
        <Kopf id="app-titel" nr="05" name="App" rechts="Ohne App Store" title="Film Lab als App.">
          Leg Film Lab auf deinen Home-Bildschirm. Ohne App Store, ohne Anmeldung.
        </Kopf>

        <div className="mt-12 grid items-center gap-14 sm:mt-14 md:grid-cols-[minmax(0,6fr)_minmax(0,5fr)]">
          <Einblenden>
            <ul className="border-t border-line">
              {VORTEILE.map((v) => (
                <li key={v} className="flex gap-3 border-b border-line py-4 text-[16px] leading-relaxed sm:text-[17px]">
                  <Check size={18} className="mt-1 flex-none text-accent" aria-hidden />
                  {v}
                </li>
              ))}
            </ul>
            {weg === 'app' ? (
              <p className="mt-8 flex items-center gap-2.5 text-[15px] text-fg">
                <Check size={18} className="text-accent" aria-hidden />
                Du nutzt Film Lab schon als App.
              </p>
            ) : (
              <>
                <Button variant="primary" onClick={() => void hinzufuegen()} className="mt-8 min-h-14 w-full text-lg sm:w-auto sm:px-8">
                  <Plus size={22} />
                  Jetzt hinzufügen
                </Button>
                <p className="mt-4 max-w-md text-sm leading-relaxed text-dim">
                  Am iPhone zeigen wir dir die Handgriffe in Safari, Schritt für Schritt. Auf Android und am Computer öffnet sich,
                  wo der Browser es anbietet, direkt sein Installationsdialog.
                </p>
              </>
            )}
          </Einblenden>

          <Einblenden delay={120}>
            <Homescreen />
          </Einblenden>
        </div>
      </div>
      {anleitung && <Anleitung plattform={anleitung} onClose={() => setAnleitung(null)} />}
    </section>
  );
}

/** Ausschnitt eines Home-Bildschirms: leere App-Felder, dazwischen Film Lab, das beim Einblenden hineinspringt. */
function Homescreen() {
  return (
    <div aria-hidden className="mx-auto w-[min(100%,250px)] rounded-[2.6rem] border border-line bg-panel p-2.5 shadow-[0_40px_80px_-40px_rgb(0_0_0/0.9)]">
      <div className="relative overflow-hidden rounded-[2.1rem] bg-[radial-gradient(120%_80%_at_20%_0%,#3a2a12,#121214_60%)] px-5 pt-4 pb-5">
        <div className="flex justify-between px-1 font-mono text-[10px] text-white/70">
          <span>9:41</span>
          <span>▮▮▮</span>
        </div>
        <div className="mt-6 grid grid-cols-4 gap-x-3 gap-y-4">
          {Array.from({ length: 16 }, (_, i) =>
            i === 6 ? (
              <div key={i} className="app-neu flex flex-col items-center gap-1">
                <img src={ICON} alt="" className="aspect-square w-full rounded-[22%] ring-2 ring-accent ring-offset-2 ring-offset-[#1a1612]" />
                <span className="text-[8px] leading-none whitespace-nowrap text-white">Film Lab</span>
              </div>
            ) : (
              <div key={i} className="flex flex-col items-center gap-1">
                <span className="aspect-square w-full rounded-[22%] bg-white/[0.07]" />
                <span className="h-[5px] w-3/4 rounded-full bg-white/[0.08]" />
              </div>
            ),
          )}
        </div>
        <div className="mt-8 grid grid-cols-4 gap-3 rounded-[1.4rem] bg-white/[0.06] p-2.5">
          {Array.from({ length: 4 }, (_, i) => (
            <span key={i} className="aspect-square rounded-[22%] bg-white/[0.08]" />
          ))}
        </div>
      </div>
    </div>
  );
}

const STEP_MS = 2800;

const SCHRITTE_IOS: ReactNode[] = [
  <>
    In Safari die <b className="font-semibold text-fg">Adressleiste gedrückt halten</b>.
  </>,
  <>
    <b className="font-semibold text-fg">Teilen</b> wählen.
  </>,
  <>
    Nach unten scrollen, <b className="font-semibold text-fg">Zum Home-Bildschirm</b> wählen.
  </>,
  <>
    „Als Web-App öffnen“ anlassen, auf <b className="font-semibold text-fg">Hinzufügen</b> tippen.
  </>,
];

function Anleitung({ plattform, onClose }: { plattform: Plattform; onClose: () => void }) {
  const fertig = (
    // Startfokus hier statt auf Schritt 01, sonst trägt der erste Schritt beim Öffnen einen Fokusrahmen.
    <Button variant="primary" onClick={onClose} data-autofocus>
      Verstanden
    </Button>
  );
  if (plattform === 'ios' || plattform === 'ios-app')
    return (
      <Dialog title="Zum Home-Bildschirm" onClose={onClose} footer={fertig}>
        {plattform === 'ios-app' && (
          <p className="mb-4 rounded-xl border border-accent/40 bg-accent/10 px-4 py-3 text-sm leading-relaxed">
            Du siehst Film Lab gerade in einer App wie Instagram. Öffne die Seite zuerst in Safari, meist über das Menü dieser App
            („In Safari öffnen“).
          </p>
        )}
        <TeilenAnleitung />
      </Dialog>
    );
  const schritte =
    plattform === 'android'
      ? ['Oben rechts im Browser auf ⋮ tippen.', '„App installieren“ oder „Zum Startbildschirm hinzufügen“ wählen.', 'Mit „Installieren“ bestätigen.']
      : [
          'Chrome und Edge: das Installieren-Symbol rechts in der Adressleiste klicken oder im Browsermenü „App installieren“ wählen.',
          'Safari am Mac: in der Menüleiste Ablage → „Zum Dock hinzufügen“.',
          `Am iPhone: ${location.host} in Safari öffnen und dort auf „Jetzt hinzufügen“ tippen.`,
        ];
  return (
    <Dialog title={plattform === 'android' ? 'App installieren' : 'Als App installieren'} onClose={onClose} footer={fertig}>
      <p className="text-sm leading-relaxed text-dim">Dieser Browser bietet gerade keinen eigenen Dialog an. So geht es von Hand:</p>
      <ol className="mt-3">
        {schritte.map((s, i) => (
          <li key={s} className="flex gap-3 border-t border-line py-3 text-[15px] leading-relaxed">
            <span className="font-mono text-xs leading-6 text-accent">0{i + 1}</span>
            {s}
          </li>
        ))}
      </ol>
    </Dialog>
  );
}

/** Nachgestellte Schritte in Safari (iOS 26/27): läuft von selbst durch, ein Tipp auf einen Schritt hält dort an. */
function TeilenAnleitung() {
  const [schritt, setSchritt] = useState(0);
  const [auto, setAuto] = useState(() => !matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    if (!auto) return;
    const t = setTimeout(() => setSchritt((s) => (s + 1) % SCHRITTE_IOS.length), STEP_MS);
    return () => clearTimeout(t);
  }, [auto, schritt]);

  return (
    <div>
      <div aria-hidden className="relative mx-auto h-[240px] w-full max-w-[320px] overflow-hidden rounded-[1.75rem] border border-line bg-[#101012] text-white">
        <SafariSeite />
        <div key={schritt} className="absolute inset-0">
          {schritt <= 1 && <Leiste halten={schritt === 0} />}
          {schritt === 1 && <Menue />}
          {schritt === 2 && <Teilenblatt />}
          {schritt === 3 && <Hinzufuegen />}
        </div>
      </div>
      <ol className="mt-4">
        {SCHRITTE_IOS.map((text, i) => (
          <li key={i}>
            <button
              type="button"
              aria-current={i === schritt ? 'step' : undefined}
              onClick={() => {
                setAuto(false);
                setSchritt(i);
              }}
              className={`flex min-h-11 w-full items-start gap-3 border-t border-line py-2 text-left text-[15px] leading-relaxed transition-colors ${
                i === schritt ? 'text-fg' : 'text-dim hover:text-fg'
              }`}
            >
              <span className={`font-mono text-xs leading-6 ${i === schritt ? 'text-accent' : 'text-dim/70'}`}>0{i + 1}</span>
              <span>{text}</span>
            </button>
          </li>
        ))}
      </ol>
      <p className="mt-2 text-[13px] leading-relaxed text-dim">
        Ältere iOS-Versionen: Teilen-Symbol in der Leiste oder hinter •••, am iPad oben rechts. In Chrome oben in der
        Adressleiste.
      </p>
    </div>
  );
}

/** Hintergrund: die Startseite, wie Safari sie zeigt (nur angedeutet). */
function SafariSeite() {
  return (
    <div className="absolute inset-0 px-5 pt-5">
      <div className="flex items-center gap-2 text-[11px] font-semibold">
        <img src={`${BASE}favicon.svg`} alt="" className="size-4" />
        Film Lab
      </div>
      <img src={`${BASE}beispiele/mini/klippen-quer.jpg`} alt="" className="mt-4 h-24 w-full rounded-sm object-cover opacity-80" />
      <div className="mt-4 h-3 w-4/5 rounded-full bg-white/15" />
      <div className="mt-2 h-3 w-3/5 rounded-full bg-white/15" />
    </div>
  );
}

/** Safaris Leiste unten (iOS 26/27): Zurück, Adressfeld mit Seitenmenü und Neu laden, Tabs. Teilen: Adressfeld halten. */
function Leiste({ halten }: { halten: boolean }) {
  return (
    <div className="absolute inset-x-3 bottom-3 flex items-center gap-2">
      <span className="flex size-10 flex-none items-center justify-center rounded-full bg-white/75 text-black/35 shadow-lg">
        <ChevronLeft size={18} />
      </span>
      <span className={`relative flex h-10 min-w-0 flex-1 items-center gap-2 rounded-full bg-[#2c2c30]/95 px-3 text-[12px] shadow-lg ${halten ? 'halten' : ''}`}>
        <AlignLeft size={15} className="flex-none" />
        <span className="min-w-0 flex-1 truncate text-center">{location.host || 'lab.hugobarthelmess.de'}</span>
        <RotateCw size={14} className="flex-none" />
      </span>
      <span className="flex size-10 flex-none items-center justify-center rounded-full bg-white/75 text-black/80 shadow-lg">
        <Copy size={16} />
      </span>
    </div>
  );
}

function Menue() {
  const zeile = (icon: ReactNode, text: string, tipp = false) => (
    <span className={`flex items-center justify-between gap-3 rounded-lg px-3 py-2 ${tipp ? 'tipp bg-white/10' : ''}`}>
      {text}
      {icon}
    </span>
  );
  return (
    // Menü über dem gedrückt gehaltenen Adressfeld.
    <div className="menue-rein absolute bottom-16 left-1/2 flex w-[190px] -translate-x-1/2 flex-col rounded-2xl bg-[#2c2c30]/97 p-1.5 text-[12px] shadow-2xl">
      {zeile(<Copy size={15} />, 'Kopieren')}
      {zeile(<Share size={15} />, 'Teilen', true)}
    </div>
  );
}

function Teilenblatt() {
  const aktion = (icon: ReactNode, text: string, tipp = false) => (
    <span className={`flex items-center justify-between rounded-lg px-3 py-2.5 ${tipp ? 'tipp bg-white/10' : ''}`}>
      {text}
      {icon}
    </span>
  );
  return (
    <div className="blatt-rein absolute inset-x-0 bottom-0 h-[86%] rounded-t-[1.4rem] bg-[#1f1f22] px-3 pt-3 text-[12px] shadow-2xl">
      <div className="flex items-center gap-2.5 border-b border-white/10 px-1 pb-3">
        <img src={ICON} alt="" className="size-9 rounded-lg" />
        <span className="flex min-w-0 flex-col">
          <span className="font-semibold">Film Lab</span>
          <span className="truncate text-white/50">{location.host || 'lab.hugobarthelmess.de'}</span>
        </span>
      </div>
      {/* Inhalt des Blatts scrollt unter dem Kopf nach oben, bis „Zum Home-Bildschirm“ ganz zu sehen ist. */}
      <div className="h-[calc(100%-3.5rem)] overflow-hidden">
        <div className="liste-scrollen px-0.5 pt-3">
          <div className="flex gap-3 px-1 pb-3">
            {Array.from({ length: 5 }, (_, i) => (
              <span key={i} className="size-10 flex-none rounded-full bg-white/10" />
            ))}
          </div>
          <div className="flex flex-col gap-1 rounded-xl bg-[#2c2c30] p-1">
            {aktion(<Copy size={15} />, 'Kopieren')}
            {aktion(<BookOpen size={15} />, 'Zur Leseliste hinzufügen')}
            {aktion(<Bookmark size={15} />, 'Lesezeichen hinzufügen')}
            {aktion(<SquarePlus size={15} />, 'Zum Home-Bildschirm', true)}
          </div>
        </div>
      </div>
    </div>
  );
}

function Hinzufuegen() {
  return (
    <div className="blatt-rein absolute inset-x-0 bottom-0 h-[86%] rounded-t-[1.4rem] bg-[#1f1f22] px-4 pt-3 text-[12px] shadow-2xl">
      <div className="flex items-center justify-between gap-2 text-[11px] whitespace-nowrap">
        <span className="text-[#0a84ff]">Abbrechen</span>
        <span className="font-semibold">Zum Home-Bildschirm</span>
        <span className="tipp rounded-md px-1.5 py-0.5 font-semibold text-[#0a84ff]">Hinzufügen</span>
      </div>
      <div className="mt-5 flex items-center gap-3 rounded-xl bg-[#2c2c30] p-3">
        <img src={ICON} alt="" className="size-12 rounded-xl" />
        <span className="flex min-w-0 flex-col gap-1">
          <span className="border-b border-white/15 pb-1 text-[13px]">Film Lab</span>
          <span className="truncate text-white/50">{location.host || 'lab.hugobarthelmess.de'}</span>
        </span>
      </div>
      <div className="mt-3 flex items-center justify-between rounded-xl bg-[#2c2c30] px-3 py-2.5">
        Als Web-App öffnen
        <span className="flex h-5 w-9 items-center justify-end rounded-full bg-[#30d158] p-0.5">
          <span className="size-4 rounded-full bg-white" />
        </span>
      </div>
    </div>
  );
}
