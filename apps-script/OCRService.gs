function normalizeOcrMoney_(value) {
  const number = Number(value);
  return isFinite(number) && number >= 0 ? Math.round(number) : 0;
}

function normalizeOcrReceipt_(value, categories) {
  value = value && typeof value === 'object' ? value : {};
  const rawCategory = String(value.suggestedCategory || value.suggested_category || '').trim().toLowerCase();
  const category = categories.find(function(name) { return String(name).toLowerCase() === rawCategory; })
    || categories.find(function(name) { return String(name) === 'Lainnya'; })
    || categories[0]
    || 'Lainnya';
  const rawDate = String(value.date || '');
  const date = /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : dateIso_(new Date());
  const quality = ['blurry', 'unreadable'].indexOf(String(value.imageQuality || value.image_quality)) >= 0
    ? String(value.imageQuality || value.image_quality)
    : 'clear';
  const confidence = Math.min(1, Math.max(0, Number(value.confidence || 0)));
  const items = Array.isArray(value.items) ? value.items.slice(0, 50).map(function(item) {
    const quantity = Number(item && item.quantity);
    const amount = Number(item && item.amount);
    return {
      name: String(item && item.name || '').trim().slice(0, 120),
      quantity: isFinite(quantity) && quantity > 0 ? quantity : null,
      amount: isFinite(amount) && amount >= 0 ? Math.round(amount) : null
    };
  }).filter(function(item) { return item.name; }) : [];
  const warnings = Array.isArray(value.warnings) ? value.warnings.slice(0, 8).map(function(warning) {
    return String(warning || '').trim().slice(0, 180);
  }).filter(Boolean) : [];
  return {
    merchant: String(value.merchant || '').trim().slice(0, 160),
    date: date,
    total: normalizeOcrMoney_(value.total),
    tax: normalizeOcrMoney_(value.tax),
    serviceFee: normalizeOcrMoney_(value.serviceFee || value.service_fee),
    paymentMethod: String(value.paymentMethod || value.payment_method || '').trim().slice(0, 100),
    suggestedCategory: category,
    notes: String(value.notes || '').trim().slice(0, 300),
    items: items,
    confidence: isFinite(confidence) ? confidence : 0,
    imageQuality: quality,
    warnings: warnings
  };
}

function receiptSchema_() {
  return {
    type: 'OBJECT',
    properties: {
      merchant: { type: 'STRING' },
      date: { type: 'STRING', description: 'Tanggal YYYY-MM-DD' },
      total: { type: 'NUMBER' },
      tax: { type: 'NUMBER' },
      serviceFee: { type: 'NUMBER' },
      paymentMethod: { type: 'STRING' },
      suggestedCategory: { type: 'STRING' },
      notes: { type: 'STRING' },
      items: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            name: { type: 'STRING' },
            quantity: { type: 'NUMBER' },
            amount: { type: 'NUMBER' }
          },
          required: ['name']
        }
      },
      confidence: { type: 'NUMBER' },
      imageQuality: { type: 'STRING', enum: ['clear', 'blurry', 'unreadable'] },
      warnings: { type: 'ARRAY', items: { type: 'STRING' } }
    },
    required: ['merchant', 'date', 'total', 'tax', 'serviceFee', 'paymentMethod', 'suggestedCategory', 'notes', 'items', 'confidence', 'imageQuality', 'warnings']
  };
}

function parseAiJson_(text) {
  const normalized = String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  try { return JSON.parse(normalized); } catch (error) {
    const start = normalized.indexOf('{');
    const end = normalized.lastIndexOf('}');
    if (start >= 0 && end > start) return JSON.parse(normalized.slice(start, end + 1));
    throw error;
  }
}

function apiOcrReceipt(payload) {
  const requestId = String(payload && payload.requestId || id_('req'));
  try {
    payload = payload || {};
    const mimeType = String(payload.mimeType || '');
    if (!/^image\/(jpeg|png|webp)$/.test(mimeType)) throw createError_('INVALID_RECEIPT_TYPE', 'Gunakan gambar JPG, PNG, atau WebP.');
    let base64 = String(payload.imageBase64 || '').replace(/^data:[^,]+,/, '').replace(/\s/g, '');
    if (!base64 || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) throw createError_('INVALID_RECEIPT_IMAGE', 'Gambar struk tidak valid.');
    const bytes = Utilities.base64Decode(base64);
    if (!bytes.length || bytes.length > 4 * 1024 * 1024) throw createError_('RECEIPT_TOO_LARGE', 'Gambar struk maksimal 4 MB setelah kompresi.');
    const ready = assertAiReady_();
    const categories = categoryRows_().filter(function(row) { return row.active && row.type === 'expense'; }).map(function(row) { return row.name; }).slice(0, 50);
    const text = callAi_(ready.apiKey, ready.baseUrl, ready.model, {
      systemInstruction: { parts: [{ text: 'Ekstrak struk belanja Indonesia menjadi JSON sesuai schema. Jangan mengarang angka yang tidak terlihat. Nominal harus angka Rupiah tanpa simbol atau pemisah ribuan. Nilai confidence 0-1. Jika teks utama, total, atau tanggal tidak terbaca, tandai imageQuality blurry/unreadable dan jelaskan pada warnings.' }] },
      contents: [{
        role: 'user',
        parts: [
          { text: 'Kategori pengeluaran yang diizinkan: ' + categories.join(', ') + '. Pilih satu kategori terdekat. Gambar ini hanya untuk ekstraksi dan tidak boleh dianggap konfirmasi transaksi.' },
          { inlineData: { mimeType: mimeType, data: base64 } }
        ]
      }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 1400,
        responseMimeType: 'application/json',
        responseSchema: receiptSchema_()
      }
    });
    let parsed;
    try { parsed = parseAiJson_(text); } catch (error) { throw createError_('OCR_INVALID_RESPONSE', 'Hasil OCR tidak dapat divalidasi. Coba foto lain.'); }
    const receipt = normalizeOcrReceipt_(parsed, categories);
    if (receipt.imageQuality !== 'clear' || receipt.confidence < 0.45 || receipt.total <= 0) {
      throw createError_('OCR_IMAGE_UNCLEAR', 'Foto struk kurang jelas. Ambil ulang dengan cahaya merata dan seluruh struk terlihat.', {
        confidence: receipt.confidence,
        imageQuality: receipt.imageQuality,
        warnings: receipt.warnings
      });
    }
    audit_('OCR_EXTRACT', 'receipt', id_('ocr'), requestId, {
      confidence: receipt.confidence,
      imageQuality: receipt.imageQuality,
      model: ready.model,
      imageStored: false
    });
    return ok_({ receipt: receipt, model: ready.model, imageStored: false }, requestId);
  } catch (error) { return fail_(error, requestId); }
}
