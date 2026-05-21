# Google Ads Agent Script Library

Google Ads Scripts for AI-assisted PPC operations: keyword expansion, negative
keyword mining, search-term audits, copy coverage checks, and scheduled account
reports.

The main library was packaged from the Google Drive document
`轻量级谷歌广告Agent合集.docx`. Each script is standalone and should be pasted into
the Google Ads Scripts editor.

## Scripts

| Script | Source name | Purpose | AI provider |
| --- | --- | --- | --- |
| `scripts/brand-impression-share-alert.js` | 展示分额预警 | Sends an email alert when brand campaign search impression share drops or changes sharply. | None |
| `scripts/gemini-competitor-query-expander-negatives.js` | 竞品词_拓词+否词_0704 | Uses Gemini to classify competitor search queries, then adds exact positives or exact negatives. | Gemini |
| `scripts/openai-sheet-keyword-adder.js` | 一键加词 | Reads keywords from Google Sheets, maps them to the best ad group with OpenAI, then adds exact and phrase keywords. | OpenAI |
| `scripts/openai-high-registration-keyword-expander.js` | 行业词_拓词_高注册词 | Expands high-registration industry terms into ad groups with OpenAI matching and labels new keywords. | OpenAI |
| `scripts/openai-negative-keyword-embedding-audit.js` | 向量否词 | Scores search terms against ad group names with embeddings and adds low-similarity exact negatives. | OpenAI |
| `scripts/account-weekly-performance-report.js` | 自动周报 | Exports weekly account-level performance metrics and period-over-period comparisons to Google Sheets. | None |
| `scripts/account-monthly-performance-report.js` | 月报导出 | Exports monthly account-level performance metrics and period-over-period comparisons to Google Sheets. | None |
| `scripts/converting-negative-keyword-audit.js` | 一键查询有出单的否定词 | Finds converting search terms that are currently exact negative keywords. | None |
| `scripts/low-registration-negative-keyword-miner.js` | 行业词_否词_低注册词 | Finds low-registration search terms and exports negative keyword candidates. | None |
| `scripts/uncovered-search-term-copy-audit.js` | 文案优化_一键查找未覆盖搜索词 | Finds converting search terms that are not covered in ad copy for copy optimization. | None |

The repo also keeps `scripts/openai-converting-query-harvester.js`, an earlier
standalone OpenAI keyword harvester that was already in the repository before
the full collection was added.

For the original Chinese names and a shorter lookup table, see
`docs/script-library.md`.

## Setup

1. Open Google Ads.
2. Go to **Tools and settings** > **Bulk actions** > **Scripts**.
3. Create a new script.
4. Paste one file from `scripts/` into the editor.
5. Fill in the configuration variables at the top of the script.
6. Run in preview first, inspect the logs and spreadsheet output, then schedule.

## Configuration

Every script keeps credentials and private account details as placeholders. Do
not commit real values.

Typical fields:

```js
var GEMINI_API_KEY = "YOUR_GEMINI_API_KEY";
var OPENAI_API_KEY = "YOUR_OPENAI_API_KEY";
var SPREADSHEET_ID = "YOUR_GOOGLE_SHEET_ID";
var LOG_SPREADSHEET_URL = "YOUR_GOOGLE_SHEET_URL";
var CAMPAIGN_NAME_CONDITION = "YOUR_CAMPAIGN_NAME_KEYWORD";
```

## Safety Notes

Some scripts can modify live Google Ads accounts by adding keywords or negative
keywords. Always use preview mode first, start with a narrow
`CAMPAIGN_NAME_CONDITION`, and review the generated spreadsheet logs before
running on a schedule.

API calls may incur provider costs. Keep API keys private and rotate any key
that was previously pasted into a shared document or public file.

## Repository Layout

```text
.
├── docs/
│   ├── script-library.md
│   └── security.md
├── scripts/
│   ├── account-monthly-performance-report.js
│   ├── account-weekly-performance-report.js
│   ├── brand-impression-share-alert.js
│   ├── converting-negative-keyword-audit.js
│   ├── gemini-competitor-query-expander-negatives.js
│   ├── low-registration-negative-keyword-miner.js
│   ├── openai-converting-query-harvester.js
│   ├── openai-high-registration-keyword-expander.js
│   ├── openai-negative-keyword-embedding-audit.js
│   ├── openai-sheet-keyword-adder.js
│   └── uncovered-search-term-copy-audit.js
└── README.md
```
