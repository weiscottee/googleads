/**
 * @OnlyCurrentAccount
 *
 * Gemini Search Query Variant Manager for Google Ads Scripts.
 *
 * For each enabled ad group in matching campaigns, this script reviews recent
 * search queries and asks Gemini whether each query is a close variant of the
 * ad group name. Variants can be added as exact-match positive keywords, and
 * clearly unrelated terms can be added as exact-match negative keywords.
 *
 * Source: packaged from the user's Google Docs script library.
 * Security: keep real API keys and spreadsheet IDs out of git.
 */

// =============================================================================
// Configuration
// =============================================================================

var GEMINI_API_KEY = "YOUR_GEMINI_API_KEY";
var SPREADSHEET_ID = "YOUR_GOOGLE_SHEET_ID";
var CAMPAIGN_NAME_CONDITION = "YOUR_CAMPAIGN_NAME_KEYWORD";
var DAYS_BACK = 7;

var GEMINI_MODEL = "gemini-1.5-pro-latest";
var BATCH_SIZE = 40;
var ADD_VARIANTS_AS_POSITIVE_KEYWORDS = true;
var ADD_CLEAR_MISMATCHES_AS_NEGATIVE_KEYWORDS = true;
var REQUIRE_NO_ADGROUP_WORD_OVERLAP_FOR_NEGATIVES = true;

var RUN_LOG = [];

function main() {
  validateConfig_();

  var changes = [];
  var dateRange = getDateRange_(DAYS_BACK);
  var campaignIterator = AdsApp.campaigns()
    .withCondition("Status = ENABLED")
    .withCondition("Name CONTAINS_IGNORE_CASE '" + CAMPAIGN_NAME_CONDITION + "'")
    .get();

  if (!campaignIterator.hasNext()) {
    log_("No enabled campaigns matched: " + CAMPAIGN_NAME_CONDITION);
    exportChangesToSheet_(SPREADSHEET_ID, changes);
    return;
  }

  while (campaignIterator.hasNext()) {
    var campaign = campaignIterator.next();
    log_("Processing campaign: " + campaign.getName());

    var adGroupIterator = campaign.adGroups().withCondition("Status = ENABLED").get();
    while (adGroupIterator.hasNext()) {
      var adGroup = adGroupIterator.next();
      processAdGroup_(campaign, adGroup, dateRange, changes);
    }
  }

  exportChangesToSheet_(SPREADSHEET_ID, changes);
}

function processAdGroup_(campaign, adGroup, dateRange, changes) {
  var adGroupName = normalizeText_(adGroup.getName());
  var existingPositives = getKeywords_(adGroup, "KeywordMatchType = EXACT", false);
  var existingNegatives = getKeywords_(adGroup, "MatchType = EXACT", true);
  var queries = getSearchQueries_(campaign, adGroup, dateRange, existingPositives, existingNegatives);

  if (queries.length === 0) {
    log_("  No new queries for ad group: " + adGroup.getName());
    return;
  }

  log_("  Classifying " + queries.length + " queries for ad group: " + adGroup.getName());
  for (var start = 0; start < queries.length; start += BATCH_SIZE) {
    var batch = queries.slice(start, start + BATCH_SIZE);
    var classifications = classifyQueriesWithGemini_(batch, adGroupName);

    if (!classifications) {
      log_("  Gemini returned no usable result for batch starting at index " + start);
      continue;
    }

    for (var i = 0; i < batch.length; i++) {
      applyClassification_(adGroup, adGroupName, batch[i], classifications[batch[i]], existingPositives, existingNegatives, changes);
    }
  }
}

function getSearchQueries_(campaign, adGroup, dateRange, existingPositives, existingNegatives) {
  var uniqueQueries = {};
  var queries = [];
  var report = AdsApp.report(
    "SELECT Query " +
      "FROM SEARCH_QUERY_PERFORMANCE_REPORT " +
      "WHERE CampaignId = " + campaign.getId() + " " +
      "AND AdGroupId = " + adGroup.getId() + " " +
      "AND Impressions > 0 " +
      "DURING " + dateRange
  );

  var rows = report.rows();
  while (rows.hasNext()) {
    var row = rows.next();
    var queryText = normalizeText_(row["Query"]);

    if (existingPositives[queryText] || existingNegatives[queryText] || uniqueQueries[queryText]) {
      continue;
    }

    queries.push(queryText);
    uniqueQueries[queryText] = true;
  }

  return queries;
}

function applyClassification_(adGroup, adGroupName, queryText, classification, existingPositives, existingNegatives, changes) {
  if (classification === "variant" && ADD_VARIANTS_AS_POSITIVE_KEYWORDS) {
    if (!existingPositives[queryText]) {
      var positiveText = "[" + queryText + "]";
      var op = adGroup.newKeywordBuilder().withText(positiveText).build();
      if (op.isSuccessful && !op.isSuccessful()) {
        log_("    Failed to add positive keyword: " + positiveText);
        return;
      }

      existingPositives[queryText] = true;
      changes.push([adGroup.getCampaign().getName(), adGroup.getName(), queryText, "", "variant"]);
      log_("    Added positive exact keyword: " + positiveText);
    }
    return;
  }

  if (classification === "not_variant" && ADD_CLEAR_MISMATCHES_AS_NEGATIVE_KEYWORDS) {
    if (existingNegatives[queryText]) {
      return;
    }

    if (REQUIRE_NO_ADGROUP_WORD_OVERLAP_FOR_NEGATIVES && hasAnyWordOverlap_(queryText, adGroupName)) {
      log_("    Skipped negative because query overlaps ad group words: " + queryText);
      return;
    }

    var negativeText = "[" + queryText + "]";
    adGroup.createNegativeKeyword(negativeText);
    existingNegatives[queryText] = true;
    changes.push([adGroup.getCampaign().getName(), adGroup.getName(), "", queryText, "not_variant"]);
    log_("    Added negative exact keyword: " + negativeText);
  }
}

