function apiListCategories(params) {
  try {
    params = params || {};
    const includeArchived = truthy_(params.includeArchived);
    const type = String(params.type || '').toLowerCase();
    if (type && ['income', 'expense'].indexOf(type) === -1) {
      throw createError_('INVALID_CATEGORY_TYPE', 'Tipe kategori harus income atau expense.');
    }
    const items = categoryRows_()
      .filter(function(category) { return includeArchived || !category.archived; })
      .filter(function(category) { return !type || category.type === type; })
      .sort(function(a, b) {
        return String(a.type).localeCompare(String(b.type)) || String(a.name).localeCompare(String(b.name));
      });
    return ok_({ items: items, total: items.length });
  } catch (error) { return fail_(error); }
}

function apiCreateCategory(payload) {
  const requestId = requestIdOrFailure_(payload);
  if (requestId.error) return requestId.error;
  try {
    return withDocumentLock_(function() {
      const audit = assertRequestAudit_(requestId.value, ['CREATE'], 'categories', '');
      if (audit) return categoryDuplicateResponse_(audit, requestId.value);

      const rawRows = rowsAsObjects_(VINN_CONFIG.SHEETS.CATEGORIES);
      const partial = rawRows.find(function(row) { return String(row.request_id) === requestId.value; });
      if (partial) return ok_({ category: categoryClientRow_(partial), duplicate: true }, requestId.value);
      assertRequestUnusedOutsideAudit_(requestId.value);

      const now = nowIso_();
      const category = validateCategoryCandidate_({
        id: id_('category'),
        name: payload.name,
        type: payload.type,
        parent_id: payload.parentId || '',
        color: payload.color || '#126b59',
        icon: payload.icon || 'tag',
        is_active: true,
        is_default: false,
        request_id: requestId.value,
        created_at: now,
        updated_at: now
      }, rawRows);
      appendObjects_(VINN_CONFIG.SHEETS.CATEGORIES, [category]);
      audit_('CREATE', 'categories', category.id, requestId.value, { after: categoryClientRow_(category) });
      invalidateDashboard_();
      return ok_({ category: categoryClientRow_(category), duplicate: false }, requestId.value);
    });
  } catch (error) { return fail_(error, requestId.value); }
}

function apiUpdateCategory(payload) {
  const requestId = requestIdOrFailure_(payload);
  if (requestId.error) return requestId.error;
  try {
    return withDocumentLock_(function() {
      const categoryId = String(payload.categoryId || '').trim();
      if (!categoryId) throw createError_('CATEGORY_REQUIRED', 'categoryId wajib diisi.');
      const existingAudit = assertRequestAudit_(requestId.value, ['UPDATE'], 'categories', categoryId);
      if (existingAudit) return categoryDuplicateResponse_(existingAudit, requestId.value);
      assertRequestUnusedOutsideAudit_(requestId.value);

      const category = findById_(VINN_CONFIG.SHEETS.CATEGORIES, categoryId);
      if (!category) throw createError_('NOT_FOUND', 'Kategori tidak ditemukan.');
      if (!categoryIsActive_(category)) throw createError_('CATEGORY_ARCHIVED', 'Kategori yang sudah diarsipkan tidak dapat diperbarui.');
      const before = categoryClientRow_(category);
      const candidate = Object.assign({}, category);
      if (hasOwn_(payload, 'name')) candidate.name = payload.name;
      if (hasOwn_(payload, 'type')) candidate.type = payload.type;
      if (hasOwn_(payload, 'parentId')) candidate.parent_id = payload.parentId || '';
      if (hasOwn_(payload, 'color')) candidate.color = payload.color;
      if (hasOwn_(payload, 'icon')) candidate.icon = payload.icon;
      candidate.updated_at = nowIso_();
      const rowNumber = category._row;
      delete candidate._row;
      const allCategories = rowsAsObjects_(VINN_CONFIG.SHEETS.CATEGORIES);
      validateCategoryCandidate_(candidate, allCategories);
      const oldName = String(category.name || '');
      const newName = String(candidate.name || '');
      const references = categoryReferenceCounts_(oldName);
      if (String(category.type) !== String(candidate.type) && references.total > 0) {
        throw createError_('CATEGORY_IN_USE', 'Tipe kategori yang sudah dipakai tidak dapat diubah.');
      }
      const cascade = oldName !== newName ? cascadeCategoryName_(oldName, newName) : references;
      updateObjectRow_(VINN_CONFIG.SHEETS.CATEGORIES, rowNumber, candidate);
      const after = categoryClientRow_(candidate);
      audit_('UPDATE', 'categories', categoryId, requestId.value, { before: before, after: after, cascade: cascade });
      invalidateDashboard_();
      return ok_({ category: after, duplicate: false }, requestId.value);
    });
  } catch (error) { return fail_(error, requestId.value); }
}

