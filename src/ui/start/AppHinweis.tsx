import { useEffect, useState, type ReactNode } from 'react';
import {
  AlignLeft,
  Bookmark,
  BookOpen,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Copy,
  FileSearch,
  Glasses,
  Link,
  Mic,
  Plus,
  Printer,
  RotateCw,
  Share,
  SquarePlus,
  Star,
  StickyNote,
  X,
} from 'lucide-react';
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

const b = (t: string) => <b className="font-semibold text-fg">{t}</b>;

// Ablauf wie in Safari unter iOS 27 (Bildschirmfotos vom 17.10.2026): Adressfeld halten, Teilen, Mehr anzeigen,
// Zum Home-Bildschirm, Hinzufügen. Menüs und Teilen-Fenster hell wie dort.
const SCHRITTE_IOS: ReactNode[] = [
  <>In Safari die {b('Adressleiste gedrückt halten')}.</>,
  <>{b('Teilen')} wählen.</>,
  <>Unten rechts auf {b('Mehr anzeigen')} tippen.</>,
  <>{b('Zum Home-Bildschirm')} wählen.</>,
  <>„Als Web-App öffnen“ anlassen, auf {b('Hinzufügen')} tippen.</>,
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
          {schritt <= 1 && <Leiste schritt={schritt} />}
          {schritt === 1 && <Menue />}
          {schritt === 2 && <Teilenblatt />}
          {schritt === 3 && <Teilenliste />}
          {schritt === 4 && <Hinzufuegen />}
        </div>
      </div>
      <ol className="mt-3">
        {SCHRITTE_IOS.map((text, i) => (
          <li key={i}>
            <button
              type="button"
              aria-current={i === schritt ? 'step' : undefined}
              onClick={() => {
                setAuto(false);
                setSchritt(i);
              }}
              className={`flex min-h-10 w-full items-start gap-3 border-t border-line py-1.5 text-left text-[15px] leading-relaxed transition-colors ${
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

const HOST = () => location.host || 'lab.hugobarthelmess.de';

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

/**
 * Safaris Leiste unten: Zurück, Adressfeld mit Seitenmenü und Neu laden, Tabs. Schritt 0: das Adressfeld wird gehalten,
 * Schritt 1: es ist angehoben (hell), darüber das Menü.
 */
function Leiste({ schritt }: { schritt: number }) {
  return (
    <div className="absolute inset-x-3 bottom-3 flex items-center gap-2">
      <span className="flex size-10 flex-none items-center justify-center rounded-full bg-white/75 text-black/35 shadow-lg">
        <ChevronLeft size={18} />
      </span>
      <span
        className={`relative flex h-10 min-w-0 flex-1 items-center gap-2 rounded-full px-3 text-[12px] shadow-lg ${
          schritt === 0 ? 'halten bg-[#2c2c30]/95' : 'bg-[#e5e5ea] text-black'
        }`}
      >
        <AlignLeft size={15} className="flex-none" />
        <span className="min-w-0 flex-1 truncate text-center">{HOST()}</span>
        <RotateCw size={14} className="flex-none" />
      </span>
      <span className="flex size-10 flex-none items-center justify-center rounded-full bg-white/75 text-black/80 shadow-lg">
        <Copy size={16} />
      </span>
    </div>
  );
}

/** Menü über dem gehaltenen Adressfeld (gekürzt um „Zu Tabgruppe bewegen“ und „Alle Tabs schließen“). */
function Menue() {
  const zeile = (icon: ReactNode, text: string, extra = '', ende: ReactNode = null) => (
    <span className={`flex items-center gap-2.5 rounded-lg px-2.5 py-1 whitespace-nowrap ${extra}`}>
      {icon}
      <span className="flex-1">{text}</span>
      {ende}
    </span>
  );
  const strich = <span className="mx-2.5 my-1 h-px bg-black/10" />;
  return (
    <div className="menue-rein absolute bottom-[3.75rem] left-1/2 flex w-[214px] -translate-x-1/2 flex-col rounded-2xl bg-[#ececf0]/97 p-1.5 text-[11.5px] text-black shadow-2xl">
      {zeile(<Share size={14} />, 'Teilen', 'tipp')}
      {zeile(<Link size={14} />, 'Kopieren')}
      {zeile(<Mic size={14} />, 'Sprachsuche')}
      {strich}
      {zeile(<Copy size={14} />, 'Tabgruppen wechseln', '', <ChevronRight size={13} />)}
      {strich}
      {zeile(<X size={14} />, 'Tab schließen', 'text-[#ff3b30]')}
    </div>
  );
}

/** Kopf des Teilen-Fensters: Vorschau, Name, Adresse, „Optionen“. */
function Blattkopf() {
  return (
    <div className="flex items-center gap-2.5">
      <img src={`${BASE}beispiele/mini/klippen-quer.jpg`} alt="" className="size-10 rounded-lg object-cover" />
      <span className="flex min-w-0 flex-col leading-tight">
        <span className="font-semibold">Film Lab</span>
        <span className="truncate text-black/50">{HOST()}</span>
        <span className="mt-1 w-fit rounded-full bg-white px-2 py-0.5 text-[9.5px] shadow-sm">Optionen ›</span>
      </span>
    </div>
  );
}

/** Runde Knöpfe unter den Apps; der letzte klappt die Liste auf oder zu. */
function Knopfreihe({ offen, tipp }: { offen: boolean; tipp: boolean }) {
  const knopf = (icon: ReactNode, text: string, extra = '') => (
    <span className="flex flex-col items-center gap-1 text-center text-[8.5px] leading-tight">
      <span className={`flex size-9 items-center justify-center rounded-full bg-black/[0.07] ${extra}`}>{icon}</span>
      {text}
    </span>
  );
  return (
    <div className="grid grid-cols-4 gap-2">
      {knopf(<Copy size={15} />, 'Kopieren')}
      {knopf(<Printer size={15} />, 'Drucken')}
      {knopf(<Bookmark size={15} />, 'Zu Lesezeichen')}
      {knopf(offen ? <ChevronUp size={16} /> : <ChevronDown size={16} />, offen ? 'Weniger anzeigen' : 'Mehr anzeigen', tipp ? 'tipp' : '')}
    </div>
  );
}

/** Teilen-Fenster: Apps und runde Knöpfe, „Mehr anzeigen“ ist dran. */
function Teilenblatt() {
  const app = (farbe: string, text: string) => (
    <span className="flex flex-col items-center gap-1 text-[8.5px]">
      <span className={`size-9 rounded-[22%] ${farbe}`} />
      {text}
    </span>
  );
  return (
    <div className="blatt-rein absolute inset-x-1.5 bottom-1.5 flex flex-col gap-2.5 rounded-[1.4rem] bg-[#f2f2f5] px-3 pt-3 pb-3 text-[11px] text-black shadow-2xl">
      <Blattkopf />
      <div className="grid grid-cols-4 gap-2 border-t border-black/10 pt-2.5">
        {app('bg-[#1e88ff]', 'AirDrop')}
        {app('bg-[#34c759]', 'Nachrichten')}
        {app('bg-[#2f80ff]', 'Mail')}
        {app('bg-[linear-gradient(#ffd60a_0_28%,#fff_28%)] ring-1 ring-black/10', 'Notizen')}
      </div>
      <div className="border-t border-black/10 pt-2.5">
        <Knopfreihe offen={false} tipp />
      </div>
    </div>
  );
}

/** Aufgeklappt: die Liste der Aktionen, sie scrollt bis „Zum Home-Bildschirm“. */
function Teilenliste() {
  const zeile = (icon: ReactNode, text: string, tipp = false) => (
    <span className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 ${tipp ? 'tipp bg-white' : ''}`}>
      {icon}
      {text}
    </span>
  );
  return (
    <div className="absolute inset-x-0 bottom-0 h-[94%] overflow-hidden rounded-t-[1.4rem] bg-[#f2f2f5] px-3 pt-3 text-[11px] text-black shadow-2xl">
      <div className="liste-scrollen flex flex-col gap-2.5">
        <Knopfreihe offen tipp={false} />
        <div className="flex flex-col rounded-xl bg-black/[0.05] p-1">
          {zeile(<Glasses size={14} />, 'Zur Leseliste hinzufügen')}
          {zeile(<BookOpen size={14} />, 'Lesezeichen hinzufügen zu …')}
          {zeile(<Star size={14} />, 'Als Favoriten sichern')}
          {zeile(<StickyNote size={14} />, 'Zu Schnellnotiz hinzufügen')}
          {zeile(<FileSearch size={14} />, 'Auf der Seite suchen')}
          {zeile(<SquarePlus size={14} />, 'Zum Home-Bildschirm', true)}
        </div>
      </div>
    </div>
  );
}

function Hinzufuegen() {
  return (
    <div className="blatt-rein absolute inset-x-0 bottom-0 h-[94%] rounded-t-[1.4rem] bg-[#f2f2f7] px-3 pt-3 text-[11px] text-black shadow-2xl">
      <div className="flex items-center gap-2">
        <span className="flex size-7 flex-none items-center justify-center rounded-full bg-white shadow-sm">
          <X size={14} />
        </span>
        <span className="min-w-0 flex-1 truncate font-semibold">Zum Home-Bildschirm</span>
        <span className="tipp flex-none rounded-full bg-[#0a84ff] px-3 py-1.5 font-semibold text-white">Hinzufügen</span>
      </div>
      <div className="-mx-3 mt-4 flex items-center gap-3 bg-white px-3 py-2.5">
        <img src={ICON} alt="" className="size-11 rounded-xl" />
        <span className="flex min-w-0 flex-col gap-1">
          <span className="border-b border-black/10 pb-1 text-[12px]">Film Lab</span>
          <span className="truncate text-black/40">https://{HOST()}/app</span>
        </span>
      </div>
      <div className="-mx-3 mt-3 flex items-center justify-between bg-white px-3 py-2.5 text-[12px]">
        Als Web-App öffnen
        <span className="flex h-5 w-9 items-center justify-end rounded-full bg-[#34c759] p-0.5">
          <span className="size-4 rounded-full bg-white" />
        </span>
      </div>
    </div>
  );
}
