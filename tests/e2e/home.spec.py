#!/usr/bin/env python3
"""
v2 首页 Playwright e2e（真实浏览器 + 接口拦截喂真实 fixture）

为什么是 Python Playwright：本仓库没有 node 侧 Playwright 依赖，宿主
/usr/bin/python3 已装 playwright + chromium，直接复用，避免装依赖。

覆盖（对应 ART_SYSTEM M2 验收）：
  1. 渲染：卡片数 == fixture 节点数；关键指标文本出现（CPU/内存/硬盘/流量/在线）
  2. 无控制台错误、无未捕获异常（首页快乐路径）
  3. 三态：加载态 home-loading 可见
  4. 失败态：/api/rpc2 getNodes 500 → home-error；点 state-retry 后恢复渲染卡片
  5. 交互：搜索 / 状态筛选 / 排序 真的改变卡片集合
  6. 截图：桌面 1440x900 全页 + 移动 390x844 全页

依赖宿主服务：BASE_URL（默认 http://localhost:5173），先 `bun run dev`。
运行：/usr/bin/python3 tests/e2e/home.spec.py
"""

import json
import os
import sys
import time
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
FIXTURE = json.loads((ROOT / 'tests' / 'fixtures' / 'clients.sample.json').read_text())
BASE_URL = os.environ.get('BASE_URL', 'http://localhost:5173')
SHOT_DIR = Path(__file__).resolve().parent / 'screenshots'
SHOT_DIR.mkdir(exist_ok=True)

NODES = FIXTURE['nodes']
STATUSES = FIXTURE['statuses']
NODE_COUNT = len(NODES)
# fixture 里：4 台有状态且在线，2 台无任何状态（unknown）
ONLINE_COUNT = sum(1 for s in STATUSES.values() if s.get('online'))
UNKNOWN_COUNT = NODE_COUNT - len(STATUSES)
# cpu 最高的节点（27.9%）——排序断言用
TOP_CPU_UUID = max(STATUSES.items(), key=lambda kv: kv[1]['cpu'])[0]
JP_UUID = next(u for u, n in NODES.items() if '日本' in n['name'])

results = []


def check(name, ok, detail=''):
    results.append((name, bool(ok), detail))
    print(f"{'PASS' if ok else 'FAIL'} | {name}" + (f" | {detail}" if detail else ''))
    return ok


def js_body(route):
    try:
        return json.loads(route.request.post_data or '{}')
    except Exception:
        return {}


class Api:
    """共享的接口拦截状态：fail_nodes=True 时 getNodes 返回 500（用于错误态）。"""

    def __init__(self):
        self.fail_nodes = False
        self.delay_ms = 0

    def handle(self, route):
        url = route.request.url
        if url.endswith('/api/rpc2'):
            body = js_body(route)
            m = body.get('method')
            if m in ('common:getNodes', 'common:getNodesLatestStatus') and self.delay_ms:
                time.sleep(self.delay_ms / 1000)
            if m == 'common:getNodes':
                if self.fail_nodes:
                    return route.fulfill(status=500, content_type='application/json',
                                         body='{"jsonrpc":"2.0","error":{"code":500,"message":"boom"}}')
                result = NODES
            elif m == 'common:getNodesLatestStatus':
                result = STATUSES
            elif m == 'rpc.ping':
                result = 'pong'
            elif m == 'rpc.getVersion':
                result = {'version': '2.0.0', 'hash': 'e2e'}
            else:
                result = {'records': []}
            return route.fulfill(status=200, content_type='application/json',
                                 body=json.dumps({'jsonrpc': '2.0', 'id': body.get('id'), 'result': result}))
        if url.endswith('/api/public'):
            return route.fulfill(status=200, content_type='application/json',
                                 body=json.dumps({'status': 'success', 'message': 'ok',
                                                  'data': {'site_name': 'NekoVPS',
                                                           'theme_settings': {'dataUpdateInterval': 300}}}))
        if url.endswith('/api/me'):
            return route.fulfill(status=200, content_type='application/json',
                                 body=json.dumps({'logged_in': False, 'username': 'guest'}))
        return route.fulfill(status=200, content_type='application/json', body='{}')


