function assertAiReady_() {
  const preferences = aiPreferences_();
  if (!preferences.enabled) throw createError_('AI_DISABLED', 'AI masih dinonaktifkan di Pengaturan.');
  if (!preferences.consentAccepted) throw createError_('AI_CONSENT_REQUIRED', 'Persetujuan privasi AI belum diberikan.');
  const apiKey = PropertiesService.getUserProperties().getProperty('GEMINI_API_KEY');
  if (!apiKey) throw createError_('AI_NOT_CONFIGURED', 'Tambahkan API key Gemini di Pengaturan terlebih dahulu.');
  return { apiKey: apiKey, model: preferences.model };
}

function geminiText_(payload) {
  const candidates = payload && payload.candidates || [];
  const parts = candidates[0] && candidates[0].content && candidates[0].content.parts || [];
  const text = parts.map(function(part) { return String(part.text || ''); }).join('').trim();
  if (!text) throw createError_('AI_EMPTY_RESPONSE', 'Gemini tidak mengembalikan jawaban yang dapat dibaca.');
  return text;
}

function callGemini_(apiKey, model, body) {
  const response = UrlFetchApp.fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(model) + ':generateContent',
    {
      method: 'post',
      contentType: 'application/json',
      headers: { 'x-goog-api-key': apiKey },
      payload: JSON.stringify(Object.assign({}, body, { store: false })),
      muteHttpExceptions: true
    }
  );
  const status = response.getResponseCode();
  let payload = {};
  try { payload = JSON.parse(response.getContentText() || '{}'); } catch (error) { payload = {}; }
  if (status < 200 || status >= 300) {
    if (status === 429) throw createError_('AI_PROVIDER_ERROR', 'Kuota Gemini sedang habis. Coba lagi nanti.');
    if ([400, 401, 403].indexOf(status) >= 0) throw createError_('AI_PROVIDER_ERROR', 'API key atau konfigurasi Gemini tidak dapat digunakan. Periksa Pengaturan.');
    throw createError_('AI_PROVIDER_ERROR', 'Layanan AI sedang tidak tersedia.');
  }
  return geminiText_(payload);
}

function aiContextIntent_(question) {
  const normalized = String(question || '').toLowerCase();
  return {
    accounts: /saldo|utang|aset|kekayaan|likuid|rekening|akun/.test(normalized),
    budgets: /budget|anggaran|kategori|makan|transport|hiburan|belanja|pengeluaran/.test(normalized),
    goals: /target|tujuan|dana darurat|menabung|tabungan/.test(normalized),
    bills: /tagihan|jatuh tempo|bayar|kartu kredit|paylater/.test(normalized),
    investments: /invest|saham|reksadana|kripto|emas|portofolio|profit|untung|rugi/.test(normalized),
    transactions: /mengapa|kenapa|turun|naik|merchant|transaksi|riwayat/.test(normalized)
  };
}

