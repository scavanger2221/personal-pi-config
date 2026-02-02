---
description: Search the web using Exa AI search engine for high-quality results with optional content fetching.
---

# Web Search

## When to use

- User asks to "search", "look up", "find", "google", "what is", "who is", "latest news about"
- User mentions "web search", "internet search", "online search"
- User wants to "check online", "find information about"
- User asks current events, recent news, facts that might not be in training data
- User provides URLs and wants full content extracted
- User wants to "read this page", "summarize this article"

## Available Tools

| Tool | Purpose |
|------|---------|
| `web_search` | Search using Exa AI (requires EXA_API_KEY) - returns title, URL, date, author, snippet |
| `web_get_contents` | Fetch full text from specific URLs using Exa (requires EXA_API_KEY) |
| `browser_navigate` + `browser_screenshot` | Alternative: Use browser if Exa API key not set |

## Setup

Get a free API key at https://exa.ai, then:
```bash
export EXA_API_KEY=your_api_key_here
```

Or add to your shell profile (~/.bashrc, ~/.zshrc):
```bash
echo 'export EXA_API_KEY=your_api_key_here' >> ~/.bashrc
```

## Best Practices

1. **Use web_search for discovery** - Finding relevant pages with snippets
2. **Use web_get_contents for details** - Reading full articles from URLs
3. **Use fetchContents option** - Set to true to get full text of top 3 results automatically
4. **Use browser as fallback** - If Exa key not set, use browser to navigate and screenshot

## Common Patterns

### Quick search
```
web_search(query: "topic")
```

### Search with content
```
web_search(query: "topic", fetchContents: true) → get full text of top results
```

### Research workflow
```
web_search(broad query) → pick best URL → web_get_contents(urls: [chosen_url])
```

### Fallback to browser (no API key)
```
browser_navigate(url: "https://duckduckgo.com/html/?q=query") → browser_screenshot()
```

## Example Usage

User: "Search for Raspberry Pi 5 reviews"
→ web_search(query: "Raspberry Pi 5 review", numResults: 5, fetchContents: true)

User: "What's the latest AI news?"
→ web_search(query: "latest AI news today", numResults: 10)

User: "Get me the content from these URLs"
→ web_get_contents(urls: ["https://example.com/article1", "https://example.com/article2"])

User: "Find Python best practices"
→ web_search(query: "Python best practices 2024", fetchContents: true) → summarize results

User: "I don't have Exa API key"
→ browser_navigate(url: "https://html.duckduckgo.com/html/?q=topic") → browser_screenshot()

## Important Notes

- Exa provides high-quality, neural search results optimized for AI
- Free tier available at exa.ai (1000 requests/month)
- Results include published date and author when available
- fetchContents retrieves full article text, not just snippets
- Without API key, falls back to browser automation
