/**
 * Exa MCP Extension for pi
 * 
 * Provides web search, code search, and company research using Exa's hosted MCP server.
 * No API key required - uses Exa's free hosted MCP endpoint.
 * 
 * Tools:
 * - `exa_search` - Web search
 * - `exa_find_code` - Code and programming search  
 * - `exa_company` - Company research
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";

const EXA_MCP_URL = "https://mcp.exa.ai/mcp";

// MCP JSON-RPC 2.0 types
interface MCPRequest {
  jsonrpc: "2.0";
  id: number;
  method: string;
  params?: Record<string, unknown>;
}

interface MCPResponse {
  jsonrpc: "2.0";
  id: number;
  result?: unknown;
  error?: { code: number; message: string };
}

async function mcpCall(method: string, params?: Record<string, unknown>): Promise<unknown> {
  const id = Math.floor(Math.random() * 1000000) + 1;
  
  const request: MCPRequest = {
    jsonrpc: "2.0",
    id,
    method,
    params: params as MCPRequest["params"],
  };

  try {
    const response = await fetch(EXA_MCP_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json, text/event-stream",
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const text = await response.text();
    
    // Parse SSE format: "data: {json}\n\n"
    const match = text.match(/data:\s*(\{[^}]+\})/);
    if (match) {
      const data = JSON.parse(match[1]) as MCPResponse;
      if (data.error) {
        throw new Error(`MCP Error ${data.error.code}: ${data.error.message}`);
      }
      return data.result;
    }
    
    // Try parsing as regular JSON
    try {
      const data = JSON.parse(text) as MCPResponse;
      if (data.error) {
        throw new Error(`MCP Error ${data.error.code}: ${data.error.message}`);
      }
      return data.result;
    } catch {
      // Not JSON, return raw text
    }
    
    return text;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Exa MCP: ${error.message}`);
    }
    throw new Error("Exa MCP: Unknown error");
  }
}

export default function (pi: ExtensionAPI) {
  // Initialize MCP connection on session start
  pi.on("session_start", async (_event, ctx) => {
    if (!ctx.hasUI) return;
    
    try {
      await mcpCall("initialize", {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: {
          name: "pi-coding-agent",
          version: "1.0.0",
        },
      });
      ctx.ui.notify("Exa MCP connected! (no API key needed)", "info");
    } catch (error) {
      ctx.ui.notify(`Exa MCP: ${error instanceof Error ? error.message : "Connection failed"}`, "error");
    }
  });

  // Register Exa Web Search tool
  pi.registerTool({
    name: "exa_search",
    label: "Exa Web Search",
    description: "Search the web using Exa's AI-powered search engine. Best for finding current information, news, and facts. Returns clean, LLM-ready content.",
    parameters: Type.Object({
      query: Type.String({ description: "Search query" }),
      numResults: Type.Optional(Type.Number({ description: "Number of results (default: 8)" })),
      type: Type.Optional(Type.String({ description: "Search type: 'auto' (balanced) or 'fast'" })),
      livecrawl: Type.Optional(Type.String({ description: "Live crawl: 'fallback' or 'preferred'" })),
      contextMaxCharacters: Type.Optional(Type.Number({ description: "Max characters (default: 10000)" })),
    }),

    async execute(toolCallId, params, _signal, _onUpdate, _ctx) {
      try {
        const result = await mcpCall("tools/call", {
          name: "web_search_exa",
          arguments: {
            query: params.query,
            numResults: params.numResults ?? 8,
            type: params.type ?? "auto",
            livecrawl: params.livecrawl ?? "fallback",
            contextMaxCharacters: params.contextMaxCharacters ?? 10000,
          },
        });

        return {
          content: [{ type: "text", text: `Exa Web Search: "${params.query}"\n\n${JSON.stringify(result, null, 2)}` }],
          details: { result },
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : "Unknown error"}` }],
          details: { error: true },
          isError: true,
        };
      }
    },
  });

  // Register Exa Code Search tool
  pi.registerTool({
    name: "exa_find_code",
    label: "Exa Code Search",
    description: "Search for code examples, documentation, and programming solutions. Searches GitHub, Stack Overflow, and official docs.",
    parameters: Type.Object({
      query: Type.String({ description: "Code search query (e.g., 'React useState hook examples')" }),
      tokensNum: Type.Optional(Type.Number({ description: "Tokens to return (1000-50000, default: 5000)" })),
    }),

    async execute(toolCallId, params, _signal, _onUpdate, _ctx) {
      try {
        const result = await mcpCall("tools/call", {
          name: "get_code_context_exa",
          arguments: {
            query: params.query,
            tokensNum: params.tokensNum ?? 5000,
          },
        });

        return {
          content: [{ type: "text", text: `Exa Code Search: "${params.query}"\n\n${JSON.stringify(result, null, 2)}` }],
          details: { result },
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : "Unknown error"}` }],
          details: { error: true },
          isError: true,
        };
      }
    },
  });

  // Register Exa Company Research tool
  pi.registerTool({
    name: "exa_company",
    label: "Exa Company Research",
    description: "Research companies to get business information, news, and insights from trusted business sources.",
    parameters: Type.Object({
      companyName: Type.String({ description: "Company name to research" }),
      numResults: Type.Optional(Type.Number({ description: "Number of results (default: 5)" })),
    }),

    async execute(toolCallId, params, _signal, _onUpdate, _ctx) {
      try {
        const result = await mcpCall("tools/call", {
          name: "company_research_exa",
          arguments: {
            companyName: params.companyName,
            numResults: params.numResults ?? 5,
          },
        });

        return {
          content: [{ type: "text", text: `Company Research: ${params.companyName}\n\n${JSON.stringify(result, null, 2)}` }],
          details: { result },
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : "Unknown error"}` }],
          details: { error: true },
          isError: true,
        };
      }
    },
  });

  pi.registerCommand("exa-help", {
    description: "Show Exa MCP tools",
    handler: async (_args, ctx) => {
      ctx.ui.notify("Exa MCP loaded!", "info");
      ctx.ui.notify("Tools: exa_search, exa_find_code, exa_company", "info");
    },
  });
}
