function apiGetBootstrap(month) {
  try {
    month = month || Utilities.formatDate(new Date(), VINN_CONFIG.TIMEZONE, 'yyyy-MM');
    const cache = CacheService.getDocumentCache();
    const cacheKey = 'dashboard:' + month;
    const cached = cache.get(cacheKey);
    if (cached) return ok_(JSON.parse(cached));

    const accounts = rowsAsObjects_(VINN_CONFIG.SHEETS.ACCOUNTS).filter(function(row) { return row.is_active !== false; });
    const transactions = rowsAsObjects_(VINN_CONFIG.SHEETS.TRANSACTIONS).filter(function(row) {
      return !row.deleted_at && String(row.date).slice(0, 7) === month;
    });
    const deltas = {};
    transactions.forEach(function(row) {
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
    const data = {
      profile: { name: 'Vinn', storeName: VINN_CONFIG.APP_NAME, currency: VINN_CONFIG.CURRENCY, timezone: VINN_CONFIG.TIMEZONE },
      summary: { income: income, expense: expense, cashflow: income - expense, savingsRate: income ? (income - expense) / income * 100 : 0 },
      accounts: calculatedAccounts,
      budgets: rowsAsObjects_(VINN_CONFIG.SHEETS.BUDGETS), goals: rowsAsObjects_(VINN_CONFIG.SHEETS.GOALS),
      bills: rowsAsObjects_(VINN_CONFIG.SHEETS.BILLS), transactions: transactions.slice(-20).reverse()
    };
    cache.put(cacheKey, JSON.stringify(data), VINN_CONFIG.CACHE_SECONDS);
    return ok_(data);
  } catch (error) { return fail_(error); }
}
