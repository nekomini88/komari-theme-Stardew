from pathlib import Path
import importlib.util

ROOT = Path(__file__).resolve().parent
GROUPS = {
    'verify_spec': ['test_spec_exists', 'test_spec_valid'],
    'verify_build': ['test_zip_exists', 'test_manifest_valid', 'test_preview_exists'],
    'verify_dev': ['test_header_theme_option', 'test_css_theme_variables'],
}

for mod_name, fns in GROUPS.items():
    mod_path = ROOT / f'{mod_name}.py'
    spec = importlib.util.spec_from_file_location(mod_name, mod_path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    for fn in fns:
        getattr(mod, fn)()
print('ALL TESTS PASSED')