function classifyQueriesWithGemini_(queries, adGroupName) {
  var endpoint = "https://generativelanguage.googleapis.com/v1beta/models/" +
    GEMINI_MODEL + ":generateContent?key=" + encodeURIComponent(GEMINI_API_KEY);

  var prompt =
    "You are a Google Ads expert. Classify each search query as either a close variant of the ad group name or not.\n\n" +
    "Variant means: misspellings, plural/singular forms, abbreviations, synonyms, or very close intent.\n\n" +
    "Ad group name: " + adGroupName + "\n\n" +
    "Search queries JSON array:\n" + JSON.stringify(queries) + "\n\n" +
    "Return only a JSON object. Each key must be the original query from the array. Each value must be either \"variant\" or \"not_variant\".";

  var payload = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.2,
      maxOutputTokens: 8192
    }
  };

  var options = {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  try {
    var response = UrlFetchApp.fetch(endpoint, options);
    var responseCode = response.getResponseCode();
    var responseText = response.getContentText();

    if (responseCode !== 200) {
      log_("Gemini API error " + responseCode + ": " + responseText);
      return null;
    }

    var fullResponse = JSON.parse(responseText);
    var jsonText = fullResponse &&
      fullResponse.candidates &&
      fullResponse.candidates[0] &&
      fullResponse.candidates[0].content &&
      fullResponse.candidates[0].content.parts &&
      fullResponse.candidates[0].content.parts[0] &&
      fullResponse.candidates[0].content.parts[0].text;

    return jsonText ? JSON.parse(stripJsonFence_(jsonText)) : null;
  } catch (e) {
    log_("Gemini classify exception: " + e);
    return null;
  }
}

function getKeywords_(adGroup, condition, isNegative) {
  var keywords = {};
  var iterator = isNegative
    ? adGroup.negativeKeywords().withCondition(condition).get()
    : adGroup.keywords().withCondition(condition).get();

  while (iterator.hasNext()) {
    var keyword = iterator.next();
    var text = normalizeText_(keyword.getText().replace(/^\[|\]$/g, ""));
    keywords[text] = true;
  }

  return keywords;
}

function getDateRange_(daysBack) {
  var today = new Date();
  var pastDate = new Date(today.getTime() - daysBack * 24 * 60 * 60 * 1000);
  var timeZone = AdsApp.currentAccount().getTimeZone();

  function formatDate(date) {
    return Utilities.formatDate(date, timeZone, "yyyyMMdd");
  }

  return formatDate(pastDate) + "," + formatDate(today);
}

function exportChangesToSheet_(spreadsheetId, changes) {
  if (!spreadsheetId || spreadsheetId === "YOUR_GOOGLE_SHEET_ID") {
    log_("Spreadsheet ID is not configured. Skipping sheet export.");
    return;
  }

  try {
    var accountName = AdsApp.currentAccount().getName();
    var dateString = Utilities.formatDate(new Date(), AdsApp.currentAccount().getTimeZone(), "yyyy-MM-dd");
    var sheetName = accountName + "_" + dateString;
    var spreadsheet = SpreadsheetApp.openById(spreadsheetId);
    var sheet = spreadsheet.getSheetByName(sheetName) || spreadsheet.insertSheet(sheetName, 0);

    if (sheet.getLastRow() === 0) {
      sheet.appendRow(["Campaign", "Ad group", "Positive exact keyword", "Negative exact keyword", "Classification"]);
      sheet.getRange("A1:E1").setFontWeight("bold").setBackground("#d9ead3");
      sheet.setFrozenRows(1);
    }

    if (changes.length > 0) {
      sheet.getRange(sheet.getLastRow() + 1, 1, changes.length, 5).setValues(changes);
      sheet.autoResizeColumns(1, 5);
    }

    if (RUN_LOG.length > 0) {
      var logSheetName = sheetName + "_log";
      var logSheet = spreadsheet.getSheetByName(logSheetName) || spreadsheet.insertSheet(logSheetName);
      logSheet.clear();
      logSheet.appendRow(["Log"]);
      logSheet.getRange(2, 1, RUN_LOG.length, 1).setValues(RUN_LOG.map(function(entry) { return [entry]; }));
      logSheet.autoResizeColumn(1);
    }
  } catch (e) {
    log_("Failed to export to Google Sheet: " + e);
  }
}

function hasAnyWordOverlap_(queryText, adGroupName) {
  var words = adGroupName.split(/\s+/);
  for (var i = 0; i < words.length; i++) {
    if (words[i] && queryText.indexOf(words[i]) !== -1) {
      return true;
    }
  }
  return false;
}

function stripJsonFence_(text) {
  return String(text).replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
}

function normalizeText_(text) {
  return String(text || "").toLowerCase().trim();
}

function validateConfig_() {
  if (!GEMINI_API_KEY || GEMINI_API_KEY === "YOUR_GEMINI_API_KEY") {
    throw new Error("Set GEMINI_API_KEY before running this script.");
  }
  if (!CAMPAIGN_NAME_CONDITION || CAMPAIGN_NAME_CONDITION === "YOUR_CAMPAIGN_NAME_KEYWORD") {
    throw new Error("Set CAMPAIGN_NAME_CONDITION before running this script.");
  }
}

function log_(message) {
  var timestamp = Utilities.formatDate(new Date(), AdsApp.currentAccount().getTimeZone(), "HH:mm:ss");
  var entry = timestamp + " - " + message;
  RUN_LOG.push(entry);
  Logger.log(entry);
}
