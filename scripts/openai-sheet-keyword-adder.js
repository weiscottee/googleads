/**
 * 一键加词
 *
 * Reads keywords from a Google Sheet, uses OpenAI to map each keyword to the best ad group, then adds exact and phrase keywords.
 *
 * Packaged from the user's Google Ads script library.
 * Replace placeholder values before running in Google Ads Scripts.
 */

/*******************************
 * 全局变量 & 配置项
 *******************************/

// 存放本次脚本新建的全部关键词对象
var newlyCreatedKeywords = [];

// 需要处理的广告系列名称中包含的字符（可自行修改）
var CAMPAIGN_NAME_CONDITION = "YOUR_CAMPAIGN_NAME_KEYWORD";

// OpenAI 配置信息
var OPENAI_API_KEY = "YOUR_OPENAI_API_KEY";       // 请填入你的OpenAI API Key
var OPENAI_ENDPOINT = "https://api.openai.com/v1/chat/completions";
var OPENAI_MODEL = "gpt-4o";
var OPENAI_TEMPERATURE = 0;
var OPENAI_MAX_TOKENS = 20;

// 待处理关键词所在的 Google Sheet（通过 URL 而非 ID）
var KEYWORDS_SHEET_URL = "YOUR_GOOGLE_SHEET_URL";
// 若不是第一个工作表，请在下面 `getSheetByName('工作表名称')`
var SHEET_NAME = null;  // 若留空则默认获取首个Sheet

/*******************************
 * 主函数
 *******************************/
function main() {
  // 1) 打开存放关键词的表格，并读取所有关键词
  var spreadsheet = SpreadsheetApp.openByUrl(KEYWORDS_SHEET_URL);
  var sheet = SHEET_NAME
    ? spreadsheet.getSheetByName(SHEET_NAME)
    : spreadsheet.getSheets()[0];
  if (!sheet) {
    Logger.log("未找到指定工作表，请检查 SHEET_NAME 是否正确。");
    return;
  }

  // 读取第一列所有内容（从第2行开始，假设第1行为标题）
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    Logger.log("关键词列表为空，无需处理。");
    return;
  }
  var dataRange = sheet.getRange(2, 1, lastRow - 1, 1);
  var dataValues = dataRange.getValues();

  // 将所有“待处理”的关键词放入数组（小写以便后续匹配）
  var keywordsToProcess = [];
  for (var i = 0; i < dataValues.length; i++) {
    var kw = (dataValues[i][0] || "").trim().toLowerCase();
    if (kw) {
      keywordsToProcess.push(kw);
    }
  }
  if (keywordsToProcess.length === 0) {
    Logger.log("无有效关键词，脚本结束。");
    return;
  }

  // 2) 获取所有名称包含 CAMPAIGN_NAME_CONDITION 的广告系列
  var campaignIter = AdsApp
    .campaigns()
    .withCondition("Name CONTAINS_IGNORE_CASE '" + CAMPAIGN_NAME_CONDITION + "'")
    .get();
  if (!campaignIter.hasNext()) {
    Logger.log("未找到名称包含 '" + CAMPAIGN_NAME_CONDITION + "' 的广告系列，脚本结束。");
    return;
  }

  // 构建一个 Map：{ campaignId => { campaignName, adGroupsMap } }
  var functionCampaignsMap = buildCampaignsAdGroupMap(CAMPAIGN_NAME_CONDITION);

  // 同时收集所有广告组的名称(小写)，供 OpenAI 做“最相关”判定
  // 注意如果不同Campaign中出现了同名AdGroup，后面会根据Map中“先遇到的”进行添加。
  var allAdGroupNames = [];
  for (var cId in functionCampaignsMap) {
    if (!functionCampaignsMap.hasOwnProperty(cId)) continue;
    var adGroupsMap = functionCampaignsMap[cId].adGroupsMap;
    // 取出所有的 key (小写 AdGroup Name)
    var namesInThisCampaign = Object.keys(adGroupsMap);
    allAdGroupNames = allAdGroupNames.concat(namesInThisCampaign);
  }
  if (allAdGroupNames.length === 0) {
    Logger.log("目标广告系列下未找到任何广告组，脚本结束。");
    return;
  }

  // 3) 依次处理所有关键词
  // 用于记录最终的添加操作日志 (3列：[CampaignName, AdGroupName, Keyword])
  var logEntries = [];
  for (var k = 0; k < keywordsToProcess.length; k++) {
    var keywordText = keywordsToProcess[k];

    // 通过OpenAI来判定最匹配的广告组（在所有目标Campaign的AdGroup中）
    var bestAdGroupNameLower = getBestMatchAdGroupName(keywordText, allAdGroupNames);
    if (!bestAdGroupNameLower) {
      // 若OpenAI没给出可用的广告组，则跳过
      Logger.log("OpenAI无匹配结果，跳过关键词：" + keywordText);
      continue;
    }

    // 根据 bestAdGroupNameLower 找到对应的 AdGroup 对象（Map中第一个匹配到的即可）
    var foundAdGroupObject = findAdGroupObjectFromMap(bestAdGroupNameLower, functionCampaignsMap);
    if (!foundAdGroupObject) {
      Logger.log("在目标广告系列中未找到与名称 '" + bestAdGroupNameLower + "' 对应的广告组，跳过。");
      continue;
    }

    // 将该关键词添加到此 AdGroup （精确匹配、词组匹配）
    addKeywordToAdGroup(
      keywordText,
      foundAdGroupObject,
      logEntries
    );
  }

  // 4) 若成功添加了关键词，则把操作日志写入同个表格中新建的Sheet
  if (logEntries.length > 0) {
    appendLogsToNewSheet(spreadsheet, logEntries);
  }

  // 5) 给所有新建关键词打上“注册yyyyMMdd”的标签
  labelNewKeywords();

  Logger.log("脚本执行完毕。");
}

