# Launch Posts

## Reddit Subreddit Plan

Post order:

1. `r/PPC` — best first post. Most relevant audience, but avoid founder-style
   feedback language. Frame it as a PPC operator workflow and ask for safety
   checks.
2. `r/googleads` — second post after 24-48 hours. More Google Ads specific,
   slightly more practical and less story-driven.
3. `r/GoogleAdsDiscussion` — good later post if the first two survive. Angle:
   "which Google Ads scripts are still worth using?"
4. `r/SideProject` — optional later. Angle: "I built a small tool to remove a
   repetitive part of my own work." Include screenshots before posting.
5. `r/opensource` — optional later. Only post after adding license, screenshots,
   and clearer contribution docs.

Avoid first wave:

- `r/marketing` — too strict on self-promotion.
- `r/DigitalMarketing` — high removal risk unless posting pure lessons without
  a link.
- `r/Entrepreneur` / `r/SaaS` — too broad for the first launch.

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

So I packaged the scripts I use into an open-source repo. It includes:

- Search-term mining
- OpenAI keyword-to-ad-group matching
- Gemini competitor query classification
- Embedding-based negative keyword audits
- Checks for converting search terms blocked by exact negatives
- Ad copy coverage checks
- Weekly/monthly Google Sheets reports

The AI parts are not meant to replace judgment. They are mostly used for
classification, matching, and similarity checks, with preview/logging before any
account changes are made.

Repo: https://github.com/weiscottee/googleads
```

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

## Reddit r/GoogleAds

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

## Reddit r/SideProject

Title:

```text
I turned the repetitive parts of my Google Ads work into a small open-source script collection
```

Body:

```text
I work on Google Ads accounts and kept running into the same repetitive work: search-term review, negative keyword cleanup, keyword expansion, ad copy coverage checks, and reporting.

Instead of building a full app, I made a small collection of Google Ads Scripts that can be pasted into the Google Ads Scripts editor and connected to OpenAI/Gemini or Google Sheets where needed.

The idea is not "AI manages your ads." It is more boring and practical: use AI for classification/matching/similarity checks, log everything, preview first, and keep a human review step before changes go live.

Repo: https://github.com/weiscottee/googleads

Next things I probably need to add:

- fake-data screenshots
- example Google Sheet templates
- one setup walkthrough per script
- a license and contribution notes

Would love feedback on making a niche operator tool understandable to people who are not already deep into Google Ads Scripts.
```
