function apiSetupWorkspace(payload) {
  const requestId = payload && payload.requestId ? String(payload.requestId) : id_('req');
  try {
    setupVinnStore();
    return withDocumentLock_(function() {
      payload = payload || {};
      const existingAccounts = rowsAsObjects_(VINN_CONFIG.SHEETS.ACCOUNTS)
        .filter(function(row) { return row.is_active !== false && String(row.is_active).toLowerCase() !== 'false'; });
      if (existingAccounts.length) {
        throw createError_('ALREADY_CONFIGURED', 'Workspace Financial Planner sudah dikonfigurasi.');
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
          is_liability: type === 'Credit Card' || type === 'Paylater' || type === 'Loan' || type === 'Mortgage',
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

function apiUpdateProfile(payload) {
  const requestId = String(payload && payload.requestId || id_('req'));
  try {
    return withDocumentLock_(function() {
      const replay = requestAudit_(requestId);
      if (replay) {
        if (String(replay.action) !== 'UPDATE_PROFILE' || String(replay.module) !== 'profile') {
          throw createError_('REQUEST_ID_REUSED', 'requestId sudah digunakan oleh operasi lain.');
        }
        const replayDetails = parseJsonObject_(replay.details_json);
        const replayName = replayDetails.after && replayDetails.after.name
          ? String(replayDetails.after.name)
          : String(settingValue_('profile_name', 'Vinn'));
        return ok_({ profileName: replayName, duplicate: true }, requestId);
      }

      const name = String(payload && payload.name || '').trim();
      if (!name || name.length > 80) {
        throw createError_('INVALID_PROFILE_NAME', 'Nama pemilik wajib diisi dan maksimal 80 karakter.');
      }

      const previousName = String(settingValue_('profile_name', 'Vinn'));
      upsertSetting_('profile_name', name);
      audit_('UPDATE_PROFILE', 'profile', 'owner', requestId, {
        before: { name: previousName },
        after: { name: name }
      });
      invalidateDashboard_();
      return ok_({ profileName: name, duplicate: false }, requestId);
    });
  } catch (error) { return fail_(error, requestId); }
}

function defaultRoadmapSettings_() {
  return {
    horizonMonths: 24,
    incomeAdjustmentPct: 0,
    expenseAdjustmentPct: 0,
    annualInvestmentReturnPct: 6,
    annualInflationPct: 3,
    monthlyInvestment: 0
  };
}

function apiRoadmapSettings() {
  try {
    const raw = settingValue_('roadmap_settings', '');
    return ok_(raw ? Object.assign(defaultRoadmapSettings_(), parseJsonObject_(raw)) : defaultRoadmapSettings_());
  } catch (error) { return fail_(error); }
}

function apiUpdateRoadmapSettings(payload) {
  const requestId = String(payload && payload.requestId || id_('req'));
  try {
    return withDocumentLock_(function() {
      const replay = requestAudit_(requestId);
      if (replay) {
        if (String(replay.action) !== 'UPDATE_ROADMAP' || String(replay.module) !== 'roadmap') {
          throw createError_('REQUEST_ID_REUSED', 'requestId sudah digunakan oleh operasi lain.');
        }
        return apiRoadmapSettings();
      }
      function integerInRange_(field, min, max) {
        const value = Number(payload && payload[field]);
        if (!Number.isSafeInteger(value) || value < min || value > max) {
          throw createError_('INVALID_ROADMAP_SETTING', field + ' harus antara ' + min + ' dan ' + max + '.');
        }
        return value;
      }
      const horizon = integerInRange_('horizonMonths', 12, 60);
      if ([12, 24, 36, 60].indexOf(horizon) === -1) throw createError_('INVALID_ROADMAP_SETTING', 'Horizon harus 12, 24, 36, atau 60 bulan.');
      const settings = {
        horizonMonths: horizon,
        incomeAdjustmentPct: integerInRange_('incomeAdjustmentPct', -50, 100),
        expenseAdjustmentPct: integerInRange_('expenseAdjustmentPct', -50, 100),
        annualInvestmentReturnPct: integerInRange_('annualInvestmentReturnPct', 0, 30),
        annualInflationPct: integerInRange_('annualInflationPct', 0, 30),
        monthlyInvestment: integerInRange_('monthlyInvestment', 0, 1000000000)
      };
      const before = settingValue_('roadmap_settings', JSON.stringify(defaultRoadmapSettings_()));
      upsertSetting_('roadmap_settings', JSON.stringify(settings));
      audit_('UPDATE_ROADMAP', 'roadmap', 'financial-plan', requestId, {
        before: parseJsonObject_(before), after: settings
      });
      invalidateDashboard_();
      return ok_(settings, requestId);
    });
  } catch (error) { return fail_(error, requestId); }
}

function defaultDebtPlannerSettings_() {
  return { strategy: 'avalanche', extraMonthlyPayment: 0 };
}

function debtPlannerData_() {
  const rawSettings = settingValue_('debt_planner_settings', '');
  const rawPlans = settingValue_('debt_accounts', '');
  const settings = rawSettings ? Object.assign(defaultDebtPlannerSettings_(), parseJsonObject_(rawSettings)) : defaultDebtPlannerSettings_();
  const saved = rawPlans ? JSON.parse(rawPlans) : [];
  const plansByAccount = {};
  const completedTransactions = rowsAsObjects_(VINN_CONFIG.SHEETS.TRANSACTIONS).filter(function(transaction) {
    return String(transaction.status || 'completed') === 'completed' && !transaction.deleted_at;
  });
  (Array.isArray(saved) ? saved : []).forEach(function(plan) { plansByAccount[String(plan.accountId || '')] = plan; });
  const debts = rowsAsObjects_(VINN_CONFIG.SHEETS.ACCOUNTS)
    .filter(function(account) {
      const active = account.is_active !== false && String(account.is_active).toLowerCase() !== 'false';
      const liability = account.is_liability === true || String(account.is_liability).toLowerCase() === 'true';
      return active && liability && plansByAccount[String(account.id)];
    })
    .map(function(account) {
      const plan = plansByAccount[String(account.id)];
      return {
        accountId: String(account.id), name: String(account.name || 'Utang'),
        balance: Math.max(0, Math.round(accountCurrentBalance_(account, completedTransactions))),
        annualInterestRatePct: Number(plan.annualInterestRatePct || 0),
        minimumPayment: Math.max(0, Math.round(Number(plan.minimumPayment || 0))),
        dueDay: Math.max(1, Math.min(31, Math.round(Number(plan.dueDay || 1))))
      };
    });
  return { settings: settings, debts: debts };
}

function apiDebtPlanner() {
  try { return ok_(debtPlannerData_()); } catch (error) { return fail_(error); }
}

function apiUpdateDebtPlanner(payload) {
  const requestId = String(payload && payload.requestId || id_('req'));
  try {
    return withDocumentLock_(function() {
      const mode = String(payload && payload.mode || '');
      const expectedAction = mode === 'settings' ? 'UPDATE_DEBT_SETTINGS' : 'UPSERT_DEBT_PLAN';
      const replay = requestAudit_(requestId);
      if (replay) {
        if (String(replay.action) !== expectedAction || String(replay.module) !== 'debt_planner') {
          throw createError_('REQUEST_ID_REUSED', 'requestId sudah digunakan oleh operasi lain.');
        }
        return ok_(debtPlannerData_(), requestId);
      }
      if (mode === 'settings') {
        const strategy = String(payload.strategy || '');
        const extra = Number(payload.extraMonthlyPayment);
        if (['avalanche', 'snowball'].indexOf(strategy) === -1) throw createError_('INVALID_DEBT_STRATEGY', 'Strategi utang tidak valid.');
        if (!Number.isSafeInteger(extra) || extra < 0 || extra > 1000000000) throw createError_('INVALID_DEBT_EXTRA', 'Pembayaran ekstra tidak valid.');
        const before = debtPlannerData_().settings;
        const settings = { strategy: strategy, extraMonthlyPayment: extra };
        upsertSetting_('debt_planner_settings', JSON.stringify(settings));
        audit_('UPDATE_DEBT_SETTINGS', 'debt_planner', 'settings', requestId, { before: before, after: settings });
      } else if (mode === 'debt') {
        const accountId = String(payload.accountId || '');
        const account = rowsAsObjects_(VINN_CONFIG.SHEETS.ACCOUNTS).find(function(row) { return String(row.id) === accountId; });
        const liability = account && (account.is_liability === true || String(account.is_liability).toLowerCase() === 'true');
        if (!account || !liability) throw createError_('INVALID_DEBT_ACCOUNT', 'Pilih akun kewajiban yang aktif.');
        const rate = Number(payload.annualInterestRatePct);
        const minimum = Number(payload.minimumPayment);
        const dueDay = Number(payload.dueDay);
        if (!Number.isFinite(rate) || rate < 0 || rate > 100) throw createError_('INVALID_DEBT_RATE', 'Bunga tahunan tidak valid.');
        if (!Number.isSafeInteger(minimum) || minimum < 0 || minimum > 1000000000) throw createError_('INVALID_DEBT_MINIMUM', 'Cicilan minimum tidak valid.');
        if (!Number.isSafeInteger(dueDay) || dueDay < 1 || dueDay > 31) throw createError_('INVALID_DEBT_DUE_DAY', 'Tanggal jatuh tempo tidak valid.');
        const raw = settingValue_('debt_accounts', '[]');
        const plans = JSON.parse(raw || '[]');
        const next = Array.isArray(plans) ? plans.filter(function(plan) { return String(plan.accountId) !== accountId; }) : [];
        const plan = { accountId: accountId, annualInterestRatePct: Math.round(rate * 100) / 100, minimumPayment: minimum, dueDay: dueDay };
        next.push(plan);
        upsertSetting_('debt_accounts', JSON.stringify(next));
        audit_('UPSERT_DEBT_PLAN', 'debt_planner', accountId, requestId, { after: plan });
      } else throw createError_('INVALID_DEBT_MODE', 'Mode perubahan tidak valid.');
      invalidateDashboard_();
      return ok_(debtPlannerData_(), requestId);
    });
  } catch (error) { return fail_(error, requestId); }
}

function defaultCashflowForecastSettings_() {
  return { horizonDays: 60, monthlyIncomeOverride: 0, incomeDay: 25, minimumCashBuffer: 2000000 };
}

function apiCashflowForecastSettings() {
  try {
    const raw = settingValue_('cashflow_forecast_settings', '');
    return ok_(raw ? Object.assign(defaultCashflowForecastSettings_(), parseJsonObject_(raw)) : defaultCashflowForecastSettings_());
  } catch (error) { return fail_(error); }
}

function apiUpdateCashflowForecastSettings(payload) {
  const requestId = String(payload && payload.requestId || id_('req'));
  try {
    return withDocumentLock_(function() {
      const replay = requestAudit_(requestId);
      if (replay) {
        if (String(replay.action) !== 'UPDATE_CASHFLOW_FORECAST' || String(replay.module) !== 'cashflow_forecast') {
          throw createError_('REQUEST_ID_REUSED', 'requestId sudah digunakan oleh operasi lain.');
        }
        return apiCashflowForecastSettings();
      }
      function integerInRange_(field, min, max) {
        const value = Number(payload && payload[field]);
        if (!Number.isSafeInteger(value) || value < min || value > max) throw createError_('INVALID_FORECAST_SETTING', field + ' tidak valid.');
        return value;
      }
      const horizon = integerInRange_('horizonDays', 30, 90);
      if ([30, 60, 90].indexOf(horizon) === -1) throw createError_('INVALID_FORECAST_SETTING', 'Horizon harus 30, 60, atau 90 hari.');
      const settings = {
        horizonDays: horizon,
        monthlyIncomeOverride: integerInRange_('monthlyIncomeOverride', 0, 10000000000),
        incomeDay: integerInRange_('incomeDay', 1, 28),
        minimumCashBuffer: integerInRange_('minimumCashBuffer', 0, 10000000000)
      };
      const beforeRaw = settingValue_('cashflow_forecast_settings', JSON.stringify(defaultCashflowForecastSettings_()));
      upsertSetting_('cashflow_forecast_settings', JSON.stringify(settings));
      audit_('UPDATE_CASHFLOW_FORECAST', 'cashflow_forecast', 'settings', requestId, { before: parseJsonObject_(beforeRaw), after: settings });
      invalidateDashboard_();
      return ok_(settings, requestId);
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
          is_liability: type === 'Credit Card' || type === 'Paylater' || type === 'Loan' || type === 'Mortgage',
        is_active: true, created_at: now, updated_at: now
      };
      appendObjects_(VINN_CONFIG.SHEETS.ACCOUNTS, [account]);
      audit_('CREATE', 'accounts', account.id, requestId, { name: account.name, type: account.type });
      invalidateDashboard_();
      return ok_({ account: account }, requestId);
    });
  } catch (error) { return fail_(error, requestId); }
}

function apiImportAccounts(payload) {
  const requestId = String(payload && payload.requestId || id_('req'));
  try {
    return withDocumentLock_(function() {
      const replay = requestAudit_(requestId);
      if (replay) {
        if (String(replay.action) !== 'IMPORT' || String(replay.module) !== 'accounts') throw createError_('REQUEST_ID_REUSED', 'requestId sudah digunakan oleh operasi lain.');
        return ok_({ imported: Number(parseJsonObject_(replay.details_json).imported || 0), duplicate: true }, requestId);
      }
      const items = Array.isArray(payload.accounts) ? payload.accounts : [];
      if (!items.length || items.length > 100) throw createError_('INVALID_IMPORT', 'Impor harus berisi 1 sampai 100 akun.');
      const allowedTypes = ['Bank', 'E-Wallet', 'Cash', 'Investment', 'Credit Card', 'Paylater', 'Loan', 'Mortgage'];
      const existingNames = rowsAsObjects_(VINN_CONFIG.SHEETS.ACCOUNTS).map(function(account) { return String(account.name || '').trim().toLowerCase(); });
      const incomingNames = {};
      const now = nowIso_();
      const rows = items.map(function(item, index) {
        const rowNumber = index + 2;
        const name = String(item.name || '').trim();
        const normalizedName = name.toLowerCase();
        const type = String(item.type || '');
        const openingBalance = Number(item.openingBalance === undefined ? item.balance || 0 : item.openingBalance);
        const color = String(item.color || '#126b59').trim();
        if (!name || name.length > 100) throw createError_('INVALID_IMPORT_ROW', 'Baris ' + rowNumber + ': nama akun wajib diisi dan maksimal 100 karakter.');
        if (allowedTypes.indexOf(type) === -1) throw createError_('INVALID_IMPORT_ROW', 'Baris ' + rowNumber + ': jenis akun tidak dikenali.');
        if (!Number.isSafeInteger(openingBalance) || openingBalance < 0) throw createError_('INVALID_IMPORT_ROW', 'Baris ' + rowNumber + ': saldo awal harus Rupiah bulat non-negatif.');
        if (!/^#[0-9a-f]{6}$/i.test(color)) throw createError_('INVALID_IMPORT_ROW', 'Baris ' + rowNumber + ': warna harus berupa kode hex.');
        if (existingNames.indexOf(normalizedName) >= 0 || incomingNames[normalizedName]) throw createError_('DUPLICATE_ACCOUNT_NAME', 'Baris ' + rowNumber + ': nama akun sudah digunakan.');
        incomingNames[normalizedName] = true;
        return {
          id: String(item.id || id_('acc')), name: name, type: type,
          institution: String(item.institution || '').trim().slice(0, 100),
          mask: String(item.mask || '').trim().slice(0, 40), currency: VINN_CONFIG.CURRENCY,
          opening_balance: openingBalance, color: color,
          is_liability: ['Credit Card', 'Paylater', 'Loan', 'Mortgage'].indexOf(type) !== -1, is_active: true,
          created_at: now, updated_at: now
        };
      });
      appendObjects_(VINN_CONFIG.SHEETS.ACCOUNTS, rows);
      audit_('IMPORT', 'accounts', requestId, requestId, { imported: rows.length, accountIds: rows.map(function(row) { return row.id; }), after: rows });
      invalidateDashboard_();
      return ok_({ imported: rows.length, duplicate: false }, requestId);
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
      const frequency = String(payload.frequency || 'monthly');
      if (frequency !== 'monthly') throw createError_('INVALID_BILL_FREQUENCY', 'Frekuensi tagihan belum didukung.');
      const reminderDays = Array.isArray(payload.reminderDays) ? payload.reminderDays.map(Number).filter(function(day, index, values) { return [7, 3, 1, 0].indexOf(day) >= 0 && values.indexOf(day) === index; }).sort(function(a, b) { return b - a; }) : [7, 3, 1, 0];
      if (!reminderDays.length) throw createError_('INVALID_REMINDER_DAYS', 'Pilih minimal satu jadwal reminder tagihan.');
      const now = nowIso_();
      const bill = { id: id_('bill'), name: String(payload.name || '').trim().slice(0, 100), amount: amount, category: String(payload.category || 'Tagihan'), account_id: String(payload.accountId || ''), frequency: frequency, due_date: dateIso_(payload.dueDate), reminder_days: reminderDays.join(','), status: 'active', last_paid_period: '', created_at: now, updated_at: now };
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
        const paymentTransaction = {
          id: transactionId, transfer_group_id: '', request_id: requestId,
          date: dateIso_(payload.date || new Date()), time: '', type: 'expense',
          account_id: accountId, destination_account_id: '', amount: assertPositiveMoney_(bill.amount),
          category: String(bill.category || 'Tagihan'), merchant: 'Bayar ' + String(bill.name || 'Tagihan'),
          notes: 'Pembayaran tagihan ' + String(bill.id), status: 'completed', direction: '',
          created_at: timestamp, updated_at: timestamp, deleted_at: ''
        };
        validateLedgerMutation_([], [paymentTransaction]);
        appendObjects_(VINN_CONFIG.SHEETS.TRANSACTIONS, [paymentTransaction]);
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
