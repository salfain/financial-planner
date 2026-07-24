function apiSetupWorkspace(payload) {
  const requestId = payload && payload.requestId ? String(payload.requestId) : id_('req');
  try {
    setupFinancialPlanner();
    return withDocumentLock_(function() {
      payload = payload || {};
      ensureSheet_(VINN_CONFIG.SHEETS.BILLS, VINN_CONFIG.HEADERS.Bills);
      const existingAccounts = rowsAsObjects_(VINN_CONFIG.SHEETS.ACCOUNTS)
        .filter(function(row) { return row.is_active !== false && String(row.is_active).toLowerCase() !== 'false'; });
      if (existingAccounts.length) {
        throw createError_('ALREADY_CONFIGURED', 'Workspace Financial Planner sudah dikonfigurasi.');
      }

      const profileName = String(payload.profileName || 'Pemilik').trim().slice(0, 80);
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
          : String(settingValue_('profile_name', 'Pemilik'));
        return ok_({ profileName: replayName, duplicate: true }, requestId);
      }

      const name = String(payload && payload.name || '').trim();
      if (!name || name.length > 80) {
        throw createError_('INVALID_PROFILE_NAME', 'Nama pemilik wajib diisi dan maksimal 80 karakter.');
      }

      const previousName = String(settingValue_('profile_name', 'Pemilik'));
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

function defaultEmergencyFundSettings_() {
  return { targetMonths: 6, monthlyExpenseOverride: 0, monthlyContribution: 0, accountIds: [] };
}
function apiEmergencyFundSettings() {
  try { const raw = settingValue_('emergency_fund_settings', ''); return ok_(raw ? Object.assign(defaultEmergencyFundSettings_(), parseJsonObject_(raw)) : defaultEmergencyFundSettings_()); }
  catch (error) { return fail_(error); }
}
function apiUpdateEmergencyFundSettings(payload) {
  const requestId = String(payload && payload.requestId || id_('req'));
  try {
    return withDocumentLock_(function() {
      const replay = requestAudit_(requestId);
      if (replay) {
        if (String(replay.action) !== 'UPDATE_EMERGENCY_FUND' || String(replay.module) !== 'emergency_fund') throw createError_('REQUEST_ID_REUSED', 'requestId sudah digunakan oleh operasi lain.');
        return apiEmergencyFundSettings();
      }
      const target = Number(payload.targetMonths);
      const expense = Number(payload.monthlyExpenseOverride);
      const contribution = Number(payload.monthlyContribution);
      if ([3,6,9,12].indexOf(target) === -1) throw createError_('INVALID_EMERGENCY_TARGET', 'Target dana darurat tidak valid.');
      if (!Number.isSafeInteger(expense) || expense < 0 || expense > 10000000000) throw createError_('INVALID_EMERGENCY_EXPENSE', 'Pengeluaran bulanan tidak valid.');
      if (!Number.isSafeInteger(contribution) || contribution < 0 || contribution > 10000000000) throw createError_('INVALID_EMERGENCY_CONTRIBUTION', 'Kontribusi bulanan tidak valid.');
      const requestedIds = Array.isArray(payload.accountIds) ? payload.accountIds.map(String) : [];
      if (requestedIds.length > 30) throw createError_('INVALID_EMERGENCY_ACCOUNTS', 'Terlalu banyak akun dipilih.');
      const eligible = rowsAsObjects_(VINN_CONFIG.SHEETS.ACCOUNTS).filter(function(account) { const active = account.is_active !== false && String(account.is_active).toLowerCase() !== 'false'; const liability = account.is_liability === true || String(account.is_liability).toLowerCase() === 'true'; return active && !liability && String(account.type) !== 'Investment'; }).map(function(account) { return String(account.id); });
      const accountIds = requestedIds.filter(function(id, index) { return eligible.indexOf(id) !== -1 && requestedIds.indexOf(id) === index; });
      const next = { targetMonths: target, monthlyExpenseOverride: expense, monthlyContribution: contribution, accountIds: accountIds };
      const before = settingValue_('emergency_fund_settings', JSON.stringify(defaultEmergencyFundSettings_()));
      upsertSetting_('emergency_fund_settings', JSON.stringify(next));
      audit_('UPDATE_EMERGENCY_FUND', 'emergency_fund', 'settings', requestId, { before: parseJsonObject_(before), after: next });
      invalidateDashboard_();
      return ok_(next, requestId);
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
      const allowedTypes = ['Bank', 'E-Wallet', 'Cash', 'Investment', 'Credit Card', 'Paylater', 'Loan', 'Mortgage', 'Deposit', 'Receivable', 'Custom'];
      if (allowedTypes.indexOf(type) === -1) throw createError_('INVALID_ACCOUNT_TYPE', 'Jenis akun tidak dikenali.');
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

function apiUpdateAccount(payload) {
  const requestId = String(payload && payload.requestId || id_('req'));
  try {
    return withDocumentLock_(function() {
      const account = findById_(VINN_CONFIG.SHEETS.ACCOUNTS, payload.accountId);
      if (!account) throw createError_('NOT_FOUND', 'Akun tidak ditemukan.');
      const allowedTypes = ['Bank', 'E-Wallet', 'Cash', 'Investment', 'Credit Card', 'Paylater', 'Loan', 'Mortgage', 'Deposit', 'Receivable', 'Custom'];
      const type = String(payload.type === undefined ? account.type : payload.type);
      const name = String(payload.name === undefined ? account.name : payload.name).trim().slice(0, 100);
      const color = String(payload.color === undefined ? account.color : payload.color);
      if (!name) throw createError_('INVALID_ACCOUNT', 'Nama akun wajib diisi.');
      if (allowedTypes.indexOf(type) === -1) throw createError_('INVALID_ACCOUNT_TYPE', 'Jenis akun tidak dikenali.');
      if (!/^#[0-9a-f]{6}$/i.test(color)) throw createError_('INVALID_COLOR', 'Warna akun tidak valid.');
      const before = Object.assign({}, account); delete before._row;
      const rowNumber = account._row;
      account.name = name;
      account.type = type;
      account.institution = String(payload.institution === undefined ? account.institution || '' : payload.institution).trim().slice(0, 100);
      account.mask = String(payload.mask === undefined ? account.mask || '' : payload.mask).trim().slice(0, 40);
      account.color = color;
      account.is_liability = ['Credit Card', 'Paylater', 'Loan', 'Mortgage'].indexOf(type) !== -1;
      account.updated_at = nowIso_();
      delete account._row;
      updateObjectRow_(VINN_CONFIG.SHEETS.ACCOUNTS, rowNumber, account);
      audit_('UPDATE', 'accounts', account.id, requestId, { before: before, after: account });
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
      const allowedTypes = ['Bank', 'E-Wallet', 'Cash', 'Investment', 'Credit Card', 'Paylater', 'Loan', 'Mortgage', 'Deposit', 'Receivable', 'Custom'];
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

function apiUpdateBudget(payload) {
  const requestId = String(payload && payload.requestId || id_('req'));
  try {
    return withDocumentLock_(function() {
      const budget = findById_(VINN_CONFIG.SHEETS.BUDGETS, payload.budgetId);
      if (!budget) throw createError_('NOT_FOUND', 'Anggaran tidak ditemukan.');
      const limitAmount = assertPositiveMoney_(payload.limit === undefined ? payload.limitAmount : payload.limit);
      const before = Object.assign({}, budget); delete before._row;
      const rowNumber = budget._row;
      budget.limit_amount = limitAmount;
      if (payload.color !== undefined) budget.color = String(payload.color);
      budget.updated_at = nowIso_();
      delete budget._row;
      updateObjectRow_(VINN_CONFIG.SHEETS.BUDGETS, rowNumber, budget);
      audit_('UPDATE', 'budgets', budget.id, requestId, { before: before, after: budget });
      invalidateDashboard_(String(budget.month));
      return ok_({ budget: budget }, requestId);
    });
  } catch (error) { return fail_(error, requestId); }
}

function apiDeleteBudget(payload) {
  const requestId = String(payload && payload.requestId || id_('req'));
  try {
    return withDocumentLock_(function() {
      const budget = findById_(VINN_CONFIG.SHEETS.BUDGETS, payload.budgetId);
      if (!budget) throw createError_('NOT_FOUND', 'Anggaran tidak ditemukan.');
      const rowNumber = budget._row;
      const before = Object.assign({}, budget); delete before._row;
      deleteObjectRow_(VINN_CONFIG.SHEETS.BUDGETS, rowNumber);
      audit_('DELETE', 'budgets', budget.id, requestId, { before: before });
      invalidateDashboard_(String(budget.month));
      return ok_({ deleted: true, id: budget.id }, requestId);
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

function apiUpdateGoal(payload) {
  const requestId = String(payload && payload.requestId || id_('req'));
  try {
    return withDocumentLock_(function() {
      const goal = findById_(VINN_CONFIG.SHEETS.GOALS, payload.goalId);
      if (!goal) throw createError_('NOT_FOUND', 'Target tidak ditemukan.');
      const target = assertPositiveMoney_(payload.target === undefined ? payload.targetAmount : payload.target);
      const current = Number(goal.current_amount || 0);
      if (current > target) throw createError_('INVALID_GOAL', 'Target baru tidak boleh lebih kecil dari dana terkumpul.');
      const name = String(payload.name === undefined ? goal.name : payload.name).trim().slice(0, 100);
      if (!name) throw createError_('INVALID_GOAL', 'Nama target wajib diisi.');
      const before = Object.assign({}, goal); delete before._row;
      const rowNumber = goal._row;
      goal.name = name;
      goal.target_amount = target;
      goal.deadline = dateIso_(payload.deadline === undefined ? goal.deadline : payload.deadline);
      goal.color = String(payload.color === undefined ? goal.color : payload.color);
      goal.icon = String(payload.icon === undefined ? goal.icon : payload.icon);
      goal.status = current >= target ? 'completed' : 'active';
      goal.updated_at = nowIso_();
      delete goal._row;
      updateObjectRow_(VINN_CONFIG.SHEETS.GOALS, rowNumber, goal);
      audit_('UPDATE', 'goals', goal.id, requestId, { before: before, after: goal });
      invalidateDashboard_();
      return ok_({ goal: goal }, requestId);
    });
  } catch (error) { return fail_(error, requestId); }
}

function apiDeleteGoal(payload) {
  const requestId = String(payload && payload.requestId || id_('req'));
  try {
    return withDocumentLock_(function() {
      const goal = findById_(VINN_CONFIG.SHEETS.GOALS, payload.goalId);
      if (!goal) throw createError_('NOT_FOUND', 'Target tidak ditemukan.');
      const before = Object.assign({}, goal); delete before._row;
      deleteObjectRow_(VINN_CONFIG.SHEETS.GOALS, goal._row);
      audit_('DELETE', 'goals', goal.id, requestId, { before: before });
      invalidateDashboard_();
      return ok_({ deleted: true, id: goal.id }, requestId);
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
      const mode = String(payload.mode || 'add');
      if (['add', 'withdraw'].indexOf(mode) === -1) throw createError_('INVALID_GOAL_MODE', 'Mode perubahan progress tidak valid.');
      const nextCurrent = Number(goal.current_amount || 0) + (mode === 'withdraw' ? -amount : amount);
      if (nextCurrent > Number(goal.target_amount)) throw createError_('GOAL_OVERFUNDED', 'Kontribusi melebihi sisa target.');
      if (nextCurrent < 0) throw createError_('GOAL_UNDERFUNDED', 'Pengurangan melebihi dana yang terkumpul.');
      goal.current_amount = nextCurrent;
      goal.status = Number(goal.current_amount) >= Number(goal.target_amount) ? 'completed' : 'active';
      goal.updated_at = nowIso_();
      const rowNumber = goal._row;
      delete goal._row;
      updateObjectRow_(VINN_CONFIG.SHEETS.GOALS, rowNumber, goal);
      audit_(mode === 'withdraw' ? 'WITHDRAW' : 'CONTRIBUTE', 'goals', goal.id, requestId, { amount: amount });
      invalidateDashboard_();
      return ok_({ goal: goal }, requestId);
    });
  } catch (error) { return fail_(error, requestId); }
}

function apiCreateBill(payload) {
  const requestId = payload && payload.requestId ? String(payload.requestId) : id_('req');
  try {
    return withDocumentLock_(function() {
      ensureSheet_(VINN_CONFIG.SHEETS.BILLS, VINN_CONFIG.HEADERS.Bills);
      payload = payload || {};
      const installmentPhases = billInstallmentPhases_(payload.installmentPhases || payload.installment_phases || []);
      const frequency = String(payload.frequency || 'monthly');
      if (frequency !== 'monthly') throw createError_('INVALID_BILL_FREQUENCY', 'Frekuensi tagihan belum didukung.');
      const reminderDays = Array.isArray(payload.reminderDays) ? payload.reminderDays.map(Number).filter(function(day, index, values) { return [7, 3, 1, 0].indexOf(day) >= 0 && values.indexOf(day) === index; }).sort(function(a, b) { return b - a; }) : [7, 3, 1, 0];
      if (!reminderDays.length) throw createError_('INVALID_REMINDER_DAYS', 'Pilih minimal satu jadwal reminder tagihan.');
      const liabilityAccountId = String(payload.liabilityAccountId || '');
      const liabilityAccount = liabilityAccountId ? findById_(VINN_CONFIG.SHEETS.ACCOUNTS, liabilityAccountId) : null;
      if (liabilityAccountId && (!liabilityAccount || !truthy_(liabilityAccount.is_liability))) {
        throw createError_('LIABILITY_ACCOUNT_REQUIRED', 'Akun tujuan cicilan harus berupa Paylater, kartu kredit, atau akun utang.');
      }
      const durationMonths = installmentPhases.length
        ? installmentPhases.reduce(function(sum, phase) { return sum + phase.durationMonths; }, 0)
        : billDurationMonths_(payload.durationMonths, '');
      const paidCount = billPaidCount_(payload.paidCount === undefined ? payload.paid_count : payload.paidCount, 0);
      if (!durationMonths && paidCount > 0) throw createError_('BILL_DURATION_REQUIRED', 'Isi total tenor sebelum memasukkan cicilan yang sudah dibayar.');
      if (durationMonths && paidCount > Number(durationMonths)) throw createError_('INVALID_BILL_PAID_COUNT', 'Jumlah cicilan yang sudah dibayar tidak boleh melebihi total tenor.');
      const amount = installmentPhases.length
        ? billInstallmentAmount_({ amount: installmentPhases[0].amount, paid_count: paidCount, installment_phases_json: JSON.stringify(installmentPhases) })
        : assertPositiveMoney_(payload.amount);
      const now = nowIso_();
      const bill = { id: id_('bill'), name: String(payload.name || '').trim().slice(0, 100), amount: amount, category: String(payload.category || 'Tagihan'), account_id: String(payload.accountId || ''), frequency: frequency, due_date: dateIso_(payload.dueDate), reminder_days: reminderDays.join(','), status: durationMonths && paidCount >= Number(durationMonths) ? 'completed' : 'active', last_paid_period: '', created_at: now, updated_at: now, liability_account_id: liabilityAccountId, duration_months: durationMonths, paid_count: paidCount, installment_phases_json: JSON.stringify(installmentPhases) };
      if (!bill.name || !bill.account_id || !findById_(VINN_CONFIG.SHEETS.ACCOUNTS, bill.account_id)) throw createError_('INVALID_BILL', 'Nama dan akun pembayaran tagihan wajib diisi.');
      appendObjects_(VINN_CONFIG.SHEETS.BILLS, [bill]);
      audit_('CREATE', 'bills', bill.id, requestId, { name: bill.name, amount: amount });
      invalidateDashboard_();
      return ok_({ bill: bill }, requestId);
    });
  } catch (error) { return fail_(error, requestId); }
}

function apiUpdateBill(payload) {
  const requestId = String(payload && payload.requestId || id_('req'));
  try {
    return withDocumentLock_(function() {
      ensureSheet_(VINN_CONFIG.SHEETS.BILLS, VINN_CONFIG.HEADERS.Bills);
      const bill = findById_(VINN_CONFIG.SHEETS.BILLS, payload.billId);
      if (!bill) throw createError_('NOT_FOUND', 'Tagihan tidak ditemukan.');
      const name = String(payload.name === undefined ? bill.name : payload.name).trim().slice(0, 100);
      const installmentPhases = billInstallmentPhases_(payload.installmentPhases === undefined ? bill.installment_phases_json || [] : payload.installmentPhases);
      const accountId = String(payload.accountId === undefined ? bill.account_id : payload.accountId);
      const frequency = String(payload.frequency === undefined ? bill.frequency || 'monthly' : payload.frequency);
      const reminderDays = Array.isArray(payload.reminderDays) ? payload.reminderDays.map(Number).filter(function(day, index, values) { return [7, 3, 1, 0].indexOf(day) >= 0 && values.indexOf(day) === index; }).sort(function(a, b) { return b - a; }) : String(bill.reminder_days || '7,3,1,0').split(',').map(Number);
      const liabilityAccountId = String(payload.liabilityAccountId === undefined ? bill.liability_account_id || '' : payload.liabilityAccountId || '');
      const liabilityAccount = liabilityAccountId ? findById_(VINN_CONFIG.SHEETS.ACCOUNTS, liabilityAccountId) : null;
      if (liabilityAccountId && (!liabilityAccount || !truthy_(liabilityAccount.is_liability))) {
        throw createError_('LIABILITY_ACCOUNT_REQUIRED', 'Akun tujuan cicilan harus berupa Paylater, kartu kredit, atau akun utang.');
      }
      const durationMonths = installmentPhases.length
        ? installmentPhases.reduce(function(sum, phase) { return sum + phase.durationMonths; }, 0)
        : billDurationMonths_(payload.durationMonths, bill.duration_months || '');
      const paidCount = billPaidCount_(payload.paidCount === undefined ? payload.paid_count : payload.paidCount, bill.paid_count || 0);
      if (!durationMonths && paidCount > 0) throw createError_('BILL_DURATION_REQUIRED', 'Isi total tenor sebelum memasukkan cicilan yang sudah dibayar.');
      if (durationMonths && Number(durationMonths) < paidCount) {
        throw createError_('INVALID_BILL_DURATION', 'Durasi tidak boleh lebih kecil dari jumlah cicilan yang sudah dibayar.');
      }
      if (!name || !findById_(VINN_CONFIG.SHEETS.ACCOUNTS, accountId)) throw createError_('INVALID_BILL', 'Nama dan akun pembayaran tagihan wajib diisi.');
      if (frequency !== 'monthly') throw createError_('INVALID_BILL_FREQUENCY', 'Frekuensi tagihan belum didukung.');
      if (!reminderDays.length) throw createError_('INVALID_REMINDER_DAYS', 'Pilih minimal satu jadwal reminder tagihan.');
      const before = Object.assign({}, bill); delete before._row;
      const rowNumber = bill._row;
      const amount = installmentPhases.length
        ? billInstallmentAmount_({ amount: installmentPhases[0].amount, paid_count: paidCount, installment_phases_json: JSON.stringify(installmentPhases) })
        : assertPositiveMoney_(payload.amount === undefined ? bill.amount : payload.amount);
      bill.name = name;
      bill.amount = amount;
      bill.category = String(payload.category === undefined ? bill.category : payload.category);
      bill.account_id = accountId;
      bill.frequency = frequency;
      bill.due_date = dateIso_(payload.dueDate === undefined ? bill.due_date : payload.dueDate);
      bill.reminder_days = reminderDays.join(',');
      bill.liability_account_id = liabilityAccountId;
      bill.duration_months = durationMonths;
      bill.paid_count = paidCount;
      bill.installment_phases_json = JSON.stringify(installmentPhases);
      bill.status = durationMonths && bill.paid_count >= Number(durationMonths) ? 'completed' : 'active';
      bill.updated_at = nowIso_();
      delete bill._row;
      updateObjectRow_(VINN_CONFIG.SHEETS.BILLS, rowNumber, bill);
      audit_('UPDATE', 'bills', bill.id, requestId, { before: before, after: bill });
      invalidateDashboard_();
      return ok_({ bill: bill }, requestId);
    });
  } catch (error) { return fail_(error, requestId); }
}

function apiDeleteBill(payload) {
  const requestId = String(payload && payload.requestId || id_('req'));
  try {
    return withDocumentLock_(function() {
      ensureSheet_(VINN_CONFIG.SHEETS.BILLS, VINN_CONFIG.HEADERS.Bills);
      const bill = findById_(VINN_CONFIG.SHEETS.BILLS, payload.billId);
      if (!bill) throw createError_('NOT_FOUND', 'Tagihan tidak ditemukan.');
      const before = Object.assign({}, bill); delete before._row;
      deleteObjectRow_(VINN_CONFIG.SHEETS.BILLS, bill._row);
      audit_('DELETE', 'bills', bill.id, requestId, { before: before });
      invalidateDashboard_();
      return ok_({ deleted: true, id: bill.id }, requestId);
    });
  } catch (error) { return fail_(error, requestId); }
}

function apiMarkBillPaid(payload) {
  const requestId = payload && payload.requestId ? String(payload.requestId) : id_('req');
  try {
    return withDocumentLock_(function() {
      ensureSheet_(VINN_CONFIG.SHEETS.BILLS, VINN_CONFIG.HEADERS.Bills);
      const bill = findById_(VINN_CONFIG.SHEETS.BILLS, payload.billId);
      if (!bill) throw createError_('NOT_FOUND', 'Tagihan tidak ditemukan.');
      const liabilityAccountId = String(bill.liability_account_id || '');
      if (String(bill.status || 'active') === 'completed') {
        return ok_({ bill: bill, transactionId: '', duplicate: true, completed: true }, requestId);
      }
      if (String(bill.category) === 'Kewajiban' && !liabilityAccountId) {
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
        const amount = assertPositiveMoney_(billInstallmentAmount_(bill));
        const paymentDate = dateIso_(payload.date || new Date());
        const base = {
          id: id_('tx'), transfer_group_id: '', request_id: requestId,
          date: paymentDate, time: '', type: liabilityAccountId ? 'transfer' : 'expense',
          account_id: accountId, destination_account_id: liabilityAccountId, amount: amount,
          category: liabilityAccountId ? 'Transfer' : String(bill.category || 'Tagihan'),
          merchant: 'Bayar ' + String(bill.name || 'Tagihan'),
          notes: 'Pembayaran tagihan ' + String(bill.id), status: 'completed', direction: '',
          created_at: timestamp, updated_at: timestamp, deleted_at: '',
          tags_json: '[]', location: '', splits_json: '[]',
          receipt_file_id: '', receipt_filename: '', receipt_content_type: '', receipt_size_bytes: ''
        };
        if (liabilityAccountId) {
          const liabilityAccount = findById_(VINN_CONFIG.SHEETS.ACCOUNTS, liabilityAccountId);
          if (!liabilityAccount || !truthy_(liabilityAccount.is_liability)) {
            throw createError_('LIABILITY_ACCOUNT_REQUIRED', 'Akun Paylater atau utang tujuan tidak ditemukan.');
          }
          if (accountId === liabilityAccountId) throw createError_('SAME_ACCOUNT', 'Akun pembayaran dan akun utang harus berbeda.');
          const groupId = id_('trf');
          const transferRows = [
            Object.assign({}, base, { id: id_('tx'), transfer_group_id: groupId, direction: 'out' }),
            Object.assign({}, base, { id: id_('tx'), transfer_group_id: groupId, account_id: liabilityAccountId, destination_account_id: accountId, direction: 'in' })
          ];
          validateLedgerMutation_([], transferRows);
          appendObjects_(VINN_CONFIG.SHEETS.TRANSACTIONS, transferRows);
          transactionId = groupId;
        } else {
          transactionId = base.id;
          validateLedgerMutation_([], [base]);
          appendObjects_(VINN_CONFIG.SHEETS.TRANSACTIONS, [base]);
        }
      }
      bill.last_paid_period = period;
      bill.paid_count = Number(bill.paid_count || 0) + (existingPayment ? 0 : 1);
      const durationMonths = Number(bill.duration_months || 0);
      if (durationMonths && bill.paid_count >= durationMonths) bill.status = 'completed';
      bill.updated_at = timestamp;
      const rowNumber = bill._row;
      delete bill._row;
      updateObjectRow_(VINN_CONFIG.SHEETS.BILLS, rowNumber, bill);
      audit_('MARK_PAID', 'bills', bill.id, requestId, { period: period, transactionId: transactionId, liabilityAccountId: liabilityAccountId, paidCount: bill.paid_count, status: bill.status });
      invalidateDashboard_(period);
      return ok_({ bill: bill, transactionId: transactionId, duplicate: Boolean(existingPayment) }, requestId);
    });
  } catch (error) { return fail_(error, requestId); }
}

function billDurationMonths_(value, fallback) {
  const raw = value === undefined ? fallback : value;
  if (raw === null || raw === '') return '';
  const duration = Number(raw);
  if (!Number.isSafeInteger(duration) || duration < 1 || duration > 120) {
    throw createError_('INVALID_BILL_DURATION', 'Durasi cicilan harus antara 1 sampai 120 bulan.');
  }
  return duration;
}

function billPaidCount_(value, fallback) {
  const raw = value === undefined || value === null || value === '' ? fallback : value;
  const paidCount = Number(raw || 0);
  if (!Number.isSafeInteger(paidCount) || paidCount < 0 || paidCount > 120) {
    throw createError_('INVALID_BILL_PAID_COUNT', 'Jumlah cicilan yang sudah dibayar harus antara 0 sampai 120.');
  }
  return paidCount;
}

function billInstallmentPhases_(value) {
  let raw = value;
  if (typeof raw === 'string') {
    try { raw = JSON.parse(raw || '[]'); } catch (error) { throw createError_('INVALID_INSTALLMENT_PHASES', 'Skema fase cicilan tidak dapat dibaca.'); }
  }
  if (raw === undefined || raw === null || raw === '') return [];
  if (!Array.isArray(raw)) throw createError_('INVALID_INSTALLMENT_PHASES', 'Skema fase cicilan tidak valid.');
  const phases = raw.map(function(phase, index) {
    const duration = Number(phase && (phase.durationMonths === undefined ? phase.duration_months : phase.durationMonths));
    const amount = Number(phase && phase.amount);
    const label = String(phase && phase.label || 'Fase ' + (index + 1)).trim().slice(0, 60);
    if (!label || !Number.isSafeInteger(duration) || duration < 1 || duration > 120 || !Number.isSafeInteger(amount) || amount <= 0) {
      throw createError_('INVALID_INSTALLMENT_PHASES', 'Setiap fase wajib memiliki nama, durasi, dan nominal positif.');
    }
    return { label: label, durationMonths: duration, amount: amount };
  });
  if (phases.length && phases.length < 2) throw createError_('INVALID_INSTALLMENT_PHASES', 'Skema bertahap minimal memiliki dua fase.');
  const totalDuration = phases.reduce(function(sum, phase) { return sum + phase.durationMonths; }, 0);
  if (totalDuration > 120) throw createError_('INVALID_BILL_DURATION', 'Total durasi seluruh fase maksimal 120 bulan.');
  return phases;
}

function billInstallmentAmount_(bill, occurrenceOffset) {
  const phases = billInstallmentPhases_(bill.installment_phases_json || []);
  if (!phases.length) return Number(bill.amount || 0);
  let cursor = Math.max(0, Number(bill.paid_count || 0) + Number(occurrenceOffset || 0));
  for (let index = 0; index < phases.length; index += 1) {
    if (cursor < phases[index].durationMonths) return phases[index].amount;
    cursor -= phases[index].durationMonths;
  }
  return phases[phases.length - 1].amount;
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
