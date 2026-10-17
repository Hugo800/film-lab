// Beispielbilder der Startseite, live gerechnet mit der echten Engine – eigene Instanz auf eigenem Canvas,
// unabhängig vom Editor. Die Engine entsteht erst beim ersten Auftrag (also wenn ein Abschnitt in Sicht kommt)
// und wird mit der Startseite wieder freigegeben. Aufträge laufen nacheinander; wichtige zuerst.
import { createEngine } from '../../engine';
import { loadFile } from '../../io';
import type { Engine, SourceImage } from '../../types';
import { defaultsFor, lutFor } from '../lookRegistry';
import { closeSource } from '../session';

export type BeispielId = 'klippen' | 'sonnenuntergang' | 'nachts';
/** Fassung der Beispielfotos: hoch für hochkante Rahmen (Handy hochkant), sonst quer (siehe useFassung in hooks.ts). */
export type Fassung = 'quer' | 'hoch';
/** Ein Beispielfoto in einer Fassung, z. B. `klippen-hoch`: Dateiname und Schlüssel der Werkstatt. */
export type Foto = `${BeispielId}-${Fassung}`;

interface Angaben {
  label: string;
  /** Bildausschnitt bei object-cover (CSS object-position), damit das Motiv in festen Rahmen passt. */
  pos: string;
}

export interface Beispiel {
  id: BeispielId;
  quer: Angaben;
  hoch: Angaben;
}

export const BEISPIELE: Beispiel[] = [
  { id: 'klippen', quer: { label: 'Klippen', pos: '50% 50%' }, hoch: { label: 'Klippen', pos: '50% 70%' } },
  { id: 'sonnenuntergang', quer: { label: 'Sonnenuntergang', pos: '50% 50%' }, hoch: { label: 'Sonnenuntergang', pos: '50% 40%' } },
  { id: 'nachts', quer: { label: 'Nachts', pos: '30% 50%' }, hoch: { label: 'Nachts', pos: '50% 70%' } },
];

export const foto = (id: BeispielId, fassung: Fassung): Foto => `${id}-${fassung}`;

/** Name und Bildausschnitt eines Fotos in seiner Fassung. */
export function angaben(f: Foto): Angaben {
  const [id, fassung] = f.split('-') as [BeispielId, Fassung];
  return BEISPIELE.find((b) => b.id === id)![fassung];
}

/** Seitenfassung (lange Kante GROSS), vorab im Cache der App. */
export const beispielUrl = (f: Foto) => `${import.meta.env.BASE_URL}beispiele/${f}.jpg`;
/** Kleine Vorschau für die Foto-Wahl (168×132, schon zugeschnitten), statt des vollen Fotos. */
export const miniUrl = (f: Foto) => `${import.meta.env.BASE_URL}beispiele/mini/${f}.jpg`;
/** Editor-Fassung (lange Kante bis 4000 px) für Lupe und Export; nur beim Öffnen im Editor geladen, nicht im Precache. */
export const grossUrl = (f: Foto) => `${import.meta.env.BASE_URL}beispiele/gross/${f}.jpg`;

/** Lange Kante der Seitenfassung (siehe scripts/beispiele-erzeugen.mjs). */
export const GROSS = 2048;

export interface Auftrag {
  promise: Promise<string>;
  /** Nicht mehr gebraucht: wartet der Auftrag noch und will ihn sonst niemand, fällt er weg. */
  cancel(): void;
}

interface Job {
  key: string;
  photo: Foto;
  look: string;
  edge: number;
  prio: number;
  seq: number;
  waiters: { resolve(url: string): void; reject(err: unknown): void }[];
}

async function toUrl(bmp: ImageBitmap): Promise<string> {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = bmp.width;
    canvas.height = bmp.height;
    canvas.getContext('2d')!.drawImage(bmp, 0, 0);
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', 0.9));
    if (!blob) throw new Error('toBlob lieferte nichts');
    return URL.createObjectURL(blob);
  } finally {
    bmp.close();
  }
}

const pause = (ms = 0) => new Promise((r) => setTimeout(r, ms));

/** Höchstens so viele große Bilder (≈ 0,3–0,6 MB je Stück) im Cache; ältere werden freigegeben (zuletzt benutzt bleibt). */
const MAX_GROSS = 24;
/** Höchstens so viele dekodierte Beispielfotos (je ≈ 10 MB bei 2048 px) gleichzeitig, also eine Fassung. */
const MAX_QUELLEN = 4;

// Vorab-Aufträge (Priorität 0) blockieren den Hauptthread; sie warten, bis eine Weile weder gescrollt noch getippt wurde.
const RUHE_MS = 300;
let letzteEingabe = 0;
if (typeof window !== 'undefined') {
  const merken = () => (letzteEingabe = performance.now());
  for (const t of ['scroll', 'touchstart', 'touchmove', 'wheel']) window.addEventListener(t, merken, { capture: true, passive: true });
}

