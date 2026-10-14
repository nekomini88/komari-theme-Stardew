import type { PublicSettings } from '@/utils/api/api'
import type { Client, NodeStatus } from '@/utils/api/rpc'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { useAppStore } from '@/stores/app'
import { useNodesStore } from '@/stores/nodes'

/**
 * stores/app.ts 与 stores/nodes.ts 的「状态迁移 + 派生值」冻结测试。
 *
 * 目的：重构前先把两个 store 的可观测行为钉死，保证拆分（设置/外观/路由 vs
 * 节点列表/指标/排序）不会偷偷改变默认值、getter 派生结果或 localStorage 往返。
 *
 * 说明（为什么没有 vi.mock）：
 * - app.ts 对外部模块只有 `import type { PublicSettings } from '@/utils/api/api'`，
 *   nodes.ts 只有 `import type { Client, NodeStatus } from '@/utils/api/rpc'`；
 *   两者都是**纯类型导入**，编译期被擦除，运行时并不会加载 api/rpc 模块。
 * - nodes.ts 唯一的运行时外部依赖是纯函数 `@/utils/misc/groupHelper#parseNodeGroups`。
 * 因此不需要（也不应该）mock 外部模块：mock 一个只有类型导出的模块没有意义，
 * 反而会掩盖真实的 store 行为。这里只测 store 自身逻辑。
 */

// ---------------------------------------------------------------------------
// 公共工具
// ---------------------------------------------------------------------------

/** 等待 useStorageAsync 的异步读取落地（内部用 Promise + 微/宏任务）。 */
async function settle(): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, 0))
  await nextTick()
}

function freshPinia(): void {
  localStorage.clear()
  setActivePinia(createPinia())
}

function setAppSettings(s: ReturnType<typeof useAppStore>, theme: Record<string, unknown> | null): void {
  s.publicSettings = { theme_settings: theme } as unknown as PublicSettings
}

// ===========================================================================
// useAppStore
// ===========================================================================

describe('useAppStore · 初始状态与默认派生值', () => {
  let s: ReturnType<typeof useAppStore>

  beforeEach(async () => {
    freshPinia()
    s = useAppStore()
    await settle()
  })

  it('标量初始值（源码默认值，非猜测）', () => {
    expect(s.loading).toBe(true)
    expect(s.lang).toBe('zh-CN')
    expect(s.isLoggedIn).toBe(false)
    expect(s.connectionError).toBe(false)
    expect(s.homeScrollPosition).toBe(0)
    expect(s.publicSettings).toBeUndefined()
  })

  it('持久化字段初始值', () => {
    expect(s.themeMode).toBe('auto')
    expect(s.nodeSelectedGroup).toBe('all')
    expect(s.nodeViewMode).toBe('card')
    expect(s.defaultViewMode).toBe('card')
    expect(s.rpcTransportMode).toBe('websocket')
    expect(s.shaderType).toBe('bubbles')
  })

  it('byteDecimals 固定精度（B:0 KB:0 MB:1 GB:1 TB:2）', () => {
    expect(s.byteDecimals).toEqual({ B: 0, KB: 0, MB: 1, GB: 1, TB: 2 })
  })

  it('无 publicSettings 时全部布尔/字符串 getter 走兜底', () => {
    expect(s.alertEnabled).toBe(false)
    expect(s.alertTitle).toBe('')
    expect(s.alertContent).toBe('')
    expect(s.stopEarth).toBe(false)
    expect(s.hideEarth).toBe(false)
    expect(s.hideGeneralCard).toBe(false)
    expect(s.nodeCardMinWidth).toBe(300)
    expect(s.showNodeConnections).toBe(true)
    expect(s.showNodeUptime).toBe(true)
    expect(s.visitorInfoCardEnabled).toBe(true)
    expect(s.hideAdminEntryWhenLoggedOut).toBe(false)
    expect(s.disablePageAnimation).toBe(false)
    expect(s.enableGlassEffect).toBe(true)
    expect(s.icpEnabled).toBe(false)
    expect(s.icpNumber).toBe('')
    expect(s.icpUrl).toBe('https://beian.miit.gov.cn/')
    expect(s.policeEnabled).toBe(false)
    expect(s.policeNumber).toBe('')
    expect(s.policeUrl).toBe('')
    expect(s.backgroundEnabled).toBe(false)
    expect(s.backgroundType).toBe('image')
    expect(s.lightBackgroundUrl).toBe('')
    expect(s.darkBackgroundUrl).toBe('')
    expect(s.backgroundBlur).toBe(0)
    expect(s.backgroundOverlay).toBe(0)
  })

  it('summaryCards 默认 7 项且不含 connections', () => {
    expect(s.summaryCards).toEqual(['memory', 'disk', 'finance', 'traffic', 'speedUp', 'speedDown'])
    expect(s.summaryCards).not.toContain('connections')
  })

  it('themeMode=auto 时 isDark/resolvedThemeMode 跟随系统偏好（jsdom 无 matchMedia → false/light）', async () => {
    expect(typeof window.matchMedia).toBe('undefined')
    expect(s.isDark).toBe(false)
    expect(s.resolvedThemeMode).toBe('light')
    expect(s.currentBackgroundUrl).toBe('')
  })
})

