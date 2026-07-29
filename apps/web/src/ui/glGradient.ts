/**
 * Renderer WebGL del fondo animado del hero (FASE-12 · mejora UI).
 *
 * Quad a pantalla completa + fragment shader propio: ruido simplex (Ashima,
 * dominio público) con *domain warping* para un gradiente orgánico que "respira",
 * estilo Stripe/Linear. CERO dependencias (WebGL1 nativo) → se carga como chunk
 * aparte vía `import()` dinámico para no afectar el LCP.
 *
 * Cómo ajustar el look (ver presets en AnimatedBackground.tsx):
 *  - `speed`      velocidad del tiempo (0.03 lento · 0.10 vivo).
 *  - `intensity`  cuánto se aleja del color base (0.12 sutil · 0.34 vivo).
 *  - `scale`      frecuencia del ruido (1.0 grande/suave · 2.0 detallado).
 *  - `warp/swirl` cuánto se deforma el flujo (más = más orgánico/líquido).
 */

export interface GradientOptions {
  base: [number, number, number];
  colorA: [number, number, number];
  colorB: [number, number, number];
  colorC: [number, number, number];
  intensity: number;
  speed: number;
  scale: number;
  warp: number;
  swirl: number;
}

export interface GradientHandle {
  setActive(active: boolean): void;
  setOptions(opts: Partial<GradientOptions>): void;
  destroy(): void;
}

const VERT = `
attribute vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`;

// Ashima Arts simplex noise 3D (MIT / dominio público).
const FRAG = `
precision highp float;
uniform vec2 u_res;
uniform float u_time;
uniform float u_intensity;
uniform float u_scale;
uniform float u_warp;
uniform float u_swirl;
uniform vec3 u_base;
uniform vec3 u_ca;
uniform vec3 u_cb;
uniform vec3 u_cc;

vec4 permute(vec4 x){ return mod(((x*34.0)+1.0)*x, 289.0); }
vec4 taylorInvSqrt(vec4 r){ return 1.79284291400159 - 0.85373472095314 * r; }
float snoise(vec3 v){
  const vec2 C = vec2(1.0/6.0, 1.0/3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i  = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod(i, 289.0);
  vec4 p = permute(permute(permute(
      i.z + vec4(0.0, i1.z, i2.z, 1.0))
    + i.y + vec4(0.0, i1.y, i2.y, 1.0))
    + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 1.0/7.0;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ *ns.x + ns.yyyy;
  vec4 y = y_ *ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0)*2.0 + 1.0;
  vec4 s1 = floor(b1)*2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
}

// 3 octavas, no 4. Cada octava son 5 evaluaciones de snoise por píxel (una por
// cada llamada a fbm de abajo), y la cuarta aporta un detalle de amplitud
// 0.0625 y frecuencia 8x que a la resolución a la que se pinta esto ni siquiera
// se puede representar: solo produce aliasing. Quitarla es 25% menos trabajo.
float fbm(vec3 p){
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 3; i++) { v += a * snoise(p); p *= 2.0; a *= 0.5; }
  return v;
}

void main(){
  vec2 uv = gl_FragCoord.xy / u_res;
  vec2 p = uv; p.x *= u_res.x / u_res.y;       // corrección de aspecto
  float t = u_time;
  // domain warping → flujo orgánico (no blobs random)
  vec2 q = vec2(fbm(vec3(p*u_scale, t)), fbm(vec3(p*u_scale + 5.2, t)));
  vec2 r = vec2(fbm(vec3(p*u_scale + q*u_warp + 1.7, t*0.8)),
                fbm(vec3(p*u_scale + q*u_warp + 9.2, t*0.8)));
  float f = fbm(vec3(p*u_scale + r*u_swirl, t*0.6));
  float n = clamp(f*0.5 + 0.5, 0.0, 1.0);
  // rampa de color base → A → B → C, guiada por el ruido
  vec3 col = mix(u_base, u_ca, smoothstep(0.0, 0.55, n));
  col = mix(col, u_cb, smoothstep(0.35, 0.85, n));
  col = mix(col, u_cc, smoothstep(0.65, 1.0, q.x*0.5 + 0.5));
  vec3 outc = mix(u_base, col, u_intensity);   // intensidad = sutileza
  float vig = smoothstep(1.25, 0.15, length(uv - 0.5));
  outc = mix(u_base, outc, 0.45 + 0.55*vig);    // funde los bordes hacia el base
  gl_FragColor = vec4(outc, 1.0);
}
`;

function compile(gl: WebGLRenderingContext, type: number, src: string): WebGLShader | null {
  const sh = gl.createShader(type);
  if (!sh) return null;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    gl.deleteShader(sh);
    return null;
  }
  return sh;
}

