// GLSL-Quellen der Pipeline. Konvention: Bildpixel `imgPx` zählen von oben links,
// Pixelmitten liegen bei .5. Alle Effekte hängen nur von imgPx / uOutSize ab,
// dadurch sehen Vorschau, Export und Kacheln gleich aus.

export const VERTEX = /* glsl */ `#version 300 es
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

const HEADER = /* glsl */ `#version 300 es
precision highp float;
precision highp int;
precision highp sampler2D;
precision highp sampler3D;
out vec4 outColor;
const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);
const float HALO_T = 0.72; // Schwelle der Halation (lineare Luminanz)

vec3 toLinear(vec3 c) {
  c = clamp(c, 0.0, 1.0);
  return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c));
}
vec3 toEncoded(vec3 c) {
  c = clamp(c, 0.0, 1.0);
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}
`;

// Quelle mit Box-Filter abtasten: Zielpixel deckt k×k Quellpixel ab, n×n bilineare Abgriffe.
// Bei k = 1 trifft der einzige Abgriff genau die Texelmitte (verlustfrei).
const SAMPLE_SRC = /* glsl */ `
uniform sampler2D uSrc;
uniform vec2 uOutSize;    // Zielbild (ganzes Bild) in px
uniform vec2 uSrcSize;    // Quellbild (ganzes Bild) in px
uniform vec2 uSrcOrigin;  // linke obere Ecke des hochgeladenen Ausschnitts
uniform vec2 uSrcTexSize; // Größe des hochgeladenen Ausschnitts
uniform vec2 uMapScale;   // imgPx = gl_FragCoord.xy * uMapScale + uMapOffset
uniform vec2 uMapOffset;

vec3 sampleSrc(vec2 imgPx) {
  vec2 k = uSrcSize / uOutSize;
  vec2 s = imgPx * k - uSrcOrigin;
  ivec2 n = clamp(ivec2(ceil(k - 0.01)), 1, 8);
  vec3 acc = vec3(0.0);
  for (int y = 0; y < 8; y++) {
    if (y >= n.y) break;
    for (int x = 0; x < 8; x++) {
      if (x >= n.x) break;
      vec2 o = ((vec2(x, y) + 0.5) / vec2(n) - 0.5) * k;
      acc += texture(uSrc, (s + o) / uSrcTexSize).rgb;
    }
  }
  return acc / float(n.x * n.y);
}
`;

export const RESAMPLE = HEADER + SAMPLE_SRC + /* glsl */ `
void main() {
  outColor = vec4(sampleSrc(gl_FragCoord.xy * uMapScale + uMapOffset), 1.0);
}`;

// Lichter über der Schwelle (linear, nach Belichtung/Weißabgleich), 2×2-fach verkleinert.
export const HALO_THRESHOLD = HEADER + /* glsl */ `
uniform sampler2D uSrc;
uniform vec2 uOutSize;
uniform vec3 uGains;
const float T = HALO_T;
void main() {
  vec2 uv = gl_FragCoord.xy / uOutSize;
  vec2 o = 0.25 / uOutSize;
  float e = 0.0;
  for (int i = 0; i < 4; i++) {
    vec2 d = vec2(i & 1, i >> 1) * 2.0 - 1.0;
    vec3 lin = toLinear(texture(uSrc, uv + d * o).rgb) * uGains;
    e += max(dot(lin, LUMA) - T, 0.0);
  }
  e *= 0.25 / (1.0 - T);
  outColor = vec4(e, e, 0.0, 1.0);
}`;

// Trennbarer Gauß mit zwei Radien: Rot = enger Saum, Grün = weiter Schein.
export const BLUR = HEADER + /* glsl */ `
uniform sampler2D uSrc;
uniform vec2 uDir;
uniform vec2 uSigma;
void main() {
  vec2 ts = vec2(textureSize(uSrc, 0));
  vec2 p = gl_FragCoord.xy;
  int r = int(ceil(3.0 * max(uSigma.x, uSigma.y)));
  vec2 acc = vec2(0.0);
  vec2 wsum = vec2(0.0);
  vec2 inv = -0.5 / (uSigma * uSigma);
  for (int i = -128; i <= 128; i++) {
    if (i < -r) continue;
    if (i > r) break;
    float fi = float(i);
    vec2 w = exp(fi * fi * inv);
    acc += w * texture(uSrc, (p + uDir * fi) / ts).rg;
    wsum += w;
  }
  outColor = vec4(acc / wsum, 0.0, 1.0);
}`;

export const MAIN = HEADER + SAMPLE_SRC + /* glsl */ `
uniform sampler3D uLut;
uniform sampler2D uHalo;
uniform int uOriginal;      // 1 = nur Quelle zeigen
uniform float uSplit;       // < 0: aus, sonst Anteil von links im Original
uniform float uLineWidth;   // Teilungslinie in px
uniform vec3 uGains;
uniform int uUseLut;
uniform float uLutSize;
uniform float uStrength;
uniform float uHalation;
uniform float uGrain;
uniform float uGrainLattice; // Gitterpunkte pro kürzerer Bildseite
uniform float uVignette;
uniform float uLeak;
uniform int uLeakCount;
uniform vec4 uLeakA[3];     // Kante, Lage, Ausdehnung, Tiefe
uniform vec4 uLeakB[3];     // Farbe, Intensität
uniform vec2 uLeakN[3];     // Rauschversatz

