const PERFORMANCE_BENCHMARK_PROPERTY = 'FINANCIAL_PLANNER_LAST_PERFORMANCE_BENCHMARK';
const PERFORMANCE_BENCHMARK_ROWS = 10000;

function performanceMeasure_(callback) {
  const startedAt = Date.now();
  const value = callback();
  return { durationMs: Date.now() - startedAt, value: value };
}

function performanceRating_(metrics) {
  const limits = {
    coldBootstrapMs: 10000,
    warmBootstrapMs: 2500,
    liveSearchMs: 5000,
    temporaryWrite10000Ms: 30000,
    temporaryRead10000Ms: 15000,
    temporarySearch10000Ms: 1500,
    temporarySaveMs: 5000
  };
  const warnings = Object.keys(limits).filter(function(key) {
    return Number(metrics[key] || 0) > limits[key];
  });
  return { status: warnings.length ? 'attention' : 'healthy', warnings: warnings, limits: limits };
}

function performanceTemporaryDataset_(rowCount) {
  const rows = [];
  for (let index = 0; index < rowCount; index += 1) {
    rows.push([
      'perf-' + index,
      '2026-' + String(index % 12 + 1).padStart(2, '0') + '-' + String(index % 28 + 1).padStart(2, '0'),
      index % 3 === 0 ? 'income' : 'expense',
      'Akun benchmark ' + (index % 8),
      index + 1000,
      index % 5 === 0 ? 'Tagihan' : 'Makanan',
      index === rowCount - 1 ? 'MERCHANT-BENCHMARK-TARGET' : 'Merchant ' + (index % 250),
      'Catatan benchmark ' + index,
      index % 2 === 0 ? 'completed' : 'pending',
      'benchmark-tag-' + (index % 25)
    ]);
  }
  return rows;
}

function runFinancialPlannerPerformanceBenchmark() {
  const period = Utilities.formatDate(new Date(), VINN_CONFIG.TIMEZONE, 'yyyy-MM');
  const transactionsSheet = getWorkbook_().getSheetByName(VINN_CONFIG.SHEETS.TRANSACTIONS);
  const accountsSheet = getWorkbook_().getSheetByName(VINN_CONFIG.SHEETS.ACCOUNTS);
  const cache = CacheService.getDocumentCache();
  cache.remove(dashboardCacheKey_(period));

  const coldBootstrap = performanceMeasure_(function() { return apiGetBootstrap(period); });
  const warmBootstrap = performanceMeasure_(function() { return apiGetBootstrap(period); });
  const liveSearch = performanceMeasure_(function() {
    return apiListTransactions({ page: 1, pageSize: 25, query: 'benchmark-no-match' });
  });

  const workbook = getWorkbook_();
  let temporarySheet = null;
  let temporaryWrite = null;
  let temporaryRead = null;
  let temporarySearch = null;
  let temporarySave = null;
  let searchMatches = 0;
  try {
    temporarySheet = workbook.insertSheet('__PerformanceBenchmark_' + Date.now());
    const sheet = temporarySheet;
    const headers = [['id', 'date', 'type', 'account', 'amount', 'category', 'merchant', 'notes', 'status', 'tags']];
    sheet.getRange(1, 1, 1, headers[0].length).setValues(headers);
    const rows = performanceTemporaryDataset_(PERFORMANCE_BENCHMARK_ROWS);

    temporaryWrite = performanceMeasure_(function() {
      sheet.getRange(2, 1, rows.length, headers[0].length).setValues(rows);
      SpreadsheetApp.flush();
      return rows.length;
    });
    temporaryRead = performanceMeasure_(function() {
      return sheet.getRange(2, 1, rows.length, headers[0].length).getValues();
    });
    temporarySearch = performanceMeasure_(function() {
      return temporaryRead.value.filter(function(row) {
        return [row[5], row[6], row[7], row[9]].join(' ').toLowerCase().indexOf('merchant-benchmark-target') !== -1;
      });
    });
    searchMatches = temporarySearch.value.length;
    temporarySave = performanceMeasure_(function() {
      const nextRow = sheet.getLastRow() + 1;
      sheet.getRange(nextRow, 1, 1, headers[0].length).setValues([[
        'perf-save', '2026-07-30', 'expense', 'Akun benchmark', 5000,
        'Makanan', 'Simpan benchmark', 'Uji simpan satu baris', 'completed', 'benchmark'
      ]]);
      sheet.getRange(nextRow, 8).setValue('Uji simpan diperbarui');
      sheet.deleteRow(nextRow);
      SpreadsheetApp.flush();
      return true;
    });
  } finally {
    if (temporarySheet) workbook.deleteSheet(temporarySheet);
  }

  const metrics = {
    coldBootstrapMs: coldBootstrap.durationMs,
    warmBootstrapMs: warmBootstrap.durationMs,
    liveSearchMs: liveSearch.durationMs,
    temporaryWrite10000Ms: temporaryWrite.durationMs,
    temporaryRead10000Ms: temporaryRead.durationMs,
    temporarySearch10000Ms: temporarySearch.durationMs,
    temporarySaveMs: temporarySave.durationMs
  };
  const result = {
    application: VINN_CONFIG.APP_NAME,
    checkedAt: nowIso_(),
    spreadsheetId: getWorkbook_().getId(),
    activeRows: {
      accounts: accountsSheet ? Math.max(0, accountsSheet.getLastRow() - 1) : 0,
      transactions: transactionsSheet ? Math.max(0, transactionsSheet.getLastRow() - 1) : 0
    },
    payloadBytes: JSON.stringify(coldBootstrap.value || {}).length,
    searchMatches: searchMatches,
    metrics: metrics,
    rating: performanceRating_(metrics),
    cleanup: 'temporary_sheet_deleted'
  };
  PropertiesService.getDocumentProperties().setProperty(PERFORMANCE_BENCHMARK_PROPERTY, JSON.stringify(result));
  console.log(JSON.stringify(result, null, 2));
  return result;
}

function getLastFinancialPlannerPerformanceBenchmark() {
  const stored = PropertiesService.getDocumentProperties().getProperty(PERFORMANCE_BENCHMARK_PROPERTY);
  const result = stored ? JSON.parse(stored) : { status: 'not_run' };
  console.log(JSON.stringify(result, null, 2));
  return result;
}
