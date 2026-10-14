# AGENTS.md

Repo guide for `Komari-Farmer`（夏夜祭典/农场风格 Komari 监控主题）.

## Snapshot

- Generated: Wed May 27 2026, Asia/Shanghai
- Branch: `master`
- App: Vue 3 + Vite + reka-ui + Tailwind CSS v4 theme for Komari Monitor
- Package manager: `bun` (>= 1.2)
- Theme manifest: `komari-theme.json`

## What this repo is

- Builds a Komari theme, not a generic web app
- Release artifact is a zip package Komari can import
- Runtime app code lives under `src/`
- Runtime static assets include `public/images/`
- Release preview image is `docs/preview.png`

## Root structure

- `src/` app source（2026-10 重构后：utils/ 按职责分子目录，地区数据表在 `src/data/regionMap.ts`）
- `public/images/` runtime image contract, especially flags and logos
- `.github/` CI workflow and issue templates
- `docs/preview.png` release preview image
- `komari-theme.json` theme manifest consumed by the zip build
- `vite.config.ts` build, chunking, zip packaging
- `package.json` root commands and pinned dependency versions
- `bun.lock` resolved lockfile (managed by bun)

## Root commands

Run from repo root only.

```bash
bun run dev
bun run build
bun run preview
bun run lint
```

Notes:

- `bun run build` runs type check plus production build
- `bun run lint` runs eslint with `--fix --cache`
- 本仓库**有**测试套件：vitest，`bun run test`（当前 422 条用例，改动必须保持全绿）
- 类型检查用 `bunx vue-tsc --noEmit`；测试与类型检查是重构时的两条生命线，不要跳过

## Build and release contract

`bun run build` must preserve the Komari packaging flow defined in `vite.config.ts`.

Expected output:

- `dist/`
- `komari-theme-Komari-Farmer-v<version>-<sha>.zip`

Zip contents:

- `dist/`
- `komari-theme.json`
- `preview.png`

Current source of packaged preview:

- `docs/preview.png` on disk
- renamed to `preview.png` inside the zip

Do not change zip naming, manifest filename, or preview filename without updating the real build contract.

## CI facts

Source of truth: `.github/workflows/build-ci.yml`

CI does only:

1. `bun install --frozen-lockfile`
2. `bun run build`

CI runs install + build. 测试需本地执行 `bun run test`（CI 目前不跑，所以别指望它替你发现回归）。

## Where to look

- Start at `package.json` for root commands
- Check `vite.config.ts` for build behavior, global constants, and zip packaging
- Check `komari-theme.json` for theme metadata and managed configuration schema
- Check `src/` for app behavior
- Check `public/images/` when code references image filenames directly
- Check `.github/workflows/build-ci.yml` for CI expectations
- Check `.github/ISSUE_TEMPLATE/` for issue intake shape

Contributor density, useful for triage:

- `src/components/` is a dense UI change area
- `src/utils/` 已按职责分层（api/ region/ media/ format/ …）；纯数据表在 `src/data/`
- `src/stores/` is central state, usually affected by cross-cutting changes

## Conventions seen in this repo

- Use `bun`, not pnpm/npm/yarn
- Dependency versions are declared directly in `package.json`; add new ones with `bun add` / `bun add -d`
- Keep root guidance focused on build, packaging, manifest, and repo structure
- Preserve the `@` alias to `src` defined in `vite.config.ts`
- Treat `komari-theme.json` as release input, not optional metadata
- Treat `docs/preview.png` as release input, not just documentation art
- Respect existing generated outputs and naming patterns, especially `komari-theme-Komari-Farmer-v<version>-<sha>.zip`
- Root verification is: `bun run test` + `bunx vue-tsc --noEmit` + `bun run build`（三者都要过）
- UI is built on `reka-ui` + Tailwind CSS v4 (shadcn-vue style under `src/components/ui/`). Do **not** reintroduce Naive UI, UnoCSS, or SCSS — they have been removed.

## Repo grounded anti-patterns

- Do not rename `komari-theme.json`
- Do not move or rename `docs/preview.png` casually
- Do not rename files under `public/images/flags/` or `public/images/logo/` without checking code references in `src`
- Do not change asset path conventions like `/images/flags/<code>.svg` or `/images/logo/...` blindly
- Do not add generic framework advice here that belongs in `src/AGENTS.md`
- Do not duplicate workflow specifics from `.github/AGENTS.md` or asset naming specifics from `public/images/AGENTS.md`

## Child guides

For local rules, defer to the nearest child guide:

- `src/AGENTS.md` for app code, component, store, router, and utility changes
- `.github/AGENTS.md` for workflow and issue template changes
- `public/images/AGENTS.md` for runtime image asset naming and compatibility rules

If a child guide exists, it overrides this root file for its subtree.
