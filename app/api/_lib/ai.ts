import { env } from "cloudflare:workers";
import { getD1 } from "@/db";
import {
  DEFAULT_AI_MODEL,
  DEFAULT_AI_PROVIDER,
  MAX_AI_QUESTION_LENGTH,
  MAX_RECEIPT_BYTES,
  estimateBase64Bytes,
  normalizeOcrReceipt,
  receiptNeedsRetake,
  stripDataUrlPrefix,
  type AiAnswer,
  type AiChatMessage,
  type AiSettingsStatus,
  type OcrReceipt,
} from "@/lib/ai";
import { ApiError, makeId, nowIso } from "./api";
import { auditStatement } from "./audit";
import { getBootstrap, requireWorkspace } from "./repository";

type RuntimeAiEnv = {
  GEMINI_API_KEY?: string;
  GEMINI_MODEL?: string;
  AI_KEY_ENCRYPTION_SECRET?: string;
};

type AiSettingsRow = {
  workspaceId: string;
  provider: string;
  model: string;
  enabled: number;
  consentAccepted: number;
  encryptedApiKey: string | null;
  apiKeyIv: string | null;
  updatedAt: string;
};

type AiMessageRow = {
  id: string;
  role: "user" | "assistant";
  content: string;
  period: string;
  contextManifest: string;
  createdAt: string;
};

const runtimeEnv = () => env as unknown as RuntimeAiEnv;
const currentModel = () => runtimeEnv().GEMINI_MODEL?.trim() || DEFAULT_AI_MODEL;

const bytesToBase64 = (bytes: Uint8Array) => {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
};

const base64ToBytes = (value: string) => {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
};

async function encryptionKey() {
  const secret = runtimeEnv().AI_KEY_ENCRYPTION_SECRET?.trim();
  if (!secret) {
    throw new ApiError(
      503,
      "AI_SECRET_UNAVAILABLE",
      "Penyimpanan API key belum siap. Hubungi pemilik workspace.",
    );
  }
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
  return crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

async function encryptApiKey(apiKey: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    await encryptionKey(),
    new TextEncoder().encode(apiKey),
  );
  return {
    encryptedApiKey: bytesToBase64(new Uint8Array(ciphertext)),
    apiKeyIv: bytesToBase64(iv),
  };
}

async function decryptApiKey(ciphertext: string, iv: string) {
  try {
    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: base64ToBytes(iv) },
      await encryptionKey(),
      base64ToBytes(ciphertext),
    );
    return new TextDecoder().decode(plaintext);
  } catch {
    throw new ApiError(503, "AI_KEY_UNREADABLE", "API key AI tersimpan tetapi tidak dapat dibaca dengan aman.");
  }
}

async function getSettingsRow(workspaceId: string) {
  return getD1()
    .prepare(
      `SELECT workspace_id AS workspaceId, provider, model, enabled,
              consent_accepted AS consentAccepted,
              encrypted_api_key AS encryptedApiKey, api_key_iv AS apiKeyIv,
              updated_at AS updatedAt
       FROM ai_settings WHERE workspace_id = ? LIMIT 1`,
    )
    .bind(workspaceId)
    .first<AiSettingsRow>();
}

const serializeSettings = (row: AiSettingsRow | null): AiSettingsStatus => ({
  provider: DEFAULT_AI_PROVIDER,
  model: row?.model || currentModel(),
  enabled: Boolean(row?.enabled),
  consentAccepted: Boolean(row?.consentAccepted),
  configured: Boolean(runtimeEnv().GEMINI_API_KEY?.trim() || (row?.encryptedApiKey && row.apiKeyIv)),
  storesReceiptImages: false,
});

export async function getAiSettings(workspaceId: string) {
  await requireWorkspace(workspaceId);
  return serializeSettings(await getSettingsRow(workspaceId));
}

