import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import SceneDecor from '@/v2/components/SceneDecor.vue'
import SceneStack from '@/v2/components/SceneStack.vue'
import { weatherFromDate } from '@/v2/theme/sceneState'
import type { Season } from '@/v2/theme/sceneState'

const root = resolve(__dirname, '..', '..')
const decorSrc = readFileSync(resolve(root, 'src/v2/components/SceneDecor.vue'), 'utf8')
const sceneCss = readFileSync(resolve(root, 'src/styles/v2/scene.css'), 'utf8')
const stackSrc = readFileSync(resolve(root, 'src/v2/components/SceneStack.vue'), 'utf8')

/**
 * 场景装饰素材契约（ListenHub 生成的透明 PNG，落 `/images/v2-scene/*.png`）：
 *  基础：太阳(带笑脸光芒) / 蓬松云 / 层叠丘陵 / 风车 / 房屋 / 灌木 / 小路
 *  P1-4：前景木栅栏 / 前景花丛
 *  P1-6：夜间亮窗房屋 / 月亮星空
 *  P2-7：春季樱花树 + 春花丛；秋季南瓜 + 干草垛 + 枫叶；冬季雪树 + 积雪丘
 *  侧树：白天左右独立树
 *  夜间：萤火虫
 *  天气（§2.3）：雨滴 / 雪花 / 雾带
 * 一律不得再用 CSS/SVG 手搓这些装饰图形。
 */
const DECOR_ASSETS: Record<string, string> = {
  'sun-smile': '/images/v2-scene/sun-smile.png',
  'cloud-puff': '/images/v2-scene/cloud-puff.png',
  'hills-layer': '/images/v2-scene/hills-layer.png',
  'windmill': '/images/v2-scene/windmill.png',
  'house': '/images/v2-scene/house.png',
  'bush': '/images/v2-scene/bush.png',
  'path': '/images/v2-scene/path.png',
  'fence-foreground': '/images/v2-scene/fence-foreground.png',
  'flowerbed-foreground': '/images/v2-scene/flowerbed-foreground.png',
  'house-night': '/images/v2-scene/house-night.png',
  'moon-stars': '/images/v2-scene/moon-stars.png',
  'spring-blossom': '/images/v2-scene/spring-blossom.png',
  'spring-flowers': '/images/v2-scene/spring-flowers.png',
  'day-tree': '/images/v2-scene/day-tree.png',
  'winter-snow-tree': '/images/v2-scene/winter-snow-tree.png',
  'winter-snow-patch': '/images/v2-scene/winter-snow-patch.png',
  'autumn-pumpkins': '/images/v2-scene/autumn-pumpkins.png',
  'autumn-haybale': '/images/v2-scene/autumn-haybale.png',
  'autumn-leaf': '/images/v2-scene/autumn-leaf.png',
  'night-firefly': '/images/v2-scene/night-firefly.png',
  'weather-raindrop': '/images/v2-scene/weather-raindrop.png',
  'weather-snowflake': '/images/v2-scene/weather-snowflake.png',
  'weather-fog': '/images/v2-scene/weather-fog.png',
}

const DECOR_SRC_RE = /^\/images\/v2-scene\/(sun-smile|cloud-puff|hills-layer|windmill|house|house-night|bush|path|fence-foreground|flowerbed-foreground|moon-stars|spring-blossom|spring-flowers|day-tree|winter-snow-tree|winter-snow-patch|autumn-pumpkins|autumn-haybale|autumn-leaf|night-firefly|weather-raindrop|weather-snowflake|weather-fog)\.png$/

