function nowIso_() {
  return Utilities.formatDate(new Date(), VINN_CONFIG.TIMEZONE, "yyyy-MM-dd'T'HH:mm:ssXXX");
}

function dateIso_(date) {
  const value = date ? new Date(date) : new Date();
  return Utilities.formatDate(value, VINN_CONFIG.TIMEZONE, 'yyyy-MM-dd');
}

function id_(prefix) {
  return prefix + '-' + Utilities.getUuid();
}

function dashboardCacheVersion_() {
  return PropertiesService.getDocumentProperties().getProperty('VINN_CACHE_VERSION') || '1';
}

function dashboardCacheKey_(period) {
  const month = period && /^\d{4}-\d{2}$/.test(String(period))
    ? String(period)
    : Utilities.formatDate(new Date(), VINN_CONFIG.TIMEZONE, 'yyyy-MM');
  return 'dashboard:' + dashboardCacheVersion_() + ':' + month;
}

// CacheService membatasi satu nilai sampai 100 KB. Sisakan ruang dari batas
// tersebut agar perbedaan penghitungan byte tidak membuat bootstrap gagal.
const DASHBOARD_CACHE_SAFE_VALUE_BYTES = 90 * 1024;

function utf8ByteLength_(value) {
  const text = String(value || '');
  let bytes = 0;
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    if (code < 0x80) {
      bytes += 1;
    } else if (code < 0x800) {
      bytes += 2;
    } else if (code >= 0xD800 && code <= 0xDBFF && index + 1 < text.length) {
      const next = text.charCodeAt(index + 1);
      if (next >= 0xDC00 && next <= 0xDFFF) {
        bytes += 4;
        index += 1;
      } else {
        bytes += 3;
      }
    } else {
      bytes += 3;
    }
  }
  return bytes;
}

function readDashboardCache_(cache, cacheKey) {
  if (!cache) return null;
  try {
    const cached = cache.get(cacheKey);
    if (!cached) return null;
    return JSON.parse(cached);
  } catch (error) {
    console.warn('Cache dashboard tidak dapat dibaca dan akan dihitung ulang: ' + (error && error.message ? error.message : error));
    try { cache.remove(cacheKey); } catch (removeError) { /* Cache tetap bersifat opsional. */ }
    return null;
  }
}

function writeDashboardCache_(cache, cacheKey, data) {
  if (!cache) return false;
  try {
    const serialized = JSON.stringify(data);
    const payloadBytes = utf8ByteLength_(serialized);
    if (payloadBytes > DASHBOARD_CACHE_SAFE_VALUE_BYTES) {
      console.warn('Cache dashboard dilewati karena payload berukuran ' + payloadBytes + ' byte.');
      return false;
    }
    cache.put(cacheKey, serialized, VINN_CONFIG.CACHE_SECONDS);
    return true;
  } catch (error) {
    // Cache tidak pernah menjadi sumber kebenaran. Jika Google menolak nilai,
    // bootstrap tetap dikembalikan langsung dari Google Sheets.
    console.warn('Cache dashboard dilewati: ' + (error && error.message ? error.message : error));
    return false;
  }
}

function invalidateDashboard_(period) {
  const month = period && /^\d{4}-\d{2}$/.test(String(period))
    ? String(period)
    : Utilities.formatDate(new Date(), VINN_CONFIG.TIMEZONE, 'yyyy-MM');
  const cache = CacheService.getDocumentCache();
  cache.remove(dashboardCacheKey_(month));
  cache.remove('dashboard:' + month);
  PropertiesService.getDocumentProperties().setProperty('VINN_CACHE_VERSION', Utilities.getUuid());
}

function createError_(code, message, details) {
  const error = new Error(message);
  error.code = code;
  error.details = details || null;
  return error;
}

function ok_(data, requestId) {
  return { ok: true, data: data, requestId: requestId || null, timestamp: nowIso_() };
}

function fail_(error, requestId) {
  console.error(error && error.stack ? error.stack : error);
  return {
    ok: false,
    error: {
      code: error.code || 'INTERNAL_ERROR',
      message: error.message || 'Terjadi kesalahan yang tidak terduga.',
      details: error.details || null
    },
    requestId: requestId || null,
    timestamp: nowIso_()
  };
}

function assertPositiveMoney_(value) {
  const amount = Number(value);
  if (!isFinite(amount) || amount <= 0) throw createError_('INVALID_AMOUNT', 'Nominal harus lebih besar dari nol.');
  return Math.round(amount);
}

function assertMoney_(value, label) {
  const amount = Number(value);
  if (!isFinite(amount) || Math.abs(amount) > Number.MAX_SAFE_INTEGER) {
    throw createError_('INVALID_AMOUNT', (label || 'Nominal') + ' tidak valid.');
  }
  return Math.round(amount);
}

