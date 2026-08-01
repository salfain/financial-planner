function sinkingFundClientRow_(row) {
  return {
    id: String(row.id || ''),
    name: String(row.name || ''),
    purpose: String(row.purpose || 'Lainnya'),
    targetAmount: Number(row.target_amount || 0),
    currentAmount: Number(row.current_amount || 0),
    monthlyContribution: Number(row.monthly_contribution || 0),
    targetDate: String(row.target_date || ''),
    accountId: String(row.account_id || ''),
    color: String(row.color || '#16876f'),
    active: truthy_(row.is_active),
    createdAt: String(row.created_at || ''),
    updatedAt: String(row.updated_at || '')
  };
}

function sinkingFundEntryClientRow_(row) {
  return {
    id: String(row.id || ''),
    fundId: String(row.fund_id || ''),
    type: String(row.type || 'allocate'),
    amount: Number(row.amount || 0),
    date: String(row.date || ''),
    note: String(row.note || ''),
    createdAt: String(row.created_at || '')
  };
}

function sinkingFundPurpose_(value) {
  const allowed = ['Kendaraan', 'Pajak', 'Liburan', 'Pendidikan', 'Rumah', 'Kesehatan', 'Teknologi', 'Lainnya'];
  value = String(value || 'Lainnya');
  if (allowed.indexOf(value) === -1) throw createError_('INVALID_FUND_PURPOSE', 'Jenis kebutuhan pos dana tidak valid.');
  return value;
}

function sinkingFundAccountCapacity_(accountId, excludeFundId) {
  const account = findById_(VINN_CONFIG.SHEETS.ACCOUNTS, accountId);
  if (!account || !accountIsActive_(account) || truthy_(account.is_liability) || ['Bank', 'E-Wallet', 'Cash', 'Deposit'].indexOf(String(account.type)) === -1) {
    throw createError_('INVALID_FUND_ACCOUNT', 'Pos dana harus memakai akun kas atau deposito aktif.');
  }
  const transactions = rowsAsObjects_(VINN_CONFIG.SHEETS.TRANSACTIONS).filter(function(row) {
    return !row.deleted_at && String(row.status || 'completed') === 'completed';
  });
  const balance = accountCurrentBalance_(account, transactions);
  const allocated = rowsAsObjects_(VINN_CONFIG.SHEETS.SINKING_FUNDS).filter(function(row) {
    return truthy_(row.is_active) && String(row.account_id) === String(accountId) && String(row.id) !== String(excludeFundId || '');
  }).reduce(function(sum, row) { return sum + Number(row.current_amount || 0); }, 0);
  return { account: account, balance: balance, allocated: allocated, free: Math.max(0, balance - allocated) };
}

function apiCreateSinkingFund(payload) {
  const requestId = String(payload && payload.requestId || id_('req'));
  try {
    return withDocumentLock_(function() {
      payload = payload || {};
      ensureSheet_(VINN_CONFIG.SHEETS.SINKING_FUNDS, VINN_CONFIG.HEADERS.SinkingFunds);
      ensureSheet_(VINN_CONFIG.SHEETS.SINKING_FUND_ENTRIES, VINN_CONFIG.HEADERS.SinkingFundEntries);
      const existing = rowsAsObjectsUnscoped_(VINN_CONFIG.SHEETS.SINKING_FUNDS).find(function(row) { return String(row.request_id) === requestId; });
      if (existing) return ok_({ sinkingFund: sinkingFundClientRow_(existing) }, requestId);
      const target = assertPositiveMoney_(payload.targetAmount);
      const current = Math.max(0, Math.round(Number(payload.currentAmount || 0)));
      if (current > target) throw createError_('SINKING_FUND_OVERFUNDED', 'Alokasi awal tidak boleh melebihi target pos dana.');
      const capacity = sinkingFundAccountCapacity_(String(payload.accountId || ''), '');
      if (current > capacity.free) throw createError_('INSUFFICIENT_UNALLOCATED_BALANCE', 'Alokasi melebihi saldo bebas pada akun tersebut.');
      const name = String(payload.name || '').trim().slice(0, 120);
      if (!name) throw createError_('INVALID_FUND_NAME', 'Nama pos dana wajib diisi.');
      const now = nowIso_();
      const fund = {
        id: id_('fund'), request_id: requestId, name: name, purpose: sinkingFundPurpose_(payload.purpose),
        target_amount: target, current_amount: current,
        monthly_contribution: Math.max(0, Math.round(Number(payload.monthlyContribution || 0))),
        target_date: dateIso_(payload.targetDate), account_id: String(payload.accountId),
        color: String(payload.color || '#16876f'), is_active: true, created_at: now, updated_at: now
      };
      appendObjects_(VINN_CONFIG.SHEETS.SINKING_FUNDS, [fund]);
      if (current > 0) appendObjects_(VINN_CONFIG.SHEETS.SINKING_FUND_ENTRIES, [{
        id: id_('fund-entry'), request_id: requestId + ':initial', fund_id: fund.id,
        type: 'allocate', amount: current, date: now.slice(0, 10), note: 'Alokasi awal', created_at: now
      }]);
      audit_('CREATE', 'sinking_funds', fund.id, requestId, { name: name, targetAmount: target, currentAmount: current });
      invalidateDashboard_();
      return ok_({ sinkingFund: sinkingFundClientRow_(fund) }, requestId);
    });
  } catch (error) { return fail_(error, requestId); }
}

