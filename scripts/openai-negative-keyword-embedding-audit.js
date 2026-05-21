// ===================================================================================
// SCRIPT CONFIGURATION
// ===================================================================================

// Condition to filter campaigns. The script will only process campaigns whose names contain this text.
var CAMPAIGN_NAME_CONDITION = "YOUR_CAMPAIGN_NAME_KEYWORD";

// The number of days of search term data to analyze. 1 means yesterday and today.
var DAYS_BACK = 1;

// The URL of the Google Sheet where the report will be logged.
var LOG_SPREADSHEET_URL = "YOUR_GOOGLE_SHEET_URL";

// --- OpenAI API Configuration ---
// Replace with your actual OpenAI API key.
var OPENAI_API_KEY = "YOUR_OPENAI_API_KEY";
// The embedding model to use. "text-embedding-3-large" is a powerful option.
var EMBEDDING_MODEL = "text-embedding-3-large";

// --- Scoring Weights ---
// Weights for combining dense vector (Embedding) and sparse vector (BM25) scores.
// Setting EMBEDDING_WEIGHT to 1 and BM25_WEIGHT to 0 relies entirely on semantic similarity.
var EMBEDDING_WEIGHT = 1;
var BM25_WEIGHT = 0;


// ===================================================================================
// GLOBAL VARIABLES
// ===================================================================================

// Global array to store the search term match report.
// Format: [Campaign Name, Ad Group Name, Search Term, Final Score, Score Reason, Conversion Value, Cost]
var SEARCH_TERM_MATCH_REPORT = [];


/**
 * Main function to run the script.
 * 1. Iterates through eligible campaigns and ad groups.
 * 2. Fetches search terms with impressions > 0 for each ad group using an AWQL report.
 * 3. Gets embeddings for search terms and the ad group name from the OpenAI API.
 * 4. Calculates a combined similarity score (cosine similarity + BM25).
 * 5. Saves the results to be flushed to a Google Sheet.
 * 6. Adds search terms with an embedding similarity below 0.2 as exact match negative keywords.
 */
function main() {
  var dateRange = getDateRange(DAYS_BACK);

  var campaignIterator = AdsApp.campaigns()
    .withCondition("Status = ENABLED")
    .withCondition("Name CONTAINS_IGNORE_CASE '" + CAMPAIGN_NAME_CONDITION + "'")
    .get();

  if (!campaignIterator.hasNext()) {
    Logger.log("No campaigns found matching the condition: '" + CAMPAIGN_NAME_CONDITION + "'.");
    flushReports();
    return;
  }

  while (campaignIterator.hasNext()) {
    var campaign = campaignIterator.next();
    var campaignName = campaign.getName().trim();

    var adGroupIterator = campaign.adGroups().withCondition("Status = ENABLED").get();
    while (adGroupIterator.hasNext()) {
      var adGroup = adGroupIterator.next();
      var adGroupNameRaw = adGroup.getName().trim();
      var adGroupNameLower = adGroupNameRaw.toLowerCase();

      // Skip ad groups containing specific keywords like "broad" or "core".
      if (adGroupNameLower.indexOf("broad") !== -1 || adGroupNameLower.indexOf("core") !== -1) {
        continue;
      }

      // Clean the ad group name by removing language suffixes for better semantic matching.
      var adGroupNameClean = adGroupNameLower.replace(/(_es|_de|_fr|_zh|_it)$/, "");

      // AWQL query to fetch search terms with cost > 2.
      var query = "SELECT Query, Impressions, ConversionValue, Cost " +
                  "FROM SEARCH_QUERY_PERFORMANCE_REPORT " +
                  "WHERE CampaignId = " + campaign.getId() + " " +
                  "AND AdGroupId = " + adGroup.getId() + " " +
                  "AND Cost > 2 " +
                  "DURING " + dateRange;

      var report = AdsApp.report(query);
      var rows = report.rows();

      var searchTermRows = [];
      while (rows.hasNext()) {
         var row = rows.next();
         searchTermRows.push({
            searchTerm: row["Query"].trim().toLowerCase(),
            conversionValue: row["ConversionValue"],
            cost: row["Cost"]
         });
      }

      if (searchTermRows.length > 0) {
         var searchTerms = searchTermRows.map(function(item) { return item.searchTerm; });
         var searchTermEmbeddings = getEmbeddingsBulk(searchTerms);
         var adGroupEmbedding = getEmbedding(adGroupNameClean);

         for (var i = 0; i < searchTermRows.length; i++) {
             var st = searchTermRows[i].searchTerm;
             var conversionValue = searchTermRows[i].conversionValue;
             var cost = searchTermRows[i].cost;

             var embeddingSimilarity = cosineSimilarity(searchTermEmbeddings[i], adGroupEmbedding);
             var bm25Score = computeBM25Score(st, adGroupNameClean);
             var finalScore = EMBEDDING_WEIGHT * embeddingSimilarity + BM25_WEIGHT * bm25Score;
             var reason = "Embedding: " + embeddingSimilarity.toFixed(4) + ", BM25: " + bm25Score.toFixed(4);

             SEARCH_TERM_MATCH_REPORT.push([
                campaignName,
                adGroupNameRaw,
                st,
                finalScore,
                reason,
                conversionValue,
                cost
             ]);

             // If embedding similarity is below 0.2, add the search term as an exact match negative keyword.
             if (embeddingSimilarity < 0.2) {
               try {
                 adGroup.createNegativeKeyword("[" + st + "]");
               } catch (e) {
                 Logger.log("Error adding negative keyword. Term: '" + st + "', Ad Group: '" + adGroupNameRaw + "', Error: " + e);
               }
             }
         }
      }
    }
  }

  flushReports();
}