/**
 * 根据指定广告系列名称条件，构建一个 Map：
 * {
 *   campaignId: {
 *     campaignName: string,
 *     adGroupsMap: { adGroupNameLower: AdGroup对象 }
 *   },
 *   ...
 * }
 */
function buildCampaignsAdGroupMap(nameCondition) {
  var map = {};
  var campIter = AdsApp
    .campaigns()
    .withCondition("Name CONTAINS_IGNORE_CASE '" + nameCondition + "'")
    .get();

  while (campIter.hasNext()) {
    var c = campIter.next();
    var cId = c.getId();
    var adGroupIter = c.adGroups().get();
    var adGroupsMap = {};
    while (adGroupIter.hasNext()) {
      var ag = adGroupIter.next();
      var adGroupNameLower = ag.getName().trim().toLowerCase();
      adGroupsMap[adGroupNameLower] = ag;
    }
    map[cId] = {
      campaignName: c.getName(),
      adGroupsMap: adGroupsMap
    };
  }
  return map;
}

/**
 * 在 functionCampaignsMap 中，找到名称为 bestAdGroupNameLower 的 AdGroup 对象
 * （只取第一个匹配到的）。
 */
function findAdGroupObjectFromMap(bestAdGroupNameLower, functionCampaignsMap) {
  for (var cId in functionCampaignsMap) {
    if (!functionCampaignsMap.hasOwnProperty(cId)) continue;
    var adGroupsMap = functionCampaignsMap[cId].adGroupsMap;
    if (adGroupsMap[bestAdGroupNameLower]) {
      return adGroupsMap[bestAdGroupNameLower]; // 返回第一个匹配到的
    }
  }
  return null;
}

/**
 * 调用 OpenAI，让其在 allAdGroupNames（目标广告系列全部广告组名称）里选出“最匹配”。
 * @param {string} queryText - 关键词（小写）
 * @param {Array<string>} allAdGroupNames - 目标Campaign的所有广告组名称(小写)
 * @return {string} bestAdGroupNameLower - 最匹配的广告组名称(小写)，若无则返回空或 fallback
 */
