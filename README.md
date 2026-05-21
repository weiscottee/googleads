# Google Ads Automation Scripts

A small library of Google Ads Scripts for search-term mining, keyword expansion,
negative keyword auditing, and AI-assisted ad group matching.

These scripts are designed for the Google Ads Scripts editor. They are not npm
packages and do not run directly in Node.js.

## Scripts

| Script | Purpose | AI provider |
| --- | --- | --- |
| `scripts/gemini-search-query-variant-manager.js` | Classifies recent search queries as ad-group variants or mismatches, then can add exact positive or negative keywords. | Gemini |
| `scripts/openai-converting-query-harvester.js` | Finds converting search terms that are not already keywords, routes them to the best ad group, adds exact and phrase keywords, labels them, and logs results. | OpenAI |
| `scripts/openai-negative-keyword-embedding-audit.js` | Scores search terms against ad group names with embeddings plus token overlap and can add low-similarity exact negatives. | OpenAI |

## Setup

1. Open Google Ads.
2. Go to **Tools and settings** > **Bulk actions** > **Scripts**.
3. Create a new script.
4. Paste one file from `scripts/` into the editor.
5. Fill in the configuration variables at the top of the script.
6. Run in preview first, inspect the logs and spreadsheet output, then schedule.

## Configuration

Every script keeps credentials as placeholders. Do not commit real values.

Typical fields:

```js
var GEMINI_API_KEY = "YOUR_GEMINI_API_KEY";
var OPENAI_API_KEY = "YOUR_OPENAI_API_KEY";
var SPREADSHEET_ID = "YOUR_GOOGLE_SHEET_ID";
var LOG_SPREADSHEET_URL = "YOUR_GOOGLE_SHEET_URL";
var CAMPAIGN_NAME_CONDITION = "YOUR_CAMPAIGN_NAME_KEYWORD";
```

## Safety Notes

These scripts can modify live Google Ads accounts by adding keywords or negative
keywords. Always use preview mode first, start with a narrow
`CAMPAIGN_NAME_CONDITION`, and review the generated spreadsheet logs before
running on a schedule.

API calls may incur provider costs. Keep API keys private and rotate any key
that was previously pasted into a shared document or public file.

## Repository Layout

```text
.
├── docs/
│   └── security.md
├── scripts/
│   ├── gemini-search-query-variant-manager.js
│   ├── openai-converting-query-harvester.js
│   └── openai-negative-keyword-embedding-audit.js
└── README.md
```
