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
// Mobile: 30fps cap; Desktop: uncapped (60fps)
const FRAME_INTERVAL = isMobile ? 1000 / 30 : 0

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

// Mobile: 20 bubbles + early discard; Desktop: 40 bubbles (original)
function getFragmentShader(bubbleCount: number, useEarlyDiscard: boolean): string {
  const earlySkip = useEarlyDiscard ? 'if (dis > rad * 1.2) continue;' : ''
  return `
precision mediump float;

uniform float iTime;
uniform vec2 iResolution;
uniform float isDark;

float hash(float n) {
  return fract(sin(dot(vec2(n, n), vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
  vec2 uv = -1.0 + 2.0 * gl_FragCoord.xy / iResolution.xy;
  uv.x *= iResolution.x / iResolution.y;

  vec3 lightBg = vec3(0.96 + 0.04 * uv.y);
  vec3 darkBg = vec3(0.08 + 0.03 * uv.y);
  vec3 color = mix(lightBg, darkBg, isDark);

  for (int i = 0; i < ${bubbleCount}; i++) {
    float pha = sin(float(i) * 546.13 + 1.0) * 0.5 + 0.5;
    float siz = pow(sin(float(i) * 651.74 + 5.0) * 0.5 + 0.5, 4.0);
    float pox = sin(float(i) * 321.55 + 4.1) * iResolution.x / iResolution.y;

    float rad = 0.1 + 0.5 * siz;
    vec2 pos = vec2(pox, -1.0 - rad + (2.0 + 2.0 * rad) * mod(pha + 0.1 * iTime * (0.2 + 0.8 * siz), 1.0));
    float dis = length(uv - pos);

    ${earlySkip}

    // Light mode: warm orange to cool blue
    vec3 col = mix(vec3(0.94, 0.3, 0.0), vec3(0.1, 0.4, 0.8), 0.5 + 0.5 * sin(float(i) * 1.2 + 1.9));
    // Dark mode: deep blue to teal, much lower saturation to stay subtle
    vec3 darkCol = mix(vec3(0.12, 0.2, 0.45), vec3(0.08, 0.3, 0.35), 0.5 + 0.5 * sin(float(i) * 1.2 + 1.9));
    col = mix(col, darkCol, isDark);

    float f = dis / rad;
    f = sqrt(clamp(1.0 - f * f, 0.0, 1.0));

    vec3 contribution = col.zyx * (1.0 - smoothstep(rad * 0.95, rad, dis)) * f;
    // Light: subtract for depth; Dark: add gently (0.2 instead of 0.4)
    color = mix(color - contribution * 0.8, color + contribution * 0.2, isDark);
  }

  color *= sqrt(1.5 - 0.5 * length(uv));
  gl_FragColor = vec4(color, 1.0);
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
    console.warn('[ShaderBackground] Shader compile error:', glCtx.getShaderInfoLog(shader))
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
    powerPreference: isMobile ? 'low-power' : 'default',
  })
  if (!gl)
    return false

  const bubbleCount = isMobile ? 20 : 40
  const vs = createShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER)
  const fs = createShader(gl, gl.FRAGMENT_SHADER, getFragmentShader(bubbleCount, isMobile))
  if (!vs || !fs)
    return false

  program = gl.createProgram()
  if (!program)
    return false

  gl.attachShader(program, vs)
  gl.attachShader(program, fs)
  gl.linkProgram(program)

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.warn('[ShaderBackground] Program link error:', gl.getProgramInfoLog(program))
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

  // Mobile: 0.35x resolution; Desktop: 1x (full resolution)
  const dpr = isMobile ? 0.35 : 1.0
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

  // Mobile: 30fps throttle; Desktop: no throttle
  if (FRAME_INTERVAL && now - lastFrameTime < FRAME_INTERVAL)
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
