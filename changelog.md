# Changelog

## 2026-07-20 14:50 - Move API key to Obsidian secret storage

- Removed `apiKey` from `QuickReadsSettings` (`src/types.ts`); added `API_KEY_SECRET_ID` constant. The key no longer lives in `data.json`.
- `src/main.ts`: added `getApiKey()` / `setApiKey()` which read/write through `app.secretStorage` (Obsidian 1.11.4+ `SecretStorage` API). Added `migrateApiKeyToSecretStorage()`, run once on load, which moves any legacy plaintext key out of `data.json` into secret storage and deletes the old field.
- `src/api.ts`: added `QuickReadsApi.hasApiKey()` so callers can check key presence without touching settings.
- `src/sync.ts`: `sync()` now checks `api.hasApiKey()` instead of `settings.apiKey`.
- `src/settings.ts`: API key field now uses Obsidian's `SecretComponent` (masked input backed by secret storage) instead of a plain `TextComponent` bound to settings.
- Bumped `minAppVersion` to `1.11.4` (manifest.json, versions.json) since `SecretStorage` requires it; bumped plugin version to `1.1.0`.
- Updated `README.md` requirements and behavior details to reflect the new storage model and minimum Obsidian version.
- Verified: `npm run build` succeeds, `npm test` passes (12/12). Pre-existing `tsc --noEmit` errors (tslib/HistoryHandler/ReadableStream typing issues from the `obsidian`/`@types/node` packages) confirmed present before this change too, unrelated.
