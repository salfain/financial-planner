function apiCreateTransaction(payload) {
  const requestId = payload && payload.requestId ? String(payload.requestId) : id_('req');
  try {
    return withDocumentLock_(function() {
      const existing = rowsAsObjectsUnscoped_(VINN_CONFIG.SHEETS.TRANSACTIONS).find(function(row) {
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
      const metadata = transactionMetadata_(payload, type, amount);
      const base = {
        id: transactionId, transfer_group_id: '', request_id: requestId,
        date: dateIso_(payload.date), time: payload.time || '', type: type,
        account_id: accountId, destination_account_id: payload.destinationAccountId || '',
        amount: amount, category: payload.category || '', merchant: payload.merchant || '',
        notes: metadata.notes, status: transactionStatus_(payload.status || 'completed'), direction: '',
        created_at: timestamp, updated_at: timestamp, deleted_at: '',
        tags_json: JSON.stringify(metadata.tags), location: metadata.location,
        splits_json: JSON.stringify(metadata.splits), receipt_file_id: '', receipt_filename: '',
        receipt_content_type: '', receipt_size_bytes: ''
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
        audit_('CREATE_TRANSFER', 'transactions', groupId, requestId, { amount: amount, from: accountId, to: destinationId, after: transferRows.map(transactionClientRow_) });
        invalidateDashboard_(String(base.date).slice(0, 7));
        return ok_({ transactionId: groupId, duplicate: false }, requestId);
      }

      validateLedgerMutation_([], [base]);
      appendObjects_(VINN_CONFIG.SHEETS.TRANSACTIONS, [base]);
      audit_('CREATE', 'transactions', transactionId, requestId, { type: type, amount: amount, after: transactionClientRow_(base) });
      invalidateDashboard_(String(base.date).slice(0, 7));
      return ok_({ transactionId: transactionId, duplicate: false }, requestId);
    });
  } catch (error) { return fail_(error, requestId); }
}

function apiRecordLoanDrawdown(payload) {
  const requestId = payload && payload.requestId ? String(payload.requestId) : id_('req');
  try {
    return withDocumentLock_(function() {
      const existingAudit = requestAudit_(requestId);
      if (existingAudit) {
        if (String(existingAudit.action) !== 'CREATE_LOAN_DRAWDOWN' || String(existingAudit.module) !== 'transactions') {
          throw createError_('REQUEST_ID_REUSED', 'requestId sudah digunakan oleh operasi lain.');
        }
        const replayDetails = parseJsonObject_(existingAudit.details_json);
        return ok_({
          transactionId: String(existingAudit.entity_id || ''),
          cashReceived: Number(replayDetails.cashReceived || 0),
          totalObligation: Number(replayDetails.totalObligation || 0),
          financingCost: Number(replayDetails.financingCost || 0),
          duplicate: true
        }, requestId);
      }
      if (rowsAsObjectsUnscoped_(VINN_CONFIG.SHEETS.TRANSACTIONS).some(function(row) {
        return String(row.request_id || '') === requestId;
      })) throw createError_('REQUEST_ID_REUSED', 'requestId sudah digunakan oleh transaksi lain.');

      const liabilityAccountId = String(payload.liabilityAccountId || '');
      const destinationAccountId = String(payload.destinationAccountId || '');
      const liabilityAccount = requireAccount_(liabilityAccountId, 'Akun utang wajib dipilih.');
      const destinationAccount = requireAccount_(destinationAccountId, 'Rekening penerima wajib dipilih.');
      if (liabilityAccountId === destinationAccountId) {
        throw createError_('SAME_ACCOUNT', 'Akun utang dan rekening penerima harus berbeda.');
      }
      if (!truthy_(liabilityAccount.is_liability)) {
        throw createError_('LIABILITY_REQUIRED', 'Sumber pencairan harus berupa akun kewajiban.');
      }
      if (truthy_(destinationAccount.is_liability)) {
        throw createError_('CASH_ACCOUNT_REQUIRED', 'Rekening penerima tidak boleh berupa akun kewajiban.');
      }

      const cashReceived = assertPositiveMoney_(payload.cashReceived);
      const totalObligation = assertPositiveMoney_(payload.totalObligation);
      if (totalObligation < cashReceived) {
        throw createError_('INVALID_OBLIGATION', 'Total kewajiban tidak boleh lebih kecil daripada uang yang diterima.');
      }
      const financingCost = totalObligation - cashReceived;
      const date = dateIso_(payload.date);
      const title = String(payload.title || 'Pencairan pinjaman').trim().slice(0, 120);
      if (!title) throw createError_('TITLE_REQUIRED', 'Nama pencairan wajib diisi.');
      const userNotes = String(payload.notes || '').trim().slice(0, 650);
      const timestamp = nowIso_();
      const groupId = id_('loan');
      const summary = [
        userNotes,
        'Dana bersih ' + cashReceived + '; total kewajiban ' + totalObligation + '; biaya pembiayaan ' + financingCost + '.',
        'Referensi pencairan ' + groupId + '.'
      ].filter(Boolean).join(' ');
      const base = {
        transfer_group_id: groupId, request_id: requestId,
        date: date, time: '', type: 'transfer',
        destination_account_id: destinationAccountId,
        amount: cashReceived, category: 'Transfer', merchant: title,
        notes: summary, status: 'completed', direction: 'out',
        created_at: timestamp, updated_at: timestamp, deleted_at: '',
        tags_json: '[]', location: '', splits_json: '[]',
        receipt_file_id: '', receipt_filename: '', receipt_content_type: '', receipt_size_bytes: ''
      };
      const rows = [
        Object.assign({}, base, {
          id: id_('tx'),
          account_id: liabilityAccountId
        }),
        Object.assign({}, base, {
          id: id_('tx'),
          account_id: destinationAccountId,
          destination_account_id: liabilityAccountId,
          direction: 'in'
        })
      ];
      if (financingCost > 0) {
        rows.push({
          id: id_('tx'), transfer_group_id: '', request_id: requestId + ':financing-cost',
          date: date, time: '', type: 'adjustment_out',
          account_id: liabilityAccountId, destination_account_id: '',
          amount: financingCost, category: 'Penyesuaian Saldo',
          merchant: 'Biaya pembiayaan - ' + String(liabilityAccount.name || title),
          notes: 'Tambahan kewajiban kontraktual dari ' + title + '. Tidak mengurangi kas dan tidak dihitung sebagai pengeluaran bulanan. Referensi pencairan ' + groupId + '.',
          status: 'completed', direction: 'out',
          created_at: timestamp, updated_at: timestamp, deleted_at: '',
          tags_json: '[]', location: '', splits_json: '[]',
          receipt_file_id: '', receipt_filename: '', receipt_content_type: '', receipt_size_bytes: ''
        });
      }

      validateLedgerMutation_([], rows);
      appendObjects_(VINN_CONFIG.SHEETS.TRANSACTIONS, rows);
      audit_('CREATE_LOAN_DRAWDOWN', 'transactions', groupId, requestId, {
        cashReceived: cashReceived,
        totalObligation: totalObligation,
        financingCost: financingCost,
        liabilityAccountId: liabilityAccountId,
        destinationAccountId: destinationAccountId,
        after: rows.map(transactionClientRow_)
      });
      invalidateDashboard_(String(date).slice(0, 7));
      return ok_({
        transactionId: groupId,
        cashReceived: cashReceived,
        totalObligation: totalObligation,
        financingCost: financingCost,
        duplicate: false
      }, requestId);
    });
  } catch (error) { return fail_(error, requestId); }
}

function apiListTransactions(params) {
  try {
    params = params || {};
    const page = Math.max(1, Number(params.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(params.pageSize) || 25));
    const query = String(params.query || '').trim().toLowerCase();
    const accountsById = rowsAsObjects_(VINN_CONFIG.SHEETS.ACCOUNTS).reduce(function(result, account) {
      result[String(account.id)] = account;
      return result;
    }, {});
    const rows = rowsAsObjects_(VINN_CONFIG.SHEETS.TRANSACTIONS)
      .filter(function(row) { return !row.deleted_at; })
      .filter(function(row) { return !params.month || String(row.date).slice(0, 7) === params.month; })
      .filter(function(row) {
        const client = transactionClientRow_(row);
        const account = accountsById[String(row.account_id)];
        const search = [client.title, client.category, client.notes, client.location, client.tags.join(' '), account && account.name].join(' ').toLowerCase();
        const typeMatch = !params.type || params.type === 'all' || String(params.type) === String(row.type) || (params.type === 'adjustment' && ['adjustment_in', 'adjustment_out'].indexOf(String(row.type)) !== -1);
        const categoryMatch = !params.category || String(row.category) === String(params.category) || client.splits.some(function(split) { return String(split.category) === String(params.category); });
        return (!query || search.indexOf(query) !== -1) && typeMatch && categoryMatch &&
          (!params.accountId || String(row.account_id) === String(params.accountId)) &&
          (!params.status || String(row.status || 'completed') === String(params.status)) &&
          (!params.dateFrom || String(row.date) >= String(params.dateFrom)) &&
          (!params.dateTo || String(row.date) <= String(params.dateTo));
      })
      .sort(function(a, b) { return String(b.date + ' ' + (b.time || '')).localeCompare(String(a.date + ' ' + (a.time || ''))); });
    const start = (page - 1) * pageSize;
    return ok_({ items: rows.slice(start, start + pageSize).map(transactionClientRow_), page: page, pageSize: pageSize, total: rows.length, totalPages: Math.max(1, Math.ceil(rows.length / pageSize)) });
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
  const metadata = transactionMetadata_(Object.assign({}, transactionClientRow_(transaction), payload), requestedType, amount);

  const updated = Object.assign({}, transaction, {
    date: hasOwn_(payload, 'date') ? dateIso_(payload.date) : transaction.date,
    time: hasOwn_(payload, 'time') ? String(payload.time || '').slice(0, 20) : transaction.time,
    type: requestedType,
    account_id: accountId,
    destination_account_id: '',
    amount: amount,
    category: hasOwn_(payload, 'category') ? String(payload.category || '').trim().slice(0, 100) : transaction.category,
    merchant: merchant,
    notes: metadata.notes,
    tags_json: JSON.stringify(metadata.tags),
    location: metadata.location,
    splits_json: JSON.stringify(metadata.splits),
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
  const metadata = transactionMetadata_(Object.assign({}, transactionClientRow_(outgoing), payload, { splits: [] }), 'transfer', amount);
  const timestamp = nowIso_();
  const before = { out: transactionClientRow_(outgoing), in: transactionClientRow_(incoming) };
  const outRow = Object.assign({}, outgoing, {
    date: date, time: time, type: 'transfer', account_id: sourceId,
    destination_account_id: destinationId, amount: amount, category: 'Transfer',
    merchant: merchant, notes: notes, tags_json: JSON.stringify(metadata.tags), location: metadata.location, splits_json: '[]', status: status, direction: 'out', updated_at: timestamp
  });
  const inRow = Object.assign({}, incoming, {
    date: date, time: time, type: 'transfer', account_id: destinationId,
    destination_account_id: sourceId, amount: amount, category: 'Transfer',
    merchant: merchant, notes: notes, tags_json: JSON.stringify(metadata.tags), location: metadata.location, splits_json: '[]', status: status, direction: 'in', updated_at: timestamp
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
      assertMonthlyPeriodsOpen_(related);
      if (transaction.transfer_group_id && related.length !== 2) {
        throw createError_('TRANSFER_PAIR_INVALID', 'Pasangan transfer tidak lengkap; penghapusan dibatalkan.');
      }
      related.forEach(function(row) { assertExpectedTransactionVersion_(row, expectedUpdatedAt); });
      const trashEntries = related.map(function(row) {
        return { id: id_('trash'), source_sheet: VINN_CONFIG.SHEETS.TRANSACTIONS, entity_id: row.id, payload_json: JSON.stringify(row), deleted_by: currentAuditActor_(), deleted_at: deletedAt };
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
        requestedTransactionId: String(transactionId),
        before: related.map(transactionClientRow_)
      });
      return ok_({ deleted: related.length, duplicate: false }, requestId);
    });
  } catch (error) { return fail_(error, requestId); }
}

function transactionMetadata_(payload, type, amount) {
  const tags = Array.isArray(payload.tags) ? payload.tags.map(function(value) { return String(value).trim().slice(0, 30); }).filter(Boolean) : [];
  const uniqueTags = tags.filter(function(value, index) { return tags.indexOf(value) === index; }).slice(0, 10);
  const splits = Array.isArray(payload.splits) ? payload.splits.map(function(split) {
    return {
      id: String(split.id || id_('split')),
      category: String(split.category || '').trim().slice(0, 100),
      amount: assertPositiveMoney_(split.amount),
      note: String(split.note || '').trim().slice(0, 160)
    };
  }) : [];
  if (splits.length && ['income', 'expense', 'refund'].indexOf(type) === -1) throw createError_('SPLIT_NOT_ALLOWED', 'Split kategori tidak tersedia untuk jenis transaksi ini.');
  if (splits.length === 1 || splits.length > 20 || splits.some(function(split) { return !split.category; })) throw createError_('INVALID_SPLITS', 'Split harus berisi 2 sampai 20 rincian kategori.');
  if (splits.length && splits.reduce(function(sum, split) { return sum + split.amount; }, 0) !== amount) throw createError_('SPLIT_TOTAL_MISMATCH', 'Total split harus sama dengan nominal transaksi.');
  return {
    notes: String(payload.notes || '').trim().slice(0, 1000),
    tags: uniqueTags,
    location: String(payload.location || '').trim().slice(0, 160),
    splits: splits
  };
}

function apiImportTransactions(payload) {
  const requestId = String(payload.requestId || id_('req'));
  try {
    return withDocumentLock_(function() {
      const replay = requestAudit_(requestId);
      if (replay) {
        if (String(replay.action) !== 'IMPORT' || String(replay.module) !== 'transactions') throw createError_('REQUEST_ID_REUSED', 'requestId sudah digunakan oleh operasi lain.');
        return ok_({ imported: Number(parseJsonObject_(replay.details_json).imported || 0), duplicate: true }, requestId);
      }
      const items = Array.isArray(payload.transactions) ? payload.transactions : [];
      if (!items.length || items.length > 100) throw createError_('INVALID_IMPORT', 'Impor harus berisi 1 sampai 100 transaksi.');
      const now = nowIso_();
      const rows = items.map(function(item, index) {
        item = applyCategoryRuleGs_(item);
        const type = String(item.type || '').toLowerCase();
        if (['income', 'expense', 'refund'].indexOf(type) === -1) throw createError_('IMPORT_TYPE_UNSUPPORTED', 'Baris ' + (index + 2) + ' memiliki jenis yang tidak didukung.');
        const amount = assertPositiveMoney_(item.amount);
        const accountId = String(item.accountId || '');
        requireAccount_(accountId, 'Akun pada baris ' + (index + 2) + ' tidak ditemukan.');
        const metadata = transactionMetadata_(item, type, amount);
        return {
          id: String(item.id || id_('tx')), transfer_group_id: '', request_id: requestId + ':' + (index + 1),
          date: dateIso_(item.date), time: String(item.time || '').slice(0, 5), type: type,
          account_id: accountId, destination_account_id: '', amount: amount,
          category: String(item.category || '').trim().slice(0, 100), merchant: String(item.merchant || item.title || '').trim().slice(0, 120),
          notes: metadata.notes, status: transactionStatus_(item.status || 'completed'), direction: '', created_at: now, updated_at: now, deleted_at: '',
          tags_json: JSON.stringify(metadata.tags), location: metadata.location, splits_json: JSON.stringify(metadata.splits),
          receipt_file_id: '', receipt_filename: '', receipt_content_type: '', receipt_size_bytes: ''
        };
      });
      if (rows.some(function(row) { return !row.category || !row.merchant; })) throw createError_('INVALID_IMPORT', 'Kategori dan deskripsi wajib diisi pada setiap baris.');
      validateLedgerMutation_([], rows);
      appendObjects_(VINN_CONFIG.SHEETS.TRANSACTIONS, rows);
      audit_('IMPORT', 'transactions', requestId, requestId, { imported: rows.length, after: rows.map(transactionClientRow_) });
      invalidateDashboard_();
      return ok_({ imported: rows.length, duplicate: false }, requestId);
    });
  } catch (error) { return fail_(error, requestId); }
}

function applyClientTransactionToRow_(row, client, timestamp) {
  const next = Object.assign({}, row, {
    type: String(client.type || row.type), date: String(client.date || row.date), time: String(client.time || ''),
    account_id: String(client.accountId || row.account_id), destination_account_id: String(client.destinationAccountId || ''),
    amount: Number(client.amount || row.amount), category: String(client.category || row.category),
    merchant: String(client.merchant || client.title || row.merchant), notes: String(client.notes || ''),
    status: String(client.status || 'completed'), tags_json: JSON.stringify(Array.isArray(client.tags) ? client.tags : []),
    location: String(client.location || ''), splits_json: JSON.stringify(Array.isArray(client.splits) ? client.splits : []),
    deleted_at: '', updated_at: timestamp
  });
  delete next._row;
  return next;
}

function apiUndoTransaction(payload) {
  const requestId = String(payload.requestId || id_('req'));
  try {
    return withDocumentLock_(function() {
      const replay = requestAudit_(requestId);
      if (replay) {
        if (String(replay.action) !== 'UNDO' || String(replay.module) !== 'transactions') throw createError_('REQUEST_ID_REUSED', 'requestId sudah digunakan oleh operasi lain.');
        return ok_({ undone: true, action: parseJsonObject_(replay.details_json).targetAction || '', transactionId: replay.entity_id, duplicate: true }, requestId);
      }
      const allowed = ['CREATE', 'CREATE_TRANSFER', 'CREATE_LOAN_DRAWDOWN', 'UPDATE', 'UPDATE_TRANSFER', 'SOFT_DELETE', 'IMPORT'];
      const target = rowsAsObjects_(VINN_CONFIG.SHEETS.AUDIT_LOG).reverse().find(function(row) {
        const details = parseJsonObject_(row.details_json);
        return String(row.module) === 'transactions' && allowed.indexOf(String(row.action)) !== -1 && !details.undone_at;
      });
      if (!target) throw createError_('NOTHING_TO_UNDO', 'Belum ada aksi transaksi yang dapat dibatalkan.');
      const details = parseJsonObject_(target.details_json);
      const action = String(target.action);
      const now = nowIso_();
      let beforeRows = [];
      let afterRows = [];
      let affected = [];
      if (action === 'CREATE' || action === 'CREATE_TRANSFER' || action === 'CREATE_LOAN_DRAWDOWN' || action === 'IMPORT') {
        const created = action === 'IMPORT' || action === 'CREATE_LOAN_DRAWDOWN' ? details.after : action === 'CREATE_TRANSFER' ? details.after : [details.after];
        affected = (Array.isArray(created) ? created : []).map(function(client) { return findById_(VINN_CONFIG.SHEETS.TRANSACTIONS, client.id); }).filter(function(row) { return row && !row.deleted_at; });
        if (!affected.length) throw createError_('UNDO_CONFLICT', 'Transaksi sudah berubah atau dihapus.');
        beforeRows = affected;
      } else if (action === 'UPDATE') {
        const current = findById_(VINN_CONFIG.SHEETS.TRANSACTIONS, target.entity_id);
        if (!current || current.deleted_at || !details.before) throw createError_('UNDO_CONFLICT', 'Transaksi sudah berubah atau dihapus.');
        affected = [current]; beforeRows = [current]; afterRows = [applyClientTransactionToRow_(current, details.before, now)];
      } else if (action === 'UPDATE_TRANSFER') {
        const clients = details.before ? [details.before.out, details.before.in] : [];
        affected = clients.map(function(client) { return findById_(VINN_CONFIG.SHEETS.TRANSACTIONS, client.id); }).filter(Boolean);
        if (affected.length !== 2) throw createError_('UNDO_CONFLICT', 'Pasangan transfer sudah berubah.');
        beforeRows = affected; afterRows = affected.map(function(row, index) { return applyClientTransactionToRow_(row, clients[index], now); });
      } else {
        const clients = Array.isArray(details.before) ? details.before : [];
        affected = clients.map(function(client) { return findById_(VINN_CONFIG.SHEETS.TRANSACTIONS, client.id); }).filter(Boolean);
        if (!affected.length) throw createError_('UNDO_CONFLICT', 'Data transaksi yang dihapus tidak tersedia.');
        afterRows = affected.map(function(row, index) { return applyClientTransactionToRow_(row, clients[index], now); });
      }
      validateLedgerMutation_(beforeRows, afterRows);
      if (!afterRows.length) {
        affected.forEach(function(row) { const rowNumber = row._row; row.deleted_at = now; row.updated_at = now; delete row._row; updateObjectRow_(VINN_CONFIG.SHEETS.TRANSACTIONS, rowNumber, row); });
      } else {
        affected.forEach(function(row, index) { updateObjectRow_(VINN_CONFIG.SHEETS.TRANSACTIONS, row._row, afterRows[index]); });
      }
      const targetRow = target._row;
      delete target._row;
      target.details_json = JSON.stringify(Object.assign({}, details, { undone_at: now, undo_request_id: requestId }));
      updateObjectRow_(VINN_CONFIG.SHEETS.AUDIT_LOG, targetRow, target);
      audit_('UNDO', 'transactions', String(target.entity_id || ''), requestId, { targetAction: action, targetAuditId: target.id });
      invalidateDashboard_();
      return ok_({ undone: true, action: action, transactionId: String(target.entity_id || ''), duplicate: false }, requestId);
    });
  } catch (error) { return fail_(error, requestId); }
}

function apiAttachTransactionReceipt(payload) {
  const requestId = String(payload.requestId || id_('req'));
  try {
    return withDocumentLock_(function() {
      const transaction = findById_(VINN_CONFIG.SHEETS.TRANSACTIONS, payload.transactionId);
      if (!transaction || transaction.deleted_at) throw createError_('NOT_FOUND', 'Transaksi tidak ditemukan.');
      const contentType = String(payload.contentType || '');
      if (['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].indexOf(contentType) === -1) throw createError_('INVALID_FILE_TYPE', 'Lampiran harus JPG, PNG, WebP, atau PDF.');
      const bytes = Utilities.base64Decode(String(payload.contentBase64 || ''));
      if (!bytes.length || bytes.length > 5 * 1024 * 1024) throw createError_('INVALID_FILE_SIZE', 'Ukuran lampiran maksimal 5 MB.');
      const filename = String(payload.filename || 'lampiran-struk').replace(/[\\/\r\n]/g, '_').slice(0, 120);
      const file = portabilityFolder_().createFile(Utilities.newBlob(bytes, contentType, filename));
      if (transaction.receipt_file_id) try { DriveApp.getFileById(String(transaction.receipt_file_id)).setTrashed(true); } catch (error) { /* old file may be gone */ }
      const rowNumber = transaction._row;
      transaction.receipt_file_id = file.getId(); transaction.receipt_filename = filename; transaction.receipt_content_type = contentType; transaction.receipt_size_bytes = bytes.length;
      delete transaction._row; updateObjectRow_(VINN_CONFIG.SHEETS.TRANSACTIONS, rowNumber, transaction);
      audit_('ATTACH_RECEIPT', 'transactions', String(transaction.id), requestId, { fileId: file.getId(), filename: filename });
      return ok_({ receipt: transactionClientRow_(transaction).receipt }, requestId);
    });
  } catch (error) { return fail_(error, requestId); }
}

function apiDeleteTransactionReceipt(payload) {
  const requestId = String(payload.requestId || id_('req'));
  try {
    return withDocumentLock_(function() {
      const transaction = findById_(VINN_CONFIG.SHEETS.TRANSACTIONS, payload.transactionId);
      if (!transaction || transaction.deleted_at) throw createError_('NOT_FOUND', 'Transaksi tidak ditemukan.');
      const fileId = String(transaction.receipt_file_id || '');
      if (fileId) try { DriveApp.getFileById(fileId).setTrashed(true); } catch (error) { /* file may already be gone */ }
      const rowNumber = transaction._row;
      transaction.receipt_file_id = ''; transaction.receipt_filename = ''; transaction.receipt_content_type = ''; transaction.receipt_size_bytes = '';
      delete transaction._row; updateObjectRow_(VINN_CONFIG.SHEETS.TRANSACTIONS, rowNumber, transaction);
      audit_('DELETE_RECEIPT', 'transactions', String(transaction.id), requestId, { fileId: fileId });
      return ok_({ deleted: true, receiptId: fileId }, requestId);
    });
  } catch (error) { return fail_(error, requestId); }
}
