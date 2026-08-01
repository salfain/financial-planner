function assertAiReady_() {
  const preferences = aiPreferences_();
  if (!preferences.enabled) throw createError_('AI_DISABLED', 'AI masih dinonaktifkan di Pengaturan.');
  if (!preferences.consentAccepted) throw createError_('AI_CONSENT_REQUIRED', 'Persetujuan privasi AI belum diberikan.');
  const apiKey = PropertiesService.getUserProperties().getProperty('AI_API_KEY');
  if (!preferences.baseUrl || !apiKey) throw createError_('AI_NOT_CONFIGURED', 'Lengkapi Base URL dan API key di Pengaturan terlebih dahulu.');
  return { apiKey: apiKey, baseUrl: preferences.baseUrl, model: preferences.model };
}

function normalizeAiBaseUrl_(value) {
  const url = String(value || '').trim().replace(/\/+$/, '');
  if (!url) return '';
  if (!/^https:\/\/[A-Za-z0-9.-]+(?::\d{2,5})?(?:\/[^\s?#]*)?$/.test(url)) {
    throw createError_('INVALID_AI_URL', 'Base URL harus berupa alamat HTTPS yang valid tanpa query atau fragment.');
  }
  const host = url.replace(/^https:\/\//, '').split('/')[0].split(':')[0].toLowerCase();
  if (host === 'localhost' || host.endsWith('.local') || /^127\./.test(host) || /^10\./.test(host)
      || /^192\.168\./.test(host) || /^169\.254\./.test(host)
      || /^172\.(1[6-9]|2\d|3[01])\./.test(host) || host === '0.0.0.0') {
    throw createError_('INVALID_AI_URL', 'Base URL jaringan lokal tidak diizinkan.');
  }
  return url;
}

function aiEndpoint_(baseUrl) {
  const normalized = normalizeAiBaseUrl_(baseUrl);
  return /\/chat\/completions$/i.test(normalized) ? normalized : normalized + '/chat/completions';
}

function aiResponseText_(payload) {
  const content = payload && payload.choices && payload.choices[0] && payload.choices[0].message
    ? payload.choices[0].message.content
    : payload && payload.output_text;
  let text = '';
  if (typeof content === 'string') text = content;
  else if (Array.isArray(content)) text = content.map(function(part) {
    return String(part && (part.text || part.output_text) || '');
  }).join('');
  if (!text && payload && Array.isArray(payload.output)) {
    text = payload.output.map(function(item) {
      return item && Array.isArray(item.content) ? item.content.map(function(part) { return String(part.text || ''); }).join('') : '';
    }).join('');
  }
  text = String(text || '').trim();
  if (!text) throw createError_('AI_EMPTY_RESPONSE', 'Penyedia AI tidak mengembalikan jawaban yang dapat dibaca.');
  return text;
}

function openAiMessages_(body) {
  const messages = [];
  const systemParts = body && body.systemInstruction && body.systemInstruction.parts || [];
  const systemText = systemParts.map(function(part) { return String(part && part.text || ''); }).join('').trim();
  if (systemText) messages.push({ role: 'system', content: systemText });
  (body && body.contents || []).forEach(function(message) {
    const role = message.role === 'model' ? 'assistant' : 'user';
    const parts = message.parts || [];
    const hasImage = parts.some(function(part) { return part && part.inlineData && part.inlineData.data; });
    if (!hasImage) {
      messages.push({ role: role, content: parts.map(function(part) { return String(part && part.text || ''); }).join('') });
      return;
    }
    messages.push({
      role: role,
      content: parts.map(function(part) {
        if (part && part.inlineData && part.inlineData.data) {
          return { type: 'image_url', image_url: { url: 'data:' + part.inlineData.mimeType + ';base64,' + part.inlineData.data } };
        }
        return { type: 'text', text: String(part && part.text || '') };
      })
    });
  });
  return messages;
}

function callAi_(apiKey, baseUrl, model, body) {
  const config = body && body.generationConfig || {};
  const requestBody = {
    model: model || 'default',
    messages: openAiMessages_(body || {}),
    temperature: Number(config.temperature === undefined ? 0.25 : config.temperature),
    max_tokens: Number(config.maxOutputTokens || 900),
    stream: false,
    store: false
  };
  if (config.responseMimeType === 'application/json') requestBody.response_format = { type: 'json_object' };
  const response = UrlFetchApp.fetch(
    aiEndpoint_(baseUrl),
    {
      method: 'post',
      contentType: 'application/json',
      headers: { Authorization: 'Bearer ' + apiKey },
      payload: JSON.stringify(requestBody),
      muteHttpExceptions: true
    }
  );
  const status = response.getResponseCode();
  let payload = {};
  try { payload = JSON.parse(response.getContentText() || '{}'); } catch (error) { payload = {}; }
  if (status < 200 || status >= 300) {
    if (status === 429) throw createError_('AI_PROVIDER_ERROR', 'Kuota penyedia AI sedang habis. Coba lagi nanti.');
    if ([400, 401, 403].indexOf(status) >= 0) throw createError_('AI_PROVIDER_ERROR', 'API key, model, atau Base URL tidak dapat digunakan. Periksa Pengaturan AI.');
    throw createError_('AI_PROVIDER_ERROR', 'Layanan AI sedang tidak tersedia.');
  }
  return aiResponseText_(payload);
}

function aiContextIntent_(question) {
  const normalized = String(question || '').toLowerCase();
  const holistic = /bertahan|runway|bulan (ke )?depan|cukup|aman|kondisi|rencana|kemampuan|analisis|evaluasi|saran|darurat/.test(normalized);
  return {
    holistic: holistic,
    accounts: holistic || /saldo|utang|aset|kekayaan|likuid|rekening|akun|uang|kas/.test(normalized),
    budgets: holistic || /budget|anggaran|kategori|makan|transport|hiburan|belanja|pengeluaran/.test(normalized),
    goals: holistic || /target|tujuan|dana darurat|menabung|tabungan/.test(normalized),
    funds: holistic || /pos dana|sinking|servis|pajak|liburan|pendidikan|alokasi/.test(normalized),
    bills: holistic || /tagihan|jatuh tempo|bayar|kartu kredit|paylater/.test(normalized),
    investments: /invest|saham|reksadana|kripto|emas|portofolio|profit|untung|rugi/.test(normalized),
    transactions: holistic || /mengapa|kenapa|turun|naik|merchant|transaksi|riwayat/.test(normalized)
  };
}

function buildAiContext_(period, question) {
  const completedTransactions = rowsAsObjects_(VINN_CONFIG.SHEETS.TRANSACTIONS).filter(function(row) {
    return !row.deleted_at && String(row.status || 'completed') === 'completed';
  });
  const allTransactions = completedTransactions.filter(function(row) {
    return String(row.date).slice(0, 7) === period;
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
  const accounts = rowsAsObjects_(VINN_CONFIG.SHEETS.ACCOUNTS).filter(accountIsActive_).map(function(account) {
    return {
      name: account.name,
      type: account.type,
      balance: accountCurrentBalance_(account, completedTransactions),
      liability: truthy_(account.is_liability)
    };
  });
  const assets = accounts.filter(function(account) { return !account.liability; }).reduce(function(sum, account) { return sum + account.balance; }, 0);
  const liabilities = accounts.filter(function(account) { return account.liability; }).reduce(function(sum, account) { return sum + account.balance; }, 0);
  const liquidFunds = accounts.filter(function(account) {
    return !account.liability && String(account.type || '').toLowerCase() !== 'investment';
  }).reduce(function(sum, account) { return sum + account.balance; }, 0);
  const budgetRows = rowsAsObjects_(VINN_CONFIG.SHEETS.BUDGETS).filter(function(row) { return String(row.month) === period; });
  const goalRows = rowsAsObjects_(VINN_CONFIG.SHEETS.GOALS).filter(function(row) {
    return String(row.status || 'active').toLowerCase() !== 'completed';
  });
  const billRows = rowsAsObjects_(VINN_CONFIG.SHEETS.BILLS).filter(function(row) {
    return String(row.status || 'active').toLowerCase() === 'active';
  });
  const unpaidBills = billRows.filter(function(row) {
    return String(row.last_paid_period || '') !== period && String(row.status || '').toLowerCase() !== 'paid';
  });
  const budgetLimitTotal = budgetRows.reduce(function(sum, row) { return sum + Number(row.limit_amount || 0); }, 0);
  const budgetSpentTotal = budgetRows.reduce(function(sum, row) {
    return sum + Math.max(0, Number(byCategory[row.category] || 0));
  }, 0);
  const unpaidBillAmount = unpaidBills.reduce(function(sum, row) { return sum + Math.max(0, billInstallmentAmount_(row) - Number(row.current_period_paid || 0)); }, 0);
  const goalRemaining = goalRows.reduce(function(sum, row) {
    return sum + Math.max(0, Number(row.target_amount || 0) - Number(row.current_amount || 0));
  }, 0);
  const sinkingFundRows = rowsAsObjects_(VINN_CONFIG.SHEETS.SINKING_FUNDS).filter(function(row) { return truthy_(row.is_active); });
  const sinkingFundAllocated = sinkingFundRows.reduce(function(sum, row) { return sum + Number(row.current_amount || 0); }, 0);
  const sinkingFundRemaining = sinkingFundRows.reduce(function(sum, row) { return sum + Math.max(0, Number(row.target_amount || 0) - Number(row.current_amount || 0)); }, 0);
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
    }).filter(function(item) { return item.amount > 0; }).sort(function(a, b) { return b.amount - a.amount; }).slice(0, 10),
    financialPosition: {
      assets: assets,
      liabilities: liabilities,
      netWorth: assets - liabilities,
      liquidFunds: liquidFunds,
      activeAccountCount: accounts.length
    },
    dataAvailability: {
      transactionCount: allTransactions.length,
      expenseTransactionCount: operating.filter(function(row) { return row.type === 'expense'; }).length,
      activeAccountCount: accounts.length,
      budgetCount: budgetRows.length,
      activeGoalCount: goalRows.length,
      activeSinkingFundCount: sinkingFundRows.length,
      unpaidBillCount: unpaidBills.length
    },
    planningSummary: {
      budgetLimitTotal: budgetLimitTotal,
      budgetSpentTotal: budgetSpentTotal,
      unpaidBillAmount: unpaidBillAmount,
      goalRemaining: goalRemaining,
      sinkingFundAllocated: sinkingFundAllocated,
      sinkingFundRemaining: sinkingFundRemaining
    },
    runway: {
      liquidFunds: liquidFunds,
      observedMonthlyExpense: expense,
      estimatedMonths: expense > 0 ? Math.round(liquidFunds / expense * 10) / 10 : null,
      calculable: expense > 0
    }
  };
  const manifest = ['Ringkasan ' + period, 'Posisi keuangan agregat', 'Ketersediaan data', 'Komitmen finansial agregat'];
  const intent = aiContextIntent_(question);
  if (intent.accounts) {
    context.selectedAccounts = accounts.slice(0, 20);
    manifest.push('Saldo akun terpilih');
  }
  if (intent.budgets) {
    context.budgets = budgetRows.slice(0, 30).map(function(row) {
      return { category: row.category, limit: Number(row.limit_amount || 0), spent: Math.max(0, Number(byCategory[row.category] || 0)) };
    });
    manifest.push('Anggaran aktif');
  }
  if (intent.goals) {
    context.goals = goalRows.slice(0, 20).map(function(row) {
      return { name: row.name, target: Number(row.target_amount || 0), current: Number(row.current_amount || 0), deadline: String(row.deadline || '') };
    });
    manifest.push('Target finansial');
  }
  if (intent.funds) {
    context.sinkingFunds = sinkingFundRows.slice(0, 20).map(function(row) {
      return {
        name: String(row.name || ''), purpose: String(row.purpose || 'Lainnya'),
        targetAmount: Number(row.target_amount || 0), currentAmount: Number(row.current_amount || 0),
        monthlyContribution: Number(row.monthly_contribution || 0), targetDate: String(row.target_date || ''),
        accountId: String(row.account_id || '')
      };
    });
    manifest.push('Pos dana aktif');
  }
  if (intent.bills) {
    context.bills = billRows.slice(0, 30).map(function(row) {
      return { name: row.name, amount: billInstallmentAmount_(row), currentPeriodPaid: Number(row.current_period_paid || 0), totalPaid: Number(row.total_paid || 0), dueDate: String(row.due_date || ''), paid: String(row.last_paid_period || '') === period, liabilityAccountId: String(row.liability_account_id || ''), durationMonths: Number(row.duration_months || 0) || null, paidCount: Number(row.paid_count || 0), remainingMonths: row.duration_months ? Math.max(0, Number(row.duration_months) - Number(row.paid_count || 0)) : null, installmentPhases: billInstallmentPhases_(row.installment_phases_json || []) };
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
    context.relevantTransactions = allTransactions.slice(-12).reverse().map(function(row) {
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
    const answer = callAi_(ready.apiKey, ready.baseUrl, ready.model, {
      systemInstruction: { parts: [{ text: 'Anda adalah Financial Insight, asisten keuangan read-only berbahasa Indonesia. Gunakan hanya data JSON yang diberikan, terutama financialPosition, dataAvailability, planningSummary, dan runway. Sebutkan periode dan data yang digunakan. Pisahkan fakta, perhitungan, dan saran umum. transactionCount atau expenseTransactionCount bernilai 0 berarti belum ada transaksi tercatat pada periode tersebut, bukan bukti bahwa kebutuhan hidup pengguna nol. Jika runway.calculable bernilai false, jangan mengarang durasi ketahanan dana; jelaskan data pengeluaran yang masih dibutuhkan. Jangan mengubah data, menjanjikan keuntungan, melakukan transaksi investasi, atau mengaku sebagai penasihat berlisensi. Harga investasi manual/delayed tidak boleh disebut real-time. Jangan meminta PIN, OTP, CVV, password, atau nomor kartu lengkap.' }] },
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
    if (currentScopeMemberId_()) {
      // Pada Mode Pasangan, menghapus riwayat hanya boleh mengenai percakapan
      // milik anggota yang sedang masuk, bukan mengosongkan sheet bersama.
      rowsAsObjects_(VINN_CONFIG.SHEETS.AI_CHAT)
        .sort(function(a, b) { return b._row - a._row; })
        .forEach(function(row) { deleteObjectRow_(VINN_CONFIG.SHEETS.AI_CHAT, row._row); });
    } else if (sheet && sheet.getLastRow() > 1) {
      sheet.getRange(2, 1, sheet.getLastRow() - 1, VINN_CONFIG.HEADERS.AIChat.length).clearContent();
    }
    audit_('CLEAR_AI_HISTORY', 'ai_chat', '', id_('req'), {});
    return ok_({ cleared: true });
  } catch (error) { return fail_(error); }
}