export async function updateAiSettings(
  workspaceId: string,
  input: { enabled: boolean; consentAccepted: boolean; apiKey?: string; removeApiKey?: boolean },
) {
  await requireWorkspace(workspaceId);
  const existing = await getSettingsRow(workspaceId);
  let encryptedApiKey = existing?.encryptedApiKey ?? null;
  let apiKeyIv = existing?.apiKeyIv ?? null;
  if (input.removeApiKey) {
    encryptedApiKey = null;
    apiKeyIv = null;
  }
  if (input.apiKey !== undefined) {
    const normalized = input.apiKey.trim();
    if (normalized.length < 20 || normalized.length > 512) {
      throw new ApiError(400, "INVALID_AI_KEY", "API key Gemini tidak valid.");
    }
    ({ encryptedApiKey, apiKeyIv } = await encryptApiKey(normalized));
  }
  if (input.enabled && !input.consentAccepted) {
    throw new ApiError(400, "AI_CONSENT_REQUIRED", "Persetujuan privasi wajib sebelum AI diaktifkan.");
  }
  if (input.enabled && !runtimeEnv().GEMINI_API_KEY?.trim() && (!encryptedApiKey || !apiKeyIv)) {
    throw new ApiError(400, "AI_NOT_CONFIGURED", "Tambahkan API key Gemini sebelum AI diaktifkan.");
  }

  const d1 = getD1();
  const now = nowIso();
  await d1.batch([
    d1
      .prepare(
        `INSERT INTO ai_settings
           (workspace_id, provider, model, enabled, consent_accepted,
            encrypted_api_key, api_key_iv, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(workspace_id) DO UPDATE SET
           provider = excluded.provider,
           model = excluded.model,
           enabled = excluded.enabled,
           consent_accepted = excluded.consent_accepted,
           encrypted_api_key = excluded.encrypted_api_key,
           api_key_iv = excluded.api_key_iv,
           updated_at = excluded.updated_at`,
      )
      .bind(
        workspaceId,
        DEFAULT_AI_PROVIDER,
        currentModel(),
        input.enabled ? 1 : 0,
        input.consentAccepted ? 1 : 0,
        encryptedApiKey,
        apiKeyIv,
        now,
        now,
      ),
    auditStatement(d1, {
      workspaceId,
      action: "UPDATE_AI_SETTINGS",
      entityType: "ai_settings",
      entityId: workspaceId,
      details: {
        enabled: input.enabled,
        consentAccepted: input.consentAccepted,
        keyChanged: input.apiKey !== undefined || Boolean(input.removeApiKey),
      },
    }),
  ]);
  return serializeSettings(await getSettingsRow(workspaceId));
}

async function requireReadyAi(workspaceId: string) {
  const row = await getSettingsRow(workspaceId);
  if (!row?.enabled) throw new ApiError(409, "AI_DISABLED", "AI masih dinonaktifkan di Pengaturan.");
  if (!row.consentAccepted) throw new ApiError(409, "AI_CONSENT_REQUIRED", "Persetujuan privasi AI belum diberikan.");
  const runtimeKey = runtimeEnv().GEMINI_API_KEY?.trim();
  if (runtimeKey) return { apiKey: runtimeKey, model: row.model || currentModel() };
  if (!row.encryptedApiKey || !row.apiKeyIv) {
    throw new ApiError(409, "AI_NOT_CONFIGURED", "Tambahkan API key Gemini di Pengaturan terlebih dahulu.");
  }
  return { apiKey: await decryptApiKey(row.encryptedApiKey, row.apiKeyIv), model: row.model || currentModel() };
}

type GeminiPart = { text?: string };
type GeminiResponse = {
  candidates?: Array<{ content?: { parts?: GeminiPart[] } }>;
  error?: { message?: string; status?: string };
};

async function callGemini(
  apiKey: string,
  model: string,
  body: Record<string, unknown>,
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45_000);
  let response: Response;
  try {
    response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({ ...body, store: false }),
        signal: controller.signal,
      },
    );
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new ApiError(504, "AI_TIMEOUT", "Layanan AI terlalu lama merespons. Coba lagi.");
    }
    throw new ApiError(502, "AI_UNAVAILABLE", "Layanan AI tidak dapat dihubungi.");
  } finally {
    clearTimeout(timeout);
  }
  const payload = await response.json().catch(() => ({})) as GeminiResponse;
  if (!response.ok) {
    const providerMessage = payload.error?.message ?? "Permintaan ditolak penyedia AI.";
    const safeMessage = response.status === 400 || response.status === 401 || response.status === 403
      ? "API key atau konfigurasi Gemini tidak dapat digunakan. Periksa Pengaturan."
      : response.status === 429
        ? "Kuota Gemini sedang habis. Coba lagi nanti."
        : providerMessage.slice(0, 240);
    throw new ApiError(response.status === 429 ? 429 : 502, "AI_PROVIDER_ERROR", safeMessage);
  }
  const text = payload.candidates?.[0]?.content?.parts
    ?.map((part) => part.text ?? "")
    .join("")
    .trim();
  if (!text) throw new ApiError(502, "AI_EMPTY_RESPONSE", "Gemini tidak mengembalikan jawaban yang dapat dibaca.");
  return text;
}

