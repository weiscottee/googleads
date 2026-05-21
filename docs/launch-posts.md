# Launch Posts

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
I got tired of repetitive Google Ads search-term and negative keyword work, so I made a small automation toolkit
```

Body:

```text
I work on Google Ads accounts, and some parts of the job are useful but painfully repetitive:

- Going through search terms
- Deciding which queries should become keywords
- Deciding which queries should become negatives
- Checking whether exact negatives are blocking converting search terms
- Checking whether ad copy actually covers the terms that are converting
- Pulling weekly/monthly account summaries into Sheets

I did not want to turn this into a big SaaS or a full Google Ads API app. I just wanted something practical for operators: paste a script into Google Ads Scripts, configure the API key / Sheet / campaign filter, run preview first, review the output, and only then schedule it.

So I cleaned up a small set of scripts and published them as an open-source repo.

The scripts include:

- Search-term mining
- OpenAI keyword-to-ad-group matching
- Gemini competitor query classification
- Embedding-based negative keyword audit
- Finding converting search terms blocked by exact negatives
- Finding high-converting terms not covered in ad copy
- Weekly/monthly account reports into Google Sheets

The AI part is not meant to replace account judgment. I use it mostly for classification, matching, and similarity checks. The important part is that the scripts can preview/log results before making account changes.

I would love feedback from people who already use Google Ads Scripts:

- Which safety checks would you want before running something like this?
- Are there any obvious workflow gaps?
- Would example Sheet templates or fake-data screenshots make it easier to evaluate?
- Which repetitive Google Ads task would you automate next?

Repo: https://github.com/weiscottee/googleads
```

## Reddit r/GoogleAds

Title:

```text
I automated the repetitive Google Ads Scripts work I kept avoiding
```

Body:

```text
I work on Google Ads accounts, and I kept running into the same repetitive tasks: search-term review, keyword expansion, negative keyword checks, ad copy coverage checks, and weekly/monthly reporting.

I did not want to build a large app for it. I wanted small operator-friendly scripts that can run inside Google Ads Scripts, write logs/reports to Sheets, and be previewed before doing anything live.

So I packaged a small open-source toolkit. Some scripts use OpenAI/Gemini for classification, ad group matching, and embedding similarity checks.

It is intended for people who are already comfortable with Google Ads Scripts. You still need to configure your own API keys, Sheet IDs, campaign filters, and run everything in preview mode before making changes.

I am looking for practical feedback:

- What would make this safer to run in real accounts?
- Which script would be most useful in your workflow?
- What examples or docs should be added first?
- What Google Ads task do you find repetitive enough to automate?

Repo: https://github.com/weiscottee/googleads
```
