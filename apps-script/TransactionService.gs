function apiCreateTransaction(payload) {
  const requestId = payload && payload.requestId ? String(payload.requestId) : id_('req');
  try {
    return withDocumentLock_(function() {
      const existing = rowsAsObjects_(VINN_CONFIG.SHEETS.TRANSACTIONS).find(function(row) {
        return String(row.request_id) === requestId;
      });
      if (existing) return ok_({
        transactionId: existing.transfer_group_id || existing.id,
        duplicate: true,
        deleted: Boolean(existing.deleted_at)
      }, requestId);
      if (requestAudit_(requestId) || rowsAsObjects_(VINN_CONFIG.SHEETS.CATEGORIES).some(function(row) {
        return String(row.request_id) === requestId;
      })) throw createError_('REQUEST_ID_REUSED', 'requestId sudah digunakan oleh operasi lain.');

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
        const transferRows = [
          Object.assign({}, base, { id: id_('tx'), transfer_group_id: groupId, direction: 'out' }),
          Object.assign({}, base, { id: id_('tx'), transfer_group_id: groupId, account_id: destinationId, destination_account_id: accountId, direction: 'in' })
        ];
        validateLedgerMutation_([], transferRows);
        appendObjects_(VINN_CONFIG.SHEETS.TRANSACTIONS, transferRows);
        audit_('CREATE_TRANSFER', 'transactions', groupId, requestId, { amount: amount, from: accountId, to: destinationId });
        invalidateDashboard_(String(base.date).slice(0, 7));
        return ok_({ transactionId: groupId, duplicate: false }, requestId);
      }

      validateLedgerMutation_([], [base]);
      appendObjects_(VINN_CONFIG.SHEETS.TRANSACTIONS, [base]);
      audit_('CREATE', 'transactions', transactionId, requestId, { type: type, amount: amount });
      invalidateDashboard_(String(base.date).slice(0, 7));
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

function apiUpdateTransaction(payload) {
  const requestId = requestIdOrFailure_(payload);
  if (requestId.error) return requestId.error;
  try {
    return withDocumentLock_(function() {
      const transactionId = String(payload.transactionId || '').trim();
      if (!transactionId) throw createError_('TRANSACTION_REQUIRED', 'transactionId wajib diisi.');
      const target = transactionTarget_(transactionId);
      if (!target) throw createError_('NOT_FOUND', 'Transaksi tidak ditemukan.');
      const transferGroupId = String(target.transfer_group_id || '');
      const action = transferGroupId ? 'UPDATE_TRANSFER' : 'UPDATE';
      const entityId = transferGroupId || String(target.id);
      const existingAudit = assertRequestAudit_(requestId.value, [action], 'transactions', entityId);
      if (existingAudit) return transactionUpdateResponse_(transactionTarget_(transactionId), true, requestId.value);
      assertExpectedTransactionVersion_(target, payload.expectedUpdatedAt);
      assertRequestUnusedOutsideAudit_(requestId.value);

      if (transferGroupId) return updateTransferPair_(target, payload, requestId.value);
      return updateSingleTransaction_(target, payload, requestId.value);
    });
  } catch (error) { return fail_(error, requestId.value); }
}

function updateSingleTransaction_(transaction, payload, requestId) {
  const requestedType = hasOwn_(payload, 'type') ? String(payload.type || '').toLowerCase() : String(transaction.type || '');
  const supported = ['income', 'expense', 'refund', 'adjustment_in', 'adjustment_out'];
  if (requestedType === 'transfer') throw createError_('TRANSFER_CONVERSION_UNSUPPORTED', 'Transaksi biasa tidak dapat diubah menjadi transfer.');
  if (supported.indexOf(requestedType) === -1) throw createError_('INVALID_TYPE', 'Jenis transaksi tidak didukung.');

  const before = transactionClientRow_(transaction);
  const oldMonth = String(transaction.date || '').slice(0, 7);
  const accountId = hasOwn_(payload, 'accountId') ? String(payload.accountId || '') : String(transaction.account_id || '');
  requireAccount_(accountId, 'Akun transaksi tidak ditemukan.');
  const amount = hasOwn_(payload, 'amount') ? assertPositiveMoney_(payload.amount) : assertPositiveMoney_(transaction.amount);
  const status = transactionStatus_(hasOwn_(payload, 'status') ? payload.status : transaction.status);
  const merchant = transactionMerchant_(payload, transaction);

  const updated = Object.assign({}, transaction, {
    date: hasOwn_(payload, 'date') ? dateIso_(payload.date) : transaction.date,
    time: hasOwn_(payload, 'time') ? String(payload.time || '').slice(0, 20) : transaction.time,
    type: requestedType,
    account_id: accountId,
    destination_account_id: '',
    amount: amount,
    category: hasOwn_(payload, 'category') ? String(payload.category || '').trim().slice(0, 100) : transaction.category,
    merchant: merchant,
    notes: hasOwn_(payload, 'notes') ? String(payload.notes || '').trim().slice(0, 500) : transaction.notes,
    status: status,
    direction: requestedType === 'adjustment_in' ? 'in' : requestedType === 'adjustment_out' ? 'out' : '',
    updated_at: nowIso_()
  });
  const rowNumber = transaction._row;
  delete updated._row;
  validateLedgerMutation_([transaction], [updated]);
  updateObjectRow_(VINN_CONFIG.SHEETS.TRANSACTIONS, rowNumber, updated);
  const after = transactionClientRow_(updated);
  audit_('UPDATE', 'transactions', String(transaction.id), requestId, { before: before, after: after });
  invalidateDashboard_(oldMonth);
  return ok_({ transaction: after, updated: 1, duplicate: false }, requestId);
}

function updateTransferPair_(target, payload, requestId) {
  if (hasOwn_(payload, 'type') && String(payload.type || '').toLowerCase() !== 'transfer') {
    throw createError_('TRANSFER_CONVERSION_UNSUPPORTED', 'Transfer tidak dapat diubah menjadi transaksi biasa.');
  }
  const groupId = String(target.transfer_group_id);
  const pair = rowsAsObjects_(VINN_CONFIG.SHEETS.TRANSACTIONS).filter(function(row) {
    return !row.deleted_at && String(row.transfer_group_id) === groupId;
  });
  const outgoing = pair.find(function(row) { return String(row.direction) === 'out'; });
  const incoming = pair.find(function(row) { return String(row.direction) === 'in'; });
  if (pair.length !== 2 || !outgoing || !incoming) {
    throw createError_('TRANSFER_PAIR_INVALID', 'Pasangan transfer tidak lengkap; pembaruan dibatalkan.');
  }
  assertExpectedTransactionVersion_(outgoing, payload.expectedUpdatedAt);
  assertExpectedTransactionVersion_(incoming, payload.expectedUpdatedAt);

  const sourceId = hasOwn_(payload, 'accountId') ? String(payload.accountId || '') : String(outgoing.account_id || '');
  const destinationId = hasOwn_(payload, 'destinationAccountId')
    ? String(payload.destinationAccountId || '')
    : String(incoming.account_id || outgoing.destination_account_id || '');
  requireAccount_(sourceId, 'Akun sumber transfer tidak ditemukan.');
  requireAccount_(destinationId, 'Akun tujuan transfer tidak ditemukan.');
  if (sourceId === destinationId) throw createError_('SAME_ACCOUNT', 'Akun sumber dan tujuan tidak boleh sama.');

  const amount = hasOwn_(payload, 'amount') ? assertPositiveMoney_(payload.amount) : assertPositiveMoney_(outgoing.amount);
  const status = transactionStatus_(hasOwn_(payload, 'status') ? payload.status : outgoing.status);
  const date = hasOwn_(payload, 'date') ? dateIso_(payload.date) : outgoing.date;
  const time = hasOwn_(payload, 'time') ? String(payload.time || '').slice(0, 20) : outgoing.time;
  const merchant = transactionMerchant_(payload, outgoing);
  const notes = hasOwn_(payload, 'notes') ? String(payload.notes || '').trim().slice(0, 500) : outgoing.notes;
  const timestamp = nowIso_();
  const before = { out: transactionClientRow_(outgoing), in: transactionClientRow_(incoming) };
  const outRow = Object.assign({}, outgoing, {
    date: date, time: time, type: 'transfer', account_id: sourceId,
    destination_account_id: destinationId, amount: amount, category: 'Transfer',
    merchant: merchant, notes: notes, status: status, direction: 'out', updated_at: timestamp
  });
  const inRow = Object.assign({}, incoming, {
    date: date, time: time, type: 'transfer', account_id: destinationId,
    destination_account_id: sourceId, amount: amount, category: 'Transfer',
    merchant: merchant, notes: notes, status: status, direction: 'in', updated_at: timestamp
  });
  const outRowNumber = outgoing._row;
  const inRowNumber = incoming._row;
  delete outRow._row;
  delete inRow._row;
  const pairUpdates = [
    { rowNumber: outRowNumber, object: outRow },
    { rowNumber: inRowNumber, object: inRow }
  ];
  assertContiguousObjectRows_(pairUpdates);
  validateLedgerMutation_([outgoing, incoming], [outRow, inRow]);
  updateContiguousObjectRows_(VINN_CONFIG.SHEETS.TRANSACTIONS, pairUpdates);
  const after = { out: transactionClientRow_(outRow), in: transactionClientRow_(inRow) };
  audit_('UPDATE_TRANSFER', 'transactions', groupId, requestId, { before: before, after: after });
  invalidateDashboard_(String(outgoing.date || '').slice(0, 7));
  return ok_({ transaction: after.out, transferPair: after, updated: 2, duplicate: false }, requestId);
}

function transactionTarget_(transactionId) {
  const rows = rowsAsObjects_(VINN_CONFIG.SHEETS.TRANSACTIONS).filter(function(row) { return !row.deleted_at; });
  return rows.find(function(row) { return String(row.id) === String(transactionId); }) ||
    rows.find(function(row) { return String(row.transfer_group_id || '') === String(transactionId); }) || null;
}

function transactionUpdateResponse_(target, duplicate, requestId) {
  if (!target) throw createError_('IDEMPOTENCY_STATE_INVALID', 'Hasil request sebelumnya tidak dapat ditemukan.');
  if (!target.transfer_group_id) {
    return ok_({ transaction: transactionClientRow_(target), updated: 1, duplicate: duplicate }, requestId);
  }
  const rows = rowsAsObjects_(VINN_CONFIG.SHEETS.TRANSACTIONS).filter(function(row) {
    return !row.deleted_at && String(row.transfer_group_id) === String(target.transfer_group_id);
  });
  const out = rows.find(function(row) { return String(row.direction) === 'out'; });
  const incoming = rows.find(function(row) { return String(row.direction) === 'in'; });
  if (!out || !incoming || rows.length !== 2) throw createError_('TRANSFER_PAIR_INVALID', 'Pasangan transfer tidak lengkap.');
  const pair = { out: transactionClientRow_(out), in: transactionClientRow_(incoming) };
  return ok_({ transaction: pair.out, transferPair: pair, updated: 2, duplicate: duplicate }, requestId);
}

function requireAccount_(accountId, message) {
  const account = accountId ? findById_(VINN_CONFIG.SHEETS.ACCOUNTS, accountId) : null;
  if (!account || !accountIsActive_(account)) throw createError_('ACCOUNT_REQUIRED', message || 'Akun aktif wajib dipilih.');
  return account;
}

function transactionStatus_(value) {
  const status = String(value || 'completed').toLowerCase();
  if (['completed', 'pending'].indexOf(status) === -1) throw createError_('INVALID_STATUS', 'Status transaksi harus completed atau pending.');
  return status;
}

function transactionMerchant_(payload, transaction) {
  if (hasOwn_(payload, 'merchant')) return String(payload.merchant || '').trim().slice(0, 120);
  if (hasOwn_(payload, 'title')) return String(payload.title || '').trim().slice(0, 120);
  return String(transaction.merchant || '').trim().slice(0, 120);
}

function assertExpectedTransactionVersion_(transaction, expectedUpdatedAt) {
  if (expectedUpdatedAt === undefined || expectedUpdatedAt === null || String(expectedUpdatedAt) === '') return;
  const actual = String(transaction.updated_at || '');
  const expected = String(expectedUpdatedAt);
  if (actual !== expected) {
    throw createError_('STALE_TRANSACTION', 'Transaksi telah berubah. Muat ulang data sebelum mencoba lagi.', {
      transactionId: String(transaction.id || ''), expectedUpdatedAt: expected, actualUpdatedAt: actual
    });
  }
}

function apiDeleteTransaction(transactionId, requestId, expectedUpdatedAt) {
  requestId = requestId || id_('req');
  try {
    return withDocumentLock_(function() {
      const existingAudit = requestAudit_(requestId);
      if (existingAudit) {
        if (String(existingAudit.action) !== 'SOFT_DELETE' || String(existingAudit.module) !== 'transactions') {
          throw createError_('REQUEST_ID_REUSED', 'requestId sudah digunakan oleh operasi lain.');
        }
        const auditDetails = parseJsonObject_(existingAudit.details_json);
        if (auditDetails.requestedTransactionId && String(auditDetails.requestedTransactionId) !== String(transactionId)) {
          throw createError_('REQUEST_ID_REUSED', 'requestId sudah digunakan untuk transaksi lain.');
        }
        return ok_({ deleted: Number(auditDetails.deleted || 0), duplicate: true }, requestId);
      }
      const transaction = findById_(VINN_CONFIG.SHEETS.TRANSACTIONS, transactionId);
      if (!transaction || transaction.deleted_at) throw createError_('NOT_FOUND', 'Transaksi tidak ditemukan.');
      assertExpectedTransactionVersion_(transaction, expectedUpdatedAt);
      const deletedAt = nowIso_();
      const related = transaction.transfer_group_id
        ? rowsAsObjects_(VINN_CONFIG.SHEETS.TRANSACTIONS).filter(function(row) { return !row.deleted_at && row.transfer_group_id === transaction.transfer_group_id; })
        : [transaction];
      if (transaction.transfer_group_id && related.length !== 2) {
        throw createError_('TRANSFER_PAIR_INVALID', 'Pasangan transfer tidak lengkap; penghapusan dibatalkan.');
      }
      related.forEach(function(row) { assertExpectedTransactionVersion_(row, expectedUpdatedAt); });
      const trashEntries = related.map(function(row) {
        return { id: id_('trash'), source_sheet: VINN_CONFIG.SHEETS.TRANSACTIONS, entity_id: row.id, payload_json: JSON.stringify(row), deleted_by: Session.getActiveUser().getEmail() || 'owner', deleted_at: deletedAt };
      });
      const updates = related.map(function(row) {
        const rowNumber = row._row;
        row.deleted_at = deletedAt;
        row.updated_at = deletedAt;
        delete row._row;
        return { rowNumber: rowNumber, object: row };
      });
      assertContiguousObjectRows_(updates);
      appendObjects_(VINN_CONFIG.SHEETS.TRASH, trashEntries);
      updateContiguousObjectRows_(VINN_CONFIG.SHEETS.TRANSACTIONS, updates);
      invalidateDashboard_(String(transaction.date).slice(0, 7));
      audit_('SOFT_DELETE', 'transactions', transaction.transfer_group_id || transaction.id, requestId, {
        deleted: related.length,
        requestedTransactionId: String(transactionId)
      });
      return ok_({ deleted: related.length, duplicate: false }, requestId);
    });
  } catch (error) { return fail_(error, requestId); }
}
