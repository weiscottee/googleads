/**
 * 自动周报
 *
 * Exports account-level weekly performance metrics and period-over-period comparisons to Google Sheets.
 *
 * Packaged from the user's Google Ads script library.
 * Replace placeholder values before running in Google Ads Scripts.
 */

// Spreadsheets Script for Google Ads Environment - Account Total Only (v3 - Date Logic Fix)

// 配置区域
const SPREADSHEET_ID = "YOUR_GOOGLE_SHEET_ID"; // <--- *确认* 这是你的表格 ID
const SHEET_NAME = "YOUR_SHEET_NAME"; // <--- *确认* 这是你的工作表名称
const DATE_RANGE = 'LAST_7_DAYS'; // 支持 'LAST_7_DAYS', 'YESTERDAY', 'LAST_MONTH', 或自定义
// 或者自定义日期范围 (取消下面两行的注释并设置日期):
// const CUSTOM_START_DATE = 'YYYYMMDD'; // 例如 '20240101'
// const CUSTOM_END_DATE = 'YYYYMMDD';   // 例如 '20240131'
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

    const costString = String(row['Cost']).replace(/,/g, '');
    const convValueString = String(row['ConversionValue']).replace(/,/g, '');
    const clicksString = String(row['Clicks']).replace(/,/g, '');
    const allConversionsString = String(row['AllConversions']).replace(/,/g, '');
    const conversionsString = String(row['Conversions']).replace(/,/g, '');
    const searchImprShareString = String(row['SearchImpressionShare']).replace(/%/g, ''); // Remove % globally

    const metrics = {
      cost: parseFloat(costString) || 0,
      conversionValue: parseFloat(convValueString) || 0,
      searchImprShare: parseFloat(searchImprShareString) / 100 || 0, // Convert % string to decimal
      clicks: parseInt(clicksString, 10) || 0, // Added radix 10
      allConversions: parseFloat(allConversionsString) || 0,
      conversions: parseFloat(conversionsString) || 0,
    };
    metrics.averageCpc = metrics.clicks > 0 ? metrics.cost / metrics.clicks : 0;
    metrics.valuePerConversion = metrics.conversions > 0 ? metrics.conversionValue / metrics.conversions : 0;

    Logger.log(`Data fetched for ${startDate}-${endDate}: Cost=${metrics.cost}, ConvValue=${metrics.conversionValue}`);
    return metrics;
  } else {
    Logger.log(`No account data found for period: ${startDate} - ${endDate}. Returning default metrics.`);
    return getDefaultMetrics();
  }
}

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
    { key: 'convValuePerCost', format: formatRatio },
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
    // Check if it's an integer or has decimal places
    if (numValue % 1 !== 0) {
        return numValue.toFixed(2); // Keep 2 decimal places if not an integer
    }
    return numValue.toFixed(0); // No decimal places if it's an integer
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
    if (newValue < 0) return '-∞%'; // Should not happen with positive metrics
    return '+0.0%'; // Or 'N/A' or '-'
  }
  const change = ((newValue - oldValue) / Math.abs(oldValue)) * 100;
  const sign = change >= 0 ? '+' : '';
  if (!isFinite(change)) { // Should be caught by previous isFinite checks, but good for safety
      return 'N/A';
  }
  return `${sign}${change.toFixed(1)}%`;
}

// --- Date Helpers ---

/**
 * Calculates and returns current and previous period start and end dates.
 * @param {string} dateRangeType - The type of date range (e.g., 'LAST_7_DAYS', 'LAST_MONTH', 'YESTERDAY').
 * If custom dates are used, this parameter is effectively ignored if
 * CUSTOM_START_DATE and CUSTOM_END_DATE are defined.
 * @return {object} An object containing formatted start and end dates for current and previous periods.
 */