function contextIntent(question: string) {
  const normalized = question.toLocaleLowerCase("id-ID");
  return {
    accounts: /saldo|utang|aset|kekayaan|likuid|rekening|akun/.test(normalized),
    budgets: /budget|anggaran|kategori|makan|transport|hiburan|belanja|pengeluaran/.test(normalized),
    goals: /target|tujuan|dana darurat|menabung|tabungan/.test(normalized),
    bills: /tagihan|jatuh tempo|bayar|kartu kredit|paylater/.test(normalized),
    investments: /invest|saham|reksadana|kripto|emas|portofolio|profit|untung|rugi/.test(normalized),
    transactions: /mengapa|kenapa|turun|naik|merchant|transaksi|riwayat/.test(normalized),
  };
}

async function buildFinanceContext(workspaceId: string, period: string, question: string) {
  const snapshot = await getBootstrap(workspaceId, period);
  const transactions = snapshot.transactions.filter((transaction) =>
    transaction.date.startsWith(period) && transaction.status === "completed",
  );
  const operating = transactions.filter((transaction) =>
    !["transfer", "adjustment_in", "adjustment_out", "investment_buy"].includes(transaction.type),
  );
  const income = operating.filter((transaction) => transaction.type === "income")
    .reduce((sum, transaction) => sum + transaction.amount, 0);
  const grossExpense = operating.filter((transaction) => transaction.type === "expense")
    .reduce((sum, transaction) => sum + transaction.amount, 0);
  const refunds = operating.filter((transaction) => transaction.type === "refund")
    .reduce((sum, transaction) => sum + transaction.amount, 0);
  const expense = Math.max(0, grossExpense - refunds);
  const categoryMap = new Map<string, number>();
  operating.forEach((transaction) => {
    const direction = transaction.type === "refund" ? -1 : transaction.type === "expense" ? 1 : 0;
    if (direction) categoryMap.set(transaction.category, (categoryMap.get(transaction.category) ?? 0) + direction * transaction.amount);
  });
  const context: Record<string, unknown> = {
    period,
    currency: snapshot.profile.currency,
    monthlySummary: {
      income,
      expense,
      cashflow: income - expense,
      savingsRate: income > 0 ? Number((((income - expense) / income) * 100).toFixed(1)) : 0,
    },
    expenseByCategory: [...categoryMap.entries()]
      .map(([category, amount]) => ({ category, amount: Math.max(0, amount) }))
      .filter((item) => item.amount > 0)
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10),
  };
  const manifest = [`Ringkasan ${period}`, "Agregat kategori"];
  const intent = contextIntent(question);

  if (intent.accounts) {
    const assets = snapshot.accounts.filter((account) => !account.liability).reduce((sum, account) => sum + account.balance, 0);
    const liabilities = snapshot.accounts.filter((account) => account.liability).reduce((sum, account) => sum + account.balance, 0);
    context.accountSummary = { assets, liabilities, netWorth: assets - liabilities };
    context.selectedAccounts = snapshot.accounts.slice(0, 20).map((account) => ({
      name: account.name,
      type: account.type,
      balance: account.balance,
      liability: account.liability,
    }));
    manifest.push("Saldo akun terpilih");
  }
  if (intent.budgets) {
    context.budgets = snapshot.budgets.slice(0, 30).map((budget) => ({
      category: budget.category,
      limit: budget.limit,
      spent: Math.max(0, categoryMap.get(budget.category) ?? 0),
    }));
    manifest.push("Anggaran aktif");
  }
  if (intent.goals) {
    context.goals = snapshot.goals.slice(0, 20).map((goal) => ({
      name: goal.name,
      target: goal.target,
      current: goal.current,
      deadline: goal.deadline,
    }));
    manifest.push("Target finansial");
  }
  if (intent.bills) {
    context.bills = snapshot.bills.slice(0, 30).map((bill) => ({
      name: bill.name,
      amount: bill.amount,
      dueDate: bill.dueDate,
      paid: bill.paid,
    }));
    manifest.push("Tagihan");
  }
  if (intent.investments) {
    context.investments = snapshot.investmentAssets.slice(0, 30).map((asset) => ({
      ticker: asset.ticker,
      name: asset.name,
      units: asset.units,
      costBasis: asset.costBasis,
      marketValue: asset.marketValue,
      realizedPl: asset.realizedPl,
      unrealizedPl: asset.unrealizedPl,
      priceSource: asset.priceSource,
      priceStatus: asset.priceStatus,
      priceUpdatedAt: asset.priceUpdatedAt,
    }));
    manifest.push("Ringkasan investasi (harga dapat delayed/manual)");
  }
  if (intent.transactions) {
    context.relevantTransactions = transactions.slice(0, 12).map((transaction) => ({
      date: transaction.date,
      title: transaction.title,
      type: transaction.type,
      category: transaction.category,
      amount: transaction.amount,
    }));
    manifest.push("Maksimal 12 transaksi relevan");
  }
  return { context, manifest };
}

