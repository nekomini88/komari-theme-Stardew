<script setup lang="ts">
import { useDocumentVisibility, useElementVisibility } from '@vueuse/core'
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useAppStore } from '@/stores/app'

const appStore = useAppStore()
const canvasRef = ref<HTMLCanvasElement>()
let gl: WebGLRenderingContext | null = null
let program: WebGLProgram | null = null
let animationId = 0
let startTime = 0
let lastFrameTime = 0

const isMobile = window.innerWidth < 768
// Mobile: 24fps cap; Desktop: uncapped (60fps)
const FRAME_INTERVAL = isMobile ? 1000 / 24 : 0

// Visibility-based pause
const documentVisibility = useDocumentVisibility()
const elementVisible = useElementVisibility(canvasRef)

// Cache uniform locations
let uTimeLoc: WebGLUniformLocation | null = null
let uResLoc: WebGLUniformLocation | null = null
let uDarkLoc: WebGLUniformLocation | null = null

const VERTEX_SHADER = `
attribute vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`

function getFragmentShader(maxIter: number): string {
  return `
precision mediump float;

uniform float iTime;
uniform vec2 iResolution;
uniform float isDark;

#define EPS 0.001
#define DAY_SPEED 3.0
#define SEASON -1.0
#define FOLLOW_SUN 0.25
#define MAX_ITER ${maxIter}
#define MAX_DIST 40.0

vec3 rotationX(vec3 pos, float angle) {
  float c = cos(angle);
  float s = sin(angle);
  vec3 rotPos;
  rotPos.x = pos.x;
  rotPos.y = c * pos.y - s * pos.z;
  rotPos.z = s * pos.y + c * pos.z;
  return rotPos;
}

vec2 rotuv(vec2 uv, float angle, vec2 center) {
  return mat2(cos(angle), -sin(angle), sin(angle), cos(angle)) * (uv - center) + center;
}

float hash(float n) {
  return fract(sin(dot(vec2(n, n), vec2(12.9898, 78.233))) * 43758.5453);
}

float smin(float a, float b, float k) {
  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}

float cell0(vec2 uv) {
  vec2 uv2 = sin(uv);
  return uv2.x * uv2.y;
}

float cellCombine0(vec2 uv, float randSeed, float v, float s) {
  float r1 = hash(randSeed);
  float angle1 = r1 * 360.0 + (r1 * 2.0 - 1.0) * iTime * 0.5 * s;
  float c = cell0(rotuv(uv * (1.0 + r1 * v), angle1, vec2(r1, hash(r1))));
  for (int i = 0; i < 3; i++) {
    float r = hash(float(i) * randSeed);
    float angle = r * 360.0 + (r * 2.0 - 1.0) * iTime * 0.5 * s;
    float nc = cell0(rotuv(uv * (1.0 + r * v) + c, angle, vec2(r, hash(r)) * 10.0));
    c = mix(c, nc, 0.5);
  }
  return c;
}

float cell1(vec2 uv) {
  vec2 uv2 = abs(sin(uv));
  return uv2.x * uv2.y;
}

float cellCombine1(vec2 uv, float randSeed, float v, float s) {
  float r1 = hash(randSeed);
  float angle1 = r1 * 360.0 + (r1 * 2.0 - 1.0) * iTime * 0.5 * s;
  float c = cell1(rotuv(uv * (1.0 + r1 * v), angle1, vec2(r1, hash(r1))));
  for (int i = 0; i < 5; i++) {
    float r = hash(float(i) * randSeed);
    float angle = r * 360.0 + (r * 2.0 - 1.0) * iTime * 0.5 * s;
    float nc = cell1(rotuv(uv * (1.0 + r * v) + c, angle, vec2(r, hash(r)) * 10.0));
    c = max(c, nc);
  }
  return c;
}

float cell2(vec2 uv) {
  vec2 uv2 = abs(fract(uv) - vec2(0.5));
  return smoothstep(0.98, 1.0, (uv2.x + uv2.y));
}

float cellCombine2(vec2 uv, float randSeed, float v, float s) {
  float r1 = hash(randSeed);
  float angle1 = r1 * 360.0 + (r1 * 2.0 - 1.0) * iTime * 0.5 * s;
  float c = cell2(rotuv(uv * (1.0 + r1 * v), angle1, vec2(r1, hash(r1))));
  for (int i = 0; i < 7; i++) {
    float r = hash(float(i) * randSeed);
    float angle = r * 360.0 + (r * 2.0 - 1.0) * iTime * 0.5 * s;
    float nc = cell2(rotuv(uv * (1.0 + r * v), angle, vec2(r, hash(r)) * 10.0));
    c += nc * (0.5 + r);
  }
  return c;
}

float distfunc(vec3 pos) {
  float n0 = cellCombine0(pos.xz * 0.3, 10.98765, 0.5, 0.0);
  float n1 = 1.0 - cellCombine1(pos.xz * 0.2, 5.5678, 0.5, 0.0);
  float n2 = 1.0 - cellCombine1(pos.xz * vec2(1.5, 3.0), 8.5548, 0.5, 0.0);
  return pos.y - n0 * 2.0 - n1 * 2.0 - n2 * 0.1;
}

vec2 rayMarch(vec3 rayDir, vec3 cameraOrigin) {
  float totalDist = 0.0;
  vec3 pos = cameraOrigin;
  float dist = EPS;
  for (int i = 0; i < MAX_ITER; i++) {
    dist = distfunc(pos);
    // Adaptive step: overshoot slightly when far from surface (safe for smooth SDF)
    float step = dist * (totalDist > 10.0 ? 1.2 : 1.0);
    totalDist += step;
    pos += step * rayDir;
    if (dist < EPS || totalDist > MAX_DIST) {
      break;
    }
  }
  return vec2(dist, totalDist);
}

vec3 skyBox(vec3 rayDir, vec3 sunDir, vec3 sunColor, float dayCycle1, float dayCycle2, float blur) {
  vec3 rotDir = rotationX(rayDir, -iTime * 0.5 * 0.01);
  vec2 starUvs = vec2(atan(rotDir.x, rotDir.z), rotDir.y * 4.0) * 2.0;
  float stars = clamp(clamp(cellCombine2(starUvs, 3259.5741, 0.5, 0.0), 0.0, 1.0) + (1.0 - blur), 0.0, 1.0);
  vec3 skyColor1 = mix(vec3(0.05, 0.05, 0.2) + stars, mix(vec3(0.5, 0.2, 0.5), vec3(0.25, 0.25, 1.0), dayCycle1), dayCycle2);
  vec3 skyColor2 = mix(vec3(0.25, 0.25, 0.35), mix(vec3(0.8, 0.4, 0.2), vec3(1.0, 1.0, 1.0), dayCycle1), dayCycle2);
  vec3 groundColor1 = mix(vec3(0.25, 0.22, 0.3), mix(vec3(0.5, 0.3, 0.2), vec3(1.0, 0.9, 0.75), dayCycle1), dayCycle2);

  float sunPos = length(rayDir - sunDir);
  float sunBall = 1.0 - smoothstep(0.04, 0.05 * blur, sunPos);
  float sunGlow = 1.0 - smoothstep(0.03, 0.5 * blur, sunPos);
  float sunInnerGlow = 1.0 - smoothstep(0.0, 0.05 * blur, sunPos);
  vec3 sun = ((sunBall + sunGlow) / blur) * sunColor + vec3(sunInnerGlow);

  vec3 skyColor = mix(skyColor2, skyColor1, clamp(rayDir.y * 1.5, 0.0, 1.0));

  // Dark mode: shift sky cooler with blue tint
  skyColor = mix(skyColor, skyColor + vec3(-0.05, -0.02, 0.12), isDark);

  float m = smoothstep(0.0, 0.05, (rayDir.y + 0.1) * blur);
  return mix(groundColor1, skyColor + sun, m);
}

vec3 lensFlare(vec3 rayDir, vec3 sunDir, vec3 sunColor, float dayCycle1) {
  vec3 l = vec3(0.0);
  for (int i = 0; i < 4; i++) {
    float d = 0.22;
    float lensDistance = d + float(i) * d;
    vec3 rvec = vec3(0.0, 0.0, 1.0);
    vec3 sunvec = vec3(sunDir.x, -sunDir.y, sunDir.z);
    float lPos = length(rayDir - normalize(mix(sunDir, reflect(sunvec, rvec), lensDistance)));
    float growFactor = (1.0 + float(i) * float(i));
    float lGlow = 1.0 - smoothstep(0.01 * growFactor, 0.05 * growFactor, lPos);
    l += mix(vec3(1.0), vec3(0.5, 0.5, 2.0), lensDistance) * lensDistance * lGlow;
  }
  float lPosv = 1.0 - clamp(length(rayDir.xz - sunDir.xz), 0.0, 1.0);
  float lGlowv = pow(lPosv, 50.0);
  vec3 lens = (l + lGlowv) * sunColor * dayCycle1;
  return lens;
}

mat3 setCamera(in vec3 ro, in vec3 ta, float cr) {
  vec3 cw = normalize(ta - ro);
  vec3 cp = vec3(sin(cr), cos(cr), 0.0);
  vec3 cu = normalize(cross(cw, cp));
  vec3 cv = normalize(cross(cu, cw));
  return mat3(cu, cv, cw);
}

vec3 calculateNormals(vec3 pos) {
  vec2 e = vec2(0.0, 0.02);
  float X = distfunc(pos + e.yxx) - distfunc(pos - e.yxx);
  float Y = distfunc(pos + e.xyx) - distfunc(pos - e.xyx);
  float Z = distfunc(pos + e.xxy) - distfunc(pos - e.xxy);
  return normalize(vec3(X, Y, Z));
}

vec3 lighting(vec3 pos, vec3 rayDir, vec3 light, vec3 sunColor, float dayCycle1, float dayCycle2, vec3 n) {
  vec3 ambSkyBox = skyBox(n, light, sunColor, dayCycle1, dayCycle2, 5.0);
  vec3 ambientColor = mix(ambSkyBox, clamp(ambSkyBox + 0.5, 0.0, 1.0), dayCycle1);
  vec3 diffuseColor = mix(vec3(1.0, 0.7, 0.5), vec3(1.0, 0.9, 0.6), pos.y * 0.65);
  vec3 specColor = vec3(1.0, 1.0, 1.0);

  float diff = dot(normalize(light), n);
  float fresnel = 1.0 - dot(n, -rayDir);
  vec3 r = reflect(normalize(rayDir), n);
  float spec = pow(max(0.0, dot(r, light)), 50.0);
  float specMap = cellCombine1(pos.xz * 3.0, 12458.5125, 1.0, 0.0);

  vec3 res = diffuseColor * ambientColor;
  res += diffuseColor * max(0.0, diff) * sunColor;
  res += specColor * spec * sunColor * fresnel * smoothstep(0.95, 1.0, specMap) * 5.0;
  res += sunColor * max(0.0, -diff) * 0.35;

  return res;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec3 light = normalize(vec3(SEASON, cos(DAY_SPEED), sin(DAY_SPEED)));

  vec2 screenPos = (fragCoord.xy / iResolution.xy) * 2.0 - 1.0;
  screenPos.x *= iResolution.x / iResolution.y;

  vec3 cameraOrigin = vec3(iTime * 0.5, 4.0, iTime * 0.5);
  vec3 cameraTarget = cameraOrigin + mix(vec3(-1.0, 0.0, 0.0), light, FOLLOW_SUN);

  mat3 cam = setCamera(cameraOrigin, cameraTarget, 0.0);

  vec3 rayDir = cam * normalize(vec3(screenPos, 0.75));

  float dayCycle = dot(light, vec3(0.0, 1.0, 0.0));
  float dayCycle1 = smoothstep(0.0, 0.5, max(0.0, dayCycle));
  float dayCycle2 = smoothstep(0.5, 1.0, min(dayCycle + 1.0, 1.0));
  vec3 sunColor = mix(vec3(0.5, 0.2, 0.0), vec3(0.4, 0.4, 0.2), dayCycle1);
  vec3 dayLight = mix(vec3(0.2, 0.2, 0.4), sunColor, dayCycle2);

  vec3 sky = skyBox(rayDir, light, dayLight, dayCycle1, dayCycle2, 1.0);
  vec3 lens = lensFlare(rayDir, light, dayLight, dayCycle1);
  vec3 res;

  // Early sky exit: rays pointing upward won't hit the surface
  if (rayDir.y > 0.35) {
    res = sky;
  } else {
    vec2 dist = rayMarch(rayDir, cameraOrigin);
    if (dist.x < EPS) {
      vec3 pos = cameraOrigin + dist.y * rayDir;
      vec3 n = calculateNormals(pos);
      float fog = clamp((dist.y - 18.0) * 0.05, 0.0, 1.0);
      float fogY = (1.0 - clamp((pos.y + 0.5) * 0.5, 0.0, 1.0)) * 0.8;
      res = mix(lighting(pos, rayDir, light, dayLight, dayCycle1, dayCycle2, n), sky, clamp(fog + fogY, 0.0, 1.0));
    } else {
      res = sky;
    }
  }

  float vign = 1.0 - smoothstep(0.5, 1.0, length(screenPos) * 0.5);

  vec4 finalColor = vec4(res + lens, 1.0) * (0.75 + vign * 0.25);

  // Dark mode: darken overall output
  finalColor.rgb *= mix(1.0, 0.7, isDark);

  fragColor = finalColor;
}

void main() {
  mainImage(gl_FragColor, gl_FragCoord.xy);
}
`
}