function getBestMatchAdGroupName(queryText, allAdGroupNames) {
  if (!allAdGroupNames || allAdGroupNames.length === 0) {
    return "";
  }

  // 拼成字符串传给 OpenAI
  var listStr = allAdGroupNames.join(", ");
  var userPrompt =
    "我们有以下广告组名称：[" + listStr + "]。" +
    "\n针对关键词：\"" + queryText + "\"，请从列表中选出最强相关的那个名称，并只输出该名称（小写）。";

  var requestBody = {
    model: OPENAI_MODEL,
    messages: [
      {
        role: "system",
        content: "You are a helpful assistant that determines the best-matching ad group name from a given list."
      },
      {
        role: "user",
        content: userPrompt
      }
    ],
    temperature: OPENAI_TEMPERATURE,
    max_tokens: OPENAI_MAX_TOKENS
  };

  var options = {
    method: "post",
    muteHttpExceptions: true,
    contentType: "application/json",
    headers: {
      "Authorization": "Bearer " + OPENAI_API_KEY
    },
    payload: JSON.stringify(requestBody)
  };

  try {
    var response = UrlFetchApp.fetch(OPENAI_ENDPOINT, options);
    var jsonResponse = JSON.parse(response.getContentText());
    var content = jsonResponse.choices[0].message.content.trim().toLowerCase();

    // 简易判断：如果OpenAI输出的内容包含列表中的某个名称，则返回它
    for (var i = 0; i < allAdGroupNames.length; i++) {
      var agName = allAdGroupNames[i];
      if (content.indexOf(agName) !== -1) {
        return agName; // 找到第一个匹配的
      }
    }
    // 若都未匹配到，默认返回第一个或空字符串
    return allAdGroupNames[0] || "";
  } catch (error) {
    Logger.log("调用OpenAI接口出错: " + error);
    // 出错则返回第一个或空字符串
    return allAdGroupNames[0] || "";
  }
}

/**
 * 将某个关键词（小写、不含匹配符）添加到指定的 AdGroup 中（EXACT & PHRASE）。
 * 并记录到 logEntries（格式：[CampaignName, AdGroupName, keyword]）。
 */