describe('场景装饰素材：ListenHub 透明 PNG', () => {
  it('每张素材文件真实躺在 public/images/v2-scene/ 下', () => {
    for (const [name, src] of Object.entries(DECOR_ASSETS)) {
      expect(existsSync(resolve(root, `public${src}`)), `${name} 素材缺失: public${src}`).toBe(true)
    }
  })

  it('SceneDecor 逐条引用这些素材，且没有内联 SVG/CSS 手搓图形', () => {
    for (const src of Object.values(DECOR_ASSETS)) {
      expect(decorSrc).toContain(src)
    }
    expect(decorSrc).toContain('<img')
    expect(decorSrc).not.toContain('<svg')
    expect(decorSrc).not.toContain('</svg>')
    expect(decorSrc).not.toMatch(/<path\b|<circle\b|<polygon\b|<rect\b/)
  })

  it('SceneStack 把 time / season / weather 都交给 SceneDecor', () => {
    expect(stackSrc).toContain('<SceneDecor :time="scene.time" :season="scene.season" :weather="scene.weather" />')
  })

  it('scene.css 不再残留 CSS 手搓的 .vk-sun / .vk-cloud 图元', () => {
    expect(sceneCss).not.toMatch(/^\.vk-sun\s*\{/m)
    expect(sceneCss).not.toMatch(/^\.vk-cloud\s*\{/m)
    expect(sceneCss).not.toContain('.vk-sun::before')
    expect(sceneCss).toContain('.vk-decor-sun')
    expect(sceneCss).toContain('.vk-decor-cloud')
  })

  it('层叠丘陵做纵深：back / front 两层都渲染', () => {
    expect(sceneCss).toContain('.vk-decor-hills-back')
    expect(sceneCss).toContain('.vk-decor-hills-front')
    const wrapper = mount(SceneDecor, { props: { time: 'day' } })
    expect(wrapper.find('[data-decor-part="hills-back"]').exists()).toBe(true)
    expect(wrapper.find('[data-decor-part="hills-front"]').exists()).toBe(true)
    wrapper.unmount()
  })

  it('天空改用中性底图（不烘焙太阳/云 → 不与装饰重影、tint 可生效）', () => {
    expect(sceneCss).toContain('/images/v2-scene/sky-neutral.png')
    expect(sceneCss).not.toContain('/images/v2-scene/sky.png')
  })
})

describe('SceneDecor 渲染行为：昼夜 / 季节 / 前景框景 / 天气', () => {
  it('白天（夏）：太阳 + 3 朵云 + 风车/房屋/灌木/小路/栅栏/花丛/左右树，全部指向 /images/v2-scene/*.png', () => {
    const wrapper = mount(SceneDecor, { props: { time: 'day', season: 'summer', weather: 'clear' } })
    const imgs = wrapper.findAll('img')
    expect(imgs.length).toBeGreaterThanOrEqual(13)
    for (const img of imgs) {
      expect(img.attributes('src') ?? '').toMatch(DECOR_SRC_RE)
    }
    expect(wrapper.find('[data-decor-part="sun"]').exists()).toBe(true)
    expect(wrapper.findAll('[data-decor-part="cloud"]')).toHaveLength(3)
    expect(wrapper.find('[data-decor-part="windmill"]').exists()).toBe(true)
    expect(wrapper.find('[data-decor-part="house"]').exists()).toBe(true)
    expect(wrapper.find('[data-decor-part="tree-left"]').exists()).toBe(true)
    expect(wrapper.find('[data-decor-part="tree-right"]').exists()).toBe(true)
    expect(wrapper.find('[data-decor-part="fence"]').exists()).toBe(true)
    expect(wrapper.find('[data-decor-part="flowerbed"]').exists()).toBe(true)
    // 白天没有月亮星空 / 萤火虫
    expect(wrapper.find('[data-decor-part="moon-stars"]').exists()).toBe(false)
    expect(wrapper.find('[data-decor-part="firefly"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('夜间：隐藏太阳与云，换月亮星空 + 亮窗房屋 + 萤火虫', () => {
    const wrapper = mount(SceneDecor, { props: { time: 'night', season: 'summer', weather: 'clear' } })
    expect(wrapper.find('[data-decor-part="sun"]').exists()).toBe(false)
    expect(wrapper.findAll('[data-decor-part="cloud"]')).toHaveLength(0)
    expect(wrapper.find('[data-decor-part="moon-stars"]').exists()).toBe(true)
    expect(wrapper.find('[data-decor-part="house-night"]').exists()).toBe(true)
    expect(wrapper.find('[data-decor-part="house"]').exists()).toBe(false)
    expect(wrapper.findAll('[data-decor-part="firefly"]')).toHaveLength(5)
    expect(wrapper.find('[data-decor-part="windmill"]').exists()).toBe(true)
    wrapper.unmount()
  })

  it('春季：樱花树 + 春花丛；其它季节不渲染', () => {
    const spring = mount(SceneDecor, { props: { time: 'day', season: 'spring', weather: 'clear' } })
    expect(spring.find('[data-decor-part="spring-blossom"]').exists()).toBe(true)
    expect(spring.find('[data-decor-part="spring-flowers"]').exists()).toBe(true)
    spring.unmount()

    const summer = mount(SceneDecor, { props: { time: 'day', season: 'summer', weather: 'clear' } })
    expect(summer.find('[data-decor-part="spring-blossom"]').exists()).toBe(false)
    summer.unmount()
  })

  it('秋季（参考稿 §2.2）：南瓜 + 干草垛 + 飘落枫叶', () => {
    const wrapper = mount(SceneDecor, { props: { time: 'day', season: 'autumn', weather: 'clear' } })
    expect(wrapper.find('[data-decor-part="autumn-pumpkins"]').exists()).toBe(true)
    expect(wrapper.find('[data-decor-part="autumn-haybale"]').exists()).toBe(true)
    expect(wrapper.findAll('[data-decor-part="autumn-leaf"]')).toHaveLength(4)
    // 侧树常绿（秋特有的落叶树素材尚未生成，秋季特征由南瓜/干草垛/枫叶承担）
    expect(wrapper.find('[data-decor-part="tree-left"]').exists()).toBe(true)
    wrapper.unmount()
  })

  it('冬季（参考稿 §2.2）：侧树换成雪树 + 积雪丘', () => {
    const wrapper = mount(SceneDecor, { props: { time: 'day', season: 'winter', weather: 'clear' } })
    expect(wrapper.find('[data-decor-part="snow-tree-left"]').exists()).toBe(true)
    expect(wrapper.find('[data-decor-part="snow-tree-right"]').exists()).toBe(true)
    expect(wrapper.find('[data-decor-part="tree-left"]').exists()).toBe(false)
    expect(wrapper.findAll('[data-decor-part="winter-snow-patch"]')).toHaveLength(2)
    wrapper.unmount()
  })

  it('天气（参考稿 §2.3）：雨 / 雪 / 雾 各自渲染对应 PNG 精灵；晴不渲染任何天气图元', () => {
    const rain = mount(SceneDecor, { props: { time: 'day', season: 'summer', weather: 'rain' } })
    expect(rain.findAll('[data-decor-part="weather-rain"]').length).toBeGreaterThanOrEqual(10)
    rain.unmount()

    const snow = mount(SceneDecor, { props: { time: 'day', season: 'winter', weather: 'snow' } })
    expect(snow.findAll('[data-decor-part="weather-snow"]').length).toBeGreaterThanOrEqual(10)
    snow.unmount()

    const fog = mount(SceneDecor, { props: { time: 'day', season: 'autumn', weather: 'fog' } })
    expect(fog.find('[data-decor-part="weather-fog"]').exists()).toBe(true)
    fog.unmount()

    const clear = mount(SceneDecor, { props: { time: 'day', season: 'summer', weather: 'clear' } })
    expect(clear.find('[data-decor-part^="weather-"]').exists()).toBe(false)
    clear.unmount()
  })

  it('素材层挂在 .vk-scene 内（z-index 0 < .vk-main z-index 1）→ 在卡片层之下', () => {
    const wrapper = mount(SceneStack, { props: { time: 'day', season: 'summer', weather: 'rain' } })
    const scene = wrapper.find('.vk-scene')
    expect(scene.exists()).toBe(true)
    expect(scene.find('.vk-decor').exists()).toBe(true)
    expect(sceneCss).toContain('z-index: 5;')
    wrapper.unmount()
  })
})

describe('天气状态机：确定性 + 季节自洽（参考稿 §2.3）', () => {
  const seasons: Season[] = ['spring', 'summer', 'autumn', 'winter']

  it('同一天同一结果（不是随机数，刷新不乱跳）', () => {
    const d = new Date(2026, 6, 15)
    for (const s of seasons)
      expect(weatherFromDate(d, s)).toBe(weatherFromDate(d, s))
  })

  it('冬季绝不下雨、非冬季绝不下雪', () => {
    for (let m = 0; m < 12; m++) {
      for (let day = 1; day <= 28; day++) {
        const d = new Date(2026, m, day)
        const season: Season = (m <= 1 || m === 11) ? 'winter' : (m <= 4 ? 'spring' : m <= 7 ? 'summer' : 'autumn')
        const w = weatherFromDate(d, season)
        if (season === 'winter')
          expect(w, `冬 ${d.toDateString()} 不该下雨`).not.toBe('rain')
        else
          expect(w, `非冬 ${d.toDateString()} 不该下雪`).not.toBe('snow')
      }
    }
  })

  it('晴天占多数（天气是点缀，不该糊住场景）', () => {
    let clear = 0
    const total = 365
    for (let m = 0; m < 12; m++) {
      for (let day = 1; day <= 28; day++) {
        const d = new Date(2026, m, day)
        const season: Season = (m <= 1 || m === 11) ? 'winter' : (m <= 4 ? 'spring' : m <= 7 ? 'summer' : 'autumn')
        if (weatherFromDate(d, season) === 'clear')
          clear++
      }
    }
    expect(clear / total).toBeGreaterThan(0.45)
  })

  it('四季都至少出现过一次非晴天气（各种天气都接得进来）', () => {
    const seen = new Set<string>()
    for (let m = 0; m < 12; m++) {
      for (let day = 1; day <= 28; day++) {
        const d = new Date(2026, m, day)
        const season: Season = (m <= 1 || m === 11) ? 'winter' : (m <= 4 ? 'spring' : m <= 7 ? 'summer' : 'autumn')
        seen.add(weatherFromDate(d, season))
      }
    }
    expect(seen.has('rain')).toBe(true)
    expect(seen.has('snow')).toBe(true)
    expect(seen.has('wind')).toBe(true)
    expect(seen.has('fog')).toBe(true)
  })
})

describe('通透感：整栈饱和度/对比度提升（仅作用于场景层）', () => {
  it('scene.css 在 .vk-scene 上应用 saturate/contrast/brightness 滤镜', () => {
    const block = sceneCss.match(/\.vk-scene\s*\{[^}]*\}/)
    expect(block, '.vk-scene 规则缺失').toBeTruthy()
    expect(block![0]).toMatch(/saturate\(/)
    expect(block![0]).toMatch(/contrast\(/)
    expect(block![0]).toMatch(/brightness\(/)
  })

  it('滤镜令牌有默认值（可被主题覆盖）', () => {
    expect(sceneCss).toContain('--vk-scene-saturate')
    expect(sceneCss).toContain('--vk-scene-contrast')
    expect(sceneCss).toContain('--vk-scene-bright')
  })

  it('天气/落叶/萤火虫动画尊重 prefers-reduced-motion', () => {
    expect(sceneCss).toContain('@media (prefers-reduced-motion: reduce)')
  })
})
