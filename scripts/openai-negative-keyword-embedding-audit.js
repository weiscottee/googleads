/**
 * 向量否词
 *
 * Scores search terms against ad group names with embeddings and adds low-similarity exact negatives.
 *
 * Packaged from the user's Google Ads script library.
 * Replace placeholder values before running in Google Ads Scripts.
 */

var CAMPAIGN_NAME_CONDITION = "YOUR_CAMPAIGN_NAME_KEYWORD";
var DAYS_BACK = 1;
var LOG_SPREADSHEET_URL = "YOUR_GOOGLE_SHEET_URL";

// OpenAI API 配置
var OPENAI_API_KEY = "YOUR_OPENAI_API_KEY";  // 请替换为您的 OpenAI API 密钥
var EMBEDDING_MODEL = "text-embedding-3-large";

// 融合相似度计算时，设置密集向量（Embedding）与稀疏向量（BM25）得分的权重
var EMBEDDING_WEIGHT = 1;
var BM25_WEIGHT = 0;

// 全局数组：存储搜索词匹配报告
// 格式：[广告系列名称, 广告组名称, 搜索词, 综合匹配分数, 匹配说明, Conversion Value, Cost]
var SEARCH_TERM_MATCH_REPORT = [];

/**
 * 主流程：
 * 1. 遍历符合条件的广告系列和广告组；
 * 2. 对每个广告组，使用 AWQL 报告拉取所有搜索词（曝光 > 0）；
 * 3. 将该广告组所有搜索词批量提交 OpenAI API 获取嵌入向量，
 *    同时获取广告组名称的嵌入向量，然后计算余弦相似度和 BM25 得分，融合得到综合匹配分数；
 * 4. 保存结果，并在导出时为每次执行新增一个工作表，工作表名称为广告账户名加日期时间。
 * 5. 【新增步骤】对 embedding 相似度小于 0.2 的搜索词，将其以精准匹配形式（加中括号）添加为否定关键词到对应广告组。
 */
function main() {
  var dateRange = getDateRange(DAYS_BACK);

  var campaignIterator = AdsApp.campaigns()
    .withCondition("Status = ENABLED")
    .withCondition("Name CONTAINS_IGNORE_CASE '" + CAMPAIGN_NAME_CONDITION + "'")
    .get();

  if (!campaignIterator.hasNext()) {
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

      // 跳过广告组名称中包含 "broad" 或 "核心" 的广告组
      if (adGroupNameLower.indexOf("broad") !== -1 || adGroupNameLower.indexOf("核心") !== -1) {
        continue;
      }

      // 【新增】去除广告组名称末尾的语言后缀 _es _de _fr _zh _it
      var adGroupNameClean = adGroupNameLower.replace(/(_es|_de|_fr|_zh|_it)$/, "");

      // 构造 AWQL 查询语句：拉取曝光大于 0 的搜索词、ConversionValue 和 Cost
      var query = "SELECT Query, Impressions, ConversionValue, Cost " +
                  "FROM SEARCH_QUERY_PERFORMANCE_REPORT " +
                  "WHERE CampaignId = " + campaign.getId() + " " +
                  "AND AdGroupId = " + adGroup.getId() + " " +
                  "AND Cost > 2 " +
                  "DURING " + dateRange;

      var report = AdsApp.report(query);
      var rows = report.rows();

      // 收集该广告组的所有搜索词数据
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
         // 提取搜索词数组
         var searchTerms = searchTermRows.map(function(item) { return item.searchTerm; });
         // 批量获取所有搜索词的嵌入向量（支持批量拆分）
         var searchTermEmbeddings = getEmbeddingsBulk(searchTerms);
         // 获取广告组名称的嵌入向量（只需调用一次）采用去除语言后缀后的名称
         var adGroupEmbedding = getEmbedding(adGroupNameClean);

         // 对每个搜索词计算相似度及综合得分
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

             // 新增步骤：如果 embedding 相似度小于 0.2，则将该搜索词以精准匹配形式（加中括号）添加为否定关键词到该广告组
             if (embeddingSimilarity < 0.2) {
               try {
                 adGroup.createNegativeKeyword("[" + st + "]");
               } catch (e) {
                 Logger.log("添加否定关键词时出错，搜索词: '" + st + "'，广告组: '" + adGroupNameRaw + "'，错误信息: " + e);
               }
             }
         }
      }
    }
  }

  flushReports();
}

