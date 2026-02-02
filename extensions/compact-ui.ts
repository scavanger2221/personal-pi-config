/**
 * Compact UI - Zsh-like editor with bottom border
 * 
 * Features:
 * - Clean zsh-like prompt (❯)
 * - Single line input
 * - Bottom border only
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { CustomEditor } from "@mariozechner/pi-coding-agent";
import { truncateToWidth, visibleWidth, CURSOR_MARKER } from "@mariozechner/pi-tui";

// Nerd font icons
const ICONS = {
  prompt: "❯"
};

// Compact Editor Component - Zsh-like single line with bottom border
class CompactEditor extends CustomEditor {
  render(width: number): string[] {
    const text = this.getText();
    const cursor = this.getCursor();
    // @ts-ignore - focused is protected
    const focused: boolean = this.focused ?? true;

    const prompt = `${ICONS.prompt} `;
    const promptWidth = visibleWidth(prompt);
    const maxTextWidth = width - promptWidth - 1;

    // For single line, combine all lines and use column as cursor position
    const fullText = text.replace(/\n/g, ' ');
    const cursorPos = cursor.line === 0 ? cursor.col : fullText.length;

    // Truncate if text is too long
    let displayText = fullText;
    if (visibleWidth(fullText) > maxTextWidth) {
      displayText = truncateToWidth(fullText, maxTextWidth, "…", false);
    }

    // Build the line with cursor marker for IME support
    let line: string;
    if (focused && cursorPos <= displayText.length) {
      const before = displayText.slice(0, cursorPos);
      const at = displayText[cursorPos] || " ";
      const after = displayText.slice(cursorPos + 1);
      // CURSOR_MARKER tells the TUI where to position the hardware cursor
      line = prompt + before + CURSOR_MARKER + "\x1b[7m" + at + "\x1b[27m" + after;
    } else {
      line = prompt + displayText;
    }

    // Bottom border line
    const bottomBorder = "─".repeat(width);

    const result = [line, bottomBorder];

    // Add autocomplete list if active
    // @ts-ignore - accessing private property autocompleteList
    if (this.isShowingAutocomplete() && this.autocompleteList) {
      // @ts-ignore
      const autocompleteResult = this.autocompleteList.render(maxTextWidth);
      // Pad autocomplete lines to full width
      const padding = " ".repeat(promptWidth);
      for (const autoLine of autocompleteResult) {
        const lineWidth = visibleWidth(autoLine);
        const linePadding = " ".repeat(Math.max(0, maxTextWidth - lineWidth));
        result.push(padding + autoLine + linePadding);
      }
    }

    return result;
  }
}

export default function (pi: ExtensionAPI) {
  // Set up compact editor
  pi.on("session_start", async (_event, ctx) => {
    if (!ctx.hasUI) return;

    // Set compact editor
    ctx.ui.setEditorComponent((tui, theme, kb) => 
      new CompactEditor(tui, theme, kb)
    );
  });
}
