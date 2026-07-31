# ADR-001: Stardew 主题选型与实现

日期：2026-07-31
状态：已采纳
决策者：nekomini

## 背景

komari-theme-Neko 提供翠绿/日出/沙漠等 8 套主题，无像素风/农场主题。用户社区中 Stardew Valley（星露谷物语）风格需求出现，需新增主题。

## 约束

- 项目已有主题切换逻辑，新主题必须对齐现有 `data-theme` 机制。
- 禁止修改默认 `emerald` 主题。
- 前端工程必须保持 Minimal Change，不引入后端依赖。

## 选项

1. 新建独立仓库，放弃 Neko 底座 ✗
2. Fork Neko 并机械复制后改色 ✗
3. 基于 Neko 仓库增加 `stardew` 主题入口，复用组件与构建流水线 ✓

## 选择

选择第 3 项。

## 决策

- 新主题命名为 `stardew`，接入 Header 主题选择菜单。
- 视觉参考 Stardew Valley：像素字体 Nunito + 像素风圆角 + 浅米色 matte cream + hard shadow。
- 不改动 `src/utils` 业务逻辑，只修改 `src/styles/main.css` 与 `src/components/Header.vue`。
- 构建产物 zip 命名对齐 `komari-theme-stardew-build-<commit>.zip`。

## 影响

- 主题数量从 8 个增至 9 个。
- CI Release workflow 分支保护自动触发。
- 无 breaking change。

## 风险

- `komari-theme.json` 若未同步版本，CI 会拒绝发布。 → 已通过测试止血。

## 何时审查

当 Stardew 风格需要添加像素字体或专属资产时触发下一轮 ADR。

---

## 已知偏离（以 v0.1.0 为界）

v0.1.0 之前的提交直接在 `main` 上，未经历 `feature/* → develop → main` 流程。  
这是已知偏离，不影响后续发布稳定性，但本 ADR 要求从 v0.1.0 开始严格按 Git Flow 执行。

## Git Flow 后处理

从 v0.1.0 起，新功能必须走：
```
feature/<id>-<slug> -> develop (PR) -> main (PR) -> v<tag>
```

未来若发现 feature 需返工，走 `git revert` + `patch release`，不得删除 tag。
