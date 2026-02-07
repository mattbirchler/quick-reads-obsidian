import { ApiHighlight, ArticleGroup, QuickReadsSettings } from "./types";

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

export function renderTemplate(
	template: string,
	variables: Record<string, string>
): string {
	return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
		return key in variables ? variables[key] : match;
	});
}

function articleVariables(articleGroup: ArticleGroup): Record<string, string> {
	return {
		articleId: articleGroup.articleId,
		articleTitle: articleGroup.articleTitle,
		author: articleGroup.author,
		siteName: articleGroup.siteName,
		url: articleGroup.url || "",
	};
}

function highlightVariables(highlight: ApiHighlight): Record<string, string> {
	const date = new Date(highlight.createdAt);
	return {
		id: highlight.id,
		articleId: highlight.articleId,
		articleTitle: highlight.articleTitle,
		author: highlight.author,
		siteName: highlight.siteName,
		url: highlight.url || "",
		text: highlight.text,
		createdAt: highlight.createdAt,
		date: date.toISOString().split("T")[0],
	};
}

export function generateHighlightBlock(highlight: ApiHighlight): string {
	return `> ${highlight.text}`;
}

export function generateNoteContent(
	articleGroup: ArticleGroup,
	settings: QuickReadsSettings
): string {
	const renderedHighlights = articleGroup.highlights
		.map((h) => generateHighlightBlock(h))
		.join("\n\n");

	const vars = {
		...articleVariables(articleGroup),
		highlights: renderedHighlights,
	};

	return renderTemplate(settings.noteTemplate, vars) + "\n";
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
