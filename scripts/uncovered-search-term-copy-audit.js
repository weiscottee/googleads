/**
 * 文案优化_一键查找未覆盖搜索词
 *
 * Finds converting search terms that are not covered in ad copy for copy optimization.
 *
 * Packaged from the user's Google Ads script library.
 * Replace placeholder values before running in Google Ads Scripts.
 */

/*******************************
 * 配置项
 *******************************/

// 1) 只处理名称里包含此字符串的广告系列
var CAMPAIGN_NAME_CONDITION = "YOUR_CAMPAIGN_NAME_KEYWORD";

// 2) 回溯天数（此处改为 60 天）
var DAYS_BACK = 60;

// 3) 指定日志输出的 Google Sheet 链接
var SPREADSHEET_URL = "YOUR_GOOGLE_SHEET_URL";

/*******************************
 * 全局数据存储
 *******************************/

// 用于存储最终要输出到 Sheet 的数据：
// 每行存储 [CampaignName, AdGroupName, SearchTerm(TitleCase), 是否包含, ConversionValue, Cost, Conversions]
var OUTPUT_DATA = [];

/*******************************
 * 主函数
 *******************************/
function main() {
  // 获取最近 N 天的时间范围，格式如 "20230101,20230131"
  var dateRange = getDateRange(DAYS_BACK);

  // 获取已启用，且名称中包含指定字符串的广告系列
  var campaignIterator = AdsApp
    .campaigns()
    .withCondition("Status = ENABLED")
    .withCondition("Name CONTAINS_IGNORE_CASE '" + CAMPAIGN_NAME_CONDITION + "'")
    .get();

  if (!campaignIterator.hasNext()) {
    Logger.log("未找到符合条件的启用广告系列，脚本结束。");
    return;
  }

  while (campaignIterator.hasNext()) {
    var campaign = campaignIterator.next();
    var campaignName = campaign.getName();
    Logger.log("开始处理广告系列: " + campaignName);

    // 获取该广告系列下所有【启用】的广告组
    var adGroupIterator = campaign
      .adGroups()
      .withCondition("Status = ENABLED")
      .get();

    if (!adGroupIterator.hasNext()) {
      Logger.log("广告系列 [" + campaignName + "] 下无启用广告组，跳过。");
      continue;
    }

    while (adGroupIterator.hasNext()) {
      var adGroup = adGroupIterator.next();
      var adGroupName = adGroup.getName();
      var adGroupId = adGroup.getId();
      Logger.log("-- 处理广告组: " + adGroupName + " (ID=" + adGroupId + ")");

      // 1) 提取过去 60 天 Conversion > 0 的搜索词及其指标
      var convertingSearchTerms = getConvertingSearchTerms(
        campaign.getId(),
        adGroupId,
        dateRange
      );

      if (convertingSearchTerms.length === 0) {
        Logger.log("---- 无 Conversion > 0 的搜索词，跳过。");
        continue;
      }

      // 2) 获取该广告组已启用广告的“文案汇总”
      var adTextsCombined = getAdGroupTexts(adGroup);

      // 3) 依次判断搜索词是否在广告文案中出现
      for (var i = 0; i < convertingSearchTerms.length; i++) {
        var termData = convertingSearchTerms[i];
        var sTerm = termData.query;
        var sTermLower = sTerm.toLowerCase();

        // 检查是否包含
        var isIncluded = adTextsCombined.some(function(text) {
          return text.toLowerCase().indexOf(sTermLower) !== -1;
        });

        // 对搜索词做 Title Case 转换，然后存储
        var row = [
          campaignName,
          adGroupName,
          toTitleCase(sTerm),             // 搜索词（Title Case）
          isIncluded ? "包含" : "未包含",
          termData.conversionValue,       // Conversion Value
          termData.cost,                  // Cost
          termData.conversions            // Conversions
        ];
        OUTPUT_DATA.push(row);
      }
    }
  }

  // 所有广告系列处理完后，统一写出到 Google Sheet
  flushToSheet();
  Logger.log("=== 脚本执行完毕 ===");
}

/*******************************
 * 辅助函数
 *******************************/

/**
 * 返回 "YYYYMMDD,YYYYMMDD" 格式的最近 N 天日期区间
 */
function getDateRange(daysBack) {
  var today = new Date();
  var past = new Date(today.getTime() - daysBack * 24 * 3600 * 1000);

  function format(date) {
    var y = date.getFullYear();
    var m = ("0" + (date.getMonth() + 1)).slice(-2);
    var d = ("0" + date.getDate()).slice(-2);
    return y + m + d;
  }

  return format(past) + "," + format(today);
}

/**
 * 获取指定 CampaignId + AdGroupId 下、在给定日期范围内
 * Conversions > 0 的搜索词列表及其指标（聚合重复搜索词）
 */