uvec3 pcg3d(uvec3 v) {
  v = v * 1664525u + 1013904223u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  v ^= v >> 16u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  return v;
}
vec3 hash3(vec2 c, uint seed) {
  uvec3 h = pcg3d(uvec3(uvec2(ivec2(c)), seed));
  return vec3(h >> 8u) * (1.0 / 16777216.0) - 0.5;
}
// Wertrauschen, drei unabhängige Kanäle, Werte etwa -0,5..0,5.
vec3 vnoise3(vec2 x, uint seed) {
  vec2 i = floor(x);
  vec2 f = x - i;
  vec2 w = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash3(i, seed), hash3(i + vec2(1, 0), seed), w.x),
             mix(hash3(i + vec2(0, 1), seed), hash3(i + vec2(1, 1), seed), w.x), w.y);
}

// Zwei gegeneinander gedrehte Gitter plus eine gröbere Lage: Wertrauschen auf nur einem
// Gitter zeigt achsparallele Klötzchen, die Überlagerung wirkt richtungslos wie Silberkorn.
vec3 grainField(vec2 p) {
  vec3 a = vnoise3(mat2(0.8, 0.6, -0.6, 0.8) * p + 1000.0, 7u);
  vec3 b = vnoise3(mat2(0.8, -0.6, 0.6, 0.8) * p * 1.09 + 2000.0, 11u);
  vec3 c = vnoise3(mat2(0.96, 0.28, -0.28, 0.96) * p * 0.5 + 3000.0, 13u);
  return (a + b) * 0.7071 + 0.45 * c;
}

// Korn als Mittel über die Pixelfläche: Ein verkleinertes Bild bekommt so das gemittelte,
// schwächere Korn des großen Bildes statt neuer Rauschpixel.
vec3 grainAt(vec2 imgPx) {
  float pl = uGrainLattice / min(uOutSize.x, uOutSize.y); // Pixelbreite in Gittereinheiten
  float nf = clamp(ceil(pl - 0.01), 1.0, 3.0);
  int n = int(nf);
  vec3 acc = vec3(0.0);
  for (int y = 0; y < 3; y++) {
    if (y >= n) break;
    for (int x = 0; x < 3; x++) {
      if (x >= n) break;
      vec2 p = (imgPx - 0.5 + (vec2(x, y) + 0.5) / nf) * uGrainLattice / min(uOutSize.x, uOutSize.y);
      acc += grainField(p);
    }
  }
  acc /= nf * nf;
  // Abgriffe weiter als eine Gitterweite auseinander sind unabhängig: Rest analytisch dämpfen.
  if (pl > nf) acc *= nf / pl;
  return acc * 4.2; // ≈ Standardabweichung 1
}

float vnoise1(vec2 x, uint seed) { return vnoise3(x, seed).x; }