function getDates(dateRangeType) {
  const now = new Date();
  let currentStart, currentEnd, previousStart, previousEnd;

  const accountTimezone = AdsApp.currentAccount().getTimeZone();
  // Use a reference date in the account's timezone, set to the beginning of "today"
  const todayInAccountTz = new Date(Utilities.formatDate(now, accountTimezone, "yyyy-MM-dd'T00:00:00'"));

  // Check for custom dates first if they are defined
  // Note: Ensure CUSTOM_START_DATE and CUSTOM_END_DATE are declared globally if used.
  if (typeof CUSTOM_START_DATE !== 'undefined' && CUSTOM_START_DATE &&
      typeof CUSTOM_END_DATE !== 'undefined' && CUSTOM_END_DATE) {
    Logger.log(`Using custom date range: ${CUSTOM_START_DATE} to ${CUSTOM_END_DATE}`);
    currentStart = parseDate(CUSTOM_START_DATE); // Ensure parseDate is uncommented and available
    currentEnd = parseDate(CUSTOM_END_DATE);

    if (!currentStart || !currentEnd || currentStart.getTime() > currentEnd.getTime()) {
        throw new Error("Invalid custom date range: Start date must be before or same as end date, and dates must be valid.");
    }
    const durationMs = currentEnd.getTime() - currentStart.getTime(); // Duration in milliseconds

    previousEnd = new Date(currentStart.getTime() - (24 * 60 * 60 * 1000)); // The day before the current period started
    previousStart = new Date(previousEnd.getTime() - durationMs); // Maintain the same duration for the previous period

  } else if (dateRangeType === 'LAST_7_DAYS') {
    Logger.log("Calculating dates for LAST_7_DAYS");
    // Current period: Ends yesterday, spans 7 days.
    currentEnd = new Date(todayInAccountTz.getTime() - (1 * 24 * 60 * 60 * 1000)); // Yesterday
    currentStart = new Date(currentEnd.getTime() - (6 * 24 * 60 * 60 * 1000));   // 6 days before yesterday (total 7 days)

    // Previous period: Ends the day before currentStart, spans 7 days.
    previousEnd = new Date(currentStart.getTime() - (1 * 24 * 60 * 60 * 1000));
    previousStart = new Date(previousEnd.getTime() - (6 * 24 * 60 * 60 * 1000));

  } else if (dateRangeType === 'YESTERDAY') {
    Logger.log("Calculating dates for YESTERDAY");
    currentEnd = new Date(todayInAccountTz.getTime() - (1 * 24 * 60 * 60 * 1000)); // Yesterday
    currentStart = new Date(currentEnd); // Yesterday is a 1-day period

    previousEnd = new Date(currentStart.getTime() - (1 * 24 * 60 * 60 * 1000)); // Day before yesterday
    previousStart = new Date(previousEnd); // Day before yesterday is a 1-day period

  } else if (dateRangeType === 'LAST_MONTH') {
    Logger.log("Calculating dates for LAST_MONTH");
    // Current Period: Last Full Month
    // Start by getting the first day of the current month in account's timezone
    const firstDayOfCurrentMonth = new Date(todayInAccountTz.getFullYear(), todayInAccountTz.getMonth(), 1);
    // End of last month is one day before the first day of current month
    currentEnd = new Date(firstDayOfCurrentMonth.getTime() - (24 * 60 * 60 * 1000));
    // Start of last month is the first day of that month
    currentStart = new Date(currentEnd.getFullYear(), currentEnd.getMonth(), 1);

    // Previous Period: Month Before Last
    // First day of the month *before* currentStart's month
    const firstDayOfLastMonth = new Date(currentStart.getFullYear(), currentStart.getMonth(), 1);
    previousEnd = new Date(firstDayOfLastMonth.getTime() - (24 * 60 * 60 * 1000));
    previousStart = new Date(previousEnd.getFullYear(), previousEnd.getMonth(), 1);

  } else {
    throw new Error(`Unsupported DATE_RANGE type ('${dateRangeType}') and custom dates (CUSTOM_START_DATE, CUSTOM_END_DATE) are not properly set or defined in the configuration section.`);
  }

  // Validate that all date objects are valid before formatting
  if (!currentStart || !currentEnd || !previousStart || !previousEnd ||
      isNaN(currentStart.getTime()) || isNaN(currentEnd.getTime()) ||
      isNaN(previousStart.getTime()) || isNaN(previousEnd.getTime())) {
      Logger.log(`Date calculation resulted in invalid dates. dateRangeType: ${dateRangeType}, CS: ${currentStart}, CE: ${currentEnd}, PS: ${previousStart}, PE: ${previousEnd}`);
      throw new Error("Date calculation resulted in invalid or undefined date objects. Check date logic for type: " + dateRangeType);
  }

  return {
    currentPeriodStart: formatDateForAds(currentStart),
    currentPeriodEnd: formatDateForAds(currentEnd),
    previousPeriodStart: formatDateForAds(previousStart),
    previousPeriodEnd: formatDateForAds(previousEnd)
  };
}

