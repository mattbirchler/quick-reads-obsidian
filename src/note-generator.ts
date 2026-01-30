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
	const siteName = articleGroup.siteName;

	let filename: string;
	if (siteName) {
		filename = `${siteName} - ${title}`;
	} else {
		filename = title;
	}

	const sanitized = sanitizeFilename(filename);

	// Fallback to article ID if sanitized name is empty
	if (!sanitized || sanitized === "-") {
		return `article-${articleGroup.articleId}`;
	}

	return sanitized;
}

export function formatDate(isoString: string): string {
	const date = new Date(isoString);
	return date.toLocaleDateString("en-US", {
		year: "numeric",
		month: "long",
		day: "numeric",
	});
}

export function generateFrontmatter(
	articleGroup: ArticleGroup,
	lastSynced: string
): string {
	const frontmatter: Record<string, string | null> = {
		quickReadsArticleId: articleGroup.articleId,
		title: articleGroup.articleTitle,
		siteName: articleGroup.siteName,
		lastSynced: lastSynced,
	};

	const lines = ["---"];
	for (const [key, value] of Object.entries(frontmatter)) {
		if (value === null || value === undefined) {
			lines.push(`${key}: null`);
		} else {
			// Escape quotes in strings
			const escaped = value.replace(/"/g, '\\"');
			lines.push(`${key}: "${escaped}"`);
		}
	}
	lines.push("---");

	return lines.join("\n");
}

export function generateHighlightBlock(highlight: ApiHighlight): string {
	const date = formatDate(highlight.createdAt);
	return `> ${highlight.text}\n>\n> — *Highlighted on ${date}*`;
}

export function generateNoteContent(articleGroup: ArticleGroup): string {
	const { articleTitle, siteName, highlights } = articleGroup;
	const now = new Date().toISOString();

	const parts: string[] = [];

	// Frontmatter
	parts.push(generateFrontmatter(articleGroup, now));
	parts.push("");

	// Title
	parts.push(`# ${articleTitle || "Untitled"}`);
	parts.push("");

	// Metadata section
	if (siteName) {
		parts.push(`**Source**: ${siteName}`);
	}

	parts.push("");
	parts.push("---");
	parts.push("");

	// Highlights section
	parts.push("## Highlights");
	parts.push("");

	for (const highlight of highlights) {
		parts.push(generateHighlightBlock(highlight));
		parts.push("");
	}

	return parts.join("\n");
}

export function appendHighlightsToNote(
	existingContent: string,
	newHighlights: ApiHighlight[],
	lastSynced: string
): string {
	// Update lastSynced in frontmatter
	let content = existingContent.replace(
		/lastSynced: "[^"]*"/,
		`lastSynced: "${lastSynced}"`
	);

	// Append new highlights at the end
	const highlightBlocks = newHighlights
		.map((h) => generateHighlightBlock(h))
		.join("\n\n");

	// Ensure there's a newline before appending
	if (!content.endsWith("\n")) {
		content += "\n";
	}

	content += "\n" + highlightBlocks + "\n";

	return content;
}