describe('useAppStore · themeMode 校验与持久化', () => {
  beforeEach(freshPinia)

  it('从 localStorage 恢复合法值', async () => {
    localStorage.setItem('themeMode', 'dark')
    setActivePinia(createPinia())
    const s = useAppStore()
    await settle()
    expect(s.themeMode).toBe('dark')
    expect(s.isDark).toBe(true)
    expect(s.resolvedThemeMode).toBe('dark')
  })

  it('非法持久化值被 watch 纠正为 auto 并回写 localStorage', async () => {
    localStorage.setItem('themeMode', 'bogus')
    setActivePinia(createPinia())
    const s = useAppStore()
    await settle()
    expect(s.themeMode).toBe('auto')
    expect(localStorage.getItem('themeMode')).toBe('auto')
  })

  it('设置合法值后写入 localStorage', async () => {
    const s = useAppStore()
    await settle()
    s.themeMode = 'dark'
    await settle()
    expect(s.themeMode).toBe('dark')
    expect(localStorage.getItem('themeMode')).toBe('dark')
  })

  it('updateThemeMode 接受显式模式，非法输入回落 auto', async () => {
    const s = useAppStore()
    await settle()
    s.updateThemeMode('light')
    await settle()
    expect(s.themeMode).toBe('light')
    expect(localStorage.getItem('themeMode')).toBe('light')

    s.updateThemeMode('nope' as never)
    await settle()
    expect(s.themeMode).toBe('auto')
    expect(localStorage.getItem('themeMode')).toBe('auto')
  })

  it('早期写入会被 useStorageAsync 的异步读取覆盖（已知竞态，见总结）', async () => {
    const s = useAppStore()
    // 故意不 settle，立即写入
    s.themeMode = 'dark'
    expect(s.themeMode).toBe('dark')
    await settle()
    // 异步读取把未落盘的初值 'auto' 写回，覆盖了这次赋值
    expect(s.themeMode).toBe('auto')
    expect(localStorage.getItem('themeMode')).toBe('auto')
  })
})

describe('useAppStore · nodeSelectedGroup 持久化', () => {
  beforeEach(freshPinia)

  it('默认 all，可恢复且可写回', async () => {
    localStorage.setItem('nodeSelectedGroup', 'grp-a')
    setActivePinia(createPinia())
    const s = useAppStore()
    await settle()
    expect(s.nodeSelectedGroup).toBe('grp-a')

    s.nodeSelectedGroup = 'grp-b'
    await settle()
    expect(localStorage.getItem('nodeSelectedGroup')).toBe('grp-b')
  })
})

