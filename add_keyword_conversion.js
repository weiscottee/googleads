
/**************************************************************************************************
 * AI-Powered Google Ads Keyword Harvester
 *
 * This script automates the process of finding converting search terms and adding them
 * as new keywords to the most relevant ad groups using the OpenAI API.
 *
 * VERSION: 1.0
 * AUTHOR: [Your Name or GitHub Username]
 * GITHUB: [Link to your GitHub repo]
 *
 * DISCLAIMER: This script is for educational and portfolio purposes.
 * Always test thoroughly in a non-production environment before use.
 * You are responsible for all API costs and any changes made to your account.
 **************************************************************************************************/


/********************************************************************************
 * [REQUIRED] CONFIGURATION
 * Please fill in all the details below.
 ********************************************************************************/

// The keyword that must be present in the names of the campaigns you want this script to manage.
// Example: "Brand" or "LeadGen"
var CAMPAIGN_NAME_CONDITION = "YOUR_CAMPAIGN_KEYWORD_HERE";

// The number of days back to look for converting search terms.
var DAYS_BACK = 7;

// The full URL of the Google Sheet where reports will be saved.
// Example: "https://docs.google.com/spreadsheets/d/12345abcde/edit"
var LOG_SPREADSHEET_URL = "YOUR_GOOGLE_SHEET_URL_HERE";

// Your secret API key from OpenAI.
// Example: "sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
var OPENAI_API_KEY = "YOUR_OPENAI_API_KEY_HERE";

// The OpenAI endpoint for chat completions.
var OPENAI_ENDPOINT = "https://api.openai.com/v1/chat/completions";

// The OpenAI model to use. "gpt-4o" is recommended for performance and cost.
var OPENAI_MODEL = "gpt-4o";

// The creativity of the AI's response (0 for deterministic, 1 for creative). 0 is recommended for this task.
var OPENAI_TEMPERATURE = 0;

// The maximum number of tokens for the AI's response. 30 is usually sufficient for this task.
var OPENAI_MAX_TOKENS = 30;

// The default CPC bid to set for newly created keywords. Adjust based on your strategy.
var DEFAULT_CPC_BID = 1.0;


/********************************************************************************
 * GLOBAL VARIABLES (Do not change)
 ********************************************************************************/

// Stores log messages for the final report.
var LOG_MESSAGES = [];
// Stores an array of [Campaign Name, Ad Group Name, Added Keywords] for the report.
var KEYWORD_ADDITION_REPORT = [];
// Stores newly created keyword objects to be labeled at the end.
var newlyCreatedKeywords = [];


/********************************************************************************
 * MAIN FUNCTION
 * This is the entry point of the script.
 ********************************************************************************/
function main() {
    var dateRange = getDateRange(DAYS_BACK);
    
    var campaignIterator = AdsApp.campaigns()
        .withCondition("Status = ENABLED")
        .withCondition("Name CONTAINS_IGNORE_CASE '" + CAMPAIGN_NAME_CONDITION + "'")
        .get();

    if (!campaignIterator.hasNext()) {
        addLog("No enabled campaigns found containing '" + CAMPAIGN_NAME_CONDITION + "'. Script terminated.");
        flushLogsAndReports();
        return;
    }

    while (campaignIterator.hasNext()) {
        var campaign = campaignIterator.next();
        var campaignId = campaign.getId();
        addLog("Processing Campaign: " + campaign.getName());

        var query = "SELECT Query, Conversions, CampaignId, AdGroupId " +
                    "FROM SEARCH_QUERY_PERFORMANCE_REPORT " +
                    "WHERE CampaignId = " + campaignId + " " +
                    "AND QueryTargetingStatus = 'NONE' " + // 'NONE' means the query is not a keyword yet
                    "AND Conversions > 0 " +
                    "DURING " + dateRange;

        var reportRows = AdsApp.report(query).rows();

        while (reportRows.hasNext()) {
            var row = reportRows.next();
            var searchTerm = row["Query"].trim();
            var lang = classifyLanguage(searchTerm);
            addLog("Search term: \"" + searchTerm + "\" was identified as language: " + lang);

            if (["fr", "it", "es", "de", "zh"].indexOf(lang) >= 0) {
                processLanguageSearchTerm(searchTerm, lang);
            } else {
                processOtherSearchTerm(searchTerm);
            }
        }
    }

    labelNewKeywords();
    flushLogsAndReports();
}


/********************************************************************************
 * HELPER FUNCTIONS
 ********************************************************************************/

/**
 * Generates a date range string for AWQL queries (e.g., "20250603,20250610").
 * @param {number} daysBack The number of days to go back from today.
 * @returns {string} The formatted date range.
 */
