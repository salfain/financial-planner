function apiGetBootstrap(month) {
  try {
    month = month || Utilities.formatDate(new Date(), VINN_CONFIG.TIMEZONE, 'yyyy-MM');
    const cache = CacheService.getDocumentCache();
    const cacheKey = dashboardCacheKey_(month);
    const cached = cache.get(cacheKey);
    if (cached) return ok_(JSON.parse(cached));

    const accounts = rowsAsObjects_(VINN_CONFIG.SHEETS.ACCOUNTS).filter(accountIsActive_);
    const allTransactions = rowsAsObjects_(VINN_CONFIG.SHEETS.TRANSACTIONS).filter(function(row) { return !row.deleted_at; });
    const completedTransactions = allTransactions.filter(function(row) { return String(row.status || 'completed') === 'completed'; });
    const transactions = completedTransactions.filter(function(row) { return String(row.date).slice(0, 7) === month; });
    const movementsByAccount = transactionMovementsByAccount_(completedTransactions);
    const calculatedAccounts = accounts.map(function(account) {
      return Object.assign({}, account, { current_balance: accountCurrentBalanceFromMovements_(account, movementsByAccount) });
    });

    const settings = rowsAsObjects_(VINN_CONFIG.SHEETS.SETTINGS);
    const setting = function(key, fallback) {
      const row = settings.find(function(item) { return String(item.key) === String(key); });
      return row ? String(row.value) : fallback;
    };

    const income = transactions.filter(function(row) { return row.type === 'income'; }).reduce(function(sum, row) { return sum + Number(row.amount || 0); }, 0);
    const expense = transactions.filter(function(row) { return row.type === 'expense'; }).reduce(function(sum, row) { return sum + Number(row.amount || 0); }, 0);
    const clientTransactions = allTransactions.filter(function(row) {
      return ['transfer', 'investment_buy'].indexOf(String(row.type)) === -1 || String(row.direction) !== 'in';
    });
    const investmentTransactions = rowsAsObjects_(VINN_CONFIG.SHEETS.INVESTMENT_TX);
    const data = {
      configured: accounts.length > 0,
      schemaVersion: VINN_CONFIG.SCHEMA_VERSION,
      entitlement: licenseStatus_(),
      profile: {
        name: setting('profile_name', 'Pemilik'),
        storeName: String(setting('app_name', VINN_CONFIG.APP_NAME)).toUpperCase() === 'VINN STORE' ? VINN_CONFIG.APP_NAME : setting('app_name', VINN_CONFIG.APP_NAME),
        currency: setting('currency', VINN_CONFIG.CURRENCY),
        timezone: setting('timezone', VINN_CONFIG.TIMEZONE)
      },
      featurePreferences: normalizeFeaturePreferencesGs_(setting('feature_preferences', '')),
      summary: { income: income, expense: expense, cashflow: income - expense, savingsRate: income ? (income - expense) / income * 100 : 0 },
      accounts: calculatedAccounts,
      budgets: rowsAsObjects_(VINN_CONFIG.SHEETS.BUDGETS).filter(function(row) { return String(row.month) === month; }),
      goals: rowsAsObjects_(VINN_CONFIG.SHEETS.GOALS), bills: rowsAsObjects_(VINN_CONFIG.SHEETS.BILLS),
      recurring: rowsAsObjects_(VINN_CONFIG.SHEETS.RECURRING).map(recurringClientRow_),
      sinkingFunds: rowsAsObjects_(VINN_CONFIG.SHEETS.SINKING_FUNDS).filter(function(row) { return truthy_(row.is_active); }).map(sinkingFundClientRow_),
      sinkingFundEntries: rowsAsObjects_(VINN_CONFIG.SHEETS.SINKING_FUND_ENTRIES).map(sinkingFundEntryClientRow_).sort(function(a, b) { return String(b.date).localeCompare(String(a.date)) || String(b.createdAt).localeCompare(String(a.createdAt)); }).slice(0, 200),
      categories: categoryRows_().filter(function(category) { return !category.archived; }),
      categoryRules: normalizeCategoryRulesGs_(setting(CATEGORY_RULES_SETTING_KEY, '[]')),
      auditLogs: recentAuditLogs_(20),
      investmentAssets: investmentAssetClientRows_(investmentTransactions),
      investmentTransactions: investmentTransactions.map(investmentTransactionClientRow_),
      transactions: clientTransactions.sort(function(a, b) {
        return String(b.date).localeCompare(String(a.date)) || String(b.created_at).localeCompare(String(a.created_at));
      })
    };
    cache.put(cacheKey, JSON.stringify(data), VINN_CONFIG.CACHE_SECONDS);
    return ok_(data);
  } catch (error) { return fail_(error); }
}

function settingValue_(key, fallback) {
  const setting = rowsAsObjects_(VINN_CONFIG.SHEETS.SETTINGS).find(function(row) { return String(row.key) === String(key); });
  return setting ? String(setting.value) : fallback;
}
