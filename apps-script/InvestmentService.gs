const INVESTMENT_UNIT_PRECISION = 100000000;
const INVESTMENT_ASSET_CLASSES = ['Saham', 'ETF', 'Reksadana', 'Kripto', 'Deposito', 'Emas', 'Obligasi', 'Properti', 'Custom'];

function investmentUnits_(value) {
  const units = Number(value);
  const micro = Math.round(units * INVESTMENT_UNIT_PRECISION);
  if (!isFinite(units) || !Number.isSafeInteger(micro) || micro <= 0) {
    throw createError_('INVALID_UNITS', 'Unit investasi harus lebih besar dari nol dan maksimal 8 desimal.');
  }
  return micro / INVESTMENT_UNIT_PRECISION;
}

function investmentPosition_(assetId, transactionRows) {
  const rows = (Array.isArray(transactionRows) ? transactionRows : rowsAsObjects_(VINN_CONFIG.SHEETS.INVESTMENT_TX)).filter(function(row) {
    return String(row.asset_id) === String(assetId);
  });
  if (!rows.length) return { units: 0, costBasis: 0, realizedPl: 0, averageCost: 0 };
  const last = rows[rows.length - 1];
  const units = Number(last.remaining_units_after || 0);
  const costBasis = Number(last.cost_basis_after || 0);
  return {
    units: units,
    costBasis: costBasis,
    realizedPl: Number(last.realized_pl_total || 0),
    averageCost: units > 0 ? Math.round(costBasis / units) : 0
  };
}

function investmentAssetClientRow_(asset, transactionRows) {
  const position = investmentPosition_(asset.id, transactionRows);
  const marketPrice = Number(asset.manual_price || asset.latest_price_cache || 0);
  const marketValue = Math.round(position.units * marketPrice);
  return {
    id: String(asset.id || ''), accountId: String(asset.account_id || ''),
    ticker: String(asset.ticker || ''), name: String(asset.name || ''),
    assetClass: String(asset.asset_class || 'Custom'), exchange: String(asset.exchange || ''),
    currency: String(asset.currency || VINN_CONFIG.CURRENCY), units: position.units,
    costBasis: position.costBasis, averageCost: position.averageCost,
    marketPrice: marketPrice, marketValue: marketValue,
    unrealizedPl: marketValue - position.costBasis, realizedPl: position.realizedPl,
    priceSource: String(asset.price_source || 'unavailable'),
    priceStatus: String(asset.price_status || 'unavailable'),
    priceUpdatedAt: String(asset.price_updated_at || '') || null,
    active: accountIsActive_({ is_active: asset.is_active }),
    updatedAt: String(asset.updated_at || '') || null
  };
}

function investmentAssetClientRows_(transactionRows) {
  return rowsAsObjects_(VINN_CONFIG.SHEETS.ASSETS)
    .filter(function(asset) { return accountIsActive_({ is_active: asset.is_active }); })
    .map(function(asset) { return investmentAssetClientRow_(asset, transactionRows); });
}

function investmentTransactionClientRow_(row) {
  return {
    id: String(row.id || ''), assetId: String(row.asset_id || ''),
    accountId: String(row.account_id || ''), date: String(row.date || ''),
    type: String(row.type || ''), units: Number(row.units || 0),
    pricePerUnit: Number(row.price_per_unit || 0), grossAmount: Number(row.gross_amount || 0),
    fee: Number(row.fee || 0), tax: Number(row.tax || 0), netAmount: Number(row.net_amount || 0),
    averageCostAfter: Number(row.average_cost_after || 0),
    remainingUnitsAfter: Number(row.remaining_units_after || 0),
    realizedPl: Number(row.realized_pl || 0), note: String(row.note || '') || null,
    createdAt: String(row.created_at || '') || null, updatedAt: String(row.updated_at || '') || null
  };
}

function investmentAccount_(accountId, expectedType) {
  const account = findById_(VINN_CONFIG.SHEETS.ACCOUNTS, accountId);
  if (!account || !accountIsActive_(account)) throw createError_('ACCOUNT_NOT_FOUND', 'Akun investasi tidak ditemukan atau sudah diarsipkan.');
  if (expectedType === 'investment' && String(account.type) !== 'Investment') {
    throw createError_('INVESTMENT_ACCOUNT_REQUIRED', 'Pilih akun bertipe Investment untuk cost basis aset.');
  }
  if (expectedType === 'cash' && (String(account.type) === 'Investment' || truthy_(account.is_liability))) {
    throw createError_('CASH_ACCOUNT_REQUIRED', 'Pilih akun Bank, E-Wallet, atau Cash.');
  }
  return account;
}

