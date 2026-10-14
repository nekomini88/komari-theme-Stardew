"""P4 补漏：把测试里指向样式文件的**旧路径字符串**改成新路径。

为什么只改路径：这次失败是 ENOENT（文件读不到），不是断言不成立 ——
测试的断言语义与期望值一字不用动，只把 "去哪儿读文件" 改对。

映射（来自 git status 里的 git mv 结果）：
  scene/shell → v2/base/       card/chart/home/palette/toolbar → v2/components/
  tokens      → v2/tokens/
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

# 只匹配「styles/v2/<名>.css」且其后不是已经带子目录的形式
targets = []
for pat in ('tests/**/*.ts', 'src/**/*.ts', 'src/**/*.vue', '**/*.md'):
    targets += list(ROOT.glob(pat))

changed = {}
for p in targets:
    if 'node_modules' in str(p) or '/dist/' in str(p) or '/coverage/' in str(p):
        continue
    try:
        t = p.read_text(encoding='utf-8')
    except Exception:
        continue
    orig = t
    hits = []
    for name, sub in MOVED.items():
        # 旧路径：styles/v2/<name>  且 <name> 前不是 base/ components/ tokens/
        pat = re.compile(rf'(?<!base/)(?<!components/)(?<!tokens/)(styles/v2/){re.escape(name)}')
        t2, n = pat.subn(rf'\g<1>{sub}/{name}', t)
        if n:
            hits.append(f'{name}×{n}')
            t = t2
    if t != orig:
        p.write_text(t, encoding='utf-8')
        changed[str(p.relative_to(ROOT))] = hits

print(f'  改动了 {len(changed)} 个文件:')
for f, h in sorted(changed.items()):
    print(f'    {f}   ({", ".join(h)})')

print('\n=== 复核：是否还有指向旧路径的引用 ===')
resid = []
for p in targets:
    if 'node_modules' in str(p) or '/dist/' in str(p) or '/coverage/' in str(p):
        continue
    try:
        t = p.read_text(encoding='utf-8')
    except Exception:
        continue
    for m in re.finditer(r'styles/v2/[A-Za-z0-9_\-]+\.css', t):
        s = m.group(0)
        if not re.match(r'styles/v2/(base|components|tokens)/', s):
            resid.append(f'{p.relative_to(ROOT)}: {s}')
if resid:
    print(f'  ✗ 仍有 {len(resid)} 处旧路径:')
    for r in resid[:10]:
        print('   ', r)
else:
    print('  ✓ 零残留')