function apiUpdateSinkingFund(payload) {
  const requestId = String(payload && payload.requestId || id_('req'));
  try {
    return withDocumentLock_(function() {
      const fund = findById_(VINN_CONFIG.SHEETS.SINKING_FUNDS, payload.fundId);
      if (!fund || !truthy_(fund.is_active)) throw createError_('NOT_FOUND', 'Pos dana tidak ditemukan.');
      const target = assertPositiveMoney_(payload.targetAmount);
      const current = Number(fund.current_amount || 0);
      if (target < current) throw createError_('SINKING_FUND_OVERFUNDED', 'Target baru tidak boleh lebih kecil dari alokasi saat ini.');
      const accountId = String(payload.accountId || fund.account_id);
      const capacity = sinkingFundAccountCapacity_(accountId, fund.id);
      if (current > capacity.free) throw createError_('INSUFFICIENT_UNALLOCATED_BALANCE', 'Alokasi melebihi saldo bebas pada akun tersebut.');
      const before = Object.assign({}, fund); delete before._row;
      const rowNumber = fund._row;
      fund.name = String(payload.name || fund.name).trim().slice(0, 120);
      fund.purpose = sinkingFundPurpose_(payload.purpose || fund.purpose);
      fund.target_amount = target;
      fund.monthly_contribution = Math.max(0, Math.round(Number(payload.monthlyContribution || 0)));
      fund.target_date = dateIso_(payload.targetDate || fund.target_date);
      fund.account_id = accountId;
      fund.color = String(payload.color || fund.color || '#16876f');
      fund.updated_at = nowIso_();
      delete fund._row;
      updateObjectRow_(VINN_CONFIG.SHEETS.SINKING_FUNDS, rowNumber, fund);
      audit_('UPDATE', 'sinking_funds', fund.id, requestId, { before: before, after: fund });
      invalidateDashboard_();
      return ok_({ sinkingFund: sinkingFundClientRow_(fund) }, requestId);
    });
  } catch (error) { return fail_(error, requestId); }
}

function apiArchiveSinkingFund(payload) {
  const requestId = String(payload && payload.requestId || id_('req'));
  try {
    return withDocumentLock_(function() {
      const fund = findById_(VINN_CONFIG.SHEETS.SINKING_FUNDS, payload.fundId);
      if (!fund) throw createError_('NOT_FOUND', 'Pos dana tidak ditemukan.');
      const rowNumber = fund._row;
      fund.is_active = false;
      fund.updated_at = nowIso_();
      delete fund._row;
      updateObjectRow_(VINN_CONFIG.SHEETS.SINKING_FUNDS, rowNumber, fund);
      audit_('ARCHIVE', 'sinking_funds', fund.id, requestId, { name: fund.name });
      invalidateDashboard_();
      return ok_({ archived: true, id: fund.id }, requestId);
    });
  } catch (error) { return fail_(error, requestId); }
}

function apiAdjustSinkingFund(payload) {
  const requestId = String(payload && payload.requestId || id_('req'));
  try {
    return withDocumentLock_(function() {
      ensureSheet_(VINN_CONFIG.SHEETS.SINKING_FUND_ENTRIES, VINN_CONFIG.HEADERS.SinkingFundEntries);
      const duplicate = rowsAsObjectsUnscoped_(VINN_CONFIG.SHEETS.SINKING_FUND_ENTRIES).find(function(row) { return String(row.request_id) === requestId; });
      const fund = findById_(VINN_CONFIG.SHEETS.SINKING_FUNDS, payload.fundId);
      if (!fund || !truthy_(fund.is_active)) throw createError_('NOT_FOUND', 'Pos dana tidak ditemukan.');
      if (duplicate) return ok_({ sinkingFund: sinkingFundClientRow_(fund), entry: sinkingFundEntryClientRow_(duplicate) }, requestId);
      const amount = assertPositiveMoney_(payload.amount);
      const type = String(payload.type || 'allocate');
      if (['allocate', 'release'].indexOf(type) === -1) throw createError_('INVALID_FUND_ENTRY', 'Jenis perubahan pos dana tidak valid.');
      const current = Number(fund.current_amount || 0);
      const next = current + (type === 'allocate' ? amount : -amount);
      if (next < 0) throw createError_('SINKING_FUND_UNDERFUNDED', 'Dana yang dilepas melebihi alokasi pos.');
      if (next > Number(fund.target_amount || 0)) throw createError_('SINKING_FUND_OVERFUNDED', 'Alokasi melebihi target pos dana.');
      if (type === 'allocate') {
        const capacity = sinkingFundAccountCapacity_(fund.account_id, fund.id);
        if (current + amount > capacity.free) throw createError_('INSUFFICIENT_UNALLOCATED_BALANCE', 'Saldo bebas akun tidak cukup untuk alokasi ini.');
      }
      const now = nowIso_();
      const rowNumber = fund._row;
      fund.current_amount = next;
      fund.updated_at = now;
      delete fund._row;
      updateObjectRow_(VINN_CONFIG.SHEETS.SINKING_FUNDS, rowNumber, fund);
      const entry = { id: id_('fund-entry'), request_id: requestId, fund_id: fund.id, type: type, amount: amount, date: dateIso_(payload.date || now.slice(0, 10)), note: String(payload.note || '').trim().slice(0, 240), created_at: now };
      appendObjects_(VINN_CONFIG.SHEETS.SINKING_FUND_ENTRIES, [entry]);
      audit_(type === 'allocate' ? 'ALLOCATE' : 'RELEASE', 'sinking_funds', fund.id, requestId, { amount: amount, currentAmount: next });
      invalidateDashboard_();
      return ok_({ sinkingFund: sinkingFundClientRow_(fund), entry: sinkingFundEntryClientRow_(entry) }, requestId);
    });
  } catch (error) { return fail_(error, requestId); }
}
