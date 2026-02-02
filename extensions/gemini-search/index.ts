import { Type } from "@sinclair/typebox";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Text } from "@mariozechner/pi-tui";

export default function (pi: ExtensionAPI) {
  pi.registerTool({
    name: "gemini_search",
    label: "Gemini Search",
    description: "Search the web or ask questions using the Gemini CLI. Use this for real-time information, current events, or complex queries that require external search.",
    parameters: Type.Object({
      query: Type.String({ description: "The search query or question to ask Gemini" }),
    }),

    async execute(toolCallId, params, signal, onUpdate, ctx) {
      onUpdate?.({
        content: [{ type: "text", text: `Searching Gemini for: ${params.query}...` }],
      });

      try {
        const result = await pi.exec("gemini", [params.query, "-y"], { signal });
        
        if (result.code !== 0) {
          return {
            content: [{ type: "text", text: `Error running Gemini CLI: ${result.stderr}` }],
            isError: true,
            details: { error: result.stderr, code: result.code }
          };
        }

        return {
          content: [{ type: "text", text: result.stdout }],
          details: { output: result.stdout },
        };
      } catch (error: any) {
        return {
          content: [{ type: "text", text: `Failed to execute Gemini CLI: ${error.message}` }],
          isError: true,
          details: { error: error.message }
        };
      }
    },

    renderCall(args, theme) {
      return new Text(
        theme.fg("toolTitle", "gemini_search ") + theme.fg("dim", `"${args.query}"`),
        0, 0
      );
    },

    renderResult(result, { expanded }, theme) {
      if (result.isError) {
        return new Text(theme.fg("error", `✖ Error: ${result.details?.error || "Unknown error"}`), 0, 0);
      }

      let text = theme.fg("success", "✓ Search complete");
      if (expanded && result.details?.output) {
        text += "\n" + theme.fg("dim", result.details.output);
      }
      return new Text(text, 0, 0);
    }
  });

  pi.registerCommand("gemini", {
    description: "Run a query through the Gemini CLI search",
    handler: async (args, ctx) => {
      if (!args) {
        ctx.ui.notify("Please provide a query", "warning");
        return;
      }
      ctx.ui.setStatus("gemini-search", `Gemini is thinking: ${args}...`);
      const result = await pi.exec("gemini", [args, "-y"]);
      ctx.ui.setStatus("gemini-search", undefined);
      
      if (result.code === 0) {
        ctx.ui.notify("Gemini search finished", "success");
        // We can't easily display large output in notify, 
        // but we can print it if we were in a different context.
        // For now, let's just use a dialog to show result.
        await ctx.ui.editor("Gemini Result", result.stdout);
      } else {
        ctx.ui.notify(`Gemini search failed: ${result.stderr}`, "error");
      }
    }
  });
}
