function apiSetupWorkspace(payload) {
  const requestId = payload && payload.requestId ? String(payload.requestId) : id_('req');
  try {
    setupVinnStore();
    return withDocumentLock_(function() {
      payload = payload || {};
      const existingAccounts = rowsAsObjects_(VINN_CONFIG.SHEETS.ACCOUNTS)
        .filter(function(row) { return row.is_active !== false && String(row.is_active).toLowerCase() !== 'false'; });
      if (existingAccounts.length) {
        throw createError_('ALREADY_CONFIGURED', 'Workspace VINN STORE sudah dikonfigurasi.');
      }

      const profileName = String(payload.profileName || 'Vinn').trim().slice(0, 80);
      const storeName = String(payload.storeName || VINN_CONFIG.APP_NAME).trim().slice(0, 80);
      const currency = String(payload.currency || VINN_CONFIG.CURRENCY).toUpperCase();
      const timezone = String(payload.timezone || VINN_CONFIG.TIMEZONE);
      const initialAccounts = Array.isArray(payload.accounts) ? payload.accounts : [];
      if (!initialAccounts.length) throw createError_('ACCOUNT_REQUIRED', 'Tambahkan minimal satu akun untuk memulai.');

      upsertSetting_('profile_name', profileName);
      upsertSetting_('app_name', storeName);
      upsertSetting_('currency', currency);
      upsertSetting_('timezone', timezone);
      upsertSetting_('setup_completed', 'true');

      const now = nowIso_();
      const accountRows = initialAccounts.map(function(account, index) {
        const name = String(account.name || '').trim().slice(0, 80);
        if (!name) throw createError_('INVALID_ACCOUNT', 'Nama akun ke-' + (index + 1) + ' wajib diisi.');
        const type = String(account.type || 'Bank');
        return {
          id: id_('acc'), name: name, type: type,
          institution: String(account.institution || '').trim().slice(0, 80),
          mask: String(account.mask || '').trim().slice(0, 30), currency: currency,
          opening_balance: Math.round(Number(account.openingBalance || 0)),
          color: String(account.color || '#126b59'),
          is_liability: type === 'Credit Card' || type === 'Paylater' || type === 'Loan',
          is_active: true, created_at: now, updated_at: now
        };
      });
      appendObjects_(VINN_CONFIG.SHEETS.ACCOUNTS, accountRows);
      audit_('SETUP_WORKSPACE', 'system', '', requestId, { accountCount: accountRows.length, storeName: storeName });
      invalidateDashboard_(Utilities.formatDate(new Date(), timezone, 'yyyy-MM'));
      return apiGetBootstrap(Utilities.formatDate(new Date(), timezone, 'yyyy-MM'));
    });
  } catch (error) { return fail_(error, requestId); }
}

function apiCreateAccount(payload) {
  const requestId = payload && payload.requestId ? String(payload.requestId) : id_('req');
  try {
    return withDocumentLock_(function() {
      payload = payload || {};
      const name = String(payload.name || '').trim().slice(0, 80);
      if (!name) throw createError_('INVALID_ACCOUNT', 'Nama akun wajib diisi.');
      const type = String(payload.type || 'Bank');
      const now = nowIso_();
      const account = {
        id: id_('acc'), name: name, type: type,
        institution: String(payload.institution || '').trim().slice(0, 80),
        mask: String(payload.mask || '').trim().slice(0, 30),
        currency: String(payload.currency || VINN_CONFIG.CURRENCY).toUpperCase(),
        opening_balance: Math.round(Number(payload.openingBalance || 0)),
        color: String(payload.color || '#126b59'),
        is_liability: type === 'Credit Card' || type === 'Paylater' || type === 'Loan',
        is_active: true, created_at: now, updated_at: now
      };
      appendObjects_(VINN_CONFIG.SHEETS.ACCOUNTS, [account]);
      audit_('CREATE', 'accounts', account.id, requestId, { name: account.name, type: account.type });
      invalidateDashboard_();
      return ok_({ account: account }, requestId);
    });
  } catch (error) { return fail_(error, requestId); }
}

function apiArchiveAccount(payload) {
  const requestId = payload && payload.requestId ? String(payload.requestId) : id_('req');
  try {
    return withDocumentLock_(function() {
      const account = findById_(VINN_CONFIG.SHEETS.ACCOUNTS, payload.accountId);
      if (!account) throw createError_('NOT_FOUND', 'Akun tidak ditemukan.');
      const hasTransactions = rowsAsObjects_(VINN_CONFIG.SHEETS.TRANSACTIONS).some(function(row) {
        return !row.deleted_at && (String(row.account_id) === String(account.id) || String(row.destination_account_id) === String(account.id));
      });
      const hasBills = rowsAsObjects_(VINN_CONFIG.SHEETS.BILLS).some(function(row) {
        return String(row.account_id) === String(account.id);
      });
      if (hasTransactions || hasBills) {
        throw createError_('ACCOUNT_IN_USE', 'Akun masih dipakai oleh transaksi atau tagihan. Hapus atau pindahkan catatan terkait terlebih dahulu.');
      }
      account.is_active = false;
      account.updated_at = nowIso_();
      const rowNumber = account._row;
      delete account._row;
      updateObjectRow_(VINN_CONFIG.SHEETS.ACCOUNTS, rowNumber, account);
      audit_('ARCHIVE', 'accounts', account.id, requestId, {});
      invalidateDashboard_();
      return ok_({ accountId: account.id, archived: true }, requestId);
    });
  } catch (error) { return fail_(error, requestId); }
}