function createShader(glCtx: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
  const shader = glCtx.createShader(type)
  if (!shader)
    return null
  glCtx.shaderSource(shader, source)
  glCtx.compileShader(shader)
  if (!glCtx.getShaderParameter(shader, glCtx.COMPILE_STATUS)) {
    console.warn('[ShaderBackgroundLiquid] Shader compile error:', glCtx.getShaderInfoLog(shader))
    glCtx.deleteShader(shader)
    return null
  }
  return shader
}

function initWebGL() {
  const canvas = canvasRef.value
  if (!canvas)
    return false

  gl = canvas.getContext('webgl', {
    alpha: false,
    antialias: false,
    preserveDrawingBuffer: false,
    powerPreference: isMobile ? 'low-power' : 'high-performance',
  })
  if (!gl)
    return false

  // Mobile: 50 iterations; Desktop: 150 iterations
  const maxIter = isMobile ? 50 : 150
  const vs = createShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER)
  const fs = createShader(gl, gl.FRAGMENT_SHADER, getFragmentShader(maxIter))
  if (!vs || !fs)
    return false

  program = gl.createProgram()
  if (!program)
    return false

  gl.attachShader(program, vs)
  gl.attachShader(program, fs)
  gl.linkProgram(program)

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.warn('[ShaderBackgroundLiquid] Program link error:', gl.getProgramInfoLog(program))
    return false
  }

  gl.useProgram(program)

  // Cache uniform locations
  uTimeLoc = gl.getUniformLocation(program, 'iTime')
  uResLoc = gl.getUniformLocation(program, 'iResolution')
  uDarkLoc = gl.getUniformLocation(program, 'isDark')

  // Full-screen quad
  const vertices = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1])
  const buffer = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
  gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW)

  const posAttr = gl.getAttribLocation(program, 'position')
  gl.enableVertexAttribArray(posAttr)
  gl.vertexAttribPointer(posAttr, 2, gl.FLOAT, false, 0, 0)

  return true
}