function apiArchiveCategory(payload) {
  const requestId = requestIdOrFailure_(payload);
  if (requestId.error) return requestId.error;
  try {
    return withDocumentLock_(function() {
      const categoryId = String(payload.categoryId || '').trim();
      if (!categoryId) throw createError_('CATEGORY_REQUIRED', 'categoryId wajib diisi.');
      const existingAudit = assertRequestAudit_(requestId.value, ['ARCHIVE'], 'categories', categoryId);
      if (existingAudit) {
        return ok_({ categoryId: categoryId, archived: true, duplicate: true }, requestId.value);
      }
      assertRequestUnusedOutsideAudit_(requestId.value);

      const category = findById_(VINN_CONFIG.SHEETS.CATEGORIES, categoryId);
      if (!category) throw createError_('NOT_FOUND', 'Kategori tidak ditemukan.');
      if (truthy_(category.is_default) || defaultCategoryId_(category.id)) {
        throw createError_('DEFAULT_CATEGORY', 'Kategori bawaan tidak dapat diarsipkan.');
      }
      const activeChild = rowsAsObjects_(VINN_CONFIG.SHEETS.CATEGORIES).find(function(row) {
        return String(row.parent_id || '') === categoryId && categoryIsActive_(row);
      });
      if (activeChild) throw createError_('CATEGORY_HAS_CHILDREN', 'Arsipkan subkategori aktif terlebih dahulu.');

      const before = categoryClientRow_(category);
      const rowNumber = category._row;
      category.is_active = false;
      category.updated_at = nowIso_();
      delete category._row;
      updateObjectRow_(VINN_CONFIG.SHEETS.CATEGORIES, rowNumber, category);
      audit_('ARCHIVE', 'categories', categoryId, requestId.value, {
        before: before,
        after: categoryClientRow_(category)
      });
      invalidateDashboard_();
      return ok_({ categoryId: categoryId, archived: true, duplicate: false }, requestId.value);
    });
  } catch (error) { return fail_(error, requestId.value); }
}

