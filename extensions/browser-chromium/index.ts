import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import puppeteer, { Browser, Page } from "puppeteer-core";
import { existsSync, constants } from "node:fs";
import { accessSync } from "node:fs";

let browser: Browser | null = null;
let page: Page | null = null;

// Find Chromium executable on Fedora
function findChrome(): string {
  const paths = [
    "/usr/bin/chromium-browser",
    "/usr/bin/chromium",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chrome",
  ];

  for (const p of paths) {
    try {
      accessSync(p, constants.X_OK);
      return p;
    } catch {}
  }
  throw new Error(
    "Chrome/Chromium not found. Install with: sudo dnf install chromium"
  );
}

export default function browserChromium(pi: ExtensionAPI) {
  async function getPage(): Promise<Page> {
    if (!browser) {
      const chromePath = findChrome();

      browser = await puppeteer.launch({
        headless: true,
        executablePath: chromePath,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-gpu",
          "--disable-web-security",
          "--disable-features=IsolateOrigins,site-per-process",
        ],
      });

      page = await browser.newPage();
      await page.setViewport({ width: 1920, height: 1080 });

      // Set a realistic user agent
      await page.setUserAgent(
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      );
    }
    return page!;
  }

  // Navigate to URL
  pi.registerTool({
    name: "browser_navigate",
    label: "Navigate",
    description: "Navigate browser to a URL",
    parameters: Type.Object({
      url: Type.String({ description: "URL to navigate to" }),
      waitForLoad: Type.Optional(
        Type.Boolean({
          description: "Wait for full page load including network idle",
          default: true,
        })
      ),
    }),
    async execute(_id, params, _signal, onUpdate) {
      const p = await getPage();
      onUpdate?.({
        content: [{ type: "text", text: `Navigating to ${params.url}...` }],
      });

      await p.goto(params.url, {
        waitUntil: params.waitForLoad ? "networkidle0" : "domcontentloaded",
      });

      const title = await p.title();
      const url = p.url();

      return {
        content: [
          { type: "text", text: `✓ Loaded: ${title}` },
          { type: "text", text: `URL: ${url}` },
        ],
        details: { title, url },
      };
    },
  });

  // Take screenshot
  pi.registerTool({
    name: "browser_screenshot",
    label: "Screenshot",
    description: "Take a screenshot of the current page",
    parameters: Type.Object({
      fullPage: Type.Optional(
        Type.Boolean({
          description: "Capture the full scrollable page",
          default: false,
        })
      ),
      selector: Type.Optional(
        Type.String({
          description: "CSS selector to screenshot specific element only",
        })
      ),
    }),
    async execute(_id, params, _signal, onUpdate) {
      const p = await getPage();
      onUpdate?.({
        content: [{ type: "text", text: "Taking screenshot..." }],
      });

      let screenshot: string;

      if (params.selector) {
        const element = await p.$(params.selector);
        if (!element) {
          throw new Error(`Element not found: ${params.selector}`);
        }
        screenshot = await element.screenshot({
          encoding: "base64",
          type: "png",
        });
      } else {
        screenshot = await p.screenshot({
          fullPage: params.fullPage,
          encoding: "base64",
          type: "png",
        });
      }

      const caption = params.selector
        ? `Screenshot of element: ${params.selector}`
        : params.fullPage
        ? "Full page screenshot"
        : "Viewport screenshot";

      return {
        content: [
          { type: "text", text: `✓ ${caption}` },
          { type: "image", data: screenshot, mimeType: "image/png" },
        ],
        details: { fullPage: params.fullPage, selector: params.selector },
      };
    },
  });

  // Click element
  pi.registerTool({
    name: "browser_click",
    label: "Click",
    description: "Click an element by CSS selector",
    parameters: Type.Object({
      selector: Type.String({
        description: "CSS selector of element to click",
      }),
      waitForNavigation: Type.Optional(
        Type.Boolean({
          description: "Wait for page navigation after click",
          default: false,
        })
      ),
    }),
    async execute(_id, params, _signal, onUpdate) {
      const p = await getPage();
      onUpdate?.({
        content: [{ type: "text", text: `Clicking: ${params.selector}...` }],
      });

      // Check element exists first
      const element = await p.$(params.selector);
      if (!element) {
        throw new Error(`Element not found: ${params.selector}`);
      }

      if (params.waitForNavigation) {
        await Promise.all([
          p.waitForNavigation({ waitUntil: "networkidle0" }),
          p.click(params.selector),
        ]);
      } else {
        await p.click(params.selector);
      }

      return {
        content: [
          { type: "text", text: `✓ Clicked: ${params.selector}` },
          { type: "text", text: `Current URL: ${p.url()}` },
        ],
        details: { selector: params.selector, url: p.url() },
      };
    },
  });

  // Type text
  pi.registerTool({
    name: "browser_type",
    label: "Type",
    description: "Type text into an input field",
    parameters: Type.Object({
      selector: Type.String({
        description: "CSS selector for input field",
      }),
      text: Type.String({ description: "Text to type" }),
      clearFirst: Type.Optional(
        Type.Boolean({
          description: "Clear the field before typing",
          default: true,
        })
      ),
      pressEnter: Type.Optional(
        Type.Boolean({
          description: "Press Enter after typing",
          default: false,
        })
      ),
    }),
    async execute(_id, params, _signal, onUpdate) {
      const p = await getPage();
      onUpdate?.({
        content: [
          { type: "text", text: `Typing into: ${params.selector}...` },
        ],
      });

      const element = await p.$(params.selector);
      if (!element) {
        throw new Error(`Element not found: ${params.selector}`);
      }

      if (params.clearFirst) {
        await element.click({ clickCount: 3 });
        await element.press("Backspace");
      }

      await element.type(params.text);

      if (params.pressEnter) {
        await element.press("Enter");
      }

      return {
        content: [
          { type: "text", text: `✓ Typed into: ${params.selector}` },
          {
            type: "text",
            text: `Text: ${params.text.slice(0, 50)}${
              params.text.length > 50 ? "..." : ""
            }`,
          },
        ],
        details: { selector: params.selector, textLength: params.text.length },
      };
    },
  });

  // Get page text
  pi.registerTool({
    name: "browser_get_text",
    label: "Get Page Text",
    description: "Extract text content from the page",
    parameters: Type.Object({
      selector: Type.Optional(
        Type.String({
          description: "Get text from specific element only",
        })
      ),
      maxLength: Type.Optional(
        Type.Number({
          description: "Maximum characters to return (default: 10000)",
          default: 10000,
        })
      ),
    }),
    async execute(_id, params) {
      const p = await getPage();
      let text: string;

      if (params.selector) {
        const element = await p.$(params.selector);
        if (!element) {
          throw new Error(`Element not found: ${params.selector}`);
        }
        text = await element.evaluate((el) => el.textContent || "");
      } else {
        text = await p.evaluate(() => document.body.innerText);
      }

      const maxLen = params.maxLength || 10000;
      const truncated =
        text.length > maxLen ? text.slice(0, maxLen) + "\n...[truncated]" : text;

      return {
        content: [{ type: "text", text: truncated }],
        details: {
          length: text.length,
          truncated: text.length > maxLen,
          url: p.url(),
        },
      };
    },
  });

  // Scroll page
  pi.registerTool({
    name: "browser_scroll",
    label: "Scroll",
    description: "Scroll the page",
    parameters: Type.Object({
      direction: Type.String({
        enum: ["down", "up", "bottom", "top"],
        default: "down",
        description: "Direction to scroll",
      }),
      amount: Type.Optional(
        Type.Number({
          description: "Pixels to scroll (default: 800)",
          default: 800,
        })
      ),
    }),
    async execute(_id, params) {
      const p = await getPage();
      const amount = params.amount || 800;

      switch (params.direction) {
        case "down":
          await p.evaluate((y) => window.scrollBy(0, y), amount);
          break;
        case "up":
          await p.evaluate((y) => window.scrollBy(0, -y), amount);
          break;
        case "bottom":
          await p.evaluate(() =>
            window.scrollTo(0, document.body.scrollHeight)
          );
          break;
        case "top":
          await p.evaluate(() => window.scrollTo(0, 0));
          break;
      }

      const scrollPos = await p.evaluate(() => window.scrollY);

      return {
        content: [
          {
            type: "text",
            text: `✓ Scrolled ${params.direction} (position: ${scrollPos}px)`,
          },
        ],
        details: { direction: params.direction, scrollPosition: scrollPos },
      };
    },
  });

  // Wait for element
  pi.registerTool({
    name: "browser_wait_for",
    label: "Wait For Element",
    description: "Wait for an element to appear on the page",
    parameters: Type.Object({
      selector: Type.String({
        description: "CSS selector to wait for",
      }),
      timeout: Type.Optional(
        Type.Number({
          description: "Timeout in milliseconds (default: 5000)",
          default: 5000,
        })
      ),
    }),
    async execute(_id, params, _signal, onUpdate) {
      const p = await getPage();
      onUpdate?.({
        content: [
          { type: "text", text: `Waiting for: ${params.selector}...` },
        ],
      });

      await p.waitForSelector(params.selector, {
        timeout: params.timeout,
      });

      return {
        content: [
          { type: "text", text: `✓ Element appeared: ${params.selector}` },
        ],
        details: { selector: params.selector },
      };
    },
  });

  // Debug tool - screenshot + HTML
  pi.registerTool({
    name: "browser_debug",
    label: "Debug",
    description: "Take screenshot and get page info for debugging",
    parameters: Type.Object({
      includeHtml: Type.Optional(
        Type.Boolean({
          description: "Include HTML snippet in output",
          default: true,
        })
      ),
    }),
    async execute(_id, params, _signal, onUpdate) {
      const p = await getPage();
      onUpdate?.({
        content: [{ type: "text", text: "Capturing debug info..." }],
      });

      const screenshot = await p.screenshot({
        fullPage: true,
        encoding: "base64",
        type: "png",
      });

      const title = await p.title();
      const url = p.url();

      let content: Array<{ type: "text"; text: string } | { type: "image"; data: string; mimeType: string }> = [
        { type: "text", text: `Debug Info:` },
        { type: "text", text: `Title: ${title}` },
        { type: "text", text: `URL: ${url}` },
        { type: "image", data: screenshot, mimeType: "image/png" },
      ];

      if (params.includeHtml) {
        const html = await p.content();
        content.push({
          type: "text",
          text: `HTML preview:\n${html.slice(0, 3000)}${
            html.length > 3000 ? "\n...[truncated]" : ""
          }`,
        });
      }

      return {
        content,
        details: { title, url },
      };
    },
  });

  // Close browser
  pi.registerTool({
    name: "browser_close",
    label: "Close Browser",
    description: "Close the browser and cleanup",
    parameters: Type.Object({}),
    async execute(_id, _params) {
      if (browser) {
        await browser.close();
        browser = null;
        page = null;
      }
      return {
        content: [{ type: "text", text: "✓ Browser closed" }],
        details: {},
      };
    },
  });

  // Cleanup on shutdown
  pi.on("session_shutdown", async () => {
    if (browser) {
      await browser.close().catch(() => {});
      browser = null;
      page = null;
    }
  });
}
