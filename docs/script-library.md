# Script Library

| Original name | File | Purpose |
| --- | --- | --- |
| 展示分额预警 | `scripts/brand-impression-share-alert.js` | Alerts by email when brand campaign search impression share drops or changes sharply. |
| 竞品词_拓词+否词_0704 | `scripts/gemini-competitor-query-expander-negatives.js` | Uses Gemini to classify competitor search queries, then adds exact positives or exact negatives. |
| 一键加词 | `scripts/openai-sheet-keyword-adder.js` | Reads keywords from a Google Sheet, uses OpenAI to map each keyword to the best ad group, then adds exact and phrase keywords. |
| 行业词_拓词_高注册词 | `scripts/openai-high-registration-keyword-expander.js` | Expands high-registration industry terms into ad groups with OpenAI matching and labels new keywords. |
| 向量否词 | `scripts/openai-negative-keyword-embedding-audit.js` | Scores search terms against ad group names with embeddings and adds low-similarity exact negatives. |
| 自动周报 | `scripts/account-weekly-performance-report.js` | Exports account-level weekly performance metrics and period-over-period comparisons to Google Sheets. |
| 月报导出 | `scripts/account-monthly-performance-report.js` | Exports account-level monthly performance metrics and period-over-period comparisons to Google Sheets. |
| 一键查询有出单的否定词 | `scripts/converting-negative-keyword-audit.js` | Finds converting search terms that are currently exact negative keywords. |
| 行业词_否词_低注册词 | `scripts/low-registration-negative-keyword-miner.js` | Finds low-registration search terms and exports negative keyword candidates. |
| 文案优化_一键查找未覆盖搜索词 | `scripts/uncovered-search-term-copy-audit.js` | Finds converting search terms that are not covered in ad copy for copy optimization. |
