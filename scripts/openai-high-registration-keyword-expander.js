/**
 * 行业词_拓词_高注册词
 *
 * Expands high-registration industry terms into ad groups with OpenAI matching and labels new keywords.
 *
 * Packaged from the user's Google Ads script library.
 * Replace placeholder values before running in Google Ads Scripts.
 */

/*******************************
 * 全局变量
 *******************************/
// 存放本次脚本新建的全部关键词对象
let newlyCreatedKeywords = [];

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
  const labelName = "注册" + Utilities.formatDate(
    new Date(),
    AdsApp.currentAccount().getTimeZone(),
    "yyyyMMdd"
  );

  // 先查找是否已存在该标签
  let labelIterator = AdsApp.labels().withCondition("Name = '" + labelName + "'").get();
  let label;
  if (labelIterator.hasNext()) {
    // 找到了已有的同名标签
    label = labelIterator.next();
    Logger.log("已找到现有标签: " + labelName);
  } else {
    // 未找到则创建一个标签
    Logger.log("未找到标签，准备创建标签: " + labelName);
    AdsApp.createLabel(labelName);

    // 创建后，再次查找一次
    let labelIter2 = AdsApp.labels().withCondition("Name = '" + labelName + "'").get();
    if (labelIter2.hasNext()) {
      label = labelIter2.next();
      Logger.log("标签创建成功: " + labelName);
    } else {
      Logger.log("第二次依然找不到标签: " + labelName + "，跳过打标签。可能脚本/账号存在问题。");
      return;
    }
  }

  // 为所有新建的关键词打上该标签
  for (let i = 0; i < newlyCreatedKeywords.length; i++) {
    newlyCreatedKeywords[i].applyLabel(labelName);
  }
  Logger.log("已为本次新建的关键词添加标签: " + labelName);
}

/*******************************
 * 配置项
 *******************************/
// 需要处理的广告系列名称中包含的字符
const CAMPAIGN_NAME_CONDITION = "YOUR_CAMPAIGN_NAME_KEYWORD";
// 回溯天数（示例为45天，你可自行修改）
const DAYS_BACK = 40;

// OpenAI 配置信息
const OPENAI_API_KEY = "YOUR_OPENAI_API_KEY";  // 请填入你的OpenAI API Key
const OPENAI_ENDPOINT = "https://api.openai.com/v1/chat/completions";
const OPENAI_MODEL = "gpt-4o";
const OPENAI_TEMPERATURE = 0.3;
const OPENAI_MAX_TOKENS = 20;

// Google Sheet日志相关
// 只需在这里填入你的Spreadsheet “ID” 即可，示例：1aBcDxxxxxx
const SPREADSHEET_ID = "YOUR_GOOGLE_SHEET_ID";

/*******************************
 * 主函数
 *******************************/