function addKeywordToAdGroup(keywordText, adGroupObj, logEntries) {
  var campaignName = adGroupObj.getCampaign().getName();
  var adGroupName = adGroupObj.getName();

  // 获取该 AdGroup 里已存在的“纯文本关键词”用于去重
  var existedKeywords = getExistingKeywords(adGroupObj);

  // 准备添加的 Exact/ Phrase
  var exactMatchText = "[" + keywordText + "]";
  var phraseMatchText = '"' + keywordText + '"';

  // 先处理 Exact
  var lowerExactCore = exactMatchText.replace(/[\[\]]/g, "").trim().toLowerCase();
  if (existedKeywords.indexOf(lowerExactCore) === -1) {
    try {
      var newKwOpExact = adGroupObj.newKeywordBuilder()
        .withText(exactMatchText)
        .build();

      if (newKwOpExact.isSuccessful()) {
        newlyCreatedKeywords.push(newKwOpExact.getResult());

        // 记录日志
        logEntries.push([
          campaignName,
          adGroupName,
          exactMatchText // 或者保留原文本 keywordText
        ]);
        Logger.log("已添加 EXACT 关键词: " + exactMatchText
                   + " => 广告组: " + adGroupName
                   + " (Campaign: " + campaignName + ")");
      }
    } catch (e) {
      Logger.log("添加EXACT关键词失败: " + e);
    }
  }

  // 再处理 Phrase
  var lowerPhraseCore = phraseMatchText.replace(/\"/g, "").trim().toLowerCase();
  if (existedKeywords.indexOf(lowerPhraseCore) === -1) {
    try {
      var newKwOpPhrase = adGroupObj.newKeywordBuilder()
        .withText(phraseMatchText)
        .build();

      if (newKwOpPhrase.isSuccessful()) {
        newlyCreatedKeywords.push(newKwOpPhrase.getResult());

        // 记录日志
        logEntries.push([
          campaignName,
          adGroupName,
          phraseMatchText
        ]);
        Logger.log("已添加 PHRASE 关键词: " + phraseMatchText
                   + " => 广告组: " + adGroupName
                   + " (Campaign: " + campaignName + ")");
      }
    } catch (e) {
      Logger.log("添加PHRASE关键词失败: " + e);
    }
  }
}

/**
 * 获取一个 AdGroup 下已存在关键词的“纯文本”（全部转为小写，不含匹配符），用于去重。
 */
function getExistingKeywords(adGroup) {
  var existed = [];
  var keywordIter = adGroup.keywords().get();
  while (keywordIter.hasNext()) {
    var kw = keywordIter.next();
    var textLower = kw.getText().replace(/[\[\]\"\+]/g, "").trim().toLowerCase();
    existed.push(textLower);
  }
  return existed;
}

/**
 * 将日志数据写入到指定 Spreadsheet 中的新建 Sheet。
 * Sheet名称 = 账户名 + '_' + 当天日期(yyyyMMdd)
 * 输出三列：Campaign, Ad Group, 关键词
 * 并高亮第三列。
 */
function appendLogsToNewSheet(spreadsheet, logEntries) {
  try {
    var accountName = AdsApp.currentAccount().getName();
    var dateStr = Utilities.formatDate(new Date(), AdsApp.currentAccount().getTimeZone(), "yyyyMMdd");
    var newSheetName = accountName + "_" + dateStr;

    // 创建一个新Sheet
    var newSheet = spreadsheet.insertSheet(newSheetName);

    // 标题行
    var titleRow = [["Campaign", "Ad Group", "关键词"]];
    newSheet.getRange(1, 1, 1, 3).setValues(titleRow);

    // 写入日志内容
    // logEntries 的每项格式: [CampaignName, AdGroupName, Keyword]
    newSheet.getRange(2, 1, logEntries.length, 3).setValues(logEntries);

    // 冻结首行
    newSheet.setFrozenRows(1);

    // 自动调整前 3 列列宽
    for (var i = 1; i <= 3; i++) {
      newSheet.autoResizeColumn(i);
    }

    // 高亮第三列 (含表头)
    var totalRows = 1 + logEntries.length;
    var highlightRange = newSheet.getRange(1, 3, totalRows, 1);
    highlightRange.setBackground("#FFFF00");  // 黄色高亮

    Logger.log("日志已写入Sheet: " + newSheetName);
  } catch (e) {
    Logger.log("写入Sheet出错: " + e);
  }
}

/*******************************
 * 为所有“本次脚本中新建的关键词”添加标签：
 * 标签格式：注册yyyyMMdd
 *******************************/
function labelNewKeywords() {
  if (newlyCreatedKeywords.length === 0) {
    Logger.log("本次未新增关键词，不需要打标签。");
    return;
  }

  // 生成标签名称，例如：注册20250101
  var labelName = "注册" + Utilities.formatDate(
    new Date(),
    AdsApp.currentAccount().getTimeZone(),
    "yyyyMMdd"
  );

  // 先查找是否已存在该标签
  var labelIterator = AdsApp.labels().withCondition("Name = '" + labelName + "'").get();
  var label;
  if (labelIterator.hasNext()) {
    // 找到了已有的同名标签
    label = labelIterator.next();
    Logger.log("已找到现有标签: " + labelName);
  } else {
    // 未找到则创建一个标签
    Logger.log("未找到标签，准备创建标签: " + labelName);
    AdsApp.createLabel(labelName);

    // 创建后，再次查找一次
    var labelIter2 = AdsApp.labels().withCondition("Name = '" + labelName + "'").get();
    if (labelIter2.hasNext()) {
      label = labelIter2.next();
      Logger.log("标签创建成功: " + labelName);
    } else {
      Logger.log("第二次依然找不到标签: " + labelName + "，跳过打标签。可能脚本/账号存在问题。");
      return;
    }
  }

  // 为所有新建的关键词打上该标签
  for (var i = 0; i < newlyCreatedKeywords.length; i++) {
    newlyCreatedKeywords[i].applyLabel(labelName);
  }
  Logger.log("已为本次新建的关键词添加标签: " + labelName);
}
