from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
SPEC = ROOT / 'spec.yaml'

def test_spec_exists():
    assert SPEC.exists(), 'spec.yaml missing'

def test_spec_valid():
    import yaml
    with SPEC.open() as f:
        data = yaml.safe_load(f)
    assert data['spec']['schema'] == '1.0'
    assert data['spec']['version'] == '1.2.0'
    assert data['project']['type'] == 'web_fullstack'
    assert isinstance(data['references']['items'], list)
    assert len(data['references']['items']) > 0

if __name__ == '__main__':
    test_spec_exists()
    test_spec_valid()
    print('OK: spec.yaml')