describe('useAppStore · nodeViewMode 派生、storedViewMode 与默认值落盘', () => {
  beforeEach(freshPinia)

  it('无 storedViewMode 且无设置时 → 默认 card', async () => {
    const s = useAppStore()
    await settle()
    expect(s.nodeViewMode).toBe('card')
    expect(s.defaultViewMode).toBe('card')
  })

  it('storedViewMode 合法值优先于默认值', async () => {
    localStorage.setItem('nodeViewMode', 'list')
    setActivePinia(createPinia())
    const s = useAppStore()
    await settle()
    expect(s.nodeViewMode).toBe('list')
  })

  it('storedViewMode 非法值被 getter 忽略，回落默认值且不覆写 localStorage', async () => {
    localStorage.setItem('nodeViewMode', 'bogus')
    setActivePinia(createPinia())
    const s = useAppStore()
    await settle()
    expect(s.nodeViewMode).toBe('card')
    expect(localStorage.getItem('nodeViewMode')).toBe('bogus')
  })

  it('设置 nodeViewMode 经 setter 落盘 storedViewMode', async () => {
    const s = useAppStore()
    await settle()
    s.nodeViewMode = 'list'
    await settle()
    expect(s.nodeViewMode).toBe('list')
    expect(localStorage.getItem('nodeViewMode')).toBe('list')
  })

  it('publicSettings 提供 defaultViewMode=list 时，watch 把默认值落盘', async () => {
    const s = useAppStore()
    await settle()
    setAppSettings(s, { defaultViewMode: 'list' })
    await nextTick()
    expect(s.defaultViewMode).toBe('list')
    expect(s.nodeViewMode).toBe('list')
    expect(localStorage.getItem('nodeViewMode')).toBe('list')
  })

  it('publicSettings 的 defaultViewMode 非法 → defaultViewMode 回落 card', async () => {
    const s = useAppStore()
    await settle()
    setAppSettings(s, { defaultViewMode: 'grid' })
    await nextTick()
    expect(s.defaultViewMode).toBe('card')
  })

  it('已有合法 storedViewMode 时，加载设置不覆盖用户选择', async () => {
    localStorage.setItem('nodeViewMode', 'card')
    setActivePinia(createPinia())
    const s = useAppStore()
    await settle()
    setAppSettings(s, { defaultViewMode: 'list' })
    await nextTick()
    expect(s.defaultViewMode).toBe('list')
    expect(s.nodeViewMode).toBe('card')
    expect(localStorage.getItem('nodeViewMode')).toBe('card')
  })
})

describe('useAppStore · shaderType 初始读取与同步持久化', () => {
  beforeEach(freshPinia)

  it('默认 bubbles；构造时同步读取 localStorage', async () => {
    const s = useAppStore()
    await settle()
    expect(s.shaderType).toBe('bubbles')

    localStorage.setItem('shaderType', 'liquid')
    setActivePinia(createPinia())
    const s2 = useAppStore()
    expect(s2.shaderType).toBe('liquid')
  })

  it('赋值后由 watch 同步回写 localStorage', async () => {
    const s = useAppStore()
    await settle()
    s.shaderType = 'none'
    await nextTick()
    expect(s.shaderType).toBe('none')
    expect(localStorage.getItem('shaderType')).toBe('none')
  })

  it('初始读取不做合法性校验（可疑行为，见总结）', async () => {
    localStorage.setItem('shaderType', 'weird-value')
    setActivePinia(createPinia())
    const s = useAppStore()
    expect(s.shaderType).toBe('weird-value' as never)
  })
})