def new_page(browser, api, viewport):
    pg = browser.new_page(viewport=viewport)
    logs = []
    pg.on('console', lambda m: logs.append((m.type, m.text)) if m.type == 'error' else None)
    pg.on('pageerror', lambda e: logs.append(('pageerror', str(e))))
    pg.route('**/api/**', api.handle)
    return pg, logs


def main():
    api = Api()
    with sync_playwright() as p:
        browser = p.chromium.launch()

        # ---------- 场景 A：快乐路径（渲染 / 指标 / 无错误 / 交互 / 截图） ----------
        pg, logs = new_page(browser, api, {'width': 1440, 'height': 900})
        pg.goto(BASE_URL + '/', wait_until='load')
        pg.wait_for_selector('#vk-scene-mid .vk-node-card', timeout=15000)

        cards = pg.locator('#vk-scene-mid .vk-node-card')
        check('① 卡片数 == fixture 节点数',
              cards.count() == NODE_COUNT,
              f'渲染 {cards.count()} / fixture {NODE_COUNT}')

        # ② 关键指标文本：每张卡片都要有 CPU/内存/硬盘/下行/上行/负载/在线/累计流量
        first = cards.first
        metric_fields = ['cpu', 'mem', 'mem-detail', 'disk', 'disk-detail',
                         'net-in', 'net-out', 'load', 'uptime', 'traffic-down', 'traffic-up', 'latency']
        missing = [f for f in metric_fields
                   if not (first.locator(f'[data-field="{f}"]').count()
                           and first.locator(f'[data-field="{f}"]').inner_text().strip())]
        status_text = first.locator('.vk-card-status').inner_text().strip()
        check('② 关键指标文本齐全（CPU/内存/硬盘/流量/负载/在线时长）',
              not missing and bool(status_text),
              f'缺失={missing} 状态文案={status_text!r}')

        # 顶栏总览在线/总数
        overview_online = pg.locator('[data-testid="overview"] [data-field="online"] .vk-overview-value').inner_text()
        check('② 总览在线/总数文本正确',
              overview_online == f'{ONLINE_COUNT} / {NODE_COUNT}',
              f'实际 {overview_online!r} 期望 {ONLINE_COUNT} / {NODE_COUNT}')

        # ③ 无控制台错误 / 无未捕获异常
        check('③ 快乐路径无控制台错误与未捕获异常',
              len(logs) == 0, f'捕获 {len(logs)} 条: {logs[:3]}')

        # ⑤a 搜索：输入「日本」→ 只剩 1 张（日本free）
        pg.fill('[data-testid="node-search"]', '日本')
        pg.wait_for_timeout(200)
        n_search = pg.locator('#vk-scene-mid .vk-node-card').count()
        ids_search = pg.locator('#vk-scene-mid .vk-node-card').evaluate_all(
            "els => els.map(e => e.getAttribute('data-node-id'))")
        check('⑤a 搜索「日本」改变卡片集合',
              n_search == 1 and ids_search == [JP_UUID],
              f'命中 {n_search} 张 ids={ids_search}')
        pg.fill('[data-testid="node-search"]', '')
        pg.wait_for_timeout(200)

        # ⑤b 状态筛选：在线 → 4 张；未知 → 2 张
        pg.click('[data-testid="node-status-online"]')
        pg.wait_for_timeout(200)
        n_online = pg.locator('#vk-scene-mid .vk-node-card').count()
        pg.click('[data-testid="node-status-unknown"]')
        pg.wait_for_timeout(200)
        n_unknown = pg.locator('#vk-scene-mid .vk-node-card').count()
        check('⑤b 状态筛选「在线/未知」正确改变卡片集合',
              n_online == ONLINE_COUNT and n_unknown == UNKNOWN_COUNT,
              f'在线 {n_online}(期望 {ONLINE_COUNT}) 未知 {n_unknown}(期望 {UNKNOWN_COUNT})')
        pg.click('[data-testid="node-status-all"]')
        pg.wait_for_timeout(200)

        # ⑤c 排序：CPU 升序 → 首张 = cpu 最低？用降序断言首张 = cpu 最高节点
        pg.select_option('[data-testid="node-sort"]', 'cpu')
        pg.wait_for_timeout(150)
        asc_first = pg.locator('#vk-scene-mid .vk-node-card').first.get_attribute('data-node-id')
        pg.click('[data-testid="node-sort-dir"]')  # 切降序
        pg.wait_for_timeout(200)
        desc_first = pg.locator('#vk-scene-mid .vk-node-card').first.get_attribute('data-node-id')
        n_after_sort = pg.locator('#vk-scene-mid .vk-node-card').count()
        check('⑤c 按 CPU 排序改变顺序（降序首张 = cpu 最高节点）',
              desc_first == TOP_CPU_UUID and n_after_sort == NODE_COUNT,
              f'升序首张={asc_first} 降序首张={desc_first} 期望 {TOP_CPU_UUID}')
        pg.select_option('[data-testid="node-sort"]', 'default')
        pg.wait_for_timeout(200)

        # ⑥ 截图（桌面全页）
        desktop_shot = SHOT_DIR / 'home-desktop-1440x900.png'
        pg.screenshot(path=str(desktop_shot), full_page=True)
        check('⑥ 桌面 1440x900 全页截图已生成',
              desktop_shot.exists() and desktop_shot.stat().st_size > 5000,
              f'{desktop_shot} ({desktop_shot.stat().st_size} bytes)')
        pg.close()

        # ---------- 场景 B：加载态（延迟接口观察 home-loading） ----------
        api.delay_ms = 1500
        pg2, _ = new_page(browser, api, {'width': 1440, 'height': 900})
        pg2.goto(BASE_URL + '/', wait_until='load')
        try:
            pg2.wait_for_selector('[data-testid="home-loading"]', timeout=5000)
            loading_visible = True
        except Exception:
            loading_visible = False
        check('④ 加载态 home-loading 可见', loading_visible)
        api.delay_ms = 0
        pg2.wait_for_selector('#vk-scene-mid .vk-node-card', timeout=15000)
        check('④ 加载完成后卡片出现', pg2.locator('#vk-scene-mid .vk-node-card').count() == NODE_COUNT)
        pg2.close()

        # ---------- 场景 C：错误态 + 重试恢复 ----------
        api.fail_nodes = True
        pg3, logs3 = new_page(browser, api, {'width': 1440, 'height': 900})
        pg3.goto(BASE_URL + '/', wait_until='load')
        try:
            pg3.wait_for_selector('[data-testid="home-error"]', timeout=10000)
            err_visible = True
        except Exception:
            err_visible = False
        retry_btn = pg3.locator('[data-testid="state-retry"]')
        err_text = pg3.locator('[data-testid="home-error"] [data-testid="state-text"]').inner_text() \
            if pg3.locator('[data-testid="home-error"]').count() else ''
        check('⑤ 失败态：接口 500 → home-error 且带重试按钮',
              err_visible and retry_btn.count() == 1,
              f'错误文案={err_text!r} 重试按钮={retry_btn.count()}')

        # 切回成功，点重试 → 恢复渲染卡片
        api.fail_nodes = False
        retry_btn.click()
        try:
            pg3.wait_for_selector('#vk-scene-mid .vk-node-card', timeout=10000)
            recovered = pg3.locator('#vk-scene-mid .vk-node-card').count()
        except Exception:
            recovered = 0
        check('⑤ 点 state-retry 后恢复渲染卡片',
              recovered == NODE_COUNT, f'重试后 {recovered} / {NODE_COUNT}')
        pg3.close()

        # ---------- 场景 D：移动端截图 ----------
        api.fail_nodes = False
        pg4, _ = new_page(browser, api, {'width': 390, 'height': 844})
        pg4.goto(BASE_URL + '/', wait_until='load')
        pg4.wait_for_selector('#vk-scene-mid .vk-node-card', timeout=15000)
        mobile_shot = SHOT_DIR / 'home-mobile-390x844.png'
        pg4.screenshot(path=str(mobile_shot), full_page=True)
        check('⑥ 移动 390x844 全页截图已生成',
              mobile_shot.exists() and mobile_shot.stat().st_size > 5000,
              f'{mobile_shot} ({mobile_shot.stat().st_size} bytes)')
        pg4.close()

        browser.close()

    passed = sum(1 for _, ok, _ in results if ok)
    total = len(results)
    print(f'\n==== e2e 汇总: {passed}/{total} 通过 ====')
    if passed != total:
        for name, ok, detail in results:
            if not ok:
                print(f'  FAILED: {name} | {detail}')
        sys.exit(1)


if __name__ == '__main__':
    main()
