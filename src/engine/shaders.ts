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

// Stufe 1 (vor der LUT, linear): Belichtung + Weißabgleich als Matrix, dann Dynamikbereich.
const DEVELOP = /* glsl */ `
uniform mat3 uColorMat;
uniform float uDR;      // 0 = DR100, 0,5 = DR200, 1 = DR400
uniform float uDRWhite; // Luminanz, die nach der Kompression Weiß wird (> 1 nur bei Plusbelichtung)

// Wie DR200/DR400 (Kamera: knapper belichten, Kurve anheben): Mitteltöne bis 18 % Grau bleiben.
// a) Plusbelichtung: Lichter bis uDRWhite (höchstens 2× bzw. 4×) weich unter Weiß gebracht
//    (x/(1+x/c), Steigung 1 am Knick) statt abgeschnitten.
// b) Lichter weich abgesenkt, Weiß bleibt: y' = y − a·(1−K)·t²(1−t), t = (y−K)/(1−K), monoton für a ≤ 1.
// Farbtonerhaltend über die Luminanz.
vec3 dynRange(vec3 lin) {
  float y = dot(lin, LUMA);
  const float K = 0.18;
  if (uDR <= 0.0 || y <= K) return lin;
  float y2 = y;
  if (uDRWhite > 1.0) {
    float X = uDRWhite - K, Y = 1.0 - K;
    y2 = K + (y2 - K) / (1.0 + (y2 - K) * (X - Y) / (X * Y));
  }
  float t = min((y2 - K) / (1.0 - K), 1.0);
  return lin * ((y2 - uDR * (1.0 - K) * t * t * (1.0 - t)) / y);
}
vec3 develop(vec3 enc) {
  return dynRange(uColorMat * toLinear(enc));
}
// Helligkeit für Klarheit/Schärfe (OKLab-artig: Kubikwurzel der Luminanz).
float lightness(vec3 lin) {
  return pow(max(dot(lin, LUMA), 0.0), 1.0 / 3.0);
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
uniform int uSrcP3;       // 1 = Ausschnitt ist Display P3 → nach sRGB umrechnen

// Display P3 → sRGB in linearem Licht (beide D65, gleiche Kurve); außerhalb von sRGB geklemmt
// wie bei der Umrechnung des Browsers. Spaltenweise.
const mat3 P3_TO_SRGB = mat3(1.2249402, -0.0420570, -0.0196376,
                             -0.2249402, 1.0420570, -0.0786360,
                             0.0, 0.0, 1.0982736);

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
  acc /= float(n.x * n.y);
  return uSrcP3 == 1 ? toEncoded(P3_TO_SRGB * toLinear(acc)) : acc;
}
`;

export const RESAMPLE = HEADER + SAMPLE_SRC + /* glsl */ `
void main() {
  outColor = vec4(sampleSrc(gl_FragCoord.xy * uMapScale + uMapOffset), 1.0);
}`;

// Effektkarte (2×2-fach verkleinert): R, G = Lichter über der Schwelle (Halation),
// B = Helligkeit für die Klarheit. Gleiche Entwicklung wie im Hauptshader.
export const EFFECT_MAP = HEADER + DEVELOP + /* glsl */ `
uniform sampler2D uSrc;
uniform vec2 uOutSize;
const float T = HALO_T;
void main() {
  vec2 uv = gl_FragCoord.xy / uOutSize;
  vec2 o = 0.25 / uOutSize;
  float e = 0.0;
  float l = 0.0;
  for (int i = 0; i < 4; i++) {
    vec2 d = vec2(i & 1, i >> 1) * 2.0 - 1.0;
    vec3 lin = develop(texture(uSrc, uv + d * o).rgb);
    e += max(dot(lin, LUMA) - T, 0.0);
    l += lightness(lin);
  }
  e *= 0.25 / (1.0 - T);
  outColor = vec4(e, e, 0.25 * l, 1.0);
}`;

