function recurringClientRow_(row) {
  return {
    id: String(row.id || ''), name: String(row.name || ''), type: String(row.type || 'expense'),
    amount: Number(row.amount || 0), category: String(row.category || ''), accountId: String(row.account_id || ''),
    frequency: String(row.frequency || 'monthly'), startDate: String(row.start_date || '').slice(0, 10),
    nextDueDate: String(row.next_due_date || '').slice(0, 10), isSubscription: truthy_(row.is_subscription),
    active: row.is_active === '' ? true : truthy_(row.is_active), lastPostedDate: row.last_posted_date ? String(row.last_posted_date).slice(0, 10) : null,
    updatedAt: String(row.updated_at || '')
  };
}

function validateRecurringDate_(value, field) {
  const text = String(value || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || isNaN(new Date(text + 'T12:00:00').getTime())) {
    throw createError_('INVALID_RECURRING_DATE', (field || 'Tanggal') + ' tidak valid.');
  }
  return text;
}

function nextRecurringDate_(date, frequency) {
  const parts = validateRecurringDate_(date).split('-').map(Number);
  if (frequency === 'weekly') {
    const weekly = new Date(parts[0], parts[1] - 1, parts[2], 12);
    weekly.setDate(weekly.getDate() + 7);
    return Utilities.formatDate(weekly, VINN_CONFIG.TIMEZONE, 'yyyy-MM-dd');
  }
  const months = frequency === 'quarterly' ? 3 : frequency === 'yearly' ? 12 : 1;
  const first = new Date(parts[0], parts[1] - 1 + months, 1, 12);
  const last = new Date(first.getFullYear(), first.getMonth() + 1, 0, 12).getDate();
  first.setDate(Math.min(parts[2], last));
  return Utilities.formatDate(first, VINN_CONFIG.TIMEZONE, 'yyyy-MM-dd');
}

function apiListRecurring() {
  try {
    const templates = rowsAsObjects_(VINN_CONFIG.SHEETS.RECURRING).map(recurringClientRow_).sort(function(a, b) {
      if (a.active !== b.active) return a.active ? -1 : 1;
      return a.nextDueDate.localeCompare(b.nextDueDate);
    });
    return ok_({ templates: templates });
  } catch (error) { return fail_(error); }
}

function apiCreateRecurring(payload) {
  const requestId = String(payload && payload.requestId || id_('req'));
  try {
    return withDocumentLock_(function() {
      const replay = rowsAsObjects_(VINN_CONFIG.SHEETS.RECURRING).find(function(row) { return String(row.request_id) === requestId; });
      if (replay) return ok_({ template: recurringClientRow_(replay), duplicate: true }, requestId);
      const type = String(payload.type || '').toLowerCase();
      if (['income', 'expense'].indexOf(type) === -1) throw createError_('INVALID_RECURRING_TYPE', 'Jenis transaksi rutin tidak valid.');
      const frequency = String(payload.frequency || 'monthly');
      if (['weekly', 'monthly', 'quarterly', 'yearly'].indexOf(frequency) === -1) throw createError_('INVALID_RECURRING_FREQUENCY', 'Frekuensi transaksi rutin tidak valid.');
      const name = String(payload.name || '').trim().slice(0, 120);
      const category = String(payload.category || '').trim().slice(0, 100);
      const accountId = String(payload.accountId || '');
      if (!name || !category) throw createError_('INVALID_RECURRING_NAME', 'Nama dan kategori wajib diisi.');
      if (!findById_(VINN_CONFIG.SHEETS.ACCOUNTS, accountId)) throw createError_('ACCOUNT_REQUIRED', 'Akun transaksi rutin tidak ditemukan.');
      const startDate = validateRecurringDate_(payload.startDate, 'Tanggal mulai');
      const nextDueDate = validateRecurringDate_(payload.nextDueDate || startDate, 'Jadwal berikutnya');
      if (nextDueDate < startDate) throw createError_('INVALID_RECURRING_DATE', 'Jadwal berikutnya tidak boleh sebelum tanggal mulai.');
      const isSubscription = truthy_(payload.isSubscription);
      if (type === 'income' && isSubscription) throw createError_('INVALID_SUBSCRIPTION', 'Langganan hanya dapat berupa pengeluaran.');
      const now = nowIso_();
      const row = { id: id_('rec'), request_id: requestId, name: name, type: type, amount: assertPositiveMoney_(payload.amount), category: category, account_id: accountId, frequency: frequency, start_date: startDate, next_due_date: nextDueDate, is_subscription: isSubscription, is_active: payload.active === undefined ? true : truthy_(payload.active), last_posted_date: '', created_at: now, updated_at: now };
      appendObjects_(VINN_CONFIG.SHEETS.RECURRING, [row]);
      audit_('CREATE', 'recurring', row.id, requestId, { after: recurringClientRow_(row) });
      return ok_({ template: recurringClientRow_(row), duplicate: false }, requestId);
    });
  } catch (error) { return fail_(error, requestId); }
}