function buildAiContext_(period, question) {
  const allTransactions = rowsAsObjects_(VINN_CONFIG.SHEETS.TRANSACTIONS).filter(function(row) {
    return !row.deleted_at && String(row.status || 'completed') === 'completed' && String(row.date).slice(0, 7) === period;
  });
  const operating = allTransactions.filter(function(row) {
    return ['transfer', 'adjustment_in', 'adjustment_out', 'investment_buy'].indexOf(String(row.type)) === -1;
  });
  const income = operating.filter(function(row) { return row.type === 'income'; }).reduce(function(sum, row) { return sum + Number(row.amount || 0); }, 0);
  const grossExpense = operating.filter(function(row) { return row.type === 'expense'; }).reduce(function(sum, row) { return sum + Number(row.amount || 0); }, 0);
  const refunds = operating.filter(function(row) { return row.type === 'refund'; }).reduce(function(sum, row) { return sum + Number(row.amount || 0); }, 0);
  const expense = Math.max(0, grossExpense - refunds);
  const byCategory = {};
  operating.forEach(function(row) {
    const direction = row.type === 'refund' ? -1 : row.type === 'expense' ? 1 : 0;
    if (direction) byCategory[row.category] = Number(byCategory[row.category] || 0) + direction * Number(row.amount || 0);
  });
  const context = {
    period: period,
    currency: settingValue_('currency', VINN_CONFIG.CURRENCY),
    monthlySummary: {
      income: income,
      expense: expense,
      cashflow: income - expense,
      savingsRate: income ? Math.round((income - expense) / income * 1000) / 10 : 0
    },
    expenseByCategory: Object.keys(byCategory).map(function(category) {
      return { category: category, amount: Math.max(0, Number(byCategory[category] || 0)) };
    }).filter(function(item) { return item.amount > 0; }).sort(function(a, b) { return b.amount - a.amount; }).slice(0, 10)
  };
  const manifest = ['Ringkasan ' + period, 'Agregat kategori'];
  const intent = aiContextIntent_(question);
  if (intent.accounts) {
    const completed = rowsAsObjects_(VINN_CONFIG.SHEETS.TRANSACTIONS).filter(function(row) { return !row.deleted_at && String(row.status || 'completed') === 'completed'; });
    const accounts = rowsAsObjects_(VINN_CONFIG.SHEETS.ACCOUNTS).filter(accountIsActive_).slice(0, 20).map(function(account) {
      return { name: account.name, type: account.type, balance: accountCurrentBalance_(account, completed), liability: truthy_(account.is_liability) };
    });
    const assets = accounts.filter(function(account) { return !account.liability; }).reduce(function(sum, account) { return sum + account.balance; }, 0);
    const liabilities = accounts.filter(function(account) { return account.liability; }).reduce(function(sum, account) { return sum + account.balance; }, 0);
    context.accountSummary = { assets: assets, liabilities: liabilities, netWorth: assets - liabilities };
    context.selectedAccounts = accounts;
    manifest.push('Saldo akun terpilih');
  }
  if (intent.budgets) {
    context.budgets = rowsAsObjects_(VINN_CONFIG.SHEETS.BUDGETS).filter(function(row) { return String(row.month) === period; }).slice(0, 30).map(function(row) {
      return { category: row.category, limit: Number(row.limit_amount || 0), spent: Math.max(0, Number(byCategory[row.category] || 0)) };
    });
    manifest.push('Anggaran aktif');
  }
  if (intent.goals) {
    context.goals = rowsAsObjects_(VINN_CONFIG.SHEETS.GOALS).slice(0, 20).map(function(row) {
      return { name: row.name, target: Number(row.target_amount || 0), current: Number(row.current_amount || 0), deadline: String(row.deadline || '') };
    });
    manifest.push('Target finansial');
  }
  if (intent.bills) {
    context.bills = rowsAsObjects_(VINN_CONFIG.SHEETS.BILLS).slice(0, 30).map(function(row) {
      return { name: row.name, amount: Number(row.amount || 0), dueDate: String(row.due_date || ''), paid: String(row.last_paid_period || '') === period };
    });
    manifest.push('Tagihan');
  }
  if (intent.investments) {
    context.investments = investmentAssetClientRows_().slice(0, 30).map(function(asset) {
      return {
        ticker: asset.ticker, name: asset.name, units: asset.units, costBasis: asset.costBasis,
        marketValue: asset.marketValue, realizedPl: asset.realizedPl, unrealizedPl: asset.unrealizedPl,
        priceSource: asset.priceSource, priceStatus: asset.priceStatus, priceUpdatedAt: asset.priceUpdatedAt
      };
    });
    manifest.push('Ringkasan investasi (harga dapat delayed/manual)');
  }
  if (intent.transactions) {
    context.relevantTransactions = allTransactions.slice(0, 12).map(function(row) {
      return { date: String(row.date), title: String(row.merchant || row.notes || 'Transaksi'), type: row.type, category: row.category, amount: Number(row.amount || 0) };
    });
    manifest.push('Maksimal 12 transaksi relevan');
  }
  return { context: context, manifest: manifest };
}

