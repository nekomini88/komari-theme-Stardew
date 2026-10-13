import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { describe, expect, it } from 'vitest'
import { createRouter, createWebHashHistory } from 'vue-router'
import TopBar from '@/v2/components/TopBar.vue'

/**
 * 用户口径（2026-10-13）：顶栏**不要**「明/暗切换」与「中英文切换」按钮
 * ——「不需要这些功能」。摘除后顶栏只留 站点标识 / 首页 / admin 入口。
 *
 * 这个用例既查渲染结果，也查源码：防止以后有人把按钮加回来
 * （只查源码会漏掉"组件换个写法又渲染出来"，只查渲染会漏掉死代码残留）。
 */
describe('顶栏不该有明暗/语言切换（用户 2026-10-13 口径）', () => {
  function mountBar() {
    const router = createRouter({ history: createWebHashHistory(), routes: [{ path: '/', component: { template: '<div/>' } }] })
    return mount(TopBar, { global: { plugins: [createPinia(), router] } })
  }

  it('渲染结果里没有主题/语言切换按钮', () => {
    const w = mountBar()
    const labels = w.findAll('button').map(b => b.text().trim())

    // 主题切换的标签（自动/亮/暗 · Auto/Light/Dark）与语言切换的标签（中文/EN）都不得出现
    const forbidden = /^(自动|亮|暗|Auto|Light|Dark|中文|EN)$/
    const offending = labels.filter(l => forbidden.test(l))
    expect(offending, `顶栏不该再出现这些按钮：${JSON.stringify(offending)}`).toEqual([])
  })

  it('右侧动作区只保留 admin 入口（品牌/导航按钮不计）', () => {
    const w = mountBar()
    // 两个切换按钮原先都在 .vk-actions 里 → 只查这一区
    const actions = w.find('.vk-actions')
    expect(actions.exists(), '未找到 .vk-actions').toBe(true)
    const texts = actions.findAll('button').map(b => b.text().trim()).filter(Boolean)
    for (const t of texts)
      // 2026-10-13 用户要求新增「调色板」控件，故动作区允许且仅允许这两个
      expect(['后台管理', '调色板'], `动作区意外的按钮 "${t}"`).toContain(t)
  })

  it('导航区仍是首页入口', () => {
    const w = mountBar()
    const nav = w.find('.vk-nav')
    expect(nav.exists(), '未找到 .vk-nav').toBe(true)
    expect(nav.findAll('button').map(b => b.text().trim())).toEqual(['首页'])
  })

  it('源码里不得残留切换逻辑（避免留死代码）', () => {
    const src = readFileSync(resolve(__dirname, '..', '..', 'src', 'v2', 'components', 'TopBar.vue'), 'utf8')
    for (const dead of ['cycleTheme', 'toggleLang', 'themeLabel', '切换主题', '切换语言', 'Switch theme', 'Switch language'])
      expect(src, `TopBar 残留了已移除功能的痕迹：${dead}`).not.toContain(dead)
  })

  it('admin 入口保留（摘按钮时别把有用的也一起删了）', () => {
    const src = readFileSync(resolve(__dirname, '..', '..', 'src', 'v2', 'components', 'TopBar.vue'), 'utf8')
    expect(src).toContain('goAdmin')
    expect(src).toContain('/admin')
  })
})