const parseManifest = (value: string) => {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
};

const serializeMessage = (row: AiMessageRow): AiChatMessage => ({
  id: row.id,
  role: row.role,
  content: row.content,
  period: row.period,
  contextUsed: parseManifest(row.contextManifest),
  createdAt: row.createdAt,
});

export async function listAiMessages(workspaceId: string) {
  await requireWorkspace(workspaceId);
  const result = await getD1()
    .prepare(
      `SELECT id, role, content, period, context_manifest AS contextManifest,
              created_at AS createdAt
       FROM ai_chat_messages WHERE workspace_id = ?
       ORDER BY created_at DESC, id DESC LIMIT 60`,
    )
    .bind(workspaceId)
    .all<AiMessageRow>();
  return result.results.reverse().map(serializeMessage);
}

export async function askAi(workspaceId: string, question: string, period: string): Promise<AiAnswer> {
  await requireWorkspace(workspaceId);
  const normalizedQuestion = question.trim();
  if (!normalizedQuestion || normalizedQuestion.length > MAX_AI_QUESTION_LENGTH) {
    throw new ApiError(400, "INVALID_QUESTION", `Pertanyaan wajib diisi dan maksimal ${MAX_AI_QUESTION_LENGTH} karakter.`);
  }
  const { apiKey, model } = await requireReadyAi(workspaceId);
  const { context, manifest } = await buildFinanceContext(workspaceId, period, normalizedQuestion);
  const historyResult = await getD1()
    .prepare(
      `SELECT role, content FROM ai_chat_messages
       WHERE workspace_id = ? ORDER BY created_at DESC, id DESC LIMIT 8`,
    )
    .bind(workspaceId)
    .all<{ role: "user" | "assistant"; content: string }>();
  const history = historyResult.results.reverse().map((message) => ({
    role: message.role === "assistant" ? "model" : "user",
    parts: [{ text: message.content.slice(0, 2000) }],
  }));
  const answer = await callGemini(apiKey, model, {
    systemInstruction: {
      parts: [{
        text: "Anda adalah Financial Insight, asisten keuangan read-only berbahasa Indonesia. Gunakan hanya data JSON yang diberikan. Sebutkan periode dan data yang digunakan. Pisahkan fakta, perhitungan, dan saran umum. Jangan mengubah data, menjanjikan keuntungan, melakukan transaksi investasi, atau mengaku sebagai penasihat berlisensi. Harga investasi berstatus manual/delayed tidak boleh disebut real-time. Jika data tidak cukup, katakan dengan jelas. Jangan meminta PIN, OTP, CVV, password, atau nomor kartu lengkap.",
      }],
    },
    contents: [
      ...history,
      {
        role: "user",
        parts: [{
          text: `Konteks finansial terpilih:\n${JSON.stringify(context)}\n\nPertanyaan pengguna:\n${normalizedQuestion}`,
        }],
      },
    ],
    generationConfig: { temperature: 0.25, maxOutputTokens: 900 },
  });

  const d1 = getD1();
  const now = nowIso();
  const userId = makeId("ai-user");
  const assistantId = makeId("ai-answer");
  const manifestJson = JSON.stringify(manifest);
  await d1.batch([
    d1
      .prepare(
        `INSERT INTO ai_chat_messages
           (id, workspace_id, role, content, period, context_manifest, created_at)
         VALUES (?, ?, 'user', ?, ?, ?, ?)`,
      )
      .bind(userId, workspaceId, normalizedQuestion, period, manifestJson, now),
    d1
      .prepare(
        `INSERT INTO ai_chat_messages
           (id, workspace_id, role, content, period, context_manifest, created_at)
         VALUES (?, ?, 'assistant', ?, ?, ?, ?)`,
      )
      .bind(assistantId, workspaceId, answer, period, manifestJson, now),
    auditStatement(d1, {
      workspaceId,
      action: "AI_ASK",
      entityType: "ai_chat",
      entityId: assistantId,
      details: { period, contextUsed: manifest, model },
    }),
  ]);
  const message: AiChatMessage = {
    id: assistantId,
    role: "assistant",
    content: answer,
    period,
    contextUsed: manifest,
    createdAt: now,
  };
  return { message, contextUsed: manifest, period, model };
}

