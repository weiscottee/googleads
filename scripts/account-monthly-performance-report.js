/**
 * 月报导出
 *
 * Exports account-level monthly performance metrics and period-over-period comparisons to Google Sheets.
 *
 * Packaged from the user's Google Ads script library.
 * Replace placeholder values before running in Google Ads Scripts.
 */

// Spreadsheets Script for Google Ads Environment - Account Total Only (v2 - Comma Fix)

// 配置区域
const SPREADSHEET_ID = "YOUR_GOOGLE_SHEET_ID"; // <--- *确认* 这是你的表格 ID
const SHEET_NAME = "YOUR_SHEET_NAME"; // <--- *确认* 这是你的工作表名称
const DATE_RANGE = 'LAST_MONTH'; // 或者 'YESTERDAY', 'LAST_7_DAYS', etc.
// 或者自定义日期范围: const CUSTOM_START_DATE = 'YYYYMMDD'; const CUSTOM_END_DATE = 'YYYYMMDD';
// --- 配置结束 ---

/**
 * 主函数，执行报表生成流程 (仅账户总计)
 */
function main() {
  const { currentPeriodStart, currentPeriodEnd, previousPeriodStart, previousPeriodEnd } = getDates(DATE_RANGE);

  Logger.log(`Current Period: ${currentPeriodStart} to ${currentPeriodEnd}`);
  Logger.log(`Previous Period: ${previousPeriodStart} to ${previousPeriodEnd}`);

  // 直接获取账户数据
  const lastPeriodAccountData = getDirectAccountData(currentPeriodStart, currentPeriodEnd);
  const previousPeriodAccountData = getDirectAccountData(previousPeriodStart, previousPeriodEnd);

  // 准备写入表格的数据
  const outputData = [];
  const headers = [
    '类别/名称',
    'Conv. value',
    'Conv. value/cost',
    'Cost',
    'Search impr. share',
    'Clicks',
    'All conversion',
    'Conversion',
    'Value/conversion',
    'Avg. CPC'
  ];
  outputData.push(headers);

  // 直接格式化账户数据
  const formattedRow = formatMetrics(lastPeriodAccountData, previousPeriodAccountData);
  outputData.push(['整个账户', ...formattedRow]);

  // 写入表格
  writeToSheet(outputData);
  Logger.log(`账户总计报表已成功写入表格: https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/`);
}

// --- *修正后的函数:* 直接从 ACCOUNT_PERFORMANCE_REPORT 获取数据并移除逗号 ---
/**
 * 直接获取并处理指定日期范围内的账户级别数据
 * @param {string} startDate - YYYYMMDD format
 * @param {string} endDate - YYYYMMDD format
 * @returns {Object} - Account metrics object
 */
function getDirectAccountData(startDate, endDate) {
  Logger.log(`Fetching account data for: ${startDate} - ${endDate}`);
  const report = AdsApp.report(
    `SELECT Cost, ConversionValue, SearchImpressionShare, Clicks, AllConversions, Conversions
     FROM ACCOUNT_PERFORMANCE_REPORT
     DURING ${startDate},${endDate}`
  );

  const rows = report.rows();
  if (rows.hasNext()) {
    const row = rows.next();

    // --- *修正:* 在 parseFloat/parseInt 之前移除逗号 ---
    const costString = String(row['Cost']).replace(/,/g, '');
    const convValueString = String(row['ConversionValue']).replace(/,/g, '');
    const clicksString = String(row['Clicks']).replace(/,/g, '');
    const allConversionsString = String(row['AllConversions']).replace(/,/g, '');
    const conversionsString = String(row['Conversions']).replace(/,/g, '');
    const searchImprShareString = String(row['SearchImpressionShare']).replace('%', '');
    // --- 修正结束 ---

    const metrics = {
      // --- *修正:* 使用清理过的字符串进行解析 ---
      cost: parseFloat(costString) || 0,
      conversionValue: parseFloat(convValueString) || 0,
      searchImprShare: parseFloat(searchImprShareString) / 100 || 0, // Convert % string to decimal
      clicks: parseInt(clicksString) || 0,
      allConversions: parseFloat(allConversionsString) || 0,
      conversions: parseFloat(conversionsString) || 0,
      // --- 修正结束 ---
    };
    // Calculate derived metrics directly
    metrics.averageCpc = metrics.clicks > 0 ? metrics.cost / metrics.clicks : 0;
    metrics.valuePerConversion = metrics.conversions > 0 ? metrics.conversionValue / metrics.conversions : 0;

    Logger.log(`Data fetched for ${startDate}-${endDate}: Cost=${metrics.cost}, ConvValue=${metrics.conversionValue}`);
    return metrics;
  } else {
    Logger.log(`No account data found for period: ${startDate} - ${endDate}. Returning default metrics.`);
    return getDefaultMetrics();
  }
}
// --- 修正后的函数结束 ---

