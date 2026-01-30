import { ApiHighlight, ArticleGroup } from "./types";

export function sanitizeFilename(name: string): string {
	// Remove or replace characters that are invalid in filenames
	return name
		.replace(/[\\/:*?"<>|]/g, "-")
		.replace(/\s+/g, " ")
		.trim()
		.slice(0, 200); // Limit length
}

export function generateFilename(articleGroup: ArticleGroup): string {
	const title = articleGroup.articleTitle || "Untitled";

	// Use the earliest highlight's date
	const earliestDate = articleGroup.highlights
		.map((h) => new Date(h.createdAt))
		.sort((a, b) => a.getTime() - b.getTime())[0];

	const dateStr = earliestDate
		? earliestDate.toISOString().split("T")[0]
		: new Date().toISOString().split("T")[0];

	const sanitizedTitle = sanitizeFilename(title);

	if (!sanitizedTitle || sanitizedTitle === "-") {
		return `${dateStr} article-${articleGroup.articleId}`;
	}

	return `${dateStr} ${sanitizedTitle}`;
}

function escapeYamlString(value: string): string {
	const escaped = value.replace(/"/g, '\\"');
	return `"${escaped}"`;
}

export function generateFrontmatter(articleGroup: ArticleGroup): string {
	const lines = [
		"---",
		`quickReadsArticleId: ${escapeYamlString(articleGroup.articleId)}`,
		`title: ${escapeYamlString(articleGroup.articleTitle)}`,
		`author: ${escapeYamlString(articleGroup.author)}`,
		`site: ${escapeYamlString(articleGroup.siteName)}`,
		"---",
	];
	return lines.join("\n");
}

export function generateHighlightBlock(highlight: ApiHighlight): string {
	return `> ${highlight.text}`;
}

export function generateNoteContent(articleGroup: ArticleGroup): string {
	const parts: string[] = [];

	parts.push(generateFrontmatter(articleGroup));
	parts.push("## Highlights");
	parts.push("");

	for (const highlight of articleGroup.highlights) {
		parts.push(generateHighlightBlock(highlight));
		parts.push("");
	}

	return parts.join("\n");
}

export function appendHighlightsToNote(
	existingContent: string,
	newHighlights: ApiHighlight[]
): string {
	const highlightBlocks = newHighlights
		.map((h) => generateHighlightBlock(h))
		.join("\n\n");

	let content = existingContent;
	if (!content.endsWith("\n")) {
		content += "\n";
	}

	content += "\n" + highlightBlocks + "\n";

	return content;
}
