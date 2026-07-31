from pathlib import Path
import sys
import zipfile

ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / 'dist'
ZIPS = list(ROOT.glob('komari-theme-stardew-build-*.zip'))
MANIFEST = ROOT / 'komari-theme.json'
PREVIEW = ROOT / 'docs' / 'preview.png'

def test_zip_exists():
    assert ZIPS, 'no build zip found'
    z = ZIPS[-1]
    assert z.stat().st_size > 100_000, f'zip too small: {z}'
    with zipfile.ZipFile(z) as zf:
        names = zf.namelist()
    assert 'komari-theme.json' in names
    assert 'preview.png' in names
    assert any(n.startswith('dist/') for n in names)

def test_manifest_valid():
    import json
    data = json.loads(MANIFEST.read_text())
    assert data['name'] == 'Komari Stardew'
    assert data['short'] == 'stardew'
    assert data['url'].endswith('komari-theme-Stardew')

def test_preview_exists():
    assert PREVIEW.exists(), 'preview.png missing'
    assert PREVIEW.stat().st_size > 10_000, 'preview too small'

if __name__ == '__main__':
    test_zip_exists()
    test_manifest_valid()
    test_preview_exists()
    print('OK: build artifacts')
