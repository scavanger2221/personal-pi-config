/**
 * Web Fetch Extension for pi
 * 
 * Fetches readable content from URLs. No API key required.
 */

import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import {
	truncateHead,
	DEFAULT_MAX_BYTES,
	DEFAULT_MAX_LINES,
	formatSize,
} from "@mariozechner/pi-coding-agent";

export default function webFetchExtension(pi: ExtensionAPI) {
	pi.registerTool({
		name: "web_fetch",
		label: "Web Fetch",
		description: "Fetch and extract readable text content from a URL. Great for reading documentation, articles, and web pages.",
		parameters: Type.Object({
			url: Type.String({ description: "URL to fetch (including https://)" }),
			max_length: Type.Optional(Type.Number({ default: 8000, description: "Max characters" })),
		}),

		async execute(_toolCallId, params, signal, onUpdate, _ctx) {
			const maxLen = params.max_length || 8000;

			try {
				onUpdate?.({ content: [{ type: "text", text: `Fetching ${params.url}...` }] });

				// Fetch with timeout
				const controller = new AbortController();
				const timeout = setTimeout(() => controller.abort(), 15000);
				
				const response = await fetch(params.url, {
					signal: signal || controller.signal,
					headers: {
						"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36",
						"Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
						"Accept-Language": "en-US,en;q=0.9",
					},
				});
				
				clearTimeout(timeout);

				if (!response.ok) {
					throw new Error(`HTTP ${response.status}`);
				}

				const contentType = response.headers.get("content-type") || "";

				// Handle JSON
				if (contentType.includes("application/json")) {
					const json = await response.json();
					const text = JSON.stringify(json, null, 2);
					return {
						content: [{ type: "text", text: text.slice(0, maxLen) }],
						details: { url: params.url, type: "json" },
					};
				}

				// Handle plain text
				if (contentType.includes("text/plain")) {
					const text = await response.text();
					return {
						content: [{ type: "text", text: text.slice(0, maxLen) }],
						details: { url: params.url, type: "text" },
					};
				}

				// Parse HTML
				const html = await response.text();
				const result = extractFromHtml(html, params.url, maxLen);

				// Format output
				let output = `${result.title}\n${"=".repeat(Math.min(result.title.length, 50))}\n${result.url}\n\n${result.content}`;

				// Truncate if needed
				const trunc = truncateHead(output, { maxLines: DEFAULT_MAX_LINES, maxBytes: DEFAULT_MAX_BYTES });
				let final = trunc.content;
				if (trunc.truncated) {
					final += `\n\n[Truncated: ${trunc.outputLines}/${trunc.totalLines} lines]`;
				}

				return {
					content: [{ type: "text", text: final }],
					details: { url: params.url, title: result.title },
				};

			} catch (error) {
				const msg = error instanceof Error ? error.message : String(error);
				return {
					content: [{ type: "text", text: `❌ Failed to fetch: ${msg}` }],
					details: { error: msg, url: params.url },
					isError: true,
				};
			}
		},
	});

	// Helper: extract readable content from HTML
	function extractFromHtml(html: string, url: string, maxLen: number) {
		// Get title
		const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
		let title = titleMatch ? decodeHtml(titleMatch[1].trim()) : "Untitled";
		title = title.replace(/\s*[\|\-–—]\s*.*$/, "").trim() || "Untitled";

		// Remove scripts, styles, etc
		let cleaned = html
			.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
			.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
			.replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, "")
			.replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, "")
			.replace(/<header[^>]*>[\s\S]*?<\/header>/gi, "")
			.replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, "")
			.replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, "");

		// Find main content
		let content = "";
		const selectors = [
			/<article[^>]*>([\s\S]*?)<\/article>/i,
			/<main[^>]*>([\s\S]*?)<\/main>/i,
			/<div[^>]*class=["'][^"']*(?:article-content|post-content|entry-content|content-body|main-content)[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
			/<div[^>]*id=["'](?:content|main|article)["'][^>]*>([\s\S]*?)<\/div>/i,
		];

		for (const sel of selectors) {
			const m = cleaned.match(sel);
			if (m && m[1].length > 200) {
				content = m[1];
				break;
			}
		}

		if (!content) {
			const body = cleaned.match(/<body[^>]*>([\s\S]*)<\/body>/i);
			content = body ? body[1] : cleaned;
		}

		// Convert to text
		content = htmlToText(content);
		
		if (content.length > maxLen) {
			content = content.slice(0, maxLen) + "\n\n[Content truncated...]";
		}

		return { title, content, url };
	}

	// Helper: HTML to text
	function htmlToText(html: string) {
		return html
			.replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, (_, c) => `\n\`\`\`\n${c.replace(/<[^>]+>/g, "")}\n\`\`\`\n`)
			.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, (_, c) => `\`${c.replace(/<[^>]+>/g, "")}\``)
			.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, "\n\n$1\n===\n")
			.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, "\n\n$1\n---\n")
			.replace(/<h[3-6][^>]*>([\s\S]*?)<\/h[3-6]>/gi, "\n\n### $1\n")
			.replace(/<\/(?:p|div|section|article)>/gi, "\n")
			.replace(/<br\s*\/?>/gi, "\n")
			.replace(/<li[^>]*>/gi, "• ")
			.replace(/<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, "$2 ($1)")
			.replace(/<[^>]+>/g, "")
			.replace(/&nbsp;/g, " ")
			.replace(/&quot;/g, '"')
			.replace(/&amp;/g, "&")
			.replace(/&lt;/g, "<")
			.replace(/&gt;/g, ">")
			.replace(/&#39;/g, "'")
			.replace(/&\w+;/g, " ")
			.replace(/[ \t]+/g, " ")
			.replace(/\n[ \t]+/g, "\n")
			.replace(/[ \t]+\n/g, "\n")
			.replace(/\n{4,}/g, "\n\n\n")
			.trim();
	}

	// Helper: decode HTML entities
	function decodeHtml(str: string) {
		return str
			.replace(/&quot;/g, '"')
			.replace(/&amp;/g, "&")
			.replace(/&lt;/g, "<")
			.replace(/&gt;/g, ">")
			.replace(/&#39;/g, "'")
			.replace(/&nbsp;/g, " ");
	}
}
