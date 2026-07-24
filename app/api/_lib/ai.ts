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
  aiChatCompletionsUrl,
  normalizeAiBaseUrl,
  type AiAnswer,
  type AiChatMessage,
  type AiSettingsStatus,
  type OcrReceipt,
} from "@/lib/ai";
import { ApiError, makeId, nowIso } from "./api";
import { auditStatement } from "./audit";
import { getBootstrap, requireWorkspace } from "./repository";

type RuntimeAiEnv = {
  AI_API_KEY?: string;
  AI_BASE_URL?: string;
  AI_MODEL?: string;
  AI_KEY_ENCRYPTION_SECRET?: string;
};

type AiSettingsRow = {
  workspaceId: string;
  provider: string;
  baseUrl: string;
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
const currentModel = () => runtimeEnv().AI_MODEL?.trim() || DEFAULT_AI_MODEL;
const currentBaseUrl = () => runtimeEnv().AI_BASE_URL?.trim() || "";

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
              base_url AS baseUrl,
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
  baseUrl: row?.baseUrl || currentBaseUrl(),
  model: row?.model || currentModel(),
  enabled: Boolean(row?.enabled),
  consentAccepted: Boolean(row?.consentAccepted),
  configured: Boolean((runtimeEnv().AI_API_KEY?.trim() || (row?.encryptedApiKey && row.apiKeyIv)) && (row?.baseUrl || currentBaseUrl())),
  storesReceiptImages: false,
});

export async function getAiSettings(workspaceId: string) {
  await requireWorkspace(workspaceId);
  return serializeSettings(await getSettingsRow(workspaceId));
}

export async function updateAiSettings(
  workspaceId: string,
  input: { enabled: boolean; consentAccepted: boolean; baseUrl?: string; model?: string; apiKey?: string; removeApiKey?: boolean },
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
    if (normalized.length < 8 || normalized.length > 2048) {
      throw new ApiError(400, "INVALID_AI_KEY", "API key AI tidak valid.");
    }
    ({ encryptedApiKey, apiKeyIv } = await encryptApiKey(normalized));
  }
  if (input.enabled && !input.consentAccepted) {
    throw new ApiError(400, "AI_CONSENT_REQUIRED", "Persetujuan privasi wajib sebelum AI diaktifkan.");
  }
  let baseUrl: string;
  try {
    baseUrl = normalizeAiBaseUrl(input.baseUrl === undefined ? existing?.baseUrl || currentBaseUrl() : input.baseUrl);
  } catch (error) {
    throw new ApiError(400, "INVALID_AI_URL", error instanceof Error ? error.message : "Base URL AI tidak valid.");
  }
  const model = (input.model === undefined ? existing?.model || currentModel() : input.model).trim();
  if (!model || model.length > 120 || !/^[A-Za-z0-9._:\/-]+$/.test(model)) {
    throw new ApiError(400, "INVALID_AI_MODEL", "Nama model AI tidak valid.");
  }
  if (input.enabled && !baseUrl) {
    throw new ApiError(400, "AI_NOT_CONFIGURED", "Tambahkan Base URL API sebelum AI diaktifkan.");
  }
  if (input.enabled && !runtimeEnv().AI_API_KEY?.trim() && (!encryptedApiKey || !apiKeyIv)) {
    throw new ApiError(400, "AI_NOT_CONFIGURED", "Tambahkan API key sebelum AI diaktifkan.");
  }

  const d1 = getD1();
  const now = nowIso();
  await d1.batch([
    d1
      .prepare(
         `INSERT INTO ai_settings
           (workspace_id, provider, base_url, model, enabled, consent_accepted,
            encrypted_api_key, api_key_iv, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(workspace_id) DO UPDATE SET
           provider = excluded.provider,
           base_url = excluded.base_url,
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
        baseUrl,
        model,
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
        endpointHost: baseUrl ? new URL(baseUrl).host : "",
        model,
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
  const baseUrl = row.baseUrl || currentBaseUrl();
  const runtimeKey = runtimeEnv().AI_API_KEY?.trim();
  if (!baseUrl) throw new ApiError(409, "AI_NOT_CONFIGURED", "Tambahkan Base URL API di Pengaturan terlebih dahulu.");
  if (runtimeKey) return { apiKey: runtimeKey, baseUrl, model: row.model || currentModel() };
  if (!row.encryptedApiKey || !row.apiKeyIv) {
    throw new ApiError(409, "AI_NOT_CONFIGURED", "Tambahkan API key di Pengaturan terlebih dahulu.");
  }
  return { apiKey: await decryptApiKey(row.encryptedApiKey, row.apiKeyIv), baseUrl, model: row.model || currentModel() };
}

type UniversalAiResponse = {
  choices?: Array<{ message?: { content?: string | Array<{ text?: string; output_text?: string }> } }>;
  output_text?: string;
  output?: Array<{ content?: Array<{ text?: string }> }>;
  error?: { message?: string };
};

const textFromUniversalResponse = (payload: UniversalAiResponse) => {
  const content = payload.choices?.[0]?.message?.content ?? payload.output_text;
  if (typeof content === "string") return content.trim();
  if (Array.isArray(content)) return content.map((part) => part.text ?? part.output_text ?? "").join("").trim();
  return payload.output?.flatMap((item) => item.content ?? []).map((part) => part.text ?? "").join("").trim() ?? "";
};

function toOpenAiMessages(body: Record<string, unknown>) {
  const messages: Array<Record<string, unknown>> = [];
  const systemInstruction = body.systemInstruction as { parts?: Array<{ text?: string }> } | undefined;
  const systemText = systemInstruction?.parts?.map((part) => part.text ?? "").join("").trim();
  if (systemText) messages.push({ role: "system", content: systemText });
  const contents = Array.isArray(body.contents)
    ? body.contents as Array<{ role?: string; parts?: Array<{ text?: string; inlineData?: { mimeType?: string; data?: string } }> }>
    : [];
  contents.forEach((message) => {
    const role = message.role === "model" ? "assistant" : "user";
    const parts = message.parts ?? [];
    const hasImage = parts.some((part) => Boolean(part.inlineData?.data));
    if (!hasImage) {
      messages.push({ role, content: parts.map((part) => part.text ?? "").join("") });
      return;
    }
    messages.push({
      role,
      content: parts.map((part) => part.inlineData?.data
        ? { type: "image_url", image_url: { url: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}` } }
        : { type: "text", text: part.text ?? "" }),
    });
  });
  return messages;
}