vec3 leakLight(vec2 uv, vec2 A) {
  vec2 q = uv * A;
  vec3 keep = vec3(1.0);
  for (int i = 0; i < 3; i++) {
    if (i >= uLeakCount) break;
    vec4 a = uLeakA[i];
    vec4 b = uLeakB[i];
    int e = int(a.x + 0.5);
    float d, t, len;
    if (e == 0) { d = q.x; t = q.y; len = A.y; }
    else if (e == 1) { d = A.x - q.x; t = q.y; len = A.y; }
    else if (e == 2) { d = q.y; t = q.x; len = A.x; }
    else { d = A.y - q.y; t = q.x; len = A.x; }
    vec2 nb = uLeakN[i];
    // Weiche, unregelmäßige Form: Lage und Tiefe leicht verbogen, quer verlaufende Schlieren.
    float w1 = vnoise1(vec2(t * 1.3, d * 1.1) + nb, 3u) + 0.5 * vnoise1(vec2(t * 2.9, d * 2.3) + nb.yx, 5u);
    float w2 = vnoise1(vec2(t * 7.0, d * 0.6) + nb * 1.7, 9u);
    float dt = (t - a.y * len) / a.z + w1 * 0.8;
    float along = exp(-dt * dt);
    float depth = a.w * (1.0 + 0.5 * w1);
    // Kern plus breiter, schwacher Schleier, der weit ins Bild läuft.
    float across = exp(-d / depth) + 0.3 * exp(-d / (3.0 * depth));
    float f = along * across * (0.85 + 0.5 * w2) * b.w;
    vec3 col = mix(b.rgb, vec3(1.0, 0.9, 0.7), clamp(f * f, 0.0, 1.0) * 0.6);
    keep *= 1.0 - clamp(col * f, 0.0, 1.0);
  }
  return 1.0 - keep;
}

void main() {
  vec2 imgPx = gl_FragCoord.xy * uMapScale + uMapOffset;
  vec2 uv = imgPx / uOutSize;
  vec3 src = sampleSrc(imgPx);
  if (uOriginal == 1 || (uSplit >= 0.0 && uv.x < uSplit)) {
    outColor = vec4(src, 1.0);
  } else {
    vec3 lin = toLinear(src) * uGains;
    vec3 c = toEncoded(lin);
    if (uUseLut == 1) {
      vec3 tc = c * ((uLutSize - 1.0) / uLutSize) + 0.5 / uLutSize;
      c = mix(c, texture(uLut, tc).rgb, uStrength);
    }
    vec2 A = uOutSize / min(uOutSize.x, uOutSize.y);
    if (uHalation > 0.0) {
      // Nur das über den Rand hinausstrahlende Licht: Innerhalb großer heller Flächen ist die
      // rotempfindliche Schicht ohnehin gesättigt, dort bleibt das Bild unverändert.
      // In hellen Nachbarflächen fällt der Schein kaum auf (relativ zur vorhandenen Belichtung);
      // ohne diese Dämpfung färbt er Himmel zwischen Wolken fleckig rosa.
      vec2 h = texture(uHalo, uv).rg;
      float y = dot(lin, LUMA);
      float local = max(y - HALO_T, 0.0) / (1.0 - HALO_T);
      float glow = max(0.65 * h.r + 0.35 * h.g - local, 0.0) * (1.0 - smoothstep(0.03, 0.6, y));
      c = toEncoded(toLinear(c) + glow * vec3(1.0, 0.25, 0.05) * (1.5 * uHalation));
    }
    if (uGrain > 0.0) {
      float y = clamp(dot(c, LUMA), 0.0, 1.0);
      float amp = uGrain * 0.07 * pow(4.0 * y * (1.0 - y) + 0.02, 0.75);
      vec3 g = grainAt(imgPx);
      c += amp * (g.x + 0.22 * vec3(g.y, -0.5 * (g.y + g.z), g.z));
    }
    if (uVignette > 0.0) {
      float r = length((uv - 0.5) * A) / (0.5 * length(A));
      c = toEncoded(toLinear(c) * (1.0 - uVignette * 0.8 * smoothstep(0.25, 1.15, r)));
    }
    if (uLeak > 0.0) {
      c = 1.0 - (1.0 - clamp(c, 0.0, 1.0)) * (1.0 - uLeak * leakLight(uv, A));
    }
    outColor = vec4(clamp(c, 0.0, 1.0), 1.0);
  }
  if (uSplit >= 0.0 && abs(imgPx.x - uSplit * uOutSize.x) < 0.5 * uLineWidth) {
    outColor = vec4(0.96, 0.96, 0.96, 1.0);
  }
}`;
