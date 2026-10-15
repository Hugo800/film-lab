// Ersatz-Engine für UI-Tests mit 2D-Canvas und CSS-Filtern (nur wenn die echte Engine fehlt
// oder man die Oberfläche isoliert prüfen will). Aktiv über UI_MOCK_ENGINE=1 (scripts/ui-vite.config.mjs).
import type { Engine, ExportOptions, LookParams, Lut3D, RenderOptions, SourceImage } from '../../src/types';

export function createEngine(canvas: HTMLCanvasElement): Engine {
  let src: SourceImage | null = null;
  let lut: Lut3D | null = null;
  const bitmap = () => src!.pixels as ImageBitmap;

  const filterOf = (l: Lut3D | null, p: LookParams) =>
    `brightness(${2 ** p.exposure}) ${l ? `sepia(${0.35 * p.strength}) saturate(${1 + 0.4 * p.strength}) contrast(${1 + 0.1 * p.strength})` : ''} hue-rotate(${p.tint * 20}deg)`;

  function draw(ctx: CanvasRenderingContext2D, w: number, h: number, l: Lut3D | null, p: LookParams, original: boolean, split?: number) {
    ctx.filter = original ? 'none' : filterOf(l, p);
    ctx.drawImage(bitmap(), 0, 0, w, h);
    if (split !== undefined && !original) {
      const x = Math.round(w * split);
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, x, h);
      ctx.clip();
      ctx.filter = 'none';
      ctx.drawImage(bitmap(), 0, 0, w, h);
      ctx.restore();
    }
    ctx.filter = 'none';
  }

  const scaled = (edge: number) => {
    const k = Math.min(1, edge / Math.max(src!.width, src!.height));
    return { w: Math.max(1, Math.round(src!.width * k)), h: Math.max(1, Math.round(src!.height * k)) };
  };

  return {
    setSource(s) {
      src = s;
    },
    setLut(l) {
      lut = l;
    },
    render(p: LookParams, o?: RenderOptions) {
      if (!src) return;
      const ctx = canvas.getContext('2d')!;
      draw(ctx, canvas.width, canvas.height, lut, p, !!o?.showOriginal, o?.split);
    },
    async exportJpeg(s: SourceImage, l: Lut3D | null, p: LookParams, o?: ExportOptions) {
      const prev = src;
      src = s;
      try {
        const { w, h } = scaled(o?.maxEdge ?? 1600);
        const c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        draw(c.getContext('2d')!, w, h, l, p, false);
        for (let i = 1; i <= 4; i++) {
          if (o?.signal?.aborted) throw new DOMException('abgebrochen', 'AbortError');
          await new Promise((r) => setTimeout(r, 400));
          o?.onProgress?.(i / 4);
        }
        return await new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('toBlob'))), 'image/jpeg', 0.9));
      } finally {
        src = prev;
      }
    },
    async renderThumbnail(l: Lut3D | null, p: LookParams, maxEdge: number) {
      const { w, h } = scaled(maxEdge);
      const c = new OffscreenCanvas(w, h);
      draw(c.getContext('2d') as unknown as CanvasRenderingContext2D, w, h, l, p, false);
      return createImageBitmap(c);
    },
    dispose() {},
  };
}