/**
 * Returns a default metrics object with all values set to 0.
 * @returns {Object}
 */
function getDefaultMetrics() {
  return {
    cost: 0,
    conversionValue: 0,
    searchImprShare: 0,
    clicks: 0,
    allConversions: 0,
    conversions: 0,
    averageCpc: 0,
    valuePerConversion: 0,
  };
}

/**
 * Formats the metrics including percentage change compared to the previous period.
 * @param {Object} current - Current period metrics object.
 * @param {Object} previous - Previous period metrics object.
 * @returns {Array<string>} - Array of formatted metric strings.
 */
function formatMetrics(current, previous) {
  current = current || getDefaultMetrics();
  previous = previous || getDefaultMetrics();

  const currentConvValuePerCost = current.cost > 0 ? current.conversionValue / current.cost : 0;
  const previousConvValuePerCost = previous.cost > 0 ? previous.conversionValue / previous.cost : 0;

  const metrics = [
    { key: 'conversionValue', format: formatCurrency },
    { key: 'convValuePerCost', format: formatRatio }, // Placeholder key
    { key: 'cost', format: formatCurrency },
    { key: 'searchImprShare', format: formatPercentage },
    { key: 'clicks', format: formatNumber },
    { key: 'allConversions', format: formatNumber },
    { key: 'conversions', format: formatNumber },
    { key: 'valuePerConversion', format: formatCurrency },
    { key: 'averageCpc', format: formatCurrency },
  ];

  return metrics.map(({ key, format }) => {
    let currentValue, previousValue;

    if (key === 'convValuePerCost') {
      currentValue = currentConvValuePerCost;
      previousValue = previousConvValuePerCost;
    } else {
      currentValue = current && current.hasOwnProperty(key) ? current[key] : 0;
      previousValue = previous && previous.hasOwnProperty(key) ? previous[key] : 0;
    }

    currentValue = parseFloat(currentValue) || 0;
    previousValue = parseFloat(previousValue) || 0;

    const formattedValue = format(currentValue);
    const percentageChange = calculatePercentageChange(previousValue, currentValue);

    return `${formattedValue} (${percentageChange})`;
  });
}

// --- Formatting Helpers ---

function formatCurrency(value) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function formatPercentage(value) {
  return `${(Number(value || 0) * 100).toFixed(2)}%`;
}

function formatNumber(value) {
    const numValue = Number(value || 0);
    if (numValue % 1 !== 0) {
       return numValue.toFixed(2);
    }
    return numValue.toFixed(0);
}

function formatRatio(value) {
  return Number(value || 0).toFixed(2);
}

function calculatePercentageChange(oldValue, newValue) {
  oldValue = Number(oldValue);
  newValue = Number(newValue);

  if (!isFinite(oldValue) || !isFinite(newValue)) {
      return 'N/A';
  }
  if (oldValue === 0) {
    if (newValue > 0) return '+∞%';
    if (newValue < 0) return '-∞%';
    return '+0.0%';
  }
  const change = ((newValue - oldValue) / Math.abs(oldValue)) * 100;
  const sign = change >= 0 ? '+' : '';
  if (!isFinite(change)) {
      return 'N/A';
  }
  return `${sign}${change.toFixed(1)}%`;
}

// --- Date Helpers ---