describe('useAppStore · publicSettings 派生 getters', () => {
  let s: ReturnType<typeof useAppStore>

  beforeEach(async () => {
    freshPinia()
    s = useAppStore()
    await settle()
  })

  it('theme_settings=null 时全部走兜底', async () => {
    setAppSettings(s, null)
    await nextTick()
    expect(s.defaultViewMode).toBe('card')
    expect(s.rpcTransportMode).toBe('websocket')
    expect(s.icpUrl).toBe('https://beian.miit.gov.cn/')
    expect(s.summaryCards).toEqual(['memory', 'disk', 'finance', 'traffic', 'speedUp', 'speedDown'])
  })

  it('布尔/字符串配置直接透传', async () => {
    setAppSettings(s, {
      alertEnabled: true,
      alertTitle: 'Hi',
      alertContent: 'Body',
      stopEarth: true,
      hideEarth: true,
      hideGeneralCard: true,
      showNodeConnections: false,
      showNodeUptime: false,
      visitorInfoCardEnabled: false,
      hideAdminEntryWhenLoggedOut: true,
      disablePageAnimation: true,
      icpEnabled: true,
      icpNumber: 'ICP-123',
      policeEnabled: true,
      policeNumber: 'POL-9',
      backgroundEnabled: true,
    })
    await nextTick()
    expect(s.alertEnabled).toBe(true)
    expect(s.alertTitle).toBe('Hi')
    expect(s.alertContent).toBe('Body')
    expect(s.stopEarth).toBe(true)
    expect(s.hideEarth).toBe(true)
    expect(s.hideGeneralCard).toBe(true)
    expect(s.showNodeConnections).toBe(false)
    expect(s.showNodeUptime).toBe(false)
    expect(s.visitorInfoCardEnabled).toBe(false)
    expect(s.hideAdminEntryWhenLoggedOut).toBe(true)
    expect(s.disablePageAnimation).toBe(true)
    expect(s.icpEnabled).toBe(true)
    expect(s.icpNumber).toBe('ICP-123')
    expect(s.policeEnabled).toBe(true)
    expect(s.policeNumber).toBe('POL-9')
    expect(s.backgroundEnabled).toBe(true)
  })

  it('枚举型配置只接受合法值，否则回落', async () => {
    setAppSettings(s, { rpcTransportMode: 'http', backgroundType: 'video' })
    await nextTick()
    expect(s.rpcTransportMode).toBe('http')
    expect(s.backgroundType).toBe('video')

    setAppSettings(s, { rpcTransportMode: 'grpc', backgroundType: 'gif' })
    await nextTick()
    expect(s.rpcTransportMode).toBe('websocket')
    expect(s.backgroundType).toBe('image')
  })

  it('URL 字段做 trim，空串回落默认', async () => {
    setAppSettings(s, {
      icpUrl: '  https://x.example  ',
      policeUrl: '  https://police.example  ',
      lightBackgroundUrl: '  /a.png  ',
      darkBackgroundUrl: '  /b.png  ',
    })
    await nextTick()
    expect(s.icpUrl).toBe('https://x.example')
    expect(s.policeUrl).toBe('https://police.example')
    expect(s.lightBackgroundUrl).toBe('/a.png')
    expect(s.darkBackgroundUrl).toBe('/b.png')
  })

  it('数值边界：nodeCardMinWidth>=200、backgroundBlur>=0、backgroundOverlay∈[-100,100]', async () => {
    setAppSettings(s, { nodeCardMinWidth: 199, backgroundBlur: -1, backgroundOverlay: 101 })
    await nextTick()
    expect(s.nodeCardMinWidth).toBe(300)
    expect(s.backgroundBlur).toBe(0)
    expect(s.backgroundOverlay).toBe(0)

    setAppSettings(s, { nodeCardMinWidth: 200, backgroundBlur: 0, backgroundOverlay: -100 })
    await nextTick()
    expect(s.nodeCardMinWidth).toBe(200)
    expect(s.backgroundBlur).toBe(0)
    expect(s.backgroundOverlay).toBe(-100)

    setAppSettings(s, { backgroundOverlay: 100 })
    await nextTick()
    expect(s.backgroundOverlay).toBe(100)
  })

  it('enableGlassEffect：布尔直传，字符串 "true"/"1" → true，其余字符串 → false 或默认', async () => {
    setAppSettings(s, { enableGlassEffect: false })
    await nextTick()
    expect(s.enableGlassEffect).toBe(false)

    setAppSettings(s, { enableGlassEffect: 'true' })
    await nextTick()
    expect(s.enableGlassEffect).toBe(true)

    setAppSettings(s, { enableGlassEffect: '1' })
    await nextTick()
    expect(s.enableGlassEffect).toBe(true)

    setAppSettings(s, { enableGlassEffect: 'false' })
    await nextTick()
    expect(s.enableGlassEffect).toBe(false)

    setAppSettings(s, { enableGlassEffect: '0' })
    await nextTick()
    expect(s.enableGlassEffect).toBe(false)

    setAppSettings(s, { enableGlassEffect: 'weird' })
    await nextTick()
    expect(s.enableGlassEffect).toBe(true) // 未知字符串 → true
  })

  it('summaryCards：解析、逐项过滤非法、上限 6、空白/全非法回落默认', async () => {
    setAppSettings(s, { summaryCards: 'disk , memory, bogus, connections' })
    await nextTick()
    expect(s.summaryCards).toEqual(['disk', 'memory', 'connections'])

    setAppSettings(s, { summaryCards: 'memory,disk,finance,traffic,speedUp,speedDown,connections' })
    await nextTick()
    // slice(0,6) 截断第 7 项
    expect(s.summaryCards).toEqual(['memory', 'disk', 'finance', 'traffic', 'speedUp', 'speedDown'])
    expect(s.summaryCards).toHaveLength(6)

    setAppSettings(s, { summaryCards: 'bogus,xxx' })
    await nextTick()
    expect(s.summaryCards).toEqual(['memory', 'disk', 'finance', 'traffic', 'speedUp', 'speedDown'])

    setAppSettings(s, { summaryCards: '   ' })
    await nextTick()
    expect(s.summaryCards).toEqual(['memory', 'disk', 'finance', 'traffic', 'speedUp', 'speedDown'])
  })

  it('currentBackgroundUrl 跟随 resolvedThemeMode', async () => {
    setAppSettings(s, { lightBackgroundUrl: '/light.png', darkBackgroundUrl: '/dark.png' })
    await nextTick()

    s.themeMode = 'dark'
    await settle()
    expect(s.resolvedThemeMode).toBe('dark')
    expect(s.currentBackgroundUrl).toBe('/dark.png')

    s.themeMode = 'light'
    await settle()
    expect(s.resolvedThemeMode).toBe('light')
    expect(s.currentBackgroundUrl).toBe('/light.png')
  })
})

