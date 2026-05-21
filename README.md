# AI Google Ads Scripts: OpenAI + Gemini PPC Automation Toolkit

[![GitHub stars](https://img.shields.io/github/stars/weiscottee/googleads?style=social)](https://github.com/weiscottee/googleads/stargazers)
[![Google Ads Scripts](https://img.shields.io/badge/Google%20Ads-Scripts-4285F4)](https://developers.google.com/google-ads/scripts)
[![OpenAI](https://img.shields.io/badge/OpenAI-PPC%20automation-111111)](https://openai.com/)
[![Gemini](https://img.shields.io/badge/Gemini-search%20term%20classification-1a73e8)](https://ai.google.dev/)

Copy-paste Google Ads Scripts for AI-assisted PPC workflows: search term mining,
keyword expansion, negative keyword automation, ad copy coverage audits, and
weekly/monthly performance reporting with Google Sheets.

Built for PPC specialists, Google Ads agencies, and in-house growth teams that
want practical automation without building a full Google Ads API application.

## What You Can Automate

| Workflow | Use this script | What it does | AI |
| --- | --- | --- | --- |
| Protect brand traffic | `scripts/brand-impression-share-alert.js` | Sends an email alert when brand campaign search impression share drops or changes sharply. | None |
| Mine competitor search terms | `scripts/gemini-competitor-query-expander-negatives.js` | Uses Gemini to classify competitor search queries, then adds exact positives or exact negatives. | Gemini |
| Add keywords from a sheet | `scripts/openai-sheet-keyword-adder.js` | Reads keywords from Google Sheets, maps them to the best ad group, then adds exact and phrase keywords. | OpenAI |
| Expand high-converting industry terms | `scripts/openai-high-registration-keyword-expander.js` | Finds promising search terms, matches them to ad groups, adds keywords, and labels the new keywords. | OpenAI |
| Audit weak search-term relevance | `scripts/openai-negative-keyword-embedding-audit.js` | Scores search terms against ad group names with embeddings and adds low-similarity exact negatives. | OpenAI |
| Export a weekly account report | `scripts/account-weekly-performance-report.js` | Writes weekly account metrics and period-over-period changes to Google Sheets. | None |
| Export a monthly account report | `scripts/account-monthly-performance-report.js` | Writes monthly account metrics and period-over-period changes to Google Sheets. | None |
| Find converting negative keywords | `scripts/converting-negative-keyword-audit.js` | Finds search terms with conversions that are currently blocked by exact negative keywords. | None |
| Mine low-registration negatives | `scripts/low-registration-negative-keyword-miner.js` | Finds low-registration search terms and exports negative keyword candidates. | None |
| Audit uncovered ad-copy terms | `scripts/uncovered-search-term-copy-audit.js` | Finds converting search terms that are not covered in ad copy, so copy can be improved. | None |

The repo also keeps `scripts/openai-converting-query-harvester.js`, an earlier
standalone OpenAI keyword harvester.

## Why This Repo Is Useful

- **No backend required:** each file runs inside the Google Ads Scripts editor.
- **Practical PPC workflows:** scripts focus on search terms, negatives,
  keyword expansion, ad copy gaps, and reporting.
- **AI where it helps:** OpenAI and Gemini are used for classification,
  relevance matching, and embeddings instead of generic content generation.
- **Google Sheets friendly:** scripts can write logs and reports to Sheets for
  review before changes are applied.
- **Safety first:** credentials, sheet IDs, account emails, and campaign filters
  are placeholders in this public repo.

## Quick Start

1. Open Google Ads.
2. Go to **Tools and settings** > **Bulk actions** > **Scripts**.
3. Create a new script.
4. Copy one file from `scripts/` into the editor.
5. Fill in the configuration variables at the top of the script.
6. Run in preview mode first.
7. Review the logs and spreadsheet output.
8. Schedule only after a safe preview run.

## Common Configuration

Every script keeps credentials and private account details as placeholders. Do
not commit real values.

```js
var GEMINI_API_KEY = "YOUR_GEMINI_API_KEY";
var OPENAI_API_KEY = "YOUR_OPENAI_API_KEY";
var SPREADSHEET_ID = "YOUR_GOOGLE_SHEET_ID";
var LOG_SPREADSHEET_URL = "YOUR_GOOGLE_SHEET_URL";
var CAMPAIGN_NAME_CONDITION = "YOUR_CAMPAIGN_NAME_KEYWORD";
```

## Safety Notes

Some scripts can modify live Google Ads accounts by adding keywords or negative
keywords. Always use preview mode first, start with a narrow campaign filter,
and review the generated spreadsheet logs before running on a schedule.

API calls may incur provider costs. Keep API keys private and rotate any key
that was previously pasted into a shared document or public file.

## Project Docs

- `docs/script-library.md` maps the original script names to their packaged file names.
- `docs/security.md` explains what was sanitized before publishing.
- `docs/growth-playbook.md` gives a launch and distribution plan for getting more traffic.

## Repository Layout

```text
.
├── docs/
│   ├── growth-playbook.md
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

If this saves you time in Google Ads, star the repo so other PPC operators can
find it too.