function getDateRange(daysBack) {
    var today = new Date();
    var pastDate = new Date(today.getTime() - (daysBack * 24 * 60 * 60 * 1000));
    
    function formatDate(date) {
        return Utilities.formatDate(date, AdsApp.currentAccount().getTimeZone(), "yyyyMMdd");
    }
    return formatDate(pastDate) + "," + formatDate(today);
}

/**
 * Calls the OpenAI API to classify the language of a search term.
 * @param {string} searchTerm The search term to classify.
 * @returns {string} The language code ('fr', 'it', 'es', 'de', 'zh', or 'other').
 */
function classifyLanguage(searchTerm) {
    var prompt = "Please determine the language of the following search term. Classify it as one of the following: fr, it, es, de, zh, or other. Return only the two-letter code or 'other'.\nSearch Term: \"" + searchTerm + "\"";
    
    var requestBody = {
        model: OPENAI_MODEL,
        messages: [
            { role: "system", content: "You are a language detection assistant. You only return the language code for a given search term." },
            { role: "user", content: prompt }
        ],
        temperature: OPENAI_TEMPERATURE,
        max_tokens: OPENAI_MAX_TOKENS
    };

    var response = fetchOpenAI(requestBody);
    if (response) {
        var content = response.choices[0].message.content.trim().toLowerCase();
        var validLangs = ["fr", "it", "es", "de", "zh"];
        if (validLangs.indexOf(content) >= -1) {
            return content;
        }
    }
    return "other";
}

/**
 * Processes a search term identified as a specific, non-English language.
 * @param {string} searchTerm The search term.
 * @param {string} lang The language code.
 */
function processLanguageSearchTerm(searchTerm, lang) {
    var campaignIterator = AdsApp.campaigns()
        .withCondition("Status = ENABLED")
        .withCondition("Name CONTAINS_IGNORE_CASE '" + CAMPAIGN_NAME_CONDITION + "'")
        .withCondition("Name CONTAINS_IGNORE_CASE '" + lang + "'")
        .get();
    
    var adGroupsAndNames = getAdGroupsFromCampaigns(campaignIterator);
    if (adGroupsAndNames.names.length === 0) {
        addLog("No enabled ad groups found for language: " + lang);
        return;
    }

    var bestMatchName = getBestMatchAdGroupName(searchTerm, adGroupsAndNames.names);
    addLog("For search term \"" + searchTerm + "\", best matching ad group name is: " + bestMatchName);
    
    var targetAdGroups = adGroupsAndNames.map[bestMatchName] || [];
    targetAdGroups.forEach(function(adGroup) {
        var addedKeywords = addKeywordsToAdGroup(adGroup, searchTerm);
        if (addedKeywords) {
            KEYWORD_ADDITION_REPORT.push([adGroup.getCampaign().getName(), adGroup.getName(), addedKeywords]);
        }
    });
}

/**
 * Processes a search term identified as 'other' (typically English or unspecified).
 * @param {string} searchTerm The search term.
 */
function processOtherSearchTerm(searchTerm) {
    var campaignIterator = AdsApp.campaigns()
        .withCondition("Status = ENABLED")
        .withCondition("Name CONTAINS_IGNORE_CASE '" + CAMPAIGN_NAME_CONDITION + "'")
        .withCondition("Name DOES_NOT_CONTAIN_IGNORE_CASE 'fr'")
        .withCondition("Name DOES_NOT_CONTAIN_IGNORE_CASE 'it'")
        .withCondition("Name DOES_NOT_CONTAIN_IGNORE_CASE 'es'")
        .withCondition("Name DOES_NOT_CONTAIN_IGNORE_CASE 'de'")
        .withCondition("Name DOES_NOT_CONTAIN_IGNORE_CASE 'zh'")
        .get();

    var adGroupsAndNames = getAdGroupsFromCampaigns(campaignIterator);
    if (adGroupsAndNames.names.length === 0) {
        addLog("No enabled ad groups found for 'other' language campaigns.");
        return;
    }

    var bestMatchName = getBestMatchAdGroupName(searchTerm, adGroupsAndNames.names);
    addLog("For 'other' search term \"" + searchTerm + "\", best matching ad group name is: " + bestMatchName);

    var targetAdGroups = adGroupsAndNames.map[bestMatchName] || [];
    targetAdGroups.forEach(function(adGroup) {
        var addedKeywords = addKeywordsToAdGroup(adGroup, searchTerm);
        if (addedKeywords) {
            KEYWORD_ADDITION_REPORT.push([adGroup.getCampaign().getName(), adGroup.getName(), addedKeywords]);
        }
    });
}