describe('useAppStore · updateLoginState', () => {
  beforeEach(freshPinia)

  it('切换登录态', async () => {
    const s = useAppStore()
    expect(s.isLoggedIn).toBe(false)
    s.updateLoginState(true)
    expect(s.isLoggedIn).toBe(true)
    s.updateLoginState(false)
    expect(s.isLoggedIn).toBe(false)
  })
})

// ===========================================================================
// useNodesStore
// ===========================================================================

function makeClient(overrides: Partial<Client> & { uuid: string }): Client {
  return {
    uuid: overrides.uuid,
    name: overrides.uuid,
    cpu_name: 'CPU',
    virtualization: 'kvm',
    arch: 'x86_64',
    cpu_cores: 2,
    os: 'Debian',
    kernel_version: '6.1',
    region: 'CN',
    public_remark: '',
    mem_total: 1024,
    swap_total: 0,
    disk_total: 10240,
    weight: 0,
    price: 0,
    billing_cycle: 30,
    auto_renewal: false,
    currency: 'CNY',
    expired_at: '',
    group: '',
    tags: '',
    hidden: false,
    traffic_limit: 0,
    traffic_limit_type: 'sum',
    created_at: '',
    updated_at: '',
    ...overrides,
  }
}

function makeStatus(overrides: Partial<NodeStatus> & { client: string }): NodeStatus {
  return {
    client: overrides.client,
    time: '2026-10-14T00:00:00Z',
    cpu: 0,
    gpu: 0,
    ram: 0,
    ram_total: 0,
    swap: 0,
    swap_total: 0,
    load: 0,
    load5: 0,
    load15: 0,
    temp: 0,
    disk: 0,
    disk_total: 0,
    net_in: 0,
    net_out: 0,
    net_total_up: 0,
    net_total_down: 0,
    process: 0,
    connections: 0,
    connections_udp: 0,
    online: true,
    uptime: 0,
    ...overrides,
  }
}

