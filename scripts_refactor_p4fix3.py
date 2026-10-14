"""P4 补漏之三：按**文件名**逐行审计并修正，不再依赖路径写法模式。

前两轮失败的原因是我按「写法」写正则，而代码里有四种写法：
  1) readFileSync('src/styles/v2/card.css')          字面量
  2) resolve(__dirname,'..','src','styles','v2','card.css')   分段
  3) resolve(v2StyleDir, 'tokens.css')               目录变量 + 文件名
  4) 可能还有拼字符串的
所以这轮改成：**只要一行里出现被移动的文件名，就把它的路径补全**，
最后再逐行复核一遍，任何写法都逃不掉。
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

files = [p for p in list(ROOT.glob('tests/**/*.ts')) + list(ROOT.glob('src/**/*.ts')) + list(ROOT.glob('src/**/*.vue'))
         if 'node_modules' not in str(p)]

changed = {}
for p in files:
    lines = p.read_text(encoding='utf-8').split('\n')
    out = []
    hits = []
    for ln in lines:
        new = ln
        for name, sub in MOVED.items():
            if name not in new:
                continue
            # 已经是新路径（文件名前面紧跟子目录）→ 不动
            if re.search(rf"['\"]{sub}['\"]\s*,\s*['\"]{re.escape(name)}['\"]", new) or \
               re.search(rf"(?:{sub}/|{sub}['\"],\s*['\"]){re.escape(name)}", new) or \
               re.search(rf"styles/v2/{sub}/{re.escape(name)}", new):
                continue
            # 形式 4：resolve(v2StyleDir, 'tokens.css')  /  resolve(..., 'src/styles/v2', 'tokens.css')
            new2 = re.sub(rf"resolve\(\s*(v2StyleDir|[\w.]+)\s*,\s*['\"]{re.escape(name)}['\"]",
                          rf"resolve(\1, '{sub}', '{name}'", new)
            if new2 != new:
                new = new2
                hits.append(f'{name}(resolve)')
                continue
            # 形式 1/2：'v2', 'card.css' 或 'styles/v2', 'card.css'
            new2 = re.sub(rf"(['\"]v2['\"]\s*,\s*)(['\"]{re.escape(name)}['\"])", rf"\g<1>'{sub}', \g<2>", new)
            if new2 != new:
                new = new2
                hits.append(f'{name}(seg)')
                continue
            # 形式 1 变体：字符串里直接写 styles/v2/card.css
            new2 = re.sub(rf"(styles/v2/)({re.escape(name)})", rf"\g<1>{sub}/\g<2>", new)
            if new2 != new:
                new = new2
                hits.append(f'{name}(literal)')
        out.append(new)
    if hits:
        p.write_text('\n'.join(out), encoding='utf-8')
        changed[str(p.relative_to(ROOT))] = sorted(set(hits))

print(f'  改动 {len(changed)} 个文件:')
for f, h in sorted(changed.items()):
    print(f'    {f}   ({", ".join(h)})')

print('\n=== 逐行复核：还有哪一行提到这些文件名却没进子目录 ===')
bad = []
for p in files:
    for i, ln in enumerate(p.read_text(encoding='utf-8').split('\n'), 1):
        for name, sub in MOVED.items():
            if name in ln and not re.search(rf"{sub}[/'\"]", ln):
                bad.append(f'{p.relative_to(ROOT)}:{i}  {ln.strip()[:100]}')
if bad:
    print(f'  ✗ {len(bad)} 行仍可疑:')
    for b in bad[:12]:
        print('   ', b)
else:
    print('  ✓ 无残留')