function apiReconcileAccount(payload) {
  const requestId = requestIdOrFailure_(payload);
  if (requestId.error) return requestId.error;
  try {
    return withDocumentLock_(function() {
      const accountId = String(payload.accountId || '').trim();
      if (!accountId) throw createError_('ACCOUNT_REQUIRED', 'accountId wajib diisi.');
      const existingAudit = assertRequestAudit_(requestId.value, ['RECONCILE', 'RECONCILE_NOOP'], 'accounts', accountId);
      if (existingAudit) return reconcileDuplicateResponse_(existingAudit, requestId.value);

      const transactions = rowsAsObjects_(VINN_CONFIG.SHEETS.TRANSACTIONS);
      const partial = transactions.find(function(row) {
        return !row.deleted_at && String(row.status || 'completed') === 'completed' && String(row.request_id) === requestId.value;
      });
      if (partial) {
        if (String(partial.account_id) !== accountId || ['adjustment_in', 'adjustment_out'].indexOf(String(partial.type)) === -1) {
          throw createError_('REQUEST_ID_REUSED', 'requestId sudah digunakan oleh operasi lain.');
        }
        const accountForPartial = findById_(VINN_CONFIG.SHEETS.ACCOUNTS, accountId);
        if (!accountForPartial) throw createError_('IDEMPOTENCY_STATE_INVALID', 'Akun hasil rekonsiliasi sebelumnya tidak ditemukan.');
        const balanceAfterPartial = accountForPartial ? accountCurrentBalance_(accountForPartial, transactions) : 0;
        const partialMovement = transactionMovement_(partial);
        const previousBalance = truthy_(accountForPartial.is_liability)
          ? balanceAfterPartial + partialMovement
          : balanceAfterPartial - partialMovement;
        const recovered = {
          accountId: accountId,
          transactionId: String(partial.id),
          adjustmentType: String(partial.type),
          previousBalance: previousBalance,
          actualBalance: balanceAfterPartial,
          amount: Number(partial.amount || 0),
          adjusted: true
        };
        audit_('RECONCILE', 'accounts', accountId, requestId.value, Object.assign({}, recovered, { recovered: true }));
        invalidateDashboard_(String(partial.date || '').slice(0, 7));
        return ok_(Object.assign({}, recovered, { duplicate: true }), requestId.value);
      }
      assertRequestUnusedOutsideAudit_(requestId.value);

      const account = findById_(VINN_CONFIG.SHEETS.ACCOUNTS, accountId);
      if (!account || !accountIsActive_(account)) throw createError_('NOT_FOUND', 'Akun aktif tidak ditemukan.');
      const previousBalance = accountCurrentBalance_(account, transactions);
      const actualBalance = assertMoney_(payload.actualBalance, 'Saldo aktual');
      if (actualBalance < 0) throw createError_('INVALID_BALANCE', 'Saldo aktual tidak boleh negatif.');
      const liability = truthy_(account.is_liability);
      const movement = liability ? previousBalance - actualBalance : actualBalance - previousBalance;
      const amount = Math.abs(movement);

      if (!amount) {
        const noChange = {
          accountId: accountId,
          transactionId: '',
          previousBalance: previousBalance,
          actualBalance: actualBalance,
          amount: 0,
          adjusted: false
        };
        audit_('RECONCILE_NOOP', 'accounts', accountId, requestId.value, noChange);
        invalidateDashboard_();
        return ok_(Object.assign({}, noChange, { duplicate: false }), requestId.value);
      }

      const adjustmentType = movement > 0 ? 'adjustment_in' : 'adjustment_out';
      const direction = movement > 0 ? 'in' : 'out';
      const timestamp = nowIso_();
      const transaction = {
        id: id_('tx'), transfer_group_id: '', request_id: requestId.value,
        date: dateIso_(payload.date), time: '', type: adjustmentType,
        account_id: accountId, destination_account_id: '', amount: amount,
        category: 'Penyesuaian Saldo', merchant: 'Rekonsiliasi ' + String(account.name || 'akun'),
        notes: String(payload.notes || payload.note || '').trim().slice(0, 500),
        status: 'completed', direction: direction,
        created_at: timestamp, updated_at: timestamp, deleted_at: ''
      };
      assertMonthlyPeriodsOpen_([transaction]);
      appendObjects_(VINN_CONFIG.SHEETS.TRANSACTIONS, [transaction]);
      const result = {
        accountId: accountId,
        transactionId: transaction.id,
        adjustmentType: adjustmentType,
        previousBalance: previousBalance,
        actualBalance: actualBalance,
        amount: amount,
        adjusted: true
      };
      audit_('RECONCILE', 'accounts', accountId, requestId.value, result);
      invalidateDashboard_(String(transaction.date).slice(0, 7));
      return ok_(Object.assign({}, result, { transaction: transactionClientRow_(transaction), duplicate: false }), requestId.value);
    });
  } catch (error) { return fail_(error, requestId.value); }
}