/**
 * 批量调用 OpenAI Embeddings API 获取文本嵌入向量
 * 如果输入文本较多，会拆分成多个批次请求
 *
 * @param {Array<string>} texts - 文本数组
 * @return {Array<Array<number>>} - 返回嵌入向量数组
 */
function getEmbeddingsBulk(texts) {
  var embeddings = [];
  // 每批处理的条数，可以根据需要调整
  var chunkSize = 50;
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
      Logger.log("OpenAI API 请求错误，状态码：" + responseCode + "，返回内容：" + content);
      throw new Error("OpenAI API 请求错误，状态码：" + responseCode);
    }

    var json;
    try {
      json = JSON.parse(content);
    } catch (e) {
      Logger.log("JSON 解析错误，返回内容：" + content);
      throw new Error("JSON 解析错误: " + e);
    }

    if (json.data && json.data.length === chunk.length) {
      embeddings = embeddings.concat(json.data.map(function(item) {
        return item.embedding;
      }));
    } else {
      throw new Error("未能获取批量嵌入向量: " + content);
    }
  }

  return embeddings;
}

/**
 * 调用 OpenAI Embeddings API 获取单个文本的嵌入向量（用于广告组名称）
 *
 * @param {string} text
 * @return {Array<number>} 嵌入向量
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
    throw new Error("未能获取嵌入向量: " + response.getContentText());
  }
}

/**
 * 计算两个向量之间的余弦相似度
 *
 * @param {Array<number>} vec1
 * @param {Array<number>} vec2
 * @return {number} 余弦相似度
 */
function cosineSimilarity(vec1, vec2) {
  if (vec1.length !== vec2.length) {
    throw new Error("向量维度不匹配");
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
 * 计算 BM25 关键词匹配得分（简化版）：采用词重叠比例，返回 0～1 之间的值
 *
 * @param {string} queryText - 搜索词
 * @param {string} docText - 广告组名称
 * @return {number} BM25 得分
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
 * 根据回溯天数生成日期范围字符串，格式为：YYYYMMDD,YYYYMMDD
 *
 * @param {number} daysBack
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
 * 将搜索词匹配报告写入指定的 Google Sheet
 * 输出表格列顺序为：
 * 1. 广告系列名称
 * 2. 广告组名称
 * 3. 搜索词
 * 4. 综合匹配分数
 * 5. 匹配说明
 * 6. Conversion Value
 * 7. Cost
 *
 * 每次执行时会在目标文件中新建一个工作表，工作表名称为广告账户名加日期时间。
 */
function flushReports() {
  try {
    var ss = SpreadsheetApp.openByUrl(LOG_SPREADSHEET_URL);
    var accountName = AdsApp.currentAccount().getName();
    var dateStr = Utilities.formatDate(new Date(), "Asia/Shanghai", "yyyy-MM-dd");
    var timeStr = Utilities.formatDate(new Date(), "Asia/Shanghai", "HH-mm-ss");
    var sheetName = accountName + "-" + dateStr + "-" + timeStr;
    var sheet = ss.insertSheet(sheetName);

    sheet.appendRow(["广告系列名称", "广告组名称", "搜索词", "匹配分数", "匹配说明", "Conversion Value", "Cost"]);

    for (var i = 0; i < SEARCH_TERM_MATCH_REPORT.length; i++) {
      sheet.appendRow(SEARCH_TERM_MATCH_REPORT[i]);
    }

    sheet.autoResizeColumns(1, 7);

  } catch (e) {
    Logger.log("写入报告时出错: " + e);
  }

  // 清空报告数组，防止数据叠加
  SEARCH_TERM_MATCH_REPORT = [];
}
