# Development Notes (Riddle Fork)

## Release Workflow

Every change must follow these steps in order:

1. Bump `version` in `komari-theme.json` (semver, match release tag)
2. **Clean old zips**: `rm -f komari-theme-emerald-build-*.zip`
3. `bun run build` — produces `komari-theme-emerald-build-<sha>.zip`
4. `git add -A && git commit && git push origin master`
5. `gh release create vX.Y.Z ./komari-theme-emerald-build-<sha>.zip --repo R1ddle1337/komari-theme-emerald --title "vX.Y.Z" --notes "..."`

All three version numbers must match: `komari-theme.json` version = git tag = release title.

### Pitfalls

- **Always clean old zips before build** — the `*.zip` glob will upload all zips if multiple exist, causing Komari to fail parsing the release.
- **Version bump must happen before `bun run build`** — the zip packages `komari-theme.json` at build time. If version is stale in the file, the zip will carry the wrong version and Komari won't detect the update.
- **After git revert operations, verify version** — reverts can silently reset the version field. Always `grep '"version"' komari-theme.json` before releasing.
- **Single zip per release** — Komari expects exactly one zip asset. Multiple assets = update detection failure.

## Versioning

- Upstream (Tokinx) uses `0.0.x`
- Our fork starts at `1.x.x`
- Patch: bug fix or trivial style tweak → `1.3.1`
- Minor: new feature or visual overhaul → `1.4.0`
- Major: breaking change or full redesign → `2.0.0`

## Syncing Upstream

```bash
git fetch upstream
git merge upstream/master --no-edit
# Resolve conflicts if any, then follow release workflow
```

Remote `upstream` = `https://github.com/Tokinx/komari-theme-emerald.git`

## Theme Metadata

File: `komari-theme.json`

- `author`: "Riddle & Tokinx"
- `version`: must be updated every release
- `url`: kept as upstream URL (original project link)

## Build

```bash
bun install
bun run build     # type-check + production build + zip
bun run lint      # eslint --fix --cache
bun run dev       # local dev server
```

## Style Conventions (Our Additions)

- iOS frosted glass: `backdrop-blur-xl backdrop-saturate-150 bg-background/40 ring-1 ring-foreground/[0.06] shadow-sm rounded-lg`
- Hover state: `hover:bg-background/60`
- Globe enhancements: inertia drag, smooth lerp (0.12), CSS drop-shadow glow

## Key Files Modified

- `src/components/NodeEarthGlobe.vue` — globe visual + inertia + glass badges
- `src/views/InstanceDetail.vue` — frosted glass on all detail cards
- `src/components/LoadChart.vue` — frosted glass on metric cards
- `src/components/PingChart.vue` — frosted glass on chart container
- `komari-theme.json` — author + version
