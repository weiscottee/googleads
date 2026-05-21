/**
 * 竞品词_拓词+否词_0704
 *
 * Uses Gemini to classify competitor search queries, then adds exact positives or exact negatives.
 *
 * Packaged from the user's Google Ads script library.
 * Replace placeholder values before running in Google Ads Scripts.
 */

/**
 * @OnlyCurrentAccount
 */

// =================================================================================
// 配置区域
// =================================================================================

// 1. 你的 Google AI Studio API 密钥。从 https://aistudio.google.com/app/apikey 获取
var GEMINI_API_KEY = "YOUR_GEMINI_API_KEY";

// 2. 用于记录操作的 Google Sheet 的 ID
var SPREADSHEET_ID = "YOUR_GOOGLE_SHEET_ID";

// 3. 广告系列名称必须包含的关键词（例如，用于识别竞争对手广告系列）
var CAMPAIGN_NAME_CONDITION = "YOUR_CAMPAIGN_NAME_KEYWORD";

// 4. 检索过去多少天的数据
var DAYS_BACK = 7;

// =================================================================================
// 主函数
// =================================================================================

function main() {
  if (GEMINI_API_KEY === 'YOUR_GEMINI_API_KEY') {
    throw new Error('请在脚本顶部配置你的 Gemini API 密钥 (GEMINI_API_KEY)。');
  }

  var changes = [];
  var dateRange = getDateRange(DAYS_BACK);

  var campaignIterator = AdsApp.campaigns()
    .withCondition("Name CONTAINS_IGNORE_CASE '" + CAMPAIGN_NAME_CONDITION + "'")
    .get();

  while (campaignIterator.hasNext()) {
    var campaign = campaignIterator.next();
    Logger.log('正在处理广告系列: ' + campaign.getName());

    var adGroupIterator = campaign.adGroups().get();
    while (adGroupIterator.hasNext()) {
      var adGroup = adGroupIterator.next();
      var adGroupName = adGroup.getName().toLowerCase().trim();
      Logger.log('  正在处理广告组: ' + adGroup.getName());

      var existingPositives = getKeywords(adGroup, "KeywordMatchType = EXACT");
      var existingNegatives = getKeywords(adGroup, "MatchType = EXACT", true);

      var queriesToAnalyze = [];
      var uniqueQueries = new Set();

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
        var queryText = row['Query'].toLowerCase().trim();

        if (existingPositives.has(queryText) || existingNegatives.has(queryText) || uniqueQueries.has(queryText)) {
          continue;
        }

        queriesToAnalyze.push(queryText);
        uniqueQueries.add(queryText);
      }

      if (queriesToAnalyze.length === 0) {
        Logger.log('    广告组 "' + adGroup.getName() + '" 没有新的搜索词需要分析。');
        continue;
      }

      Logger.log('    准备将 ' + queriesToAnalyze.length + ' 个搜索词发送给 Gemini 进行分析...');
      var classifications = classifyQueriesWithGemini(queriesToAnalyze, adGroupName);

      if (!classifications) {
        Logger.log('    Gemini API 调用失败或返回空结果，跳过此广告组。');
        continue;
      }

      Logger.log('    已收到 Gemini 的分析结果，正在处理...');

      for (var queryText in classifications) {
        // 确保我们只处理对象自身的属性，而不是原型链上的
        if (!classifications.hasOwnProperty(queryText)) {
            continue;
        }

        var classification = classifications[queryText];

        if (classification === 'variant') {
          if (!existingPositives.has(queryText)) {
            adGroup.newKeywordBuilder().withText('[' + queryText + ']').build();
            Logger.log("      [正向] 已添加: [" + queryText + "]");
            changes.push([queryText, "", adGroup.getName()]);
            existingPositives.add(queryText);
          }
        } else {
          var adGroupWords = adGroupName.split(/\s+/);
          var shouldAddNegative = false;
          if (adGroupWords.length >= 2) {
             if (!adGroupWords.some(word => queryText.includes(word))) {
                shouldAddNegative = true;
             }
          } else {
             if (!queryText.includes(adGroupName)) {
                shouldAddNegative = true;
             }
          }

          if (shouldAddNegative && !existingNegatives.has(queryText)) {
            adGroup.createNegativeKeyword('[' + queryText + ']');
            Logger.log("      [否定] 已添加: [" + queryText + "]");
            changes.push(["", queryText, adGroup.getName()]);
            existingNegatives.add(queryText);
          }
        }
      }
    }
  }

  exportChangesToSheet(SPREADSHEET_ID, changes);
}

/**
 * 使用 Gemini API 批量判断一组搜索词是否为广告组名称的变体。
 * @param {string[]} queries - 需要分析的搜索词数组。
 * @param {string} adGroupName - 用于比较的广告组名称。
 * @return {Object|null} - 返回一个对象，键是搜索词，值是 'variant' 或 'not_variant'。失败则返回 null。
 */
