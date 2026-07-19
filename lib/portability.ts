export const BACKUP_FORMAT = "vinn-store-backup";
export const BACKUP_SCHEMA_VERSION = "1.8.0";
export const BACKUP_MAX_RECORDS = 5_000;

export const PORTABLE_COLLECTIONS = [
  "accounts",
  "categories",
  "transactions",
  "budgets",
  "goals",
  "bills",
  "investmentAssets",
  "investmentPositions",
  "investmentTransactions",
] as const;

export type PortableCollection = (typeof PORTABLE_COLLECTIONS)[number];
export type PortableRecord = Record<string, unknown>;
export type PortableData = Record<PortableCollection, PortableRecord[]>;

export type PortableBackup = {
  format: typeof BACKUP_FORMAT;
  schemaVersion: string;
  createdAt: string;
  source: { app: string; backend: string; workspaceId?: string };
  profile: { name: string; storeName: string; currency: string; timezone: string };
  settings: {
    aiEnabled?: boolean;
    aiConsentAccepted?: boolean;
    aiProvider?: string;
    aiModel?: string;
    notificationEnabled?: boolean;
    notificationBillReminderDays?: number[];
    notificationBudgetWarningPercent?: number;
    notificationBackupWarningDays?: number;
    notificationGoalWarningDays?: number;
    roadmapHorizonMonths?: number;
    roadmapIncomeAdjustmentPct?: number;
    roadmapExpenseAdjustmentPct?: number;
    roadmapAnnualInvestmentReturnPct?: number;
    roadmapAnnualInflationPct?: number;
    roadmapMonthlyInvestment?: number;
    debtStrategy?: "avalanche" | "snowball";
    debtExtraMonthlyPayment?: number;
    debtPlans?: Array<{ accountId: string; annualInterestRatePct: number; minimumPayment: number; dueDay: number }>;
  };
  data: PortableData;
};

export type ExportRecord = {
  id: string;
  kind: "backup" | "report" | "migration_report";
  filename: string;
  contentType: string;
  sizeBytes: number;
  status: "ready" | "failed";
  period?: string;
  createdAt: string;
  downloadUrl: string;
  metadata?: Record<string, unknown>;
};

export type BackupSchedule = {
  enabled: boolean;
  frequency: "daily" | "weekly" | "monthly";
  lastBackupAt: string | null;
  nextBackupAt: string | null;
  mode: "scheduled" | "on_access";
};

export type BackupOverview = {
  schedule: BackupSchedule;
  backups: ExportRecord[];
};

export type MigrationCounts = Record<PortableCollection, number>;

export type MigrationPreview = {
  id: string;
  sourceName: string;
  sourceSchemaVersion: string;
  status: "preview" | "applied" | "cancelled" | "failed";
  counts: MigrationCounts;
  totalRecords: number;
  warnings: string[];
  errors: string[];
  balanceDifference: number;
  createdAt: string;
  appliedAt: string | null;
  canApply: boolean;
  reportDownloadUrl?: string;
};

const emptyData = (): PortableData => ({
  accounts: [],
  categories: [],
  transactions: [],
  budgets: [],
  goals: [],
  bills: [],
  investmentAssets: [],
  investmentPositions: [],
  investmentTransactions: [],
});

const object = (value: unknown): PortableRecord | null => value && typeof value === "object" && !Array.isArray(value)
  ? value as PortableRecord
  : null;

const text = (value: unknown, fallback = "") => value === undefined || value === null ? fallback : String(value).trim();

function collection(source: PortableRecord, ...keys: string[]) {
  const key = keys.find((candidate) => Array.isArray(source[candidate]));
  if (!key) return [];
  return (source[key] as unknown[]).filter((item): item is PortableRecord => Boolean(object(item))).map((item) => ({ ...item }));
}

function idOf(row: PortableRecord) {
  return text(row.id ?? row.ID);
}

function refOf(row: PortableRecord, ...keys: string[]) {
  const key = keys.find((candidate) => row[candidate] !== undefined);
  return key ? text(row[key]) : "";
}

export function backupCounts(data: PortableData): MigrationCounts {
  return Object.fromEntries(PORTABLE_COLLECTIONS.map((key) => [key, data[key].length])) as MigrationCounts;
}

export function totalBackupRecords(data: PortableData) {
  return Object.values(backupCounts(data)).reduce((sum, value) => sum + value, 0);
}

