import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";

interface ExaResult {
  title: string;
  url: string;
  publishedDate?: string;
  author?: string;
  text: string;
  highlight?: string;
}

interface ExaSearchResponse {
  results: ExaResult[];
  autopromptString?: string;
}

const EXA_API_URL = "https://api.exa.ai/search";
const EXA_CONTENT_URL = "https://api.exa.ai/contents";

async function searchExa(
  query: string,
  apiKey: string,
  numResults: number = 5,
  useAutoprompt: boolean = true
): Promise<ExaSearchResponse> {
  const response = await fetch(EXA_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      query,
      numResults,
      useAutoprompt,
      type: "neural", // Better for natural language queries
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Exa API error: ${response.status} - ${error}`);
  }

  return response.json();
}

async function getExaContents(
  urls: string[],
  apiKey: string,
  text: boolean = true,
  highlights: boolean = true
): Promise<ExaResult[]> {
  const response = await fetch(EXA_CONTENT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      urls,
      text: text ? { maxCharacters: 5000 } : undefined,
      highlights: highlights ? { numSentences: 2, highlightsPerUrl: 2 } : undefined,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Exa API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.results || [];
}

export default function exaSearchExtension(pi: ExtensionAPI) {
  // Get API key from environment
  const apiKey = process.env.EXA_API_KEY;

  // Register web_search tool using Exa
  pi.registerTool({
    name: "web_search",
    label: "Web Search",
    description: "Search the web using Exa AI search engine. Returns high-quality results with snippets. Requires EXA_API_KEY environment variable.",
    parameters: Type.Object({
      query: Type.String({ description: "Search query" }),
      numResults: Type.Optional(
        Type.Number({ 
          description: "Number of results (default: 5, max: 10)", 
          default: 5 
        })
      ),
      fetchContents: Type.Optional(
        Type.Boolean({
          description: "Fetch full text content of top results (default: false)",
          default: false,
        })
      ),
    }),
    async execute(_toolCallId, params, _signal, onUpdate) {
      if (!apiKey) {
        return {
          content: [{ 
            type: "text", 
            text: "⚠️ EXA_API_KEY not set. Get a free API key at https://exa.ai and set it with:\nexport EXA_API_KEY=your_key" 
          }],
          details: { error: "Missing API key" },
          isError: true,
        };
      }

      onUpdate?.({
        content: [{ type: "text", text: `Searching Exa for: "${params.query}"...` }],
      });

      const numResults = Math.min(params.numResults || 5, 10);
      const searchResults = await searchExa(params.query, apiKey, numResults, true);

      if (!searchResults.results || searchResults.results.length === 0) {
        return {
          content: [{ type: "text", text: "No results found." }],
          details: { query: params.query, resultsCount: 0 },
        };
      }

      // Optionally fetch full contents
      let contents: ExaResult[] = [];
      if (params.fetchContents && searchResults.results.length > 0) {
        onUpdate?.({
          content: [{ type: "text", text: "Fetching content from top results..." }],
        });
        
        const topUrls = searchResults.results.slice(0, 3).map(r => r.url);
        contents = await getExaContents(topUrls, apiKey);
      }

      // Format results
      let output = `🔍 Exa Search Results for "${params.query}"\n`;
      if (searchResults.autopromptString) {
        output += `📎 Optimized query: "${searchResults.autopromptString}"\n`;
      }
      output += `\n`;

      searchResults.results.forEach((result, i) => {
        output += `${i + 1}. **${result.title || "Untitled"}**\n`;
        output += `   🌐 ${result.url}\n`;
        if (result.publishedDate) {
          output += `   📅 ${result.publishedDate}\n`;
        }
        if (result.author) {
          output += `   ✍️ ${result.author}\n`;
        }
        
        // Use highlight if available, otherwise snippet
        const snippet = result.highlight || result.text?.slice(0, 200) || "";
        if (snippet) {
          output += `   📝 ${snippet.replace(/\n/g, " ")}\n`;
        }

        // Add full content if fetched
        const fullContent = contents.find(c => c.url === result.url);
        if (fullContent?.text) {
          output += `   📄 ${fullContent.text.slice(0, 300).replace(/\n/g, " ")}...\n`;
        }

        output += "\n";
      });

      return {
        content: [{ type: "text", text: output }],
        details: { 
          query: params.query,
          optimizedQuery: searchResults.autopromptString,
          resultsCount: searchResults.results.length,
          results: searchResults.results.map(r => ({
            title: r.title,
            url: r.url,
            publishedDate: r.publishedDate,
            author: r.author,
          })),
        },
      };
    },
  });

  // Register web_get_contents tool for fetching specific URLs
  pi.registerTool({
    name: "web_get_contents",
    label: "Web Get Contents",
    description: "Fetch full text content from specific URLs using Exa. Requires EXA_API_KEY environment variable.",
    parameters: Type.Object({
      urls: Type.Array(Type.String({ description: "URLs to fetch" }), {
        description: "List of URLs to fetch content from",
      }),
      maxCharacters: Type.Optional(
        Type.Number({
          description: "Maximum characters per URL (default: 5000)",
          default: 5000,
        })
      ),
    }),
    async execute(_toolCallId, params, _signal, onUpdate) {
      if (!apiKey) {
        return {
          content: [{ 
            type: "text", 
            text: "⚠️ EXA_API_KEY not set. Get a free API key at https://exa.ai and set it with:\nexport EXA_API_KEY=your_key" 
          }],
          details: { error: "Missing API key" },
          isError: true,
        };
      }

      onUpdate?.({
        content: [{ type: "text", text: `Fetching content from ${params.urls.length} URL(s)...` }],
      });

      const contents = await getExaContents(
        params.urls, 
        apiKey, 
        true, 
        false
      );

      let output = "📄 Web Content\n\n";
      
      contents.forEach((result, i) => {
        output += `**${i + 1}. ${result.title || "Untitled"}**\n`;
        output += `URL: ${result.url}\n\n`;
        
        if (result.text) {
          const text = result.text.slice(0, params.maxCharacters || 5000);
          output += text;
          if (result.text.length > (params.maxCharacters || 5000)) {
            output += "\n\n...[truncated]";
          }
        } else {
          output += "(No text content available)";
        }
        
        output += "\n\n---\n\n";
      });

      return {
        content: [{ type: "text", text: output }],
        details: {
          urls: params.urls,
          fetchedCount: contents.length,
        },
      };
    },
  });

  // Register /exa command for info
  pi.registerCommand("exa", {
    description: "Show Exa API status",
    handler: async (_args, ctx) => {
      if (apiKey) {
        ctx.ui.notify("✅ Exa API key is configured", "success");
      } else {
        ctx.ui.notify("⚠️ EXA_API_KEY not set. Get one at https://exa.ai", "warning");
      }
    },
  });

  // Notify on startup
  pi.on("session_start", async (_event, ctx) => {
    if (!apiKey) {
      ctx.ui.notify("Exa: Set EXA_API_KEY for web search", "warning");
    }
  });
}
