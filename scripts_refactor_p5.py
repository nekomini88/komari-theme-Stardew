"""P5『文档归正』：把陈旧/误导的仓库说明改对。

为什么这件事值得优先做（不是装修，是止损）：
  AGENTS.md 里写着「There is no test suite in this repository / Do not invent bun test」，
  而实际仓库有 422 条用例 —— 后续任何 agent（包括我）读了都会**主动不去跑测试**，
  这正是这个仓库最危险的一条错误信息。另外还有旧项目名 emerald 与旧 zip 命名。
"""
import pathlib
import re

ROOT = pathlib.Path('/root/komari-theme-farmer')

AGENTS = ROOT / 'AGENTS.md'
s = AGENTS.read_text(encoding='utf-8')

edits = [
    # 旧项目名
    ('Repo guide for `komari-theme-emerald`.', 'Repo guide for `Komari-Farmer`（夏夜祭典/农场风格 Komari 监控主题）.'),
    ('`komari-theme-emerald-build-<sha>.zip`', '`komari-theme-Komari-Farmer-v<version>-<sha>.zip`'),
    ('especially `komari-theme-emerald-build-<sha>.zip`', 'especially `komari-theme-Komari-Farmer-v<version>-<sha>.zip`'),
    # 「没有测试套件」—— 最危险的一条
    ('- There is no test suite in this repository\n- Do not invent `bun test` or Vitest commands here',
     '- 本仓库**有**测试套件：vitest，`bun run test`（当前 422 条用例，改动必须保持全绿）\n'
     '- 类型检查用 `bunx vue-tsc --noEmit`；测试与类型检查是重构时的两条生命线，不要跳过'),
    ('CI does not run tests, because there is no test suite.',
     'CI runs install + build. 测试需本地执行 `bun run test`（CI 目前不跑，所以别指望它替你发现回归）。'),
    ('- Root verification is lint plus build, not tests',
     '- Root verification is: `bun run test` + `bunx vue-tsc --noEmit` + `bun run build`（三者都要过）'),
    # 目录结构已变
    ('- `src/` app source',
     '- `src/` app source（2026-10 重构后：utils/ 按职责分子目录，地区数据表在 `src/data/regionMap.ts`）'),
    ('- `src/utils/` is a dense logic and helper area',
     '- `src/utils/` 已按职责分层（api/ region/ media/ format/ …）；纯数据表在 `src/data/`'),
]
n = 0
for a, b in edits:
    if a in s:
        s = s.replace(a, b, 1)
        n += 1
    else:
        print(f'  ! 未命中: {a[:60]}')
AGENTS.write_text(s, encoding='utf-8')
print(f'  ✓ AGENTS.md 修正 {n}/{len(edits)} 处')

# CLAUDE.md
CL = ROOT / 'CLAUDE.md'
if CL.exists():
    c = CL.read_text(encoding='utf-8')
    c2 = c.replace('emerald', 'Komari-Farmer')
    if c2 != c:
        CL.write_text(c2, encoding='utf-8')
        print('  ✓ CLAUDE.md 旧名 emerald → Komari-Farmer')

# 复核残留
print('\n=== 复核 ===')
for f in ['AGENTS.md', 'CLAUDE.md']:
    p = ROOT / f
    t = p.read_text(encoding='utf-8')
    bad = []
    if 'emerald' in t:
        bad.append('仍有 emerald')
    if 'no test suite' in t:
        bad.append('仍说没有测试套件')
    print(f'  {f}: ' + ('✓ 已清干净' if not bad else '✗ ' + '、'.join(bad)))