function apiUpsertBudget(payload) {
  const requestId = payload && payload.requestId ? String(payload.requestId) : id_('req');
  try {
    return withDocumentLock_(function() {
      payload = payload || {};
      const month = String(payload.month || Utilities.formatDate(new Date(), VINN_CONFIG.TIMEZONE, 'yyyy-MM'));
      const category = String(payload.category || '').trim();
      const limitAmount = assertPositiveMoney_(payload.limitAmount);
      if (!/^\d{4}-\d{2}$/.test(month) || !category) throw createError_('INVALID_BUDGET', 'Bulan dan kategori anggaran wajib diisi.');
      const existing = rowsAsObjects_(VINN_CONFIG.SHEETS.BUDGETS).find(function(row) {
        return String(row.month) === month && String(row.category) === category;
      });
      const now = nowIso_();
      if (existing) {
        const rowNumber = existing._row;
        existing.limit_amount = limitAmount;
        existing.rollover = Boolean(payload.rollover);
        existing.updated_at = now;
        delete existing._row;
        updateObjectRow_(VINN_CONFIG.SHEETS.BUDGETS, rowNumber, existing);
        audit_('UPDATE', 'budgets', existing.id, requestId, { month: month, category: category });
        invalidateDashboard_(month);
        return ok_({ budget: existing }, requestId);
      }
      const budget = { id: id_('budget'), month: month, category: category, limit_amount: limitAmount, rollover: Boolean(payload.rollover), created_at: now, updated_at: now };
      appendObjects_(VINN_CONFIG.SHEETS.BUDGETS, [budget]);
      audit_('CREATE', 'budgets', budget.id, requestId, { month: month, category: category });
      invalidateDashboard_(month);
      return ok_({ budget: budget }, requestId);
    });
  } catch (error) { return fail_(error, requestId); }
}

function apiCreateGoal(payload) {
  const requestId = payload && payload.requestId ? String(payload.requestId) : id_('req');
  try {
    return withDocumentLock_(function() {
      payload = payload || {};
      const target = assertPositiveMoney_(payload.targetAmount);
      const current = Math.max(0, Math.round(Number(payload.currentAmount || 0)));
      if (current > target) throw createError_('INVALID_GOAL', 'Dana terkumpul tidak boleh melebihi target.');
      const now = nowIso_();
      const goal = { id: id_('goal'), name: String(payload.name || '').trim().slice(0, 100), target_amount: target, current_amount: current, deadline: dateIso_(payload.deadline), account_id: payload.accountId || '', color: payload.color || '#126b59', icon: payload.icon || 'target', status: current >= target ? 'completed' : 'active', created_at: now, updated_at: now };
      if (!goal.name) throw createError_('INVALID_GOAL', 'Nama target wajib diisi.');
      appendObjects_(VINN_CONFIG.SHEETS.GOALS, [goal]);
      audit_('CREATE', 'goals', goal.id, requestId, { name: goal.name, target: target });
      invalidateDashboard_();
      return ok_({ goal: goal }, requestId);
    });
  } catch (error) { return fail_(error, requestId); }
}

function apiContributeGoal(payload) {
  const requestId = payload && payload.requestId ? String(payload.requestId) : id_('req');
  try {
    return withDocumentLock_(function() {
      const goal = findById_(VINN_CONFIG.SHEETS.GOALS, payload.goalId);
      if (!goal) throw createError_('NOT_FOUND', 'Target tidak ditemukan.');
      const amount = assertPositiveMoney_(payload.amount);
      goal.current_amount = Math.min(Number(goal.target_amount), Number(goal.current_amount || 0) + amount);
      goal.status = Number(goal.current_amount) >= Number(goal.target_amount) ? 'completed' : 'active';
      goal.updated_at = nowIso_();
      const rowNumber = goal._row;
      delete goal._row;
      updateObjectRow_(VINN_CONFIG.SHEETS.GOALS, rowNumber, goal);
      audit_('CONTRIBUTE', 'goals', goal.id, requestId, { amount: amount });
      invalidateDashboard_();
      return ok_({ goal: goal }, requestId);
    });
  } catch (error) { return fail_(error, requestId); }
}

