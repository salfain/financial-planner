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

function invalidateDashboard_(period) {
  const month = period && /^\d{4}-\d{2}$/.test(String(period))
    ? String(period)
    : Utilities.formatDate(new Date(), VINN_CONFIG.TIMEZONE, 'yyyy-MM');
  CacheService.getDocumentCache().remove('dashboard:' + month);
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
      message: error.message || 'Terjadi kesalahan yang tidak terduga.'
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

function audit_(action, moduleName, entityId, requestId, details) {
  appendObjects_(VINN_CONFIG.SHEETS.AUDIT_LOG, [{
    id: id_('audit'), request_id: requestId || '', action: action, module: moduleName,
    entity_id: entityId || '', actor_email: Session.getActiveUser().getEmail() || 'owner',
    details_json: JSON.stringify(details || {}), created_at: nowIso_()
  }]);
}
