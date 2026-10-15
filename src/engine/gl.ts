// Kleine WebGL2-Hilfen: Programme, Texturen, Render-Ziele, Hochladen von Ausschnitten.
import type { SourceImage } from '../types';
import type { Rect } from './plan';
import { VERTEX } from './shaders';

export interface Program {
  prog: WebGLProgram;
  loc(name: string): WebGLUniformLocation | null;
}

export function createProgram(gl: WebGL2RenderingContext, fragment: string): Program {
  const compile = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS) && !gl.isContextLost())
      throw new Error('Shader: ' + gl.getShaderInfoLog(s));
    return s;
  };
  const prog = gl.createProgram()!;
  const vs = compile(gl.VERTEX_SHADER, VERTEX);
  const fs = compile(gl.FRAGMENT_SHADER, fragment);
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS) && !gl.isContextLost())
    throw new Error('Programm: ' + gl.getProgramInfoLog(prog));
  const cache = new Map<string, WebGLUniformLocation | null>();
  return {
    prog,
    loc(name) {
      if (!cache.has(name)) cache.set(name, gl.getUniformLocation(prog, name));
      return cache.get(name)!;
    },
  };
}

export function createTexture(gl: WebGL2RenderingContext, target: number = gl.TEXTURE_2D): WebGLTexture {
  const t = gl.createTexture()!;
  gl.bindTexture(target, t);
  gl.texParameteri(target, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(target, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(target, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(target, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  if (target === gl.TEXTURE_3D) gl.texParameteri(target, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE);
  return t;
}

/** Textur mit Framebuffer zum Hineinrendern. */
export interface Target {
  tex: WebGLTexture;
  fbo: WebGLFramebuffer;
  width: number;
  height: number;
}

export function createTarget(
  gl: WebGL2RenderingContext,
  width: number,
  height: number,
  float = false,
): Target {
  const tex = createTexture(gl);
  if (float) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, width, height, 0, gl.RGBA, gl.HALF_FLOAT, null);
  else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  const fbo = gl.createFramebuffer()!;
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  return { tex, fbo, width, height };
}

export function deleteTarget(gl: WebGL2RenderingContext, t: Target | null | undefined) {
  if (!t) return;
  gl.deleteFramebuffer(t.fbo);
  gl.deleteTexture(t.tex);
}

/** Pixel unverändert hochladen: keine Farbraumumrechnung, keine Premultiplikation, erste Zeile = oben. */
function setUnpack(gl: WebGL2RenderingContext) {
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
}

/**
 * Lädt den Ausschnitt `r` der Quelle in `tex`. Bitmaps werden per createImageBitmap
 * zugeschnitten (der Ausschnitt wird gleich wieder freigegeben), Rohdaten per UNPACK_SKIP_*.
 */
export async function uploadRegion(
  gl: WebGL2RenderingContext,
  tex: WebGLTexture,
  pixels: SourceImage['pixels'],
  r: Rect,
): Promise<void> {
  const w = r.x1 - r.x0;
  const h = r.y1 - r.y0;
  if (pixels instanceof ImageBitmap) {
    const whole = r.x0 === 0 && r.y0 === 0 && w === pixels.width && h === pixels.height;
    const bmp = whole
      ? pixels
      : await createImageBitmap(pixels, r.x0, r.y0, w, h, {
          premultiplyAlpha: 'none',
          colorSpaceConversion: 'none',
        });
    try {
      gl.bindTexture(gl.TEXTURE_2D, tex);
      setUnpack(gl);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, bmp);
    } finally {
      if (bmp !== pixels) bmp.close();
    }
  } else {
    gl.bindTexture(gl.TEXTURE_2D, tex);
    setUnpack(gl);
    gl.pixelStorei(gl.UNPACK_ROW_LENGTH, pixels.width);
    gl.pixelStorei(gl.UNPACK_SKIP_PIXELS, r.x0);
    gl.pixelStorei(gl.UNPACK_SKIP_ROWS, r.y0);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, pixels.data);
    gl.pixelStorei(gl.UNPACK_ROW_LENGTH, 0);
    gl.pixelStorei(gl.UNPACK_SKIP_PIXELS, 0);
    gl.pixelStorei(gl.UNPACK_SKIP_ROWS, 0);
  }
}

/** 3D-LUT als RGBA16F-Textur (Hardware-trilinear). */
export function createLutTexture(gl: WebGL2RenderingContext, size: number, rgb: Float32Array): WebGLTexture {
  const n = size * size * size;
  const rgba = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    rgba[i * 4] = rgb[i * 3];
    rgba[i * 4 + 1] = rgb[i * 3 + 1];
    rgba[i * 4 + 2] = rgb[i * 3 + 2];
    rgba[i * 4 + 3] = 1;
  }
  const t = createTexture(gl, gl.TEXTURE_3D);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
  gl.texImage3D(gl.TEXTURE_3D, 0, gl.RGBA16F, size, size, size, 0, gl.RGBA, gl.FLOAT, rgba);
  return t;
}
