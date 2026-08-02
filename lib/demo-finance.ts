import type { Account, Bill, Budget, FinanceCategory, Goal, InvestmentAsset, InvestmentTransaction, Transaction } from "./finance";
import type { AiChatMessage } from "./ai";
import type { NotificationSettings } from "./notifications";
import type { RecurringTemplate } from "./recurring";
import { capabilityMap, type PlanEntitlement } from "./plans";

declare global {
  interface Window {
    __FINANCE_DEMO__?: boolean;
    __FINANCE_DEMO_WHATSAPP_URL__?: string;
  }
}

export type DemoSnapshot = {
  configured: true;
  entitlement: PlanEntitlement;
  profile: { name: string; storeName: string; currency: string; timezone: string };
  accounts: Account[];
  transactions: Transaction[];
  budgets: Budget[];
  goals: Goal[];
  bills: Bill[];
  categories: FinanceCategory[];
  auditLogs: Array<Record<string, unknown>>;
  investmentAssets: InvestmentAsset[];
  investmentTransactions: InvestmentTransaction[];
};

type DemoState = {
  version: 1;
  snapshot: DemoSnapshot;
  roadmap: Record<string, unknown>;
  debts: { settings: Record<string, unknown>; debts: Array<Record<string, unknown>> };
  forecast: Record<string, unknown>;
  emergency: Record<string, unknown>;
  recurring: RecurringTemplate[];
  notificationSettings: NotificationSettings;
  dismissedNotifications: string[];
  aiMessages: AiChatMessage[];
  reports: Array<Record<string, unknown>>;
  backups: Array<Record<string, unknown>>;
  migrations: Array<Record<string, unknown>>;
  backupSchedule: Record<string, unknown>;
  lastTransactionId: string | null;
};

const demoStates = new Map<string, DemoState>();
const nowIso = () => new Date().toISOString();
const dateInMonth = (month: string, day: number) => `${month}-${String(day).padStart(2, "0")}`;

