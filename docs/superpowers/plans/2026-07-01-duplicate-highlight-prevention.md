# Duplicate Highlight Prevention Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Guarantee the same exact highlight text is never displayed twice in a note, plus a one-time cleanup command for existing duplicates.

**Architecture:** Pure dedupe functions live in `src/note-generator.ts` (no Obsidian imports, so they're unit-testable with vitest). `src/sync.ts` calls them before writing notes and gains a cleanup method that walks the highlights folder. `src/api.ts` dedupes fetched highlights by id. `src/main.ts` registers the cleanup command.

**Tech Stack:** TypeScript 4.7, esbuild bundle, Obsidian plugin API, vitest (new dev dependency) for unit tests.

## Global Constraints

- Duplicate comparison is exact text after `.trim()` — no fuzzy or case-insensitive matching (spec §1).
- Cleanup only removes blockquote blocks; all other note content untouched (spec §3).
- Files are rewritten only if content changed (spec §3).
- Filtered-out duplicate highlights are still marked synced in `syncedHighlightIds` (spec §1).
- Match existing code style: tabs, double quotes, existing naming.

---

### Task 1: Test setup + prevention functions (`extractHighlightTexts`, `filterDuplicateHighlights`)

**Files:**
- Modify: `package.json` (add vitest, `test` script)
- Create: `tests/note-generator.test.ts`
- Modify: `src/note-generator.ts`

**Interfaces:**
- Produces: `extractHighlightTexts(content: string): Set<string>`, `filterDuplicateHighlights(existingContent: string, highlights: ApiHighlight[]): ApiHighlight[]` — used by Task 3.

- [ ] **Step 1: Install vitest and add test script**

```bash
npm install --save-dev vitest
```

In `package.json` scripts add: `"test": "vitest run"`.

- [ ] **Step 2: Write the failing tests**

Create `tests/note-generator.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
	extractHighlightTexts,
	filterDuplicateHighlights,
} from "../src/note-generator";
import { ApiHighlight } from "../src/types";

function makeHighlight(id: string, text: string): ApiHighlight {
	return {
		id,
		articleId: "a1",
		articleTitle: "Title",
		siteName: "Site",
		author: "Author",
		text,
		createdAt: "2026-01-01T00:00:00Z",
	};
}

describe("extractHighlightTexts", () => {
	it("extracts blockquote texts from note content", () => {
		const content = `---
title: Test
---
## Highlights

> First highlight

> Second highlight
`;
		const texts = extractHighlightTexts(content);
		expect(texts.has("First highlight")).toBe(true);
		expect(texts.has("Second highlight")).toBe(true);
		expect(texts.size).toBe(2);
	});

	it("ignores non-blockquote lines", () => {
		const texts = extractHighlightTexts("Some prose\n\n> Quoted\n\nMore prose");
		expect(texts.size).toBe(1);
		expect(texts.has("Quoted")).toBe(true);
	});

	it("handles bare > lines and empty content", () => {
		expect(extractHighlightTexts("").size).toBe(0);
		expect(extractHighlightTexts(">\n> ").size).toBe(0);
	});
});

describe("filterDuplicateHighlights", () => {
	it("drops highlights whose text already exists in the note", () => {
		const existing = "> Already here\n";
		const result = filterDuplicateHighlights(existing, [
			makeHighlight("1", "Already here"),
			makeHighlight("2", "Brand new"),
		]);
		expect(result.map((h) => h.id)).toEqual(["2"]);
	});

	it("drops duplicates within the incoming batch", () => {
		const result = filterDuplicateHighlights("", [
			makeHighlight("1", "Same text"),
			makeHighlight("2", "Same text"),
			makeHighlight("3", "Different"),
		]);
		expect(result.map((h) => h.id)).toEqual(["1", "3"]);
	});

	it("treats whitespace-only differences as duplicates", () => {
		const result = filterDuplicateHighlights("> Trimmed text\n", [
			makeHighlight("1", "  Trimmed text  "),
		]);
		expect(result).toEqual([]);
	});

	it("does NOT dedupe near-miss texts", () => {
		const result = filterDuplicateHighlights("> The cat sat\n", [
			makeHighlight("1", "The cat sat."),
			makeHighlight("2", "the cat sat"),
		]);
		expect(result.length).toBe(2);
	});
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run`
Expected: FAIL — `extractHighlightTexts` / `filterDuplicateHighlights` are not exported.

- [ ] **Step 4: Implement the functions**

Append to `src/note-generator.ts`:

```ts
export function extractHighlightTexts(content: string): Set<string> {
	const texts = new Set<string>();
	for (const line of content.split("\n")) {
		if (line.startsWith(">")) {
			const text = line.replace(/^>\s?/, "").trim();
			if (text) {
				texts.add(text);
			}
		}
	}
	return texts;
}

export function filterDuplicateHighlights(
	existingContent: string,
	highlights: ApiHighlight[]
): ApiHighlight[] {
	const seen = extractHighlightTexts(existingContent);
	const result: ApiHighlight[] = [];
	for (const highlight of highlights) {
		const text = highlight.text.trim();
		if (!text || seen.has(text)) {
			continue;
		}
		seen.add(text);
		result.push(highlight);
	}
	return result;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run`
Expected: PASS (all tests).

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json tests/note-generator.test.ts src/note-generator.ts
git commit -m "Add duplicate-highlight filtering with vitest tests"
```

---

### Task 2: Cleanup transform (`removeDuplicateHighlightBlocks`)

**Files:**
- Modify: `src/note-generator.ts`
- Modify: `tests/note-generator.test.ts`

**Interfaces:**
- Produces: `removeDuplicateHighlightBlocks(content: string): { content: string; removed: number }` — used by Task 3's cleanup method.

- [ ] **Step 1: Write the failing tests**

Append to `tests/note-generator.test.ts` (import `removeDuplicateHighlightBlocks` from `../src/note-generator`):

```ts
describe("removeDuplicateHighlightBlocks", () => {
	it("removes later duplicate blockquotes, keeps the first", () => {
		const content = `## Highlights

> Alpha

> Beta

> Alpha
`;
		const result = removeDuplicateHighlightBlocks(content);
		expect(result.removed).toBe(1);
		expect(result.content).toBe(`## Highlights

> Alpha

> Beta
`);
	});

	it("is a no-op when there are no duplicates", () => {
		const content = "## Highlights\n\n> Alpha\n\n> Beta\n";
		const result = removeDuplicateHighlightBlocks(content);
		expect(result.removed).toBe(0);
		expect(result.content).toBe(content);
	});

	it("preserves non-blockquote content around removed duplicates", () => {
		const content = `---
title: Test
---
## Highlights

> Alpha

My own note in between.

> Alpha
`;
		const result = removeDuplicateHighlightBlocks(content);
		expect(result.removed).toBe(1);
		expect(result.content).toContain("My own note in between.");
		expect(result.content.match(/> Alpha/g)?.length).toBe(1);
	});

	it("compares multi-line blockquote blocks as a whole", () => {
		const content = "> Line one\n> Line two\n\n> Line one\n";
		const result = removeDuplicateHighlightBlocks(content);
		expect(result.removed).toBe(0);
	});

	it("removes whitespace-variant duplicates", () => {
		const content = "> Alpha\n\n>  Alpha \n";
		const result = removeDuplicateHighlightBlocks(content);
		expect(result.removed).toBe(1);
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run`
Expected: FAIL — `removeDuplicateHighlightBlocks` not exported.

- [ ] **Step 3: Implement**

Append to `src/note-generator.ts`:

```ts
export function removeDuplicateHighlightBlocks(content: string): {
	content: string;
	removed: number;
} {
	const lines = content.split("\n");
	const seen = new Set<string>();
	const out: string[] = [];
	let removed = 0;
	let i = 0;

	while (i < lines.length) {
		if (!lines[i].startsWith(">")) {
			out.push(lines[i]);
			i++;
			continue;
		}

		const start = i;
		while (i < lines.length && lines[i].startsWith(">")) {
			i++;
		}
		const block = lines.slice(start, i);
		const text = block
			.map((line) => line.replace(/^>\s?/, ""))
			.join("\n")
			.trim();

		if (text && seen.has(text)) {
			removed++;
			// Drop the blank line that separated this block from prior content
			if (out.length > 0 && out[out.length - 1].trim() === "") {
				out.pop();
			}
		} else {
			if (text) {
				seen.add(text);
			}
			out.push(...block);
		}
	}

	return { content: out.join("\n"), removed };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run`
Expected: PASS (all tests).

- [ ] **Step 5: Commit**

```bash
git add tests/note-generator.test.ts src/note-generator.ts
git commit -m "Add removeDuplicateHighlightBlocks cleanup transform"
```

---

### Task 3: Wire prevention + hardening into sync, dedupe API fetch

**Files:**
- Modify: `src/api.ts` (`fetchAllHighlights`)
- Modify: `src/sync.ts` (`sync`, `processArticle`, new `removeDuplicatesFromNotes`)

**Interfaces:**
- Consumes: `filterDuplicateHighlights`, `removeDuplicateHighlightBlocks` from Task 1/2.
- Produces: `SyncService.removeDuplicatesFromNotes(): Promise<{ notesChanged: number; duplicatesRemoved: number }>` — used by Task 4's command.

- [ ] **Step 1: Dedupe API results by id**

In `src/api.ts`, change the end of `fetchAllHighlights` from `return allHighlights;` to:

```ts
		// Offset pagination can return the same record on two pages if data
		// changes mid-fetch; keep the first occurrence of each id.
		const seenIds = new Set<string>();
		return allHighlights.filter((h) => {
			if (seenIds.has(h.id)) return false;
			seenIds.add(h.id);
			return true;
		});
```

- [ ] **Step 2: Filter duplicates in `processArticle`**

In `src/sync.ts`, add imports `filterDuplicateHighlights` (from `./note-generator`) and rewrite `processArticle`:

```ts
	private async processArticle(articleGroup: ArticleGroup): Promise<void> {
		const filename = generateFilename(articleGroup);
		const filePath = `${this.settings.highlightsFolder}/${filename}.md`;

		const existingFile = this.app.vault.getAbstractFileByPath(filePath);

		if (existingFile instanceof TFile) {
			// Append to existing note, skipping highlights already present
			const existingContent = await this.app.vault.read(existingFile);
			const newHighlights = filterDuplicateHighlights(
				existingContent,
				articleGroup.highlights
			);
			if (newHighlights.length > 0) {
				const updatedContent = appendHighlightsToNote(
					existingContent,
					newHighlights
				);
				await this.app.vault.modify(existingFile, updatedContent);
			}
		} else {
			// Create new note, deduping within the batch
			const dedupedGroup = {
				...articleGroup,
				highlights: filterDuplicateHighlights("", articleGroup.highlights),
			};
			const content = generateNoteContent(dedupedGroup, this.settings);
			await this.app.vault.create(filePath, content);
		}
	}
```

- [ ] **Step 3: Persist synced ids after each article**

In `sync()`, inside the `for (const articleGroup of articleMap.values())` loop, after the `for (const h of articleGroup.highlights)` push loop and `syncedCount` update, add:

```ts
					await this.savePluginData();
```

(The final `await this.savePluginData();` after the loop stays — it persists `lastSyncTime`.)

- [ ] **Step 4: Add `removeDuplicatesFromNotes`**

Add import `removeDuplicateHighlightBlocks` from `./note-generator`, and this method to `SyncService`:

```ts
	async removeDuplicatesFromNotes(): Promise<{
		notesChanged: number;
		duplicatesRemoved: number;
	}> {
		const folder = this.app.vault.getAbstractFileByPath(
			this.settings.highlightsFolder
		);
		if (!(folder instanceof TFolder)) {
			new Notice(
				`Highlights folder "${this.settings.highlightsFolder}" not found`
			);
			return { notesChanged: 0, duplicatesRemoved: 0 };
		}

		let notesChanged = 0;
		let duplicatesRemoved = 0;

		for (const child of folder.children) {
			if (!(child instanceof TFile) || child.extension !== "md") {
				continue;
			}
			const content = await this.app.vault.read(child);
			const result = removeDuplicateHighlightBlocks(content);
			if (result.removed > 0 && result.content !== content) {
				await this.app.vault.modify(child, result.content);
				notesChanged++;
				duplicatesRemoved += result.removed;
			}
		}

		return { notesChanged, duplicatesRemoved };
	}
```

- [ ] **Step 5: Verify build and tests**

Run: `npx vitest run && npm run build`
Expected: tests PASS, build completes without TypeScript errors.

- [ ] **Step 6: Commit**

```bash
git add src/api.ts src/sync.ts
git commit -m "Prevent duplicate highlights on sync; harden id tracking"
```

---

### Task 4: Cleanup command in main.ts

**Files:**
- Modify: `src/main.ts`

**Interfaces:**
- Consumes: `SyncService.removeDuplicatesFromNotes()` from Task 3.

- [ ] **Step 1: Register the command**

In `src/main.ts`, add `Notice` to the obsidian import (`import { Notice, Plugin } from "obsidian";`), then after the existing `sync-highlights` `addCommand` block add:

```ts
		this.addCommand({
			id: "remove-duplicate-highlights",
			name: "Remove duplicate highlights from synced notes",
			callback: () => {
				void this.removeDuplicateHighlights();
			},
		});
```

And add this method after `syncHighlights()`:

```ts
	async removeDuplicateHighlights() {
		if (!this.syncService) {
			return;
		}
		const result = await this.syncService.removeDuplicatesFromNotes();
		if (result.duplicatesRemoved > 0) {
			new Notice(
				`Removed ${result.duplicatesRemoved} duplicate highlight${
					result.duplicatesRemoved === 1 ? "" : "s"
				} across ${result.notesChanged} note${
					result.notesChanged === 1 ? "" : "s"
				}`
			);
		} else {
			new Notice("No duplicate highlights found");
		}
	}
```

- [ ] **Step 2: Verify build and tests**

Run: `npx vitest run && npm run build`
Expected: tests PASS, build completes; `main.js` regenerated.

- [ ] **Step 3: Commit**

```bash
git add src/main.ts main.js
git commit -m "Add command to remove duplicate highlights from synced notes"
```

(Only include `main.js` in the commit if the repo tracks it — it does; keep it in sync with src.)