async function callAi(
  apiKey: string,
  baseUrl: string,
  model: string,
  body: Record<string, unknown>,
) {
  const generation = (body.generationConfig ?? {}) as Record<string, unknown>;
  const requestBody: Record<string, unknown> = {
    model: model || DEFAULT_AI_MODEL,
    messages: toOpenAiMessages(body),
    temperature: typeof generation.temperature === "number" ? generation.temperature : 0.25,
    max_tokens: typeof generation.maxOutputTokens === "number" ? generation.maxOutputTokens : 900,
    stream: false,
    store: false,
  };
  if (generation.responseMimeType === "application/json") requestBody.response_format = { type: "json_object" };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45_000);
  let response: Response;
  try {
    response = await fetch(
      aiChatCompletionsUrl(baseUrl),
      {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
        body: JSON.stringify(requestBody),
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
  const payload = await response.json().catch(() => ({})) as UniversalAiResponse;
  if (!response.ok) {
    const providerMessage = payload.error?.message ?? "Permintaan ditolak penyedia AI.";
    const safeMessage = response.status === 400 || response.status === 401 || response.status === 403
      ? "API key, model, atau Base URL tidak dapat digunakan. Periksa Pengaturan AI."
      : response.status === 429
        ? "Kuota penyedia AI sedang habis. Coba lagi nanti."
        : providerMessage.slice(0, 240);
    throw new ApiError(response.status === 429 ? 429 : 502, "AI_PROVIDER_ERROR", safeMessage);
  }
  const text = textFromUniversalResponse(payload);
  if (!text) throw new ApiError(502, "AI_EMPTY_RESPONSE", "Penyedia AI tidak mengembalikan jawaban yang dapat dibaca.");
  return text;
}

function contextIntent(question: string) {
  const normalized = question.toLocaleLowerCase("id-ID");
  const holistic = /bertahan|runway|bulan (ke )?depan|cukup|aman|kondisi|rencana|kemampuan|analisis|evaluasi|saran|darurat/.test(normalized);
  return {
    holistic,
    accounts: holistic || /saldo|utang|aset|kekayaan|likuid|rekening|akun|uang|kas/.test(normalized),
    budgets: holistic || /budget|anggaran|kategori|makan|transport|hiburan|belanja|pengeluaran/.test(normalized),
    goals: holistic || /target|tujuan|dana darurat|menabung|tabungan/.test(normalized),
    funds: holistic || /pos dana|sinking|servis|pajak|liburan|pendidikan|alokasi/.test(normalized),
    bills: holistic || /tagihan|jatuh tempo|bayar|kartu kredit|paylater/.test(normalized),
    investments: /invest|saham|reksadana|kripto|emas|portofolio|profit|untung|rugi/.test(normalized),
    transactions: holistic || /mengapa|kenapa|turun|naik|merchant|transaksi|riwayat/.test(normalized),
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
  const assets = snapshot.accounts.filter((account) => !account.liability).reduce((sum, account) => sum + account.balance, 0);
  const liabilities = snapshot.accounts.filter((account) => account.liability).reduce((sum, account) => sum + account.balance, 0);
  const liquidFunds = snapshot.accounts
    .filter((account) => !account.liability && account.type.toLocaleLowerCase("id-ID") !== "investment")
    .reduce((sum, account) => sum + account.balance, 0);
  const unpaidBills = snapshot.bills.filter((bill) => !bill.paid);
  const budgetLimitTotal = snapshot.budgets.reduce((sum, budget) => sum + budget.limit, 0);
  const budgetSpentTotal = snapshot.budgets.reduce(
    (sum, budget) => sum + Math.max(0, categoryMap.get(budget.category) ?? 0),
    0,
  );
  const unpaidBillAmount = unpaidBills.reduce((sum, bill) => sum + bill.amount, 0);
  const goalRemaining = snapshot.goals.reduce(
    (sum, goal) => sum + Math.max(0, goal.target - goal.current),
    0,
  );
  const sinkingFundAllocated = snapshot.sinkingFunds.reduce((sum, fund) => sum + fund.currentAmount, 0);
  const sinkingFundRemaining = snapshot.sinkingFunds.reduce((sum, fund) => sum + Math.max(0, fund.targetAmount - fund.currentAmount), 0);
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
    financialPosition: {
      assets,
      liabilities,
      netWorth: assets - liabilities,
      liquidFunds,
      activeAccountCount: snapshot.accounts.length,
    },
    dataAvailability: {
      transactionCount: transactions.length,
      expenseTransactionCount: operating.filter((transaction) => transaction.type === "expense").length,
      activeAccountCount: snapshot.accounts.length,
      budgetCount: snapshot.budgets.length,
      activeGoalCount: snapshot.goals.length,
      activeSinkingFundCount: snapshot.sinkingFunds.length,
      unpaidBillCount: unpaidBills.length,
    },
    planningSummary: {
      budgetLimitTotal,
      budgetSpentTotal,
      unpaidBillAmount,
      goalRemaining,
      sinkingFundAllocated,
      sinkingFundRemaining,
    },
    runway: {
      liquidFunds,
      observedMonthlyExpense: expense,
      estimatedMonths: expense > 0 ? Number((liquidFunds / expense).toFixed(1)) : null,
      calculable: expense > 0,
    },
  };
  const manifest = [
    `Ringkasan ${period}`,
    "Posisi keuangan agregat",
    "Ketersediaan data",
    "Komitmen finansial agregat",
  ];
  const intent = contextIntent(question);

  if (intent.accounts) {
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
  if (intent.funds) {
    context.sinkingFunds = snapshot.sinkingFunds.slice(0, 20).map((fund) => ({
      name: fund.name,
      purpose: fund.purpose,
      targetAmount: fund.targetAmount,
      currentAmount: fund.currentAmount,
      monthlyContribution: fund.monthlyContribution,
      targetDate: fund.targetDate,
      accountId: fund.accountId,
    }));
    manifest.push("Pos dana aktif");
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
  const { apiKey, baseUrl, model } = await requireReadyAi(workspaceId);
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
  const answer = await callAi(apiKey, baseUrl, model, {
    systemInstruction: {
      parts: [{
        text: "Anda adalah Financial Insight, asisten keuangan read-only berbahasa Indonesia. Gunakan hanya data JSON yang diberikan, terutama financialPosition, dataAvailability, planningSummary, dan runway. Sebutkan periode dan data yang digunakan. Pisahkan fakta, perhitungan, dan saran umum. transactionCount atau expenseTransactionCount bernilai 0 berarti belum ada transaksi tercatat pada periode tersebut, bukan bukti bahwa kebutuhan hidup pengguna nol. Jika runway.calculable bernilai false, jangan mengarang durasi ketahanan dana; jelaskan data pengeluaran yang masih dibutuhkan. Jangan mengubah data, menjanjikan keuntungan, melakukan transaksi investasi, atau mengaku sebagai penasihat berlisensi. Harga investasi berstatus manual/delayed tidak boleh disebut real-time. Jika data tidak cukup, katakan dengan jelas. Jangan meminta PIN, OTP, CVV, password, atau nomor kartu lengkap.",
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

function parseAiJson(text: string) {
  const normalized = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  try {
    return JSON.parse(normalized) as unknown;
  } catch (error) {
    const start = normalized.indexOf("{");
    const end = normalized.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(normalized.slice(start, end + 1)) as unknown;
    throw error;
  }
}

export async function scanReceipt(
  workspaceId: string,
  input: { imageBase64: string; mimeType: string; fileName?: string },
): Promise<{ receipt: OcrReceipt; model: string; imageStored: false }> {
  await requireWorkspace(workspaceId);
  const { apiKey, baseUrl, model } = await requireReadyAi(workspaceId);
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
  const text = await callAi(apiKey, baseUrl, model, {
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
    parsed = parseAiJson(text);
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
