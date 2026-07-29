import { getD1 } from "@/db";
import {
  BACKUP_FORMAT,
  BACKUP_SCHEMA_VERSION,
  PORTABLE_COLLECTIONS,
  backupCounts,
  nextBackupAt,
  parsePortableBackup,
  totalBackupRecords,
  type BackupOverview,
  type BackupSchedule,
  type ExportRecord,
  type MigrationPreview,
  type PortableBackup,
  type PortableRecord,
} from "@/lib/portability";
import { INVESTMENT_UNIT_SCALE } from "@/lib/investment";
import { installmentDuration, normalizeInstallmentPhases } from "@/lib/installment-phases";
import { ApiError, makeId, nowIso } from "./api";
import { auditStatement } from "./audit";
import { getFilesBucket } from "./files";
import { requireWorkspace } from "./repository";

const MAX_PDF_BYTES = 8 * 1024 * 1024;
const MAX_BACKUP_BYTES = 12 * 1024 * 1024;
const VALID_FREQUENCIES = new Set<BackupSchedule["frequency"]>(["daily", "weekly", "monthly"]);

type ExportRow = {
  id: string;
  kind: ExportRecord["kind"];
  filename: string;
  contentType: string;
  sizeBytes: number;
  status: ExportRecord["status"];
  period: string | null;
  metadataJson: string;
  createdAt: string;
};

type MigrationRow = {
  id: string;
  sourceName: string;
  sourceSchemaVersion: string;
  status: MigrationPreview["status"];
  objectKey: string;
  countsJson: string;
  warningsJson: string;
  errorsJson: string;
  balanceDifference: number;
  createdAt: string;
  appliedAt: string | null;
};