function ledgerRevision_(accounts, transactions) {
  const source = JSON.stringify({
    accounts: accounts.map(function(row) {
      return [row.id, Number(row.opening_balance || 0), truthy_(row.is_liability), row.is_active, row.updated_at || ''];
    }),
    transactions: transactions.map(function(row) {
      return [row.id, row.type, Number(row.amount || 0), row.status || 'completed', row.account_id || '', row.destination_account_id || '', row.direction || '', row.deleted_at || '', row.updated_at || ''];
    })
  });
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, source, Utilities.Charset.UTF_8)
    .map(function(value) { return ('0' + ((value + 256) % 256).toString(16)).slice(-2); })
    .join('');
}

function ledgerHealthReport_() {
  const accounts = rowsAsObjects_(VINN_CONFIG.SHEETS.ACCOUNTS).sort(function(a, b) { return String(a.id).localeCompare(String(b.id)); });
  const transactions = rowsAsObjects_(VINN_CONFIG.SHEETS.TRANSACTIONS).sort(function(a, b) { return String(a.id).localeCompare(String(b.id)); });
  const accountMap = {};
  const issues = [];
  accounts.forEach(function(account) { accountMap[String(account.id)] = account; });
  let completedTransactionCount = 0;
  transactions.forEach(function(transaction) {
    if (transaction.deleted_at || String(transaction.status || 'completed') !== 'completed') return;
    completedTransactionCount += 1;
    const transactionId = String(transaction.id || '');
    const accountId = String(transaction.account_id || '');
    const amount = Number(transaction.amount || 0);
    const type = String(transaction.type || '');
    if (!accountMap[accountId]) {
      issues.push({ code: 'MISSING_ACCOUNT', transactionId: transactionId, accountId: accountId, message: 'Akun sumber transaksi ' + transactionId + ' tidak ditemukan.' });
      return;
    }
    if (!Number.isSafeInteger(amount) || amount <= 0 || ['income', 'expense', 'refund', 'transfer', 'investment_buy', 'adjustment_in', 'adjustment_out'].indexOf(type) === -1) {
      issues.push({ code: 'INVALID_TRANSACTION', transactionId: transactionId, message: 'Transaksi ' + transactionId + ' memiliki jenis atau nominal yang tidak valid.' });
      return;
    }
    if (type === 'transfer' || type === 'investment_buy') {
      const destinationId = String(transaction.destination_account_id || '');
      if (!accountMap[destinationId] || destinationId === accountId || ['in', 'out'].indexOf(String(transaction.direction || '')) === -1) {
        issues.push({ code: 'MISSING_DESTINATION', transactionId: transactionId, accountId: destinationId, message: 'Pasangan akun transaksi ' + transactionId + ' tidak lengkap.' });
      }
    }
  });
  const checks = accounts.map(function(account) {
    const expectedBalance = accountCurrentBalance_(account, transactions);
    const valid = Number.isSafeInteger(expectedBalance) && expectedBalance >= 0;
    if (!valid) issues.push({ code: 'NEGATIVE_EXPECTED_BALANCE', accountId: String(account.id), message: 'Ledger akun ' + String(account.name || account.id) + ' menghasilkan saldo yang tidak valid.' });
    return {
      id: String(account.id), name: String(account.name || 'Akun'), liability: truthy_(account.is_liability),
      active: accountIsActive_(account), openingBalance: Number(account.opening_balance || 0),
      storedBalance: expectedBalance, expectedBalance: expectedBalance, difference: 0, valid: valid,
      updatedAt: String(account.updated_at || '')
    };
  });
  const status = issues.length ? 'blocked' : 'healthy';
  return {
    status: status, storageMode: 'calculated', revision: ledgerRevision_(accounts, transactions), checkedAt: nowIso_(),
    canRepair: status === 'healthy', accounts: checks, issues: issues,
    summary: {
      accountCount: accounts.length, transactionCount: transactions.length,
      completedTransactionCount: completedTransactionCount, driftCount: 0,
      totalAbsoluteDifference: 0, issueCount: issues.length
    }
  };
}

