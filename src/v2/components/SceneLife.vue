<script setup lang="ts">
/**
 * SceneLife —— 场景生态层：田地作物生长循环 + 动物彩蛋（DESIGN_REFERENCE §4/§5）。
 *
 * - 美术一律使用 **ListenHub 生成的手绘透明 PNG 插画**（`/images/v2-life/*.png`），
 *   不再有内联 SVG/CSS 手搓图形（用户口径：场景装饰美术不得手搓）。
 * - 摆放/时机来自 @/v2/theme/life 的**确定性伪随机**（按季节播种）→ 刷新不乱跳。
 * - 挂在 SceneStack 的 ground 图层内，永远位于卡片内容层（.vk-main, z-index 1）之下。
 *
 * 可见性口径：
 *   ① 田地：作物贴图（一整行作物插画）贴着**内容列左右两侧的可见草场**成畦种下
 *      （每侧 4 排），按生长阶段换图：萌发 / 生长 / 结果 / 枯萎 —— 与季节挂钩，
 *      一眼能看出生长阶段；田块锚在内容列左右边缘之外 → 与卡片矩形无重叠。
 *   ② 动物：鹿/兔/鸟沿地平线带（首行卡片之上的露台带）横穿 → 全宽可见且不压卡片。
 *
 * 尊重 prefers-reduced-motion：动画关闭 → 植物退化为静态阶段，动物不现身。
 */
import type { CropStage, FaunaKind } from '@/v2/theme/life'
import type { Season, TimeOfDay } from '@/v2/theme/sceneState'
import { computed } from 'vue'
import { cropPlots, faunaPlan } from '@/v2/theme/life'

const props = withDefaults(defineProps<{
  season?: Season
  time?: TimeOfDay
  /** 彩蛋取证：为真时把动物钉在画面里（截图/探针用），不影响默认低频行为 */
  force?: boolean
}>(), {
  season: 'summer',
  time: 'day',
  force: false,
})

/** 生长阶段 → ListenHub 手绘阶段插画（四阶段各一张透明 PNG） */
const STAGE_IMG: Record<CropStage, string> = {
  sprout: '/images/v2-life/crop-sprout.png',
  grow: '/images/v2-life/crop-grow.png',
  fruit: '/images/v2-life/crop-fruit.png',
  wither: '/images/v2-life/crop-wither.png',
}

/** 动物种类 → ListenHub 手绘动物插画 */
const FAUNA_IMG: Record<FaunaKind, string> = {
  deer: '/images/v2-life/animal-deer.png',
  rabbit: '/images/v2-life/animal-rabbit.png',
  bird: '/images/v2-life/animal-bird.png',
}

/** 两侧田块作物（确定性） */
const cropRows = computed(() => cropPlots(props.season))
const leftField = computed(() => cropRows.value.filter(c => c.side === 'left'))
const rightField = computed(() => cropRows.value.filter(c => c.side === 'right'))
const fauna = computed(() => faunaPlan(props.season))

/** 夜/昏仍显示生态，但夜里更安静：动物只在白天露面 */
const showFauna = computed(() => props.time === 'day' || props.force)

/** 田垄基线（距视口顶）：远排高、近排低 → 成排田地的纵深。行数 = life.ts FIELD_ROWS */
const ROW_TOP = ['47vh', '61vh', '75vh', '89vh'] as const

const fieldCropStyle = (c: { row: number, scale: number, delay: number, swayDur: number }) => ({
  top: ROW_TOP[c.row] ?? '61vh',
  '--vk-crop-scale': String(c.scale),
  '--vk-crop-delay': `${c.delay}s`,
  '--vk-crop-sway': `${c.swayDur}s`,
})

const faunaStyle = (f: { id: number, delay: number, duration: number, y: number, scale: number }) => ({
  '--vk-fauna-delay': `${f.delay}s`,
  '--vk-fauna-dur': `${f.duration}s`,
  '--vk-fauna-lift': `${f.y}px`,
  '--vk-fauna-scale': String(f.scale),
  /* 取证用的钉住位置：不同动物错开，便于一眼同框 */
  '--vk-fauna-pin': `${20 + f.id * 32}vw`,
})
</script>

<template>
  <div class="vk-life" data-life="plants+fauna" :data-season="season" aria-hidden="true">
    <!-- ============ 田地：作物生长循环（萌发 → 生长 → 结果 → 枯萎）============
         左右各一块成畦田地，锚在内容列左右边缘之外 → 与卡片无重叠。
         每株作物 = 一张 ListenHub 手绘阶段插画（透明 PNG）。 -->
    <div
      v-for="side in (['left', 'right'] as const)"
      :key="`field-${side}`"
      class="vk-field"
      :class="`vk-field--${side}`"
      :data-field-side="side"
    >
      <div
        v-for="c in (side === 'left' ? leftField : rightField)"
        :key="`crop-${side}-${c.id}`"
        class="vk-crop"
        data-life-part="crop"
        :data-side="side"
        :data-stage="c.stage"
        :data-season="season"
        :style="fieldCropStyle(c)"
      >
        <div class="vk-crop-sway">
          <img class="vk-crop-img" :src="STAGE_IMG[c.stage]" alt="" draggable="false">
        </div>
      </div>
    </div>

    <!-- ============ 随机动物彩蛋：小鹿 / 野兔 / 小鸟 偶尔现身走过 ============ -->
    <template v-if="showFauna">
      <div
        v-for="f in fauna"
        :key="`fauna-${f.id}`"
        class="vk-fauna-item"
        data-life-part="fauna"
        :data-kind="f.kind"
        :data-dir="f.dir"
        :class="{ 'is-forced': force }"
        :style="faunaStyle(f)"
      >
        <div class="vk-fauna-move">
          <img class="vk-fauna-img" :src="FAUNA_IMG[f.kind]" alt="" draggable="false">
        </div>
      </div>
    </template>
  </div>
