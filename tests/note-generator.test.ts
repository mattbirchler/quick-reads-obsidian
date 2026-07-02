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
