import { requestUrl, RequestUrlResponse } from "obsidian";
import { ApiHighlight, PaginatedHighlightsResponse } from "./types";

const API_BASE_URL = "https://quickreads.app/api";

export class QuickReadsApi {
	private apiKey: string;

	constructor(apiKey: string) {
		this.apiKey = apiKey;
	}

	setApiKey(apiKey: string) {
		this.apiKey = apiKey;
	}

	async fetchAllHighlights(): Promise<ApiHighlight[]> {
		const allHighlights: ApiHighlight[] = [];
		let offset = 0;
		const limit = 200;

		while (true) {
			const response: RequestUrlResponse = await requestUrl({
				url: `${API_BASE_URL}/highlights?limit=${limit}&offset=${offset}`,
				method: "GET",
				headers: {
					Authorization: `Bearer ${this.apiKey}`,
					"Content-Type": "application/json",
				},
			});

			if (response.status !== 200) {
				throw new Error(
					`API request failed with status ${response.status}: ${response.text}`
				);
			}

			const data = response.json as PaginatedHighlightsResponse;
			allHighlights.push(...data.highlights);

			if (allHighlights.length >= data.total) break;
			offset += limit;
		}

		return allHighlights;
	}
}
