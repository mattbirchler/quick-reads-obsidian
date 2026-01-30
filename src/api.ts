import { requestUrl, RequestUrlResponse } from "obsidian";
import { ApiHighlight } from "./types";

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
		const response: RequestUrlResponse = await requestUrl({
			url: `${API_BASE_URL}/highlights`,
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

		return response.json as ApiHighlight[];
	}
}