function apiCreateInvestmentAsset(payload) {
  const requestId = requestIdOrFailure_(payload);
  if (requestId.error) return requestId.error;
  try {
    return withDocumentLock_(function() {
      const replay = rowsAsObjects_(VINN_CONFIG.SHEETS.ASSETS).find(function(row) { return String(row.request_id) === requestId.value; });
      if (replay) return ok_({ asset: investmentAssetClientRow_(replay), duplicate: true }, requestId.value);
      if (requestAudit_(requestId.value) || rowsAsObjects_(VINN_CONFIG.SHEETS.INVESTMENT_TX).some(function(row) { return String(row.request_id) === requestId.value; })) {
        throw createError_('REQUEST_ID_REUSED', 'requestId sudah digunakan oleh operasi lain.');
      }
      const ticker = String(payload.ticker || '').trim().toUpperCase().slice(0, 24);
      const name = String(payload.name || '').trim().slice(0, 100);
      const assetClass = String(payload.assetClass || 'Custom');
      if (!ticker || !/^[A-Z0-9][A-Z0-9._-]{0,23}$/.test(ticker) || !name) throw createError_('INVALID_ASSET', 'Ticker dan nama aset wajib diisi.');
      if (INVESTMENT_ASSET_CLASSES.indexOf(assetClass) === -1) throw createError_('INVALID_ASSET_CLASS', 'Kelas aset tidak didukung.');
      const duplicate = rowsAsObjects_(VINN_CONFIG.SHEETS.ASSETS).some(function(row) {
        return String(row.ticker).toUpperCase() === ticker && String(row.exchange || '').toLowerCase() === String(payload.exchange || '').trim().toLowerCase();
      });
      if (duplicate) throw createError_('ASSET_EXISTS', 'Ticker dan bursa tersebut sudah terdaftar.');
      const account = investmentAccount_(String(payload.accountId || ''), 'investment');
      const manualPrice = payload.manualPrice === null || payload.manualPrice === '' || payload.manualPrice === undefined ? '' : assertPositiveMoney_(payload.manualPrice);
      const now = nowIso_();
      const asset = {
        id: id_('asset'), request_id: requestId.value, account_id: account.id,
        ticker: ticker, name: name, asset_class: assetClass,
        exchange: String(payload.exchange || '').trim().slice(0, 60),
        currency: String(payload.currency || VINN_CONFIG.CURRENCY).toUpperCase(),
        manual_price: manualPrice, latest_price_cache: manualPrice || 0,
        price_source: manualPrice ? 'manual' : 'unavailable',
        price_status: manualPrice ? 'manual' : 'unavailable',
        price_updated_at: manualPrice ? now : '', is_active: payload.active !== false,
        created_at: now, updated_at: now
      };
      appendObjects_(VINN_CONFIG.SHEETS.ASSETS, [asset]);
      audit_('CREATE_ASSET', 'investments', asset.id, requestId.value, { after: investmentAssetClientRow_(asset) });
      invalidateDashboard_();
      return ok_({ asset: investmentAssetClientRow_(asset), duplicate: false }, requestId.value);
    });
  } catch (error) { return fail_(error, requestId.value); }
}

