function apiCreateTransaction(payload) {
  const requestId = payload && payload.requestId ? String(payload.requestId) : id_('req');
  try {
    return withDocumentLock_(function() {
      const existing = rowsAsObjects_(VINN_CONFIG.SHEETS.TRANSACTIONS).find(function(row) {
        return String(row.request_id) === requestId && !row.deleted_at;
      });
      if (existing) return ok_({ transactionId: existing.id, duplicate: true }, requestId);

      const type = String(payload.type || '').toLowerCase();
      if (['income', 'expense', 'transfer', 'refund'].indexOf(type) === -1) {
        throw createError_('INVALID_TYPE', 'Jenis transaksi tidak didukung.');
      }
      const amount = assertPositiveMoney_(payload.amount);
      const accountId = String(payload.accountId || '');
      if (!accountId || !findById_(VINN_CONFIG.SHEETS.ACCOUNTS, accountId)) {
        throw createError_('ACCOUNT_REQUIRED', 'Akun sumber wajib dipilih.');
      }
      const timestamp = nowIso_();
      const transactionId = id_('tx');
      const base = {
        id: transactionId, transfer_group_id: '', request_id: requestId,
        date: dateIso_(payload.date), time: payload.time || '', type: type,
        account_id: accountId, destination_account_id: payload.destinationAccountId || '',
        amount: amount, category: payload.category || '', merchant: payload.merchant || '',
        notes: payload.notes || '', status: 'completed', direction: '',
        created_at: timestamp, updated_at: timestamp, deleted_at: ''
      };

      if (type === 'transfer') {
        const destinationId = String(payload.destinationAccountId || '');
        if (!destinationId || !findById_(VINN_CONFIG.SHEETS.ACCOUNTS, destinationId)) {
          throw createError_('DESTINATION_REQUIRED', 'Akun tujuan wajib dipilih.');
        }
        if (accountId === destinationId) throw createError_('SAME_ACCOUNT', 'Akun sumber dan tujuan tidak boleh sama.');
        const groupId = id_('trf');
        appendObjects_(VINN_CONFIG.SHEETS.TRANSACTIONS, [
          Object.assign({}, base, { id: id_('tx'), transfer_group_id: groupId, direction: 'out' }),
          Object.assign({}, base, { id: id_('tx'), transfer_group_id: groupId, account_id: destinationId, destination_account_id: accountId, direction: 'in' })
        ]);
        audit_('CREATE_TRANSFER', 'transactions', groupId, requestId, { amount: amount, from: accountId, to: destinationId });
        CacheService.getDocumentCache().remove('dashboard:2026-07');
        return ok_({ transactionId: groupId, duplicate: false }, requestId);
      }

      appendObjects_(VINN_CONFIG.SHEETS.TRANSACTIONS, [base]);
      audit_('CREATE', 'transactions', transactionId, requestId, { type: type, amount: amount });
      CacheService.getDocumentCache().remove('dashboard:2026-07');
      return ok_({ transactionId: transactionId, duplicate: false }, requestId);
    });
  } catch (error) { return fail_(error, requestId); }
}

function apiListTransactions(params) {
  try {
    params = params || {};
    const page = Math.max(1, Number(params.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(params.pageSize) || 25));
    const rows = rowsAsObjects_(VINN_CONFIG.SHEETS.TRANSACTIONS)
      .filter(function(row) { return !row.deleted_at; })
      .filter(function(row) { return !params.month || String(row.date).slice(0, 7) === params.month; })
      .sort(function(a, b) { return String(b.date).localeCompare(String(a.date)); });
    const start = (page - 1) * pageSize;
    return ok_({ items: rows.slice(start, start + pageSize), page: page, pageSize: pageSize, total: rows.length });
  } catch (error) { return fail_(error); }
}

function apiDeleteTransaction(transactionId, requestId) {
  requestId = requestId || id_('req');
  try {
    return withDocumentLock_(function() {
      const transaction = findById_(VINN_CONFIG.SHEETS.TRANSACTIONS, transactionId);
      if (!transaction || transaction.deleted_at) throw createError_('NOT_FOUND', 'Transaksi tidak ditemukan.');
      const deletedAt = nowIso_();
      const related = transaction.transfer_group_id
        ? rowsAsObjects_(VINN_CONFIG.SHEETS.TRANSACTIONS).filter(function(row) { return row.transfer_group_id === transaction.transfer_group_id; })
        : [transaction];
      related.forEach(function(row) {
        appendObjects_(VINN_CONFIG.SHEETS.TRASH, [{ id: id_('trash'), source_sheet: VINN_CONFIG.SHEETS.TRANSACTIONS, entity_id: row.id, payload_json: JSON.stringify(row), deleted_by: Session.getActiveUser().getEmail() || 'owner', deleted_at: deletedAt }]);
        row.deleted_at = deletedAt; row.updated_at = deletedAt; delete row._row;
        updateObjectRow_(VINN_CONFIG.SHEETS.TRANSACTIONS, findById_(VINN_CONFIG.SHEETS.TRANSACTIONS, row.id)._row, row);
      });
      audit_('SOFT_DELETE', 'transactions', transaction.transfer_group_id || transaction.id, requestId, {});
      return ok_({ deleted: related.length }, requestId);
    });
  } catch (error) { return fail_(error, requestId); }
}
