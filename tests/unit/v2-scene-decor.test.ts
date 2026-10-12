import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import SceneStack from '@/v2/components/SceneStack.vue'
import SceneDecor from '@/v2/components/SceneDecor.vue'

const root = resolve(__dirname, '..', '..')
const decorSrc = readFileSync(resolve(root, 'src/v2/components/SceneDecor.vue'), 'utf8')
const sceneCss = readFileSync(resolve(root, 'src/styles/v2/scene.css'), 'utf8')
const stackSrc = readFileSync(resolve(root, 'src/v2/components/SceneStack.vue'), 'utf8')

/**
 * 场景装饰素材契约（ListenHub 生成的透明 PNG，落 `/images/v2-scene/*.png`）：
 *  基础：太阳(带笑脸光芒) / 蓬松云 / 层叠丘陵 / 风车 / 房屋 / 灌木 / 小路
 *  P1-4：前景木栅栏 / 前景花丛
 *  P1-6：夜间亮窗房屋 / 月亮星空
 *  P2-7：春季樱花树 / 春花丛
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
}

const DECOR_SRC_RE = /^\/images\/v2-scene\/(sun-smile|cloud-puff|hills-layer|windmill|house|house-night|bush|path|fence-foreground|flowerbed-foreground|moon-stars|spring-blossom|spring-flowers)\.png$/

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

  it('SceneStack 把 time 与 season 都交给 SceneDecor（季节/昼夜驱动装饰）', () => {
    expect(stackSrc).toContain('SceneDecor')
    expect(stackSrc).toContain('<SceneDecor :time="scene.time" :season="scene.season" />')
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

describe('SceneDecor 渲染行为：昼显夜隐 / 季节 / 前景框景', () => {
  it('白天：太阳 + 3 朵云 + 风车/房屋/灌木/小路/栅栏/花丛，全部指向 /images/v2-scene/*.png', () => {
    const wrapper = mount(SceneDecor, { props: { time: 'day', season: 'summer' } })
    const imgs = wrapper.findAll('img')
    expect(imgs.length).toBeGreaterThanOrEqual(11)
    for (const img of imgs) {
      expect(img.attributes('src') ?? '').toMatch(DECOR_SRC_RE)
    }
    expect(wrapper.find('[data-decor-part="sun"]').exists()).toBe(true)
    expect(wrapper.findAll('[data-decor-part="cloud"]')).toHaveLength(3)
    expect(wrapper.find('[data-decor-part="windmill"]').exists()).toBe(true)
    expect(wrapper.find('[data-decor-part="house"]').exists()).toBe(true)
    expect(wrapper.find('[data-decor-part="bush"]').exists()).toBe(true)
    expect(wrapper.find('[data-decor-part="path"]').exists()).toBe(true)
    // P1-4 前景框景
    expect(wrapper.find('[data-decor-part="fence"]').exists()).toBe(true)
    expect(wrapper.find('[data-decor-part="flowerbed"]').exists()).toBe(true)
    // 白天没有月亮星空
    expect(wrapper.find('[data-decor-part="moon-stars"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('夜间：隐藏太阳与云，换月亮星空 + 亮窗房屋；地面景观保留', () => {
    const wrapper = mount(SceneDecor, { props: { time: 'night', season: 'winter' } })
    expect(wrapper.find('[data-decor-part="sun"]').exists()).toBe(false)
    expect(wrapper.findAll('[data-decor-part="cloud"]')).toHaveLength(0)
    expect(wrapper.find('[data-decor-part="moon-stars"]').exists()).toBe(true)
    expect(wrapper.find('[data-decor-part="house-night"]').exists()).toBe(true)
    expect(wrapper.find('[data-decor-part="house"]').exists()).toBe(false)
    expect(wrapper.find('[data-decor-part="windmill"]').exists()).toBe(true)
    expect(wrapper.find('[data-decor-part="fence"]').exists()).toBe(true)
    wrapper.unmount()
  })

  it('春季：额外渲染樱花树 + 春花丛；其它季节不渲染', () => {
    const spring = mount(SceneDecor, { props: { time: 'day', season: 'spring' } })
    expect(spring.find('[data-decor-part="spring-blossom"]').exists()).toBe(true)
    expect(spring.find('[data-decor-part="spring-flowers"]').exists()).toBe(true)
    spring.unmount()

    const summer = mount(SceneDecor, { props: { time: 'day', season: 'summer' } })
    expect(summer.find('[data-decor-part="spring-blossom"]').exists()).toBe(false)
    expect(summer.find('[data-decor-part="spring-flowers"]').exists()).toBe(false)
    summer.unmount()
  })

  it('素材层挂在 .vk-scene 内（z-index 0 < .vk-main z-index 1）→ 在卡片层之下', () => {
    const wrapper = mount(SceneStack, { props: { time: 'day', season: 'summer' } })
    const scene = wrapper.find('.vk-scene')
    expect(scene.exists()).toBe(true)
    expect(scene.find('.vk-decor').exists()).toBe(true)
    expect(sceneCss).toContain('z-index: 5;')
    wrapper.unmount()
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
})