/**
 * Formats a Date object into YYYYMMDD string for AdsApp reports.
 * @param {Date} date - The date object to format.
 * @return {string} The formatted date string.
 */
function formatDateForAds(date) {
  // Using account timezone is crucial for consistency with Ads platform reporting
  const accountTimezone = AdsApp.currentAccount().getTimeZone();
  return Utilities.formatDate(date, accountTimezone, "yyyyMMdd");
}

/**
 * Optional: Helper to parse YYYYMMDD string to Date object.
 * Make sure to uncomment this function if you use CUSTOM_START_DATE and CUSTOM_END_DATE.
 * @param {string} yyyymmdd - Date string in YYYYMMDD format.
 * @return {Date} A Date object.
 */
function parseDate(yyyymmdd) {
    if (!/^\d{8}$/.test(yyyymmdd)) {
        Logger.log(`Invalid date string format: ${yyyymmdd}. Expected YYYYMMDD.`);
        throw new Error(`Invalid date string format: ${yyyymmdd}. Expected YYYYMMDD.`);
    }
    const year = parseInt(yyyymmdd.substring(0, 4), 10);
    const month = parseInt(yyyymmdd.substring(4, 6), 10) - 1; // JavaScript months are 0-11
    const day = parseInt(yyyymmdd.substring(6, 8), 10);

    // Create date in UTC to avoid local timezone shifts, then consider it as account's local date.
    // Or, more simply, rely on the fact that AdsApp reports use YYYYMMDD which is timezone-agnostic for whole days.
    const date = new Date(year, month, day);

    // Basic validation: check if the parsed date components match the input,
    // as new Date(2023, 12, 32) might create a valid but unintended date (e.g., Feb 1st, 2024)
    if (date.getFullYear() !== year || date.getMonth() !== month || date.getDate() !== day) {
        Logger.log(`Invalid date components for string: ${yyyymmdd}. Resulted in year ${date.getFullYear()}, month ${date.getMonth()}, day ${date.getDate()}`);
        // This check might be too strict if the input date is like "20240230" which becomes March 1st or 2nd.
        // For YYYYMMDD, we expect valid day/month combinations.
        throw new Error(`Invalid date string provided (e.g., day or month out of range): ${yyyymmdd}.`);
    }
    return date;
}

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

  // Clear only the necessary range (header + 1 data row for this script)
  if (data.length > 0 && data[0].length > 0) {
    // Determine rows to clear. If sheet has more rows than new data, clear them.
    // If new data has more rows (not in this specific script, but good practice), clear enough.
    const rowsToClear = Math.max(sheet.getLastRow(), data.length);
    if (rowsToClear > 0) { // Ensure there's something to clear
        const rangeToClear = sheet.getRange(1, 1, rowsToClear, data[0].length);
        rangeToClear.clearContent();
        rangeToClear.clearFormat(); // Also clear format if desired
        Logger.log(`Cleared range ${rangeToClear.getA1Notation()} in sheet "${SHEET_NAME}"`);
    }
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
  if (data.length > 0 && data[0].length > 0) { // Check if data and headers exist before formatting
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
}