function main() {
  // 第一步：获取日期区间
  const dateRange = getDateRange(DAYS_BACK);

  // 第二步：获取所有名称包含 CAMPAIGN_NAME_CONDITION 的广告系列（可能不止一个）
  let allCampaigns = AdsApp
    .campaigns()
    .withCondition("Name CONTAINS_IGNORE_CASE '" + CAMPAIGN_NAME_CONDITION + "'")
    .get();

  if (!allCampaigns.hasNext()) {
    Logger.log("未找到名称包含 '" + CAMPAIGN_NAME_CONDITION + "' 的广告系列，脚本结束。");
    return;
  }

  // 将所有符合条件的广告系列存到列表，以便后续“依次处理”
  let campaignsList = [];
  while (allCampaigns.hasNext()) {
    campaignsList.push(allCampaigns.next());
  }

  // 用于记录最终的添加操作日志
  // 新的日志格式顺序： [ CampaignName, AdGroupName, 搜索词, 搜索词注册率, 关键词平均注册率 ]
  let logEntries = [];

  // 第三步：为后续做 “跨广告系列添加关键词”，建一个全局 Map
  // 方便查找“同名广告组”来进行添加
  const functionCampaignsMap = buildCampaignsAdGroupMap(CAMPAIGN_NAME_CONDITION);

  // 第四步：依次处理每一个“function”广告系列
  for (let i = 0; i < campaignsList.length; i++) {
    let campaign = campaignsList[i];
    let campaignName = campaign.getName();
    Logger.log("开始处理广告系列：" + campaignName);

    // 计算此广告系列的【关键词平均注册率】(AllConv / Clicks)
    // 只取 Keywords 中 Conversions > 0 的那些关键词来参与计算
    let avgKeywordCR = computeCampaignKeywordCR(campaign.getId(), dateRange);
    if (avgKeywordCR <= 0) {
      Logger.log(
        "广告系列 " + campaignName + " 未找到 Conversions>0 的关键词，或点击量/AllConversions为0，跳过。"
      );
      continue;
    }

    // 获取此广告系列【已存在的关键词文本】（忽略匹配类型），用于后续去重
    let allExistingKeywordsInCampaign = getAllKeywordsInCampaign(campaign);

    // 获取此广告系列下所有广告组名称（小写），用于 OpenAI 匹配
    let allAdGroupNames = [];
    let adGroupIterForList = campaign.adGroups().get();
    while (adGroupIterForList.hasNext()) {
      let ag = adGroupIterForList.next();
      allAdGroupNames.push(ag.getName().trim().toLowerCase());
    }

    // 获取此广告系列近 N 天的搜索词 (Search Query)，并筛选 QueryTargetingStatus='NONE'
    let stQuery = "SELECT Query, Clicks, AllConversions, QueryTargetingStatus " +
                  "FROM SEARCH_QUERY_PERFORMANCE_REPORT " +
                  "WHERE CampaignId = " + campaign.getId() + " " +
                  "AND QueryTargetingStatus = 'NONE' " +  // 只抓取未定向的搜索词
                  "AND Clicks > 0 " +                     // 至少有点击
                  "DURING " + dateRange;

    let stReport = AdsApp.report(stQuery);
    let stRows = stReport.rows();

    // 根据条件筛选合格的搜索词
    while (stRows.hasNext()) {
      let stRow = stRows.next();
      let queryText = stRow["Query"].trim().toLowerCase();
      let clicks = parseFloat(stRow["Clicks"]);
      let allConv = parseFloat(stRow["AllConversions"]) || 0;
      let stCR = allConv / clicks; // 搜索词自身注册率 = AllConv / Clicks

      // (1) 该搜索词不在此广告系列已有关键词中
      if (allExistingKeywordsInCampaign.indexOf(queryText) !== -1) {
        continue;
      }
      // (2) 点击量 > 1 / avgKeywordCR
      if (clicks <= 1 / avgKeywordCR) {
        continue;
      }
      // (3) 搜索词自身注册率 > 关键词平均注册率
      if (stCR <= avgKeywordCR) {
        continue;
      }

      // —— 通过OpenAI来判定最匹配的广告组（仅比较当前Campaign的adGroupNames）——
      let bestAdGroupNameLower = getBestMatchAdGroupName(queryText, allAdGroupNames);
      if (!bestAdGroupNameLower) {
        // 若OpenAI没给出可用的广告组，则跳过
        continue;
      }

      // —— 将该搜索词，添加到【所有名称包含 function 的广告系列】里与该 AdGroup 同名的广告组 ——
      addKeywordToAllMatchingAdGroups(
        queryText,
        bestAdGroupNameLower,
        functionCampaignsMap,
        logEntries,
        stCR,
        avgKeywordCR,
        campaignName
      );
    }
  }

  // 第五步：将操作日志写入Google Sheet（每次新建一个Sheet，名称：账户名 + yyyy-MM-dd）
  if (logEntries.length > 0) {
    appendLogsToNewSheet(logEntries);
  }

  // 最后，为本次所有新建关键词统一加标签
  labelNewKeywords();

  Logger.log("脚本执行完毕。");
}

/**
 * 返回日期范围字符串，格式：YYYYMMDD,YYYYMMDD
 * @param {number} daysBack - 回溯天数
 */
function getDateRange(daysBack) {
  const today = new Date();
  // 取昨天结束，避免今天的数据不完整
  const end = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  const start = new Date(end.getTime() - (daysBack - 1) * 24 * 60 * 60 * 1000);

  function formatDate(date) {
    let year = date.getFullYear();
    let month = ("0" + (date.getMonth() + 1)).slice(-2);
    let day = ("0" + date.getDate()).slice(-2);
    return year + month + day;
  }

  return formatDate(start) + "," + formatDate(end);
}