describe('useNodesStore · 初始状态', () => {
  let s: ReturnType<typeof useNodesStore>

  beforeEach(() => {
    freshPinia()
    s = useNodesStore()
  })

  it('空集合的初始值与派生值', () => {
    expect(s.nodes).toEqual([])
    expect(s.wsConnectionState).toBe('disconnected')
    expect(s.wsReconnectAttempts).toBe(0)
    expect(s.totalCount).toBe(0)
    expect(s.onlineCount).toBe(0)
    expect(s.groups).toEqual([])
    expect(s.nodesByUuid).toBeInstanceOf(Map)
    expect(s.nodesByUuid.size).toBe(0)
  })
})

describe('useNodesStore · initNodes：合并、默认值、排序、增删', () => {
  let s: ReturnType<typeof useNodesStore>

  beforeEach(() => {
    freshPinia()
    s = useNodesStore()
  })

  it('空入参 → 空列表', () => {
    s.initNodes({}, {})
    expect(s.nodes).toEqual([])
  })

  it('单节点无状态：从 client 建立，状态字段全部归零且 online=false', () => {
    const c = makeClient({ uuid: 'a', name: 'Alpha', mem_total: 2048, group: 'g1' })
    s.initNodes({ a: c }, {})

    expect(s.nodes).toHaveLength(1)
    const n = s.nodes[0]!
    expect(n.uuid).toBe('a')
    expect(n.name).toBe('Alpha')
    expect(n.mem_total).toBe(2048)
    expect(n.group).toBe('g1')
    expect(n.online).toBe(false)
    expect(n.cpu).toBe(0)
    expect(n.ram).toBe(0)
    expect(n.net_total_up).toBe(0)
    expect(n.connections).toBe(0)
    expect(n.uptime).toBe(0)
    expect(n.time).toBe('')
    expect(s.onlineCount).toBe(0)
    expect(s.totalCount).toBe(1)
  })

  it('单节点有状态：指标与 online 取自 status', () => {
    const c = makeClient({ uuid: 'a' })
    const st = makeStatus({ client: 'a', online: true, cpu: 42, ram: 55, net_total_up: 10, net_total_down: 20, connections_udp: 3 })
    s.initNodes({ a: c }, { a: st })

    const n = s.nodes[0]!
    expect(n.online).toBe(true)
    expect(n.cpu).toBe(42)
    expect(n.ram).toBe(55)
    expect(n.net_total_up).toBe(10)
    expect(n.net_total_down).toBe(20)
    expect(n.connections_udp).toBe(3)
    expect(n.time).toBe(st.time)
    expect(s.onlineCount).toBe(1)
  })

  it('离线节点：status.online=false 时 online=false，计数不计入', () => {
    const c = makeClient({ uuid: 'a' })
    s.initNodes({ a: c }, { a: makeStatus({ client: 'a', online: false, cpu: 7 }) })
    expect(s.nodes[0]!.online).toBe(false)
    expect(s.nodes[0]!.cpu).toBe(7) // 指标仍来自 status
    expect(s.onlineCount).toBe(0)
  })

  it('多节点排序：在线优先，同状态内 weight 升序', () => {
    const clients: Record<string, Client> = {
      a: makeClient({ uuid: 'a', weight: 10 }),
      b: makeClient({ uuid: 'b', weight: 1 }),
      c: makeClient({ uuid: 'c', weight: 5 }),
      d: makeClient({ uuid: 'd', weight: 2 }),
    }
    const statuses: Record<string, NodeStatus> = {
      a: makeStatus({ client: 'a', online: true }),
      b: makeStatus({ client: 'b', online: true }),
      c: makeStatus({ client: 'c', online: false }),
      d: makeStatus({ client: 'd', online: false }),
    }
    s.initNodes(clients, statuses)

    expect(s.nodes.map(n => n.uuid)).toEqual(['b', 'a', 'd', 'c'])
    expect(s.onlineCount).toBe(2)
    expect(s.totalCount).toBe(4)
  })

  it('重复调用幂等：更新现有节点而不新增', () => {
    const c = makeClient({ uuid: 'a', name: 'First' })
    s.initNodes({ a: c }, { a: makeStatus({ client: 'a', online: true, cpu: 1 }) })
    s.initNodes({ a: makeClient({ uuid: 'a', name: 'Updated' }) }, { a: makeStatus({ client: 'a', online: true, cpu: 9 }) })

    expect(s.nodes).toHaveLength(1)
    expect(s.nodes[0]!.name).toBe('Updated')
    expect(s.nodes[0]!.cpu).toBe(9)
  })

  it('移除不再存在的节点', () => {
    s.initNodes({ a: makeClient({ uuid: 'a' }), b: makeClient({ uuid: 'b' }) }, {})
    expect(s.totalCount).toBe(2)

    s.initNodes({ a: makeClient({ uuid: 'a' }) }, {})
    expect(s.nodes.map(n => n.uuid)).toEqual(['a'])
  })

  it('跳过值为空的 client 条目', () => {
    s.initNodes({ a: undefined as unknown as Client, b: makeClient({ uuid: 'b' }) }, {})
    expect(s.nodes.map(n => n.uuid)).toEqual(['b'])
  })
})