function hasOwn_(object, key) {
  return Boolean(object) && Object.prototype.hasOwnProperty.call(object, key);
}

function truthy_(value) {
  return value === true || value === 1 || String(value).toLowerCase() === 'true';
}

function requireRequestId_(payload) {
  const requestId = String(payload && payload.requestId || '').trim();
  if (!requestId) throw createError_('REQUEST_ID_REQUIRED', 'requestId wajib diisi untuk mencegah penyimpanan ganda.');
  if (requestId.length > 200) throw createError_('INVALID_REQUEST_ID', 'requestId terlalu panjang.');
  return requestId;
}

function transactionMovement_(transaction) {
  if (!transaction || transaction.deleted_at || String(transaction.status || 'completed') !== 'completed') return 0;
  const amount = Number(transaction.amount || 0);
  if (!isFinite(amount)) return 0;
  const direction = String(transaction.direction || '');
  if (direction === 'in') return amount;
  if (direction === 'out') return -amount;
  const type = String(transaction.type || '');
  if (type === 'income' || type === 'refund' || type === 'adjustment_in') return amount;
  if (type === 'expense' || type === 'adjustment_out') return -amount;
  return 0;
}

function accountCurrentBalance_(account, transactions) {
  const movement = (transactions || []).reduce(function(total, transaction) {
    if (String(transaction.account_id) !== String(account.id)) return total;
    return total + transactionMovement_(transaction);
  }, 0);
  const opening = Number(account.opening_balance || 0);
  return Math.round(truthy_(account.is_liability) ? opening - movement : opening + movement);
}

function transactionMovementsByAccount_(transactions) {
  return (transactions || []).reduce(function(result, transaction) {
    const accountId = String(transaction.account_id || '');
    if (!accountId) return result;
    result[accountId] = (result[accountId] || 0) + transactionMovement_(transaction);
    return result;
  }, {});
}

function accountCurrentBalanceFromMovements_(account, movementsByAccount) {
  const movement = Number((movementsByAccount || {})[String(account.id)] || 0);
  const opening = Number(account.opening_balance || 0);
  return Math.round(truthy_(account.is_liability) ? opening - movement : opening + movement);
}

function transactionBalanceEffect_(account, transaction) {
  const movement = transactionMovement_(transaction);
  return truthy_(account.is_liability) ? -movement : movement;
}

function validateLedgerMutation_(previousTransactions, nextTransactions) {
  assertMonthlyPeriodsOpen_((previousTransactions || []).concat(nextTransactions || []));
  const currentTransactions = rowsAsObjects_(VINN_CONFIG.SHEETS.TRANSACTIONS);
  const accounts = {};
  const deltas = {};
  const allRows = (previousTransactions || []).concat(nextTransactions || []);

  allRows.forEach(function(transaction) {
    const accountId = String(transaction.account_id || '');
    if (!accountId) throw createError_('ACCOUNT_NOT_FOUND', 'Akun transaksi tidak ditemukan.');
    if (!accounts[accountId]) {
      const account = findById_(VINN_CONFIG.SHEETS.ACCOUNTS, accountId);
      const active = account && (account.is_active === '' || account.is_active === undefined || account.is_active === null || truthy_(account.is_active));
      if (!active) throw createError_('ACCOUNT_NOT_FOUND', 'Akun ' + accountId + ' tidak ditemukan atau sudah diarsipkan.', { accountId: accountId });
      accounts[accountId] = account;
      deltas[accountId] = 0;
    }
  });

  (previousTransactions || []).forEach(function(transaction) {
    const accountId = String(transaction.account_id);
    deltas[accountId] -= transactionBalanceEffect_(accounts[accountId], transaction);
  });
  (nextTransactions || []).forEach(function(transaction) {
    const accountId = String(transaction.account_id);
    deltas[accountId] += transactionBalanceEffect_(accounts[accountId], transaction);
  });

  Object.keys(deltas).forEach(function(accountId) {
    const delta = deltas[accountId];
    if (!delta) return;
    const available = accountCurrentBalance_(accounts[accountId], currentTransactions);
    const nextBalance = available + delta;
    if (!Number.isSafeInteger(nextBalance) || nextBalance < 0) {
      throw createError_('INSUFFICIENT_BALANCE', 'Saldo akun ' + accountId + ' tidak cukup untuk transaksi ini.', {
        accountId: accountId, available: available, delta: delta, nextBalance: nextBalance
      });
    }
  });
  return deltas;
}

function audit_(action, moduleName, entityId, requestId, details) {
  appendObjects_(VINN_CONFIG.SHEETS.AUDIT_LOG, [{
    id: id_('audit'), request_id: requestId || '', action: action, module: moduleName,
    entity_id: entityId || '', actor_email: Session.getActiveUser().getEmail() || 'owner',
    details_json: JSON.stringify(details || {}), created_at: nowIso_()
  }]);
}