function apiInspectLedger() {
  try { return ok_(ledgerHealthReport_()); }
  catch (error) { return fail_(error); }
}

function apiRepairLedger(payload) {
  const requestId = requestIdOrFailure_(payload);
  if (requestId.error) return requestId.error;
  try {
    return withDocumentLock_(function() {
      const existingAudit = assertRequestAudit_(requestId.value, ['LEDGER_RECALCULATE'], 'ledger', 'workspace');
      if (existingAudit) return ok_(Object.assign({}, ledgerHealthReport_(), { replayed: true, noChange: true, repairedAccounts: 0 }), requestId.value);
      assertRequestUnusedOutsideAudit_(requestId.value);
      const report = ledgerHealthReport_();
      if (String(payload.expectedRevision || '') !== report.revision) throw createError_('LEDGER_CHANGED', 'Ledger berubah setelah preview. Periksa ulang sebelum menghitung ulang.');
      if (report.status === 'blocked') throw createError_('LEDGER_REPAIR_BLOCKED', 'Ledger memiliki referensi atau saldo yang perlu diperiksa manual.', { issues: report.issues });
      invalidateDashboard_();
      audit_('LEDGER_RECALCULATE', 'ledger', 'workspace', requestId.value, { revision: report.revision, accountCount: report.summary.accountCount, transactionCount: report.summary.transactionCount });
      return ok_(Object.assign({}, ledgerHealthReport_(), { replayed: false, noChange: true, repairedAccounts: 0 }), requestId.value);
    });
  } catch (error) { return fail_(error, requestId.value); }
}

function apiListAuditLogs(params) {
  try {
    params = params || {};
    const page = Math.max(1, Number(params.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(params.pageSize) || 25));
    let rows = rowsAsObjects_(VINN_CONFIG.SHEETS.AUDIT_LOG);
    rows = rows
      .filter(function(row) { return !params.module || String(row.module) === String(params.module); })
      .filter(function(row) { return !params.action || String(row.action) === String(params.action); })
      .filter(function(row) { return !params.entityId || String(row.entity_id) === String(params.entityId); })
      .filter(function(row) { return !params.requestId || String(row.request_id) === String(params.requestId); })
      .sort(function(a, b) {
        return String(b.created_at).localeCompare(String(a.created_at)) || String(b.id).localeCompare(String(a.id));
      });
    const start = (page - 1) * pageSize;
    return ok_({
      items: rows.slice(start, start + pageSize).map(auditClientRow_),
      page: page,
      pageSize: pageSize,
      total: rows.length
    });
  } catch (error) { return fail_(error); }
}

function categoryRows_() {
  return rowsAsObjects_(VINN_CONFIG.SHEETS.CATEGORIES).map(categoryClientRow_);
}

function categoryClientRow_(row) {
  const active = categoryIsActive_(row);
  return {
    id: String(row.id || ''),
    name: String(row.name || 'Lainnya'),
    type: String(row.type || 'expense'),
    parentId: String(row.parent_id || '') || null,
    color: String(row.color || '#126b59'),
    icon: String(row.icon || 'tag'),
    active: active,
    archived: !active,
    isDefault: truthy_(row.is_default) || defaultCategoryId_(row.id)
  };
}

function categoryIsActive_(category) {
  if (!category) return false;
  return category.is_active === '' || category.is_active === undefined || category.is_active === null
    ? true
    : truthy_(category.is_active);
}

function accountIsActive_(account) {
  if (!account) return false;
  return account.is_active === '' || account.is_active === undefined || account.is_active === null
    ? true
    : truthy_(account.is_active);
}

function defaultCategoryId_(categoryId) {
  return DEFAULT_CATEGORIES.some(function(category) { return String(category[0]) === String(categoryId); });
}