/**
 * Calls OpenAI to find the best ad group name from a list that matches the search term's intent.
 * @param {string} searchTerm The user's search query.
 * @param {string[]} adGroupNames A list of candidate ad group names.
 * @returns {string} The best matching ad group name from the list.
 */
function getBestMatchAdGroupName(searchTerm, adGroupNames) {
    var listStr = adGroupNames.join(", ");
    var prompt = "From the following list of ad group names: [" + listStr + "].\n" +
                 "Which ad group name is the best semantic match for the search term: \"" + searchTerm + "\"?\n" +
                 "Please return only the best matching ad group name from the list, exactly as it appears in the list.";

    var requestBody = {
        model: OPENAI_MODEL,
        messages: [
            { role: "system", content: "You are a semantic matching assistant. Your task is to match a user's search term to the most relevant ad group from a provided list." },
            { role: "user", content: prompt }
        ],
        temperature: OPENAI_TEMPERATURE,
        max_tokens: OPENAI_MAX_TOKENS
    };

    var response = fetchOpenAI(requestBody);
    if (response) {
        var content = response.choices[0].message.content.trim().toLowerCase();
        // Check if the response is a valid ad group name
        for (var i = 0; i < adGroupNames.length; i++) {
            if (content.indexOf(adGroupNames[i]) !== -1) {
                return adGroupNames[i];
            }
        }
    }
    // Fallback to the first ad group name if AI fails or returns an invalid name
    addLog("AI failed to return a valid ad group name. Defaulting to first option.");
    return adGroupNames[0];
}

/**
 * Adds a search term as both an [Exact Match] and "Phrase Match" keyword to an ad group.
 * @param {object} adGroup The AdsApp.AdGroup object.
 * @param {string} searchTerm The term to add as a keyword.
 * @returns {string} A comma-separated string of the keywords that were successfully added.
 */
function addKeywordsToAdGroup(adGroup, searchTerm) {
    var added = [];
    var normalizedTerm = searchTerm.toLowerCase();
    var existingKeywords = getExistingKeywords(adGroup);

    // Add exact match keyword
    if (existingKeywords.exact.indexOf(normalizedTerm) === -1) {
        var opExact = adGroup.newKeywordBuilder()
            .withText("[" + searchTerm + "]")
            .withCpc(DEFAULT_CPC_BID)
            .build();
        if (opExact.isSuccessful()) {
            newlyCreatedKeywords.push(opExact.getResult());
            added.push("[" + searchTerm + "]");
            addLog("Added [Exact Match] keyword to Ad Group '" + adGroup.getName() + "': [" + searchTerm + "]");
        } else {
            addLog("Failed to add [Exact Match] keyword: " + opExact.getErrors().join(", "));
        }
    }

    // Add phrase match keyword
    if (existingKeywords.phrase.indexOf(normalizedTerm) === -1) {
        var opPhrase = adGroup.newKeywordBuilder()
            .withText('"' + searchTerm + '"')
            .withCpc(DEFAULT_CPC_BID)
            .build();
        if (opPhrase.isSuccessful()) {
            newlyCreatedKeywords.push(opPhrase.getResult());
            added.push('"' + searchTerm + '"');
            addLog("Added \"Phrase Match\" keyword to Ad Group '" + adGroup.getName() + "': \"" + searchTerm + "\"");
        } else {
            addLog("Failed to add \"Phrase Match\" keyword: " + opPhrase.getErrors().join(", "));
        }
    }
    
    return added.join(", ");
}

/**
 * Retrieves existing keywords from an ad group to prevent duplicates.
 * @param {object} adGroup The AdsApp.AdGroup object.
 * @returns {object} An object with two arrays: { exact: [...], phrase: [...] }.
 */
function getExistingKeywords(adGroup) {
    var existing = { exact: [], phrase: [] };
    var keywordIterator = adGroup.keywords().get();
    while (keywordIterator.hasNext()) {
        var keyword = keywordIterator.next();
        var matchType = keyword.getMatchType();
        var text = keyword.getText().toLowerCase();
        if (matchType === "EXACT") {
            existing.exact.push(text);
        } else if (matchType === "PHRASE") {
            existing.phrase.push(text);
        }
    }
    return existing;
}

/**
 * Writes the keyword addition report and logs to the specified Google Sheet.
 */
