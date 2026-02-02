---
name: gemini-search
description: Use the Gemini CLI to perform high-quality web searches and get real-time answers. This is a powerful alternative to standard web search.
---

# Gemini Search Skill

This skill leverages the `gemini` CLI via a custom extension tool.

## Usage

When you need up-to-date information, current prices, or complex research, use the `gemini_search` tool.

Example:
```
gemini_search(query: "What is the current stock price of Google?")
```

## Features

- **Real-time Access**: Uses Google Search internally through the Gemini CLI.
- **Natural Language**: Understands complex, multi-part questions.
- **Concise Summaries**: Provides direct answers rather than just links.

## Manual Command

You can also run search manually from the input box:
```
/gemini <your query>
```
