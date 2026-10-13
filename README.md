<h3 align="center">Komari-Farmer</h3>
<p align="center">
农场像素风主题 · 基于 Vue 3 + Vite + reka-ui + Tailwind CSS v4 构建
</p>

![preview](./docs/preview.png)

## 使用

1. 从 [Release 页面](https://github.com/nekomini88/komari-theme-farmer/releases) 下载 `komari-theme-Komari-Farmer-v-*.zip`（或仓库内 `release/` 下的 `komari-theme-Komari-Farmer-v*.zip`）
2. 登录 Komari Monitor 后，点击 `设置` → `主题管理`
3. `上传主题` 选择 zip 文件
4. 刷新页面，在主题设置中选择 `Komari-Farmer`

## 素材与视觉规范

- **像素素材**：AI 生成的像素风 PNG 图片素材位于 `public/images/`（构建后输出到 `dist/images/`，含 banner / logo / 背景贴图等）
- **像素字体**：`@fontsource/press-start-2p`（标题像素字）+ `@fontsource/vt323`（正文）
- **生态 / 天气精灵**：`src/assets/pixel-sprites/*.png`（22 张 32×32 逻辑像素；蝴蝶 / 花 / 叶各有**四季变体**，按当前季节自动切换）
- **界面图标**：`src/assets/pixel-icons/*.png`（44 张 16×16 逻辑像素）。渲染走 `src/components/PixelIcon.vue`：优先用像素图，找不到时自动回落到 Iconify 矢量图标
- **像素素材规格**：1px 深棕描边（`#3e2723`）+ 受限调色板（精灵 ≤14 色 / 图标 ≤10 色）+ 硬边无抗锯齿；导出为 4× 最近邻放大（精灵 128×128、图标 64×64），页面以 `image-rendering: pixelated` 显示
- **素材产线**（可复现）：AI 生图 → 抠白底（含**补洞**，避免白云/白兔被整块抠掉）→ 降采样到逻辑像素 → 调色板量化 → 程序化补 1px 深棕描边 → 最近邻放大。脚本与提示词见仓库外归档说明（`tools/art` 思路同源）
- **视觉规范**：`references/farmer-visual-style.md` 定义设计令牌（色板 / 圆角 / 像素字体 / 背景契约），通过 `data-theme="farmer"` 激活
- **测试**：`tests/` 含 Vitest 单元测试（`bun run test`）

## 环境要求

- Node.js: `^20.19.0` 或 `>=22.12.0`
- Bun: `>=1.2.0`

## 开发

```bash
bun install
bun run dev
```

## 构建

```bash
bun run build
```

`build` = 类型检查 + vite 构建 + 自动打包主题 zip（`scripts/package-theme.ts`）。产物：

- `dist/` — 构建后的静态站点
- `release/komari-theme-Komari-Farmer-v<version>-<hash>.zip` — 可直接上传到 Komari 的主题包

单独打包 zip（不重新构建）：

```bash
bun run package
```

## 发布

```bash
bun run publish    # 同步提升 package.json 与 komari-theme.json 版本号并 git add
```

推送后 GitHub Actions（`release-on-version-bump.yml`）自动构建 `komari-theme-Komari-Farmer-v*.zip` 并创建 GitHub Release。

## 目录结构

```
komari-theme-farmer/
├── src/                    # 主题源码（Vue 组件 / 样式 / pixel-sprites / pixel-icons）
├── public/images/          # AI 像素 PNG 素材（banner / logo / 背景）
├── scripts/
│   ├── package-theme.ts    # 打包主题 zip
│   └── publish.ts          # 版本号提升
├── references/             # farmer-visual-style.md 视觉规范
├── release/                # 打包产物（zip，gitignored 视情况）
├── komari-theme.json       # 主题清单
├── spec.yaml / tests/      # 规范与测试
└── package.json
```

## 技术栈

| 类别     | 技术                             |
| -------- | -------------------------------- |
| 框架     | Vue 3                            |
| 构建工具 | Vite 7                           |
| UI 组件  | reka-ui（shadcn-vue 风格组件）   |
| 样式方案 | Tailwind CSS v4 + tw-animate-css |
| 状态管理 | Pinia 3                          |
| 路由     | Vue Router 5                     |
| 提示系统 | vue-sonner（Toaster）            |
| 图标     | 像素 PNG 优先 + @iconify/vue 兜底 |
| 图表     | vue-echarts                      |
| 3D 地球  | cobe                             |
| 像素字体 | Press Start 2P / VT323           |

## License

[MIT](./LICENSE)
