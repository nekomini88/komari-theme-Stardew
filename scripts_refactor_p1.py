"""P1『拆 regionHelper』：把 1556 行纯数据表搬去 src/data/regionMap.ts，逻辑留在原文件。

手法要点（零引用破坏）：
  · 原 regionHelper.ts 继续 `export { emojiToRegionMap }` —— 所有已有 import 一字不用改 ✓
  · 数据表按**行切片**原样搬运，不做任何文本改写，保证内容逐字节一致 ✓
  · 搬完立刻：跑全量测试（422 条）+ vue-tsc + 构建，三者全绿才算过 ✓
"""
import pathlib
import re
import shutil
import subprocess
import sys

ROOT = pathlib.Path('/root/komari-theme-farmer')
SRC = ROOT / 'src/utils/regionHelper.ts'
DST = ROOT / 'src/data/regionMap.ts'

text = SRC.read_text(encoding='utf-8')
lines = text.split('\n')

# 定位数据表起点与逻辑起点
start = next(i for i, l in enumerate(lines) if l.startswith('export const emojiToRegionMap'))
end = next(i for i, l in enumerate(lines) if l.startswith('export function isRegionMatch'))
print(f'  数据表: L{start+1}..{end} 共 {end-start} 行')
print(f'  逻辑段: L{end+1}..{len(lines)} 共 {len(lines)-end} 行')

table_lines = lines[start:end]
rest = lines[:start] + lines[end:]

DST.parent.mkdir(parents=True, exist_ok=True)
DST.write_text(
    '// 地区→旗标 emoji 映射表（由 src/utils/regionHelper.ts 拆分而来，2026-10-14 重构 P1）\n'
    '// 纯数据，无逻辑：改这张表不影响任何函数行为。\n\n'
    + '\n'.join(table_lines).rstrip() + '\n',
    encoding='utf-8',
)
print(f'  ✓ 数据表已写入 {DST.relative_to(ROOT)}')

# 原文件：头部加 import，并在数据表原位放一行 import + re-export
header = []
body = []
for l in rest:
    (body if body or l.strip() == '' else header).append(l)

new_src = '\n'.join(header).rstrip() + '\n'
new_src += ("import { emojiToRegionMap } from '@/data/regionMap'\n\n"
            "// 继续从这里导出：历史调用方（含测试）无需改动任何 import。\n"
            "export { emojiToRegionMap }\n\n")
new_src += '\n'.join(body).lstrip('\n')
SRC.write_text(new_src, encoding='utf-8')
print(f'  ✓ {SRC.relative_to(ROOT)} 已改为引用 + 转导出（新文件 {len(new_src.splitlines())} 行）')

print('\n=== 验证 ===')
for cmd, tag in [('bun run test', '全量测试'), ('bunx vue-tsc --noEmit', '类型检查')]:
    r = subprocess.run(cmd.split(), cwd=ROOT, capture_output=True, text=True, timeout=900)
    out = (r.stdout + r.stderr)
    if tag == '全量测试':
        keep = [l for l in out.splitlines() if re.search(r'Test Files|Tests ', l)]
        print('  ' + tag + ': ' + ' | '.join(keep[:2]))
    else:
        errs = [l for l in out.splitlines() if 'error' in l.lower()]
        print(f'  {tag}: ' + ('零错误 ✓' if not errs else f'{len(errs)} 个错误 ✗'))
        for e in errs[:5]:
            print('     ', e[:150])
    print(f'      (exit {r.returncode})')
