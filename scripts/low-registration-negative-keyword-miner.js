/**
 * 行业词_否词_低注册词
 *
 * Finds low-registration search terms and exports negative keyword candidates.
 *
 * Packaged from the user's Google Ads script library.
 * Replace placeholder values before running in Google Ads Scripts.
 */

// =================== 参数设置 ===================
var CAMPAIGN_NAME_CONDITION = "YOUR_CAMPAIGN_NAME_KEYWORD";   // 广告系列名称中包含 "function"
var DAYS_BACK = 80;                         // 回溯50天
var LOG_SPREADSHEET_URL = "YOUR_GOOGLE_SHEET_URL";  // 请替换为你的 Google Sheet 链接

// 全局数组：存储日志信息与否定关键词报告
var LOG_MESSAGES = [];
// 每个元素格式：[Campaign, Ad Group, Search Term, Search Term AllConvRate]
var NEGATIVE_KEYWORD_REPORT = [];

// =================== 主函数 ===================
function main() {
  // 获取日期区间字符串，格式为 "YYYYMMDD,YYYYMMDD"
  var dateRange = getDateRange(DAYS_BACK);
  // 拆分出起始日期与结束日期（用于报告查询）
  var dateParts = dateRange.split(",");
  var startDate = dateParts[0];
  var endDate = dateParts[1];

  // —— 1. 筛选出所有启用且名称中含有 "function" 的广告系列 ——
  var campaignIterator = AdsApp.campaigns()
    .withCondition("Status = ENABLED")
    .withCondition("Name CONTAINS_IGNORE_CASE '" + CAMPAIGN_NAME_CONDITION + "'")
    .get();

  if (!campaignIterator.hasNext()) {
    addLog("未找到名称中含有 '" + CAMPAIGN_NAME_CONDITION + "' 的启用广告系列，脚本结束。");
    flushLogsAndReports();
    return;
  }

  // 依次处理每个符合条件的广告系列
  while (campaignIterator.hasNext()) {
    var campaign = campaignIterator.next();
    var campaignName = campaign.getName().trim();
    addLog("开始处理广告系列: " + campaignName);

    // —— 2. 查询整个广告系列内转换数大于0的关键词，采用加权平均计算平均 All Conversion Rate ——
    var kwQuery = "SELECT Clicks, AllConversions " +
                  "FROM KEYWORDS_PERFORMANCE_REPORT " +
                  "WHERE CampaignId = " + campaign.getId() + " " +
                  "AND Conversions > 0 " +
                  "DURING " + dateRange;
    var kwReport = AdsApp.report(kwQuery);
    var kwRows = kwReport.rows();

    var totalClicks = 0;
    var totalAllConversions = 0;

    while (kwRows.hasNext()) {
      var row = kwRows.next();
      var clicks = parseFloat(row["Clicks"]);
      var allConversions = parseFloat(row["AllConversions"]) || 0;
      totalClicks += clicks;
      totalAllConversions += allConversions;
    }

    if (totalClicks === 0) {
      addLog("广告系列 " + campaignName + " 内无转换数大于0的关键词，跳过该广告系列搜索词处理。");
      continue;
    }

    // 计算加权平均 All Conversion Rate
    var campaignAvgConvRate = totalAllConversions / totalClicks;
    addLog("广告系列 " + campaignName + " 平均 All Conversion Rate: " + campaignAvgConvRate);

    // —— 3. 遍历该广告系列中所有启用的广告组 ——
    var adGroupIterator = campaign.adGroups()
      .withCondition("Status = ENABLED")
      .get();

    while (adGroupIterator.hasNext()) {
      var adGroup = adGroupIterator.next();
      var adGroupNameRaw = adGroup.getName().trim();
      var adGroupName = adGroupNameRaw.toLowerCase();

      // 如果广告组名称中含 "broad" 或 "核心"，则跳过该广告组
      if (adGroupName.indexOf("broad") !== -1 || adGroupName.indexOf("核心") !== -1) {
        addLog("跳过广告组: " + adGroupNameRaw);
        continue;
      }

      // —— 4. 查询该广告组的搜索词报告 ——
      // 增加字段 Conversions，条件：曝光数 > 1，QueryTargetingStatus = 'NONE'
      var stQuery = "SELECT Query, Clicks, AllConversions, Conversions, QueryTargetingStatus " +
                    "FROM SEARCH_QUERY_PERFORMANCE_REPORT " +
                    "WHERE CampaignId = " + campaign.getId() + " " +
                    "AND AdGroupId = " + adGroup.getId() + " " +
                    "AND Clicks > 6 " +
                    "AND QueryTargetingStatus = 'NONE' " +
                    "DURING " + dateRange;
      var stReport = AdsApp.report(stQuery);
      var stRows = stReport.rows();

      // 获取当前广告组内已存在的精确匹配否定关键词，防止重复添加
      var existingNegatives = getExistingExactNegatives(adGroup);

      // —— 5. 根据条件筛选搜索词 ——
      // 条件1：搜索词点击数大于 (1 / campaignAvgConvRate)
      // 条件2：搜索词注册率 (stCR) 小于 (campaignAvgConvRate * 2/5)
      // 条件3：搜索词 Conversions 小于 1
      // 新增条件：点击数大于6
      while (stRows.hasNext()) {
        var stRow = stRows.next();
        var queryText = stRow["Query"].trim().toLowerCase();
        var clicks = parseFloat(stRow["Clicks"]);
        var allConv = parseFloat(stRow["AllConversions"]) || 0;
        var stCR = (clicks > 0) ? (allConv / clicks) : 0;
        var stConversions = parseFloat(stRow["Conversions"]) || 0;

        if (clicks > (1 / campaignAvgConvRate) &&
            stCR < (campaignAvgConvRate * 2 / 5) &&
            stConversions < 1 &&
            clicks > 16) {
          if (existingNegatives.indexOf(queryText) === -1) {
            try {
              adGroup.createNegativeKeyword("[" + queryText + "]");
              existingNegatives.push(queryText);
              addLog("广告组 [" + adGroupNameRaw + "] 添加否定关键词: [" + queryText + "], 点击数: " + clicks + ", 搜索词注册率: " + stCR + ", 转换数: " + stConversions);
              NEGATIVE_KEYWORD_REPORT.push([campaignName, adGroupNameRaw, queryText, stCR]);
            } catch (e) {
              addLog("添加否定关键词失败, 搜索词: " + queryText + " 错误: " + e);
            }
          } else {
            addLog("广告组 [" + adGroupNameRaw + "] 已存在否定关键词: " + queryText);
          }
        }
      } // end while 搜索词报告
    } // end while 广告组
  } // end while 广告系列

  // —— 6. 将日志和否定关键词报告写入到指定的 Google Sheet ——
  flushLogsAndReports();
}