describe('useNodesStore · groups 派生', () => {
  let s: ReturnType<typeof useNodesStore>

  beforeEach(() => {
    freshPinia()
    s = useNodesStore()
  })

  it('去重并按首现顺序，支持分号多分组；空分组不产出', () => {
    s.initNodes({
      a: makeClient({ uuid: 'a', group: 'g1;g2' }),
      b: makeClient({ uuid: 'b', group: 'g2;g3' }),
      c: makeClient({ uuid: 'c', group: '' }),
    }, {})
    expect(s.groups).toEqual(['g1', 'g2', 'g3'])
  })

  it('单节点单分组', () => {
    s.initNodes({ a: makeClient({ uuid: 'a', group: 'solo' }) }, {})
    expect(s.groups).toEqual(['solo'])
  })
})

describe('useNodesStore · nodesByUuid 派生', () => {
  let s: ReturnType<typeof useNodesStore>

  beforeEach(() => {
    freshPinia()
    s = useNodesStore()
  })

  it('以 uuid 建索引并可取回同一对象', () => {
    s.initNodes({ a: makeClient({ uuid: 'a' }), b: makeClient({ uuid: 'b' }) }, {})
    expect(s.nodesByUuid.size).toBe(2)
    expect(s.nodesByUuid.get('a')).toBe(s.nodes.find(n => n.uuid === 'a'))
    expect(s.nodesByUuid.get('missing')).toBeUndefined()
  })
})

describe('useNodesStore · updateNodeStatuses', () => {
  let s: ReturnType<typeof useNodesStore>

  beforeEach(() => {
    freshPinia()
    s = useNodesStore()
    s.initNodes({
      a: makeClient({ uuid: 'a', weight: 1 }),
      b: makeClient({ uuid: 'b', weight: 2 }),
    }, {
      a: makeStatus({ client: 'a', online: true }),
      b: makeStatus({ client: 'b', online: true }),
    })
    expect(s.nodes.map(n => n.uuid)).toEqual(['a', 'b'])
  })

  it('更新已知节点的指标，忽略未知 uuid', () => {
    s.updateNodeStatuses({
      a: makeStatus({ client: 'a', online: true, cpu: 88, ram: 66 }),
      zzz: makeStatus({ client: 'zzz', online: true, cpu: 1 }),
    })
    expect(s.nodes.find(n => n.uuid === 'a')!.cpu).toBe(88)
    expect(s.nodes.find(n => n.uuid === 'a')!.ram).toBe(66)
    expect(s.nodes.some(n => n.uuid === 'zzz')).toBe(false)
  })

  it('online 状态不变时不重新排序', () => {
    s.updateNodeStatuses({ b: makeStatus({ client: 'b', online: true, cpu: 5 }) })
    expect(s.nodes.map(n => n.uuid)).toEqual(['a', 'b'])
  })

  it('节点上下线触发重新排序（离线沉底）', () => {
    s.updateNodeStatuses({ a: makeStatus({ client: 'a', online: false }) })
    expect(s.nodes.map(n => n.uuid)).toEqual(['b', 'a'])
    expect(s.onlineCount).toBe(1)
  })
})

