from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
HEADER = ROOT / 'src' / 'components' / 'Header.vue'
CSS = ROOT / 'src' / 'styles' / 'main.css'

def test_header_theme_option():
    text = HEADER.read_text()
    assert "value: 'stardew'" in text, 'stardew theme option missing'

def test_css_theme_variables():
    text = CSS.read_text()
    assert '[data-theme="stardew"]' in text, 'stardew data-theme missing'
    assert 'oklch(0.58 0.18 85)' in text, 'primary color missing'

if __name__ == '__main__':
    test_header_theme_option()
    test_css_theme_variables()
    print('OK: source theme integration')