function getConvertingSearchTerms(campaignId, adGroupId, dateRange) {
  var termMap = {};
  var awql = "SELECT Query, Conversions, ConversionValue, Cost " +
             "FROM SEARCH_QUERY_PERFORMANCE_REPORT " +
             "WHERE CampaignId = " + campaignId + " " +
             "AND AdGroupId = " + adGroupId + " " +
             "AND Conversions > 0 " +
             "DURING " + dateRange;

  var report = AdsApp.report(awql);
  var rows = report.rows();
  while (rows.hasNext()) {
    var row = rows.next();
    var query = row["Query"].trim();
    var queryLower = query.toLowerCase(); // 用于聚合
    var conversions = parseFloat(row["Conversions"]);
    var conversionValue = parseFloat(row["ConversionValue"]);
    var cost = parseFloat(row["Cost"]);

    if (!termMap[queryLower]) {
      termMap[queryLower] = {
        query: query, // 保留首次遇到的查询词形式
        conversions: 0,
        conversionValue: 0,
        cost: 0
      };
    }
    termMap[queryLower].conversions += conversions;
    termMap[queryLower].conversionValue += conversionValue;
    termMap[queryLower].cost += cost;
  }

  // 转换为数组
  var results = [];
  for (var key in termMap) {
    results.push(termMap[key]);
  }
  return results;
}

/**
 * 获取一个广告组内所有“启用广告”的文案拼接
 */
function getAdGroupTexts(adGroup) {
  var texts = [];
  var adsIterator = adGroup
    .ads()
    .withCondition("Status = ENABLED")
    .get();

  while (adsIterator.hasNext()) {
    var ad = adsIterator.next();
    var adType = ad.getType();
    var combinedText = "";
    if (adType === "EXPANDED_TEXT_AD") {
      var eta = ad.asType().expandedTextAd();
      combinedText =
        (eta.getHeadlinePart1() || "") +
        " " +
        (eta.getHeadlinePart2() || "") +
        " " +
        (eta.getHeadlinePart3() || "") +
        " " +
        (eta.getDescription() || "") +
        " " +
        (eta.getDescription2() || "");
    } else if (adType === "RESPONSIVE_SEARCH_AD") {
      var rsa = ad.asType().responsiveSearchAd();
      var headlines = rsa.getHeadlines();
      var descs = rsa.getDescriptions();
      var hText = headlines
        .map(function(h) {
          return h.text || (h.asset && h.asset.text) || "";
        })
        .join(" ");
      var dText = descs
        .map(function(d) {
          return d.text || (d.asset && d.asset.text) || "";
        })
        .join(" ");
      combinedText = hText + " " + dText;
    } else if (adType === "TEXT_AD") {
      var textAd = ad.asType().textAd();
      combinedText =
        (textAd.getHeadline() || "") +
        " " +
        (textAd.getDescription1() || "") +
        " " +
        (textAd.getDescription2() || "");
    }

    if (combinedText.trim()) {
      texts.push(combinedText.trim());
    }
  }

  return texts;
}

/**
 * 将字符串的每个单词首字母转大写、后续字母转小写
 */
function toTitleCase(str) {
  return str.replace(/\w\S*/g, function(word) {
    return word.charAt(0).toUpperCase() + word.substring(1).toLowerCase();
  });
}

/**
 * 将 OUTPUT_DATA 中的内容写入到指定的 Google Sheet
 */
function flushToSheet() {
  if (OUTPUT_DATA.length === 0) {
    Logger.log("无数据可写入 Google Sheet。");
    return;
  }

  try {
    var spreadsheet = SpreadsheetApp.openByUrl(SPREADSHEET_URL);
    var accountName = AdsApp.currentAccount().getName();
    var dateStr = Utilities.formatDate(new Date(), "Asia/Shanghai", "yyyy-MM-dd_HH:mm:ss");
    var sheetName = accountName + "_" + dateStr;

    var sheet = spreadsheet.insertSheet(sheetName);

    // 写表头
    var header = ["Campaign", "Ad Group", "Search Term", "是否包含", "Conversion Value", "Cost", "Conversions"];
    sheet.appendRow(header);

    // 写数据行
    for (var i = 0; i < OUTPUT_DATA.length; i++) {
      sheet.appendRow(OUTPUT_DATA[i]);
    }

    // 冻结首行
    sheet.setFrozenRows(1);

    // 获取实际数据最后一行
    var lastRow = sheet.getLastRow();

    // 高亮第三列 (Search Term)
    var rangeToHighlight = sheet.getRange(1, 3, lastRow, 1);
    rangeToHighlight.setBackground("#ffff99");

    // 调整列宽
    sheet.autoResizeColumns(1, 7); // 现在有7列

    // 自动适应行距
    sheet.autoResizeRows(1, lastRow);

    // 启用筛选功能
    sheet.getDataRange().createFilter();

    Logger.log("数据已成功写入到表: " + sheetName);
  } catch (e) {
    Logger.log("写入 Google Sheet 出错: " + e);
  }

  // 清空 OUTPUT_DATA
  OUTPUT_DATA = [];
}
