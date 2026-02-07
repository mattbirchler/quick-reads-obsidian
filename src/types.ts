export interface QuickReadsSettings {
	apiKey: string;
	highlightsFolder: string;
	syncOnStartup: boolean;
	autoSyncInterval: number; // minutes, 0 = disabled
}

export const DEFAULT_SETTINGS: QuickReadsSettings = {
	apiKey: "",
	highlightsFolder: "Quick Reads",
	syncOnStartup: false,
	autoSyncInterval: 0,
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