function resize() {
  const canvas = canvasRef.value
  if (!canvas)
    return

  // Mobile: 0.25x resolution; Desktop: 1x (full resolution)
  const dpr = isMobile ? 0.25 : 1.0
  const width = Math.floor(canvas.clientWidth * dpr)
  const height = Math.floor(canvas.clientHeight * dpr)

  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width
    canvas.height = height
    gl?.viewport(0, 0, width, height)
  }
}

function render(now: number) {
  if (!gl || !program)
    return

  animationId = requestAnimationFrame(render)

  // Pause when tab hidden or element off-screen
  if (documentVisibility.value !== 'visible' || !elementVisible.value)
    return

  // Frame rate throttle
  if (now - lastFrameTime < FRAME_INTERVAL)
    return
  lastFrameTime = now

  resize()

  const time = (now - startTime) / 1000.0
  gl.uniform1f(uTimeLoc, time)
  gl.uniform2f(uResLoc, canvasRef.value!.width, canvasRef.value!.height)
  gl.uniform1f(uDarkLoc, appStore.isDark ? 1.0 : 0.0)

  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
}

onMounted(() => {
  startTime = performance.now()
  lastFrameTime = startTime
  if (initWebGL()) {
    animationId = requestAnimationFrame(render)
  }
})

onBeforeUnmount(() => {
  if (animationId) {
    cancelAnimationFrame(animationId)
    animationId = 0
  }
  if (gl) {
    gl.getExtension('WEBGL_lose_context')?.loseContext()
    gl = null
  }
})
</script>

<template>
  <canvas
    ref="canvasRef"
    class="absolute inset-0 w-full h-full"
    aria-hidden="true"
  />
</template>
