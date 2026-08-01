function monthlyClosingPeriod_(value) {
  const period = String(value || '').trim();
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) {
    throw createError_('INVALID_PERIOD', 'Periode tutup buku harus berformat YYYY-MM.');
  }
  return period;
}

function monthlyClosingKey_(period) {
  return 'monthly_closing:' + monthlyClosingPeriod_(period);
}

function monthlyClosingRecord_(period) {
  const normalized = monthlyClosingPeriod_(period);
  const setting = rowsAsObjects_(VINN_CONFIG.SHEETS.SETTINGS).find(function(row) {
    return String(row.key) === monthlyClosingKey_(normalized);
  });
  if (!setting || !setting.value) return { period: normalized, status: 'open', closedAt: null, snapshot: null };
  try {
    const record = JSON.parse(String(setting.value));
    return {
      period: normalized,
      status: record.status === 'closed' ? 'closed' : 'open',
      closedAt: record.closedAt || null,
      reopenedAt: record.reopenedAt || null,
      snapshot: record.snapshot && typeof record.snapshot === 'object' ? record.snapshot : null
    };
  } catch (error) {
    return { period: normalized, status: 'open', closedAt: null, snapshot: null };
  }
}

function isMonthlyPeriodClosed_(period) {
  return monthlyClosingRecord_(period).status === 'closed';
}

function assertMonthlyPeriodsOpen_(transactions) {
  const periods = {};
  (transactions || []).forEach(function(transaction) {
    const period = String(transaction && transaction.date || '').slice(0, 7);
    if (/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) periods[period] = true;
  });
  Object.keys(periods).forEach(function(period) {
    if (isMonthlyPeriodClosed_(period)) {
      throw createError_('MONTH_CLOSED', 'Bulan ' + period + ' sudah ditutup. Buka kembali bulan tersebut sebelum mengubah ledger.', { period: period });
    }
  });
}

function apiMonthlyClosingStatus(payload) {
  try {
    return ok_({ closing: monthlyClosingRecord_(payload && payload.period) });
  } catch (error) { return fail_(error); }
}

function apiCloseMonthlyBook(payload) {
  const requestId = String(payload && payload.requestId || id_('req'));
  try {
    return withDocumentLock_(function() {
      const period = monthlyClosingPeriod_(payload && payload.period);
      const current = monthlyClosingRecord_(period);
      if (current.status === 'closed') return ok_({ closing: current, duplicate: true }, requestId);
      const pendingCount = rowsAsObjectsUnscoped_(VINN_CONFIG.SHEETS.TRANSACTIONS).filter(function(row) {
        return !row.deleted_at && String(row.date || '').slice(0, 7) === period && String(row.status || 'completed') === 'pending';
      }).length;
      if (pendingCount) throw createError_('PENDING_TRANSACTIONS', 'Selesaikan ' + pendingCount + ' transaksi pending sebelum menutup buku.', { pendingCount: pendingCount });
      if (!payload || payload.confirmed !== true) throw createError_('CLOSING_CONFIRMATION_REQUIRED', 'Konfirmasi pemeriksaan saldo diperlukan.');
      const snapshot = payload.snapshot && typeof payload.snapshot === 'object' ? payload.snapshot : null;
      const closing = { period: period, status: 'closed', closedAt: nowIso_(), reopenedAt: null, snapshot: snapshot };
      const serialized = JSON.stringify(closing);
      if (serialized.length > 45000) throw createError_('SNAPSHOT_TOO_LARGE', 'Snapshot review bulanan terlalu besar.');
      upsertSetting_(monthlyClosingKey_(period), serialized);
      audit_('CLOSE_MONTH', 'monthly_closing', period, requestId, { period: period, snapshot: snapshot });
      return ok_({ closing: closing, duplicate: false }, requestId);
    });
  } catch (error) { return fail_(error, requestId); }
}

function apiReopenMonthlyBook(payload) {
  const requestId = String(payload && payload.requestId || id_('req'));
  try {
    return withDocumentLock_(function() {
      const period = monthlyClosingPeriod_(payload && payload.period);
      const current = monthlyClosingRecord_(period);
      if (current.status !== 'closed') return ok_({ closing: current, duplicate: true }, requestId);
      const closing = Object.assign({}, current, { status: 'open', reopenedAt: nowIso_() });
      upsertSetting_(monthlyClosingKey_(period), JSON.stringify(closing));
      audit_('REOPEN_MONTH', 'monthly_closing', period, requestId, { period: period, previousClosedAt: current.closedAt });
      return ok_({ closing: closing, duplicate: false }, requestId);
    });
  } catch (error) { return fail_(error, requestId); }
}
