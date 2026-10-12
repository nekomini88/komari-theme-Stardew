<script setup lang="ts">
/**
 * SceneLife —— 场景生态层：田地作物生长循环 + 动物彩蛋（DESIGN_REFERENCE §4/§5）。
 *
 * - 全部为**内联 SVG + CSS 动画**（平滑手绘感，无位图、无新依赖）。
 * - 摆放/时机来自 @/v2/theme/life 的**确定性伪随机**（按季节播种）→ 刷新不乱跳。
 * - 挂在 SceneStack 的 ground 图层内，永远位于卡片内容层（.vk-main, z-index 1）之下。
 *
 * 可见性口径（本轮重点）：
 *   ① 田地：作物贴着**内容列左右两侧的可见草场**成排种下（每侧 4 排 × 2 株 = 24 株），
 *      尺寸放大（~46×92 SVG）、加深描边、按阶段给不同轮廓（苗/长成/结果/枯），
 *      一眼能看出生长阶段；田块锚在内容列左右边缘之外 → 与卡片矩形无重叠。
 *   ② 动物：鹿/兔/鸟放大到可辨认尺度（scale 1.3..1.75，~60px 高），
 *      沿地平线带（卡片网格之所以上的露台带）横穿 → 全宽可见且不压卡片。
 *
 * 尊重 prefers-reduced-motion：动画关闭 → 植物退化为静态阶段，动物不现身。
 */
import { computed } from 'vue'
import type { Season, TimeOfDay } from '@/v2/theme/sceneState'
import { cropPlots, faunaPlan } from '@/v2/theme/life'
import type { FieldCrop } from '@/v2/theme/life'

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

/** 两侧田块作物（确定性） */
const cropRows = computed(() => cropPlots(props.season))
const leftField = computed(() => cropRows.value.filter(c => c.side === 'left'))
const rightField = computed(() => cropRows.value.filter(c => c.side === 'right'))
const fauna = computed(() => faunaPlan(props.season))

/** 夜/昏仍显示生态，但夜里更安静：动物只在白天露面 */
const showFauna = computed(() => props.time === 'day' || props.force)

/** 田垄基线（距视口顶）：远排高、近排低 → 成排田地的纵深。行数 = life.ts FIELD_ROWS */
const ROW_TOP = ['47vh', '59vh', '71vh', '84vh'] as const
/** 株列横向锚点（田块内 px，贴内容列一侧） */
const COL_LEFT = [31, 92] as const

