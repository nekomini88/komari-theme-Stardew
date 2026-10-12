import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import SceneDecor from '@/v2/components/SceneDecor.vue'
import SceneStack from '@/v2/components/SceneStack.vue'

const root = resolve(__dirname, '..', '..')
const decorSrc = readFileSync(resolve(root, 'src/v2/components/SceneDecor.vue'), 'utf8')
const sceneCss = readFileSync(resolve(root, 'src/styles/v2/scene.css'), 'utf8')
const stackSrc = readFileSync(resolve(root, 'src/v2/components/SceneStack.vue'), 'utf8')

/**
 * 场景关键素材契约（用户明确要求）：太阳(带笑脸光芒) / 蓬松云 / 层叠丘陵 / 风车 / 房屋 / 灌木 / 小路
 * —— 一律为 ListenHub 生成的透明 PNG，落在 `/images/v2-scene/*.png`；
 * **不得再用 CSS/SVG 手搓**这些装饰图形。
 */
const DECOR_ASSETS: Record<string, string> = {
  'sun-smile': '/images/v2-scene/sun-smile.png',
  'cloud-puff': '/images/v2-scene/cloud-puff.png',
  'hills-layer': '/images/v2-scene/hills-layer.png',
  'windmill': '/images/v2-scene/windmill.png',
  'house': '/images/v2-scene/house.png',
  'bush': '/images/v2-scene/bush.png',
  'path': '/images/v2-scene/path.png',
}

const DECOR_SRC_RE = /^\/images\/v2-scene\/(sun-smile|cloud-puff|hills-layer|windmill|house|bush|path)\.png$/

describe('场景关键素材：ListenHub 透明 PNG（7 件）', () => {
  it('7 张素材文件真实躺在 public/images/v2-scene/ 下（部署后即 /images/v2-scene/）', () => {
    for (const [name, src] of Object.entries(DECOR_ASSETS)) {
      expect(existsSync(resolve(root, `public${src}`)), `${name} 素材缺失: public${src}`).toBe(true)
    }
  })

  it('sceneDecor 逐条引用这 7 张素材，且没有内联 SVG/CSS 手搓图形', () => {
    for (const src of Object.values(DECOR_ASSETS)) {
      expect(decorSrc).toContain(src)
    }
    // 必须走 <img> 引用 PNG
    expect(decorSrc).toContain('<img')
    expect(decorSrc).not.toContain('<svg')
    expect(decorSrc).not.toContain('</svg>')
    expect(decorSrc).not.toMatch(/<path\b|<circle\b|<polygon\b|<rect\b/)
  })

  it('sceneStack 挂载 SceneDecor（太阳/云/丘陵/建筑/小路接入 v2 场景）', () => {
    expect(stackSrc).toContain('SceneDecor')
    expect(stackSrc).toContain('<SceneDecor')
  })

  it('scene.css 不再残留 CSS 手搓的 .vk-sun / .vk-cloud 图元', () => {
    // 旧的 CSS 手搓太阳/云（radial-gradient 堆白云、repeating-conic 光芒）必须已移除
    expect(sceneCss).not.toMatch(/^\.vk-sun\s*\{/m)
    expect(sceneCss).not.toMatch(/^\.vk-cloud\s*\{/m)
    expect(sceneCss).not.toContain('.vk-sun::before')
    // 取而代之的是 PNG 素材层的样式
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
})

describe('sceneDecor 渲染行为：昼显夜隐 / 不遮挡卡片', () => {
  it('白天渲染太阳 + 3 朵云 + 风车/房屋/灌木/小路，全部指向 /images/v2-scene/*.png', () => {
    const wrapper = mount(SceneDecor, { props: { time: 'day' } })
    const imgs = wrapper.findAll('img')
    expect(imgs.length).toBeGreaterThanOrEqual(8)
    for (const img of imgs) {
      expect(img.attributes('src') ?? '').toMatch(DECOR_SRC_RE)
    }
    expect(wrapper.find('[data-decor-part="sun"]').exists()).toBe(true)
    expect(wrapper.findAll('[data-decor-part="cloud"]')).toHaveLength(3)
    expect(wrapper.find('[data-decor-part="windmill"]').exists()).toBe(true)
    expect(wrapper.find('[data-decor-part="house"]').exists()).toBe(true)
    expect(wrapper.find('[data-decor-part="bush"]').exists()).toBe(true)
    expect(wrapper.find('[data-decor-part="path"]').exists()).toBe(true)
    wrapper.unmount()
  })

  it('夜间隐藏太阳与云（露出夜色插画自带的月亮/星空），地面景观保留', () => {
    const wrapper = mount(SceneDecor, { props: { time: 'night' } })
    expect(wrapper.find('[data-decor-part="sun"]').exists()).toBe(false)
    expect(wrapper.findAll('[data-decor-part="cloud"]')).toHaveLength(0)
    expect(wrapper.find('[data-decor-part="windmill"]').exists()).toBe(true)
    expect(wrapper.find('[data-decor-part="path"]').exists()).toBe(true)
    wrapper.unmount()
  })

  it('素材层挂在 .vk-scene 内（z-index 0 < .vk-main z-index 1）→ 在卡片层之下', () => {
    const wrapper = mount(SceneStack, { props: { time: 'day', season: 'summer' } })
    const scene = wrapper.find('.vk-scene')
    expect(scene.exists()).toBe(true)
    expect(scene.find('.vk-decor').exists()).toBe(true)
    // 整栈 tint(z7) 必须在素材层之上 → 昼夜/季节 tint 仍统一作用于素材
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