function apiUpdateInvestmentAsset(payload) {
  const requestId = requestIdOrFailure_(payload);
  if (requestId.error) return requestId.error;
  try {
    return withDocumentLock_(function() {
      const asset = findById_(VINN_CONFIG.SHEETS.ASSETS, payload.assetId);
      if (!asset) throw createError_('NOT_FOUND', 'Aset investasi tidak ditemukan.');
      const replay = assertRequestAudit_(requestId.value, ['UPDATE_ASSET'], 'investments', asset.id);
      if (replay) return ok_({ asset: investmentAssetClientRow_(asset), duplicate: true }, requestId.value);
      if (String(payload.expectedUpdatedAt || '') !== String(asset.updated_at || '')) throw createError_('STALE_INVESTMENT_ASSET', 'Aset sudah berubah. Muat ulang data lalu coba lagi.');
      const before = investmentAssetClientRow_(asset);
      const position = investmentPosition_(asset.id);
      const nextAccountId = String(payload.accountId || asset.account_id);
      if (position.units > 0 && nextAccountId !== String(asset.account_id)) throw createError_('ASSET_IN_USE', 'Akun investasi tidak dapat diganti selama unit masih tersedia.');
      investmentAccount_(nextAccountId, 'investment');
      if (payload.active === false && position.units > 0) throw createError_('ASSET_IN_USE', 'Jual seluruh unit sebelum mengarsipkan aset.');
      asset.account_id = nextAccountId;
      asset.ticker = String(payload.ticker || asset.ticker).trim().toUpperCase().slice(0, 24);
      asset.name = String(payload.name || asset.name).trim().slice(0, 100);
      asset.asset_class = String(payload.assetClass || asset.asset_class);
      asset.exchange = hasOwn_(payload, 'exchange') ? String(payload.exchange || '').trim().slice(0, 60) : asset.exchange;
      asset.currency = String(payload.currency || asset.currency || VINN_CONFIG.CURRENCY).toUpperCase();
      if (hasOwn_(payload, 'manualPrice')) {
        asset.manual_price = payload.manualPrice === null || payload.manualPrice === '' ? '' : assertPositiveMoney_(payload.manualPrice);
        asset.latest_price_cache = asset.manual_price || 0;
        asset.price_source = asset.manual_price ? 'manual' : 'unavailable';
        asset.price_status = asset.manual_price ? 'manual' : 'unavailable';
        asset.price_updated_at = asset.manual_price ? nowIso_() : '';
      }
      if (hasOwn_(payload, 'active')) asset.is_active = Boolean(payload.active);
      asset.updated_at = nowIso_();
      const rowNumber = asset._row; delete asset._row;
      updateObjectRow_(VINN_CONFIG.SHEETS.ASSETS, rowNumber, asset);
      audit_('UPDATE_ASSET', 'investments', asset.id, requestId.value, { before: before, after: investmentAssetClientRow_(asset) });
      invalidateDashboard_();
      return ok_({ asset: investmentAssetClientRow_(asset), duplicate: false }, requestId.value);
    });
  } catch (error) { return fail_(error, requestId.value); }
}