function getDates(dateRangeType) {
  const now = new Date();
  let currentStart, currentEnd, previousStart, previousEnd;

  // Determine the account's timezone for accurate date boundaries
  const accountTimezone = AdsApp.currentAccount().getTimeZone();
  const nowInAccountTz = new Date(Utilities.formatDate(now, accountTimezone, "yyyy-MM-dd'T'HH:mm:ss"));

  if (dateRangeType === 'LAST_MONTH') {
    // Use account's timezone date for calculations
    const currentMonthStart = new Date(nowInAccountTz.getFullYear(), nowInAccountTz.getMonth(), 1);
    currentEnd = new Date(currentMonthStart.getTime() - (24 * 60 * 60 * 1000)); // Last day of previous month
    currentStart = new Date(currentEnd.getFullYear(), currentEnd.getMonth(), 1); // First day of previous month

    const previousMonthStart = new Date(currentStart.getFullYear(), currentStart.getMonth(), 1); // First day of last month
    previousEnd = new Date(previousMonthStart.getTime() - (24 * 60 * 60 * 1000)); // Last day of month before last
    previousStart = new Date(previousEnd.getFullYear(), previousEnd.getMonth(), 1); // First day of month before last
  }
  /* else if (dateRangeType === 'YESTERDAY') {
        // Adjust logic to use accountTimezone if implementing other ranges
        currentEnd = new Date(nowInAccountTz.getTime() - (24*60*60*1000));
        currentStart = new Date(currentEnd);
        previousEnd = new Date(currentStart.getTime() - (24*60*60*1000));
        previousStart = new Date(previousEnd);
  } */
  /* else if (typeof CUSTOM_START_DATE !== 'undefined' && typeof CUSTOM_END_DATE !== 'undefined') {
      // Ensure parseDate handles potential timezone issues if implementing
      currentStart = parseDate(CUSTOM_START_DATE);
      currentEnd = parseDate(CUSTOM_END_DATE);
      const duration = currentEnd.getTime() - currentStart.getTime();
      previousEnd = new Date(currentStart.getTime() - (24 * 60 * 60 * 1000));
      previousStart = new Date(previousEnd.getTime() - duration);
  } */
  else {
      throw new Error("Unsupported DATE_RANGE type or custom dates not set.");
  }

  // Return dates formatted for the report query
  return {
    currentPeriodStart: formatDateForAds(currentStart),
    currentPeriodEnd: formatDateForAds(currentEnd),
    previousPeriodStart: formatDateForAds(previousStart),
    previousPeriodEnd: formatDateForAds(previousEnd)
  };
}

function formatDateForAds(date) {
  // Use Utilities.formatDate with account timezone to be absolutely sure, though YYYYMMDD format is usually safe
  const accountTimezone = AdsApp.currentAccount().getTimeZone();
  return Utilities.formatDate(date, accountTimezone, "yyyyMMdd");
  /* // Alternative simpler formatting:
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}${mm}${dd}`;
  */
}

/* // Optional: Helper to parse YYYYMMDD string to Date object
function parseDate(yyyymmdd) {
    const year = parseInt(yyyymmdd.substring(0, 4), 10);
    const month = parseInt(yyyymmdd.substring(4, 6), 10) - 1;
    const day = parseInt(yyyymmdd.substring(6, 8), 10);
    // Be mindful of timezones when parsing if precision matters
    return new Date(year, month, day);
}
*/

// --- Spreadsheet Helper ---
function writeToSheet(data) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  if (!ss) {
      Logger.log(`错误：无法通过 ID "${SPREADSHEET_ID}" 打开电子表格。请检查 ID 是否正确以及脚本是否有权限访问 Google Sheets。`);
      throw new Error(`无法打开表格 ID: ${SPREADSHEET_ID}`);
  }

  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    Logger.log(`警告：在表格 "${ss.getName()}" 中找不到名为 "${SHEET_NAME}" 的工作表。将创建新工作表。`);
    try {
        sheet = ss.insertSheet(SHEET_NAME);
        Logger.log(`已创建新的工作表: "${SHEET_NAME}"`);
    } catch (e) {
        Logger.log(`创建工作表 "${SHEET_NAME}" 失败: ${e}. 请检查权限或表格状态。`);
        throw new Error(`工作表 "${SHEET_NAME}" 不存在且无法创建。`);
    }
  }

  // Clear only the necessary range (header + 1 data row)
  if (data.length > 0 && data[0].length > 0) {
    const rangeToClear = sheet.getRange(1, 1, Math.max(sheet.getLastRow(), data.length), data[0].length);
    rangeToClear.clearContent();
    rangeToClear.clearFormat(); // Also clear format if desired
    Logger.log(`Cleared range ${rangeToClear.getA1Notation()} in sheet "${SHEET_NAME}"`);
  } else {
      Logger.log("没有数据可以写入表格。");
      return;
  }

  // Write new data (header + 1 data row)
  const dataRange = sheet.getRange(1, 1, data.length, data[0].length);
  dataRange.setValues(data);
  Logger.log(`Written ${data.length} rows to sheet "${SHEET_NAME}"`);

  // Basic Formatting
  sheet.getRange(1, 1, 1, data[0].length).setFontWeight('bold');
  sheet.setFrozenRows(1);
  dataRange.setHorizontalAlignment('center'); // Center align written data
  try {
      for (let i = 1; i <= data[0].length; i++) {
          sheet.autoResizeColumn(i);
      }
      Logger.log("Auto-resized columns.");
  } catch (e) {
      Logger.log(`警告：自动调整列宽时出错: ${e}`);
  }
}
