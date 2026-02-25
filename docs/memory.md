# Mossy AI Assistant – Working Notes

_Last updated: 2026-02-24_

## What we changed recently
- Removed unused duplicate component `components/TheWorkshop.tsx` and pruned unused types from `types.ts`.
- Added `build:electron` script and updated `electron:build`/`electron:pack` to set `ELECTRON=true` so packaged app uses relative base paths.
- Rebuilt tests and bundles: `npm test`, `npm run build`, `npm run electron:build` (installer output in `release/`).
- Added installer folder `Mossy AI Assistant/` to `.gitignore` to keep artifacts out of git.
- Fixed welcome screen clicks in `ApiKeySetup` by making the background grid non-interactive (`pointer-events-none`).

## Known warnings / follow-ups
- Vite chunk-size warnings (>500 kB) are informational only; consider manual chunking later.
- Electron-builder reports missing `description`/`author` in package.json and uses default icon if assets/icon.* not set.
- Untracked installer output folder `Mossy AI Assistant/` should stay uncommitted.

## How to rebuild quickly
- Dev: `npm install` (once), then `npm run dev` or `npm run electron:dev`.
- Web prod: `npm run build`.
- Electron installer: `npm run electron:build` (uses `build:electron` under the hood).
- Tests: `npm test` (coverage: `npm run test:coverage`).

## State of git
- Local main is ahead of origin by 1 commit (cleanup). Pending unstaged change: `package.json` (script update). Untracked: installer output folder.
 - After gitignore update, installer folder is ignored; stage/commit package.json + docs/gitignore when ready.

## Open questions
- Do we want to add description/author and custom icons to package.json build metadata?
- Should we address chunk-size warnings with code splitting?
- Confirm we keep only `components/Workshop.tsx` as the canonical workshop implementation.
