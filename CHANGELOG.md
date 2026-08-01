# Changelog

## [0.54.0] - 2026-08-01

### Fixed
- 背景改为完整像素田园图 `bg-sky.png`（蓝天/草地/远山），对齐 PDF 与 preview
- 移除 hard-pixel-core 对场景层的 `background-image: none` / 全局 `box-shadow: none` 破坏
- 页面底色改为天空蓝，避免出现深蓝斜纹底

### Changed
- TopStatsGrid 改为木牌布局 + 像素图标（对齐 preview 木框卡片）
- NodeCard `.sd-card` 强制木纹边框与硬阴影


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
