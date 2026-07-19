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
    const calculatedAccounts = accounts.map(function(account) {
      return Object.assign({}, account, { current_balance: accountCurrentBalance_(account, completedTransactions) });
    });

    const income = transactions.filter(function(row) { return row.type === 'income'; }).reduce(function(sum, row) { return sum + Number(row.amount || 0); }, 0);
    const expense = transactions.filter(function(row) { return row.type === 'expense'; }).reduce(function(sum, row) { return sum + Number(row.amount || 0); }, 0);
    const clientTransactions = allTransactions.filter(function(row) {
      return ['transfer', 'investment_buy'].indexOf(String(row.type)) === -1 || String(row.direction) !== 'in';
    });
    const data = {
      configured: accounts.length > 0,
      profile: {
        name: settingValue_('profile_name', 'Vinn'),
        storeName: String(settingValue_('app_name', VINN_CONFIG.APP_NAME)).toUpperCase() === 'VINN STORE' ? VINN_CONFIG.APP_NAME : settingValue_('app_name', VINN_CONFIG.APP_NAME),
        currency: settingValue_('currency', VINN_CONFIG.CURRENCY),
        timezone: settingValue_('timezone', VINN_CONFIG.TIMEZONE)
      },
      summary: { income: income, expense: expense, cashflow: income - expense, savingsRate: income ? (income - expense) / income * 100 : 0 },
      accounts: calculatedAccounts,
      budgets: rowsAsObjects_(VINN_CONFIG.SHEETS.BUDGETS).filter(function(row) { return String(row.month) === month; }),
      goals: rowsAsObjects_(VINN_CONFIG.SHEETS.GOALS), bills: rowsAsObjects_(VINN_CONFIG.SHEETS.BILLS),
      categories: categoryRows_().filter(function(category) { return !category.archived; }),
      auditLogs: recentAuditLogs_(20),
      investmentAssets: investmentAssetClientRows_(),
      investmentTransactions: rowsAsObjects_(VINN_CONFIG.SHEETS.INVESTMENT_TX).map(investmentTransactionClientRow_),
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