function aiMessageClientRow_(row) {
  let contextUsed = [];
  try { contextUsed = JSON.parse(row.context_manifest_json || '[]'); } catch (error) { contextUsed = []; }
  return {
    id: String(row.id), role: String(row.role), content: String(row.content), period: String(row.period),
    contextUsed: contextUsed, createdAt: String(row.created_at)
  };
}

function apiAiHistory() {
  try {
    const messages = rowsAsObjects_(VINN_CONFIG.SHEETS.AI_CHAT).slice(-60).map(aiMessageClientRow_);
    return ok_({ messages: messages });
  } catch (error) { return fail_(error); }
}

function apiAskAi(payload) {
  const requestId = String(payload && payload.requestId || id_('req'));
  try {
    payload = payload || {};
    const question = String(payload.question || '').trim();
    if (!question || question.length > 600) throw createError_('INVALID_QUESTION', 'Pertanyaan wajib diisi dan maksimal 600 karakter.');
    const period = /^\d{4}-(0[1-9]|1[0-2])$/.test(String(payload.period || ''))
      ? String(payload.period)
      : Utilities.formatDate(new Date(), VINN_CONFIG.TIMEZONE, 'yyyy-MM');
    const ready = assertAiReady_();
    const selected = buildAiContext_(period, question);
    const history = rowsAsObjects_(VINN_CONFIG.SHEETS.AI_CHAT).slice(-8).map(function(row) {
      return { role: row.role === 'assistant' ? 'model' : 'user', parts: [{ text: String(row.content || '').slice(0, 2000) }] };
    });
    const answer = callGemini_(ready.apiKey, ready.model, {
      systemInstruction: { parts: [{ text: 'Anda adalah Financial Insight, asisten keuangan read-only berbahasa Indonesia. Gunakan hanya data JSON yang diberikan. Sebutkan periode dan data yang digunakan. Pisahkan fakta, perhitungan, dan saran umum. Jangan mengubah data, menjanjikan keuntungan, melakukan transaksi investasi, atau mengaku sebagai penasihat berlisensi. Harga investasi manual/delayed tidak boleh disebut real-time. Jangan meminta PIN, OTP, CVV, password, atau nomor kartu lengkap.' }] },
      contents: history.concat([{
        role: 'user',
        parts: [{ text: 'Konteks finansial terpilih:\n' + JSON.stringify(selected.context) + '\n\nPertanyaan pengguna:\n' + question }]
      }]),
      generationConfig: { temperature: 0.25, maxOutputTokens: 900 }
    });
    const createdAt = nowIso_();
    const manifestJson = JSON.stringify(selected.manifest);
    const answerId = id_('ai-answer');
    appendObjects_(VINN_CONFIG.SHEETS.AI_CHAT, [
      { id: id_('ai-user'), role: 'user', content: question, period: period, context_manifest_json: manifestJson, created_at: createdAt },
      { id: answerId, role: 'assistant', content: answer, period: period, context_manifest_json: manifestJson, created_at: createdAt }
    ]);
    audit_('AI_ASK', 'ai_chat', answerId, requestId, { period: period, contextUsed: selected.manifest, model: ready.model });
    return ok_({
      message: { id: answerId, role: 'assistant', content: answer, period: period, contextUsed: selected.manifest, createdAt: createdAt },
      contextUsed: selected.manifest,
      period: period,
      model: ready.model
    }, requestId);
  } catch (error) { return fail_(error, requestId); }
}

function apiClearAiHistory() {
  try {
    const sheet = getWorkbook_().getSheetByName(VINN_CONFIG.SHEETS.AI_CHAT);
    if (sheet && sheet.getLastRow() > 1) {
      sheet.getRange(2, 1, sheet.getLastRow() - 1, VINN_CONFIG.HEADERS.AIChat.length).clearContent();
    }
    audit_('CLEAR_AI_HISTORY', 'ai_chat', '', id_('req'), {});
    return ok_({ cleared: true });
  } catch (error) { return fail_(error); }
}