/**
 * 计算某个Campaign在过去N天内，“关键词平均注册率” = (AllConversions / Clicks)，
 * 只取 (Conversions > 0) 的关键词来筛选，但计算用的是 AllConversions。
 *
 * @param {number} campaignId
 * @param {string} dateRange
 * @return {number} avgCR
 */
function computeCampaignKeywordCR(campaignId, dateRange) {
  // 注意这里的筛选：AND Conversions > 0
  // 但计算时用 AllConversions，来获得“总注册数 / 点击数”
  let kwQuery = "SELECT Clicks, Conversions, AllConversions " +
                "FROM KEYWORDS_PERFORMANCE_REPORT " +
                "WHERE CampaignId = " + campaignId + " " +
                "AND Conversions > 0 " +
                "DURING " + dateRange;

  let report = AdsApp.report(kwQuery);
  let rows = report.rows();

  let totalClicks = 0;
  let totalAllConv = 0;

  while (rows.hasNext()) {
    let row = rows.next();
    let clicks = parseFloat(row["Clicks"]);
    let allConv = parseFloat(row["AllConversions"]) || 0;

    totalClicks += clicks;
    totalAllConv += allConv;
  }

  // 若无有效数据，则返回 0
  if (totalClicks === 0 || totalAllConv === 0) {
    return 0;
  }
  return totalAllConv / totalClicks; // 关键词平均注册率
}

/**
 * 获取某广告系列所有已存在关键词的「纯文本」（忽略匹配类型），小写返回
 * @param {Campaign} campaign
 * @return {Array<string>}
 */
