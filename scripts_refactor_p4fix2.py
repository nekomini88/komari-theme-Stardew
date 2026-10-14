"""P4 补漏之二：修「分段拼接」形式的路径引用。

上一步的正则只认字面量 "styles/v2/card.css"，漏掉了这种写法：
  resolve(__dirname, '..', '..', 'src', 'styles', 'v2', 'card.css')
这里按**参数序列**精确替换：'v2', '<名>.css' → 'v2', '<子目录>', '<名>.css'
"""
import pathlib
import re

ROOT = pathlib.Path('/root/komari-theme-farmer')
MOVED = {
    'scene.css': 'base', 'shell.css': 'base',
    'card.css': 'components', 'chart.css': 'components', 'home.css': 'components',
    'palette.css': 'components', 'toolbar.css': 'components',
    'tokens.css': 'tokens',
}

targets = [p for p in list(ROOT.glob('tests/**/*.ts')) + list(ROOT.glob('src/**/*.ts')) + list(ROOT.glob('src/**/*.vue'))
           if 'node_modules' not in str(p)]

changed = {}
for p in targets:
    t = p.read_text(encoding='utf-8')
    orig = t
    hits = []
    for name, sub in MOVED.items():
        # JS 参数序列：'v2', 'card.css'  →  'v2', 'components', 'card.css'
        pat = re.compile(rf"(['\"]v2['\"]\s*,\s*)(['\"]{re.escape(name)}['\"])")
        t2, n = pat.subn(rf"\g<1>'{sub}', \g<2>", t)
        # 已带子目录的不要再套一层（防重复执行）
        t2 = re.sub(rf"'(?:{sub})',\s*'(?:{sub})',\s*('{re.escape(name)}')", rf"'{sub}', \1", t2)
        if n:
            hits.append(f'{name}×{n}')
            t = t2
    if t != orig:
        p.write_text(t, encoding='utf-8')
        changed[str(p.relative_to(ROOT))] = hits

print(f'  改动了 {len(changed)} 个文件:')
for f, h in sorted(changed.items()):
    print(f'    {f}   ({", ".join(h)})')

print('\n=== 复核：两种写法都查一遍 ===')
bad = []
for p in targets:
    t = p.read_text(encoding='utf-8')
    for name in MOVED:
        if re.search(rf"(['\"]v2['\"]\s*,\s*['\"]{re.escape(name)}['\"])", t):
            bad.append(f'{p.relative_to(ROOT)}: 分段写法未改 → {name}')
        if re.search(rf"styles/v2/(?!(base|components|tokens)/){re.escape(name)}", t):
            bad.append(f'{p.relative_to(ROOT)}: 字面写法未改 → {name}')
print('  ✓ 零残留' if not bad else f'  ✗ {len(bad)} 处: ' + '; '.join(bad[:6]))