function classifyQueriesWithGemini(queries, adGroupName) {
  var endpoint = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro-latest:generateContent?key=" + GEMINI_API_KEY;

  var prompt = `
    你是一个谷歌广告专家。你的任务是判断一个搜索词列表中的每个词是否包含给定的“广告组名称”的变体。

    变体的定义：
    1.  拼写错误或非常相近的拼写（例如 "sofa" vs "sofà"）。
    2.  单复数形式（例如 "chair" vs "chairs"）。
    3.  缩写或简写（例如 "television" vs "tv"）。
    4.  同义词或紧密相关的词（例如 "couch" vs "sofa"）。

    广告组名称: "${adGroupName}"

    请分析以下搜索词列表：
    ${JSON.stringify(queries)}

    你的回答必须是一个纯粹的 JSON 对象，不包含任何其他文字或代码块标记。
    JSON 对象的键是原始搜索词，值是以下两个字符串之一：
    - "variant"：如果该词是广告组名称的变体。
    - "not_variant"：如果该词不是变体。

    示例输出格式：
    {
      "search term 1": "variant",
      "search term 2": "not_variant",
      "search term 3": "variant"
    }
  `;

  var payload = {
    "contents": [{"parts": [{"text": prompt}]}],
    "generationConfig": {
      "responseMimeType": "application/json",
      "temperature": 0.2,
      "maxOutputTokens": 8192,
    }
  };

  var options = {
    'method': 'post',
    'contentType': 'application/json',
    'payload': JSON.stringify(payload),
    'muteHttpExceptions': true
  };

  try {
    var response = UrlFetchApp.fetch(endpoint, options);
    var responseCode = response.getResponseCode();
    var responseText = response.getContentText();

    if (responseCode === 200) {
      // **关键修正点**
      var fullResponse = JSON.parse(responseText);

      // 安全地从API的完整响应结构中提取出我们需要的JSON字符串
      // 路径: response -> candidates -> [0] -> content -> parts -> [0] -> text
      var jsonText = fullResponse?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (jsonText) {
        // 再次解析，这次得到的是我们真正需要的 { "搜索词": "分类", ... } 对象
        return JSON.parse(jsonText);
      } else {
        Logger.log('Gemini API 错误：无法在响应中找到预期的 JSON 内容。响应全文: ' + responseText);
        return null;
      }
    } else {
      Logger.log('Gemini API 错误。状态码: ' + responseCode + '。响应: ' + responseText);
      return null;
    }
  } catch (e) {
    Logger.log('调用或解析 Gemini API 时发生异常: ' + e.toString());
    return null;
  }
}

/**
 * 获取指定广告组的关键词列表。
 * @param {AdsApp.AdGroup} adGroup - Google Ads 广告组对象。
 * @param {string} condition - 用于筛选关键词的条件字符串。
 * @param {boolean} [isNegative=false] - 是否获取否定关键词。
 * @return {Set<string>} - 包含关键词文本的 Set 集合，便于快速查找。
 */
function getKeywords(adGroup, condition, isNegative) {
  var keywordSet = new Set();
  var iterator = isNegative
    ? adGroup.negativeKeywords().withCondition(condition).get()
    : adGroup.keywords().withCondition(condition).get();

  while (iterator.hasNext()) {
    var keyword = iterator.next();
    var text = keyword.getText().replace(/^\[|\]$/g, '').toLowerCase();
    keywordSet.add(text);
  }
  return keywordSet;
}

/**
 * 生成日期范围字符串，格式为 YYYYMMDD,YYYYMMDD
 * @param {number} daysBack - 向前推的天数
 * @return {string} - 日期范围字符串
 */
function getDateRange(daysBack) {
  var today = new Date();
  var pastDate = new Date(today.getTime() - (daysBack * 24 * 60 * 60 * 1000));

  var formatDate = function(date) {
    return Utilities.formatDate(date, AdsApp.currentAccount().getTimeZone(), 'yyyyMMdd');
  };

  return formatDate(pastDate) + "," + formatDate(today);
}

/**
 * 将所有新增的关键词信息导出到指定 Google Sheet。
 * @param {string} spreadsheetId - 目标Sheet的ID
 * @param {Array<Array<string>>} changes - 二维数组，每一行 [正向关键词, 否定关键词, 广告组名称]
 */
function exportChangesToSheet(spreadsheetId, changes) {
  if (!changes || changes.length === 0) {
    Logger.log("没有新增的关键词信息，不执行导出操作。");
    return;
  }

  var accountName = AdsApp.currentAccount().getName();
  var dateString = Utilities.formatDate(new Date(), AdsApp.currentAccount().getTimeZone(), "yyyy-MM-dd");
  var sheetName = accountName + "_" + dateString;

  try {
    var spreadsheet = SpreadsheetApp.openById(spreadsheetId);
    var sheet = spreadsheet.getSheetByName(sheetName);
    if (!sheet) {
      sheet = spreadsheet.insertSheet(sheetName, 0);
      sheet.appendRow(["正向关键词(Exact)", "否定关键词(Exact)", "广告组名称"]);
      sheet.getRange("A1:C1").setFontWeight("bold").setBackground("#d9ead3");
      sheet.setFrozenRows(1);
    }

    sheet.getRange(sheet.getLastRow() + 1, 1, changes.length, 3).setValues(changes);
    sheet.autoResizeColumns(1, 3);

    Logger.log("成功将 " + changes.length + " 条变更导出到 Google Sheet: '" + sheetName + "'");
  } catch(e) {
    Logger.log("导出到 Google Sheet 失败: " + e.toString());
  }
}