export function createWerkstatt() {
  let canvas: HTMLCanvasElement | null = null;
  let engine: Engine | null = null;
  let current: Foto | null = null;
  let sources = new Map<Foto, Promise<SourceImage>>();
  let done = new Map<string, string>();
  let jobs = new Map<string, Job>();
  let queue: Job[] = [];
  let running = false;
  let epoch = 0;
  let seq = 0;

  function source(id: Foto): Promise<SourceImage> {
    let p = sources.get(id);
    if (p) {
      // Zuletzt benutzt ans Ende (für das Freigeben unten).
      sources.delete(id);
      sources.set(id, p);
      return p;
    }
    p = (async () => {
      const res = await fetch(beispielUrl(id));
      if (!res.ok) throw new Error(`Beispielfoto nicht erreichbar (${res.status})`);
      return loadFile(new File([await res.blob()], `${id}.jpg`, { type: 'image/jpeg' }));
    })();
    sources.set(id, p);
    p.catch(() => sources.delete(id));
    // Höchstens MAX_QUELLEN dekodierte Fotos halten: nach dem Drehen fällt die andere Fassung weg. Das Foto in der
    // Engine bleibt (sie zeichnet weiter daraus).
    for (const [alt, q] of sources) {
      if (sources.size <= MAX_QUELLEN) break;
      if (alt === id || alt === current) continue;
      sources.delete(alt);
      q.then(closeSource, () => {});
    }
    return p;
  }

  async function work(job: Job): Promise<string> {
    const src = await source(job.photo);
    if (!engine) {
      // Nicht im Dokument: clientWidth 0 → die Engine hält die Vorschau in Quellgröße (≤ 2048 px).
      canvas = document.createElement('canvas');
      engine = createEngine(canvas);
    }
    if (current !== job.photo) {
      engine.setSource(src);
      current = job.photo;
    }
    return toUrl(await engine.renderThumbnail(lutFor(job.look), defaultsFor(job.look), job.edge));
  }

  async function pump() {
    if (running) return;
    running = true;
    const mine = epoch;
    while (queue.length > 0 && mine === epoch) {
      // Wichtigstes zuerst, bei Gleichstand das geladene Foto (spart setSource), sonst in Reihenfolge.
      queue.sort((a, b) => b.prio - a.prio || Number(b.photo === current) - Number(a.photo === current) || a.seq - b.seq);
      const still = performance.now() - letzteEingabe;
      if (queue[0].prio === 0 && still < RUHE_MS) {
        await pause(RUHE_MS - still);
        continue;
      }
      const job = queue.shift()!;
      try {
        const url = await work(job);
        if (mine !== epoch) {
          URL.revokeObjectURL(url);
          return;
        }
        done.set(job.key, url);
        if (job.edge >= GROSS) aufraeumen();
        for (const w of job.waiters) w.resolve(url);
      } catch (err) {
        if (mine === epoch) for (const w of job.waiters) w.reject(err);
      } finally {
        if (mine === epoch) jobs.delete(job.key);
      }
      await pause();
    }
    if (mine === epoch) running = false;
  }

  /**
   * Große Bilder als LRU begrenzen: `done` ist nach letzter Benutzung geordnet (Treffer rücken ans Ende). Gerade
   * angezeigte Bilder wurden zuletzt angefragt und bleiben; ein schon dargestelltes <img> behält sein Bild auch nach
   * dem Freigeben der URL.
   */
  function aufraeumen() {
    const gross = [...done.keys()].filter((k) => Number(k.slice(k.lastIndexOf('|') + 1)) >= GROSS);
    for (const k of gross.slice(0, Math.max(0, gross.length - MAX_GROSS))) {
      URL.revokeObjectURL(done.get(k)!);
      done.delete(k);
    }
  }

  /** Foto `photo` mit den Standardwerten von Look `look`, lange Kante `edge`, als Object-URL (JPEG). */
  function request(photo: Foto, look: string, edge: number, prio: number): Auftrag {
    const key = `${photo}|${look}|${edge}`;
    const hit = done.get(key);
    if (hit) {
      done.delete(key);
      done.set(key, hit);
      return { promise: Promise.resolve(hit), cancel() {} };
    }
    let job = jobs.get(key);
    if (!job) {
      job = { key, photo, look, edge, prio, seq: seq++, waiters: [] };
      jobs.set(key, job);
      queue.push(job);
    } else job.prio = Math.max(job.prio, prio);
    const j = job;
    let waiter!: Job['waiters'][number];
    const promise = new Promise<string>((resolve, reject) => {
      waiter = { resolve, reject };
      j.waiters.push(waiter);
    });
    void pump();
    return {
      promise,
      cancel() {
        j.waiters = j.waiters.filter((w) => w !== waiter);
        const i = queue.indexOf(j);
        if (j.waiters.length === 0 && i >= 0) {
          queue.splice(i, 1);
          jobs.delete(j.key);
        }
      },
    };
  }

  /** Gibt Engine, Quellen und Bilder frei. Danach lässt sich die Werkstatt erneut benutzen. */
  function dispose() {
    epoch++;
    running = false;
    queue = [];
    jobs = new Map();
    for (const url of done.values()) URL.revokeObjectURL(url);
    done = new Map();
    for (const p of sources.values()) p.then(closeSource, () => {});
    sources = new Map();
    current = null;
    try {
      engine?.dispose();
      // Den WebGL-Kontext sofort abgeben: iOS erlaubt nur wenige gleichzeitig, der Editor braucht gleich einen.
      canvas?.getContext('webgl2')?.getExtension('WEBGL_lose_context')?.loseContext();
    } catch {}
    engine = null;
    canvas = null;
  }

  return { request, dispose };
}

export type Werkstatt = ReturnType<typeof createWerkstatt>;