const fieldCropStyle = (c: FieldCrop) => ({
  top: ROW_TOP[c.row] ?? '59vh',
  left: `${COL_LEFT[c.col] ?? 31}px`,
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
         左右各一块成畦田地，锚在内容列左右边缘之外 → 与卡片无重叠。 -->
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
          <svg class="vk-crop-svg" viewBox="0 0 46 92" preserveAspectRatio="xMidYMax meet">
            <!-- 田垄土堆（深描边 → 与草色区分） -->
            <ellipse class="vk-p-soil" cx="23" cy="88" rx="15" ry="4.6" />
            <path class="vk-p-ridge" d="M10 86Q23 92 36 86" />
            <!-- 萌发 -->
            <g class="vk-p-sprout">
              <path class="vk-p-stem" d="M23 88C23 80 23 75 23 69" />
              <path class="vk-p-blade" d="M23 74C17.5 72.5 14 68.5 13.5 63.5C18.5 64.5 22 68.5 23 73Z" />
              <path class="vk-p-blade" d="M23 74C28.5 72.5 32 68.5 32.5 63.5C27.5 64.5 24 68.5 23 73Z" />
            </g>
            <!-- 生长 -->
            <g class="vk-p-leaf">
              <path class="vk-p-stem" d="M23 88C23 68 22.6 46 23 21" />
              <path class="vk-p-blade" d="M23 68C16 66 11.5 61 11 54.5C17 56 21.5 61 23 67Z" />
              <path class="vk-p-blade" d="M23 68C30 66 34.5 61 35 54.5C29 56 24.5 61 23 67Z" />
              <path class="vk-p-blade" d="M23 53C16.5 51.5 12.5 47 12 41C17.5 42.5 21.5 47 23 52Z" />
              <path class="vk-p-blade" d="M23 53C29.5 51.5 33.5 47 34 41C28.5 42.5 24.5 47 23 52Z" />
              <path class="vk-p-blade" d="M23 38C17.8 36.6 14.8 33 14.3 28C18.8 29 21.7 32.6 23 37Z" />
              <path class="vk-p-blade" d="M23 38C28.2 36.6 31.2 33 31.7 28C27.2 29 24.3 32.6 23 37Z" />
            </g>
            <!-- 结果（硕大果实 → 一眼区分） -->
            <g class="vk-p-fruit">
              <circle cx="14.5" cy="47" r="6.2" />
              <circle cx="31.5" cy="53" r="5.4" />
              <circle cx="23" cy="31" r="6.6" />
            </g>
            <!-- 枯萎（冬覆雪） -->
            <g class="vk-p-wither">
              <path class="vk-p-dry" d="M23 88C23 74 19 64 12 55" />
              <path class="vk-p-dry" d="M23 88C23 76 28 66 35 57" />
              <path class="vk-p-dry" d="M23 88C23 78 23 68 23 57" />
              <path class="vk-p-snow" d="M23 88C23 74 19 64 12 55C19 53 24 56 27 60C31 56 37 55 40 59C34 61 30 66 28.5 72Z" />
            </g>
          </svg>
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
          <!-- 小鹿 -->
          <svg v-if="f.kind === 'deer'" class="vk-fauna-svg" viewBox="0 0 58 40">
            <path class="vk-f-leg" d="M18 27v9" />
            <path class="vk-f-leg" d="M27 27v9" />
            <path class="vk-f-leg" d="M38 27v9" />
            <path class="vk-f-leg" d="M46 27v9" />
            <ellipse class="vk-f-body" cx="32" cy="22" rx="16" ry="8.4" />
            <path class="vk-f-neck" d="M45 19C47 13 49 10 53 8C51 14 49 18 47 21Z" />
            <ellipse class="vk-f-head" cx="52" cy="9" rx="5.4" ry="4" />
            <path class="vk-f-antler" d="M51 5C51 2.5 49 1 46.5 1M51 5C53 3 55.5 2.4 57 3" />
            <circle class="vk-f-eye" cx="53.4" cy="8.4" r="0.9" />
            <path class="vk-f-tail" d="M16 19C13.5 17.5 13 15.5 14 14C16 15 17.5 17 18 19Z" />
          </svg>
          <!-- 野兔 -->
          <svg v-else-if="f.kind === 'rabbit'" class="vk-fauna-svg" viewBox="0 0 36 32">
            <ellipse class="vk-f-body" cx="19" cy="20" rx="10" ry="8" />
            <ellipse class="vk-f-head" cx="10" cy="15" rx="5.4" ry="5" />
            <path class="vk-f-ear" d="M8.5 10C7.5 5 8 2 9.4 1C10.6 2.4 11 6 10.6 10Z" />
            <path class="vk-f-ear" d="M12.5 10C12.6 5 13.6 2.4 15 2C15.6 4 15.2 7 13.8 10.4Z" />
            <circle class="vk-f-eye" cx="8.4" cy="14.4" r="0.9" />
            <ellipse class="vk-f-tail" cx="29" cy="21" rx="2.6" ry="2.6" />
          </svg>
          <!-- 小鸟 -->
          <svg v-else class="vk-fauna-svg" viewBox="0 0 34 22">
            <ellipse class="vk-f-body" cx="16" cy="12" rx="9" ry="6.4" />
            <ellipse class="vk-f-head" cx="24" cy="8" rx="4.4" ry="4" />
            <path class="vk-f-wing" d="M12 10C7 8 5 10 6 14C10 15 14 14 17 12Z" />
            <path class="vk-f-beak" d="M28 7.4L32.5 8.6L28 9.8Z" />
            <circle class="vk-f-eye" cx="25.4" cy="7.4" r="0.85" />
            <path class="vk-f-tail" d="M7 11C4 10 2 11 2 13C4.5 13 6.5 12.5 8 12Z" />
          </svg>
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

/* ---------------- 作物 ---------------- */
.vk-crop {
  position: absolute;
  transform-origin: 50% 100%;
  /* 站在该排基线（图元向上生长），并整体放大到可辨认尺度 */
  transform: translate(-50%, -100%) scale(var(--vk-crop-scale, 1));
  width: 46px;
  height: 92px;
  will-change: transform;
}

.vk-crop-sway {
  width: 100%;
  height: 100%;
  transform-origin: 50% 100%;
  animation: vk-crop-sway var(--vk-crop-sway, 4s) ease-in-out infinite;
  animation-delay: var(--vk-crop-delay, 0s);
}

.vk-crop-svg {
  display: block;
  width: 100%;
  height: 100%;
  overflow: visible;
  /* 投影把作物从草地上「拎」出来，保证与背景有区分度 */
  filter: drop-shadow(0 2px 2px color-mix(in srgb, var(--vk-wood-deep) 34%, transparent));
}

/* 田垄土堆：深色描边 + 亮面，明确「这是田地里的作物」 */
.vk-p-soil {
  fill: var(--vk-soil);
  stroke: color-mix(in srgb, var(--vk-wood-deep) 52%, transparent);
  stroke-width: 1.6;
  opacity: 0.92;
}

.vk-p-ridge {
  fill: none;
  stroke: color-mix(in srgb, var(--vk-soil-lo) 78%, transparent);
  stroke-width: 2;
  stroke-linecap: round;
}

.vk-p-stem {
  fill: none;
  stroke: var(--vk-moss-dark);
  stroke-width: 3.1;
  stroke-linecap: round;
}

.vk-p-dry {
  fill: none;
  stroke: var(--vk-bark);
  stroke-width: 2.8;
  stroke-linecap: round;
}

.vk-p-blade {
  fill: var(--vk-crop-leaf, var(--vk-leaf));
  stroke: color-mix(in srgb, var(--vk-wood-deep) 66%, transparent);
  stroke-width: 1.2;
  stroke-linejoin: round;
}

.vk-p-fruit {
  fill: var(--vk-crop-fruit, var(--vk-honey));
  stroke: color-mix(in srgb, var(--vk-wood-deep) 58%, transparent);
  stroke-width: 1.1;
  filter: drop-shadow(0 1.4px 1.2px color-mix(in srgb, var(--vk-wood-deep) 44%, transparent));
}

.vk-p-snow {
  fill: var(--vk-paper-cream);
  stroke: color-mix(in srgb, var(--vk-ink-soft) 44%, transparent);
  stroke-width: 0.9;
  opacity: 0;
}

/* 季节配色（「与季节挂钩」）：春嫩绿 / 夏浓绿 / 秋暖橙 / 冬枯棕 */
.vk-crop[data-season='spring'] { --vk-crop-leaf: var(--vk-leaf-hi); }
.vk-crop[data-season='summer'] { --vk-crop-leaf: var(--vk-leaf); --vk-crop-fruit: var(--vk-honey-hi); }
.vk-crop[data-season='autumn'] { --vk-crop-leaf: var(--vk-warm-hi); --vk-crop-fruit: var(--vk-honey); }
.vk-crop[data-season='winter'] { --vk-crop-leaf: var(--vk-moss-dark); --vk-crop-fruit: var(--vk-paper-deep); }

.vk-crop[data-season='winter'] .vk-p-snow { opacity: 1; }

/* 静态（= reduced-motion / 动画未起）时按阶段决定可见性 */
.vk-crop[data-stage='sprout'] .vk-p-leaf,
.vk-crop[data-stage='sprout'] .vk-p-fruit,
.vk-crop[data-stage='sprout'] .vk-p-wither { opacity: 0; }
.vk-crop[data-stage='grow'] .vk-p-sprout,
.vk-crop[data-stage='grow'] .vk-p-fruit,
.vk-crop[data-stage='grow'] .vk-p-wither { opacity: 0; }
.vk-crop[data-stage='fruit'] .vk-p-sprout,
.vk-crop[data-stage='fruit'] .vk-p-wither { opacity: 0; }
.vk-crop[data-stage='wither'] .vk-p-sprout,
.vk-crop[data-stage='wither'] .vk-p-leaf,
.vk-crop[data-stage='wither'] .vk-p-fruit { opacity: 0; }

/* 生长循环动画：四组图元共享 24s 周期、各自百分比错开 → 萌发→生长→结果→枯萎循环 */
.vk-p-sprout { animation: vk-st-sprout 24s linear infinite; animation-delay: var(--vk-crop-delay, 0s); transform-origin: 50% 100%; }
.vk-p-leaf { animation: vk-st-leaf 24s linear infinite; animation-delay: var(--vk-crop-delay, 0s); transform-origin: 50% 100%; }
.vk-p-fruit { animation: vk-st-fruit 24s ease-in-out infinite; animation-delay: var(--vk-crop-delay, 0s); }
.vk-p-wither { animation: vk-st-wither 24s linear infinite; animation-delay: var(--vk-crop-delay, 0s); }

@keyframes vk-crop-sway {
  0%, 100% { transform: rotate(-2.4deg); }
  50% { transform: rotate(2.4deg); }
}
@keyframes vk-st-sprout {
  0% { opacity: 1; }
  12% { opacity: 1; }
  20% { opacity: 0; }
  100% { opacity: 0; }
}
@keyframes vk-st-leaf {
  0% { opacity: 0; transform: scaleY(0.55); }
  14% { opacity: 0; transform: scaleY(0.55); }
  30% { opacity: 1; transform: scaleY(1); }
  74% { opacity: 1; transform: scaleY(1); }
  90% { opacity: 0; transform: scaleY(0.7); }
  100% { opacity: 0; transform: scaleY(0.55); }
}
@keyframes vk-st-fruit {
  0% { opacity: 0; transform: scale(0.4); }
  46% { opacity: 0; transform: scale(0.4); }
  62% { opacity: 1; transform: scale(1); }
  78% { opacity: 1; transform: scale(1); }
  86% { opacity: 0; transform: scale(0.6); }
  100% { opacity: 0; transform: scale(0.4); }
}
@keyframes vk-st-wither {
  0% { opacity: 0; }
  80% { opacity: 0; }
  92% { opacity: 1; }
  100% { opacity: 1; }
}

/* ---------------- 动物彩蛋 ---------------- */
.vk-fauna-item {
  position: absolute;
  top: calc(var(--vk-life-line) + var(--vk-fauna-lift, 0px));
  left: 0;
  width: 58px;
  height: 40px;
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

.vk-fauna-svg {
  display: block;
  width: 100%;
  height: 100%;
  overflow: visible;
  filter: drop-shadow(0 2px 2px color-mix(in srgb, var(--vk-wood-deep) 40%, transparent));
}

/* 动物配色（同一套暖色系，与场景协调；深描边保证在浅天空/草地上都看得清） */
.vk-f-body { fill: var(--vk-wood); stroke: color-mix(in srgb, var(--vk-wood-deep) 60%, transparent); stroke-width: 1; }
.vk-f-head { fill: var(--vk-wood); stroke: color-mix(in srgb, var(--vk-wood-deep) 60%, transparent); stroke-width: 1; }
.vk-f-neck { fill: var(--vk-wood); stroke: color-mix(in srgb, var(--vk-wood-deep) 60%, transparent); stroke-width: 1; }
.vk-f-leg { fill: none; stroke: var(--vk-soil-lo); stroke-width: 2.4; stroke-linecap: round; }
.vk-f-tail { fill: var(--vk-paper-deep); }
.vk-f-antler { fill: none; stroke: var(--vk-ink-soft); stroke-width: 1.7; stroke-linecap: round; }
.vk-f-ear { fill: var(--vk-wood); stroke: color-mix(in srgb, var(--vk-wood-deep) 56%, transparent); stroke-width: 0.9; }
.vk-f-eye { fill: var(--vk-outline); }
.vk-f-wing { fill: var(--vk-wood-light); stroke: color-mix(in srgb, var(--vk-wood-deep) 48%, transparent); stroke-width: 0.8; }
.vk-f-beak { fill: var(--vk-honey); }

.vk-fauna-item[data-kind='deer'] { width: 58px; height: 40px; }
.vk-fauna-item[data-kind='rabbit'] { width: 40px; height: 34px; }
.vk-fauna-item[data-kind='bird'] { width: 40px; height: 26px; }
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

/* 尊重「减少动态效果」：植物退化为季节静态阶段，动物不现身 */
@media (prefers-reduced-motion: reduce) {
  .vk-crop-sway,
  .vk-p-sprout,
  .vk-p-leaf,
  .vk-p-fruit,
  .vk-p-wither,
  .vk-fauna-move {
    animation: none !important;
  }
  .vk-p-sprout,
  .vk-p-leaf,
  .vk-p-fruit,
  .vk-p-wither {
    transform: none !important;
  }
}
</style>