</template>

<style>
/* ============================ 生态层容器 ============================
   挂在 ground 图层内（inset:0），子元素按视口坐标绝对定位。
   --vk-life-line：动物横穿的地平线带基线 —— 位于「卡片网格上方的露台带」，
   取 min(37vh, 336px)：在 1440×900 下 336px 落在首行卡片顶（343px）之上，
   故动物图元绝不与卡片矩形相交；再叠加 .vk-scene(z0) < .vk-main(z1) 的层级保证。
   --vk-field-half / --vk-field-gap：内容列（.vk-home max-width:1180px）半宽与间隙。
   两侧田块锚在「内容列左右边缘之外」→ 作物只落在可见草场上，与卡片无重叠。 */
.vk-life {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 5;
  --vk-life-line: min(37vh, 336px);
  --vk-field-half: 590px;
  --vk-field-gap: 6px;
}

/* ---------------- 田块（左右各一块） ---------------- */
.vk-field {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 124px;
}

.vk-field--left {
  right: calc(50% + var(--vk-field-half) + var(--vk-field-gap));
}

.vk-field--right {
  left: calc(50% + var(--vk-field-half) + var(--vk-field-gap));
}

/* ---------------- 作物（手绘插画贴图） ---------------- */
.vk-crop {
  position: absolute;
  left: 50%;
  /* 站在该排基线（贴图向上生长），并整体放大到可辨认尺度 */
  transform: translate(-50%, -100%) scale(var(--vk-crop-scale, 1));
  transform-origin: 50% 100%;
  width: var(--vk-crop-w, 116px);
  will-change: transform;
}

.vk-crop-sway {
  width: 100%;
  transform-origin: 50% 100%;
  animation: vk-crop-sway var(--vk-crop-sway, 4s) ease-in-out infinite;
  animation-delay: var(--vk-crop-delay, 0s);
}

.vk-crop-img {
  display: block;
  width: 100%;
  height: auto;
  user-select: none;
  /* 投影把作物从草地上「拎」出来，保证与背景有区分度 */
  filter: drop-shadow(0 3px 2px color-mix(in srgb, var(--vk-wood-deep) 34%, transparent));
}

/* ---------------- 动物彩蛋（手绘插画贴图） ---------------- */
.vk-fauna-item {
  position: absolute;
  top: calc(var(--vk-life-line) + var(--vk-fauna-lift, 0px));
  left: 0;
  transform: translateY(-100%) scale(var(--vk-fauna-scale, 1));
  transform-origin: 50% 100%;
}

.vk-fauna-move {
  width: 100%;
  height: 100%;
  opacity: 0;
  animation: vk-fauna-cross var(--vk-fauna-dur, 52s) linear infinite;
  animation-delay: var(--vk-fauna-delay, 0s);
}

.vk-fauna-item[data-dir='-1'] .vk-fauna-move {
  animation-name: vk-fauna-cross-rev;
}

/* 入场取证：把动物钉在画面里（截图/探针用），动画停用；两只错开位置便于同框 */
.vk-fauna-item.is-forced .vk-fauna-move {
  animation: none;
  opacity: 1;
  transform: translateX(var(--vk-fauna-pin, 44vw));
}

.vk-fauna-img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
  user-select: none;
  filter: drop-shadow(0 2px 2px color-mix(in srgb, var(--vk-wood-deep) 40%, transparent));
}

.vk-fauna-item[data-kind='deer'] { width: 54px; height: 68px; }
.vk-fauna-item[data-kind='rabbit'] { width: 48px; height: 56px; }
.vk-fauna-item[data-kind='bird'] { width: 46px; height: 30px; }
.vk-fauna-item[data-kind='rabbit'] .vk-fauna-move,
.vk-fauna-item[data-kind='bird'] .vk-fauna-move {
  animation-timing-function: ease-in-out;
}

/* 等待期静止在画面外 → 偶发穿越；末尾 ~16% 才可见（低频彩蛋） */
@keyframes vk-fauna-cross {
  0% { transform: translateX(-14vw) scaleX(1); opacity: 0; }
  82% { transform: translateX(-14vw) scaleX(1); opacity: 0; }
  84% { opacity: 1; }
  99% { opacity: 1; }
  100% { transform: translateX(112vw) scaleX(1); opacity: 0; }
}
@keyframes vk-fauna-cross-rev {
  0% { transform: translateX(112vw) scaleX(-1); opacity: 0; }
  82% { transform: translateX(112vw) scaleX(-1); opacity: 0; }
  84% { opacity: 1; }
  99% { opacity: 1; }
  100% { transform: translateX(-14vw) scaleX(-1); opacity: 0; }
}

/* 作物随风轻摆 */
@keyframes vk-crop-sway {
  0%, 100% { transform: rotate(-2.4deg); }
  50% { transform: rotate(2.4deg); }
}

/* 尊重「减少动态效果」：植物退化为季节静态阶段，动物不现身 */
@media (prefers-reduced-motion: reduce) {
  .vk-crop-sway,
  .vk-fauna-move {
    animation: none !important;
  }
}
</style>
