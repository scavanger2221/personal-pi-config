---
description: Use browser automation tools to navigate websites, take screenshots, fill forms, and extract web data using Chromium.
---

# Browser Automation

Activate when the user wants to interact with websites, take screenshots, fill forms, or extract web data.

## When to use

- User mentions "screenshot", "capture", "image of website", "what does this site look like"
- User wants to "check a website", "visit a URL", "go to a site", "navigate to"
- User wants to "fill a form", "login to", "enter data on a website"
- User wants to "extract data", "get text from", "scrape" a website
- User wants to "click", "scroll", "interact with" a webpage
- User mentions testing a website, checking if a page loads, verifying content

## Available Tools

| Tool | Purpose |
|------|---------|
| `browser_navigate` | Go to a URL |
| `browser_screenshot` | Take screenshot (viewport or full page) |
| `browser_click` | Click an element by CSS selector |
| `browser_type` | Type text into form fields |
| `browser_get_text` | Extract text content from page |
| `browser_scroll` | Scroll up/down/top/bottom |
| `browser_wait_for` | Wait for element to appear |
| `browser_debug` | Screenshot + page info for debugging |
| `browser_close` | Close browser and cleanup |

## Best Practices

1. **Take frequent screenshots** - The user can't see the browser, so screenshot after each major action
2. **Use debug tool when stuck** - If something doesn't work, use `browser_debug` to see current state
3. **Navigate first** - Always use `browser_navigate` before other actions
4. **Check selectors** - If click/type fails, screenshot to see what's actually on the page
5. **Close when done** - Use `browser_close` to free resources

## Common Patterns

### Screenshot a website
```
browser_navigate → browser_screenshot
```

### Fill and submit a form
```
browser_navigate → browser_screenshot (see the form) 
→ browser_type (username) → browser_type (password) 
→ browser_screenshot (verify) → browser_click (submit)
```

### Extract page content
```
browser_navigate → browser_get_text → browser_close
```

### Debug a failing interaction
```
browser_navigate → browser_click (fails?) 
→ browser_debug (see what's on page and HTML)
```

## Example Usage

User: "Screenshot google.com"
→ browser_navigate(url: "https://google.com")
→ browser_screenshot()

User: "Go to github.com/login and show me the login form"
→ browser_navigate(url: "https://github.com/login")
→ browser_screenshot()

User: "What's the text content of example.com?"
→ browser_navigate(url: "https://example.com")
→ browser_get_text()
→ browser_close()

User: "Fill in the contact form on example.com/contact"
→ browser_navigate(url: "https://example.com/contact")
→ browser_screenshot()  # See the form
→ browser_type(selector: "#name", text: "John Doe")
→ browser_type(selector: "#email", text: "john@example.com")
→ browser_type(selector: "#message", text: "Hello there!")
→ browser_screenshot()  # Verify filled
→ browser_click(selector: "#submit")