export async function clearAiMessages(workspaceId: string) {
  await requireWorkspace(workspaceId);
  const d1 = getD1();
  await d1.batch([
    d1.prepare("DELETE FROM ai_chat_messages WHERE workspace_id = ?").bind(workspaceId),
    auditStatement(d1, {
      workspaceId,
      action: "CLEAR_AI_HISTORY",
      entityType: "ai_chat",
      entityId: workspaceId,
      details: {},
    }),
  ]);
  return { cleared: true };
}

const receiptSchema = {
  type: "OBJECT",
  properties: {
    merchant: { type: "STRING" },
    date: { type: "STRING", description: "Tanggal YYYY-MM-DD" },
    total: { type: "NUMBER" },
    tax: { type: "NUMBER" },
    serviceFee: { type: "NUMBER" },
    paymentMethod: { type: "STRING" },
    suggestedCategory: { type: "STRING" },
    notes: { type: "STRING" },
    items: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          name: { type: "STRING" },
          quantity: { type: "NUMBER" },
          amount: { type: "NUMBER" },
        },
        required: ["name"],
      },
    },
    confidence: { type: "NUMBER" },
    imageQuality: { type: "STRING", enum: ["clear", "blurry", "unreadable"] },
    warnings: { type: "ARRAY", items: { type: "STRING" } },
  },
  required: ["merchant", "date", "total", "tax", "serviceFee", "paymentMethod", "suggestedCategory", "notes", "items", "confidence", "imageQuality", "warnings"],
};

function jakartaToday() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export async function scanReceipt(
  workspaceId: string,
  input: { imageBase64: string; mimeType: string; fileName?: string },
): Promise<{ receipt: OcrReceipt; model: string; imageStored: false }> {
  await requireWorkspace(workspaceId);
  const { apiKey, model } = await requireReadyAi(workspaceId);
  if (!/^image\/(jpeg|png|webp)$/.test(input.mimeType)) {
    throw new ApiError(400, "INVALID_RECEIPT_TYPE", "Gunakan gambar JPG, PNG, atau WebP.");
  }
  const base64 = stripDataUrlPrefix(input.imageBase64).replace(/\s/g, "");
  const bytes = estimateBase64Bytes(base64);
  if (!bytes || bytes > MAX_RECEIPT_BYTES || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) {
    throw new ApiError(413, "RECEIPT_TOO_LARGE", "Gambar struk harus valid dan maksimal 4 MB setelah kompresi.");
  }
  const categoryResult = await getD1()
    .prepare(
      `SELECT name FROM categories
       WHERE workspace_id = ? AND type = 'expense' AND archived = 0
       ORDER BY is_default DESC, name LIMIT 50`,
    )
    .bind(workspaceId)
    .all<{ name: string }>();
  const categories = categoryResult.results.map((row) => row.name);
  const text = await callGemini(apiKey, model, {
    systemInstruction: {
      parts: [{
        text: "Ekstrak struk belanja Indonesia menjadi JSON sesuai schema. Jangan mengarang angka yang tidak terlihat. Nominal harus angka Rupiah tanpa simbol atau pemisah ribuan. Nilai confidence 0-1. Jika teks utama, total, atau tanggal tidak terbaca, tandai imageQuality blurry/unreadable dan jelaskan pada warnings.",
      }],
    },
    contents: [{
      role: "user",
      parts: [
        { text: `Kategori pengeluaran yang diizinkan: ${categories.join(", ")}. Pilih satu kategori terdekat. Gambar ini hanya untuk ekstraksi dan tidak boleh dianggap konfirmasi transaksi.` },
        { inlineData: { mimeType: input.mimeType, data: base64 } },
      ],
    }],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 1400,
      responseMimeType: "application/json",
      responseSchema: receiptSchema,
    },
  });
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new ApiError(502, "OCR_INVALID_RESPONSE", "Hasil OCR tidak dapat divalidasi. Coba foto lain.");
  }
  const receipt = normalizeOcrReceipt(parsed, categories, jakartaToday());
  if (receiptNeedsRetake(receipt)) {
    throw new ApiError(422, "OCR_IMAGE_UNCLEAR", "Foto struk kurang jelas. Ambil ulang dengan cahaya merata dan seluruh struk terlihat.", {
      confidence: receipt.confidence,
      imageQuality: receipt.imageQuality,
      warnings: receipt.warnings,
    });
  }
  const d1 = getD1();
  await d1.batch([
    auditStatement(d1, {
      workspaceId,
      action: "OCR_EXTRACT",
      entityType: "receipt",
      entityId: makeId("ocr"),
      details: { confidence: receipt.confidence, imageQuality: receipt.imageQuality, model, imageStored: false },
    }),
  ]);
  return { receipt, model, imageStored: false };
}
