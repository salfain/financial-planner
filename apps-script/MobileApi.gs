const VINN_MOBILE_API = Object.freeze({
  MAX_REQUEST_BYTES: 13 * 1024 * 1024,
  MIN_ACCESS_KEY_LENGTH: 32,
  MAX_ACCESS_KEY_LENGTH: 256,
  CACHE_SECONDS: 21600,
  ALLOWED_ACTIONS: Object.freeze([
    'setup', 'health', 'mutationStatus', 'bootstrap',
    'licenseStatus', 'activateLicense', 'deactivateLicense',
    'setupWorkspace', 'upgradeWorkspace', 'updateProfile', 'updateFeaturePreferences',
    'getRoadmapSettings', 'updateRoadmapSettings',
    'getDebtPlanner', 'updateDebtPlanner',
    'getCashflowForecastSettings', 'updateCashflowForecastSettings',
    'getEmergencyFundSettings', 'updateEmergencyFundSettings',
    'getZakatSettings', 'updateZakatSettings',
    'monthlyClosingStatus', 'closeMonthlyBook', 'reopenMonthlyBook',
    'createAccount', 'createReceivable', 'updateAccount', 'importAccounts', 'archiveAccount',
    'createTransaction', 'recordLoanDrawdown', 'updateTransaction',
    'listTransactions', 'deleteTransaction', 'importTransactions',
    'undoTransaction', 'attachTransactionReceipt', 'deleteTransactionReceipt',
    'reconcileAccount', 'inspectLedger', 'repairLedger',
    'listCategories', 'createCategory', 'updateCategory', 'archiveCategory',
    'categoryRules', 'createCategoryRule', 'updateCategoryRule', 'deleteCategoryRule',
    'listAuditLogs', 'upsertBudget', 'updateBudget', 'deleteBudget',
    'createGoal', 'updateGoal', 'deleteGoal', 'contributeGoal',
    'createSinkingFund', 'updateSinkingFund', 'archiveSinkingFund', 'adjustSinkingFund',
    'createBill', 'updateBill', 'deleteBill', 'markBillPaid',
    'listRecurring', 'createRecurring', 'updateRecurring', 'confirmRecurring',
    'createInvestmentAsset', 'updateInvestmentAsset', 'createInvestmentTrade',
    'backup', 'createBackup', 'backupOverview', 'updateBackupSchedule',
    'listReports', 'saveReportPdf', 'migrationHistory', 'previewMigration',
    'applyMigration', 'cancelMigration', 'notificationOverview',
    'updateNotificationSettings', 'updateNotificationState',
    'saveAiKey', 'aiKeyStatus', 'aiSettings', 'updateAiSettings',
    'aiHistory', 'askAi', 'clearAiHistory', 'ocrReceipt'
  ]),
  READ_ACTIONS: Object.freeze([
    'health', 'mutationStatus', 'bootstrap', 'licenseStatus',
    'getRoadmapSettings', 'getDebtPlanner', 'getCashflowForecastSettings',
    'getEmergencyFundSettings', 'getZakatSettings', 'monthlyClosingStatus', 'listTransactions',
    'inspectLedger', 'listCategories', 'categoryRules', 'listAuditLogs',
    'listRecurring', 'backupOverview', 'listReports', 'migrationHistory',
    'notificationOverview', 'aiKeyStatus', 'aiSettings', 'aiHistory'
  ])
});

/**
 * HTTPS JSON entry point used only by the mobile API deployment.
 * Keep Main.gs out of the public deployment so doGet/google.script.run remain owner-only.
 */
function doPost(e) {
  let requestId = null;
  try {
    const request = parseMobileRequest_(e);
    requestId = request.requestId;
    verifyMobileAccessKey_(request.accessKey);

    const payload = Object.assign({}, request.payload, { requestId: requestId });
    delete payload.accessKey;
    delete payload.idToken;
    const result = mobileActionIsMutation_(request.action)
      ? executeMobileMutation_(request.action, payload, requestId)
      : api(request.action, payload);
    return mobileJsonOutput_(normalizeMobileEnvelope_(result, requestId));
  } catch (error) {
    return mobileJsonOutput_(fail_(sanitizeMobileApiError_(error), requestId));
  }
}

function parseMobileRequest_(event) {
  const postData = event && event.postData;
  const contents = postData && typeof postData.contents === 'string' ? postData.contents : '';
  if (!contents) throw createError_('EMPTY_REQUEST', 'Body JSON wajib diisi.');

  const measuredLength = Number(postData.length);
  const requestBytes = isFinite(measuredLength) && measuredLength > 0
    ? measuredLength
    : Utilities.newBlob(contents).getBytes().length;
  if (requestBytes > VINN_MOBILE_API.MAX_REQUEST_BYTES) {
    throw createError_('PAYLOAD_TOO_LARGE', 'Ukuran request melebihi batas 13 MB.');
  }

  let body;
  try { body = JSON.parse(contents); }
  catch (_error) { throw createError_('INVALID_JSON', 'Body request harus berupa JSON yang valid.'); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw createError_('INVALID_REQUEST', 'Body request harus berupa object JSON.');
  }

  const action = String(body.action || '').trim();
  if (!action || VINN_MOBILE_API.ALLOWED_ACTIONS.indexOf(action) === -1) {
    throw createError_('ACTION_NOT_ALLOWED', 'Aksi mobile tidak diizinkan.');
  }

  const requestId = String(body.requestId || '').trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)) {
    throw createError_('INVALID_REQUEST_ID', 'requestId mobile wajib berupa UUID v4.');
  }

  const accessKey = String(body.accessKey || '').trim();
  if (!accessKey) throw createError_('AUTH_REQUIRED', 'Access key pribadi diperlukan.');
  if (accessKey.length < VINN_MOBILE_API.MIN_ACCESS_KEY_LENGTH || accessKey.length > VINN_MOBILE_API.MAX_ACCESS_KEY_LENGTH) {
    throw createError_('AUTH_INVALID', 'Access key pribadi tidak valid.');
  }

  const payload = body.payload === undefined ? {} : body.payload;
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw createError_('INVALID_PAYLOAD', 'payload harus berupa object JSON.');
  }
  return { action: action, requestId: requestId, accessKey: accessKey, payload: payload };
}