function flushLogsAndReports() {
    if (!LOG_SPREADSHEET_URL || LOG_SPREADSHEET_URL === "YOUR_GOOGLE_SHEET_URL_HERE") {
        addLog("Google Sheet URL is not configured. Skipping report generation.");
        addLog("--- SCRIPT FINISHED ---");
        return;
    }
    try {
        var ss = SpreadsheetApp.openByUrl(LOG_SPREADSHEET_URL);
        var accountName = AdsApp.currentAccount().getName();
        var sheetName = accountName + " " + Utilities.formatDate(new Date(), "GMT", "yyyy-MM-dd HH:mm");
        var sheet = ss.insertSheet(sheetName);

        sheet.appendRow(["Campaign Name", "Ad Group Name", "Keywords Added"]);
        sheet.getRange("A1:C1").setFontWeight("bold");

        KEYWORD_ADDITION_REPORT.forEach(function(row) {
            sheet.appendRow(row);
        });

        if (sheet.getLastRow() > 1) {
            sheet.getRange(2, 3, sheet.getLastRow() - 1, 1).setBackground("#ffff99"); // Highlight new keywords
        }
        sheet.autoResizeColumns(1, 3);
        
        sheet.appendRow([]); // Spacer
        sheet.appendRow(["Execution Log"]).setFontWeight("bold");
        LOG_MESSAGES.forEach(function(log) {
            sheet.appendRow([log]);
        });
        
        addLog("Report successfully written to Google Sheet: " + sheetName);
    } catch (e) {
        addLog("ERROR: Could not write to Google Sheet. Please check URL and permissions. Details: " + e);
    }
}

/**
 * Applies a date-stamped label to all keywords that were newly created in this run.
 */
function labelNewKeywords() {
    if (newlyCreatedKeywords.length === 0) {
        addLog("No new keywords were created. Skipping labeling.");
        return;
    }
    var labelName = "Converted_" + Utilities.formatDate(new Date(), AdsApp.currentAccount().getTimeZone(), "yyyyMMdd");
    var labelIterator = AdsApp.labels().withCondition("Name = '" + labelName + "'").get();
    var label;

    if (labelIterator.hasNext()) {
        label = labelIterator.next();
    } else {
        AdsApp.createLabel(labelName, "Keywords added automatically by AI script.");
        label = AdsApp.labels().withCondition("Name = '" + labelName + "'").get().next();
    }

    addLog("Applying label '" + labelName + "' to " + newlyCreatedKeywords.length + " new keywords.");
    newlyCreatedKeywords.forEach(function(keyword) {
        keyword.applyLabel(labelName);
    });
}

/**
 * Fetches enabled ad groups and their names from a campaign iterator.
 * @param {object} campaignIterator An iterator for AdsApp.Campaign objects.
 * @returns {object} An object { map: {...}, names: [...] }
 */
function getAdGroupsFromCampaigns(campaignIterator) {
    var adGroupMapping = {};
    var adGroupNames = [];
    while (campaignIterator.hasNext()) {
        var camp = campaignIterator.next();
        var adGroupIterator = camp.adGroups().withCondition("Status = ENABLED").get();
        while (adGroupIterator.hasNext()) {
            var adGroup = adGroupIterator.next();
            var agName = adGroup.getName().trim().toLowerCase();
            if (!adGroupMapping[agName]) {
                adGroupMapping[agName] = [];
                adGroupNames.push(agName);
            }
            adGroupMapping[agName].push(adGroup);
        }
    }
    return { map: adGroupMapping, names: adGroupNames };
}

/**
 * A centralized function for making requests to the OpenAI API.
 * @param {object} requestBody The JSON payload for the API request.
 * @returns {object|null} The parsed JSON response object, or null on failure.
 */
function fetchOpenAI(requestBody) {
    try {
        var options = {
            method: "post",
            muteHttpExceptions: true,
            contentType: "application/json",
            headers: { "Authorization": "Bearer " + OPENAI_API_KEY },
            payload: JSON.stringify(requestBody)
        };
        var response = UrlFetchApp.fetch(OPENAI_ENDPOINT, options);
        var responseCode = response.getResponseCode();
        var responseText = response.getContentText();

        if (responseCode === 200) {
            return JSON.parse(responseText);
        } else {
            addLog("ERROR: OpenAI API call failed. Status: " + responseCode + ", Response: " + responseText);
            return null;
        }
    } catch (e) {
        addLog("FATAL ERROR: Exception during OpenAI API call. Details: " + e);
        return null;
    }
}

/**
 * Adds a message to the global log array and prints it to the script's console.
 * @param {string} message The log message.
 */
function addLog(message) {
    var timestamp = Utilities.formatDate(new Date(), "GMT", "HH:mm:ss");
    var logEntry = timestamp + " - " + message;
    LOG_MESSAGES.push(logEntry);
    Logger.log(logEntry);
}
```
