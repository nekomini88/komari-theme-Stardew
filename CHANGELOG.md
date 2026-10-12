# Changelog

## [0.121.0] - 2026-10-12

### Changed
- **场景世界的时间基准改为「我们的时间（UTC+8）」**：时间 / 季节 / 天气不再由访客本地时钟驱动，
  改为取服务端 HTTP `Date` 响应头建立锚点（复用启动时既有的 `/api/public` 等请求，**零额外请求**），
  并用请求往返中点抵消 RTT，访客时钟只当滴答器。访客系统时间不准或身处其他时区，看到的世界完全一致。
- 场景状态改为每 60s 重算一次，日夜与季节会自然推进（原来仅在页面加载时算一次就固定）。
- 天气判定新增按显式「年月日」取种的 `weatherFromDaySeed()`，避免 `Date` 本地 getter 按访客时区取错日期；
  `weatherFromDate()` 保留但仅作兼容。

### Added
- 新增 6 个后台配置项（`komari-theme.json` → 分组「场景世界（时间 / 季节 / 天气）」）：
  `sceneTimeMode` / `sceneFixedTime` / `sceneSeasonMode` / `sceneFixedSeason` /
  `weatherMode`（`off` / `auto` / `fixed` 三态，默认 `auto`）/ `weatherFixed`
- 新增 `utils/serverClock.ts`（世界时钟）与 `v2/theme/sceneConfig.ts`（配置解析），均带单测；
  并新增契约测试：配置项 `options` 白名单必须与代码枚举逐项一致，防止脱钩

### Removed
- **移除全部 URL 覆盖口**（`?scene=` / `?season=` / `?weather=` / `?life=`）：
  此前任何访客改 URL 即可改世界，与「场景由管理员设置」冲突。今后手动覆盖只走配置项。

## [0.114.0] - 2026-10-11

### Added
- 生态 / 天气精灵换成 AI 生成的像素 sprite（22 张 32×32）：鸟、兔子、萤火虫、云、雾缕、冰、闪电、雨滴、雪花、星星，
  以及**蝴蝶 / 花 / 叶的四季变体**（逐色单独生成，不做色相旋转改色）
- 界面图标换成像素 sprite（44 张 16×16），新增 `PixelIcon.vue` + `utils/pixelIcons.ts`：
  找不到像素图时自动回落 Iconify 矢量图标，不会空白
- 新增流量图标三件套（总量 / 上行 / 下行），解决原来三张统计卡共用一个图标、分不清上下行的问题

### Changed
- 生态层渲染改为按当前季节取图（`spriteOf()`），`lightning` 不再复用雾缕贴图
- 删除旧的矢量 sprite（`src/assets/sprites/*.svg`），全部由像素 PNG 取代

### Fixed
- 抠图管线补洞：白云、白兔这类"白主体 + 白底"的素材不再被整块抠成空白

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