// Trennbarer Gauß, je Kanal eigener Radius: Rot = enger Saum, Grün = weiter Schein, Blau = Klarheit.
export const BLUR = HEADER + /* glsl */ `
uniform sampler2D uSrc;
uniform vec2 uDir;
uniform vec3 uSigma;
void main() {
  vec2 ts = vec2(textureSize(uSrc, 0));
  vec2 p = gl_FragCoord.xy;
  int r = int(ceil(3.0 * max(uSigma.x, max(uSigma.y, uSigma.z))));
  vec3 acc = vec3(0.0);
  vec3 wsum = vec3(0.0);
  vec3 inv = -0.5 / (uSigma * uSigma);
  for (int i = -128; i <= 128; i++) {
    if (i < -r) continue;
    if (i > r) break;
    float fi = float(i);
    vec3 w = exp(fi * fi * inv);
    acc += w * texture(uSrc, (p + uDir * fi) / ts).rgb;
    wsum += w;
  }
  outColor = vec4(acc / wsum, 1.0);
}`;

export const MAIN = HEADER + SAMPLE_SRC + DEVELOP + /* glsl */ `
uniform sampler3D uLut;
uniform sampler2D uMap;     // Effektkarte (EFFECT_MAP, unscharf)
uniform int uOriginal;      // 1 = nur Quelle zeigen
uniform float uSplit;       // < 0: aus, sonst Anteil von links im Original
uniform float uLineWidth;   // Teilungslinie in px
uniform int uUseLut;
uniform float uLutSize;
uniform float uStrength;
uniform int uLab;           // 1 = Stufe 3/4 (Ton, Farbe, Color Chrome, Tönung, Klarheit, Schärfe) aktiv
uniform float uToneH;       // Lichter-Ton (Kamera-Stufen)
uniform float uToneS;       // Schatten-Ton
uniform float uColor;       // Farbe (Kamera-Stufen)
uniform float uCC;          // Color Chrome 0/1/2
uniform float uCCBlue;      // Color Chrome FX Blau 0/1/2
uniform vec2 uMono;         // Tönung (Warm/Kalt, Magenta/Grün) in Kamera-Stufen
uniform float uClarity;     // Kamera-Stufen; 0 auch ohne Effektkarte
uniform float uSharp;       // Kamera-Stufen
uniform float uSharpW;      // Seitengewicht des 3×3-Kerns, 0 = aus
uniform float uHalation;
uniform float uGrain;       // Korn-Amplitude (Kodierwerte, ≈ σ in Mitteltönen)
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

// Zwei gegeneinander gedrehte Gitter plus eine schwache gröbere Lage: Wertrauschen auf nur einem
// Gitter zeigt achsparallele Klötzchen, die Überlagerung wirkt richtungslos. Die grobe Lage bleibt
// schwach, Fujis Korn ist fast weiß (keine Klumpen).
vec3 grainField(vec2 p) {
  vec3 a = vnoise3(mat2(0.8, 0.6, -0.6, 0.8) * p + 1000.0, 7u);
  vec3 b = vnoise3(mat2(0.8, -0.6, 0.6, 0.8) * p * 1.09 + 2000.0, 11u);
  vec3 c = vnoise3(mat2(0.96, 0.28, -0.28, 0.96) * p * 0.5 + 3000.0, 13u);
  return (a + b) * 0.7071 + 0.15 * c;
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

// OKLab (Björn Ottosson). Konstanten zeilenweise; „v * M“ rechnet deshalb wie M·v.
const mat3 OK_M1 = mat3(0.4122214708, 0.5363325363, 0.0514459929,
                        0.2119034982, 0.6806995451, 0.1073969566,
                        0.0883024619, 0.2817188376, 0.6299787005);
const mat3 OK_M2 = mat3(0.2104542553, 0.7936177850, -0.0040720468,
                        1.9779984951, -2.4285922050, 0.4505937099,
                        0.0259040371, 0.7827717662, -0.8086757660);
const mat3 OK_M2I = mat3(1.0, 0.3963377774, 0.2158037573,
                         1.0, -0.1055613458, -0.0638541728,
                         1.0, -0.0894841775, -1.2914855480);
const mat3 OK_M1I = mat3(4.0767416621, -3.3077115913, 0.2309699292,
                         -1.2684380046, 2.6097574011, -0.3413193965,
                         -0.0041960863, -0.7034186147, 1.7076147010);
vec3 toLab(vec3 lin) {
  vec3 lms = lin * OK_M1;
  return (sign(lms) * pow(abs(lms), vec3(1.0 / 3.0))) * OK_M2;
}
vec3 fromLab(vec3 lab) {
  vec3 lms = lab * OK_M2I;
  return (lms * lms * lms) * OK_M1I;
}

const float PI = 3.14159265;
const float TONE_PIVOT = 0.5646;  // OKLab-L von 18 % Grau
const float TONE_STEP_H = 0.015;  // größte L-Änderung je Stufe Lichter-Ton
const float TONE_STEP_S = 0.02;   // je Stufe Schatten-Ton
const float COLOR_STEP = 0.1;     // Chroma-Faktor je Stufe Farbe (+4 → 1,4, −4 → 0,6)
const float MONO_STEP = 0.0025;   // OKLab-Chroma je Stufe Monochrom-Tönung (±18 → 0,045)
const float CLARITY_STEP = 0.15;  // Verstärkung des lokalen Kontrasts je Stufe
const float SHARP_STEP = 0.25;    // Unscharfmaskierung je Stufe (−4 = ganz weichgezeichnet)

// Lichter-/Schattenton auf OKLab-L: + härter, − weicher. Weiß, Schwarz und 18 % Grau bleiben,
// glatter Übergang am Drehpunkt (Ableitung dort 1).
float toneCurve(float L) {
  if (L > TONE_PIVOT) {
    float t = clamp((L - TONE_PIVOT) / (1.0 - TONE_PIVOT), 0.0, 1.0);
    return L + uToneH * TONE_STEP_H * 6.75 * t * t * (1.0 - t);
  }
  float t = clamp(L / TONE_PIVOT, 0.0, 1.0);
  return L - uToneS * TONE_STEP_S * 6.75 * t * (1.0 - t) * (1.0 - t);
}

// Color Chrome: gesättigte Farben (Gelb/Grün/Rot) etwas dunkler, Chroma fast gleich – kein Sättigungsregler.
// FX Blau: nur Blautöne (Himmel, Meer) deutlich dunkler. Konstanten angepasst an In-Kamera-Paare (Alik Griffin,
// GFX100 II) und Fujis Beispielpaare ohne deren globale Sättigungsanhebung (scripts/abgleich-cc-fit.mjs):
// stark ≈ −3 % L bei C 0,15 (≈ −2 L*), FX Blau ≈ −10 % L bei C 0,1. „Schwach“ = halbe Wirkung (geschätzt).
const float CC_K = 0.0488, CC_C0 = 0.16, CC_H = 102.5, CC_CHROMA = 0.76;
const float CB_K = 0.5635, CB_C0 = 0.3, CB_H = 253.5, CB_WIDTH = 2.63, CB_CHROMA = 0.072;
vec3 colorChrome(vec3 lab) {
  float C = length(lab.yz);
  if (C < 1e-5) return lab;
  float h = atan(lab.z, lab.y);
  float cc = 0.5 * uCC * CC_K * (1.0 - exp(-C / CC_C0)) * clamp(1.3 * cos(h - CC_H * PI / 180.0), 0.0, 1.0);
  float dh = mod(h - CB_H * PI / 180.0 + PI, 2.0 * PI) - PI;
  float cb = 0.5 * uCCBlue * CB_K * (1.0 - exp(-C / CB_C0)) * max(cos(CB_WIDTH * dh), 0.0) * step(abs(dh), 0.5 * PI);
  lab.x *= (1.0 - cc) * (1.0 - cb);
  lab.yz *= (1.0 + CC_CHROMA * cc) * (1.0 + CB_CHROMA * cb);
  return lab;
}

float preLightness(vec2 imgPx) {
  return lightness(develop(sampleSrc(imgPx)));
}

void main() {
  vec2 imgPx = gl_FragCoord.xy * uMapScale + uMapOffset;
  vec2 uv = imgPx / uOutSize;
  vec3 src = sampleSrc(imgPx);
  if (uOriginal == 1 || (uSplit >= 0.0 && uv.x < uSplit)) {
    outColor = vec4(src, 1.0);
  } else {
    // 1) Entwicklung in linearem Licht
    vec3 lin = develop(src);
    vec3 c = toEncoded(lin);
    // 2) Look
    if (uUseLut == 1) {
      vec3 tc = c * ((uLutSize - 1.0) / uLutSize) + 0.5 / uLutSize;
      c = mix(c, texture(uLut, tc).rgb, uStrength);
    }
    // 3) + 4) Bildeinstellungen in OKLab
    if (uLab == 1) {
      vec3 lab = toLab(toLinear(c));
      float L0 = max(lab.x, 1e-4);
      lab.x = toneCurve(lab.x);
      lab.yz *= lab.x / L0 * (1.0 + COLOR_STEP * uColor);
      lab = colorChrome(lab);
      float mid = clamp(4.0 * lab.x * (1.0 - lab.x), 0.0, 1.0);
      // Warm = Bernstein (OKLab-Farbton ≈ 70°), Magenta/Grün entlang a.
      lab.yz += (uMono.x * vec2(0.34, 1.0) / 1.056 + uMono.y * vec2(1.0, 0.0)) * MONO_STEP * mid;
      if (uClarity != 0.0 || uSharpW > 0.0) {
        float Lp = lightness(lin);
        if (uClarity != 0.0) {
          // Lokaler Kontrast gegen die unscharfe Helligkeit der Effektkarte, Ausreißer weich begrenzt.
          float d = Lp - texture(uMap, uv).b;
          d /= 1.0 + abs(d) / 0.15;
          lab.x += uClarity * CLARITY_STEP * mid * d;
        }
        if (uSharpW > 0.0) {
          float w0 = 1.0 - 2.0 * uSharpW;
          float blur = 0.0;
          for (int y = -1; y <= 1; y++)
            for (int x = -1; x <= 1; x++) {
              float wx = x == 0 ? w0 : uSharpW;
              float wy = y == 0 ? w0 : uSharpW;
              blur += wx * wy * (x == 0 && y == 0 ? Lp : preLightness(imgPx + vec2(x, y)));
            }
          lab.x += uSharp * SHARP_STEP * (Lp - blur);
        }
      }
      c = toEncoded(fromLab(lab));
    }
    // 5) Extras
    vec2 A = uOutSize / min(uOutSize.x, uOutSize.y);
    if (uHalation > 0.0) {
      // Nur das über den Rand hinausstrahlende Licht: Innerhalb großer heller Flächen ist die
      // rotempfindliche Schicht ohnehin gesättigt, dort bleibt das Bild unverändert.
      // In hellen Nachbarflächen fällt der Schein kaum auf (relativ zur vorhandenen Belichtung);
      // ohne diese Dämpfung färbt er Himmel zwischen Wolken fleckig rosa.
      vec2 h = texture(uMap, uv).rg;
      float y = dot(lin, LUMA);
      float local = max(y - HALO_T, 0.0) / (1.0 - HALO_T);
      float glow = max(0.65 * h.r + 0.35 * h.g - local, 0.0) * (1.0 - smoothstep(0.03, 0.6, y));
      c = toEncoded(toLinear(c) + glow * vec3(1.0, 0.25, 0.05) * (1.5 * uHalation));
    }
    if (uGrain > 0.0) {
      // Grain Effect: einfarbiges Luminanzkorn, in Mitteltönen am stärksten, in Lichtern und
      // Schatten nur wenig schwächer (gemessen an 100-%-Ausschnitten einer X-T30).
      float y = clamp(dot(c, LUMA), 0.0, 1.0);
      c += uGrain * pow(4.0 * y * (1.0 - y) + 0.15, 0.3) * grainAt(imgPx).x;
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
