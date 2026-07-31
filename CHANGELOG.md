# Changelog

## [1.0.0] - 2026-07-31

### Added
- 新增 `stardew` 主题，对齐 Header 主题选择菜单
- `data-theme="stardew"` CSS 变量集合：matte cream / hard shadow / Nunito / pixel pill / dotted border
- `vitest` 单测 + 集成测试 + v8 coverage（lines >= 80%）
- `tests/unit/` + `tests/integration/` + `tests/fixtures/`
- GitHub Actions Release On Version Bump workflow
- ADR-001: Stardew 主题决策记录
- rollback docs

### Changed
- README 增加验收标准 DoD、使用说明、测试命令
- `vite.config.ts` zip 产物名改为 `komari-theme-stardew-build-*.zip`
- `.gitignore` 修正 regex 警告，增加 `bun.lock` / `komari-theme-*.zip`

### Fixed
- CI Release 附件名从 neko 改为 stardew

### Security
- 排除未跟踪的 `README.md.orig`，避免临时文件泄露
## [0.1.1] - 2026-07-31

### Fixed
- fix release workflow zip attachment by bumping version to trigger release
