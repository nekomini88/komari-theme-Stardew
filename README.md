<h3 align="center"> Komari Stardew-2 </h3>
<p align="center">
星露谷物语主题 2 代 · 基于 <a href="https://github.com/nekomini88/komari-theme-Neko">komari-theme-Neko</a> UI 定制
</p>

![preview](/docs/preview.png)

## 项目

基于 Vue 3 + Vite + reka-ui + Tailwind CSS v4 构建，参考 [LuminaPlus](https://github.com/shanyang242/Komari-Theme-LuminaPlus) 的增强思路，专用于 Komari Monitor。

内置主题：`emerald` / `sunrise` / `green-mountain` / `blue-water` / `night` / `material-indigo` / `material-pink` / `material-teal` / `stardew`

## 验收标准 DoD

- [ ] `spec validate` 通过
- [ ] `bun run build` 产出 `komari-theme-stardew-build-*.zip`
- [ ] zip 内包含 `komari-theme.json`、`preview.png`、`dist/`
- [ ] `bun run test` 输出 `12 passed`
- [ ] Header 主题选择可见 "星露" 选项
- [ ] CSS 存在 `data-theme="stardew"` 变量
- [ ] 预览图存在 `docs/preview.png`

## 使用

1. 从 [Release 页面](https://github.com/nekomini88/komari-theme-Stardew/releases) 下载 `komari-theme-stardew-build-*.zip`
2. 登录 Komari Monitor 后，点击 `设置` → `主题管理`
3. `上传主题` 选择 zip 文件
4. 刷新页面，在 Header 主题选择中切换 `星露`

## 环境要求

- Node.js: `^20.19.0` 或 `>=22.12.0`
- Bun: `>=1.2.0`

## 开发

```bash
bun install
bun run dev -- --host 0.0.0.0
```

Mock 数据：
- `http://localhost:5173/?mock=1` 启用本地模拟

## 构建

```bash
bun run build
```

产物：
- `dist/`
- `komari-theme-stardew-build-<sha>.zip`

## 测试

```bash
bun run test
```

覆盖：
- `verify_spec`：`spec.yaml` 结构校验
- `verify_build`：zip / manifest / preview 文件校验
- `verify_dev`：stardew 主题源码入口校验

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
| 图标     | @iconify/vue                     |
| 图表     | vue-echarts                      |
| 3D 地球  | cobe                             |

## License

[MIT](./LICENSE)