export function parsePortableBackup(value: unknown): { backup: PortableBackup; warnings: string[]; errors: string[] } {
  const root = object(value);
  if (!root) throw new Error("File backup harus berupa object JSON.");
  const rawData = object(root.data) ?? root;
  const data = emptyData();
  data.accounts = collection(rawData, "accounts", "Accounts");
  data.categories = collection(rawData, "categories", "Categories");
  data.transactions = collection(rawData, "transactions", "Transactions");
  data.budgets = collection(rawData, "budgets", "Budgets");
  data.goals = collection(rawData, "goals", "Goals");
  data.bills = collection(rawData, "bills", "Bills");
  data.investmentAssets = collection(rawData, "investmentAssets", "investment_assets", "assets", "Assets");
  data.investmentPositions = collection(rawData, "investmentPositions", "investment_positions", "positions", "Positions");
  data.investmentTransactions = collection(rawData, "investmentTransactions", "investment_transactions", "InvestmentTransactions");

  const profile = object(root.profile) ?? {};
  const source = object(root.source) ?? {};
  const settings = object(root.settings) ?? {};
  const createdAt = text(root.createdAt ?? root.exportedAt, new Date().toISOString());
  const backup: PortableBackup = {
    format: BACKUP_FORMAT,
    schemaVersion: text(root.schemaVersion ?? root.version, "legacy"),
    createdAt: Number.isNaN(new Date(createdAt).getTime()) ? new Date().toISOString() : new Date(createdAt).toISOString(),
    source: {
      app: text(source.app, "Financial Planner").replace(/^VINN STORE(?: Financial OS)?$/i, "Financial Planner"),
      backend: text(source.backend, text(root.backend, "portable-json")),
      ...(text(source.workspaceId) ? { workspaceId: text(source.workspaceId) } : {}),
    },
    profile: {
      name: text(profile.name, "Vinn").slice(0, 100),
      storeName: text(profile.storeName ?? profile.store_name, "Financial Planner").replace(/^VINN STORE$/i, "Financial Planner").slice(0, 100),
      currency: text(profile.currency, "IDR").toUpperCase().slice(0, 3),
      timezone: text(profile.timezone, "Asia/Jakarta").slice(0, 80),
    },
    settings: {
      ...(settings.aiEnabled !== undefined ? { aiEnabled: Boolean(settings.aiEnabled) } : {}),
      ...(settings.aiConsentAccepted !== undefined ? { aiConsentAccepted: Boolean(settings.aiConsentAccepted) } : {}),
      ...(text(settings.aiProvider) ? { aiProvider: text(settings.aiProvider).slice(0, 40) } : {}),
      ...(text(settings.aiModel) ? { aiModel: text(settings.aiModel).slice(0, 100) } : {}),
      ...(settings.notificationEnabled !== undefined ? { notificationEnabled: Boolean(settings.notificationEnabled) } : {}),
      ...(Array.isArray(settings.notificationBillReminderDays) ? { notificationBillReminderDays: settings.notificationBillReminderDays.map(Number).filter((day) => [7, 3, 1, 0].includes(day)) } : {}),
      ...([75, 90].includes(Number(settings.notificationBudgetWarningPercent)) ? { notificationBudgetWarningPercent: Number(settings.notificationBudgetWarningPercent) } : {}),
      ...([7, 14, 30].includes(Number(settings.notificationBackupWarningDays)) ? { notificationBackupWarningDays: Number(settings.notificationBackupWarningDays) } : {}),
      ...([7, 30, 60].includes(Number(settings.notificationGoalWarningDays)) ? { notificationGoalWarningDays: Number(settings.notificationGoalWarningDays) } : {}),
      ...([12, 24, 36, 60].includes(Number(settings.roadmapHorizonMonths)) ? { roadmapHorizonMonths: Number(settings.roadmapHorizonMonths) } : {}),
      ...(Number.isFinite(Number(settings.roadmapIncomeAdjustmentPct)) ? { roadmapIncomeAdjustmentPct: Number(settings.roadmapIncomeAdjustmentPct) } : {}),
      ...(Number.isFinite(Number(settings.roadmapExpenseAdjustmentPct)) ? { roadmapExpenseAdjustmentPct: Number(settings.roadmapExpenseAdjustmentPct) } : {}),
      ...(Number.isFinite(Number(settings.roadmapAnnualInvestmentReturnPct)) ? { roadmapAnnualInvestmentReturnPct: Number(settings.roadmapAnnualInvestmentReturnPct) } : {}),
      ...(Number.isFinite(Number(settings.roadmapAnnualInflationPct)) ? { roadmapAnnualInflationPct: Number(settings.roadmapAnnualInflationPct) } : {}),
      ...(Number.isFinite(Number(settings.roadmapMonthlyInvestment)) ? { roadmapMonthlyInvestment: Number(settings.roadmapMonthlyInvestment) } : {}),
      ...(settings.debtStrategy === "avalanche" || settings.debtStrategy === "snowball" ? { debtStrategy: settings.debtStrategy } : {}),
      ...(Number.isSafeInteger(Number(settings.debtExtraMonthlyPayment)) ? { debtExtraMonthlyPayment: Math.max(0, Number(settings.debtExtraMonthlyPayment)) } : {}),
      ...(Array.isArray(settings.debtPlans) ? { debtPlans: settings.debtPlans.map((plan) => {
        const item = object(plan) ?? {};
        return { accountId: text(item.accountId), annualInterestRatePct: Number(item.annualInterestRatePct || 0), minimumPayment: Number(item.minimumPayment || 0), dueDay: Number(item.dueDay || 1) };
      }).filter((plan) => plan.accountId) } : {}),
    },
    data,
  };

  const warnings: string[] = [];
  const errors: string[] = [];
  const total = totalBackupRecords(data);
  if (total === 0) errors.push("File tidak berisi data yang dapat dimigrasikan.");
  if (total > BACKUP_MAX_RECORDS) errors.push(`File berisi ${total} baris; batas aman migrasi adalah ${BACKUP_MAX_RECORDS} baris per proses.`);
  if (backup.schemaVersion === "legacy") warnings.push("Versi skema sumber tidak tersedia; field lama akan dipetakan secara konservatif.");

  PORTABLE_COLLECTIONS.forEach((key) => {
    const ids = data[key].map(idOf).filter(Boolean);
    const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
    if (duplicates.length) errors.push(`${key} memiliki ID duplikat: ${[...new Set(duplicates)].slice(0, 3).join(", ")}.`);
    const missing = data[key].length - ids.length;
    if (missing) warnings.push(`${missing} baris ${key} tanpa ID akan diberi ID baru.`);
  });

  const accountIds = new Set(data.accounts.map(idOf).filter(Boolean));
  const assetIds = new Set(data.investmentAssets.map(idOf).filter(Boolean));
  data.transactions.forEach((row, index) => {
    const accountId = refOf(row, "accountId", "account_id");
    const destinationId = refOf(row, "destinationAccountId", "destination_account_id");
    if (!accountId) errors.push(`Transaksi baris ${index + 1} tidak memiliki akun sumber.`);
    else if (!accountIds.has(accountId)) errors.push(`Transaksi baris ${index + 1} merujuk akun sumber yang tidak ada.`);
    if (text(row.type) === "transfer" && !destinationId) errors.push(`Transfer baris ${index + 1} tidak memiliki akun tujuan.`);
    if (destinationId && !accountIds.has(destinationId)) errors.push(`Transaksi baris ${index + 1} merujuk akun tujuan yang tidak ada.`);
  });
  data.bills.forEach((row, index) => {
    const accountId = refOf(row, "accountId", "account_id");
    if (!accountId) errors.push(`Tagihan baris ${index + 1} tidak memiliki akun pembayaran.`);
    else if (!accountIds.has(accountId)) errors.push(`Tagihan baris ${index + 1} merujuk akun yang tidak ada.`);
  });
  data.investmentAssets.forEach((row, index) => {
    const accountId = refOf(row, "accountId", "account_id");
    if (!accountId) errors.push(`Aset investasi baris ${index + 1} tidak memiliki akun investasi.`);
    else if (!accountIds.has(accountId)) errors.push(`Aset investasi baris ${index + 1} merujuk akun yang tidak ada.`);
  });
  data.investmentPositions.forEach((row, index) => {
    const assetId = refOf(row, "assetId", "asset_id");
    if (!assetId) errors.push(`Posisi investasi baris ${index + 1} tidak memiliki aset.`);
    else if (!assetIds.has(assetId)) errors.push(`Posisi investasi baris ${index + 1} merujuk aset yang tidak ada.`);
  });
  data.investmentTransactions.forEach((row, index) => {
    const accountId = refOf(row, "accountId", "account_id");
    const assetId = refOf(row, "assetId", "asset_id");
    if (!accountId) errors.push(`Transaksi investasi baris ${index + 1} tidak memiliki akun.`);
    else if (!accountIds.has(accountId)) errors.push(`Transaksi investasi baris ${index + 1} merujuk akun yang tidak ada.`);
    if (!assetId) errors.push(`Transaksi investasi baris ${index + 1} tidak memiliki aset.`);
    else if (!assetIds.has(assetId)) errors.push(`Transaksi investasi baris ${index + 1} merujuk aset yang tidak ada.`);
  });

  return { backup, warnings: [...new Set(warnings)], errors: [...new Set(errors)] };
}

export function nextBackupAt(from: string | Date, frequency: BackupSchedule["frequency"]) {
  const date = typeof from === "string" ? new Date(from) : new Date(from.getTime());
  if (Number.isNaN(date.getTime())) throw new Error("Tanggal backup tidak valid.");
  if (frequency === "daily") date.setUTCDate(date.getUTCDate() + 1);
  else if (frequency === "weekly") date.setUTCDate(date.getUTCDate() + 7);
  else date.setUTCMonth(date.getUTCMonth() + 1);
  return date.toISOString();
}

export function byteArrayToBase64(bytes: Uint8Array) {
  let binary = "";
  const chunk = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunk) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunk));
  }
  return btoa(binary);
}
