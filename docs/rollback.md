# Rollback 回滚策略

适用于 komari-theme-Stardew 发布版本。

## 代码回滚（MUST）

1. 识别异常版本 Tag `vX.Y.Z`
2. 创建 Hotfix 分支：
   ```bash
   git checkout -b hotfix/rollback-vX.Y.Z main
   ```
3. 回滚上一个版本：
   ```bash
   git revert HEAD..vX.Y.Z
   ```
4. 测试：
   ```bash
   bun run test
   bun run build
   ```
5. 合并并推送：
   ```bash
   git checkout main
   git merge --no-ff hotfix/rollback-vX.Y.Z -m "rollback to vX.Y.Z-1"
   git push origin main
   ```
6. 打 Tag：
   ```bash
   git tag -a vX.Y.Z-1 -m "Hotfix vX.Y.Z-1: rollback vX.Y.Z"
   git push origin vX.Y.Z-1
   ```

## GitHub Release 回滚

GitHub Release 通过 CI 自动创建；回滚时需手动删除错误 Release 并发布新 Release。

## 数据库回滚

本项目为纯前端主题，无数据库变更，无需数据库回滚。

## 配置回滚

若主题 `komari-theme.json` 配置变更需要回滚：
1. 从 Git History 恢复前版本 `git show vX.Y.Z~1:komari-theme.json > komari-theme.json`
2. bump patch 版本号
3. 重建 zip
4. 触发 CI

## 时间要求

MUST 在 5 分钟内完成代码回滚。