function validateCategoryCandidate_(candidate, rows) {
  candidate.name = String(candidate.name || '').trim().slice(0, 80);
  candidate.type = String(candidate.type || '').toLowerCase();
  candidate.parent_id = String(candidate.parent_id || '').trim();
  candidate.color = String(candidate.color || '#126b59').trim();
  candidate.icon = String(candidate.icon || 'tag').trim().slice(0, 50);
  if (!candidate.name) throw createError_('INVALID_CATEGORY', 'Nama kategori wajib diisi.');
  if (['income', 'expense'].indexOf(candidate.type) === -1) {
    throw createError_('INVALID_CATEGORY_TYPE', 'Tipe kategori harus income atau expense.');
  }
  if (!/^#[0-9a-fA-F]{6}$/.test(candidate.color)) throw createError_('INVALID_COLOR', 'Warna kategori harus berformat hex, misalnya #126b59.');
  if (!/^[a-z0-9-]+$/i.test(candidate.icon)) throw createError_('INVALID_ICON', 'Icon kategori hanya boleh berisi huruf, angka, dan tanda hubung.');
  const duplicate = rows.find(function(row) {
    return String(row.id) !== String(candidate.id) &&
      String(row.name).trim().toLowerCase() === candidate.name.toLowerCase();
  });
  if (duplicate) throw createError_('CATEGORY_EXISTS', 'Nama kategori sudah digunakan. Gunakan nama yang unik.');

  if (candidate.parent_id) {
    if (candidate.parent_id === String(candidate.id)) throw createError_('CATEGORY_CYCLE', 'Kategori tidak dapat menjadi induknya sendiri.');
    const parent = rows.find(function(row) { return String(row.id) === candidate.parent_id; });
    if (!parent || !categoryIsActive_(parent)) throw createError_('PARENT_NOT_FOUND', 'Kategori induk aktif tidak ditemukan.');
    if (String(parent.type).toLowerCase() !== candidate.type) throw createError_('PARENT_TYPE_MISMATCH', 'Kategori induk harus memiliki tipe yang sama.');
    const visited = {};
    let cursor = parent;
    while (cursor && cursor.parent_id) {
      const cursorId = String(cursor.id);
      if (visited[cursorId] || String(cursor.parent_id) === String(candidate.id)) {
        throw createError_('CATEGORY_CYCLE', 'Relasi induk kategori membentuk siklus.');
      }
      visited[cursorId] = true;
      cursor = rows.find(function(row) { return String(row.id) === String(cursor.parent_id); });
    }
  }

  const incompatibleChild = rows.find(function(row) {
    return String(row.parent_id || '') === String(candidate.id) && categoryIsActive_(row) && String(row.type).toLowerCase() !== candidate.type;
  });
  if (incompatibleChild) throw createError_('CHILD_TYPE_MISMATCH', 'Tipe tidak dapat diubah selama kategori memiliki subkategori aktif dengan tipe berbeda.');
  return candidate;
}

function categoryReferenceCounts_(categoryName) {
  const transactions = rowsAsObjects_(VINN_CONFIG.SHEETS.TRANSACTIONS).filter(function(row) {
    const splits = parseJsonObject_(row.splits_json);
    return String(row.category) === String(categoryName) || (Array.isArray(splits) && splits.some(function(split) { return String(split.category) === String(categoryName); }));
  }).length;
  const budgets = rowsAsObjects_(VINN_CONFIG.SHEETS.BUDGETS).filter(function(row) {
    return String(row.category) === String(categoryName);
  }).length;
  const bills = rowsAsObjects_(VINN_CONFIG.SHEETS.BILLS).filter(function(row) {
    return String(row.category) === String(categoryName);
  }).length;
  return { transactions: transactions, budgets: budgets, bills: bills, total: transactions + budgets + bills };
}

function cascadeCategoryName_(oldName, newName) {
  const counts = { transactions: 0, budgets: 0, bills: 0, total: 0 };
  [
    { sheet: VINN_CONFIG.SHEETS.TRANSACTIONS, key: 'transactions' },
    { sheet: VINN_CONFIG.SHEETS.BUDGETS, key: 'budgets' },
    { sheet: VINN_CONFIG.SHEETS.BILLS, key: 'bills' }
  ].forEach(function(target) {
    rowsAsObjects_(target.sheet).forEach(function(row) {
      const splits = target.sheet === VINN_CONFIG.SHEETS.TRANSACTIONS ? parseJsonObject_(row.splits_json) : [];
      const splitMatch = Array.isArray(splits) && splits.some(function(split) { return String(split.category) === String(oldName); });
      if (String(row.category) !== String(oldName) && !splitMatch) return;
      const rowNumber = row._row;
      if (String(row.category) === String(oldName)) row.category = newName;
      if (splitMatch) row.splits_json = JSON.stringify(splits.map(function(split) { return String(split.category) === String(oldName) ? Object.assign({}, split, { category: newName }) : split; }));
      if (hasOwn_(row, 'updated_at')) row.updated_at = nowIso_();
      delete row._row;
      updateObjectRow_(target.sheet, rowNumber, row);
      counts[target.key] += 1;
      counts.total += 1;
    });
  });
  return counts;
}

function requestIdOrFailure_(payload) {
  try { return { value: requireRequestId_(payload) }; }
  catch (error) { return { value: '', error: fail_(error) }; }
}

function requestAudit_(requestId) {
  return rowsAsObjects_(VINN_CONFIG.SHEETS.AUDIT_LOG).find(function(row) {
    return String(row.request_id) === String(requestId);
  }) || null;
}

function assertRequestAudit_(requestId, actions, moduleName, entityId) {
  const audit = requestAudit_(requestId);
  if (!audit) return null;
  const actionMatches = actions.indexOf(String(audit.action)) !== -1;
  const moduleMatches = String(audit.module) === String(moduleName);
  const entityMatches = !entityId || String(audit.entity_id) === String(entityId);
  if (!actionMatches || !moduleMatches || !entityMatches) {
    throw createError_('REQUEST_ID_REUSED', 'requestId sudah digunakan oleh operasi lain.');
  }
  return audit;
}

function assertRequestUnusedOutsideAudit_(requestId) {
  const transaction = rowsAsObjects_(VINN_CONFIG.SHEETS.TRANSACTIONS).find(function(row) {
    return String(row.request_id) === String(requestId);
  });
  const category = rowsAsObjects_(VINN_CONFIG.SHEETS.CATEGORIES).find(function(row) {
    return String(row.request_id) === String(requestId);
  });
  if (transaction || category) throw createError_('REQUEST_ID_REUSED', 'requestId sudah digunakan oleh operasi lain.');
}

function categoryDuplicateResponse_(audit, requestId) {
  const category = findById_(VINN_CONFIG.SHEETS.CATEGORIES, audit.entity_id);
  if (!category) throw createError_('IDEMPOTENCY_STATE_INVALID', 'Hasil request sebelumnya tidak dapat ditemukan.');
  return ok_({ category: categoryClientRow_(category), duplicate: true }, requestId);
}

function reconcileDuplicateResponse_(audit, requestId) {
  const details = parseJsonObject_(audit.details_json);
  return ok_({
    accountId: String(audit.entity_id || details.accountId || ''),
    transactionId: String(details.transactionId || ''),
    adjustmentType: details.adjustmentType || undefined,
    previousBalance: Number(details.previousBalance || 0),
    actualBalance: Number(details.actualBalance || 0),
    amount: Number(details.amount || 0),
    adjusted: String(audit.action) === 'RECONCILE',
    duplicate: true
  }, requestId);
}

function auditClientRow_(row) {
  const details = parseJsonObject_(row.details_json);
  return {
    id: String(row.id || ''),
    action: String(row.action || ''),
    module: String(row.module || 'system'),
    entityType: String(row.module || 'system'),
    entityId: String(row.entity_id || '') || null,
    actor: String(row.actor_email || 'owner'),
    actorEmail: String(row.actor_email || 'owner'),
    requestId: String(row.request_id || '') || null,
    before: hasOwn_(details, 'before') ? details.before : null,
    after: hasOwn_(details, 'after') ? details.after : null,
    details: details,
    createdAt: String(row.created_at || '')
  };
}

function recentAuditLogs_(limit) {
  const size = Math.max(1, Math.min(100, Number(limit) || 20));
  return recentAuditRows_(size)
    .sort(function(a, b) {
      return String(b.created_at).localeCompare(String(a.created_at)) || String(b.id).localeCompare(String(a.id));
    })
    .slice(0, size)
    .map(auditClientRow_);
}

function recentAuditRows_(limit) {
  const size = Math.max(1, Math.min(500, Number(limit) || 100));
  const sheet = getWorkbook_().getSheetByName(VINN_CONFIG.SHEETS.AUDIT_LOG);
  if (!sheet || sheet.getLastRow() < 2) return [];
  const lastRow = sheet.getLastRow();
  const firstRow = Math.max(2, lastRow - size + 1);
  const rowCount = lastRow - firstRow + 1;
  const columnCount = Math.max(1, sheet.getLastColumn());
  const headers = sheet.getRange(1, 1, 1, columnCount).getValues()[0];
  const rows = sheet.getRange(firstRow, 1, rowCount, columnCount).getValues().map(function(values, rowIndex) {
    const result = { _row: firstRow + rowIndex };
    headers.forEach(function(header, index) { result[String(header)] = values[index]; });
    return result;
  });
  return rows;
}

function apiMutationStatus(payload) {
  const requestId = String(payload && payload.requestId || '').trim();
  if (!requestId || requestId.length > 160) return fail_(createError_('INVALID_REQUEST_ID', 'requestId pemeriksaan tidak valid.'));
  const audit = recentAuditRows_(300).reverse().find(function(row) {
    return String(row.request_id || '') === requestId;
  });
  return ok_({
    completed: Boolean(audit),
    action: audit ? String(audit.action || '') : null,
    module: audit ? String(audit.module || '') : null,
    entityId: audit ? String(audit.entity_id || '') : null,
    completedAt: audit ? String(audit.created_at || '') : null
  }, requestId);
}

function parseJsonObject_(value) {
  if (!value) return {};
  if (typeof value === 'object') return value;
  try {
    const parsed = JSON.parse(String(value));
    return parsed && typeof parsed === 'object' ? parsed : { value: parsed };
  } catch (error) {
    return { raw: String(value) };
  }
}

function transactionClientRow_(row) {
  const tags = parseJsonObject_(row.tags_json);
  const splits = parseJsonObject_(row.splits_json);
  const receiptId = String(row.receipt_file_id || '');
  return {
    id: String(row.id || ''),
    type: String(row.type || ''),
    date: String(row.date || ''),
    time: String(row.time || ''),
    title: String(row.merchant || row.notes || 'Transaksi'),
    merchant: String(row.merchant || ''),
    category: String(row.category || ''),
    notes: String(row.notes || ''),
    tags: Array.isArray(tags) ? tags : [],
    location: String(row.location || ''),
    splits: Array.isArray(splits) ? splits : [],
    accountId: String(row.account_id || ''),
    destinationAccountId: String(row.destination_account_id || '') || null,
    amount: Number(row.amount || 0),
    status: String(row.status || 'completed'),
    transferGroupId: String(row.transfer_group_id || '') || null,
    updatedAt: String(row.updated_at || '') || null,
    receipt: receiptId ? {
      id: receiptId,
      filename: String(row.receipt_filename || 'lampiran-struk'),
      contentType: String(row.receipt_content_type || 'application/octet-stream'),
      sizeBytes: Number(row.receipt_size_bytes || 0),
      url: 'https://drive.google.com/open?id=' + encodeURIComponent(receiptId)
    } : null
  };
}
