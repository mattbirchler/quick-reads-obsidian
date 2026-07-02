# Duplicate Highlight Prevention — Design

**Date:** 2026-07-01
**Status:** Approved

## Problem

The plugin sometimes displays the same highlight text twice in a note. Root causes identified in the current code:

1. **Same text, different id** — the API can return a new id for the same passage (re-highlighted or edited), and the id-based `syncedHighlightIds` filter cannot catch it.
2. **Lost/reset tracking data** — if `data.json` is reset (reinstall, sync conflict between devices), every highlight re-appends to existing notes.
3. **Interrupted sync** — `syncedHighlightIds` is only persisted at the end of a full sync (`sync.ts`); if Obsidian closes mid-sync after some notes were written, the next sync appends them again.
4. **Pagination overlap** — `fetchAllHighlights` uses offset pagination; a highlight created mid-fetch can shift results so the same record appears on two pages and is written twice in one sync.

## Goal

The same exact highlight text is never displayed twice within a single note. Additionally, provide a one-time cleanup for duplicates that already exist.

## Design

### 1. Prevention on sync (core fix)

New pure functions in `src/note-generator.ts`:

- `extractHighlightTexts(content: string): Set<string>` — scans a note's markdown and returns the set of existing blockquote texts: lines starting with `> `, prefix stripped, trimmed.
- `filterDuplicateHighlights(existingContent: string, highlights: ApiHighlight[]): ApiHighlight[]` — returns only highlights whose trimmed text is (a) not already present in the note content and (b) not already earlier in the incoming batch.

`SyncService.processArticle`:

- **Existing note:** run incoming highlights through `filterDuplicateHighlights` against the note's current content before appending. If nothing survives, do not modify the note.
- **New note:** run the batch through the same filter with empty existing content (catches in-batch duplicates).
- In both cases, all highlight ids in the group are still marked as synced — filtered-out duplicates must not be re-checked forever.

Matching is exact text comparison after `.trim()`. No fuzzy or case-insensitive matching.

### 2. Tracking hardening

- Dedupe `fetchAllHighlights` results by highlight `id` before returning (guards against pagination overlap).
- Persist plugin data (`savePluginData`) after each article inside the sync loop, not only at the end (guards against interrupted syncs).

### 3. One-time cleanup command

New command: **"Remove duplicate highlights from synced notes."**

- Iterates markdown files in `settings.highlightsFolder`.
- Within each note, finds blockquote blocks (consecutive lines starting with `>`) whose exact trimmed text repeats; keeps the first occurrence and removes subsequent duplicates along with their separating blank lines.
- Only blockquote blocks are candidates for removal; all other note content is untouched.
- Rewrites a file only if its content changed.
- Finishes with a notice, e.g. "Removed 12 duplicate highlights across 5 notes." (or "No duplicates found.").

### 4. Testing

- Add `vitest` as a dev dependency with an `npm test` script.
- Tests for the pure functions covering: duplicate within a batch; duplicate versus existing note content; whitespace-only differences treated as duplicates; near-miss texts that must NOT be deduped; cleanup transform (removes later duplicates, preserves non-blockquote content, no-op when clean).
- `npm run build` must pass.

## Accepted trade-off

If the user intentionally highlights the identical sentence twice in the same article, only one copy is displayed. This is the requested behavior.