function apiCreateInvestmentTrade(payload) {
  const requestId = requestIdOrFailure_(payload);
  if (requestId.error) return requestId.error;
  try {
    return withDocumentLock_(function() {
      const replay = rowsAsObjects_(VINN_CONFIG.SHEETS.INVESTMENT_TX).find(function(row) { return String(row.request_id) === requestId.value; });
      if (replay) return ok_({ transaction: investmentTransactionClientRow_(replay), asset: investmentAssetClientRow_(findById_(VINN_CONFIG.SHEETS.ASSETS, replay.asset_id)), duplicate: true }, requestId.value);
      if (requestAudit_(requestId.value)) throw createError_('REQUEST_ID_REUSED', 'requestId sudah digunakan oleh operasi lain.');
      const type = String(payload.type || '').toLowerCase();
      if (['buy', 'sell'].indexOf(type) === -1) throw createError_('INVALID_TYPE', 'Jenis transaksi investasi harus buy atau sell.');
      const asset = findById_(VINN_CONFIG.SHEETS.ASSETS, payload.assetId);
      if (!asset || !accountIsActive_({ is_active: asset.is_active })) throw createError_('NOT_FOUND', 'Aset investasi tidak ditemukan atau sudah diarsipkan.');
      const cashAccount = investmentAccount_(String(payload.accountId || ''), 'cash');
      const bookAccount = investmentAccount_(String(asset.account_id || ''), 'investment');
      const units = investmentUnits_(payload.units);
      const price = assertPositiveMoney_(payload.pricePerUnit);
      const fee = Math.max(0, assertMoney_(payload.fee || 0, 'Fee'));
      const tax = Math.max(0, assertMoney_(payload.tax || 0, 'Pajak'));
      const gross = Math.round(units * price);
      if (gross <= 0) throw createError_('INVALID_AMOUNT', 'Nilai transaksi investasi harus lebih besar dari nol.');
      const position = investmentPosition_(asset.id);
      let net, remainingUnits, costBasisAfter, averageCostAfter, realizedPl, realizedPlTotal, costBasisSold;
      if (type === 'buy') {
        net = gross + fee + tax;
        remainingUnits = Math.round((position.units + units) * INVESTMENT_UNIT_PRECISION) / INVESTMENT_UNIT_PRECISION;
        costBasisAfter = position.costBasis + net;
        averageCostAfter = remainingUnits > 0 ? Math.round(costBasisAfter / remainingUnits) : 0;
        realizedPl = 0; realizedPlTotal = position.realizedPl; costBasisSold = 0;
      } else {
        if (units > position.units + 0.000000001) throw createError_('INSUFFICIENT_UNITS', 'Unit yang dijual melebihi unit tersedia.');
        net = gross - fee - tax;
        if (net <= 0) throw createError_('INVALID_AMOUNT', 'Nilai penjualan bersih harus lebih besar dari nol.');
        costBasisSold = units >= position.units ? position.costBasis : Math.round(position.costBasis * units / position.units);
        remainingUnits = Math.max(0, Math.round((position.units - units) * INVESTMENT_UNIT_PRECISION) / INVESTMENT_UNIT_PRECISION);
        costBasisAfter = position.costBasis - costBasisSold;
        averageCostAfter = remainingUnits > 0 ? Math.round(costBasisAfter / remainingUnits) : 0;
        realizedPl = net - costBasisSold; realizedPlTotal = position.realizedPl + realizedPl;
      }
      const now = nowIso_();
      const date = dateIso_(payload.date);
      const cashGroupId = id_('inv-cash');
      const adjustmentId = realizedPl ? id_('inv-pl') : '';
      const ledgerRows = [];
      if (realizedPl) ledgerRows.push({
        id: adjustmentId, transfer_group_id: '', request_id: requestId.value + ':pl', date: date, time: '',
        type: realizedPl > 0 ? 'adjustment_in' : 'adjustment_out', account_id: bookAccount.id,
        destination_account_id: '', amount: Math.abs(realizedPl), category: 'Penyesuaian Saldo',
        merchant: (realizedPl > 0 ? 'Realisasi untung ' : 'Realisasi rugi ') + asset.name,
        notes: 'Dibuat otomatis oleh modul investasi', status: 'completed', direction: '',
        created_at: now, updated_at: now, deleted_at: ''
      });
      const transferType = type === 'buy' ? 'investment_buy' : 'transfer';
      const sourceId = type === 'buy' ? cashAccount.id : bookAccount.id;
      const destinationId = type === 'buy' ? bookAccount.id : cashAccount.id;
      const transferAmount = net;
      const common = { transfer_group_id: cashGroupId, request_id: requestId.value, date: date, time: '', type: transferType, amount: transferAmount, category: 'Investasi', merchant: (type === 'buy' ? 'Beli ' : 'Jual ') + asset.name, notes: String(payload.note || ''), status: 'completed', created_at: now, updated_at: now, deleted_at: '' };
      ledgerRows.push(Object.assign({}, common, { id: id_('tx'), account_id: sourceId, destination_account_id: destinationId, direction: 'out' }));
      ledgerRows.push(Object.assign({}, common, { id: id_('tx'), account_id: destinationId, destination_account_id: sourceId, direction: 'in' }));
      validateLedgerMutation_([], ledgerRows);
      const investmentTransaction = {
        id: id_('invtx'), request_id: requestId.value, date: date, type: type,
        asset_id: asset.id, account_id: cashAccount.id, units: units, price_per_unit: price,
        gross_amount: gross, fee: fee, tax: tax, net_amount: net,
        average_cost_after: averageCostAfter, remaining_units_after: remainingUnits,
        cost_basis_after: costBasisAfter, realized_pl: realizedPl,
        realized_pl_total: realizedPlTotal, linked_cash_transaction_id: cashGroupId,
        linked_adjustment_transaction_id: adjustmentId, note: String(payload.note || '').slice(0, 300),
        created_at: now, updated_at: now
      };
      appendObjects_(VINN_CONFIG.SHEETS.INVESTMENT_TX, [investmentTransaction]);
      appendObjects_(VINN_CONFIG.SHEETS.TRANSACTIONS, ledgerRows);
      if (!asset.manual_price) {
        asset.latest_price_cache = price; asset.price_source = 'last_trade';
        asset.price_status = 'delayed'; asset.price_updated_at = now;
      }
      asset.updated_at = now;
      const assetRow = asset._row; delete asset._row;
      updateObjectRow_(VINN_CONFIG.SHEETS.ASSETS, assetRow, asset);
      audit_(type === 'buy' ? 'INVESTMENT_BUY' : 'INVESTMENT_SELL', 'investments', investmentTransaction.id, requestId.value, {
        assetId: asset.id, units: units, netAmount: net, realizedPl: realizedPl,
        remainingUnitsAfter: remainingUnits, costBasisAfter: costBasisAfter
      });
      invalidateDashboard_(String(date).slice(0, 7));
      return ok_({ transaction: investmentTransactionClientRow_(investmentTransaction), asset: investmentAssetClientRow_(asset), duplicate: false }, requestId.value);
    });
  } catch (error) { return fail_(error, requestId.value); }
}
