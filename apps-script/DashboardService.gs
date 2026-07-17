function apiGetBootstrap(month) {
  try {
    month = month || Utilities.formatDate(new Date(), VINN_CONFIG.TIMEZONE, 'yyyy-MM');
    const cache = CacheService.getDocumentCache();
    const cacheKey = 'dashboard:' + month;
    const cached = cache.get(cacheKey);
    if (cached) return ok_(JSON.parse(cached));

    const accounts = rowsAsObjects_(VINN_CONFIG.SHEETS.ACCOUNTS).filter(function(row) {
      return row.is_active !== false && String(row.is_active).toLowerCase() !== 'false';
    });
    const allTransactions = rowsAsObjects_(VINN_CONFIG.SHEETS.TRANSACTIONS).filter(function(row) { return !row.deleted_at; });
    const completedTransactions = allTransactions.filter(function(row) { return String(row.status || 'completed') === 'completed'; });
    const transactions = allTransactions.filter(function(row) { return String(row.date).slice(0, 7) === month; });
    const deltas = {};
    completedTransactions.forEach(function(row) {
      const accountId = String(row.account_id);
      if (!deltas[accountId]) deltas[accountId] = 0;
      if (row.type === 'income' || row.type === 'refund' || row.direction === 'in') deltas[accountId] += Number(row.amount || 0);
      if (row.type === 'expense' || row.direction === 'out') deltas[accountId] -= Number(row.amount || 0);
    });
    const calculatedAccounts = accounts.map(function(account) {
      const opening = Number(account.opening_balance || 0);
      const isLiability = account.is_liability === true || String(account.is_liability).toLowerCase() === 'true';
      const delta = deltas[String(account.id)] || 0;
      return Object.assign({}, account, { current_balance: isLiability ? opening - delta : opening + delta });
    });

    const income = transactions.filter(function(row) { return row.type === 'income'; }).reduce(function(sum, row) { return sum + Number(row.amount || 0); }, 0);
    const expense = transactions.filter(function(row) { return row.type === 'expense'; }).reduce(function(sum, row) { return sum + Number(row.amount || 0); }, 0);
    const clientTransactions = allTransactions.filter(function(row) {
      return String(row.type) !== 'transfer' || String(row.direction) !== 'in';
    });
    const data = {
      configured: accounts.length > 0,
      profile: {
        name: settingValue_('profile_name', 'Vinn'),
        storeName: settingValue_('app_name', VINN_CONFIG.APP_NAME),
        currency: settingValue_('currency', VINN_CONFIG.CURRENCY),
        timezone: settingValue_('timezone', VINN_CONFIG.TIMEZONE)
      },
      summary: { income: income, expense: expense, cashflow: income - expense, savingsRate: income ? (income - expense) / income * 100 : 0 },
      accounts: calculatedAccounts,
      budgets: rowsAsObjects_(VINN_CONFIG.SHEETS.BUDGETS).filter(function(row) { return String(row.month) === month; }),
      goals: rowsAsObjects_(VINN_CONFIG.SHEETS.GOALS), bills: rowsAsObjects_(VINN_CONFIG.SHEETS.BILLS),
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
