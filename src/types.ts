export interface QuickReadsSettings {
	highlightsFolder: string;
	syncOnStartup: boolean;
	autoSyncInterval: number; // minutes, 0 = disabled
	noteTemplate: string;
}

// Secret storage ID for the API key. Must be lowercase alphanumeric with
// optional dashes, per Obsidian's SecretStorage API.
export const API_KEY_SECRET_ID = "quick-reads-api-key";

export const DEFAULT_NOTE_TEMPLATE = `---
quickReadsArticleId: {{articleId}}
title: {{articleTitle}}
author: {{author}}
site: {{siteName}}
url: {{url}}
---
## Highlights

{{highlights}}`;

export const DEFAULT_SETTINGS: QuickReadsSettings = {
	highlightsFolder: "quick reads",
	syncOnStartup: false,
	autoSyncInterval: 0,
	noteTemplate: DEFAULT_NOTE_TEMPLATE,
};

export interface PluginData {
	settings: QuickReadsSettings;
	syncedHighlightIds: string[];
	lastSyncTime: string | null;
}

export const DEFAULT_PLUGIN_DATA: PluginData = {
	settings: DEFAULT_SETTINGS,
	syncedHighlightIds: [],
	lastSyncTime: null,
};

export interface PaginatedHighlightsResponse {
	highlights: ApiHighlight[];
	total: number;
}

export interface ApiHighlight {
	id: string;
	articleId: string;
	articleTitle: string;
	siteName: string;
	author: string;
	url?: string;
	text: string;
	createdAt: string;
}

export interface ArticleGroup {
	articleId: string;
	articleTitle: string;
	siteName: string;
	author: string;
	url?: string;
	highlights: ApiHighlight[];
}