function apiUpdateRecurring(payload) {
  const requestId = String(payload && payload.requestId || id_('req'));
  try {
    return withDocumentLock_(function() {
      const id = String(payload.id || '');
      const row = rowsAsObjects_(VINN_CONFIG.SHEETS.RECURRING).find(function(item) { return String(item.id) === id; });
      if (!row) throw createError_('NOT_FOUND', 'Transaksi rutin tidak ditemukan.');
      const before = recurringClientRow_(row);
      const updated = Object.assign({}, row, { is_active: truthy_(payload.active), updated_at: nowIso_() });
      delete updated._row;
      updateObjectRow_(VINN_CONFIG.SHEETS.RECURRING, row._row, updated);
      audit_('STATUS', 'recurring', id, requestId, { before: before, after: recurringClientRow_(updated) });
      return ok_({ template: recurringClientRow_(updated) }, requestId);
    });
  } catch (error) { return fail_(error, requestId); }
}

function apiConfirmRecurring(payload) {
  const id = String(payload && payload.id || '');
  try {
    const current = rowsAsObjects_(VINN_CONFIG.SHEETS.RECURRING).find(function(item) { return String(item.id) === id; });
    if (!current) throw createError_('NOT_FOUND', 'Transaksi rutin tidak ditemukan.');
    const template = recurringClientRow_(current);
    if (!template.active) throw createError_('RECURRING_INACTIVE', 'Aktifkan kembali jadwal sebelum mencatat transaksi.');
    const dueDate = validateRecurringDate_(payload.dueDate, 'Tanggal konfirmasi');
    if (template.nextDueDate !== dueDate) {
      if (template.lastPostedDate === dueDate) return ok_({ template: template, duplicate: true }, payload.requestId);
      throw createError_('RECURRING_DATE_CHANGED', 'Jadwal sudah berubah. Muat ulang data sebelum mengonfirmasi.');
    }
    const requestId = String(payload.requestId || ('recurring:' + id + ':' + dueDate));
    const transactionResult = apiCreateTransaction({ requestId: requestId, type: template.type, date: template.nextDueDate, accountId: template.accountId, amount: template.amount, category: template.category, merchant: template.name, title: template.name, notes: 'Dari jadwal transaksi rutin ' + template.name, tags: ['transaksi-rutin'].concat(template.isSubscription ? ['langganan'] : []), status: 'completed' });
    if (!transactionResult.ok) return transactionResult;
    return withDocumentLock_(function() {
      const latest = rowsAsObjects_(VINN_CONFIG.SHEETS.RECURRING).find(function(item) { return String(item.id) === id; });
      if (!latest) throw createError_('NOT_FOUND', 'Transaksi rutin tidak ditemukan.');
      if (String(latest.next_due_date) === template.nextDueDate) {
        const updated = Object.assign({}, latest, { last_posted_date: template.nextDueDate, next_due_date: nextRecurringDate_(template.nextDueDate, template.frequency), updated_at: nowIso_() });
        delete updated._row;
        updateObjectRow_(VINN_CONFIG.SHEETS.RECURRING, latest._row, updated);
        if (!rowsAsObjects_(VINN_CONFIG.SHEETS.AUDIT_LOG).some(function(item) { return String(item.request_id) === requestId && String(item.action) === 'CONFIRM_RECURRING'; })) audit_('CONFIRM_RECURRING', 'recurring', id, requestId, { transactionId: transactionResult.data.transactionId, dueDate: template.nextDueDate, nextDueDate: updated.next_due_date });
        return ok_({ template: recurringClientRow_(updated), transaction: transactionResult.data }, requestId);
      }
      return ok_({ template: recurringClientRow_(latest), transaction: transactionResult.data, duplicate: true }, requestId);
    });
  } catch (error) { return fail_(error, payload && payload.requestId); }
}