function getAllKeywordsInCampaign(campaign) {
  let existed = [];
  let adGroupIter = campaign.adGroups().get();
  while (adGroupIter.hasNext()) {
    let adGroup = adGroupIter.next();
    let keywordIter = adGroup.keywords().get();
    while (keywordIter.hasNext()) {
      let kw = keywordIter.next();
      // 去掉 [] "" + 等匹配符，只保留纯文本
      let textLower = kw.getText().replace(/[\[\]\"\+]/g, "").trim().toLowerCase();
      if (existed.indexOf(textLower) === -1) {
        existed.push(textLower);
      }
    }
  }
  return existed;
}

/**
 * 构建一个Map：key=CampaignId，value={ campaignName, adGroupsMap }
 * adGroupsMap: key=广告组名称(小写), value=AdGroup对象
 * 用于“跨广告系列查找同名广告组”。
 */
function buildCampaignsAdGroupMap(nameCondition) {
  let map = {};
  let campIter = AdsApp
    .campaigns()
    .withCondition("Name CONTAINS_IGNORE_CASE '" + nameCondition + "'")
    .get();

  while (campIter.hasNext()) {
    let c = campIter.next();
    let cId = c.getId();
    let adGroupIter = c.adGroups().get();
    let adGroupsMap = {};
    while (adGroupIter.hasNext()) {
      let ag = adGroupIter.next();
      // 用小写作为 key 以便匹配
      adGroupsMap[ag.getName().trim().toLowerCase()] = ag;
    }
    map[cId] = {
      campaignName: c.getName(),
      adGroupsMap: adGroupsMap
    };
  }
  return map;
}

/**
 * 调用 OpenAI，让其在 allAdGroupNames（当前广告系列全部广告组名称）里选出“最匹配”。
 * @param {string} queryText - 搜索词（小写）
 * @param {Array<string>} allAdGroupNames - 当前Campaign的所有广告组名称(小写)
 * @return {string} bestAdGroupNameLower - 最匹配的广告组名称(小写)，若无则返回空或第一个
 */
function getBestMatchAdGroupName(queryText, allAdGroupNames) {
  if (!allAdGroupNames || allAdGroupNames.length === 0) {
    return "";
  }

  // 拼成字符串传给OpenAI
  let listStr = allAdGroupNames.join(", ");
  let userPrompt =
    "我们有以下广告组名称：[" + listStr + "]。" +
    "\n针对搜索词：\"" + queryText + "\"，请从列表中选出最强相关的那个名称，并只输出那一个名称（小写）。";

  let requestBody = {
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

  let options = {
    method: "post",
    muteHttpExceptions: true,
    contentType: "application/json",
    headers: {
      "Authorization": "Bearer " + OPENAI_API_KEY
    },
    payload: JSON.stringify(requestBody)
  };

  try {
    let response = UrlFetchApp.fetch(OPENAI_ENDPOINT, options);
    let jsonResponse = JSON.parse(response.getContentText());
    let content = jsonResponse.choices[0].message.content.trim().toLowerCase();

    // 简易判断：如果OpenAI输出的内容包含列表中的某个名称，则返回它
    for (let i = 0; i < allAdGroupNames.length; i++) {
      let agName = allAdGroupNames[i];
      if (content.indexOf(agName) !== -1) {
        return agName;
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
 * 将搜索词添加到所有包含 function 的广告系列中，与 bestAdGroupNameLower 同名的广告组；
 * 并记录到 logEntries。同时将新建的关键词对象存入 newlyCreatedKeywords，以便后续统一打标签。
 *
 * @param {string} queryText - 小写、无匹配符的搜索词
 * @param {string} bestAdGroupNameLower - 经OpenAI判定要添加到的广告组名称(小写)
 * @param {Object} functionCampaignsMap - buildCampaignsAdGroupMap()生成的 Map
 * @param {Array} logEntries - 记录日志；顺序： [CampaignName, AdGroupName, 搜索词, 搜索词注册率, 关键词平均注册率]
 * @param {number} stCR - 搜索词注册率
 * @param {number} avgKeywordCR - 当前广告系列关键词平均注册率
 * @param {string} originalCampaignName - 用于日志，表明此搜索词来自哪个系列
 */
function addKeywordToAllMatchingAdGroups(
  queryText,
  bestAdGroupNameLower,
  functionCampaignsMap,
  logEntries,
  stCR,
  avgKeywordCR,
  originalCampaignName
) {
  // 遍历所有包含 nameCondition=function 的广告系列，检查是否有同名 AdGroup
  for (let cId in functionCampaignsMap) {
    let cName = functionCampaignsMap[cId].campaignName;
    let adGroupObj = functionCampaignsMap[cId].adGroupsMap[bestAdGroupNameLower];
    if (!adGroupObj) {
      // 没有同名广告组就跳过
      continue;
    }

    // 获取该广告组里已经存在的“纯文本关键词”（忽略匹配类型）
    let existedKeywords = getExistingKeywords(adGroupObj);

    // 构造含匹配符的关键词文本
    let exactMatchText = "[" + queryText + "]";
    let phraseMatchText = '"' + queryText + '"';

    // 1) 若尚无EXACT匹配，则添加
    let lowerExactCore = exactMatchText.toLowerCase().replace(/[\[\]]/g, "");
    if (existedKeywords.indexOf(queryText) === -1 &&
        existedKeywords.indexOf(lowerExactCore) === -1)
    {
      try {
        let newKwOpExact = adGroupObj.newKeywordBuilder()
          .withText(exactMatchText)
          .build();

        if (newKwOpExact.isSuccessful()) {
          let newExactKeyword = newKwOpExact.getResult();
          newlyCreatedKeywords.push(newExactKeyword);
        }

        // 按新顺序记录日志
        logEntries.push([
          cName,                 // 广告系列
          adGroupObj.getName(),  // 广告组
          queryText,             // 搜索词
          stCR,                  // 搜索词注册率
          avgKeywordCR           // 关键词平均注册率
        ]);

        Logger.log(
          "已添加 EXACT 关键词: " + exactMatchText +
          " => 广告组: " + adGroupObj.getName() +
          " (Campaign: " + cName + ")"
        );
      } catch (e) {
        Logger.log("添加EXACT关键词失败: " + e);
      }
    }

    // 2) 若尚无PHRASE匹配，则添加
    let lowerPhraseCore = phraseMatchText.toLowerCase().replace(/\"/g, "");
    if (existedKeywords.indexOf(queryText) === -1 &&
        existedKeywords.indexOf(lowerPhraseCore) === -1)
    {
      try {
        let newKwOpPhrase = adGroupObj.newKeywordBuilder()
          .withText(phraseMatchText)
          .build();

        if (newKwOpPhrase.isSuccessful()) {
          let newPhraseKeyword = newKwOpPhrase.getResult();
          newlyCreatedKeywords.push(newPhraseKeyword);
        }

        // 同样顺序
        logEntries.push([
          cName,
          adGroupObj.getName(),
          queryText,
          stCR,
          avgKeywordCR
        ]);

        Logger.log(
          "已添加 PHRASE 关键词: " + phraseMatchText +
          " => 广告组: " + adGroupObj.getName() +
          " (Campaign: " + cName + ")"
        );
      } catch (e) {
        Logger.log("添加PHRASE关键词失败: " + e);
      }
    }
  }
}

/**
 * 获取一个 AdGroup 下已存在关键词的“纯文本”（全部转为小写，不含匹配符），用于去重
 */
function getExistingKeywords(adGroup) {
  let existed = [];
  let keywordIter = adGroup.keywords().get();
  while (keywordIter.hasNext()) {
    let kw = keywordIter.next();
    let textLower = kw.getText().replace(/[\[\]\"\+]/g, "").trim().toLowerCase();
    existed.push(textLower);
  }
  return existed;
}

/**
 * 将日志数据写入到 Google Sheet 中的新建 Sheet
 * Sheet 命名 = 账户名_yyyy-MM-dd（若重名则加_1,_2...）。
 * 并在写完后冻结首行、自动调整列宽，示例还演示了如何为第 3 列上色。
 *
 * @param {Array<Array>} logEntries 一个二维数组，每个元素是一条日志数据（行），例如：
 *    [
 *      ["TestCampaign", "AdGroup A", "keyword1", 0.5, 0.2],
 *      ["TestCampaign", "AdGroup B", "keyword2", 0.3, 0.15]
 *    ]
 */
function appendLogsToNewSheet(logEntries) {
  // 若数组为空，直接返回
  if (!logEntries || logEntries.length === 0) {
    Logger.log("没有日志数据，无需写入表格。");
    return;
  }

  try {
    // 1. 获取账户名和日期
    let accountName = AdsApp.currentAccount().getName();
    // 采用 "yyyy-MM-dd" 形式的日期
    let dateStr = Utilities.formatDate(new Date(), AdsApp.currentAccount().getTimeZone(), "yyyy-MM-dd");
    let baseSheetName = accountName + "_" + dateStr;

    // 2. 打开目标 Spreadsheet
    //    若 SPREADSHEET_ID 中存的确实是ID，则用 openById(); 若存的是完整URL，可改为 openByUrl()
    let ss = SpreadsheetApp.openById(SPREADSHEET_ID);

    // 3. 检测是否有重名的 Sheet，若有则加 _1,_2...
    let finalSheetName = baseSheetName;
    let idx = 1;
    while (ss.getSheetByName(finalSheetName)) {
      finalSheetName = baseSheetName + "_" + idx;
      idx++;
    }

    // 4. 新建工作表
    let sheet = ss.insertSheet(finalSheetName);
    Logger.log("已创建新的工作表: " + finalSheetName);

    // 5. 写入表头（与 logEntries 的顺序保持一致）
    //    logEntries 的结构是 [CampaignName, AdGroupName, 搜索词, 搜索词注册率, 关键词平均注册率]
    //    因此我们的表头可按此对应：
    const header = [
      ["广告系列", "广告组名称", "搜索词", "搜索词注册率", "关键词平均注册率"]
    ];
    sheet.getRange(1, 1, 1, 5).setValues(header);

    // 6. 写入日志数据
    sheet.getRange(2, 1, logEntries.length, logEntries[0].length).setValues(logEntries);

    // 7. 冻结首行、自动调整列宽，并示例性为第 3 列（搜索词）上色
    sheet.setFrozenRows(1);
    sheet.autoResizeColumns(1, 5);
    // 示例：将第 3 列（搜索词）上色
    sheet.getRange("C1:C" + (logEntries.length + 1)).setBackground("#FFFF00");

    Logger.log("日志已成功写入 Sheet: " + finalSheetName);
  } catch (e) {
    Logger.log("写入 Sheet 出错: " + e);
  }
}