/**
 * Fetches text embeddings in bulk from the OpenAI API.
 * Splits large requests into smaller chunks.
 * @param {Array<string>} texts - An array of texts to embed.
 * @return {Array<Array<number>>} An array of embedding vectors.
 */
function getEmbeddingsBulk(texts) {
  var embeddings = [];
  var chunkSize = 50; // Number of texts to process per API call.
  var url = "https://api.openai.com/v1/embeddings";

  for (var start = 0; start < texts.length; start += chunkSize) {
    var chunk = texts.slice(start, start + chunkSize);
    var cleanedTexts = chunk.map(function(text) {
      return text.replace(/\n/g, " ");
    });

    var payload = {
      input: cleanedTexts,
      model: EMBEDDING_MODEL
    };

    var options = {
      method: "post",
      contentType: "application/json",
      headers: {
        "Authorization": "Bearer " + OPENAI_API_KEY
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };

    var response = UrlFetchApp.fetch(url, options);
    var responseCode = response.getResponseCode();
    var content = response.getContentText();

    if (responseCode !== 200) {
      Logger.log("OpenAI API request failed. Status Code: " + responseCode + ", Response: " + content);
      throw new Error("OpenAI API request failed with status code " + responseCode);
    }

    var json;
    try {
      json = JSON.parse(content);
    } catch (e) {
      Logger.log("Error parsing JSON response. Content: " + content);
      throw new Error("JSON parsing error: " + e);
    }

    if (json.data && json.data.length === chunk.length) {
      embeddings = embeddings.concat(json.data.map(function(item) {
        return item.embedding;
      }));
    } else {
      throw new Error("Failed to get bulk embeddings: " + content);
    }
  }
  return embeddings;
}

/**
 * Fetches a single text embedding from the OpenAI API.
 * @param {string} text - The text to embed.
 * @return {Array<number>} The embedding vector.
 */
function getEmbedding(text) {
  text = text.replace(/\n/g, " ");
  var url = "https://api.openai.com/v1/embeddings";
  var payload = {
    input: text,
    model: EMBEDDING_MODEL
  };

  var options = {
    method: "post",
    contentType: "application/json",
    headers: {
      "Authorization": "Bearer " + OPENAI_API_KEY
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  var response = UrlFetchApp.fetch(url, options);
  var json = JSON.parse(response.getContentText());
  if (json.data && json.data.length > 0) {
    return json.data[0].embedding;
  } else {
    throw new Error("Failed to get embedding: " + response.getContentText());
  }
}

/**
 * Calculates the cosine similarity between two vectors.
 * @param {Array<number>} vec1
 * @param {Array<number>} vec2
 * @return {number} The cosine similarity score.
 */
function cosineSimilarity(vec1, vec2) {
  if (vec1.length !== vec2.length) {
    throw new Error("Vector dimensions do not match.");
  }
  var dotProduct = 0;
  var normVec1 = 0;
  var normVec2 = 0;
  for (var i = 0; i < vec1.length; i++) {
    dotProduct += vec1[i] * vec2[i];
    normVec1 += vec1[i] * vec1[i];
    normVec2 += vec2[i] * vec2[i];
  }
  return dotProduct / (Math.sqrt(normVec1) * Math.sqrt(normVec2));
}

/**
 * Computes a simplified BM25 score based on term overlap.
 * @param {string} queryText - The search term.
 * @param {string} docText - The ad group name.
 * @return {number} A score between 0 and 1.
 */
function computeBM25Score(queryText, docText) {
  var queryTokens = queryText.toLowerCase().split(/\s+/);
  var docTokens = docText.toLowerCase().split(/\s+/);
  var commonCount = 0;
  queryTokens.forEach(function(token) {
    if (docTokens.indexOf(token) !== -1) {
      commonCount++;
    }
  });
  return queryTokens.length > 0 ? commonCount / queryTokens.length : 0;
}

/**
 * Generates a date range string in YYYYMMDD,YYYYMMDD format.
 * @param {number} daysBack - The number of days to go back.
 * @return {string} The formatted date range.
 */
function getDateRange(daysBack) {
  var today = new Date();
  var pastDate = new Date(today.getTime() - (daysBack * 24 * 60 * 60 * 1000));

  function formatDate(date) {
    var year = date.getFullYear();
    var month = ("0" + (date.getMonth() + 1)).slice(-2);
    var day = ("0" + date.getDate()).slice(-2);
    return year + month + day;
  }

  return formatDate(pastDate) + "," + formatDate(today);
}

/**
 * Writes the search term match report to the specified Google Sheet.
 * Creates a new sheet for each execution, named with the account name and timestamp.
 */
function flushReports() {
  if (SEARCH_TERM_MATCH_REPORT.length === 0) {
    Logger.log("No search term data to report.");
    return;
  }
  
  try {
    var ss = SpreadsheetApp.openByUrl(LOG_SPREADSHEET_URL);
    var accountName = AdsApp.currentAccount().getName();
    
    // IMPORTANT: Replace "YOUR_TIMEZONE" with your timezone from the IANA Time Zone Database (e.g., "America/New_York", "Europe/London").
    var timeZone = "YOUR_TIMEZONE"; 
    var dateStr = Utilities.formatDate(new Date(), timeZone, "yyyy-MM-dd");
    var timeStr = Utilities.formatDate(new Date(), timeZone, "HH-mm-ss");
    var sheetName = accountName + "-" + dateStr + "-" + timeStr;
    var sheet = ss.insertSheet(sheetName);

    var headers = ["Campaign Name", "Ad Group Name", "Search Term", "Match Score", "Score Breakdown", "Conversion Value", "Cost"];
    sheet.appendRow(headers);

    for (var i = 0; i < SEARCH_TERM_MATCH_REPORT.length; i++) {
      sheet.appendRow(SEARCH_TERM_MATCH_REPORT[i]);
    }

    sheet.autoResizeColumns(1, headers.length);

  } catch (e) {
    Logger.log("Error writing report to Google Sheet: " + e);
  }

  // Clear the report array to prevent duplicate data in the next run.
  SEARCH_TERM_MATCH_REPORT = [];
}