// =================== 辅助函数 ===================

/**
 * 返回日期区间字符串，格式为 "YYYYMMDD,YYYYMMDD"
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
 * 获取广告组内所有已存在的精确匹配否定关键词（去掉方括号并转为小写）
 * @param {AdGroup} adGroup
 * @return {Array<string>}
 */
function getExistingExactNegatives(adGroup) {
  var negatives = [];
  var negIter = adGroup.negativeKeywords()
    .withCondition("MatchType = EXACT")
    .get();
  while (negIter.hasNext()) {
    var neg = negIter.next();
    var negText = neg.getText().replace(/^\[|\]$/g, "").toLowerCase();
    negatives.push(negText);
  }
  return negatives;
}

/**
 * 将日志信息保存到全局日志数组，并输出到控制台
 * @param {string} message
 */
function addLog(message) {
  LOG_MESSAGES.push(message);
  Logger.log(message);
}

/**
 * 将内存中的日志与否定关键词报告一次性写入到指定的 Google Sheet 中，
 * 并对输出表格进行排序、高亮、自动调整列宽等格式处理。
 *
 * 输出表格格式：
 *   第1列：Campaign
 *   第2列：Ad Group
 *   第3列：Search Term  —— 高亮显示该列
 *   第4列：Search Term AllConvRate
 */
function flushLogsAndReports() {
  try {
    var ss = SpreadsheetApp.openByUrl(LOG_SPREADSHEET_URL);
    var accountName = AdsApp.currentAccount().getName();
    var dateStr = Utilities.formatDate(new Date(), "Asia/Shanghai", "yyyy-MM-dd");
    var timeStr = Utilities.formatDate(new Date(), "Asia/Shanghai", "HH-mm-ss");
    var sheetName = accountName + "-" + dateStr + "-" + timeStr;

    var sheet = ss.insertSheet(sheetName);
    sheet.appendRow(["Campaign", "Ad Group", "Search Term", "Search Term AllConvRate"]);

    for (var i = 0; i < NEGATIVE_KEYWORD_REPORT.length; i++) {
      sheet.appendRow(NEGATIVE_KEYWORD_REPORT[i]);
    }

    var lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      var highlightRange = sheet.getRange(2, 3, lastRow - 1, 1);
      highlightRange.setBackground("#ffff99");  // 淡黄色高亮
    }
    sheet.autoResizeColumns(1, 4);
    Logger.log("报告已写入表格，表名：" + sheetName);
  } catch (err) {
    Logger.log("写入日志到 Google Sheet 时出错: " + err);
  }

  // 清空内存数组，避免下次执行时数据叠加
  LOG_MESSAGES = [];
  NEGATIVE_KEYWORD_REPORT = [];
}