const text = (row: PortableRecord, ...keys: string[]) => {
  const key = keys.find((candidate) => row[candidate] !== undefined && row[candidate] !== null);
  return key ? String(row[key]).trim() : "";
};
const integer = (row: PortableRecord, keys: string[], fallback = 0) => {
  const key = keys.find((candidate) => row[candidate] !== undefined && row[candidate] !== null && row[candidate] !== "");
  const value = key ? Number(row[key]) : fallback;
  return Number.isSafeInteger(value) ? value : fallback;
};
const numeric = (row: PortableRecord, keys: string[], fallback = 0) => {
  const key = keys.find((candidate) => row[candidate] !== undefined && row[candidate] !== null && row[candidate] !== "");
  const value = key ? Number(row[key]) : fallback;
  return Number.isFinite(value) ? value : fallback;
};
const bool = (row: PortableRecord, ...keys: string[]) => {
  const key = keys.find((candidate) => row[candidate] !== undefined);
  const value = key ? row[key] : false;
  return value === true || value === 1 || String(value).toLowerCase() === "true";
};
const validDate = (value: string, fallback: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : fallback;
const json = <T>(value: string, fallback: T): T => {
  try { return JSON.parse(value) as T; } catch { return fallback; }
};
const safeName = (value: string, fallback: string, max = 160) => value.replace(/[\r\n\t]/g, " ").trim().slice(0, max) || fallback;
const safeObjectKeyPart = (value: string) => value.replace(/[^A-Za-z0-9._-]+/g, "-").slice(0, 100);

function exportRecord(row: ExportRow): ExportRecord {
  return {
    id: row.id,
    kind: row.kind,
    filename: row.filename,
    contentType: row.contentType,
    sizeBytes: row.sizeBytes,
    status: row.status,
    ...(row.period ? { period: row.period } : {}),
    createdAt: row.createdAt,
    downloadUrl: `/api/finance/exports/${encodeURIComponent(row.id)}/download`,
    metadata: json(row.metadataJson, {}),
  };
}

function migrationRecord(row: MigrationRow): MigrationPreview {
  const counts = json(row.countsJson, Object.fromEntries(PORTABLE_COLLECTIONS.map((key) => [key, 0])) as MigrationPreview["counts"]);
  const warnings = json<string[]>(row.warningsJson, []);
  const errors = json<string[]>(row.errorsJson, []);
  return {
    id: row.id,
    sourceName: row.sourceName,
    sourceSchemaVersion: row.sourceSchemaVersion,
    status: row.status,
    counts,
    totalRecords: Object.values(counts).reduce((sum, value) => sum + Number(value || 0), 0),
    warnings,
    errors,
    balanceDifference: row.balanceDifference,
    createdAt: row.createdAt,
    appliedAt: row.appliedAt,
    canApply: row.status === "preview" && errors.length === 0 && row.balanceDifference === 0,
    ...(row.status === "applied" ? { reportDownloadUrl: `/api/finance/migrations/${encodeURIComponent(row.id)}/report` } : {}),
  };
}

async function storeExport(
  workspaceId: string,
  kind: ExportRecord["kind"],
  filename: string,
  contentType: string,
  bytes: Uint8Array,
  metadata: Record<string, unknown> = {},
  period?: string,
) {
  const d1 = getD1();
  const bucket = getFilesBucket();
  const id = makeId(kind === "backup" ? "backup" : kind === "report" ? "report" : "migration-report");
  const createdAt = nowIso();
  const objectKey = `${workspaceId}/${kind}/${createdAt.slice(0, 10)}/${id}-${safeObjectKeyPart(filename)}`;
  await bucket.put(objectKey, bytes, {
    httpMetadata: { contentType },
    customMetadata: { workspaceId, exportId: id, kind },
  });
  try {
    await d1.batch([
      d1.prepare(
        `INSERT INTO data_exports
           (id, workspace_id, kind, filename, content_type, object_key, size_bytes, status, period, metadata_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'ready', ?, ?, ?)`,
      ).bind(id, workspaceId, kind, filename, contentType, objectKey, bytes.byteLength, period ?? null, JSON.stringify(metadata), createdAt),
      auditStatement(d1, {
        workspaceId,
        action: `${kind}.create`,
        entityType: kind,
        entityId: id,
        details: { filename, sizeBytes: bytes.byteLength, period: period ?? null },
        createdAt,
      }),
    ]);
  } catch (error) {
    await bucket.delete(objectKey);
    throw error;
  }
  return exportRecord({ id, kind, filename, contentType, sizeBytes: bytes.byteLength, status: "ready", period: period ?? null, metadataJson: JSON.stringify(metadata), createdAt });
}

async function fullBackupDocument(workspaceId: string): Promise<PortableBackup> {
  const workspace = await requireWorkspace(workspaceId);
  const d1 = getD1();
  const results = await d1.batch([
    d1.prepare(`SELECT id, name, type, institution, balance, opening_balance AS openingBalance, mask, color, liability, active, created_at AS createdAt, updated_at AS updatedAt FROM accounts WHERE workspace_id = ? ORDER BY created_at, id`).bind(workspaceId),
    d1.prepare(`SELECT id, name, type, color, icon, archived, is_default AS isDefault, created_at AS createdAt, updated_at AS updatedAt FROM categories WHERE workspace_id = ? ORDER BY type, name, id`).bind(workspaceId),
    d1.prepare(`SELECT id, type, date, time, title, merchant, category, notes, tags_json AS tagsJson, location, splits_json AS splitsJson, account_id AS accountId, destination_account_id AS destinationAccountId, transfer_group_id AS transferGroupId, amount, status, idempotency_key AS idempotencyKey, deleted_at AS deletedAt, created_at AS createdAt, updated_at AS updatedAt FROM transactions WHERE workspace_id = ? ORDER BY date, created_at, id`).bind(workspaceId),
    d1.prepare(`SELECT id, category, amount_limit AS amountLimit, period, color, created_at AS createdAt, updated_at AS updatedAt FROM budgets WHERE workspace_id = ? ORDER BY period, category, id`).bind(workspaceId),
    d1.prepare(`SELECT id, name, target, current, deadline, color, icon, created_at AS createdAt, updated_at AS updatedAt FROM goals WHERE workspace_id = ? ORDER BY deadline, id`).bind(workspaceId),
    d1.prepare(`SELECT id, name, amount, due_date AS dueDate, category, account_id AS accountId, frequency, reminder_days AS reminderDays, paid, paid_at AS paidAt, last_paid_period AS lastPaidPeriod, liability_account_id AS liabilityAccountId, duration_months AS durationMonths, paid_count AS paidCount, current_period_paid AS currentPeriodPaid, total_paid AS totalPaid, installment_phases_json AS installmentPhasesJson, completed, created_at AS createdAt, updated_at AS updatedAt FROM bills WHERE workspace_id = ? ORDER BY due_date, id`).bind(workspaceId),
    d1.prepare(`SELECT id, account_id AS accountId, ticker, name, asset_class AS assetClass, exchange, currency, manual_price AS manualPrice, latest_price_cache AS latestPriceCache, price_source AS priceSource, price_status AS priceStatus, price_updated_at AS priceUpdatedAt, active, created_at AS createdAt, updated_at AS updatedAt FROM investment_assets WHERE workspace_id = ? ORDER BY name, id`).bind(workspaceId),
    d1.prepare(`SELECT asset_id AS assetId, units_micro AS unitsMicro, cost_basis AS costBasis, realized_pl AS realizedPl, updated_at AS updatedAt FROM investment_positions WHERE workspace_id = ? ORDER BY asset_id`).bind(workspaceId),
    d1.prepare(`SELECT id, asset_id AS assetId, account_id AS accountId, date, type, units_micro AS unitsMicro, price_per_unit AS pricePerUnit, gross_amount AS grossAmount, fee, tax, net_amount AS netAmount, average_cost_after AS averageCostAfter, remaining_units_micro AS remainingUnitsMicro, realized_pl AS realizedPl, linked_cash_transaction_id AS linkedCashTransactionId, linked_adjustment_transaction_id AS linkedAdjustmentTransactionId, note, created_at AS createdAt, updated_at AS updatedAt FROM investment_transactions WHERE workspace_id = ? ORDER BY date, created_at, id`).bind(workspaceId),
    d1.prepare(`SELECT provider, model, enabled, consent_accepted AS consentAccepted FROM ai_settings WHERE workspace_id = ? LIMIT 1`).bind(workspaceId),
    d1.prepare(`SELECT enabled, bill_reminder_days AS billReminderDays, budget_warning_percent AS budgetWarningPercent, backup_warning_days AS backupWarningDays, goal_warning_days AS goalWarningDays, email_enabled AS emailEnabled, email_address AS emailAddress, weekly_digest AS weeklyDigest FROM notification_settings WHERE workspace_id = ? LIMIT 1`).bind(workspaceId),
    d1.prepare(`SELECT horizon_months AS horizonMonths, income_adjustment_pct AS incomeAdjustmentPct, expense_adjustment_pct AS expenseAdjustmentPct, annual_investment_return_pct AS annualInvestmentReturnPct, annual_inflation_pct AS annualInflationPct, monthly_investment AS monthlyInvestment FROM roadmap_settings WHERE workspace_id = ? LIMIT 1`).bind(workspaceId),
    d1.prepare(`SELECT strategy, extra_monthly_payment AS extraMonthlyPayment FROM debt_payoff_settings WHERE workspace_id = ? LIMIT 1`).bind(workspaceId),
    d1.prepare(`SELECT account_id AS accountId, annual_rate_bps AS annualRateBps, minimum_payment AS minimumPayment, due_day AS dueDay FROM debt_accounts WHERE workspace_id = ? ORDER BY account_id`).bind(workspaceId),
    d1.prepare(`SELECT horizon_days AS horizonDays, monthly_income_override AS monthlyIncomeOverride, income_day AS incomeDay, minimum_cash_buffer AS minimumCashBuffer FROM cashflow_forecast_settings WHERE workspace_id = ? LIMIT 1`).bind(workspaceId),
    d1.prepare(`SELECT target_months AS targetMonths, monthly_expense_override AS monthlyExpenseOverride, monthly_contribution AS monthlyContribution, account_ids_json AS accountIdsJson FROM emergency_fund_settings WHERE workspace_id = ? LIMIT 1`).bind(workspaceId),
    d1.prepare(`SELECT id, name, type, amount, category, account_id AS accountId, frequency, start_date AS startDate, next_due_date AS nextDueDate, is_subscription AS isSubscription, active, last_posted_date AS lastPostedDate, created_at AS createdAt, updated_at AS updatedAt FROM recurring_templates WHERE workspace_id = ? ORDER BY next_due_date, id`).bind(workspaceId),
    d1.prepare(`SELECT id, keyword, category, transaction_type AS transactionType, match_type AS matchType, priority, active, created_at AS createdAt, updated_at AS updatedAt FROM category_rules WHERE workspace_id = ? ORDER BY priority DESC, keyword, id`).bind(workspaceId),
    d1.prepare(`SELECT id, name, purpose, target_amount AS targetAmount, current_amount AS currentAmount, monthly_contribution AS monthlyContribution, target_date AS targetDate, account_id AS accountId, color, active, created_at AS createdAt, updated_at AS updatedAt FROM sinking_funds WHERE workspace_id = ? ORDER BY target_date, id`).bind(workspaceId),
    d1.prepare(`SELECT id, fund_id AS fundId, type, amount, date, note, created_at AS createdAt FROM sinking_fund_entries WHERE workspace_id = ? ORDER BY date, created_at, id`).bind(workspaceId),
  ]);
  const ai = results[9].results[0] as Record<string, unknown> | undefined;
  const notification = results[10].results[0] as Record<string, unknown> | undefined;
  const roadmap = results[11].results[0] as Record<string, unknown> | undefined;
  const debtSettings = results[12].results[0] as Record<string, unknown> | undefined;
  const debtPlans = results[13].results as Record<string, unknown>[];
  const forecast = results[14].results[0] as Record<string, unknown> | undefined;
  const emergency = results[15].results[0] as Record<string, unknown> | undefined;
  const categoryRules = results[17].results as Record<string, unknown>[];
  return {
    format: BACKUP_FORMAT,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    createdAt: nowIso(),
    source: { app: "Financial Planner", backend: "Cloud database", workspaceId },
    profile: {
      name: workspace.name,
      storeName: workspace.storeName,
      currency: workspace.currency,
      timezone: workspace.timezone,
    },
    settings: {
      ...(ai ? {
        aiEnabled: Boolean(ai.enabled),
        aiConsentAccepted: Boolean(ai.consentAccepted),
        aiProvider: String(ai.provider ?? "openai-compatible"),
        aiModel: String(ai.model ?? ""),
      } : {}),
      ...(notification ? {
        notificationEnabled: Boolean(notification.enabled),
        notificationBillReminderDays: json<number[]>(String(notification.billReminderDays ?? "[7,3,1,0]"), [7, 3, 1, 0]),
        notificationBudgetWarningPercent: Number(notification.budgetWarningPercent),
        notificationBackupWarningDays: Number(notification.backupWarningDays),
        notificationGoalWarningDays: Number(notification.goalWarningDays),
        notificationEmailEnabled: Boolean(notification.emailEnabled),
        notificationEmailAddress: String(notification.emailAddress ?? ""),
        notificationWeeklyDigest: Boolean(notification.weeklyDigest),
      } : {}),
      ...(roadmap ? {
        roadmapHorizonMonths: Number(roadmap.horizonMonths),
        roadmapIncomeAdjustmentPct: Number(roadmap.incomeAdjustmentPct),
        roadmapExpenseAdjustmentPct: Number(roadmap.expenseAdjustmentPct),
        roadmapAnnualInvestmentReturnPct: Number(roadmap.annualInvestmentReturnPct),
        roadmapAnnualInflationPct: Number(roadmap.annualInflationPct),
        roadmapMonthlyInvestment: Number(roadmap.monthlyInvestment),
      } : {}),
      ...(debtSettings || debtPlans.length ? {
        debtStrategy: debtSettings?.strategy === "snowball" ? "snowball" as const : "avalanche" as const,
        debtExtraMonthlyPayment: Number(debtSettings?.extraMonthlyPayment || 0),
        debtPlans: debtPlans.map((plan) => ({
          accountId: String(plan.accountId), annualInterestRatePct: Number(plan.annualRateBps || 0) / 100,
          minimumPayment: Number(plan.minimumPayment || 0), dueDay: Number(plan.dueDay || 1),
        })),
      } : {}),
      ...(forecast ? {
        forecastHorizonDays: Number(forecast.horizonDays) as 30 | 60 | 90,
        forecastMonthlyIncomeOverride: Number(forecast.monthlyIncomeOverride || 0),
        forecastIncomeDay: Number(forecast.incomeDay || 25),
        forecastMinimumCashBuffer: Number(forecast.minimumCashBuffer || 0),
      } : {}),
      ...(emergency ? {
        emergencyTargetMonths: Number(emergency.targetMonths) as 3 | 6 | 9 | 12,
        emergencyMonthlyExpenseOverride: Number(emergency.monthlyExpenseOverride || 0),
        emergencyMonthlyContribution: Number(emergency.monthlyContribution || 0),
        emergencyAccountIds: json<string[]>(String(emergency.accountIdsJson || "[]"), []),
      } : {}),
      ...(categoryRules.length ? {
        categoryRules: categoryRules.map((rule) => ({ ...rule, active: Boolean(rule.active) })) as NonNullable<PortableBackup["settings"]["categoryRules"]>,
      } : {}),
    },
    data: {
      accounts: results[0].results as PortableRecord[],
      categories: results[1].results as PortableRecord[],
      transactions: results[2].results as PortableRecord[],
      budgets: results[3].results as PortableRecord[],
      goals: results[4].results as PortableRecord[],
      bills: results[5].results as PortableRecord[],
      investmentAssets: results[6].results as PortableRecord[],
      investmentPositions: results[7].results as PortableRecord[],
      investmentTransactions: results[8].results as PortableRecord[],
      recurringTemplates: results[16].results as PortableRecord[],
      sinkingFunds: results[18].results as PortableRecord[],
      sinkingFundEntries: results[19].results as PortableRecord[],
    },
  };
}

export async function createBackup(workspaceId: string, reason = "manual") {
  const backup = await fullBackupDocument(workspaceId);
  const filename = `Financial-Planner_Backup_${backup.createdAt.replace(/[:.]/g, "-")}.json`;
  const bytes = new TextEncoder().encode(JSON.stringify(backup, null, 2));
  if (bytes.byteLength > MAX_BACKUP_BYTES) throw new ApiError(413, "BACKUP_TOO_LARGE", "Backup melebihi batas 12 MB. Gunakan ekspor per modul.");
  const record = await storeExport(workspaceId, "backup", filename, "application/json", bytes, { reason, schemaVersion: backup.schemaVersion, counts: backupCounts(backup.data) });
  const d1 = getD1();
  const setting = await d1.prepare(`SELECT enabled, frequency FROM backup_settings WHERE workspace_id = ? LIMIT 1`).bind(workspaceId).first<{ enabled: number; frequency: BackupSchedule["frequency"] }>();
  const completedAt = nowIso();
  await d1.prepare(
    `INSERT INTO backup_settings (workspace_id, enabled, frequency, last_backup_at, next_backup_at, created_at, updated_at)
     VALUES (?, 0, 'weekly', ?, NULL, ?, ?)
     ON CONFLICT(workspace_id) DO UPDATE SET last_backup_at = excluded.last_backup_at,
       next_backup_at = CASE WHEN backup_settings.enabled = 1 THEN ? ELSE backup_settings.next_backup_at END,
       updated_at = excluded.updated_at`,
  ).bind(workspaceId, completedAt, completedAt, completedAt, setting?.enabled ? nextBackupAt(completedAt, setting.frequency) : null).run();
  return record;
}

export async function listExports(workspaceId: string, kind?: ExportRecord["kind"]) {
  await requireWorkspace(workspaceId);
  const statement = kind
    ? getD1().prepare(`SELECT id, kind, filename, content_type AS contentType, size_bytes AS sizeBytes, status, period, metadata_json AS metadataJson, created_at AS createdAt FROM data_exports WHERE workspace_id = ? AND kind = ? ORDER BY created_at DESC LIMIT 30`).bind(workspaceId, kind)
    : getD1().prepare(`SELECT id, kind, filename, content_type AS contentType, size_bytes AS sizeBytes, status, period, metadata_json AS metadataJson, created_at AS createdAt FROM data_exports WHERE workspace_id = ? ORDER BY created_at DESC LIMIT 50`).bind(workspaceId);
  const result = await statement.all<ExportRow>();
  return result.results.map(exportRecord);
}

export async function downloadExport(workspaceId: string, exportId: string) {
  await requireWorkspace(workspaceId);
  const row = await getD1().prepare(`SELECT filename, content_type AS contentType, object_key AS objectKey FROM data_exports WHERE workspace_id = ? AND id = ? AND status = 'ready' LIMIT 1`).bind(workspaceId, exportId).first<{ filename: string; contentType: string; objectKey: string }>();
  if (!row) throw new ApiError(404, "EXPORT_NOT_FOUND", "File ekspor tidak ditemukan.");
  const stored = await getFilesBucket().get(row.objectKey);
  if (!stored) throw new ApiError(404, "EXPORT_FILE_MISSING", "File ekspor tidak tersedia di storage.");
  return new Response(stored.body ?? await stored.arrayBuffer(), {
    headers: {
      "content-type": row.contentType,
      "content-disposition": `attachment; filename="${safeName(row.filename, "financial-planner-export").replaceAll('"', "")}"`,
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

export async function saveReport(
  workspaceId: string,
  input: { filename: string; contentBase64: string; period: string; sections: string[]; privacy: boolean; pageCount: number },
) {
  await requireWorkspace(workspaceId);
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(input.period)) throw new ApiError(400, "INVALID_PERIOD", "Periode laporan tidak valid.");
  if (!Array.isArray(input.sections) || !input.sections.length) throw new ApiError(400, "INVALID_REPORT", "Pilih minimal satu bagian laporan.");
  let binary: string;
  try { binary = atob(input.contentBase64); } catch { throw new ApiError(400, "INVALID_PDF", "Isi PDF tidak valid."); }
  if (!binary.startsWith("%PDF-")) throw new ApiError(400, "INVALID_PDF", "File laporan bukan PDF yang valid.");
  if (binary.length > MAX_PDF_BYTES) throw new ApiError(413, "PDF_TOO_LARGE", "Ukuran PDF melebihi batas 8 MB.");
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  const filename = safeName(input.filename, `Financial-Planner_Laporan_${input.period}.pdf`, 160).replace(/[^A-Za-z0-9._-]/g, "-");
  return storeExport(workspaceId, "report", filename.endsWith(".pdf") ? filename : `${filename}.pdf`, "application/pdf", bytes, { sections: input.sections, privacy: input.privacy, pageCount: Math.max(1, Math.min(100, Math.round(input.pageCount || 1))) }, input.period);
}

async function backupSetting(workspaceId: string) {
  const d1 = getD1();
  let row = await d1.prepare(`SELECT enabled, frequency, last_backup_at AS lastBackupAt, next_backup_at AS nextBackupAt FROM backup_settings WHERE workspace_id = ? LIMIT 1`).bind(workspaceId).first<{ enabled: number; frequency: BackupSchedule["frequency"]; lastBackupAt: string | null; nextBackupAt: string | null }>();
  if (!row) {
    const now = nowIso();
    await d1.prepare(`INSERT INTO backup_settings (workspace_id, enabled, frequency, created_at, updated_at) VALUES (?, 0, 'weekly', ?, ?)`).bind(workspaceId, now, now).run();
    row = { enabled: 0, frequency: "weekly", lastBackupAt: null, nextBackupAt: null };
  }
  return row;
}

export async function getBackupOverview(workspaceId: string): Promise<BackupOverview> {
  await requireWorkspace(workspaceId);
  let setting = await backupSetting(workspaceId);
  if (setting.enabled && setting.nextBackupAt && new Date(setting.nextBackupAt).getTime() <= Date.now()) {
    await createBackup(workspaceId, "scheduled_on_access");
    setting = await backupSetting(workspaceId);
  }
  return {
    schedule: {
      enabled: Boolean(setting.enabled),
      frequency: setting.frequency,
      lastBackupAt: setting.lastBackupAt,
      nextBackupAt: setting.nextBackupAt,
      mode: "on_access",
    },
    backups: await listExports(workspaceId, "backup"),
  };
}

export async function updateBackupSchedule(workspaceId: string, enabled: boolean, frequency: BackupSchedule["frequency"]) {
  await requireWorkspace(workspaceId);
  if (!VALID_FREQUENCIES.has(frequency)) throw new ApiError(400, "INVALID_FREQUENCY", "Frekuensi backup tidak valid.");
  const d1 = getD1();
  const now = nowIso();
  const next = enabled ? nextBackupAt(now, frequency) : null;
  await d1.batch([
    d1.prepare(
      `INSERT INTO backup_settings (workspace_id, enabled, frequency, next_backup_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(workspace_id) DO UPDATE SET enabled = excluded.enabled, frequency = excluded.frequency,
         next_backup_at = excluded.next_backup_at, updated_at = excluded.updated_at`,
    ).bind(workspaceId, enabled ? 1 : 0, frequency, next, now, now),
    auditStatement(d1, { workspaceId, action: "backup.schedule.update", entityType: "backup_settings", entityId: workspaceId, details: { enabled, frequency, nextBackupAt: next }, createdAt: now }),
  ]);
  return getBackupOverview(workspaceId);
}

function reconciliationDifference(backup: PortableBackup) {
  const accounts = new Map<string, { current: number; expected: number; liability: boolean; canCheck: boolean }>();
  backup.data.accounts.forEach((row) => {
    const id = text(row, "id");
    if (!id) return;
    const hasOpening = row.openingBalance !== undefined || row.opening_balance !== undefined;
    accounts.set(id, {
      current: integer(row, ["balance", "currentBalance", "current_balance"], 0),
      expected: integer(row, ["openingBalance", "opening_balance"], 0),
      liability: bool(row, "liability", "isLiability", "is_liability"),
      canCheck: hasOpening,
    });
  });
  if ([...accounts.values()].some((account) => !account.canCheck)) return { difference: 0, skipped: true };
  backup.data.transactions.forEach((row) => {
    if (text(row, "deletedAt", "deleted_at") || text(row, "status") === "pending") return;
    const source = accounts.get(text(row, "accountId", "account_id"));
    if (!source) return;
    const amount = integer(row, ["amount"], 0);
    const type = text(row, "type");
    if (["income", "adjustment_in", "refund"].includes(type)) source.expected += source.liability ? -amount : amount;
    else if (["expense", "adjustment_out"].includes(type)) source.expected += source.liability ? amount : -amount;
    else if (type === "transfer") {
      source.expected += source.liability ? amount : -amount;
      const target = accounts.get(text(row, "destinationAccountId", "destination_account_id"));
      if (target) target.expected += target.liability ? -amount : amount;
    }
  });
  return { difference: [...accounts.values()].reduce((sum, account) => sum + Math.abs(account.current - account.expected), 0), skipped: false };
}

export async function previewMigration(workspaceId: string, sourceName: string, sourceValue: unknown, requestId: string) {
  await requireWorkspace(workspaceId);
  const parsed = parsePortableBackup(sourceValue);
  const reconciliation = reconciliationDifference(parsed.backup);
  const warnings = [...parsed.warnings];
  const errors = [...parsed.errors];
  if (reconciliation.skipped) warnings.push("Saldo tidak dapat direkonsiliasi penuh karena saldo awal tidak tersedia pada file lama.");
  if (reconciliation.difference !== 0) errors.push(`Rekonsiliasi sumber memiliki selisih ${reconciliation.difference} Rupiah. Perbaiki file sebelum migrasi.`);

  const existingAssets = await getD1().prepare(`SELECT lower(ticker) AS ticker, lower(exchange) AS exchange FROM investment_assets WHERE workspace_id = ?`).bind(workspaceId).all<{ ticker: string; exchange: string }>();
  const assetKeys = new Set(existingAssets.results.map((asset) => `${asset.ticker}|${asset.exchange}`));
  parsed.backup.data.investmentAssets.forEach((row) => {
    const key = `${text(row, "ticker").toLowerCase()}|${text(row, "exchange").toLowerCase()}`;
    if (key !== "|" && assetKeys.has(key)) errors.push(`Aset ${text(row, "ticker") || "tanpa ticker"} sudah ada di target; gabungkan secara manual sebelum migrasi.`);
  });

  const bucket = getFilesBucket();
  const d1 = getD1();
  const id = makeId("migration");
  const createdAt = nowIso();
  const filename = safeName(sourceName, "backup.json", 140);
  const objectKey = `${workspaceId}/migration/${createdAt.slice(0, 10)}/${id}-${safeObjectKeyPart(filename)}`;
  const bytes = new TextEncoder().encode(JSON.stringify(parsed.backup));
  if (bytes.byteLength > MAX_BACKUP_BYTES) throw new ApiError(413, "MIGRATION_TOO_LARGE", "File migrasi melebihi batas 12 MB.");
  await bucket.put(objectKey, bytes, { httpMetadata: { contentType: "application/json" }, customMetadata: { workspaceId, migrationId: id } });
  try {
    await d1.batch([
      d1.prepare(
        `INSERT INTO migration_jobs
           (id, workspace_id, source_name, source_schema_version, status, object_key, counts_json, warnings_json, errors_json, balance_difference, request_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'preview', ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(id, workspaceId, filename, parsed.backup.schemaVersion, objectKey, JSON.stringify(backupCounts(parsed.backup.data)), JSON.stringify([...new Set(warnings)]), JSON.stringify([...new Set(errors)]), reconciliation.difference, requestId, createdAt, createdAt),
      auditStatement(d1, { workspaceId, action: "migration.preview", entityType: "migration", entityId: id, requestId, details: { sourceName: filename, schemaVersion: parsed.backup.schemaVersion, counts: backupCounts(parsed.backup.data), warningCount: warnings.length, errorCount: errors.length, balanceDifference: reconciliation.difference }, createdAt }),
    ]);
  } catch (error) {
    await bucket.delete(objectKey);
    throw error;
  }
  const row = await migrationRowById(workspaceId, id);
  if (!row) throw new ApiError(500, "MIGRATION_PREVIEW_MISSING", "Preview migrasi tidak dapat dibuat.");
  return migrationRecord(row);
}

async function migrationRowById(workspaceId: string, id: string) {
  return getD1().prepare(
    `SELECT id, source_name AS sourceName, source_schema_version AS sourceSchemaVersion, status,
            object_key AS objectKey, counts_json AS countsJson, warnings_json AS warningsJson,
            errors_json AS errorsJson, balance_difference AS balanceDifference,
            created_at AS createdAt, applied_at AS appliedAt
     FROM migration_jobs WHERE workspace_id = ? AND id = ? LIMIT 1`,
  ).bind(workspaceId, id).first<MigrationRow>();
}

export async function listMigrations(workspaceId: string) {
  await requireWorkspace(workspaceId);
  const rows = await getD1().prepare(
    `SELECT id, source_name AS sourceName, source_schema_version AS sourceSchemaVersion, status,
            object_key AS objectKey, counts_json AS countsJson, warnings_json AS warningsJson,
            errors_json AS errorsJson, balance_difference AS balanceDifference,
            created_at AS createdAt, applied_at AS appliedAt
     FROM migration_jobs WHERE workspace_id = ? ORDER BY created_at DESC LIMIT 20`,
  ).bind(workspaceId).all<MigrationRow>();
  return rows.results.map(migrationRecord);
}

function mappedIds(rows: PortableRecord[], prefix: string) {
  const map = new Map<string, string>();
  rows.forEach((row, index) => map.set(text(row, "id") || `missing-${index}`, makeId(prefix)));
  return map;
}

async function runChunks(statements: D1PreparedStatement[], size = 60) {
  const d1 = getD1();
  for (let index = 0; index < statements.length; index += size) await d1.batch(statements.slice(index, index + size));
}

export async function applyMigration(workspaceId: string, migrationId: string) {
  await requireWorkspace(workspaceId);
  const job = await migrationRowById(workspaceId, migrationId);
  if (!job) throw new ApiError(404, "MIGRATION_NOT_FOUND", "Preview migrasi tidak ditemukan.");
  if (job.status === "applied") return migrationRecord(job);
  if (job.status !== "preview") throw new ApiError(409, "MIGRATION_NOT_READY", "Migrasi tidak berada pada status preview.");
  const errors = json<string[]>(job.errorsJson, []);
  if (errors.length || job.balanceDifference !== 0) throw new ApiError(409, "MIGRATION_VALIDATION_FAILED", "Migrasi belum lolos validasi.", { errors, balanceDifference: job.balanceDifference });

  const stored = await getFilesBucket().get(job.objectKey);
  if (!stored) throw new ApiError(404, "MIGRATION_SOURCE_MISSING", "File sumber migrasi tidak ditemukan.");
  const parsed = parsePortableBackup(JSON.parse(new TextDecoder().decode(await stored.arrayBuffer())));
  if (parsed.errors.length) throw new ApiError(409, "MIGRATION_SOURCE_INVALID", "File sumber berubah atau tidak valid.", { errors: parsed.errors });

  await createBackup(workspaceId, `pre_migration:${migrationId}`);
  const backup = parsed.backup;
  const now = nowIso();
  const accountIds = mappedIds(backup.data.accounts, "mig-account");
  const categoryIds = mappedIds(backup.data.categories, "mig-category");
  const transactionIds = mappedIds(backup.data.transactions, "mig-tx");
  const budgetIds = mappedIds(backup.data.budgets, "mig-budget");
  const goalIds = mappedIds(backup.data.goals, "mig-goal");
  const sinkingFundIds = mappedIds(backup.data.sinkingFunds, "mig-fund");
  const sinkingFundEntryIds = mappedIds(backup.data.sinkingFundEntries, "mig-fund-entry");
  const billIds = mappedIds(backup.data.bills, "mig-bill");
  const recurringIds = mappedIds(backup.data.recurringTemplates, "mig-recurring");
  const assetIds = mappedIds(backup.data.investmentAssets, "mig-asset");
  const investmentTransactionIds = mappedIds(backup.data.investmentTransactions, "mig-investment-tx");
  const transferGroups = new Map<string, string>();
  const d1 = getD1();
  const statements: D1PreparedStatement[] = [];

  backup.data.accounts.forEach((row, index) => {
    const oldId = text(row, "id") || `missing-${index}`;
    const opening = Math.max(0, integer(row, ["openingBalance", "opening_balance"], integer(row, ["balance", "currentBalance", "current_balance"], 0)));
    const balance = Math.max(0, integer(row, ["balance", "currentBalance", "current_balance"], opening));
    const allowedTypes = new Set(["Bank", "E-Wallet", "Cash", "Investment", "Credit Card", "Paylater", "Loan", "Mortgage"]);
    const type = allowedTypes.has(text(row, "type")) ? text(row, "type") : "Bank";
    statements.push(d1.prepare(
      `INSERT INTO accounts (id, workspace_id, name, type, institution, balance, opening_balance, mask, color, liability, active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(accountIds.get(oldId), workspaceId, safeName(text(row, "name"), `Akun migrasi ${index + 1}`, 100), type, safeName(text(row, "institution"), "", 100), balance, opening, safeName(text(row, "mask"), "", 40), /^#[0-9a-fA-F]{6}$/.test(text(row, "color")) ? text(row, "color") : "#16876f", bool(row, "liability", "isLiability", "is_liability") ? 1 : 0, bool(row, "active", "isActive", "is_active") || row.active === undefined ? 1 : 0, now, now));
  });

  backup.data.categories.forEach((row, index) => {
    const oldId = text(row, "id") || `missing-${index}`;
    const type = ["income", "expense", "transfer", "investment", "system"].includes(text(row, "type")) ? text(row, "type") : "expense";
    statements.push(d1.prepare(
      `INSERT INTO categories (id, workspace_id, name, type, color, icon, archived, is_default, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
       ON CONFLICT DO NOTHING`,
    ).bind(categoryIds.get(oldId), workspaceId, safeName(text(row, "name"), `Kategori migrasi ${index + 1}`, 100), type, /^#[0-9a-fA-F]{6}$/.test(text(row, "color")) ? text(row, "color") : "#16876f", safeName(text(row, "icon"), "circle-dollar-sign", 60), bool(row, "archived") || (row.active !== undefined && !bool(row, "active")) ? 1 : 0, now, now));
  });

  backup.data.transactions.forEach((row, index) => {
    const oldId = text(row, "id") || `missing-${index}`;
    const oldAccount = text(row, "accountId", "account_id");
    const oldDestination = text(row, "destinationAccountId", "destination_account_id");
    const rawGroup = text(row, "transferGroupId", "transfer_group_id");
    if (rawGroup && !transferGroups.has(rawGroup)) transferGroups.set(rawGroup, makeId("mig-transfer"));
    const allowedTypes = ["income", "expense", "transfer", "refund", "investment_buy", "adjustment_in", "adjustment_out"];
    const type = allowedTypes.includes(text(row, "type")) ? text(row, "type") : "expense";
    const date = validDate(text(row, "date"), now.slice(0, 10));
    const amount = Math.max(1, integer(row, ["amount"], 1));
    statements.push(d1.prepare(
      `INSERT INTO transactions
         (id, workspace_id, type, date, time, title, merchant, category, notes, tags_json, location, splits_json, account_id, destination_account_id, transfer_group_id, amount, status, idempotency_key, deleted_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(transactionIds.get(oldId), workspaceId, type, date, safeName(text(row, "time"), "", 5), safeName(text(row, "title", "description", "merchant"), "Transaksi migrasi", 160), safeName(text(row, "merchant"), "", 120) || null, safeName(text(row, "category"), "Lainnya", 100), safeName(text(row, "notes"), "", 1000), Array.isArray(row.tags) ? JSON.stringify(row.tags) : text(row, "tagsJson", "tags_json") || "[]", safeName(text(row, "location"), "", 160), Array.isArray(row.splits) ? JSON.stringify(row.splits) : text(row, "splitsJson", "splits_json") || "[]", accountIds.get(oldAccount), oldDestination ? accountIds.get(oldDestination) ?? null : null, rawGroup ? transferGroups.get(rawGroup) : null, amount, text(row, "status") === "pending" ? "pending" : "completed", `migration:${migrationId}:${oldId}`, text(row, "deletedAt", "deleted_at") || null, now, now));
  });

  backup.data.budgets.forEach((row, index) => {
    const oldId = text(row, "id") || `missing-${index}`;
    const period = /^\d{4}-(0[1-9]|1[0-2])$/.test(text(row, "period", "month")) ? text(row, "period", "month") : now.slice(0, 7);
    statements.push(d1.prepare(`INSERT INTO budgets (id, workspace_id, category, amount_limit, period, color, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT DO NOTHING`).bind(budgetIds.get(oldId), workspaceId, safeName(text(row, "category"), "Lainnya", 100), Math.max(1, integer(row, ["amountLimit", "amount_limit", "limit", "limitAmount", "limit_amount"], 1)), period, /^#[0-9a-fA-F]{6}$/.test(text(row, "color")) ? text(row, "color") : "#16876f", now, now));
  });

  backup.data.goals.forEach((row, index) => {
    const oldId = text(row, "id") || `missing-${index}`;
    const target = Math.max(1, integer(row, ["target", "targetAmount", "target_amount"], 1));
    statements.push(d1.prepare(`INSERT INTO goals (id, workspace_id, name, target, current, deadline, color, icon, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(goalIds.get(oldId), workspaceId, safeName(text(row, "name"), `Target migrasi ${index + 1}`, 100), target, Math.max(0, integer(row, ["current", "currentAmount", "current_amount"], 0)), validDate(text(row, "deadline"), now.slice(0, 10)), /^#[0-9a-fA-F]{6}$/.test(text(row, "color")) ? text(row, "color") : "#16876f", safeName(text(row, "icon"), "target", 60), now, now));
  });

  backup.data.sinkingFunds.forEach((row, index) => {
    const oldId = text(row, "id") || `missing-${index}`;
    const oldAccount = text(row, "accountId", "account_id");
    const target = Math.max(1, integer(row, ["targetAmount", "target_amount"], 1));
    const current = Math.max(0, Math.min(target, integer(row, ["currentAmount", "current_amount"], 0)));
    const purposes = ["Kendaraan", "Pajak", "Liburan", "Pendidikan", "Rumah", "Kesehatan", "Teknologi", "Lainnya"];
    const purpose = purposes.includes(text(row, "purpose")) ? text(row, "purpose") : "Lainnya";
    statements.push(d1.prepare(
      `INSERT INTO sinking_funds
        (id, workspace_id, name, purpose, target_amount, current_amount,
         monthly_contribution, target_date, account_id, color, active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      sinkingFundIds.get(oldId), workspaceId, safeName(text(row, "name"), `Pos dana migrasi ${index + 1}`, 120),
      purpose, target, current, Math.max(0, integer(row, ["monthlyContribution", "monthly_contribution"], 0)),
      validDate(text(row, "targetDate", "target_date"), now.slice(0, 10)), accountIds.get(oldAccount),
      /^#[0-9a-fA-F]{6}$/.test(text(row, "color")) ? text(row, "color") : "#16876f",
      row.active === undefined || bool(row, "active", "is_active") ? 1 : 0, now, now,
    ));
  });

  backup.data.sinkingFundEntries.forEach((row, index) => {
    const oldId = text(row, "id") || `missing-${index}`;
    const oldFund = text(row, "fundId", "fund_id");
    statements.push(d1.prepare(
      `INSERT INTO sinking_fund_entries
        (id, workspace_id, fund_id, type, amount, date, note, request_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      sinkingFundEntryIds.get(oldId), workspaceId, sinkingFundIds.get(oldFund),
      text(row, "type") === "release" ? "release" : "allocate",
      Math.max(1, integer(row, ["amount"], 1)), validDate(text(row, "date"), now.slice(0, 10)),
      safeName(text(row, "note"), "", 240), `migration:${migrationId}:${oldId}`, now,
    ));
  });

  backup.data.bills.forEach((row, index) => {
    const oldId = text(row, "id") || `missing-${index}`;
    const oldAccount = text(row, "accountId", "account_id");
    const reminders = text(row, "reminderDays", "reminder_days") || "7,3,1,0";
    const oldLiabilityAccount = text(row, "liabilityAccountId", "liability_account_id");
    const phasesValue = row.installmentPhases ?? row.installment_phases ?? row.installmentPhasesJson ?? row.installment_phases_json ?? [];
    const installmentPhases = normalizeInstallmentPhases(typeof phasesValue === "string" ? json(phasesValue, []) : phasesValue);
    const durationMonths = installmentPhases.length ? installmentDuration(installmentPhases) : Math.max(0, integer(row, ["durationMonths", "duration_months"], 0));
    const paidCount = Math.max(0, integer(row, ["paidCount", "paid_count"], 0));
    statements.push(d1.prepare(`INSERT INTO bills (id, workspace_id, name, amount, due_date, category, account_id, frequency, reminder_days, paid, paid_at, last_paid_period, liability_account_id, duration_months, paid_count, current_period_paid, total_paid, installment_phases_json, completed, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(billIds.get(oldId), workspaceId, safeName(text(row, "name"), `Tagihan migrasi ${index + 1}`, 100), Math.max(1, integer(row, ["amount"], 1)), validDate(text(row, "dueDate", "due_date"), now.slice(0, 10)), safeName(text(row, "category"), "Tagihan", 100), accountIds.get(oldAccount), "monthly", reminders, bool(row, "paid") ? 1 : 0, text(row, "paidAt", "paid_at") || null, text(row, "lastPaidPeriod", "last_paid_period") || null, accountIds.get(oldLiabilityAccount) || null, durationMonths || null, paidCount, Math.max(0, integer(row, ["currentPeriodPaid", "current_period_paid"], 0)), Math.max(0, integer(row, ["totalPaid", "total_paid"], 0)), JSON.stringify(installmentPhases), durationMonths > 0 && paidCount >= durationMonths ? 1 : 0, now, now));
  });

  backup.data.recurringTemplates.forEach((row, index) => {
    const oldId = text(row, "id") || `missing-${index}`;
    const oldAccount = text(row, "accountId", "account_id");
    const frequency = ["weekly", "monthly", "quarterly", "yearly"].includes(text(row, "frequency")) ? text(row, "frequency") : "monthly";
    const startDate = validDate(text(row, "startDate", "start_date"), now.slice(0, 10));
    statements.push(d1.prepare(`INSERT INTO recurring_templates (id, workspace_id, name, type, amount, category, account_id, frequency, start_date, next_due_date, is_subscription, active, last_posted_date, request_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(recurringIds.get(oldId), workspaceId, safeName(text(row, "name"), `Transaksi rutin migrasi ${index + 1}`, 120), text(row, "type") === "income" ? "income" : "expense", Math.max(1, integer(row, ["amount"], 1)), safeName(text(row, "category"), "Lainnya", 100), accountIds.get(oldAccount), frequency, startDate, validDate(text(row, "nextDueDate", "next_due_date"), startDate), bool(row, "isSubscription", "is_subscription") ? 1 : 0, row.active === undefined || bool(row, "active", "is_active") ? 1 : 0, text(row, "lastPostedDate", "last_posted_date") || null, `migration:${migrationId}:${oldId}`, now, now));
  });

  const positionsByAsset = new Map(backup.data.investmentPositions.map((row) => [text(row, "assetId", "asset_id"), row]));
  backup.data.investmentAssets.forEach((row, index) => {
    const oldId = text(row, "id") || `missing-${index}`;
    const oldAccount = text(row, "accountId", "account_id");
    const assetId = assetIds.get(oldId)!;
    const manualPriceRaw = integer(row, ["manualPrice", "manual_price"], -1);
    const latest = Math.max(0, integer(row, ["latestPriceCache", "latest_price_cache", "marketPrice", "market_price"], Math.max(0, manualPriceRaw)));
    statements.push(d1.prepare(`INSERT INTO investment_assets (id, workspace_id, account_id, ticker, name, asset_class, exchange, currency, manual_price, latest_price_cache, price_source, price_status, price_updated_at, active, request_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(assetId, workspaceId, accountIds.get(oldAccount), safeName(text(row, "ticker"), `MIG${index + 1}`, 24).toUpperCase(), safeName(text(row, "name"), `Aset migrasi ${index + 1}`, 100), safeName(text(row, "assetClass", "asset_class"), "Custom", 40), safeName(text(row, "exchange"), "", 40), safeName(text(row, "currency"), "IDR", 3).toUpperCase(), manualPriceRaw >= 0 ? manualPriceRaw : null, latest, ["manual", "last_trade"].includes(text(row, "priceSource", "price_source")) ? text(row, "priceSource", "price_source") : "unavailable", ["manual", "delayed"].includes(text(row, "priceStatus", "price_status")) ? text(row, "priceStatus", "price_status") : "unavailable", text(row, "priceUpdatedAt", "price_updated_at") || null, row.active === undefined || bool(row, "active") ? 1 : 0, `migration:${migrationId}:${oldId}`, now, now));
    const position = positionsByAsset.get(oldId) ?? row;
    const unitsMicro = Math.max(0, integer(position, ["unitsMicro", "units_micro"], Math.round(numeric(position, ["units"], 0) * INVESTMENT_UNIT_SCALE)));
    statements.push(d1.prepare(`INSERT INTO investment_positions (asset_id, workspace_id, units_micro, cost_basis, realized_pl, updated_at) VALUES (?, ?, ?, ?, ?, ?)`).bind(assetId, workspaceId, unitsMicro, Math.max(0, integer(position, ["costBasis", "cost_basis"], 0)), integer(position, ["realizedPl", "realized_pl"], 0), now));
  });

  backup.data.investmentTransactions.forEach((row, index) => {
    const oldId = text(row, "id") || `missing-${index}`;
    const oldAsset = text(row, "assetId", "asset_id");
    const oldAccount = text(row, "accountId", "account_id");
    const unitsMicro = Math.max(1, integer(row, ["unitsMicro", "units_micro"], Math.round(numeric(row, ["units"], 0) * INVESTMENT_UNIT_SCALE)));
    const price = Math.max(1, integer(row, ["pricePerUnit", "price_per_unit", "price"], 1));
    const gross = Math.max(1, integer(row, ["grossAmount", "gross_amount"], Math.round(unitsMicro * price / INVESTMENT_UNIT_SCALE)));
    const linkedCashOld = text(row, "linkedCashTransactionId", "linked_cash_transaction_id");
    const linkedAdjustmentOld = text(row, "linkedAdjustmentTransactionId", "linked_adjustment_transaction_id");
    statements.push(d1.prepare(`INSERT INTO investment_transactions (id, workspace_id, asset_id, account_id, date, type, units_micro, price_per_unit, gross_amount, fee, tax, net_amount, average_cost_after, remaining_units_micro, realized_pl, linked_cash_transaction_id, linked_adjustment_transaction_id, note, request_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(investmentTransactionIds.get(oldId), workspaceId, assetIds.get(oldAsset), accountIds.get(oldAccount), validDate(text(row, "date"), now.slice(0, 10)), text(row, "type") === "sell" ? "sell" : "buy", unitsMicro, price, gross, Math.max(0, integer(row, ["fee"], 0)), Math.max(0, integer(row, ["tax"], 0)), Math.max(1, integer(row, ["netAmount", "net_amount"], gross)), Math.max(0, integer(row, ["averageCostAfter", "average_cost_after"], 0)), Math.max(0, integer(row, ["remainingUnitsMicro", "remaining_units_micro"], Math.round(numeric(row, ["remainingUnitsAfter", "remaining_units_after"], 0) * INVESTMENT_UNIT_SCALE))), integer(row, ["realizedPl", "realized_pl"], 0), transactionIds.get(linkedCashOld) ?? makeId("mig-linked-cash"), linkedAdjustmentOld ? transactionIds.get(linkedAdjustmentOld) ?? null : null, safeName(text(row, "note", "notes"), "", 300) || null, `migration:${migrationId}:${oldId}`, now, now));
  });

  if (backup.settings.notificationEnabled !== undefined || backup.settings.notificationBillReminderDays || backup.settings.notificationBudgetWarningPercent || backup.settings.notificationBackupWarningDays || backup.settings.notificationGoalWarningDays || backup.settings.notificationEmailEnabled !== undefined || backup.settings.notificationEmailAddress || backup.settings.notificationWeeklyDigest !== undefined) {
    const reminderDays = (backup.settings.notificationBillReminderDays?.filter((day) => [7, 3, 1, 0].includes(day)) ?? [7, 3, 1, 0]);
    statements.push(d1.prepare(
      `INSERT INTO notification_settings (workspace_id, enabled, bill_reminder_days, budget_warning_percent, backup_warning_days, goal_warning_days, email_enabled, email_address, weekly_digest, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(workspace_id) DO UPDATE SET enabled = excluded.enabled, bill_reminder_days = excluded.bill_reminder_days, budget_warning_percent = excluded.budget_warning_percent, backup_warning_days = excluded.backup_warning_days, goal_warning_days = excluded.goal_warning_days, email_enabled = excluded.email_enabled, email_address = excluded.email_address, weekly_digest = excluded.weekly_digest, updated_at = excluded.updated_at`,
    ).bind(workspaceId, backup.settings.notificationEnabled === false ? 0 : 1, JSON.stringify(reminderDays.length ? reminderDays : [7, 3, 1, 0]), backup.settings.notificationBudgetWarningPercent ?? 75, backup.settings.notificationBackupWarningDays ?? 7, backup.settings.notificationGoalWarningDays ?? 30, backup.settings.notificationEmailEnabled ? 1 : 0, String(backup.settings.notificationEmailAddress ?? ""), backup.settings.notificationWeeklyDigest === false ? 0 : 1, now, now));
  }

  (backup.settings.categoryRules ?? []).forEach((rule, index) => {
    const categoryExists = backup.data.categories.some((category) =>
      text(category, "name").toLowerCase() === rule.category.toLowerCase()
      && (text(category, "type") === rule.transactionType),
    );
    if (!categoryExists || rule.keyword.length < 2) return;
    statements.push(d1.prepare(
      `INSERT INTO category_rules
       (id, workspace_id, keyword, category, transaction_type, match_type, priority, active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(makeId(`mig-rule-${index + 1}`), workspaceId, rule.keyword, rule.category, rule.transactionType, rule.matchType, rule.priority, rule.active ? 1 : 0, now, now));
  });

  if (backup.settings.roadmapHorizonMonths !== undefined) {
    const horizon = [12, 24, 36, 60].includes(Number(backup.settings.roadmapHorizonMonths)) ? Number(backup.settings.roadmapHorizonMonths) : 24;
    const bounded = (value: number | undefined, min: number, max: number, fallback: number) => Number.isSafeInteger(value) ? Math.max(min, Math.min(max, Number(value))) : fallback;
    statements.push(d1.prepare(
      `INSERT INTO roadmap_settings (workspace_id, horizon_months, income_adjustment_pct, expense_adjustment_pct, annual_investment_return_pct, annual_inflation_pct, monthly_investment, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(workspace_id) DO UPDATE SET horizon_months = excluded.horizon_months, income_adjustment_pct = excluded.income_adjustment_pct, expense_adjustment_pct = excluded.expense_adjustment_pct, annual_investment_return_pct = excluded.annual_investment_return_pct, annual_inflation_pct = excluded.annual_inflation_pct, monthly_investment = excluded.monthly_investment, updated_at = excluded.updated_at`,
    ).bind(workspaceId, horizon, bounded(backup.settings.roadmapIncomeAdjustmentPct, -50, 100, 0), bounded(backup.settings.roadmapExpenseAdjustmentPct, -50, 100, 0), bounded(backup.settings.roadmapAnnualInvestmentReturnPct, 0, 30, 6), bounded(backup.settings.roadmapAnnualInflationPct, 0, 30, 3), bounded(backup.settings.roadmapMonthlyInvestment, 0, 1_000_000_000, 0), now, now));
  }

  if (backup.settings.debtStrategy || backup.settings.debtPlans?.length) {
    const strategy = backup.settings.debtStrategy === "snowball" ? "snowball" : "avalanche";
    const extra = Math.max(0, Math.min(1_000_000_000, Math.round(Number(backup.settings.debtExtraMonthlyPayment || 0))));
    statements.push(d1.prepare(
      `INSERT INTO debt_payoff_settings (workspace_id, strategy, extra_monthly_payment, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?) ON CONFLICT(workspace_id) DO UPDATE SET strategy = excluded.strategy,
       extra_monthly_payment = excluded.extra_monthly_payment, updated_at = excluded.updated_at`,
    ).bind(workspaceId, strategy, extra, now, now));
    (backup.settings.debtPlans ?? []).forEach((plan) => {
      const mappedAccountId = accountIds.get(plan.accountId);
      if (!mappedAccountId) return;
      const rateBps = Math.max(0, Math.min(10000, Math.round(Number(plan.annualInterestRatePct || 0) * 100)));
      const minimum = Math.max(0, Math.min(1_000_000_000, Math.round(Number(plan.minimumPayment || 0))));
      const dueDay = Math.max(1, Math.min(31, Math.round(Number(plan.dueDay || 1))));
      statements.push(d1.prepare(`INSERT INTO debt_accounts (id, workspace_id, account_id, annual_rate_bps, minimum_payment, due_day, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(workspace_id, account_id) DO NOTHING`)
        .bind(`debt-${mappedAccountId}`, workspaceId, mappedAccountId, rateBps, minimum, dueDay, now, now));
    });
  }

  if (backup.settings.forecastHorizonDays !== undefined) {
    const horizon = [30, 60, 90].includes(Number(backup.settings.forecastHorizonDays)) ? Number(backup.settings.forecastHorizonDays) : 60;
    const income = Math.max(0, Math.min(10_000_000_000, Math.round(Number(backup.settings.forecastMonthlyIncomeOverride || 0))));
    const incomeDay = Math.max(1, Math.min(28, Math.round(Number(backup.settings.forecastIncomeDay || 25))));
    const buffer = Math.max(0, Math.min(10_000_000_000, Math.round(Number(backup.settings.forecastMinimumCashBuffer || 0))));
    statements.push(d1.prepare(`INSERT INTO cashflow_forecast_settings (workspace_id, horizon_days, monthly_income_override, income_day, minimum_cash_buffer, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(workspace_id) DO UPDATE SET horizon_days = excluded.horizon_days, monthly_income_override = excluded.monthly_income_override, income_day = excluded.income_day, minimum_cash_buffer = excluded.minimum_cash_buffer, updated_at = excluded.updated_at`)
      .bind(workspaceId, horizon, income, incomeDay, buffer, now, now));
  }
  if (backup.settings.emergencyTargetMonths !== undefined) {
    const target = [3,6,9,12].includes(Number(backup.settings.emergencyTargetMonths)) ? Number(backup.settings.emergencyTargetMonths) : 6;
    const expense = Math.max(0, Math.min(10_000_000_000, Math.round(Number(backup.settings.emergencyMonthlyExpenseOverride || 0))));
    const contribution = Math.max(0, Math.min(10_000_000_000, Math.round(Number(backup.settings.emergencyMonthlyContribution || 0))));
    const mappedAccounts = (backup.settings.emergencyAccountIds ?? []).map((id) => accountIds.get(id)).filter((id): id is string => Boolean(id));
    statements.push(d1.prepare(`INSERT INTO emergency_fund_settings (workspace_id, target_months, monthly_expense_override, monthly_contribution, account_ids_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(workspace_id) DO UPDATE SET target_months = excluded.target_months, monthly_expense_override = excluded.monthly_expense_override, monthly_contribution = excluded.monthly_contribution, account_ids_json = excluded.account_ids_json, updated_at = excluded.updated_at`).bind(workspaceId, target, expense, contribution, JSON.stringify(mappedAccounts), now, now));
  }

  try {
    await runChunks(statements);
  } catch (error) {
    const cleanup: D1PreparedStatement[] = [
      ...[...sinkingFundEntryIds.values()].map((id) => d1.prepare(`DELETE FROM sinking_fund_entries WHERE workspace_id = ? AND id = ?`).bind(workspaceId, id)),
      ...[...sinkingFundIds.values()].map((id) => d1.prepare(`DELETE FROM sinking_funds WHERE workspace_id = ? AND id = ?`).bind(workspaceId, id)),
      ...[...recurringIds.values()].map((id) => d1.prepare(`DELETE FROM recurring_templates WHERE workspace_id = ? AND id = ?`).bind(workspaceId, id)),
      ...[...investmentTransactionIds.values()].map((id) => d1.prepare(`DELETE FROM investment_transactions WHERE workspace_id = ? AND id = ?`).bind(workspaceId, id)),
      ...[...assetIds.values()].map((id) => d1.prepare(`DELETE FROM investment_positions WHERE workspace_id = ? AND asset_id = ?`).bind(workspaceId, id)),
      ...[...assetIds.values()].map((id) => d1.prepare(`DELETE FROM investment_assets WHERE workspace_id = ? AND id = ?`).bind(workspaceId, id)),
      ...[...transactionIds.values()].map((id) => d1.prepare(`DELETE FROM transactions WHERE workspace_id = ? AND id = ?`).bind(workspaceId, id)),
      ...[...billIds.values()].map((id) => d1.prepare(`DELETE FROM bills WHERE workspace_id = ? AND id = ?`).bind(workspaceId, id)),
      ...[...goalIds.values()].map((id) => d1.prepare(`DELETE FROM goals WHERE workspace_id = ? AND id = ?`).bind(workspaceId, id)),
      ...[...budgetIds.values()].map((id) => d1.prepare(`DELETE FROM budgets WHERE workspace_id = ? AND id = ?`).bind(workspaceId, id)),
      ...[...accountIds.values()].map((id) => d1.prepare(`DELETE FROM accounts WHERE workspace_id = ? AND id = ?`).bind(workspaceId, id)),
      ...[...categoryIds.values()].map((id) => d1.prepare(`DELETE FROM categories WHERE workspace_id = ? AND id = ?`).bind(workspaceId, id)),
    ];
    try { await runChunks(cleanup); } catch { /* pre-migration backup remains available for manual recovery */ }
    await d1.prepare(`UPDATE migration_jobs SET status = 'failed', updated_at = ? WHERE workspace_id = ? AND id = ?`).bind(nowIso(), workspaceId, migrationId).run();
    throw error;
  }

  const appliedAt = nowIso();
  const report = {
    migrationId,
    sourceName: job.sourceName,
    sourceSchemaVersion: job.sourceSchemaVersion,
    targetSchemaVersion: BACKUP_SCHEMA_VERSION,
    appliedAt,
    counts: backupCounts(backup.data),
    totalRecords: totalBackupRecords(backup.data),
    balanceDifference: job.balanceDifference,
    warnings: json<string[]>(job.warningsJson, []),
    status: "applied",
  };
  const reportBytes = new TextEncoder().encode(JSON.stringify(report, null, 2));
  await storeExport(workspaceId, "migration_report", `Financial-Planner_Migration_Report_${migrationId}.json`, "application/json", reportBytes, { migrationId, sourceName: job.sourceName });
  await d1.batch([
    d1.prepare(`UPDATE migration_jobs SET status = 'applied', applied_at = ?, updated_at = ? WHERE workspace_id = ? AND id = ? AND status = 'preview'`).bind(appliedAt, appliedAt, workspaceId, migrationId),
    auditStatement(d1, { workspaceId, action: "migration.apply", entityType: "migration", entityId: migrationId, details: { counts: backupCounts(backup.data), totalRecords: totalBackupRecords(backup.data), balanceDifference: job.balanceDifference }, createdAt: appliedAt }),
  ]);
  const updated = await migrationRowById(workspaceId, migrationId);
  if (!updated) throw new ApiError(500, "MIGRATION_RESULT_MISSING", "Status migrasi tidak dapat dimuat.");
  return migrationRecord(updated);
}

export async function cancelMigration(workspaceId: string, migrationId: string) {
  await requireWorkspace(workspaceId);
  const job = await migrationRowById(workspaceId, migrationId);
  if (!job) throw new ApiError(404, "MIGRATION_NOT_FOUND", "Preview migrasi tidak ditemukan.");
  if (job.status === "applied") throw new ApiError(409, "MIGRATION_ALREADY_APPLIED", "Migrasi yang sudah diterapkan tidak dapat dibatalkan melalui preview.");
  if (job.status === "preview") {
    await getFilesBucket().delete(job.objectKey);
    const now = nowIso();
    await getD1().batch([
      getD1().prepare(`UPDATE migration_jobs SET status = 'cancelled', updated_at = ? WHERE workspace_id = ? AND id = ?`).bind(now, workspaceId, migrationId),
      auditStatement(getD1(), { workspaceId, action: "migration.cancel", entityType: "migration", entityId: migrationId, createdAt: now }),
    ]);
  }
  return migrationRecord((await migrationRowById(workspaceId, migrationId))!);
}

export async function downloadMigrationReport(workspaceId: string, migrationId: string) {
  const row = await getD1().prepare(
    `SELECT id FROM data_exports
     WHERE workspace_id = ? AND kind = 'migration_report'
       AND json_extract(metadata_json, '$.migrationId') = ?
     ORDER BY created_at DESC LIMIT 1`,
  ).bind(workspaceId, migrationId).first<{ id: string }>();
  if (!row) throw new ApiError(404, "MIGRATION_REPORT_NOT_FOUND", "Laporan migrasi belum tersedia.");
  return downloadExport(workspaceId, row.id);
}