function verifyMobileAccessKey_(accessKey) {
  const properties = PropertiesService.getScriptProperties();
  const enabled = String(properties.getProperty('VINN_MOBILE_API_ENABLED') || '').toLowerCase();
  const expectedHash = String(properties.getProperty('VINN_MOBILE_ACCESS_KEY_SHA256') || '').trim().toLowerCase();
  if (!enabled || !expectedHash) {
    throw createError_('MOBILE_API_NOT_CONFIGURED', 'API mobile belum dikonfigurasi oleh pemilik.');
  }
  if (enabled !== 'true') throw createError_('MOBILE_API_DISABLED', 'Akses mobile sedang dinonaktifkan oleh pemilik.');
  if (!/^[0-9a-f]{64}$/.test(expectedHash)) {
    throw createError_('MOBILE_API_NOT_CONFIGURED', 'Hash access key mobile tidak valid.');
  }
  const actualHash = mobileDigest_(accessKey);
  if (!mobileConstantTimeEquals_(actualHash, expectedHash)) {
    throw createError_('AUTH_INVALID', 'URL atau access key pribadi tidak cocok.');
  }
  return true;
}

function mobileConstantTimeEquals_(left, right) {
  const a = String(left || '');
  const b = String(right || '');
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let index = 0; index < a.length; index += 1) mismatch |= a.charCodeAt(index) ^ b.charCodeAt(index);
  return mismatch === 0;
}

function mobileActionIsMutation_(action) {
  return VINN_MOBILE_API.READ_ACTIONS.indexOf(action) === -1;
}

function executeMobileMutation_(action, payload, requestId) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) throw createError_('LOCK_TIMEOUT', 'Request lain sedang diproses. Coba lagi beberapa saat.');
  try {
    const cache = CacheService.getScriptCache();
    const cacheKey = 'mobile-mutation:' + mobileDigest_(requestId);
    const cached = cache.get(cacheKey);
    if (cached) {
      const record = JSON.parse(cached);
      if (String(record.action) !== action) {
        throw createError_('REQUEST_ID_REUSED', 'requestId sudah digunakan oleh operasi lain.');
      }
      return record.response;
    }

    const auditRows = typeof recentAuditRows_ === 'function'
      ? recentAuditRows_(500).reverse()
      : rowsAsObjects_(VINN_CONFIG.SHEETS.AUDIT_LOG).reverse().slice(0, 500);
    const mobileCommit = auditRows.find(function(row) {
      return String(row.request_id) === requestId && String(row.action) === 'MOBILE_API_COMMIT';
    });
    if (mobileCommit) {
      const details = parseJsonObject_(mobileCommit.details_json);
      if (String(details.routerAction || '') !== action) {
        throw createError_('REQUEST_ID_REUSED', 'requestId sudah digunakan oleh operasi lain.');
      }
      return ok_({ committed: true, duplicate: true }, requestId);
    }
    const priorAudit = auditRows.find(function(row) { return String(row.request_id) === requestId; });
    if (priorAudit) return ok_({ committed: true, duplicate: true }, requestId);

    const result = normalizeMobileEnvelope_(api(action, payload), requestId);
    if (result.ok) {
      withDocumentLock_(function() {
        const alreadyRecorded = rowsAsObjects_(VINN_CONFIG.SHEETS.AUDIT_LOG).some(function(row) {
          return String(row.request_id) === requestId && String(row.action) === 'MOBILE_API_COMMIT';
        });
        if (!alreadyRecorded) audit_('MOBILE_API_COMMIT', 'mobile_api', action, requestId, { routerAction: action });
      });
      try {
        cache.put(cacheKey, JSON.stringify({ action: action, response: result }), VINN_MOBILE_API.CACHE_SECONDS);
      } catch (_error) {
        // Large responses (for example setup bootstrap) can exceed cache limits.
      }
    }
    return result;
  } finally {
    lock.releaseLock();
  }
}

function normalizeMobileEnvelope_(value, requestId) {
  if (!value || typeof value !== 'object' || typeof value.ok !== 'boolean') {
    throw createError_('INVALID_API_RESPONSE', 'Router menghasilkan respons yang tidak valid.');
  }
  const envelope = Object.assign({}, value);
  envelope.requestId = requestId;
  envelope.timestamp = envelope.timestamp || nowIso_();
  return envelope;
}

function mobileDigest_(value) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(value), Utilities.Charset.UTF_8)
    .map(function(byte) { return ('0' + ((byte < 0 ? byte + 256 : byte).toString(16))).slice(-2); })
    .join('');
}

function sanitizeMobileApiError_(error) {
  if (error && error.code) return createError_(String(error.code), String(error.message || 'Permintaan gagal.'), error.details || null);
  return createError_('INTERNAL_ERROR', 'Terjadi kesalahan yang tidak terduga.');
}

function mobileJsonOutput_(envelope) {
  return ContentService.createTextOutput(JSON.stringify(envelope))
    .setMimeType(ContentService.MimeType.JSON);
}
