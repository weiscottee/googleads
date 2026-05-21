/**
 * 一键查询有出单的否定词
 *
 * Finds converting search terms that are currently exact negative keywords.
 *
 * Packaged from the user's Google Ads script library.
 * Replace placeholder values before running in Google Ads Scripts.
 */

/*******************************
 * 配置项
 *******************************/
var CAMPAIGN_NAME_CONDITION = "YOUR_CAMPAIGN_NAME_KEYWORD"; // 例如："function"或其它关键词，用于匹配广告系列名称
var DAYS_BACK = 60; // 回溯前60天
var REPORT_SPREADSHEET_URL = "YOUR_GOOGLE_SHEET_URL";  // 请替换为你的 Google Sheet 链接

// 全局数组，用于存储符合条件的搜索词报告
var REPORT_DATA = [];

// 日志数组
var LOG_MESSAGES = [];

/**
 * 主函数
 */
function main() {
  var dateRange = getDateRange(DAYS_BACK);

  // 获取状态为启用且名称包含指定关键词的广告系列
  var campaignIterator = AdsApp.campaigns()
    .withCondition("Status = ENABLED")
    .withCondition("Name CONTAINS_IGNORE_CASE '" + CAMPAIGN_NAME_CONDITION + "'")
    .get();

  if (!campaignIterator.hasNext()) {
    addLog("未找到匹配的广告系列，脚本结束。");
    return;
  }

  // 遍历所有符合条件的广告系列
  while (campaignIterator.hasNext()) {
    var campaign = campaignIterator.next();
    var campaignName = campaign.getName().trim();

    // 遍历该广告系列内所有启用的广告组
    var adGroupIterator = campaign.adGroups()
      .withCondition("Status = ENABLED")
      .get();
    while (adGroupIterator.hasNext()) {
      var adGroup = adGroupIterator.next();
      var adGroupName = adGroup.getName().trim();

      // 获取当前广告组内的精确匹配否定关键词（去掉中括号、转为小写）
      var existingNegatives = getExistingExactNegatives(adGroup);

      // 查询转换大于0的搜索词报告
      var query = "SELECT Query, ConversionValue, Cost, Conversions " +
                  "FROM SEARCH_QUERY_PERFORMANCE_REPORT " +
                  "WHERE CampaignId = " + campaign.getId() + " " +
                  "AND AdGroupId = " + adGroup.getId() + " " +
                  "AND Conversions > 0 " +
                  "DURING " + dateRange;
      var report = AdsApp.report(query);
      var rows = report.rows();

      while (rows.hasNext()) {
        var row = rows.next();
        var searchQuery = row["Query"].trim();
        var searchQueryLower = searchQuery.toLowerCase();

        // 如果否定关键词列表中存在与搜索词完全相同的记录，则记录该搜索词数据
        if (existingNegatives.indexOf(searchQueryLower) !== -1) {
          REPORT_DATA.push([
            campaignName,
            adGroupName,
            searchQuery,
            row["ConversionValue"],
            row["Cost"],
            row["Conversions"]
          ]);
          addLog("匹配到搜索词 [" + searchQuery + "] 与否定关键词一致，广告组: " + adGroupName);
        }
      }
    }
  }

  // 将报告数据写入到指定的 Google Sheet，并进行格式处理（高亮第三列）
  flushReport();
}

/**
 * 获取指定天数的日期区间，格式为 "YYYYMMDD,YYYYMMDD"
 * @param {number} daysBack - 回溯天数
 * @return {string}
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
 * 获取广告组内所有精确匹配否定关键词（去掉中括号并转为小写）
 * @param {AdGroup} adGroup
 * @return {Array<string>}
 */
function getExistingExactNegatives(adGroup) {
  var negatives = [];
  var negIterator = adGroup.negativeKeywords()
    .withCondition("MatchType = EXACT")
    .get();
  while (negIterator.hasNext()) {
    var neg = negIterator.next();
    var negText = neg.getText().replace(/^\[|\]$/g, "").toLowerCase();
    negatives.push(negText);
  }
  return negatives;
}

/**
 * 将报告数据写入指定的 Google Sheet，并进行格式处理（高亮第三列）
 */
function flushReport() {
  try {
    var ss = SpreadsheetApp.openByUrl(REPORT_SPREADSHEET_URL);
    var accountName = AdsApp.currentAccount().getName();
    var dateStr = Utilities.formatDate(new Date(), "Asia/Shanghai", "yyyy-MM-dd");
    var sheetName = accountName + "-" + dateStr;

    // 新建工作表（注意：若同名工作表已存在，insertSheet会报错）
    var sheet = ss.insertSheet(sheetName);

    // 写入标题行（第一列：广告系列，第二列：广告组，第三列：搜索词，
    // 第四列：Conversion Value，第五列：Cost，第六列：Conversions）
    sheet.appendRow(["广告系列", "广告组", "搜索词", "Conversion Value", "Cost", "Conversions"]);

    // 写入报告数据
    for (var i = 0; i < REPORT_DATA.length; i++) {
      sheet.appendRow(REPORT_DATA[i]);
    }

    var lastRow = sheet.getLastRow();
    // 高亮第三列（搜索词列），示例中使用淡黄色背景
    var range = sheet.getRange(1, 3, lastRow, 1);
    range.setBackground("#ffff99");

    // 自动调整前6列的列宽
    sheet.autoResizeColumns(1, 6);

    addLog("报告已成功写入到工作表: " + sheetName);
  } catch (e) {
    addLog("写入Google Sheet时出错: " + e);
  }
}

/**
 * 记录日志信息
 * @param {string} message
 */
function addLog(message) {
  LOG_MESSAGES.push(message);
  Logger.log(message);
}
