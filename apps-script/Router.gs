function api(action, payload) {
  const routes = {
    setup: function() { return setupVinnStore(); },
    health: function() { return apiHealthCheck(); },
    bootstrap: function() { return apiGetBootstrap(payload && payload.month); },
    createTransaction: function() { return apiCreateTransaction(payload || {}); },
    listTransactions: function() { return apiListTransactions(payload || {}); },
    deleteTransaction: function() { return apiDeleteTransaction(payload.transactionId, payload.requestId); },
    backup: function() { return apiCreateBackup(); },
    saveAiKey: function() { return apiSaveAiKey(payload.provider, payload.apiKey); },
    aiKeyStatus: function() { return apiAiKeyStatus(payload && payload.provider); }
  };
  try {
    if (!routes[action]) throw createError_('ROUTE_NOT_FOUND', 'Aksi API tidak dikenal: ' + action);
    return routes[action]();
  } catch (error) { return fail_(error, payload && payload.requestId); }
}