/** Monta el gradiente animado sobre el canvas dado. Devuelve controles o null. */
export function mountGradient(canvas: HTMLCanvasElement, initial: GradientOptions): GradientHandle | null {
  const gl = (canvas.getContext('webgl', { antialias: false, alpha: false, depth: false, premultipliedAlpha: false }) ||
    canvas.getContext('experimental-webgl', { antialias: false, alpha: false })) as WebGLRenderingContext | null;
  if (!gl) return null;

  const vs = compile(gl, gl.VERTEX_SHADER, VERT);
  const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) return null;
  const prog = gl.createProgram();
  if (!prog) return null;
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
  gl.useProgram(prog);

  // Triángulo a pantalla completa (cubre el clip space con 3 vértices).
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'a_pos');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const U = {
    res: gl.getUniformLocation(prog, 'u_res'),
    time: gl.getUniformLocation(prog, 'u_time'),
    intensity: gl.getUniformLocation(prog, 'u_intensity'),
    scale: gl.getUniformLocation(prog, 'u_scale'),
    warp: gl.getUniformLocation(prog, 'u_warp'),
    swirl: gl.getUniformLocation(prog, 'u_swirl'),
    base: gl.getUniformLocation(prog, 'u_base'),
    ca: gl.getUniformLocation(prog, 'u_ca'),
    cb: gl.getUniformLocation(prog, 'u_cb'),
    cc: gl.getUniformLocation(prog, 'u_cc'),
  };

  let opts = { ...initial };
  let active = true;
  let raf = 0;
  const start = performance.now();

  /**
   * Se pinta a MENOS de un píxel de pantalla por píxel de shader y el canvas se
   * estira por CSS. El coste va con el número de píxeles, y este shader es caro
   * de verdad: 5 llamadas a `fbm` × 3 octavas = 15 evaluaciones de ruido símplex
   * 3D por píxel. A DPR 2 en un hero a pantalla completa eso son millones de
   * píxeles × 15, cada frame, y satura la GPU de un portátil sin gráfica
   * dedicada — que es justo lo que hacía ir la página a tirones mientras el hero
   * estaba a la vista.
   *
   * No se nota: lo que se pinta es un degradado de frecuencia muy baja (rasgos
   * de cientos de píxeles), así que al estirarlo el navegador lo interpola y el
   * resultado es indistinguible. El tope de ancho evita que un monitor grande
   * vuelva a disparar el coste.
   */
  const ESCALA_RENDER = 0.5;
  const ANCHO_MAX_PX = 1100;

  /** ~30 fps. El degradado «respira» a 0.085 de velocidad: a 60 fps se gasta el
   *  doble de GPU para un movimiento que el ojo no distingue, y esos frames son
   *  los que necesita el compositor para que el scroll vaya suelto. */
  const MS_POR_FRAME = 1000 / 30;
  let ultimoFrame = 0;

  // Medidas cacheadas. Leer `clientWidth` dentro del bucle de render obliga al
  // navegador a recalcular layout en CADA frame (y durante el scroll eso es
  // layout thrashing en el hilo principal); el ResizeObserver da lo mismo gratis.
  let anchoCss = canvas.clientWidth;
  let altoCss = canvas.clientHeight;
  let redimensionar = true;
  let uniformesSucios = true;

  function aplicarUniformes() {
    gl!.uniform3fv(U.base, opts.base);
    gl!.uniform3fv(U.ca, opts.colorA);
    gl!.uniform3fv(U.cb, opts.colorB);
    gl!.uniform3fv(U.cc, opts.colorC);
    gl!.uniform1f(U.intensity, opts.intensity);
    gl!.uniform1f(U.scale, opts.scale);
    gl!.uniform1f(U.warp, opts.warp);
    gl!.uniform1f(U.swirl, opts.swirl);
  }

  function aplicarTamano() {
    const escala = Math.min(ESCALA_RENDER, ANCHO_MAX_PX / Math.max(1, anchoCss));
    const w = Math.max(1, Math.round(anchoCss * escala));
    const h = Math.max(1, Math.round(altoCss * escala));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      gl!.viewport(0, 0, w, h);
      gl!.uniform2f(U.res, w, h);
    }
  }

  function draw(now: number) {
    if (redimensionar) { aplicarTamano(); redimensionar = false; }
    if (uniformesSucios) { aplicarUniformes(); uniformesSucios = false; }
    gl!.uniform1f(U.time, ((now - start) / 1000) * opts.speed);
    gl!.drawArrays(gl!.TRIANGLES, 0, 3);
  }

  function loop(now: number) {
    if (!active) return;
    raf = requestAnimationFrame(loop);
    if (now - ultimoFrame < MS_POR_FRAME) return;
    ultimoFrame = now;
    draw(now);
  }

  const ro = new ResizeObserver((entries) => {
    const caja = entries[0]?.contentRect;
    if (caja) { anchoCss = caja.width; altoCss = caja.height; }
    redimensionar = true;
    if (!active) draw(performance.now());
  });
  ro.observe(canvas);

  draw(performance.now()); // primer frame inmediato (evita parpadeo)
  raf = requestAnimationFrame(loop);

  return {
    setActive(a: boolean) {
      if (a === active) return;
      active = a;
      if (a) raf = requestAnimationFrame(loop);
      else cancelAnimationFrame(raf);
    },
    setOptions(next) {
      opts = { ...opts, ...next };
      uniformesSucios = true;
      if (!active) draw(performance.now());
    },
    destroy() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      gl.deleteProgram(prog);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      gl.deleteBuffer(buf);
      const ext = gl.getExtension('WEBGL_lose_context');
      if (ext) ext.loseContext();
    },
  };
}
