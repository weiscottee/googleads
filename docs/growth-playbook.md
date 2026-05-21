# Growth Playbook

This repo is a niche utility project. The traffic angle is not broad AI hype; it
is a real PPC operator story:

> I run Google Ads work, the search-term / keyword / negative-keyword review loop
> is valuable but repetitive, so I packaged my Google Ads Scripts workflow into a
> small open-source toolkit.

## Positioning

English:

> AI-assisted Google Ads Scripts for search term mining, negative keyword
> automation, keyword expansion, ad copy audits, and Sheets-based PPC reports.

Chinese:

> 一套把 OpenAI/Gemini 接进 Google Ads Scripts 的投放自动化脚本，用来做搜索词挖掘、否词、加词、文案覆盖检查和周/月报。

## Reddit Plan

Post order:

1. `r/PPC` — first post. Most relevant audience. Frame it as a PPC operator
   workflow and ask for safety checks.
2. `r/googleads` — second post after 24-48 hours. More Google Ads specific,
   slightly more practical and less story-driven.
3. `r/GoogleAdsDiscussion` — later post if the first two survive. Angle:
   "which Google Ads Scripts are still worth using?"
4. `r/SideProject` — optional later, after adding screenshots or Sheet examples.

Avoid first wave:

- `r/marketing` — too strict on self-promotion.
- `r/DigitalMarketing` — high removal risk unless posting pure lessons without
  a link.
- `r/Entrepreneur` / `r/SaaS` — too broad for the first launch.

## Reddit r/PPC

Title:

```text
I built a Google Ads Scripts workflow for search terms and negatives. What safety checks would you add?
```

Body:

```text
I work on Google Ads accounts, and search-term work is one of those things that is valuable but easy to put off because it is so repetitive.

The parts I kept avoiding were:

- reviewing search terms regularly
- deciding which queries should become exact/phrase keywords
- deciding which queries should become exact negatives
- checking whether exact negatives are accidentally blocking converting queries
- checking whether ad copy actually covers the queries that convert
- pulling weekly/monthly account summaries into Sheets

I did not want to build a full Google Ads API app for this. For my own workflow, Google Ads Scripts felt like the right level: paste a script into the account, configure the API key / Sheet / campaign filter, run preview first, review the log or Sheet output, then schedule only if the result is sane.

So I cleaned up the scripts I use into a small open-source repo.

The current scripts cover:

- Search-term mining
- OpenAI keyword-to-ad-group matching
- Gemini competitor query classification
- Embedding-based negative keyword audit
- Finding converting search terms blocked by exact negatives
- Finding high-converting terms not covered in ad copy
- Weekly/monthly account reports into Google Sheets

The AI part is not meant to replace account judgment. I am using it mostly for classification, matching, and similarity checks. The part I care about most is the guardrail: preview first, log to Sheets, then decide whether anything should be applied.

For people here who use Google Ads Scripts or semi-automated negative keyword workflows:

- What safety checks would you add before trusting this in real accounts?
- Would you keep everything as "suggestions only" or allow some auto-apply rules?
- What metrics would you require before a search term becomes a negative candidate?
- Would fake-data Sheet templates make the workflow easier to evaluate?

Repo: https://github.com/weiscottee/googleads
```

## Reddit r/googleads

Title:

```text
I made a small Google Ads Scripts setup for search terms, negatives, and Sheets reports
```

Body:

```text
I work on Google Ads accounts and kept running into the same repetitive work: search-term review, keyword expansion, negative keyword checks, ad copy coverage checks, and weekly/monthly reporting.

I did not want a large app for this. I wanted small scripts that can run inside Google Ads Scripts, write logs/reports to Google Sheets, and be previewed before doing anything live.

So I packaged the workflow as a small open-source repo.

It includes scripts for:

- search-term mining
- matching new keywords to the most relevant ad group
- exact negative keyword audits
- checking converting search terms blocked by negatives
- checking high-converting terms not covered by ad copy
- weekly/monthly account reports into Google Sheets

Some scripts use OpenAI/Gemini for classification, ad group matching, or embedding similarity checks. I still treat the output as something to review, not something that should blindly replace account judgment.

It is intended for people who are already comfortable with Google Ads Scripts. You still need to configure your own API keys, Sheet IDs, campaign filters, and run everything in preview mode before making changes.

I am looking for practical feedback:

- What would make this safer to run in real accounts?
- Which script would be most useful in your workflow?
- What example Sheet templates or fake-data screenshots should I add first?
- What Google Ads task do you find repetitive enough to automate next?

Repo: https://github.com/weiscottee/googleads
```

## Reddit r/GoogleAdsDiscussion

Title:

```text
Which Google Ads Scripts are still worth using in 2026? I packaged the ones I still use.
```

Body:

```text
I have been thinking about which Google Ads Scripts are still worth keeping around now that Google has more built-in automation and everyone is experimenting with AI.

The scripts I still find useful are not really "AI runs the account" scripts. They are boring operator scripts:

- pull search terms into a reviewable workflow
- flag possible exact negatives
- catch converting queries that are blocked by negatives
- match candidate keywords to the most relevant ad group
- check whether ad copy covers converting search terms
- export weekly/monthly account summaries into Sheets

I packaged the scripts I use into a small open-source repo. Some use OpenAI/Gemini for classification, matching, or similarity checks, but the core workflow is still preview -> log/review -> apply carefully.

Repo: https://github.com/weiscottee/googleads

Curious what other PPC people still keep as scripts in 2026. Are scripts still part of your workflow, or have you moved this kind of work into API jobs / third-party tools / manual review?
```

## Hacker News

Title:

```text
Show HN: I automated the repetitive Google Ads work I hated doing
```

URL:

```text
https://github.com/weiscottee/googleads
```

Backup text-only version:

```text
I work on Google Ads accounts, and a lot of the day-to-day work is repetitive:
checking search terms, deciding what should become a keyword, deciding what
should become a negative, checking whether ad copy covers the queries that
actually convert, and moving performance summaries into Sheets.

I did not want to build a full Google Ads API app or another dashboard. I wanted
something closer to an operator toolkit: small scripts I can paste into Google
Ads Scripts, preview, review in logs/Sheets, and then schedule when the logic is
safe.

So I packaged the scripts I use into an open-source repo. It includes search-term
mining, OpenAI keyword-to-ad-group matching, Gemini competitor query
classification, embedding-based negative keyword audits, ad copy coverage
checks, and weekly/monthly Google Sheets reports.

Repo: https://github.com/weiscottee/googleads
```

## Measurement

GitHub repository traffic only covers the most recent 14 days. Track weekly:

- views
- unique visitors
- clones
- referrers
- popular paths
- stars and forks

Current baseline before launch packaging:

| Metric | Last 14 days |
| --- | ---: |
| Views | 3 |
| Unique visitors | 1 |
| Clones | 1 |
| Unique cloners | 1 |

## Improve Next

- Add a license before posting to broader open-source communities.
- Add fake-data screenshots for Sheet outputs.
- Add one example config block per script.
- Add a short FAQ for common Google Ads Scripts errors.
- Add a "which script should I use?" decision tree.