function apiCreateBill(payload) {
  const requestId = payload && payload.requestId ? String(payload.requestId) : id_('req');
  try {
    return withDocumentLock_(function() {
      payload = payload || {};
      const amount = assertPositiveMoney_(payload.amount);
      const now = nowIso_();
      const bill = { id: id_('bill'), name: String(payload.name || '').trim().slice(0, 100), amount: amount, category: String(payload.category || 'Tagihan'), account_id: String(payload.accountId || ''), frequency: String(payload.frequency || 'monthly'), due_date: dateIso_(payload.dueDate), reminder_days: String(payload.reminderDays || '7,3,1,0'), status: 'active', last_paid_period: '', created_at: now, updated_at: now };
      if (!bill.name || !bill.account_id || !findById_(VINN_CONFIG.SHEETS.ACCOUNTS, bill.account_id)) throw createError_('INVALID_BILL', 'Nama dan akun pembayaran tagihan wajib diisi.');
      appendObjects_(VINN_CONFIG.SHEETS.BILLS, [bill]);
      audit_('CREATE', 'bills', bill.id, requestId, { name: bill.name, amount: amount });
      invalidateDashboard_();
      return ok_({ bill: bill }, requestId);
    });
  } catch (error) { return fail_(error, requestId); }
}

function apiMarkBillPaid(payload) {
  const requestId = payload && payload.requestId ? String(payload.requestId) : id_('req');
  try {
    return withDocumentLock_(function() {
      const bill = findById_(VINN_CONFIG.SHEETS.BILLS, payload.billId);
      if (!bill) throw createError_('NOT_FOUND', 'Tagihan tidak ditemukan.');
      if (String(bill.category) === 'Kewajiban') {
        throw createError_('DEBT_PAYMENT_REQUIRES_TRANSFER', 'Pembayaran kartu kredit harus dicatat sebagai transfer ke akun kewajiban agar tidak menjadi pengeluaran ganda.');
      }
      const period = String(payload.period || Utilities.formatDate(new Date(), VINN_CONFIG.TIMEZONE, 'yyyy-MM'));
      if (!/^\d{4}-\d{2}$/.test(period)) throw createError_('INVALID_PERIOD', 'Periode pembayaran harus berformat YYYY-MM.');
      const existingPayment = rowsAsObjects_(VINN_CONFIG.SHEETS.TRANSACTIONS).find(function(row) {
        return String(row.request_id) === requestId && !row.deleted_at;
      });
      if (String(bill.last_paid_period) === period) {
        return ok_({ bill: bill, transactionId: existingPayment ? existingPayment.id : '', duplicate: true }, requestId);
      }
      const accountId = String(bill.account_id || '');
      if (!accountId || !findById_(VINN_CONFIG.SHEETS.ACCOUNTS, accountId)) {
        throw createError_('ACCOUNT_REQUIRED', 'Akun pembayaran tagihan tidak ditemukan.');
      }
      const timestamp = nowIso_();
      let transactionId = existingPayment ? existingPayment.id : '';
      if (!existingPayment) {
        transactionId = id_('tx');
        appendObjects_(VINN_CONFIG.SHEETS.TRANSACTIONS, [{
          id: transactionId, transfer_group_id: '', request_id: requestId,
          date: dateIso_(payload.date || new Date()), time: '', type: 'expense',
          account_id: accountId, destination_account_id: '', amount: assertPositiveMoney_(bill.amount),
          category: String(bill.category || 'Tagihan'), merchant: 'Bayar ' + String(bill.name || 'Tagihan'),
          notes: 'Pembayaran tagihan ' + String(bill.id), status: 'completed', direction: '',
          created_at: timestamp, updated_at: timestamp, deleted_at: ''
        }]);
      }
      bill.last_paid_period = period;
      bill.updated_at = timestamp;
      const rowNumber = bill._row;
      delete bill._row;
      updateObjectRow_(VINN_CONFIG.SHEETS.BILLS, rowNumber, bill);
      audit_('MARK_PAID', 'bills', bill.id, requestId, { period: period, transactionId: transactionId });
      invalidateDashboard_(period);
      return ok_({ bill: bill, transactionId: transactionId, duplicate: Boolean(existingPayment) }, requestId);
    });
  } catch (error) { return fail_(error, requestId); }
}

function upsertSetting_(key, value) {
  const existing = rowsAsObjects_(VINN_CONFIG.SHEETS.SETTINGS).find(function(row) { return String(row.key) === String(key); });
  const row = { key: key, value: String(value), updated_at: nowIso_() };
  if (!existing) {
    appendObjects_(VINN_CONFIG.SHEETS.SETTINGS, [row]);
    return;
  }
  updateObjectRow_(VINN_CONFIG.SHEETS.SETTINGS, existing._row, row);
}
