// Beispielbilder der Startseite, live gerechnet mit der echten Engine – eigene Instanz auf eigenem Canvas,
// unabhängig vom Editor. Die Engine entsteht erst beim ersten Auftrag (also wenn ein Abschnitt in Sicht kommt)
// und wird mit der Startseite wieder freigegeben. Aufträge laufen nacheinander; wichtige zuerst.
import { createEngine } from '../../engine';
import { loadFile } from '../../io';
import type { Engine, SourceImage } from '../../types';
import { defaultsFor, lutFor } from '../lookRegistry';
import { closeSource } from '../session';

export type BeispielId = 'klippen' | 'porsche' | 'garten';

export interface Beispiel {
  id: BeispielId;
  label: string;
  /** Bildausschnitt bei object-cover (CSS object-position), damit das Motiv in festen Rahmen passt. */
  pos: string;
}

export const BEISPIELE: Beispiel[] = [
  { id: 'klippen', label: 'Klippen', pos: '50% 50%' },
  { id: 'porsche', label: 'Nachts', pos: '50% 74%' },
  { id: 'garten', label: 'Garten', pos: '42% 50%' },
];

export const beispielUrl = (id: BeispielId) => `${import.meta.env.BASE_URL}beispiele/${id}.jpg`;
/** Kleine Vorschau für die Foto-Wahl (168×132, schon zugeschnitten), statt des vollen Fotos. */
export const miniUrl = (id: BeispielId) => `${import.meta.env.BASE_URL}beispiele/mini/${id}.jpg`;

/** Lange Kante der Beispielfotos (siehe scripts/beispiele-erzeugen.mjs). */
export const GROSS = 1600;

export interface Auftrag {
  promise: Promise<string>;
  /** Nicht mehr gebraucht: wartet der Auftrag noch und will ihn sonst niemand, fällt er weg. */
  cancel(): void;
}

interface Job {
  key: string;
  photo: BeispielId;
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
  let current: BeispielId | null = null;
  let sources = new Map<BeispielId, Promise<SourceImage>>();
  let done = new Map<string, string>();
  let jobs = new Map<string, Job>();
  let queue: Job[] = [];
  let running = false;
  let epoch = 0;
  let seq = 0;

  function source(id: BeispielId): Promise<SourceImage> {
    let p = sources.get(id);
    if (!p) {
      p = (async () => {
        const res = await fetch(beispielUrl(id));
        if (!res.ok) throw new Error(`Beispielfoto nicht erreichbar (${res.status})`);
        return loadFile(new File([await res.blob()], `${id}.jpg`, { type: 'image/jpeg' }));
      })();
      sources.set(id, p);
      p.catch(() => sources.delete(id));
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

  /** Foto `photo` mit den Standardwerten von Look `look`, lange Kante `edge`, als Object-URL (JPEG). */
  function request(photo: BeispielId, look: string, edge: number, prio: number): Auftrag {
    const key = `${photo}|${look}|${edge}`;
    const hit = done.get(key);
    if (hit) return { promise: Promise.resolve(hit), cancel() {} };
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