describe('useNodesStore · updateNodeClients', () => {
  let s: ReturnType<typeof useNodesStore>

  beforeEach(() => {
    freshPinia()
    s = useNodesStore()
    s.initNodes({
      a: makeClient({ uuid: 'a', name: 'Old', weight: 1 }),
    }, {
      a: makeStatus({ client: 'a', online: true, cpu: 33, uptime: 12345 }),
    })
  })

  it('更新已有节点基本信息，但保留状态指标', () => {
    s.updateNodeClients({ a: makeClient({ uuid: 'a', name: 'New', weight: 1 }) })
    const n = s.nodes.find(x => x.uuid === 'a')!
    expect(n.name).toBe('New')
    expect(n.online).toBe(true)
    expect(n.cpu).toBe(33)
    expect(n.uptime).toBe(12345)
  })

  it('新增节点不带状态（online=false，指标归零）', () => {
    s.updateNodeClients({
      a: makeClient({ uuid: 'a', name: 'New', weight: 1 }),
      b: makeClient({ uuid: 'b', weight: 2 }),
    })
    const b = s.nodes.find(x => x.uuid === 'b')!
    expect(b.online).toBe(false)
    expect(b.cpu).toBe(0)
    // a 在线在前，b 离线在后
    expect(s.nodes.map(n => n.uuid)).toEqual(['a', 'b'])
  })

  it('移除缺失节点', () => {
    s.updateNodeClients({ b: makeClient({ uuid: 'b' }) })
    expect(s.nodes.map(n => n.uuid)).toEqual(['b'])
  })
})

describe('useNodesStore · sortNodesByWeight', () => {
  let s: ReturnType<typeof useNodesStore>

  beforeEach(() => {
    freshPinia()
    s = useNodesStore()
  })

  it('离线沉底，在线/离线各自按 weight 升序', () => {
    s.initNodes({
      a: makeClient({ uuid: 'a', weight: 5 }),
      b: makeClient({ uuid: 'b', weight: 1 }),
      c: makeClient({ uuid: 'c', weight: 3 }),
      d: makeClient({ uuid: 'd', weight: 0 }),
    }, {
      a: makeStatus({ client: 'a', online: true }),
      b: makeStatus({ client: 'b', online: true }),
      c: makeStatus({ client: 'c', online: false }),
      d: makeStatus({ client: 'd', online: false }),
    })
    // 在线组按 weight 升序 → b(1),a(5)；离线组 → d(0),c(3)
    expect(s.nodes.map(n => n.uuid)).toEqual(['b', 'a', 'd', 'c'])

    // 手动再调用一次应保持稳定
    s.sortNodesByWeight()
    expect(s.nodes.map(n => n.uuid)).toEqual(['b', 'a', 'd', 'c'])
  })
})

describe('useNodesStore · WS 连接状态与 clearNodes', () => {
  let s: ReturnType<typeof useNodesStore>

  beforeEach(() => {
    freshPinia()
    s = useNodesStore()
  })

  it('updateWsState 设置状态；attempts 省略时保持前值', () => {
    s.updateWsState('connecting')
    expect(s.wsConnectionState).toBe('connecting')
    expect(s.wsReconnectAttempts).toBe(0)

    s.updateWsState('reconnecting', 3)
    expect(s.wsConnectionState).toBe('reconnecting')
    expect(s.wsReconnectAttempts).toBe(3)

    s.updateWsState('connected')
    expect(s.wsConnectionState).toBe('connected')
    expect(s.wsReconnectAttempts).toBe(3) // 未被覆盖
  })

  it('clearNodes 清空节点，但不重置 WS 状态（见总结）', () => {
    s.initNodes({ a: makeClient({ uuid: 'a' }) }, {})
    s.updateWsState('connected', 2)
    s.clearNodes()
    expect(s.nodes).toEqual([])
    expect(s.totalCount).toBe(0)
    expect(s.wsConnectionState).toBe('connected')
    expect(s.wsReconnectAttempts).toBe(2)
  })
})