function shiftMonth(month: string, offset: number) {
  const [year, monthIndex] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, monthIndex - 1 + offset, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

const premiumDemoEntitlement = (): PlanEntitlement => ({
  tier: "premium",
  label: "Premium Demo",
  status: "active",
  capabilities: capabilityMap("premium"),
  installationId: "demo-browser",
  licenseId: "demo-premium",
  expiresAt: null,
});

function transaction(month: string, day: number, value: Partial<Transaction> & Pick<Transaction, "id" | "type" | "title" | "category" | "accountId" | "amount">): Transaction {
  return {
    date: dateInMonth(month, day),
    time: "09:00",
    status: "completed",
    merchant: value.title,
    notes: "Data contoh mode demo",
    tags: ["demo"],
    ...value,
  };
}

function seedDemoState(month: string): DemoState {
  const previous = shiftMonth(month, -1);
  const twoMonthsAgo = shiftMonth(month, -2);
  const accounts: Account[] = [
    { id: "demo-bank", name: "Rekening Utama", type: "Bank", institution: "Bank Nusantara", balance: 18_750_000, openingBalance: 10_000_000, mask: "•• 4821", color: "#126b59" },
    { id: "demo-wallet", name: "Dompet Digital", type: "E-Wallet", institution: "DompetKu", balance: 1_325_000, openingBalance: 500_000, mask: "•• 1048", color: "#3f75c6" },
    { id: "demo-cash", name: "Uang Tunai", type: "Cash", institution: "Pribadi", balance: 850_000, openingBalance: 1_000_000, mask: "", color: "#d49b3c" },
    { id: "demo-investment", name: "Portofolio Investasi", type: "Investment", institution: "Sekuritas Demo", balance: 0, openingBalance: 0, mask: "•• 7712", color: "#7657bd" },
    { id: "demo-card", name: "Kartu Kredit", type: "Credit Card", institution: "Bank Nusantara", balance: 2_150_000, openingBalance: 0, mask: "•• 3309", color: "#d46161", liability: true },
  ];
  const transactions: Transaction[] = [
    transaction(month, 1, { id: "demo-tx-salary", type: "income", title: "Gaji bulanan", category: "Gaji", accountId: "demo-bank", amount: 14_500_000 }),
    transaction(month, 2, { id: "demo-tx-rent", type: "expense", title: "Sewa tempat tinggal", category: "Tempat Tinggal", accountId: "demo-bank", amount: 3_200_000 }),
    transaction(month, 4, { id: "demo-tx-grocery", type: "expense", title: "Belanja bulanan", category: "Makanan", accountId: "demo-card", amount: 1_175_000 }),
    transaction(month, 6, { id: "demo-tx-transport", type: "expense", title: "Transportasi", category: "Transportasi", accountId: "demo-wallet", amount: 420_000 }),
    transaction(month, 8, { id: "demo-tx-freelance", type: "income", title: "Proyek freelance", category: "Pendapatan Lain", accountId: "demo-bank", amount: 3_750_000 }),
    transaction(month, 10, { id: "demo-tx-utility", type: "expense", title: "Listrik dan internet", category: "Tagihan", accountId: "demo-bank", amount: 875_000 }),
    transaction(month, 12, { id: "demo-tx-coffee", type: "expense", title: "Kopi dan makan siang", category: "Makanan", accountId: "demo-wallet", amount: 185_000 }),
    transaction(month, 14, { id: "demo-tx-transfer", type: "transfer", title: "Isi dompet digital", category: "Transfer", accountId: "demo-bank", destinationAccountId: "demo-wallet", amount: 1_000_000 }),
    transaction(previous, 1, { id: "demo-tx-prev-salary", type: "income", title: "Gaji bulanan", category: "Gaji", accountId: "demo-bank", amount: 14_500_000 }),
    transaction(previous, 3, { id: "demo-tx-prev-rent", type: "expense", title: "Sewa tempat tinggal", category: "Tempat Tinggal", accountId: "demo-bank", amount: 3_200_000 }),
    transaction(previous, 9, { id: "demo-tx-prev-food", type: "expense", title: "Kebutuhan harian", category: "Makanan", accountId: "demo-bank", amount: 2_450_000 }),
    transaction(twoMonthsAgo, 1, { id: "demo-tx-old-salary", type: "income", title: "Gaji bulanan", category: "Gaji", accountId: "demo-bank", amount: 14_000_000 }),
    transaction(twoMonthsAgo, 8, { id: "demo-tx-old-cost", type: "expense", title: "Biaya hidup", category: "Makanan", accountId: "demo-bank", amount: 5_250_000 }),
  ];
  const categories: FinanceCategory[] = [
    ["Gaji", "income", "#239b76"], ["Pendapatan Lain", "income", "#4a9c75"], ["Makanan", "expense", "#dc7a63"],
    ["Transportasi", "expense", "#4f80c9"], ["Tempat Tinggal", "expense", "#9566c6"], ["Tagihan", "expense", "#d49b3c"],
    ["Hiburan", "expense", "#df6d99"], ["Kesehatan", "expense", "#48a3a7"], ["Transfer", "transfer", "#718096"], ["Lainnya", "expense", "#8d9994"],
  ].map(([name, type, color], index) => ({ id: `demo-category-${index}`, name, type: type as FinanceCategory["type"], color, active: true, isDefault: true }));
  const investmentAssets: InvestmentAsset[] = [
    { id: "demo-asset-idx", accountId: "demo-investment", ticker: "IDX30", name: "Reksa Dana Indeks IDX30", assetClass: "Reksadana", exchange: "Indonesia", currency: "IDR", units: 1250, costBasis: 15_000_000, averageCost: 12_000, marketPrice: 13_480, marketValue: 16_850_000, unrealizedPl: 1_850_000, realizedPl: 0, priceSource: "manual", priceStatus: "manual", priceUpdatedAt: nowIso(), active: true },
    { id: "demo-asset-gold", accountId: "demo-investment", ticker: "GOLD", name: "Emas Digital", assetClass: "Emas", exchange: "Indonesia", currency: "IDR", units: 5, costBasis: 5_500_000, averageCost: 1_100_000, marketPrice: 1_240_000, marketValue: 6_200_000, unrealizedPl: 700_000, realizedPl: 250_000, priceSource: "manual", priceStatus: "manual", priceUpdatedAt: nowIso(), active: true },
  ];
  return {
    version: 1,
    snapshot: {
      configured: true,
      entitlement: premiumDemoEntitlement(),
      profile: { name: "Vinn Demo", storeName: "Financial Planner", currency: "IDR", timezone: "Asia/Jakarta" },
      accounts,
      transactions,
      budgets: [
        { id: "demo-budget-food", category: "Makanan", limit: 3_500_000, color: "#dc7a63", period: month },
        { id: "demo-budget-transport", category: "Transportasi", limit: 1_200_000, color: "#4f80c9", period: month },
        { id: "demo-budget-fun", category: "Hiburan", limit: 900_000, color: "#df6d99", period: month },
      ],
      goals: [
        { id: "demo-goal-emergency", name: "Dana darurat", target: 30_000_000, current: 18_500_000, deadline: `${Number(month.slice(0, 4)) + 1}-06-30`, color: "#126b59", icon: "shield" },
        { id: "demo-goal-trip", name: "Liburan keluarga", target: 12_000_000, current: 4_750_000, deadline: `${Number(month.slice(0, 4)) + 1}-03-31`, color: "#4f80c9", icon: "plane" },
      ],
      bills: [
        { id: "demo-bill-internet", name: "Internet rumah", amount: 425_000, dueDate: dateInMonth(month, 20), category: "Tagihan", accountId: "demo-bank", paid: false, frequency: "monthly", reminderDays: [7, 3, 1, 0], lastPaidPeriod: null },
        { id: "demo-bill-card", name: "Cicilan laptop", amount: 2_150_000, dueDate: dateInMonth(month, 25), startDueDate: dateInMonth(previous, 25), category: "Tagihan", accountId: "demo-bank", liabilityAccountId: "demo-card", durationMonths: 12, paidCount: 2, remainingMonths: 10, completed: false, paid: false, frequency: "monthly", reminderDays: [7, 3, 1, 0], lastPaidPeriod: null },
      ],
      categories,
      auditLogs: [{ id: "demo-audit", action: "DEMO_STARTED", module: "system", actor: "demo@financial-planner.local", createdAt: nowIso(), details: "Workspace demo dibuat di browser." }],
      investmentAssets,
      investmentTransactions: [
        { id: "demo-invest-tx-1", assetId: "demo-asset-idx", accountId: "demo-investment", date: dateInMonth(previous, 12), type: "buy", units: 1250, pricePerUnit: 12_000, grossAmount: 15_000_000, fee: 0, tax: 0, netAmount: 15_000_000, averageCostAfter: 12_000, remainingUnitsAfter: 1250, realizedPl: 0, note: "Pembelian awal demo", createdAt: nowIso() },
      ],
    },
    roadmap: { horizonMonths: 24, incomeAdjustmentPct: 3, expenseAdjustmentPct: 2, annualInvestmentReturnPct: 7, annualInflationPct: 3, monthlyInvestment: 1_500_000 },
    debts: { settings: { strategy: "avalanche", extraMonthlyPayment: 500_000 }, debts: [{ accountId: "demo-card", name: "Kartu Kredit", balance: 2_150_000, annualInterestRatePct: 21, minimumPayment: 325_000, dueDay: 25 }] },
    forecast: { horizonDays: 60, monthlyIncomeOverride: 0, incomeDay: 1, minimumCashBuffer: 5_000_000 },
    emergency: { targetMonths: 6, monthlyExpenseOverride: 0, monthlyContribution: 1_500_000, accountIds: ["demo-bank", "demo-wallet"] },
    recurring: [
      { id: "demo-recurring-salary", name: "Gaji bulanan", type: "income", amount: 14_500_000, category: "Gaji", accountId: "demo-bank", frequency: "monthly", startDate: dateInMonth(twoMonthsAgo, 1), nextDueDate: dateInMonth(shiftMonth(month, 1), 1), isSubscription: false, active: true, lastPostedDate: dateInMonth(month, 1), updatedAt: nowIso() },
      { id: "demo-recurring-stream", name: "Streaming keluarga", type: "expense", amount: 159_000, category: "Hiburan", accountId: "demo-card", frequency: "monthly", startDate: dateInMonth(twoMonthsAgo, 18), nextDueDate: dateInMonth(month, 18), isSubscription: true, active: true, lastPostedDate: dateInMonth(previous, 18), updatedAt: nowIso() },
    ],
    notificationSettings: { enabled: true, billReminderDays: [7, 3, 1, 0], budgetWarningPercent: 75, backupWarningDays: 7, goalWarningDays: 30, emailEnabled: false, emailAddress: "", weeklyDigest: true },
    dismissedNotifications: [], aiMessages: [], reports: [], migrations: [], lastTransactionId: null,
    backups: [{ id: "demo-backup-initial", kind: "backup", filename: "financial-planner-demo.json", contentType: "application/json", sizeBytes: 28412, status: "ready", createdAt: nowIso(), downloadUrl: "#" }],
    backupSchedule: { enabled: true, frequency: "weekly", lastBackupAt: nowIso(), nextBackupAt: new Date(Date.now() + 7 * 86_400_000).toISOString(), mode: "on_access" },
  };
}

export function isFinanceDemoMode() {
  return typeof window !== "undefined" && window.__FINANCE_DEMO__ === true;
}

export function financeDemoWhatsAppUrl() {
  if (typeof window === "undefined") return null;
  try {
    const url = new URL(window.__FINANCE_DEMO_WHATSAPP_URL__ || "");
    return url.protocol === "https:" && ["wa.me", "api.whatsapp.com"].includes(url.hostname) ? url.href : null;
  } catch { return null; }
}

function readState(month: string) {
  if (!isFinanceDemoMode()) throw new Error("Mode demo tidak aktif.");
  const existing = demoStates.get(month);
  if (existing) return existing;
  const state = seedDemoState(month);
  demoStates.set(month, state);
  return state;
}

function currentMonth() {
  return new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", timeZone: "Asia/Jakarta" }).format(new Date());
}

function notificationOverview(state: DemoState) {
  const notifications = [
    { id: "demo-notice-bill", type: "bill_due", severity: "warning", title: "Tagihan kartu kredit mendekati jatuh tempo", message: "Siapkan Rp 2,15 jt sebelum tanggal 25.", actionPage: "bills", eventDate: state.snapshot.bills[1]?.dueDate ?? null, read: false, dismissed: false },
    { id: "demo-notice-goal", type: "goal", severity: "info", title: "Dana darurat sudah 62%", message: "Pertahankan kontribusi Rp 1,5 jt per bulan.", actionPage: "goals", eventDate: state.snapshot.goals[0]?.deadline ?? null, read: false, dismissed: false },
  ].filter((item) => !state.dismissedNotifications.includes(item.id));
  return { notifications, unreadCount: notifications.filter((item) => !item.read).length, generatedAt: nowIso(), settings: state.notificationSettings };
}

export function demoRequest<T = unknown>(action: string, payload: Record<string, unknown> = {}): T {
  const month = String(payload.month || currentMonth());
  const state = readState(month);
  const snapshot = state.snapshot;

  switch (action) {
    case "bootstrap": return structuredClone(snapshot) as T;
    case "licenseStatus": return premiumDemoEntitlement() as T;
    case "getRoadmapSettings": return structuredClone(state.roadmap) as T;
    case "getDebtPlanner": return structuredClone(state.debts) as T;
    case "getCashflowForecastSettings": return structuredClone(state.forecast) as T;
    case "getEmergencyFundSettings": return structuredClone(state.emergency) as T;
    case "listRecurring": return { templates: structuredClone(state.recurring) } as T;
    case "listTransactions": {
      const query = String(payload.query || "").toLocaleLowerCase("id-ID");
      const type = String(payload.type || "");
      const category = String(payload.category || "");
      const accountId = String(payload.accountId || "");
      const rows = snapshot.transactions.filter((item) =>
        (!query || `${item.title} ${item.merchant} ${item.category} ${item.notes}`.toLocaleLowerCase("id-ID").includes(query)) &&
        (!type || item.type === type) && (!category || item.category === category) && (!accountId || item.accountId === accountId));
      const page = Number(payload.page || 1);
      const pageSize = Number(payload.pageSize || 25);
      return { items: rows.slice((page - 1) * pageSize, page * pageSize), page, pageSize, total: rows.length, totalPages: Math.max(1, Math.ceil(rows.length / pageSize)) } as T;
    }
    case "inspectLedger": return { status: "healthy", storageMode: "calculated", revision: "demo-ledger", checkedAt: nowIso(), canRepair: false, accounts: snapshot.accounts.map((account) => ({ id: account.id, name: account.name, liability: Boolean(account.liability), active: true, openingBalance: account.openingBalance || 0, storedBalance: account.balance, expectedBalance: account.balance, difference: 0, valid: true })), issues: [], summary: { accountCount: snapshot.accounts.length, transactionCount: snapshot.transactions.length, completedTransactionCount: snapshot.transactions.filter((item) => item.status === "completed").length, driftCount: 0, totalAbsoluteDifference: 0, issueCount: 0 } } as T;
    case "aiSettings": return { provider: "openai-compatible", baseUrl: "", model: "demo-read-only", enabled: false, consentAccepted: false, configured: false, storesReceiptImages: false } as T;
    case "aiHistory": return { messages: [] } as T;
    case "listReports": return { reports: structuredClone(state.reports) } as T;
    case "backupOverview": return { schedule: state.backupSchedule, backups: structuredClone(state.backups) } as T;
    case "migrationHistory": return { migrations: structuredClone(state.migrations) } as T;
    case "notificationOverview": return notificationOverview(state) as T;
    default: throw new Error("Mode demo hanya-baca. Hubungi penjual untuk memakai fitur penyimpanan.");
  }
}

export function demoSecurityStatus() {
  return { authenticated: true, displayName: "Pengunjung Demo", email: null, provider: "Mode Demo", accessMode: "deployment_managed", workspaceIsolation: "server_enforced", sessionState: "local_preview", signOutUrl: null };
}
