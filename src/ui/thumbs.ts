// Kleine Vorschaubilder: Filmstreifen (aus der Datei, nacheinander) und Look-Kacheln (über die Engine).
import { useEffect } from 'react';
import { DEFAULT_PARAMS, type LookParams } from '../types';
import { builtinEntries, defaultsFor, lutFor, NONE_ID } from './lookRegistry';
import { getEngine } from './session';
import { useStore } from './store';

const FILM_EDGE = 160;
const LOOK_EDGE = 200;

async function bitmapToUrl(bmp: ImageBitmap): Promise<string> {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = bmp.width;
    canvas.height = bmp.height;
    canvas.getContext('2d')!.drawImage(bmp, 0, 0);
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', 0.82));
    if (!blob) throw new Error('toBlob lieferte nichts');
    return URL.createObjectURL(blob);
  } finally {
    bmp.close();
  }
}

// Eine Warteschlange: parallele createImageBitmap-Aufrufe auf 24-MP-Dateien sprengen den iPhone-Speicher.
let chain: Promise<unknown> = Promise.resolve();
export function queueFileThumb(photoId: string, file: File) {
  chain = chain.then(async () => {
    if (!useStore.getState().photos.some((p) => p.id === photoId)) return;
    try {
      const bmp = await createImageBitmap(file, { resizeWidth: FILM_EDGE, resizeQuality: 'medium' });
      useStore.getState().setPhotoThumb(photoId, await bitmapToUrl(bmp));
    } catch {
      // RAW & Co.: das Bild kommt später aus der Engine (siehe useThumbnails).
    }
  });
}

interface ThumbJob {
  entryId: string;
  lutId: string;
  params: LookParams;
}

function jobs(): ThumbJob[] {
  const { customLuts, presets } = useStore.getState();
  return [
    { entryId: NONE_ID, lutId: NONE_ID, params: DEFAULT_PARAMS },
    ...builtinEntries().map((e) => ({ entryId: e.id, lutId: e.id, params: defaultsFor(e.id) })),
    ...customLuts.map((l) => ({ entryId: l.id, lutId: l.id, params: DEFAULT_PARAMS })),
    ...presets.map((p) => ({ entryId: p.id, lutId: p.lookId, params: p.params })),
  ];
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Rendert die Look-Kacheln des aktiven Fotos, ein Look nach dem anderen, und merkt sie pro Foto + Look.
 * Ein Fotowechsel bricht die laufende Runde ab.
 */
export function useThumbnails() {
  const version = useStore((s) => s.source.version);
  const status = useStore((s) => s.source.status);
  const engineReady = useStore((s) => s.engineReady);
  const nLuts = useStore((s) => s.customLuts.length);
  const nPresets = useStore((s) => s.presets.length);
  const lutEpoch = useStore((s) => s.lutEpoch);

  useEffect(() => {
    if (!engineReady || status !== 'bereit') return;
    const engine = getEngine();
    const photoId = useStore.getState().source.photoId;
    if (!engine || !photoId) return;
    let cancelled = false;
    void (async () => {
      // Foto ohne Filmstreifenbild (RAW): aus der Engine nachliefern.
      const photo = useStore.getState().photos.find((p) => p.id === photoId);
      if (photo && !photo.thumb) {
        try {
          const bmp = await engine.renderThumbnail(null, DEFAULT_PARAMS, FILM_EDGE);
          const url = await bitmapToUrl(bmp);
          if (cancelled) URL.revokeObjectURL(url);
          else useStore.getState().setPhotoThumb(photoId, url);
        } catch {}
      }
      for (const job of jobs()) {
        if (cancelled) return;
        const key = `${photoId}|${job.entryId}`;
        if (key in useStore.getState().lookThumbs) continue;
        let url = '';
        try {
          const bmp = await engine.renderThumbnail(lutFor(job.lutId), job.params, LOOK_EDGE);
          if (cancelled) {
            bmp.close();
            return;
          }
          url = await bitmapToUrl(bmp);
        } catch {}
        if (cancelled) {
          if (url) URL.revokeObjectURL(url);
          return;
        }
        useStore.getState().setLookThumb(key, url);
        await sleep(30);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [engineReady, status, version, nLuts, nPresets, lutEpoch]);
}
