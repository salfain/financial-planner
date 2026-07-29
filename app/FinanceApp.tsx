"use client";

import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  Activity,
  BarChart3,
  Bell,
  Bot,
  Building2,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  Clock3,
  Copy,
  CreditCard,
  Database,
  Download,
  Eye,
  EyeOff,
  FileText,
  FileUp,
  History,
  HardDrive,
  Landmark,
  KeyRound,
  LayoutDashboard,
  LockKeyhole,
  LogOut,
  Menu,
  Moon,
  MoreHorizontal,
  Paperclip,
  Pencil,
  Plus,
  ReceiptText,
  Repeat2,
  Route,
  Search,
  Send,
  Settings,
  SlidersHorizontal,
  Scale,
  ScanLine,
  ShieldCheck,
  Sparkles,
  Sun,
  Target,
  Tags,
  Trash2,
  TrendingUp,
  TrendingDown,
  TriangleAlert,
  Undo2,
  Upload,
  Umbrella,
  UserRound,
  WalletCards,
  X,
  type LucideIcon,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import type { AiChatMessage, AiSettingsStatus, OcrReceipt } from "../lib/ai";
import type { ReportSection } from "../lib/report";
import type { LedgerHealthReport } from "../lib/ledger";
import { buildFinancialRoadmap, DEFAULT_ROADMAP_SETTINGS, type RoadmapScenario, type RoadmapSettings } from "../lib/roadmap";
import { addMonthsToPeriod, compareDebtStrategies, DEFAULT_DEBT_SETTINGS, simulateDebtPayoff, type DebtPlan, type DebtPlannerSettings } from "../lib/debt";
import { buildCashflowForecast, DEFAULT_CASHFLOW_FORECAST_SETTINGS, type CashflowForecastSettings } from "../lib/cashflow-forecast";
import { buildEmergencyFundPlan, DEFAULT_EMERGENCY_FUND_SETTINGS, type EmergencyFundSettings } from "../lib/emergency-fund";
import { buildRecurringOverview, type RecurringTemplate } from "../lib/recurring";
import { addCalendarDays, buildFinancialCalendarEvents, calendarMonthRange, financialCalendarWindow, type FinancialCalendarEvent } from "../lib/financial-calendar";
import { accountCsvTemplate, previewAccountCsv, type AccountImportItem, type AccountImportPreview } from "../lib/account-import";
import { previewTransactionCsv, transactionCsvTemplate, type TransactionImportPreview } from "../lib/transaction-import";
import { byteArrayToBase64, type BackupOverview, type ExportRecord, type MigrationPreview } from "../lib/portability";
import { DEFAULT_NOTIFICATION_SETTINGS, type FinanceNotification, type NotificationOverview, type NotificationSettings } from "../lib/notifications";
import { financeDemoWhatsAppUrl, isFinanceDemoMode } from "../lib/demo-finance";
import { buildMonthlyReview, type MonthlyClosing } from "../lib/monthly-review";
import type { CategoryRule } from "../lib/category-rules";
import { formatMoneyInput, moneyInputDigits, moneyInputNumber } from "../lib/money-input";
import {
  currentInstallmentPhase,
  installmentAmountAt,
  installmentDuration,
  installmentPlanTotal,
  remainingInstallmentTotal,
} from "../lib/installment-phases";
import {
  DEFAULT_FEATURE_PREFERENCES,
  isOptionalFeatureEnabled,
  type FeaturePreferences,
  type OptionalFeatureKey,
} from "../lib/feature-preferences";
import {
  sinkingFundMonthlyNeed,
  sinkingFundProgress,
  sinkingFundRemaining,
  unallocatedCash,
  type SinkingFund,
  type SinkingFundEntry,
  type SinkingFundPurpose,
} from "../lib/sinking-funds";
import {
  Account,
  AuditLog,
  Bill,
  Budget,
  FinanceCategory,
  Goal,
  InvestmentAsset,
  InvestmentTransaction,
  Transaction,
  TransactionType,
  accountSummary,
  budgetSpent,
  calculateHealthScore,
  formatMonthLabel,
  formatIDR,
  getCurrentMonth,
  monthlySummary,
  recomputeAccountBalances,
} from "../lib/finance";
import {
  FinanceProfile,
  FinanceSecurityStatus,
  LoanDrawdownInput,
  SetupWorkspaceInput,
  activateFinanceLicense,
  askFinanceAi,
  archiveFinanceAccount,
  archiveFinanceCategory,
  clearFinanceAiMessages,
  contributeFinanceGoal,
  adjustFinanceSinkingFund,
  archiveFinanceSinkingFund,
  createFinanceAccount,
  createFinanceBackup,
  createFinanceBill,
  createFinanceCategory,
  createFinanceCategoryRule,
  createFinanceGoal,
  createFinanceSinkingFund,
  createFinanceInvestmentAsset,
  createFinanceInvestmentTrade,
  createFinanceLoanDrawdown,
  createFinanceReceivable,
  createFinanceTransaction,
  createFinanceRecurringTemplate,
  deleteFinanceBill,
  deleteFinanceBudget,
  deleteFinanceGoal,
  deleteFinanceCategoryRule,
  deleteFinanceTransaction,
  deleteFinanceTransactionReceipt,
  deactivateFinanceLicense,
  financeBackendLabel,
  getFinanceAiSettings,
  loadFinanceBackups,
  loadFinanceMigrations,
  loadFinanceLedgerHealth,
  loadFinanceNotifications,
  loadFinanceRoadmapSettings,
  loadFinanceDebtPlanner,
  loadFinanceCashflowForecastSettings,
  loadFinanceEmergencyFundSettings,
  loadFinanceRecurringTemplates,
  loadFinanceReports,
  loadFinanceSecurity,
  loadFinanceSnapshot,
  loadFinanceTransactions,
  loadFinanceAiMessages,
  loadFinanceMonthlyClosing,
  markFinanceBillPaid,
  importFinanceTransactions,
  importFinanceAccounts,
  isFinanceMutationCommittedError,
  reconcileFinanceAccount,
  repairFinanceLedger,
  setupFinanceWorkspace,
  scanFinanceReceipt,
  saveFinanceReport,
  updateFinanceCategory,
  updateFinanceCategoryRule,
  updateFinanceAccount,
  updateFinanceBill,
  updateFinanceBudget,
  updateFinanceGoal,
  updateFinanceSinkingFund,
  updateFinanceBackupSchedule,
  updateFinanceAiSettings,
  updateFinanceInvestmentAsset,
  updateFinanceNotificationSettings,
  updateFinanceNotificationStates,
  updateFinanceProfile,
  updateFinanceFeaturePreferences,
  updateFinanceRoadmapSettings,
  updateFinanceDebtPlannerSettings,
  upsertFinanceDebtPlan,
  updateFinanceCashflowForecastSettings,
  updateFinanceEmergencyFundSettings,
  confirmFinanceRecurring,
  setFinanceRecurringActive,
  updateFinanceTransaction,
  undoLastFinanceTransactionAction,
  uploadFinanceTransactionReceipt,
  financeTransactionReceiptUrl,
  upsertFinanceBudget,
  upgradeFinanceWorkspace,
  previewFinanceMigration,
  applyFinanceMigration,
  cancelFinanceMigration,
  closeFinanceMonthlyBook,
  reopenFinanceMonthlyBook,
} from "../lib/finance-client";
import { freeEntitlement, type PlanCapability, type PlanEntitlement } from "../lib/plans";
import { FINANCE_SCHEMA_VERSION } from "../lib/schema-version";

type PageKey =
  | "dashboard"
  | "roadmap"
  | "forecast"
  | "emergency"
  | "debts"
  | "transactions"
  | "accounts"
  | "receivables"
  | "budgets"
  | "goals"
  | "funds"
  | "bills"
  | "calendar"
  | "recurring"
  | "investments"
  | "review"
  | "reports"
  | "assistant"
  | "settings";

const currentMonth = () => getCurrentMonth();
const today = () => {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
};
const monthLabel = (month: string) => formatMonthLabel(month);

type NavItem = { key: PageKey; label: string; icon: LucideIcon };

const navGroups: Array<{ key: string; label: string; icon: LucideIcon; items: NavItem[] }> = [
  {
    key: "finance",
    label: "Keuangan",
    icon: WalletCards,
    items: [
      { key: "dashboard", label: "Ringkasan", icon: LayoutDashboard },
      { key: "transactions", label: "Transaksi", icon: ReceiptText },
      { key: "accounts", label: "Akun", icon: WalletCards },
      { key: "receivables", label: "Piutang", icon: UserRound },
      { key: "budgets", label: "Anggaran", icon: BarChart3 },
    ],
  },
  {
    key: "planning",
    label: "Perencanaan",
    icon: Target,
    items: [
      { key: "goals", label: "Target", icon: Target },
      { key: "funds", label: "Pos Dana", icon: CircleDollarSign },
      { key: "roadmap", label: "Roadmap", icon: Route },
      { key: "forecast", label: "Cashflow Forecast", icon: Activity },
      { key: "emergency", label: "Dana Darurat", icon: Umbrella },
    ],
  },
  {
    key: "liabilities",
    label: "Tagihan & Utang",
    icon: CreditCard,
    items: [
      { key: "bills", label: "Tagihan", icon: CalendarDays },
      { key: "calendar", label: "Kalender Keuangan", icon: Clock3 },
      { key: "recurring", label: "Transaksi Rutin", icon: Repeat2 },
      { key: "debts", label: "Pelunasan Utang", icon: TrendingDown },
    ],
  },
  {
    key: "insights",
    label: "Analisis & Sistem",
    icon: Sparkles,
    items: [
      { key: "investments", label: "Investasi", icon: TrendingUp },
      { key: "review", label: "Review Bulanan", icon: CheckCircle2 },
      { key: "reports", label: "Laporan", icon: FileText },
      { key: "assistant", label: "Insight", icon: Sparkles },
      { key: "settings", label: "Pengaturan", icon: Settings },
    ],
  },
];

const navPrimary = navGroups.flatMap((group) => group.items);

const featurePreferenceGroups: Array<{
  label: string;
  items: Array<{ key: OptionalFeatureKey; label: string; description: string }>;
}> = [
  {
    label: "Pengelolaan",
    items: [
      { key: "budgets", label: "Anggaran", description: "Batas pengeluaran dan realisasi kategori." },
      { key: "goals", label: "Target", description: "Tujuan finansial dan kontribusi berkala." },
      { key: "funds", label: "Pos Dana", description: "Alokasi dana untuk kebutuhan mendatang." },
    ],
  },
  {
    label: "Perencanaan",
    items: [
      { key: "roadmap", label: "Roadmap", description: "Simulasi kondisi finansial jangka panjang." },
      { key: "forecast", label: "Cashflow Forecast", description: "Proyeksi saldo dan kebutuhan kas." },
      { key: "emergency", label: "Dana Darurat", description: "Target perlindungan biaya hidup." },
    ],
  },
  {
    label: "Tagihan & utang",
    items: [
      { key: "bills", label: "Tagihan", description: "Tagihan rutin, cicilan, dan jatuh tempo." },
      { key: "calendar", label: "Kalender Keuangan", description: "Agenda finansial dalam tampilan kalender." },
      { key: "recurring", label: "Transaksi Rutin", description: "Template pemasukan dan pengeluaran berulang." },
      { key: "debts", label: "Pelunasan Utang", description: "Strategi avalanche dan snowball." },
    ],
  },
  {
    label: "Analisis",
    items: [
      { key: "investments", label: "Investasi", description: "Portofolio, transaksi aset, dan profit/loss." },
      { key: "review", label: "Review Bulanan", description: "Tutup buku dan snapshot bulanan." },
      { key: "reports", label: "Laporan", description: "Laporan PDF dan ringkasan keuangan." },
      { key: "assistant", label: "Insight AI", description: "Analisis AI berbasis data finansial." },
    ],
  },
];

const categoryColors: Record<string, string> = {
  Makanan: "#16876f",
  "Tempat Tinggal": "#d4685c",
  Tagihan: "#da9a3a",
  Transportasi: "#4e79c7",
  Hiburan: "#aa67a6",
  Pendapatan: "#16876f",
  Investasi: "#5574b8",
  Transfer: "#89918d",
  Kesehatan: "#d26b7a",
  Kewajiban: "#d4685c",
};

const pageTitles: Record<PageKey, { eyebrow: string; title: string; subtitle: string }> = {
  dashboard: { eyebrow: "Ringkasan", title: "Ringkasan keuangan", subtitle: "Semua angka dihitung dari ledger yang tersimpan." },
  roadmap: { eyebrow: "Perencanaan masa depan", title: "Financial Roadmap", subtitle: "Uji asumsi dan lihat kemungkinan perjalanan finansialmu sebelum mengambil keputusan." },
  forecast: { eyebrow: "Likuiditas ke depan", title: "Cashflow Forecast", subtitle: "Antisipasi pemasukan, biaya hidup, dan tagihan sebelum saldo kas memasuki zona kritis." },
  emergency: { eyebrow: "Financial safety", title: "Emergency Fund Planner", subtitle: "Ukur ketahanan finansial dan bangun dana darurat dengan target yang realistis." },
  transactions: { eyebrow: "Ledger utama", title: "Semua transaksi", subtitle: "Pantau setiap pergerakan uang tanpa menghitung transfer dua kali." },
  accounts: { eyebrow: "6 akun aktif", title: "Akun & saldo", subtitle: "Semua rekening, dompet, kewajiban, dan investasi dalam satu tampilan." },
  receivables: { eyebrow: "Uang dipinjamkan", title: "Piutang", subtitle: "Catat uang yang dipinjam orang lain dan pantau sisa yang belum dikembalikan." },
  budgets: { eyebrow: "Rencana Juli", title: "Anggaran bulanan", subtitle: "Kendalikan pengeluaran sebelum melewati batas yang kamu tentukan." },
  goals: { eyebrow: "3 target aktif", title: "Target finansial", subtitle: "Lihat kemajuan dan kebutuhan kontribusi bulanan untuk setiap tujuan." },
  funds: { eyebrow: "Dana terencana", title: "Sinking Fund / Pos Dana", subtitle: "Pisahkan tujuan penggunaan uang tanpa mengubah saldo akun atau menghitung dana dua kali." },
  bills: { eyebrow: "3 menunggu", title: "Tagihan rutin", subtitle: "Jangan lewatkan jatuh tempo dan hindari pencatatan ganda." },
  calendar: { eyebrow: "Jadwal terpadu", title: "Kalender keuangan", subtitle: "Lihat pemasukan, tagihan, cicilan, dan deadline target dalam satu garis waktu." },
  recurring: { eyebrow: "Recurring tracker", title: "Transaksi rutin & langganan", subtitle: "Rencanakan pemasukan, biaya tetap, dan renewal tanpa mencatat saldo secara otomatis." },
  debts: { eyebrow: "Strategi pelunasan", title: "Debt Payoff Planner", subtitle: "Bandingkan metode avalanche dan snowball, lalu lihat kapan kamu bisa bebas utang." },
  investments: { eyebrow: "Portofolio", title: "Portofolio investasi", subtitle: "Pantau unit, cost basis, harga, dan profit/loss tanpa mengubah arus kas operasional." },
  review: { eyebrow: "Kontrol bulanan", title: "Review & tutup buku", subtitle: "Periksa hasil bulan berjalan, simpan snapshot, lalu kunci ledger ketika semuanya sudah sesuai." },
  reports: { eyebrow: "Laporan bulanan", title: "Laporan keuangan", subtitle: "Ringkasan siap cetak dengan data yang dapat ditelusuri kembali." },
  assistant: { eyebrow: "AI universal · read-only", title: "Financial Insight", subtitle: "Tanyakan kondisi keuanganmu dengan konteks terpilih dan kontrol privasi yang jelas." },
  settings: { eyebrow: "Workspace personal", title: "Pengaturan", subtitle: "Kelola preferensi, keamanan data, backup, dan koneksi Google." },
};

const validDate = (date: string) => /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(new Date(`${date}T12:00:00`).getTime());
const shortDate = (date: string) => validDate(date)
  ? new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short" }).format(new Date(`${date}T12:00:00`))
  : "Belum diatur";
const shortMonth = (date: string) => validDate(date)
  ? new Intl.DateTimeFormat("id-ID", { month: "short" }).format(new Date(`${date}T12:00:00`)).toUpperCase()
  : "—";

function BrandMark() {
  return <span className="brand-mark">FP</span>;
}

function Amount({ value, privacy, compact = false, className = "" }: { value: number; privacy: boolean; compact?: boolean; className?: string }) {
  return <span className={className}>{privacy ? "Rp ••••••••" : formatIDR(value, compact)}</span>;
}

function ProgressBar({ value, color, label }: { value: number; color: string; label?: string }) {
  const safe = Math.min(Math.max(value, 0), 100);
  return (
    <div className="progress-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(safe)} aria-label={label}>
      <span className="progress-value" style={{ width: `${safe}%`, background: color }} />
    </div>
  );
}

function NavButton({ item, active, onClick, locked = false, requiredTier }: { item: { key: PageKey; label: string; icon: LucideIcon }; active: boolean; onClick: () => void; locked?: boolean; requiredTier?: "Pro" | "Premium" }) {
  const Icon = item.icon;
  return (
    <button className={`nav-item ${active ? "active" : ""} ${locked ? "locked" : ""}`} onClick={onClick} aria-current={active ? "page" : undefined}>
      <Icon size={19} strokeWidth={active ? 2.4 : 1.8} />
      <span>{item.label}</span>
      {locked && <small className="nav-plan-lock"><LockKeyhole size={11} />{requiredTier}</small>}
    </button>
  );
}

function NotificationIcon({ notification }: { notification: FinanceNotification }) {
  if (notification.type === "budget") return <BarChart3 size={17} />;
  if (notification.type === "goal") return <Target size={17} />;
  if (notification.type === "backup") return <Database size={17} />;
  if (notification.type === "investment_price") return <TrendingUp size={17} />;
  return <CalendarDays size={17} />;
}

export function FinanceApp() {
  const [activePage, setActivePage] = useState<PageKey>("dashboard");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [sinkingFunds, setSinkingFunds] = useState<SinkingFund[]>([]);
  const [sinkingFundEntries, setSinkingFundEntries] = useState<SinkingFundEntry[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [categories, setCategories] = useState<FinanceCategory[]>([]);
  const [categoryRules, setCategoryRules] = useState<CategoryRule[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [investmentAssets, setInvestmentAssets] = useState<InvestmentAsset[]>([]);
  const [investmentTransactions, setInvestmentTransactions] = useState<InvestmentTransaction[]>([]);
  const [notificationOverview, setNotificationOverview] = useState<NotificationOverview | null>(null);
  const [profile, setProfile] = useState<FinanceProfile>({ name: "Pemilik", storeName: "Financial Planner", currency: "IDR", timezone: "Asia/Jakarta" });
  const [featurePreferences, setFeaturePreferences] = useState<FeaturePreferences>({ ...DEFAULT_FEATURE_PREFERENCES });
  const [configured, setConfigured] = useState(false);
  const [schemaVersion, setSchemaVersion] = useState("legacy");
  const [entitlement, setEntitlement] = useState<PlanEntitlement>(() => freeEntitlement("setup-pending"));
  const [licenseOpen, setLicenseOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);
  const [privacy, setPrivacy] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [transactionOpen, setTransactionOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [duplicatingTransaction, setDuplicatingTransaction] = useState<Transaction | null>(null);
  const [transactionImportOpen, setTransactionImportOpen] = useState(false);
  const [accountImportOpen, setAccountImportOpen] = useState(false);
  const [reconcileTarget, setReconcileTarget] = useState<Account | null>(null);
  const [categoryModal, setCategoryModal] = useState<{ category?: FinanceCategory } | null>(null);
  const [categoryRuleModal, setCategoryRuleModal] = useState<{ rule?: CategoryRule } | null>(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [receivableOpen, setReceivableOpen] = useState(false);
  const [receivablePayment, setReceivablePayment] = useState<Account | null>(null);
  const [loanDrawdownOpen, setLoanDrawdownOpen] = useState(false);
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const [goalOpen, setGoalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [goalProgressTarget, setGoalProgressTarget] = useState<Goal | null>(null);
  const [sinkingFundModal, setSinkingFundModal] = useState<{ fund?: SinkingFund } | null>(null);
  const [sinkingFundAdjustment, setSinkingFundAdjustment] = useState<{ fund: SinkingFund; type: "allocate" | "release" } | null>(null);
  const [billOpen, setBillOpen] = useState(false);
  const [editingBill, setEditingBill] = useState<Bill | null>(null);
  const [paymentBill, setPaymentBill] = useState<Bill | null>(null);
  const [investmentAssetModal, setInvestmentAssetModal] = useState<{ asset?: InvestmentAsset } | null>(null);
  const [investmentTradeModal, setInvestmentTradeModal] = useState<{ type: "buy" | "sell"; asset?: InvestmentAsset } | null>(null);
  const [transactionQuery, setTransactionQuery] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const month = currentMonth();
  const demoMode = hydrated && isFinanceDemoMode();
  const demoWhatsAppUrl = demoMode ? financeDemoWhatsAppUrl() : null;

  const applySnapshot = (snapshot: Awaited<ReturnType<typeof loadFinanceSnapshot>>) => {
    setConfigured(snapshot.configured);
    setSchemaVersion(snapshot.schemaVersion);
    setEntitlement(snapshot.entitlement);
    setProfile(snapshot.profile);
    setAccounts(snapshot.accounts);
    setTransactions(snapshot.transactions);
    setBudgets(snapshot.budgets);
    setGoals(snapshot.goals);
    setSinkingFunds(snapshot.sinkingFunds);
    setSinkingFundEntries(snapshot.sinkingFundEntries);
    setBills(snapshot.bills);
    setCategories(snapshot.categories);
    setCategoryRules(snapshot.categoryRules);
    setAuditLogs(snapshot.auditLogs);
    setInvestmentAssets(snapshot.investmentAssets);
    setInvestmentTransactions(snapshot.investmentTransactions);
    setFeaturePreferences(snapshot.featurePreferences);
  };

  const refreshData = async () => {
    const snapshot = await loadFinanceSnapshot(month);
    applySnapshot(snapshot);
    loadFinanceNotifications(month).then(setNotificationOverview).catch(() => undefined);
  };

  const refreshNotifications = async () => {
    const result = await loadFinanceNotifications(month);
    setNotificationOverview(result);
    return result;
  };

  useEffect(() => {
    const themeTimer = window.setTimeout(() => {
      setDarkMode(window.localStorage.getItem("vinn-store-theme") === "dark");
      setHydrated(true);
    }, 0);
    loadFinanceSnapshot(month)
      .then((snapshot) => {
        applySnapshot(snapshot);
        setDataError(null);
      })
      .catch((error) => setDataError(error instanceof Error ? error.message : "Data keuangan tidak dapat dimuat."))
      .finally(() => setLoading(false));
    loadFinanceNotifications(month).then(setNotificationOverview).catch(() => undefined);
    return () => window.clearTimeout(themeTimer);
  }, [month]);

  useEffect(() => {
    document.documentElement.dataset.theme = darkMode ? "dark" : "light";
    if (hydrated) window.localStorage.setItem("vinn-store-theme", darkMode ? "dark" : "light");
  }, [darkMode, hydrated]);

  useEffect(() => {
    const focusSearch = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setActivePage("transactions");
        document.getElementById("global-transaction-search")?.focus();
      }
    };
    window.addEventListener("keydown", focusSearch);
    return () => window.removeEventListener("keydown", focusSearch);
  }, []);

  const monthly = monthlySummary(transactions, month);
  const investmentMarketValue = useMemo(() => investmentAssets.reduce((sum, asset) => sum + asset.marketValue, 0), [investmentAssets]);
  const accountTotals = useMemo(() => accountSummary(accounts, investmentMarketValue), [accounts, investmentMarketValue]);
  const healthScore = calculateHealthScore(transactions, accounts, budgets, month);

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 2800);
  };

  const pageCapability = (page: PageKey): PlanCapability | null => {
    if (["roadmap", "forecast", "emergency", "debts", "calendar", "funds"].includes(page)) return "planning";
    if (page === "recurring") return "recurring";
    if (page === "investments") return "investments";
    if (page === "reports") return "pdf_reports";
    if (page === "review") return "pdf_reports";
    if (page === "assistant") return "ai";
    return null;
  };

  const requirePlan = (capability: PlanCapability) => {
    if (entitlement.capabilities[capability]) return true;
    setLicenseOpen(true);
    setSidebarOpen(false);
    showToast(`Fitur ini memerlukan paket ${capability === "investments" || capability === "ai" || capability === "ocr" ? "Premium" : "Pro"}.`);
    return false;
  };

  const selectPage = (page: PageKey) => {
    if (!isOptionalFeatureEnabled(featurePreferences, page)) {
      setActivePage("settings");
      setSidebarOpen(false);
      showToast("Fitur tersebut sedang dinonaktifkan. Aktifkan kembali melalui Pengaturan.");
      return;
    }
    const capability = pageCapability(page);
    if (capability && !requirePlan(capability)) return;
    setActivePage(page);
    setSidebarOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const runMutation = async (work: () => Promise<unknown>, successMessage: string) => {
    if (saving) return false;
    setSaving(true);
    try {
      await work();
      setDataError(null);
      showToast(successMessage);
      void refreshData()
        .then(() => {
        setDataError(null);
        })
        .catch((error) => {
          const message = error instanceof Error ? error.message : "Data terbaru belum dapat dimuat.";
          setDataError(message);
          showToast("Perubahan tersimpan; sinkronisasi tampilan perlu dicoba kembali.");
        });
      return true;
    } catch (error) {
      if (isFinanceMutationCommittedError(error)) {
        setDataError(null);
        showToast(successMessage);
        void refreshData().catch((refreshError) => {
          setDataError(refreshError instanceof Error ? refreshError.message : "Data terbaru belum dapat dimuat.");
        });
        return true;
      }
      showToast(error instanceof Error ? error.message : "Perubahan tidak dapat disimpan.");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const addTransaction = async (transaction: Transaction, _requestId?: string, receiptFile?: File) => runMutation(
    async () => {
      await createFinanceTransaction(transaction);
      if (receiptFile) await uploadFinanceTransactionReceipt(transaction.id, receiptFile);
    },
    transaction.type === "transfer" ? "Transfer berhasil dicatat secara utuh." : "Transaksi berhasil disimpan.",
  );

  const editTransaction = async (transaction: Transaction, requestId?: string, receiptFile?: File, removeReceipt?: boolean) => runMutation(
    async () => {
      await updateFinanceTransaction(transaction, requestId);
      if (receiptFile) await uploadFinanceTransactionReceipt(transaction.id, receiptFile);
      else if (removeReceipt && transaction.receipt) await deleteFinanceTransactionReceipt(transaction.id, transaction.receipt.id);
    },
    "Transaksi dan saldo terkait berhasil diperbarui.",
  );

  const importTransactions = async (items: Transaction[]) => runMutation(
    () => importFinanceTransactions(items),
    `${items.length} transaksi CSV berhasil diimpor.`,
  );

  const importAccounts = async (items: AccountImportItem[]) => runMutation(
    () => importFinanceAccounts(items),
    `${items.length} akun beserta saldo awal berhasil diimpor.`,
  );

  const recordLoanDrawdown = async (payload: LoanDrawdownInput) => runMutation(
    () => createFinanceLoanDrawdown(payload),
    "Pinjaman tercatat: uang diterima, total kewajiban, dan biaya pembiayaan sudah sinkron.",
  );

  const undoLastTransaction = async () => runMutation(
    () => undoLastFinanceTransactionAction(),
    "Aksi transaksi terakhir berhasil dibatalkan.",
  );

  const payBill = async (bill: Bill) => {
    if (bill.paid) return;
    if (bill.category === "Kewajiban" && !bill.liabilityAccountId) {
      showToast("Gunakan Tambah transaksi > Transfer ke akun kartu kredit agar pembayaran tidak menjadi pengeluaran ganda.");
      return;
    }
    setPaymentBill(bill);
  };

  const submitBillPayment = async (bill: Bill, amount: number, fee: number, settlement: boolean) => runMutation(
    () => markFinanceBillPaid(bill, month, today(), { amount, fee, settlement }),
    settlement
      ? `${bill.name} dilunasi dan saldo kewajiban diperbarui.`
      : `${bill.name} dibayar; progres cicilan dan saldo sudah diperbarui.`,
  );

  const payBillGroup = async (account: Account, groupBills: Bill[]) => {
    const unpaidBills = groupBills.filter((bill) => !bill.paid && !bill.completed);
    if (!unpaidBills.length) return;
    const total = unpaidBills.reduce((sum, bill) => sum + bill.amount, 0);
    const requiredByAccount = unpaidBills.reduce<Map<string, number>>((result, bill) => result.set(bill.accountId, (result.get(bill.accountId) ?? 0) + bill.amount), new Map());
    const insufficientAccount = [...requiredByAccount].find(([accountId, required]) => (accounts.find((item) => item.id === accountId)?.balance ?? 0) < required);
    if (insufficientAccount) {
      const source = accounts.find((item) => item.id === insufficientAccount[0]);
      showToast(`Saldo ${source?.name ?? "akun pembayaran"} tidak cukup untuk membayar tagihan gabungan.`);
      return;
    }
    if (account.balance < total) {
      showToast(`Total pembayaran melebihi saldo utang ${account.name}. Periksa kembali nominal cicilan.`);
      return;
    }
    if (!window.confirm(`Bayar ${unpaidBills.length} cicilan ${account.name} dengan total ${formatIDR(total)}?`)) return;
    await runMutation(
      async () => {
        for (const bill of unpaidBills) {
          try {
            await markFinanceBillPaid(bill, month, today());
          } catch (error) {
            if (!isFinanceMutationCommittedError(error)) throw error;
          }
        }
      },
      `${unpaidBills.length} cicilan ${account.name} berhasil dibayar.`,
    );
  };

  const adjustGoalProgress = async (goal: Goal, amount: number, mode: "add" | "withdraw") => runMutation(
    () => contributeFinanceGoal(goal.id, amount, mode),
    mode === "add" ? `Progress ${goal.name} bertambah ${formatIDR(amount)}.` : `Progress ${goal.name} berkurang ${formatIDR(amount)}.`,
  );

  const deleteTransaction = async (transaction: Transaction) => {
    await runMutation(() => deleteFinanceTransaction(transaction.id, transaction.updatedAt), "Transaksi dipindahkan ke Trash.");
  };

  const archiveAccount = async (accountId: string) => {
    await runMutation(() => archiveFinanceAccount(accountId), "Akun berhasil diarsipkan.");
  };

  const removeBudget = async (budget: Budget) => runMutation(() => deleteFinanceBudget(budget.id), `Anggaran ${budget.category} berhasil dihapus.`);
  const removeGoal = async (goal: Goal) => runMutation(() => deleteFinanceGoal(goal.id), `Target ${goal.name} berhasil dihapus.`);
  const removeSinkingFund = async (fund: SinkingFund) => runMutation(
    () => archiveFinanceSinkingFund(fund.id),
    `Pos dana ${fund.name} berhasil diarsipkan. Saldo akun tidak berubah.`,
  );
  const removeBill = async (bill: Bill) => runMutation(() => deleteFinanceBill(bill.id), `Tagihan ${bill.name} berhasil dihapus.`);

  const reconcileAccount = async (account: Account, actualBalance: number, date: string, note: string, requestId: string) => runMutation(
    () => reconcileFinanceAccount(account.id, actualBalance, date, note, requestId),
    actualBalance === account.balance ? "Saldo akun sudah cocok." : "Saldo berhasil direkonsiliasi dan jejak penyesuaian dibuat.",
  );

  const syncInstallmentLiability = async (account: Account, schedules: Bill[]) => {
    const totals = schedules.map(remainingInstallmentTotal);
    if (totals.some((value) => value === null)) {
      showToast("Saldo otomatis hanya tersedia untuk cicilan yang memiliki tenor.");
      return;
    }
    const remaining = totals.reduce<number>((sum, value) => sum + Number(value || 0), 0);
    if (remaining === account.balance) {
      showToast(`Saldo ${account.name} sudah sama dengan sisa cicilan.`);
      return;
    }
    if (!window.confirm(`Selaraskan saldo ${account.name} dari ${formatIDR(account.balance)} menjadi ${formatIDR(remaining)} sesuai sisa seluruh cicilan? Jejak penyesuaian akan disimpan.`)) return;
    await reconcileAccount(account, remaining, today(), "Sinkronisasi otomatis dari sisa jadwal cicilan", `installment-sync:${account.id}:${crypto.randomUUID()}`);
  };

  const saveCategory = async (payload: { name: string; type: "income" | "expense"; color: string }, category?: FinanceCategory, requestId?: string) => runMutation(
    () => category
      ? updateFinanceCategory(category.id, payload, requestId)
      : createFinanceCategory(payload, requestId),
    category ? "Kategori berhasil diperbarui." : "Kategori baru berhasil dibuat.",
  );

  const archiveCategory = async (categoryId: string) => {
    await runMutation(() => archiveFinanceCategory(categoryId), "Kategori berhasil diarsipkan.");
  };

  const saveCategoryRule = async (payload: Omit<CategoryRule, "id" | "createdAt" | "updatedAt">, rule?: CategoryRule) => runMutation(
    () => rule ? updateFinanceCategoryRule(rule.id, payload) : createFinanceCategoryRule(payload),
    rule ? "Aturan kategori berhasil diperbarui." : "Aturan kategori berhasil ditambahkan.",
  );

  const removeCategoryRule = async (ruleId: string) => {
    await runMutation(() => deleteFinanceCategoryRule(ruleId), "Aturan kategori berhasil dihapus.");
  };

  const saveOwnerProfile = async (name: string) => runMutation(
    () => updateFinanceProfile(name),
    "Nama pemilik berhasil diperbarui.",
  );

  const saveInvestmentAsset = async (payload: Record<string, unknown>, asset?: InvestmentAsset, requestId?: string) => runMutation(
    () => asset
      ? updateFinanceInvestmentAsset(asset.id, { ...payload, expectedUpdatedAt: asset.updatedAt }, requestId)
      : createFinanceInvestmentAsset(payload, requestId),
    asset ? "Aset dan harga investasi berhasil diperbarui." : "Aset investasi berhasil dibuat.",
  );

  const saveInvestmentTrade = async (payload: Record<string, unknown>, requestId?: string) => runMutation(
    () => createFinanceInvestmentTrade(payload, requestId),
    payload.type === "sell" ? "Penjualan dan realized P/L berhasil dicatat." : "Pembelian dan cost basis berhasil dicatat.",
  );

  const updateNotificationState = async (ids: string[], action: "read" | "unread" | "dismiss" | "restore") => {
    if (!ids.length) return;
    setNotificationOverview((current) => {
      if (!current) return current;
      const selected = new Set(ids);
      const notifications = current.notifications
        .map((item) => selected.has(item.id)
          ? { ...item, read: action === "read" || action === "dismiss" ? true : action === "unread" ? false : item.read, dismissed: action === "dismiss" ? true : action === "restore" ? false : item.dismissed }
          : item)
        .filter((item) => !item.dismissed);
      return { ...current, notifications, unreadCount: notifications.filter((item) => !item.read).length };
    });
    try {
      await updateFinanceNotificationStates(ids, action);
    } catch (reason) {
      await refreshNotifications().catch(() => undefined);
      showToast(reason instanceof Error ? reason.message : "Status notifikasi tidak dapat disimpan.");
    }
  };

  const openNotification = (notification: FinanceNotification) => {
    if (!notification.read) void updateNotificationState([notification.id], "read");
    selectPage(notification.actionPage);
    setNotificationOpen(false);
  };

  const saveNotificationSettings = async (settings: NotificationSettings) => {
    const result = await updateFinanceNotificationSettings(settings);
    await refreshNotifications();
    return result.settings;
  };

  const saveFeaturePreferences = async (preferences: FeaturePreferences) => {
    if (saving) return false;
    setSaving(true);
    try {
      const saved = await updateFinanceFeaturePreferences(preferences);
      setFeaturePreferences(saved);
      if (!isOptionalFeatureEnabled(saved, activePage)) setActivePage("dashboard");
      setDataError(null);
      showToast("Pilihan fitur berhasil disimpan.");
      return true;
    } catch (reason) {
      showToast(reason instanceof Error ? reason.message : "Pilihan fitur tidak dapat disimpan.");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const openCreateForPage = () => {
    if (activePage === "accounts") return setAccountOpen(true);
    if (activePage === "receivables") return setReceivableOpen(true);
    if (activePage === "budgets") return setBudgetOpen(true);
    if (activePage === "goals") return setGoalOpen(true);
    if (activePage === "funds") return setSinkingFundModal({});
    if (activePage === "bills") return setBillOpen(true);
    if (activePage === "investments") return setInvestmentAssetModal({});
    setTransactionOpen(true);
  };

  const createLabel = activePage === "accounts" ? "Tambah akun" : activePage === "receivables" ? "Catat piutang" : activePage === "budgets" ? "Tambah anggaran" : activePage === "goals" ? "Buat target" : activePage === "funds" ? "Buat pos dana" : activePage === "bills" ? "Tambah tagihan" : activePage === "investments" ? "Tambah aset" : "Tambah transaksi";
  const notifications = notificationOverview?.notifications ?? [];
  const unreadNotifications = notificationOverview?.unreadCount ?? 0;

  const title = { ...pageTitles[activePage] };
  if (activePage === "dashboard") { title.eyebrow = monthLabel(month); title.title = `Selamat datang, ${profile.name}`; }
  if (activePage === "roadmap") title.eyebrow = `Proyeksi mulai ${monthLabel(month)}`;
  if (activePage === "forecast") title.eyebrow = "Proyeksi dari hari ini";
  if (activePage === "emergency") title.eyebrow = "Perlindungan finansial";
  if (activePage === "accounts") title.eyebrow = `${accounts.length} akun aktif`;
  if (activePage === "budgets") title.eyebrow = `Rencana ${monthLabel(month)}`;
  if (activePage === "goals") title.eyebrow = `${goals.length} target aktif`;
  if (activePage === "funds") title.eyebrow = `${sinkingFunds.length} pos aktif`;
  if (activePage === "bills") title.eyebrow = `${bills.filter((bill) => !bill.paid).length} menunggu`;
  if (activePage === "calendar") title.eyebrow = `Jadwal mulai ${monthLabel(month)}`;
  if (activePage === "debts") title.eyebrow = `${accounts.filter((account) => account.liability).length} akun kewajiban`;
  if (activePage === "investments") title.eyebrow = `${investmentAssets.length} aset aktif`;
  if (activePage === "reports") title.eyebrow = `Laporan ${monthLabel(month)}`;
  if (activePage === "settings") title.eyebrow = `Workspace ${profile.storeName}`;

  if (loading) return <LoadingWorkspace />;
  if (!configured) return <SetupWizard error={dataError} saving={saving} onRetry={() => {
    setLoading(true);
    refreshData().then(() => setDataError(null)).catch((error) => setDataError(error instanceof Error ? error.message : "Gagal memuat data.")).finally(() => setLoading(false));
  }} onSubmit={async (input) => {
    setSaving(true);
    try {
      const snapshot = await setupFinanceWorkspace(input, month);
      applySnapshot(snapshot);
      setDataError(null);
    } catch (error) {
      setDataError(error instanceof Error ? error.message : "Setup tidak dapat diselesaikan.");
    } finally { setSaving(false); }
  }} />;

  return (
    <div className="app-shell">
      <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="sidebar-head">
          <button className="brand" onClick={() => selectPage("dashboard")} aria-label="Buka dashboard Financial Planner">
            <BrandMark />
            <span className="brand-copy"><strong>{profile.storeName}</strong><small>Personal Finance</small></span>
          </button>
          <button className="icon-button sidebar-close" onClick={() => setSidebarOpen(false)} aria-label="Tutup menu"><X size={20} /></button>
        </div>
        <nav className="sidebar-nav" aria-label="Navigasi utama">
          {navGroups.map((group) => {
            const GroupIcon = group.icon;
            const visibleItems = group.items.filter((item) => isOptionalFeatureEnabled(featurePreferences, item.key));
            const containsActivePage = visibleItems.some((item) => item.key === activePage);
            if (!visibleItems.length) return null;
            return <section className={`nav-group ${containsActivePage ? "contains-active" : ""}`} key={group.key}>
              <div className="nav-group-label">
                <GroupIcon size={17} />
                <span>{group.label}</span>
              </div>
              <div className="nav-group-items">
                {visibleItems.map((item) => {
                  const capability = pageCapability(item.key);
                  const locked = Boolean(capability && !entitlement.capabilities[capability]);
                  return <NavButton key={item.key} item={item} active={activePage === item.key} onClick={() => selectPage(item.key)} locked={locked} requiredTier={capability === "investments" || capability === "ai" ? "Premium" : "Pro"} />;
                })}
              </div>
            </section>;
          })}
        </nav>
        <div className="sidebar-card" title={demoMode ? "Mode demo menggunakan data contoh hanya-baca." : "Data finansial tersimpan permanen dan divalidasi oleh ledger."}>
          <span className="sidebar-card-icon"><Database size={17} /></span>
          <span className="sidebar-card-copy"><strong>{financeBackendLabel()}</strong><small className="status-pill"><span /> {demoMode ? "Demo read-only" : "Terhubung"}</small></span>
        </div>
        <button className="profile-row" onClick={() => demoMode ? showToast("Semua fitur Premium sudah terbuka selama mode demo.") : setLicenseOpen(true)} aria-label={`Paket aktif ${entitlement.label}`}>
          <div className="avatar">{profile.name.slice(0, 2).toUpperCase()}</div>
          <div><strong>{profile.name}</strong><small>Owner · <b className={`plan-badge ${entitlement.tier}`}>{entitlement.label}</b></small></div>
          <MoreHorizontal size={18} />
        </button>
      </aside>

      {sidebarOpen && <button className="sidebar-scrim" onClick={() => setSidebarOpen(false)} aria-label="Tutup menu" />}

      <main className="main-area">
        <header className="topbar">
          <button className="icon-button mobile-menu" onClick={() => setSidebarOpen(true)} aria-label="Buka menu"><Menu size={20} /></button>
          <label className="global-search" htmlFor="global-transaction-search">
            <Search size={18} />
            <input id="global-transaction-search" aria-label="Cari transaksi" placeholder="Cari transaksi, akun, atau kategori..." value={transactionQuery} onChange={(event) => { setTransactionQuery(event.target.value); setActivePage("transactions"); }} onFocus={() => activePage !== "transactions" && setActivePage("transactions")} />
            <kbd>⌘ K</kbd>
          </label>
          <div className="topbar-actions">
            <button className="privacy-toggle" onClick={() => setPrivacy((value) => !value)} aria-pressed={privacy} title="Privacy mode">
              {privacy ? <EyeOff size={17} /> : <Eye size={17} />}<span>{privacy ? "Tampilkan" : "Sembunyikan"}</span>
            </button>
            <button className="icon-button theme-toggle" onClick={() => setDarkMode((value) => !value)} aria-label={darkMode ? "Gunakan tema terang" : "Gunakan tema gelap"}>
              {darkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <div className="notification-wrap">
              <button className="icon-button" onClick={() => { const next = !notificationOpen; setNotificationOpen(next); if (next) void refreshNotifications().catch(() => undefined); }} aria-label={`Notifikasi${unreadNotifications ? `, ${unreadNotifications} belum dibaca` : ""}`} aria-expanded={notificationOpen}>
                <Bell size={18} />{unreadNotifications > 0 && <span className="notification-dot" />}
              </button>
              {notificationOpen && (
                <div className="notification-popover">
                  <div className="popover-head"><span><strong>Notification center</strong><small>{unreadNotifications ? `${unreadNotifications} belum dibaca` : "Semua sudah dibaca"}</small></span>{unreadNotifications > 0 && <button onClick={() => void updateNotificationState(notifications.filter((item) => !item.read).map((item) => item.id), "read")}>Tandai semua</button>}</div>
                  <div className="notification-list">
                    {notifications.slice(0, 8).map((notification) => <div className={`notification-item ${notification.read ? "read" : ""}`} key={notification.id}><button className="notification-main" onClick={() => openNotification(notification)}><span className={`notice-icon ${notification.severity}`}><NotificationIcon notification={notification} /></span><span><strong>{notification.title}</strong><small>{notification.message}</small></span></button><button className="notification-dismiss" onClick={() => void updateNotificationState([notification.id], "dismiss")} aria-label={`Arsipkan notifikasi ${notification.title}`} title="Arsipkan"><X size={14} /></button></div>)}
                    {!notifications.length && <button className="notification-empty" onClick={() => { selectPage("settings"); setNotificationOpen(false); }}><span className="notice-icon good"><Check size={17} /></span><span><strong>Semua aman</strong><small>Tidak ada reminder aktif saat ini.</small></span></button>}
                  </div>
                  <button className="notification-settings-link" onClick={() => { selectPage("settings"); setNotificationOpen(false); }}><Settings size={14} /> Atur reminder</button>
                </div>
              )}
            </div>
            <button className="primary-button top-add" onClick={() => setTransactionOpen(true)}><Plus size={18} /> Transaksi</button>
          </div>
        </header>

        {demoMode && <section className="demo-banner" aria-label="Mode demo aktif">
          <span className="demo-banner-icon"><Sparkles size={17} /></span>
          <div><strong>Mode Demo Premium · hanya-baca</strong><small>Semua menu terbuka dengan data contoh. Penyimpanan, AI, OCR, backup, dan migrasi dinonaktifkan.</small></div>
          {demoWhatsAppUrl && <a href={demoWhatsAppUrl} target="_blank" rel="noreferrer"><Send size={15} /> Beli via WhatsApp</a>}
        </section>}

        <div className="page-wrap">
          {dataError && <div className="data-alert"><span><Database size={17} /></span><div><strong>Sinkronisasi perlu perhatian</strong><small>{dataError}</small></div><button onClick={() => refreshData().then(() => setDataError(null)).catch((error) => setDataError(error instanceof Error ? error.message : "Gagal memuat data."))}>Coba lagi</button></div>}
          <section className="page-heading">
            <div><span className="eyebrow">{title.eyebrow}</span><h1>{title.title}</h1><p>{title.subtitle}</p></div>
            {activePage !== "dashboard" && activePage !== "roadmap" && activePage !== "forecast" && activePage !== "emergency" && activePage !== "debts" && activePage !== "calendar" && activePage !== "recurring" && activePage !== "assistant" && activePage !== "settings" && activePage !== "review" && (
              <button className="primary-button" onClick={() => activePage === "investments" ? requirePlan("investments") && openCreateForPage() : openCreateForPage()}><Plus size={18} /> {createLabel}</button>
            )}
          </section>

          {activePage === "dashboard" && <DashboardPage transactions={transactions} accounts={accounts} budgets={budgets} bills={bills} goals={goals} privacy={privacy} monthly={monthly} accountTotals={accountTotals} healthScore={healthScore} month={month} onNavigate={selectPage} onAdd={() => setTransactionOpen(true)} />}
          {activePage === "roadmap" && <RoadmapPage month={month} transactions={transactions} accounts={accounts} goals={goals} investmentAssets={investmentAssets} privacy={privacy} onToast={showToast} />}
          {activePage === "forecast" && <CashflowForecastPage transactions={transactions} accounts={accounts} bills={bills} privacy={privacy} onToast={showToast} />}
          {activePage === "emergency" && <EmergencyFundPage month={month} transactions={transactions} accounts={accounts} privacy={privacy} onToast={showToast} />}
          {activePage === "debts" && <DebtPayoffPage month={month} accounts={accounts} privacy={privacy} onToast={showToast} />}
          {activePage === "transactions" && <TransactionsPage transactions={transactions} accounts={accounts} categories={categories} privacy={privacy} month={month} query={transactionQuery} onQueryChange={setTransactionQuery} onEdit={setEditingTransaction} onDuplicate={setDuplicatingTransaction} onDelete={deleteTransaction} onImport={() => requirePlan("imports") && setTransactionImportOpen(true)} onUndo={undoLastTransaction} saving={saving} />}
          {activePage === "accounts" && <AccountsPage accounts={accounts} privacy={privacy} onAdd={() => setAccountOpen(true)} onBorrow={() => setLoanDrawdownOpen(true)} onImport={() => requirePlan("imports") && setAccountImportOpen(true)} onEdit={setEditingAccount} onArchive={archiveAccount} onReconcile={setReconcileTarget} onInspect={(account) => { setTransactionQuery(account.name); selectPage("transactions"); }} />}
          {activePage === "receivables" && <ReceivablesPage accounts={accounts} privacy={privacy} onAdd={() => setReceivableOpen(true)} onReceive={setReceivablePayment} onHistory={(account) => { setTransactionQuery(account.name); selectPage("transactions"); }} />}
          {activePage === "budgets" && <BudgetsPage budgets={budgets} transactions={transactions} privacy={privacy} month={month} onAdd={() => setBudgetOpen(true)} onEdit={setEditingBudget} onDelete={removeBudget} />}
          {activePage === "goals" && <GoalsPage goals={goals} privacy={privacy} onProgress={setGoalProgressTarget} onEdit={setEditingGoal} onDelete={removeGoal} onAdd={() => setGoalOpen(true)} />}
          {activePage === "funds" && <SinkingFundsPage funds={sinkingFunds} entries={sinkingFundEntries} accounts={accounts} privacy={privacy} onAdd={() => setSinkingFundModal({})} onEdit={(fund) => setSinkingFundModal({ fund })} onAdjust={(fund, type) => setSinkingFundAdjustment({ fund, type })} onDelete={removeSinkingFund} />}
          {activePage === "bills" && <BillsPage bills={bills} accounts={accounts} privacy={privacy} saving={saving} onPay={payBill} onPayAll={payBillGroup} onSyncLiability={syncInstallmentLiability} onEdit={setEditingBill} onDelete={removeBill} onAdd={() => setBillOpen(true)} />}
          {activePage === "calendar" && <FinancialCalendarPage accounts={accounts} bills={bills} goals={goals} privacy={privacy} initialMonth={month} />}
          {activePage === "recurring" && <RecurringPage accounts={accounts} categories={categories} privacy={privacy} onRefresh={refreshData} onToast={showToast} />}
          {activePage === "investments" && <InvestmentsPage assets={investmentAssets} transactions={investmentTransactions} accounts={accounts} privacy={privacy} onAddAsset={() => setInvestmentAssetModal({})} onEditAsset={(asset) => setInvestmentAssetModal({ asset })} onTrade={(type, asset) => setInvestmentTradeModal({ type, asset })} />}
          {activePage === "review" && <MonthlyReviewPage period={month} transactions={transactions} accounts={accounts} budgets={budgets} goals={goals} bills={bills} privacy={privacy} onToast={showToast} />}
          {activePage === "reports" && <ReportsPage period={month} profile={profile} transactions={transactions} accounts={accounts} budgets={budgets} goals={goals} bills={bills} categories={categories} investmentAssets={investmentAssets} investmentTransactions={investmentTransactions} monthly={monthly} accountTotals={accountTotals} privacy={privacy} onToast={showToast} />}
          {activePage === "assistant" && <AssistantPage period={month} onOpenSettings={() => selectPage("settings")} />}
          {activePage === "settings" && <SettingsPage profile={profile} entitlement={entitlement} onOpenLicense={() => demoMode ? showToast("Aktivasi lisensi tidak diperlukan di mode demo.") : setLicenseOpen(true)} saving={saving} darkMode={darkMode} setDarkMode={setDarkMode} privacy={privacy} setPrivacy={setPrivacy} featurePreferences={featurePreferences} categories={categories} categoryRules={categoryRules} auditLogs={auditLogs} backendLabel={financeBackendLabel()} schemaVersion={schemaVersion} notificationSettings={notificationOverview?.settings ?? DEFAULT_NOTIFICATION_SETTINGS} onSaveProfile={saveOwnerProfile} onSaveFeaturePreferences={saveFeaturePreferences} onSaveNotificationSettings={saveNotificationSettings} onAddCategory={() => setCategoryModal({})} onEditCategory={(category) => setCategoryModal({ category })} onArchiveCategory={archiveCategory} onAddCategoryRule={() => requirePlan("imports") && setCategoryRuleModal({})} onEditCategoryRule={(rule) => requirePlan("imports") && setCategoryRuleModal({ rule })} onDeleteCategoryRule={removeCategoryRule} onToast={showToast} onRefresh={refreshData} />}
        </div>
      </main>

      <nav className="mobile-nav" aria-label="Navigasi seluler">
        {navPrimary.filter((item) => ["dashboard", "transactions", "budgets", "goals"].includes(item.key) && isOptionalFeatureEnabled(featurePreferences, item.key)).map((item) => <NavButton key={item.key} item={item} active={activePage === item.key} onClick={() => selectPage(item.key)} />)}
        <button className="mobile-add" onClick={() => setTransactionOpen(true)} aria-label="Tambah transaksi"><Plus size={23} /></button>
      </nav>

      {(transactionOpen || editingTransaction || duplicatingTransaction) && <TransactionModal accounts={accounts} categories={categories} transactions={transactions} initial={editingTransaction ?? duplicatingTransaction ?? undefined} mode={editingTransaction ? "edit" : duplicatingTransaction ? "duplicate" : "create"} saving={saving} onClose={() => { setTransactionOpen(false); setEditingTransaction(null); setDuplicatingTransaction(null); }} onSubmit={editingTransaction ? editTransaction : addTransaction} />}
      {transactionImportOpen && <TransactionImportModal accounts={accounts} categories={categories} categoryRules={categoryRules} existingTransactions={transactions} saving={saving} onClose={() => setTransactionImportOpen(false)} onSubmit={async (items) => { const ok = await importTransactions(items); if (ok) setTransactionImportOpen(false); return ok; }} />}
      {accountImportOpen && <AccountImportModal accounts={accounts} saving={saving} onClose={() => setAccountImportOpen(false)} onSubmit={async (items) => { const ok = await importAccounts(items); if (ok) setAccountImportOpen(false); return ok; }} />}
      {(accountOpen || editingAccount) && <AccountModal account={editingAccount ?? undefined} saving={saving} onClose={() => { setAccountOpen(false); setEditingAccount(null); }} onSubmit={async (payload) => { const ok = await runMutation(() => editingAccount ? updateFinanceAccount(editingAccount.id, payload) : createFinanceAccount(payload), editingAccount ? "Akun berhasil diperbarui." : "Akun baru berhasil ditambahkan."); if (ok) { setAccountOpen(false); setEditingAccount(null); } }} />}
      {loanDrawdownOpen && <LoanDrawdownModal accounts={accounts} saving={saving} onClose={() => setLoanDrawdownOpen(false)} onSubmit={async (transaction) => { const ok = await recordLoanDrawdown(transaction); if (ok) setLoanDrawdownOpen(false); return ok; }} />}
      {receivableOpen && <ReceivableModal accounts={accounts} saving={saving} onClose={() => setReceivableOpen(false)} onSubmit={async (payload) => { const ok = await runMutation(() => createFinanceReceivable(payload), "Piutang dan perpindahan dananya berhasil dicatat."); if (ok) setReceivableOpen(false); }} />}
      {receivablePayment && <ReceivablePaymentModal receivable={receivablePayment} accounts={accounts} privacy={privacy} saving={saving} onClose={() => setReceivablePayment(null)} onSubmit={async (destinationAccountId, amount, date) => { const ok = await runMutation(() => createFinanceTransaction({ id: `tx-${crypto.randomUUID()}`, type: "transfer", date, title: `Pembayaran piutang - ${receivablePayment.name}`, merchant: receivablePayment.institution, category: "Transfer", accountId: receivablePayment.id, destinationAccountId, amount, status: "completed" }), amount >= receivablePayment.balance ? "Piutang sudah lunas." : "Pembayaran piutang berhasil dicatat."); if (ok) setReceivablePayment(null); }} />}
      {(budgetOpen || editingBudget) && <BudgetModal budget={editingBudget ?? undefined} month={month} categories={categories} saving={saving} onClose={() => { setBudgetOpen(false); setEditingBudget(null); }} onSubmit={async (payload) => { const ok = await runMutation(() => editingBudget ? updateFinanceBudget(editingBudget.id, payload) : upsertFinanceBudget(payload), "Anggaran berhasil disimpan."); if (ok) { setBudgetOpen(false); setEditingBudget(null); } }} />}
      {(goalOpen || editingGoal) && <GoalModal goal={editingGoal ?? undefined} saving={saving} onClose={() => { setGoalOpen(false); setEditingGoal(null); }} onSubmit={async (payload) => { const ok = await runMutation(() => editingGoal ? updateFinanceGoal(editingGoal.id, payload) : createFinanceGoal(payload), editingGoal ? "Target finansial berhasil diperbarui." : "Target finansial berhasil dibuat."); if (ok) { setGoalOpen(false); setEditingGoal(null); } }} />}
      {goalProgressTarget && <GoalProgressModal goal={goalProgressTarget} privacy={privacy} saving={saving} onClose={() => setGoalProgressTarget(null)} onSubmit={async (amount, mode) => { const ok = await adjustGoalProgress(goalProgressTarget, amount, mode); if (ok) setGoalProgressTarget(null); }} />}
      {sinkingFundModal && <SinkingFundModal fund={sinkingFundModal.fund} accounts={accounts} funds={sinkingFunds} saving={saving} onClose={() => setSinkingFundModal(null)} onSubmit={async (payload) => { const current = sinkingFundModal.fund; const ok = await runMutation(() => current ? updateFinanceSinkingFund(current.id, payload) : createFinanceSinkingFund(payload), current ? "Pos dana berhasil diperbarui." : "Pos dana berhasil dibuat tanpa mengubah saldo akun."); if (ok) setSinkingFundModal(null); }} />}
      {sinkingFundAdjustment && <SinkingFundAdjustmentModal fund={sinkingFundAdjustment.fund} type={sinkingFundAdjustment.type} saving={saving} onClose={() => setSinkingFundAdjustment(null)} onSubmit={async (amount, date, note) => { const action = sinkingFundAdjustment; const ok = await runMutation(() => adjustFinanceSinkingFund(action.fund.id, amount, action.type, date, note), action.type === "allocate" ? `${formatIDR(amount)} dialokasikan ke ${action.fund.name}.` : `${formatIDR(amount)} dilepas dari ${action.fund.name}.`); if (ok) setSinkingFundAdjustment(null); }} />}
      {(billOpen || editingBill) && <BillModal bill={editingBill ?? undefined} accounts={accounts} categories={categories} saving={saving} onClose={() => { setBillOpen(false); setEditingBill(null); }} onSubmit={async (payload) => { const ok = await runMutation(() => editingBill ? updateFinanceBill(editingBill.id, payload) : createFinanceBill(payload), editingBill ? "Tagihan berhasil diperbarui." : "Tagihan rutin berhasil ditambahkan."); if (ok) { setBillOpen(false); setEditingBill(null); } }} />}
      {paymentBill && <BillPaymentModal bill={paymentBill} privacy={privacy} saving={saving} onClose={() => setPaymentBill(null)} onSubmit={async (amount, fee, settlement) => { const ok = await submitBillPayment(paymentBill, amount, fee, settlement); if (ok) setPaymentBill(null); }} />}
      {reconcileTarget && <ReconcileModal account={reconcileTarget} privacy={privacy} saving={saving} onClose={() => setReconcileTarget(null)} onSubmit={async (actualBalance, date, note, requestId) => { const ok = await reconcileAccount(reconcileTarget, actualBalance, date, note, requestId); if (ok) setReconcileTarget(null); }} />}
      {categoryModal && <CategoryModal category={categoryModal.category} saving={saving} onClose={() => setCategoryModal(null)} onSubmit={async (payload, requestId) => { const ok = await saveCategory(payload, categoryModal.category, requestId); if (ok) setCategoryModal(null); }} />}
      {categoryRuleModal && <CategoryRuleModal rule={categoryRuleModal.rule} categories={categories} saving={saving} onClose={() => setCategoryRuleModal(null)} onSubmit={async (payload) => { const ok = await saveCategoryRule(payload, categoryRuleModal.rule); if (ok) setCategoryRuleModal(null); }} />}
      {investmentAssetModal && <InvestmentAssetModal asset={investmentAssetModal.asset} accounts={accounts} saving={saving} onClose={() => setInvestmentAssetModal(null)} onSubmit={async (payload, requestId) => { const ok = await saveInvestmentAsset(payload, investmentAssetModal.asset, requestId); if (ok) setInvestmentAssetModal(null); }} />}
      {investmentTradeModal && <InvestmentTradeModal type={investmentTradeModal.type} initialAsset={investmentTradeModal.asset} assets={investmentAssets} accounts={accounts} privacy={privacy} saving={saving} onClose={() => setInvestmentTradeModal(null)} onSubmit={async (payload, requestId) => { const ok = await saveInvestmentTrade(payload, requestId); if (ok) setInvestmentTradeModal(null); }} />}
      {licenseOpen && <LicenseModal entitlement={entitlement} onClose={() => setLicenseOpen(false)} onChanged={async (next) => { setEntitlement(next); await refreshData(); showToast(`Paket ${next.label} aktif.`); }} />}
      {toast && <div className="toast"><span><Check size={16} /></span>{toast}</div>}
    </div>
  );
}

function DashboardPage({ transactions, accounts, budgets, bills, goals, privacy, monthly, accountTotals, healthScore, month, onNavigate, onAdd }: {
  transactions: Transaction[]; accounts: Account[]; budgets: Budget[]; bills: Bill[]; goals: Goal[]; privacy: boolean; month: string;
  monthly: ReturnType<typeof monthlySummary>; accountTotals: ReturnType<typeof accountSummary>; healthScore: number;
  onNavigate: (page: PageKey) => void; onAdd: () => void;
}) {
  const visibleBudgets = budgets.length ? budgets : [...new Set(transactions.filter((item) => item.type === "expense").map((item) => item.category))].map((category, index) => ({ id: `category-${index}`, category, limit: 0, color: Object.values(categoryColors)[index % Object.values(categoryColors).length] }));
  const expenseByCategory = visibleBudgets.map((budget) => ({ ...budget, value: budgetSpent(transactions, budget.category, month) }));
  const categoryTotal = expenseByCategory.reduce((sum, item) => sum + item.value, 0);
  const daysInMonth = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate();
  const endDay = Math.max(1, Math.min(daysInMonth, Number(today().slice(-2))));
  const startDay = Math.max(1, endDay - 13);
  const dailySeries = Array.from({ length: endDay - startDay + 1 }, (_, index) => {
    const day = startDay + index;
    const date = `${month}-${String(day).padStart(2, "0")}`;
    const items = transactions.filter((item) => item.date === date && item.status === "completed");
    return {
      day,
      income: items.filter((item) => item.type === "income").reduce((sum, item) => sum + item.amount, 0),
      expense: items.filter((item) => item.type === "expense").reduce((sum, item) => sum + item.amount, 0),
    };
  });
  const chartMax = Math.max(1, ...dailySeries.flatMap((item) => [item.income, item.expense]));
  let gradientCursor = 0;
  const donutGradient = categoryTotal > 0 ? `conic-gradient(${expenseByCategory.filter((item) => item.value > 0).map((item) => {
    const start = gradientCursor;
    gradientCursor += item.value / categoryTotal * 100;
    return `${item.color} ${start.toFixed(2)}% ${gradientCursor.toFixed(2)}%`;
  }).join(", ")})` : "conic-gradient(var(--surface-strong) 0 100%)";
  const upcomingBills = [...bills].filter((bill) => !bill.paid).sort((a, b) => a.dueDate.localeCompare(b.dueDate)).slice(0, 3);
  const recent = [...transactions].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6);
  const healthLabel = healthScore >= 80 ? "Sehat" : healthScore >= 60 ? "Baik" : healthScore >= 40 ? "Cukup" : "Perlu perhatian";
  const consumerLiabilities = accounts.filter((account) => account.liability && ["Paylater", "Credit Card"].includes(account.type));
  const longTermLiabilities = accounts.filter((account) => account.liability && ["Loan", "Mortgage"].includes(account.type));
  const activeInstallments = bills.filter((bill) => bill.liabilityAccountId && !bill.completed);
  const nearestInstallment = [...activeInstallments].filter((bill) => !bill.paid).sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];
  const wealthHistory = Array.from({ length: 7 }, (_, index) => {
    const period = addMonthsToPeriod(month, index - 6);
    const endDate = `${period}-${String(new Date(Number(period.slice(0, 4)), Number(period.slice(5, 7)), 0).getDate()).padStart(2, "0")}`;
    const balances = recomputeAccountBalances(accounts, transactions.filter((item) => item.date <= endDate));
    return { period, ...accountSummary(balances) };
  });
  const wealthValues = wealthHistory.map((point) => point.netWorth);
  const wealthMin = Math.min(...wealthValues);
  const wealthMax = Math.max(...wealthValues);
  const wealthSpan = Math.max(1, wealthMax - wealthMin);
  const wealthChartPoints = wealthHistory.map((point, index) => ({
    ...point,
    x: 2 + index * (96 / Math.max(1, wealthHistory.length - 1)),
    y: wealthMax === wealthMin ? 52 : 86 - (point.netWorth - wealthMin) / wealthSpan * 68,
  }));
  const wealthPolyline = wealthChartPoints.map((point) => `${point.x},${point.y}`).join(" ");
  const wealthArea = `2,88 ${wealthPolyline} 98,88`;
  const wealthChange = wealthHistory.at(-1)!.netWorth - wealthHistory[0].netWorth;

  return (
    <div className="dashboard-grid">
      <section className="hero-card">
        <div className="hero-copy">
          <span className="card-kicker"><span className="live-dot" /> Kekayaan bersih</span>
          <Amount value={accountTotals.netWorth} privacy={privacy} className="hero-value" />
          <div className="positive-change"><ShieldCheck size={15} /> Ledger aktif <span>saldo dapat dihitung ulang</span></div>
        </div>
        <div className="hero-mini-stats">
          <div><span>Total aset</span><Amount value={accountTotals.assets} privacy={privacy} /><small>{accounts.filter((item) => !item.liability).length} akun aset</small></div>
          <div><span>Total kewajiban</span><Amount value={accountTotals.liabilities} privacy={privacy} /><small className="muted-change">{accounts.filter((item) => item.liability).length} akun kewajiban</small></div>
        </div>
        <div className="hero-liability-details" aria-label="Rincian kewajiban">
          <button type="button" onClick={() => onNavigate("bills")}>
            <span>Paylater & kartu</span>
            <Amount value={consumerLiabilities.reduce((sum, account) => sum + account.balance, 0)} privacy={privacy} />
            <small>{consumerLiabilities.length} akun</small>
          </button>
          <button type="button" onClick={() => onNavigate("bills")}>
            <span>Kredit & pinjaman</span>
            <Amount value={longTermLiabilities.reduce((sum, account) => sum + account.balance, 0)} privacy={privacy} />
            <small>{longTermLiabilities.length} kontrak</small>
          </button>
          <button type="button" onClick={() => onNavigate("bills")}>
            <span>Cicilan bulan ini</span>
            <Amount value={activeInstallments.reduce((sum, bill) => sum + bill.amount, 0)} privacy={privacy} />
            <small>{activeInstallments.length} jadwal aktif</small>
          </button>
          <button type="button" onClick={() => onNavigate("bills")}>
            <span>Jatuh tempo terdekat</span>
            <strong>{nearestInstallment ? shortDate(nearestInstallment.dueDate) : "Tidak ada"}</strong>
            <small>{nearestInstallment?.name ?? "Belum ada cicilan"}</small>
          </button>
        </div>
        <div className="hero-pattern" aria-hidden="true"><span /><span /><span /><span /><span /></div>
      </section>

      <section className="health-card">
        <div className="card-title-row"><div><span className="card-kicker">Skor kesehatan</span><h2>Kondisi finansial</h2></div></div>
        <div className="health-content">
          <div className="score-ring" style={{ "--score": `${healthScore * 3.6}deg` } as React.CSSProperties}><div><strong>{healthScore}</strong><small>/100</small></div></div>
          <div><span className="health-label">{healthLabel}</span><p>Skor dihitung deterministik dari savings rate, likuiditas, utang, dan kepatuhan anggaran.</p><button className="text-button" onClick={() => onNavigate("reports")}>Lihat analisis <ArrowRight size={15} /></button></div>
        </div>
      </section>

      <section className="panel wealth-trend-panel">
        <div className="card-title-row"><div><span className="card-kicker">Riwayat kekayaan</span><h2>Perkembangan 7 bulan</h2></div><span className={`wealth-trend-change ${wealthChange >= 0 ? "positive-text" : "negative-text"}`}>{wealthChange >= 0 ? "+" : ""}{privacy ? "••••" : formatIDR(wealthChange)}</span></div>
        <div className="wealth-trend-chart">
          <div className="wealth-trend-plot">
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label="Grafik perkembangan kekayaan bersih tujuh bulan">
              <line x1="2" y1="18" x2="98" y2="18" />
              <line x1="2" y1="52" x2="98" y2="52" />
              <line x1="2" y1="86" x2="98" y2="86" />
              <polygon points={wealthArea} fill="var(--primary-soft)" />
              <polyline points={wealthPolyline} fill="none" stroke="var(--primary)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
            </svg>
            {wealthChartPoints.map((point) => <i key={point.period} className="wealth-trend-point" style={{ left: `${point.x}%`, top: `${point.y}%` }} aria-hidden="true" />)}
          </div>
          <div className="wealth-trend-labels">{wealthHistory.map((point, index) => <span className={index === 0 ? "wealth-label-key wealth-label-start" : index === 3 ? "wealth-label-key wealth-label-middle" : index === wealthHistory.length - 1 ? "wealth-label-key wealth-label-end" : ""} key={point.period}><small>{shortMonth(`${point.period}-01`)}</small><strong>{privacy ? "••••" : formatIDR(point.netWorth, true)}</strong></span>)}</div>
        </div>
      </section>

      <section className="metric-card income">
        <span className="metric-icon"><ArrowDownLeft size={19} /></span>
        <div><span>Pemasukan bulan ini</span><Amount value={monthly.income} privacy={privacy} className="metric-value" /><small>Di luar transfer internal</small></div>
      </section>
      <section className="metric-card expense">
        <span className="metric-icon"><ArrowUpRight size={19} /></span>
        <div><span>Pengeluaran bulan ini</span><Amount value={monthly.expense} privacy={privacy} className="metric-value" /><small>Refund sudah dikurangkan</small></div>
      </section>
      <section className="metric-card cashflow">
        <span className="metric-icon"><TrendingUp size={19} /></span>
        <div><span>Arus kas bersih</span><Amount value={monthly.cashflow} privacy={privacy} className="metric-value" /><small><strong>{monthly.savingsRate.toFixed(1)}%</strong> savings rate</small></div>
      </section>

      <section className="panel cashflow-panel">
        <div className="card-title-row"><div><span className="card-kicker">Arus kas</span><h2>Pemasukan vs pengeluaran</h2></div><div className="chart-legend"><span className="legend-income" /> Masuk <span className="legend-expense" /> Keluar</div></div>
        <div className="bar-chart" aria-label="Grafik arus kas dua minggu terakhir">
          {dailySeries.map((item, index) => <div className="bar-column" key={item.day}><span className="bar-income" style={{ height: `${item.income ? Math.max(4, item.income / chartMax * 100) : 0}%` }} /><span className="bar-expense" style={{ height: `${item.expense ? Math.max(4, item.expense / chartMax * 100) : 0}%` }} /><small>{index % 2 === 0 ? item.day : ""}</small></div>)}
        </div>
        <div className="chart-summary"><span><i className="green-dot" /> Total masuk <strong>{privacy ? "Rp ••••" : formatIDR(monthly.income)}</strong></span><span><i className="red-dot" /> Total keluar <strong>{privacy ? "Rp ••••" : formatIDR(monthly.expense)}</strong></span></div>
      </section>

      <section className="panel category-panel">
        <div className="card-title-row"><div><span className="card-kicker">Pengeluaran</span><h2>Per kategori</h2></div><button className="text-button" onClick={() => onNavigate("budgets")}>Detail <ArrowRight size={14} /></button></div>
        <div className="donut-wrap">
          <div className="donut" style={{ background: donutGradient }}><div><small>Total</small><Amount value={categoryTotal} privacy={privacy} compact /></div></div>
          <div className="category-list">
            {expenseByCategory.filter((item) => item.value > 0).map((item) => <div key={item.id}><span className="category-name"><i style={{ background: item.color }} />{item.category}</span><strong>{privacy ? "••••" : formatIDR(item.value, true)}</strong></div>)}
            {!categoryTotal && <p className="dashboard-empty">Belum ada pengeluaran bulan ini.</p>}
          </div>
        </div>
      </section>

      <section className="panel accounts-panel">
        <div className="card-title-row"><div><span className="card-kicker">Likuiditas</span><h2>Saldo akun</h2></div><button className="text-button" onClick={() => onNavigate("accounts")}>Semua akun <ArrowRight size={14} /></button></div>
        <div className="account-list">
          {accounts.filter((account) => account.type !== "Investment").slice(0, 4).map((account) => <div className="account-row" key={account.id}>
            <span className="account-logo" style={{ background: `${account.color}18`, color: account.color }}>{account.type === "Bank" ? <Landmark size={19} /> : account.liability ? <CreditCard size={19} /> : <WalletCards size={19} />}</span>
            <span><strong>{account.name}</strong><small>{[account.institution, account.mask].filter(Boolean).join(" · ") || account.type}</small></span>
            <Amount value={account.balance} privacy={privacy} className={account.liability ? "negative-text" : ""} />
          </div>)}
          {!accounts.length && <button className="dashboard-empty action" onClick={() => onNavigate("accounts")}>Tambahkan akun pertama</button>}
        </div>
      </section>

      <section className="panel bills-panel">
        <div className="card-title-row"><div><span className="card-kicker">Mendatang</span><h2>Tagihan terdekat</h2></div><button className="text-button" onClick={() => onNavigate("bills")}>Lihat semua <ArrowRight size={14} /></button></div>
        <div className="bill-list">
          {upcomingBills.map((bill, index) => <button key={bill.id} onClick={() => onNavigate("bills")}><span className={`date-box ${index === 0 ? "urgent" : ""}`}><small>{shortMonth(bill.dueDate)}</small><strong>{validDate(bill.dueDate) ? bill.dueDate.slice(-2) : "—"}</strong></span><span><strong>{bill.name}</strong><small>{bill.category}</small></span><Amount value={bill.amount} privacy={privacy} /></button>)}
          {!upcomingBills.length && <button className="dashboard-empty action bill-empty-action" onClick={() => onNavigate("bills")}>Belum ada tagihan mendatang</button>}
        </div>
      </section>

      <section className="panel goals-panel">
        <div className="card-title-row"><div><span className="card-kicker">Target</span><h2>Progress tujuanmu</h2></div><button className="text-button" onClick={() => onNavigate("goals")}>Kelola <ArrowRight size={14} /></button></div>
        <div className="mini-goals">
          {goals.slice(0, 2).map((goal) => { const percent = goal.target > 0 ? goal.current / goal.target * 100 : 0; return <div key={goal.id}><span className="goal-icon" style={{ color: goal.color, background: `${goal.color}16` }}><Target size={18} /></span><div><span><strong>{goal.name}</strong><b>{percent.toFixed(0)}%</b></span><ProgressBar value={percent} color={goal.color} label={`Progress ${goal.name}`} /><small><Amount value={goal.current} privacy={privacy} /> dari <Amount value={goal.target} privacy={privacy} /></small></div></div>; })}
          {!goals.length && <button className="dashboard-empty action" onClick={() => onNavigate("goals")}>Belum ada target finansial</button>}
        </div>
      </section>

      <section className="panel recent-panel">
        <div className="card-title-row"><div><span className="card-kicker">Aktivitas</span><h2>Transaksi terbaru</h2></div><button className="primary-button compact" onClick={onAdd}><Plus size={16} /> Tambah</button></div>
        <TransactionTable transactions={recent} accounts={accounts} privacy={privacy} compact />
        {!recent.length && <div className="dashboard-empty">Belum ada aktivitas. Tambahkan transaksi pertamamu.</div>}
      </section>

      <section className="insight-card">
        <div className="insight-top"><span><Sparkles size={18} /></span><small>FINANCIAL INSIGHT</small></div>
        <h2>Arus kas bulan ini <strong>{monthly.cashflow >= 0 ? "positif" : "perlu perhatian"}</strong>.</h2>
        <p>{monthly.income > 0 ? `Savings rate berada di ${monthly.savingsRate.toFixed(1)}%. Insight ini dihitung langsung dari transaksi yang tersimpan.` : "Tambahkan pemasukan dan pengeluaran agar sistem dapat menyusun insight berdasarkan ledger-mu."}</p>
        <button onClick={() => onNavigate("assistant")}>Buka Financial Insight <ArrowRight size={15} /></button>
      </section>
    </div>
  );
}

function TransactionsPage({ transactions, accounts, categories, privacy, month, query, onQueryChange, onEdit, onDuplicate, onDelete, onImport, onUndo, saving }: {
  transactions: Transaction[];
  accounts: Account[];
  categories: FinanceCategory[];
  privacy: boolean;
  month: string;
  query: string;
  onQueryChange: (value: string) => void;
  onEdit: (transaction: Transaction) => void;
  onDuplicate: (transaction: Transaction) => void;
  onDelete: (transaction: Transaction) => void;
  onImport: () => void;
  onUndo: () => Promise<boolean>;
  saving: boolean;
}) {
  const [filter, setFilter] = useState<"all" | "income" | "expense" | "transfer" | "adjustment">("all");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [accountFilter, setAccountFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [listing, setListing] = useState({ transactions: transactions.slice(0, 20), page: 1, pageSize: 20, total: transactions.length, totalPages: Math.max(1, Math.ceil(transactions.length / 20)) });
  const [listingLoading, setListingLoading] = useState(false);
  const [listingError, setListingError] = useState("");
  useEffect(() => {
    let active = true;
    queueMicrotask(() => { if (active) setListingLoading(true); });
    loadFinanceTransactions({ page, pageSize: 20, query, type: filter === "all" ? "" : filter, category: categoryFilter, accountId: accountFilter, status: statusFilter, dateFrom, dateTo })
      .then((result) => { if (active) { if (page > result.totalPages) setPage(result.totalPages); else setListing(result); setListingError(""); } })
      .catch((reason) => { if (active) setListingError(reason instanceof Error ? reason.message : "Daftar transaksi tidak dapat dimuat."); })
      .finally(() => { if (active) setListingLoading(false); });
    return () => { active = false; };
  }, [page, query, filter, categoryFilter, accountFilter, statusFilter, dateFrom, dateTo, transactions]);
  const monthTransactions = transactions.filter((item) => item.date.startsWith(month));
  const monthlyTotals = monthlySummary(monthTransactions, month);
  const updateFilter = (setter: (value: string) => void, value: string) => { setter(value); setPage(1); };
  return <div className="content-stack">
    <div className="summary-strip">
      <div><span>Total transaksi</span><strong>{monthTransactions.length}</strong><small>{monthLabel(month)}</small></div>
      <div><span>Pemasukan</span><Amount value={monthlyTotals.income} privacy={privacy} /><small className="positive-text">Bulan aktif</small></div>
      <div><span>Pengeluaran</span><Amount value={monthlyTotals.expense} privacy={privacy} /><small>Di luar transfer</small></div>
      <div><span>Transfer internal</span><Amount value={monthTransactions.filter((item) => item.type === "transfer").reduce((sum, item) => sum + item.amount, 0)} privacy={privacy} /><small>Tidak masuk cashflow</small></div>
    </div>
    <section className="panel table-panel">
      <div className="filter-row">
        <label className="table-search"><Search size={17} /><input value={query} onChange={(event) => { setPage(1); onQueryChange(event.target.value); }} placeholder="Cari merchant, catatan, tag, atau lokasi" /></label>
        <div className="filter-tabs">{(["all", "income", "expense", "transfer", "adjustment"] as const).map((item) => <button key={item} className={filter === item ? "active" : ""} onClick={() => { setFilter(item); setPage(1); }}>{item === "all" ? "Semua" : item === "income" ? "Masuk" : item === "expense" ? "Keluar" : item === "transfer" ? "Transfer" : "Penyesuaian"}</button>)}</div>
        <div className="transaction-toolbar-actions"><button className="secondary-button" onClick={() => void onUndo()} disabled={saving}><Undo2 size={16} /> Undo terakhir</button><button className="secondary-button" onClick={onImport}><FileUp size={16} /> Impor CSV</button></div>
      </div>
      <div className="advanced-filter-row">
        <label><span>Kategori</span><select value={categoryFilter} onChange={(event) => updateFilter(setCategoryFilter, event.target.value)}><option value="">Semua kategori</option>{categories.filter((item) => item.active && ["income", "expense"].includes(item.type)).map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}</select></label>
        <label><span>Akun</span><select value={accountFilter} onChange={(event) => updateFilter(setAccountFilter, event.target.value)}><option value="">Semua akun</option>{accounts.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label><span>Status</span><select value={statusFilter} onChange={(event) => updateFilter(setStatusFilter, event.target.value)}><option value="">Semua status</option><option value="completed">Selesai</option><option value="pending">Menunggu</option></select></label>
        <label><span>Dari</span><input type="date" value={dateFrom} onChange={(event) => updateFilter(setDateFrom, event.target.value)} /></label>
        <label><span>Sampai</span><input type="date" min={dateFrom || undefined} value={dateTo} onChange={(event) => updateFilter(setDateTo, event.target.value)} /></label>
      </div>
      {listingError && <div className="ocr-message"><Database size={15} />{listingError}</div>}
      {listing.transactions.length > 0 ? <TransactionTable transactions={listing.transactions} accounts={accounts} privacy={privacy} onEdit={onEdit} onDuplicate={onDuplicate} onDelete={onDelete} /> : !listingLoading && <div className="empty-state"><Search size={28} /><h3>Transaksi tidak ditemukan</h3><p>Coba gunakan kata kunci atau filter yang berbeda.</p></div>}
      <div className="transaction-pagination"><span>{listingLoading ? "Memuat..." : `${listing.total} transaksi · halaman ${listing.page} dari ${listing.totalPages}`}</span><div><button className="secondary-button" disabled={listingLoading || listing.page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>Sebelumnya</button><button className="secondary-button" disabled={listingLoading || listing.page >= listing.totalPages} onClick={() => setPage((value) => value + 1)}>Berikutnya</button></div></div>
    </section>
  </div>;
}

function TransactionTable({ transactions, accounts, privacy, compact = false, onEdit, onDuplicate, onDelete }: { transactions: Transaction[]; accounts: Account[]; privacy: boolean; compact?: boolean; onEdit?: (transaction: Transaction) => void; onDuplicate?: (transaction: Transaction) => void; onDelete?: (transaction: Transaction) => void }) {
  return <div className={`transaction-table ${compact ? "compact-table" : ""}`}>
    {!compact && <div className="transaction-head"><span>Transaksi</span><span>Tanggal</span><span>Akun</span><span>Status</span><span>Nominal</span></div>}
    {transactions.map((transaction) => {
      const account = accounts.find((item) => item.id === transaction.accountId);
      const isAdjustment = transaction.type === "adjustment_in" || transaction.type === "adjustment_out";
      const isPositive = transaction.type === "income" || transaction.type === "refund";
      const isTransfer = transaction.type === "transfer" || transaction.type === "investment_buy";
      const editable = transaction.type !== "adjustment_in" && transaction.type !== "adjustment_out" && transaction.type !== "investment_buy" && transaction.category !== "Investasi";
      const adjustmentLabel = account?.liability
        ? transaction.type === "adjustment_in" ? "Rekonsiliasi · utang turun" : "Rekonsiliasi · utang naik"
        : transaction.type === "adjustment_in" ? "Rekonsiliasi · saldo naik" : "Rekonsiliasi · saldo turun";
      return <div className="transaction-row" key={transaction.id}>
        <span className={`transaction-icon ${isAdjustment || isTransfer ? "neutral" : isPositive ? "positive" : "negative"}`}>{isAdjustment ? <Scale size={17} /> : isPositive ? <ArrowDownLeft size={17} /> : isTransfer ? <ArrowRight size={17} /> : <ArrowUpRight size={17} />}</span>
        <span className="transaction-main"><strong>{transaction.title}</strong><small>{isAdjustment ? adjustmentLabel : transaction.splits?.length ? `${transaction.splits.length} kategori · ${transaction.splits.map((split) => split.category).join(", ")}` : transaction.merchant ?? transaction.category}{transaction.tags?.length ? ` · #${transaction.tags.join(" #")}` : ""}</small>{transaction.receipt && <a className="transaction-receipt" href={financeTransactionReceiptUrl(transaction.id, transaction.receipt.id, transaction.receipt.url)} target="_blank" rel="noreferrer"><Paperclip size={12} /> {transaction.receipt.filename}</a>}</span>
        <span className="transaction-date">{shortDate(transaction.date)}</span>
        <span className="transaction-account">{account?.name ?? "Alokasi virtual"}</span>
        <span className={`transaction-status ${transaction.status === "pending" ? "pending" : ""}`}><i /> {transaction.status === "pending" ? "Menunggu" : "Selesai"}</span>
        <Amount value={transaction.amount} privacy={privacy} className={`transaction-amount ${isAdjustment || isTransfer ? "" : isPositive ? "positive-text" : "negative-text"}`} />
        {(onEdit || onDuplicate || onDelete) && <span className="transaction-actions">{onDuplicate && editable && <button className="transaction-edit" onClick={() => onDuplicate(transaction)} aria-label={`Duplikasi ${transaction.title}`} title="Duplikasi"><Copy size={14} /></button>}{onEdit && editable && <button className="transaction-edit" onClick={() => onEdit(transaction)} aria-label={`Edit ${transaction.title}`} title="Edit"><Pencil size={14} /></button>}{onDelete && <button className="transaction-delete" onClick={() => window.confirm("Pindahkan transaksi ini ke Trash?") && onDelete(transaction)} aria-label={`Hapus ${transaction.title}`}><Trash2 size={14} /></button>}</span>}
      </div>;
    })}
  </div>;
}

function AccountsPage({ accounts, privacy, onAdd, onBorrow, onImport, onEdit, onArchive, onReconcile, onInspect }: { accounts: Account[]; privacy: boolean; onAdd: () => void; onBorrow: () => void; onImport: () => void; onEdit: (account: Account) => void; onArchive: (id: string) => void; onReconcile: (account: Account) => void; onInspect: (account: Account) => void }) {
  const totals = accountSummary(accounts);
  return <div className="content-stack">
    <div className="summary-strip account-summary">
      <div><span>Saldo likuid</span><Amount value={totals.liquid} privacy={privacy} /><small>Bank, e-wallet, cash</small></div>
      <div><span>Nilai investasi</span><Amount value={totals.investment} privacy={privacy} /><small>Menurut saldo ledger</small></div>
      <div><span>Total kewajiban</span><Amount value={totals.liabilities} privacy={privacy} /><small className="negative-text">Perlu dibayar</small></div>
      <div><span>Kekayaan bersih</span><Amount value={totals.netWorth} privacy={privacy} /><small>Setelah kewajiban</small></div>
    </div>
    <div className="account-import-bar"><div><CreditCard size={18} /><span><strong>Pinjaman baru atau pencairan Paylater</strong><small>Dana masuk ke rekening dan saldo kewajiban bertambah tanpa dihitung sebagai pendapatan.</small></span></div><span className="account-tool-actions"><button className="primary-button" onClick={onBorrow}><ArrowDownLeft size={16} /> Catat pinjaman</button><button className="secondary-button" onClick={onImport}><FileUp size={16} /> Impor akun</button></span></div>
    <div className="account-grid">
      {accounts.map((account) => <article className={`account-card ${account.liability ? "liability" : ""}`} key={account.id}>
        <div className="account-card-top"><span className="large-account-logo" style={{ background: `${account.color}18`, color: account.color }}>{account.type === "Bank" ? <Landmark size={22} /> : account.type === "Investment" ? <TrendingUp size={22} /> : account.liability ? <CreditCard size={22} /> : <WalletCards size={22} />}</span><span className="account-card-actions"><button className="icon-button small" onClick={() => onEdit(account)} aria-label={`Edit ${account.name}`} title="Edit akun"><Pencil size={16} /></button><button className="icon-button small" onClick={() => onReconcile(account)} aria-label={`Rekonsiliasi ${account.name}`} title="Cocokkan saldo"><Scale size={16} /></button><button className="icon-button small" onClick={() => window.confirm(`Arsipkan ${account.name}?`) && onArchive(account.id)} aria-label={`Arsipkan ${account.name}`}><Trash2 size={16} /></button></span></div>
        <span>{account.type}</span><h3>{account.name}</h3><p>{[account.institution, account.mask].filter(Boolean).join(" · ") || "Detail rekening belum diisi"}</p>
        <Amount value={account.balance} privacy={privacy} className="account-card-value" />
        <div className="account-card-footer"><span><i style={{ background: account.color }} /> {account.liability ? "Kewajiban" : "Aktif"}</span><button onClick={() => onInspect(account)}>Lihat transaksi <ArrowRight size={14} /></button></div>
      </article>)}
      <button className="add-card" onClick={onAdd}><span><Plus size={21} /></span><strong>Tambah akun baru</strong><small>Bank, e-wallet, cash, atau lainnya</small></button>
    </div>
  </div>;
}

function ReceivablesPage({ accounts, privacy, onAdd, onReceive, onHistory }: { accounts: Account[]; privacy: boolean; onAdd: () => void; onReceive: (account: Account) => void; onHistory: (account: Account) => void }) {
  const receivables = accounts.filter((account) => account.type === "Receivable");
  const outstanding = receivables.reduce((sum, account) => sum + account.balance, 0);
  return <div className="content-stack">
    <div className="summary-strip"><div><span>Total piutang</span><Amount value={outstanding} privacy={privacy}/><small>{receivables.length} pihak</small></div><div><span>Status</span><strong>{receivables.filter((item) => item.balance > 0).length} belum lunas</strong><small>Saldo berasal dari ledger</small></div><div><span>Pencatatan</span><strong>Transfer aset</strong><small>Bukan pengeluaran atau pemasukan</small></div><div><span>Aksi</span><button className="primary-button compact" onClick={onAdd}><Plus size={15}/> Catat piutang</button></div></div>
    <section className="panel receivables-panel"><div className="card-title-row"><div><span className="card-kicker">Receivable ledger</span><h2>Uang yang belum dikembalikan</h2></div></div><div className="receivable-list">{receivables.map((account) => {
      const dueDate = account.mask.replace(/^JT\s*/, "");
      return <article className={account.balance === 0 ? "paid" : ""} key={account.id}><span className="account-logo" style={{ color: account.color, background: `${account.color}18` }}><UserRound size={19}/></span><span><strong>{account.name}</strong><small>{account.institution || "Peminjam"} · jatuh tempo {shortDate(dueDate)}</small></span><span><small>Sisa piutang</small><Amount value={account.balance} privacy={privacy}/></span><span className="receivable-actions"><button className="secondary-button" onClick={() => onHistory(account)}><History size={14}/> Riwayat</button><button className="primary-button" disabled={account.balance <= 0} onClick={() => onReceive(account)}><ArrowDownLeft size={14}/> Terima pembayaran</button></span></article>;
    })}{!receivables.length && <div className="empty-state"><UserRound size={30}/><h3>Belum ada piutang</h3><p>Catat saat kamu meminjamkan uang. Saldo kas berkurang dan piutang bertambah tanpa dianggap sebagai pengeluaran.</p><button className="primary-button" onClick={onAdd}><Plus size={15}/> Catat piutang pertama</button></div>}</div></section>
  </div>;
}

function BudgetsPage({ budgets, transactions, privacy, month, onAdd, onEdit, onDelete }: { budgets: Budget[]; transactions: Transaction[]; privacy: boolean; month: string; onAdd: () => void; onEdit: (budget: Budget) => void; onDelete: (budget: Budget) => void }) {
  const totalLimit = budgets.reduce((sum, item) => sum + item.limit, 0);
  const totalSpent = budgets.reduce((sum, item) => sum + budgetSpent(transactions, item.category, month), 0);
  const daysInMonth = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate();
  const daysLeft = Math.max(0, daysInMonth - Number(today().slice(-2)));
  const usage = totalLimit > 0 ? totalSpent / totalLimit * 100 : 0;
  return <div className="content-stack">
    <div className="budget-hero">
      <div><span className="card-kicker light">Total anggaran {monthLabel(month)}</span><Amount value={totalLimit} privacy={privacy} className="budget-hero-value" /><p><strong>{privacy ? "Rp ••••" : formatIDR(Math.max(0, totalLimit - totalSpent))}</strong> masih tersedia untuk {daysLeft} hari ke depan.</p></div>
      <div className="budget-ring" style={{ "--score": `${Math.min(100, usage) * 3.6}deg` } as React.CSSProperties}><div><strong>{Math.round(usage)}%</strong><small>terpakai</small></div></div>
    </div>
    <section className="panel budget-list-panel">
      <div className="card-title-row"><div><span className="card-kicker">Kategori</span><h2>Realisasi anggaran</h2></div><button className="secondary-button" onClick={onAdd}><Plus size={16} /> Tambah anggaran</button></div>
      <div className="budget-list">
        {budgets.map((budget) => { const spent = budgetSpent(transactions, budget.category, month); const percent = budget.limit > 0 ? spent / budget.limit * 100 : 0; const state = percent > 100 ? "Terlampaui" : percent >= 90 ? "Hampir penuh" : percent >= 75 ? "Waspada" : "Aman"; return <div className="budget-row" key={budget.id}>
          <span className="budget-category-icon" style={{ background: `${budget.color}16`, color: budget.color }}><CircleDollarSign size={20} /></span>
          <div className="budget-details"><span><strong>{budget.category}</strong><small className={`budget-state state-${state.toLowerCase().replace(" ", "-")}`}>{state}</small></span><ProgressBar value={percent} color={percent > 100 ? "#d4685c" : budget.color} label={`Anggaran ${budget.category}`} /><small><Amount value={spent} privacy={privacy} /> terpakai dari <Amount value={budget.limit} privacy={privacy} /></small></div>
          <span className="budget-row-actions"><strong>{Math.round(percent)}%</strong><button className="icon-button small" onClick={() => onEdit(budget)} aria-label={`Edit anggaran ${budget.category}`}><Pencil size={15} /></button><button className="icon-button small" onClick={() => window.confirm(`Hapus anggaran ${budget.category}?`) && onDelete(budget)} aria-label={`Hapus anggaran ${budget.category}`}><Trash2 size={15} /></button></span>
        </div>; })}
        {!budgets.length && <div className="empty-state"><BarChart3 size={28} /><h3>Belum ada anggaran</h3><p>Tambahkan batas kategori agar realisasi dapat dipantau otomatis.</p><button className="primary-button" onClick={onAdd}><Plus size={16} /> Tambah anggaran</button></div>}
      </div>
    </section>
  </div>;
}

function GoalsPage({ goals, privacy, onProgress, onEdit, onDelete, onAdd }: { goals: Goal[]; privacy: boolean; onProgress: (goal: Goal) => void; onEdit: (goal: Goal) => void; onDelete: (goal: Goal) => void; onAdd: () => void }) {
  return <div className="goal-grid">
    {goals.map((goal) => { const percent = goal.target > 0 ? goal.current / goal.target * 100 : 0; const remaining = Math.max(0, goal.target - goal.current); const deadlineTime = validDate(goal.deadline) ? new Date(`${goal.deadline}T12:00:00`).getTime() : new Date().getTime(); const months = Math.max(1, Math.ceil((deadlineTime - new Date().getTime()) / 2_628_000_000)); return <article className="goal-card" key={goal.id}>
      <div className="goal-card-head"><span className="large-goal-icon" style={{ background: `${goal.color}18`, color: goal.color }}><Target size={24} /></span><span className="account-card-actions"><button className="icon-button small" onClick={() => onEdit(goal)} aria-label={`Edit ${goal.name}`}><Pencil size={15} /></button><button className="icon-button small" onClick={() => window.confirm(`Hapus target ${goal.name}?`) && onDelete(goal)} aria-label={`Hapus ${goal.name}`}><Trash2 size={15} /></button></span></div>
      <span className="goal-deadline">Target · {shortDate(goal.deadline)}</span><h2>{goal.name}</h2>
      <div className="goal-amount"><Amount value={goal.current} privacy={privacy} /><small>dari <Amount value={goal.target} privacy={privacy} /></small></div>
      <ProgressBar value={percent} color={goal.color} label={`Progress ${goal.name}`} />
      <div className="goal-meta"><span><small>Tercapai</small><strong>{percent.toFixed(1)}%</strong></span><span><small>Sisa</small><Amount value={remaining} privacy={privacy} compact /></span><span><small>Rekomendasi/bln</small><Amount value={remaining / months} privacy={privacy} compact /></span></div>
      <button className="secondary-button full" onClick={() => onProgress(goal)}><Plus size={16} /> Atur progress</button>
    </article>; })}
    <button className={`add-card goal-add ${goals.length ? "" : "is-empty"}`} onClick={onAdd}>
      <span><Plus size={21} /></span>
      <strong>{goals.length ? "Tambah target baru" : "Belum ada target finansial"}</strong>
      <small>{goals.length ? "Tentukan nominal, deadline, dan kontribusi rutin" : "Mulai dari satu tujuan yang ingin dicapai, lalu pantau progresnya secara berkala."}</small>
      <span className="goal-add-cta"><Plus size={15} /> {goals.length ? "Tambah target" : "Buat target pertama"}</span>
    </button>
  </div>;
}

function SinkingFundsPage({ funds, entries, accounts, privacy, onAdd, onEdit, onAdjust, onDelete }: {
  funds: SinkingFund[];
  entries: SinkingFundEntry[];
  accounts: Account[];
  privacy: boolean;
  onAdd: () => void;
  onEdit: (fund: SinkingFund) => void;
  onAdjust: (fund: SinkingFund, type: "allocate" | "release") => void;
  onDelete: (fund: SinkingFund) => void;
}) {
  const totalTarget = funds.reduce((sum, fund) => sum + fund.targetAmount, 0);
  const totalAllocated = funds.reduce((sum, fund) => sum + fund.currentAmount, 0);
  const freeCash = unallocatedCash(accounts, funds);
  const accountName = (id: string) => accounts.find((account) => account.id === id)?.name ?? "Akun tidak tersedia";
  return <div className="content-stack sinking-funds-page">
    <section className="sinking-fund-hero">
      <div><span className="card-kicker light">Dana yang sudah diberi tujuan</span><Amount value={totalAllocated} privacy={privacy} className="sinking-fund-hero-value" /><p>Dari target keseluruhan <Amount value={totalTarget} privacy={privacy} />.</p></div>
      <div className="sinking-fund-hero-metrics">
        <span><small>Saldo bebas</small><Amount value={freeCash} privacy={privacy} /><b>Belum dialokasikan</b></span>
        <span><small>Progress total</small><strong>{totalTarget ? Math.round(totalAllocated / totalTarget * 100) : 0}%</strong><b>{funds.length} pos aktif</b></span>
      </div>
    </section>
    <div className="sinking-fund-note"><ShieldCheck size={18} /><span><strong>Tidak menghitung uang dua kali</strong><small>Pos Dana hanya memberi label pada sebagian saldo akun. Mengalokasikan atau melepas dana tidak mengubah saldo, kekayaan bersih, maupun arus kas.</small></span></div>
    <section className="sinking-fund-grid">
      {funds.map((fund) => {
        const percent = sinkingFundProgress(fund);
        const remaining = sinkingFundRemaining(fund);
        const monthlyNeed = sinkingFundMonthlyNeed(fund);
        const account = accounts.find((item) => item.id === fund.accountId);
        const overAllocated = Boolean(account && funds.filter((item) => item.accountId === account.id).reduce((sum, item) => sum + item.currentAmount, 0) > account.balance);
        return <article className="sinking-fund-card" key={fund.id}>
          <div className="sinking-fund-card-head"><span style={{ background: `${fund.color}18`, color: fund.color }}><CircleDollarSign size={21} /></span><div><small>{fund.purpose}</small><h2>{fund.name}</h2></div><span className="account-card-actions"><button className="icon-button small" onClick={() => onEdit(fund)} aria-label={`Edit ${fund.name}`}><Pencil size={15} /></button><button className="icon-button small" onClick={() => window.confirm(`Arsipkan pos ${fund.name}? Dana yang dialokasikan akan kembali menjadi saldo bebas.`) && onDelete(fund)} aria-label={`Arsipkan ${fund.name}`}><Trash2 size={15} /></button></span></div>
          <div className="sinking-fund-amount"><Amount value={fund.currentAmount} privacy={privacy} /><small>dari <Amount value={fund.targetAmount} privacy={privacy} /></small></div>
          <ProgressBar value={percent} color={fund.color} label={`Progress ${fund.name}`} />
          <div className="sinking-fund-meta">
            <span><small>Target</small><strong>{shortDate(fund.targetDate)}</strong></span>
            <span><small>Sisa</small><Amount value={remaining} privacy={privacy} compact /></span>
            <span><small>Perlu/bln</small><Amount value={fund.monthlyContribution || monthlyNeed} privacy={privacy} compact /></span>
          </div>
          <div className={`sinking-fund-account ${overAllocated ? "warning" : ""}`}><Landmark size={15} /><span><strong>{accountName(fund.accountId)}</strong><small>{overAllocated ? "Alokasi melebihi saldo akun saat ini" : "Saldo akun tetap utuh"}</small></span></div>
          <div className="sinking-fund-actions"><button className="primary-button" onClick={() => onAdjust(fund, "allocate")} disabled={percent >= 100}><Plus size={15} /> Alokasikan</button><button className="secondary-button" onClick={() => onAdjust(fund, "release")} disabled={fund.currentAmount <= 0}><Undo2 size={15} /> Lepas</button></div>
        </article>;
      })}
      <button className={`add-card sinking-fund-add ${funds.length ? "" : "is-empty"}`} onClick={onAdd}><span><Plus size={21} /></span><strong>{funds.length ? "Tambah pos dana" : "Buat pos dana pertama"}</strong><small>Siapkan servis kendaraan, pajak, liburan, pendidikan, atau kebutuhan tahunan.</small><span className="goal-add-cta"><Plus size={15} /> Buat pos</span></button>
    </section>
    {entries.length > 0 && <section className="panel sinking-fund-history"><div className="card-title-row"><div><span className="card-kicker">Riwayat alokasi</span><h2>Perubahan terbaru</h2></div></div><div>{entries.slice(0, 8).map((entry) => { const fund = funds.find((item) => item.id === entry.fundId); return <div key={entry.id}><span className={entry.type}><History size={15} /></span><div><strong>{fund?.name ?? "Pos diarsipkan"}</strong><small>{entry.note || (entry.type === "allocate" ? "Alokasi dana" : "Pelepasan dana")} · {shortDate(entry.date)}</small></div><Amount value={entry.amount} privacy={privacy} className={entry.type === "allocate" ? "positive-text" : ""} /></div>; })}</div></section>}
  </div>;
}

function EmergencyFundPage({ month, transactions, accounts, privacy, onToast }: { month: string; transactions: Transaction[]; accounts: Account[]; privacy: boolean; onToast: (message: string) => void }) {
  const [settings, setSettings] = useState<EmergencyFundSettings>(DEFAULT_EMERGENCY_FUND_SETTINGS);
  const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false); const [error, setError] = useState("");
  const eligibleAccounts = accounts.filter((account) => !account.liability && account.type !== "Investment");
  useEffect(() => { let active = true; loadFinanceEmergencyFundSettings().then((value) => active && setSettings(value)).catch((reason) => active && setError(reason instanceof Error ? reason.message : "Pengaturan dana darurat tidak dapat dimuat.")).finally(() => active && setLoading(false)); return () => { active = false; }; }, []);
  const plan = useMemo(() => buildEmergencyFundPlan({ accounts, transactions, settings, asOfMonth: month }), [accounts, transactions, settings, month]);
  const effectiveIds = settings.accountIds.length ? settings.accountIds : eligibleAccounts.map((account) => account.id);
  const toggleAccount = (id: string) => setSettings((value) => { const current = value.accountIds.length ? value.accountIds : eligibleAccounts.map((account) => account.id); const next = current.includes(id) ? current.filter((item) => item !== id) : [...current, id]; return { ...value, accountIds: next.length === eligibleAccounts.length ? [] : next.length ? next : [id] }; });
  const save = async () => { setSaving(true); setError(""); try { setSettings(await updateFinanceEmergencyFundSettings(settings)); onToast("Rencana dana darurat berhasil disimpan."); } catch (reason) { setError(reason instanceof Error ? reason.message : "Rencana dana darurat tidak dapat disimpan."); } finally { setSaving(false); } };
  const scoreTone = plan.safetyScore >= 80 ? "safe" : plan.safetyScore >= 55 ? "building" : "critical";
  if (loading) return <div className="panel settings-empty">Menghitung ketahanan finansial…</div>;
  return <div className="emergency-layout">
    <section className={`emergency-hero ${plan.status}`}><div><span className="card-kicker light">Financial safety score</span><h2>{plan.status === "ready" ? "Fondasi keuangan terlindungi" : plan.status === "building" ? "Perlindungan sedang dibangun" : "Dana darurat perlu diprioritaskan"}</h2><p>{plan.monthlyExpense > 0 ? `Dana saat ini mampu menutup sekitar ${plan.coverageMonths.toFixed(1)} bulan pengeluaran. Targetmu adalah ${settings.targetMonths} bulan.` : "Tambahkan transaksi pengeluaran atau isi estimasi bulanan untuk menghitung kebutuhan dana darurat."}</p></div><div className="emergency-score-wrap"><div className={`emergency-score ${scoreTone}`} style={{ background: `conic-gradient(currentColor ${plan.safetyScore * 3.6}deg,rgba(255,255,255,.13) 0deg)` }}><span><strong>{plan.safetyScore}</strong><small>/100</small></span></div><div><small>Status</small><strong>{plan.status === "ready" ? "Siap" : plan.status === "building" ? "Bertumbuh" : "Kritis"}</strong><p>Skor deterministik dari coverage, kontribusi, dan arus kas.</p></div></div></section>
    {error && <div className="data-alert emergency-error"><span><Umbrella size={17}/></span><div><strong>Rencana perlu perhatian</strong><small>{error}</small></div></div>}
    <section className="emergency-metrics"><article className="panel"><small>Dana tersedia</small><Amount value={plan.currentFund} privacy={privacy}/><span>{plan.coverageMonths.toFixed(1)} bulan coverage</span></article><article className="panel"><small>Target {settings.targetMonths} bulan</small><Amount value={plan.targetAmount} privacy={privacy}/><span>Berdasarkan biaya hidup bulanan</span></article><article className="panel"><small>Kekurangan dana</small><Amount value={plan.gap} privacy={privacy}/><span>{plan.gap ? "Masih perlu dikumpulkan" : "Target sudah tercapai"}</span></article><article className="panel"><small>Estimasi tercapai</small><strong>{plan.projectedMonth ? formatMonthLabel(plan.projectedMonth) : "Belum tersedia"}</strong><span>{plan.monthsToGoal === null ? "Atur kontribusi bulanan" : plan.monthsToGoal === 0 ? "Sudah tercapai" : `${plan.monthsToGoal} bulan lagi`}</span></article></section>
    <section className="panel emergency-progress-panel"><div className="card-title-row"><div><span className="card-kicker">Safety runway</span><h2>Progress perlindungan</h2></div><span className={`forecast-status ${scoreTone === "safe" ? "safe" : scoreTone === "building" ? "warning" : "critical"}`}>{plan.progressPct.toFixed(0)}%</span></div><div className="emergency-progress-track"><span style={{ width: `${plan.progressPct}%` }}/>{[1,3,6,9,12].filter((value) => value <= settings.targetMonths).map((value) => <i key={value} style={{ left: `${value/settings.targetMonths*100}%` }}><b>{value}</b><small>bln</small></i>)}</div><div className="emergency-progress-values"><span><small>Sekarang</small><Amount value={plan.currentFund} privacy={privacy}/></span><span><small>Target penuh</small><Amount value={plan.targetAmount} privacy={privacy}/></span></div><div className="emergency-insight"><ShieldCheck size={18}/><span><strong>{plan.status === "ready" ? "Target perlindungan sudah terpenuhi." : plan.monthsToGoal ? `Konsisten ${privacy ? "menabung" : formatIDR(settings.monthlyContribution)} per bulan akan menutup gap.` : "Mulai kontribusi rutin agar tanggal pencapaian dapat dihitung."}</strong><small>Dana darurat sebaiknya likuid dan terpisah dari portofolio investasi berisiko.</small></span></div></section>
    <aside className="panel emergency-settings-panel"><span className="card-kicker">Plan controls</span><h2>Atur target</h2><div className="emergency-target-tabs">{([3,6,9,12] as const).map((value) => <button key={value} className={settings.targetMonths === value ? "active" : ""} onClick={() => setSettings((current) => ({ ...current, targetMonths: value }))}>{value}<small>bulan</small></button>)}</div><div className="forecast-control-list"><label><span>Pengeluaran bulanan <small>{settings.monthlyExpenseOverride ? "manual" : "otomatis"}</small></span><div className="roadmap-money-input"><small>Rp</small><input type="number" min={0} step={100000} value={settings.monthlyExpenseOverride} onChange={(event) => setSettings((value) => ({ ...value, monthlyExpenseOverride: Math.max(0, Number(event.target.value) || 0) }))}/></div><small>Nilai otomatis saat ini {privacy ? "disamarkan" : formatIDR(plan.monthlyExpense)} dari {plan.observedMonths} bulan data.</small></label><label><span>Kontribusi rutin per bulan</span><div className="roadmap-money-input"><small>Rp</small><input type="number" min={0} step={100000} value={settings.monthlyContribution} onChange={(event) => setSettings((value) => ({ ...value, monthlyContribution: Math.max(0, Number(event.target.value) || 0) }))}/></div></label></div><div className="emergency-account-picker"><span>Akun sumber dana</span>{eligibleAccounts.map((account) => <label key={account.id}><input type="checkbox" checked={effectiveIds.includes(account.id)} onChange={() => toggleAccount(account.id)}/><span><strong>{account.name}</strong><small>{account.type} · <Amount value={account.balance} privacy={privacy}/></small></span></label>)}{!eligibleAccounts.length && <small>Tambahkan akun kas, bank, atau e-wallet terlebih dahulu.</small>}</div><button className="primary-button roadmap-save" disabled={saving || !eligibleAccounts.length} onClick={() => void save()}><Check size={16}/>{saving ? "Menyimpan…" : "Simpan rencana"}</button></aside>
    <section className="emergency-score-grid"><article className="panel"><span className="emergency-factor coverage"><Umbrella size={19}/></span><div><small>Coverage</small><strong>{Math.min(60, Math.round(plan.progressPct*.6))}/60</strong><p>Seberapa besar target yang sudah tersedia.</p></div></article><article className="panel"><span className="emergency-factor momentum"><TrendingUp size={19}/></span><div><small>Momentum</small><strong>{plan.gap === 0 ? 20 : settings.monthlyContribution > 0 ? Math.min(20, Math.round(settings.monthlyContribution/Math.max(1,plan.monthlyExpense*.1)*20)) : 0}/20</strong><p>Kekuatan kontribusi rutin menuju target.</p></div></article><article className="panel"><span className="emergency-factor cashflow"><Activity size={19}/></span><div><small>Arus kas</small><strong>{plan.monthlyIncome > 0 ? Math.max(0,Math.min(20,Math.round((plan.monthlyIncome-plan.monthlyExpense)/plan.monthlyIncome*100))) : 0}/20</strong><p>Ruang antara pemasukan dan biaya hidup.</p></div></article></section>
  </div>;
}

function CashflowForecastPage({ transactions, accounts, bills, privacy, onToast }: { transactions: Transaction[]; accounts: Account[]; bills: Bill[]; privacy: boolean; onToast: (message: string) => void }) {
  const [settings, setSettings] = useState<CashflowForecastSettings>(DEFAULT_CASHFLOW_FORECAST_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const asOfDate = today();
  useEffect(() => {
    let active = true;
    loadFinanceCashflowForecastSettings().then((value) => active && setSettings(value))
      .catch((reason) => active && setError(reason instanceof Error ? reason.message : "Pengaturan forecast tidak dapat dimuat."))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);
  const forecast = useMemo(() => buildCashflowForecast({ accounts, transactions, bills, settings, asOfDate }), [accounts, transactions, bills, settings, asOfDate]);
  const cautious = useMemo(() => buildCashflowForecast({ accounts, transactions, bills, settings: { ...settings, monthlyIncomeOverride: Math.round(forecast.monthlyIncome * .9) }, asOfDate }), [accounts, transactions, bills, settings, forecast.monthlyIncome, asOfDate]);
  const chartWidth = 720; const chartHeight = 210; const padX = 20; const padY = 20;
  const allBalances = [...forecast.points.map((point) => point.balance), settings.minimumCashBuffer, 0];
  const minBalance = Math.min(...allBalances); const maxBalance = Math.max(...allBalances, 1); const span = Math.max(1, maxBalance - minBalance);
  const x = (index: number) => padX + index / Math.max(1, forecast.points.length - 1) * (chartWidth - padX * 2);
  const y = (balance: number) => padY + (maxBalance - balance) / span * (chartHeight - padY * 2);
  const line = forecast.points.map((point, index) => `${x(index)},${y(point.balance)}`).join(" ");
  const events = forecast.points.filter((point) => point.income > 0 || point.bills > 0).slice(0, 10);
  const status = forecast.firstNegativeDate ? "critical" : forecast.firstBelowBufferDate ? "warning" : "safe";
  const save = async () => {
    setSaving(true); setError("");
    try { setSettings(await updateFinanceCashflowForecastSettings(settings)); onToast("Asumsi cashflow forecast berhasil disimpan."); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Pengaturan forecast tidak dapat disimpan."); }
    finally { setSaving(false); }
  };
  if (loading) return <div className="panel settings-empty">Menyiapkan proyeksi arus kas…</div>;
  return <div className="forecast-layout">
    <section className={`forecast-hero ${status}`}>
      <div><span className="card-kicker light">Liquidity runway</span><h2>{status === "safe" ? `Kas aman ${settings.horizonDays} hari` : status === "warning" ? "Buffer kas akan terlewati" : "Saldo berisiko negatif"}</h2><p>{status === "safe" ? `Saldo terendah diproyeksikan tetap di atas buffer pada ${shortDate(forecast.lowestBalanceDate)}.` : status === "warning" ? `Saldo diperkirakan melewati buffer pada ${shortDate(forecast.firstBelowBufferDate!)}.` : `Tanpa penyesuaian, saldo kas diperkirakan negatif mulai ${shortDate(forecast.firstNegativeDate!)}.`}</p></div>
      <div className="forecast-hero-metrics"><span><small>Saldo kas sekarang</small><Amount value={forecast.startingBalance} privacy={privacy}/></span><span><small>Saldo akhir proyeksi</small><Amount value={forecast.endingBalance} privacy={privacy}/></span><span><small>Saldo terendah</small><Amount value={forecast.lowestBalance} privacy={privacy}/></span></div>
    </section>
    {error && <div className="data-alert forecast-error"><span><TriangleAlert size={17}/></span><div><strong>Forecast perlu perhatian</strong><small>{error}</small></div></div>}
    <section className="panel forecast-chart-panel">
      <div className="card-title-row"><div><span className="card-kicker">Daily projection</span><h2>Jalur saldo kas</h2></div><span className={`forecast-status ${status}`}>{status === "safe" ? "Aman" : status === "warning" ? "Waspada" : "Kritis"}</span></div>
      <div className="forecast-chart-wrap"><svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} role="img" aria-label={`Grafik proyeksi saldo kas ${settings.horizonDays} hari`}><defs><linearGradient id="forecast-area" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#126b59" stopOpacity=".25"/><stop offset="1" stopColor="#126b59" stopOpacity="0"/></linearGradient></defs><line x1={padX} x2={chartWidth-padX} y1={y(settings.minimumCashBuffer)} y2={y(settings.minimumCashBuffer)} className="forecast-buffer-line"/><polyline points={`${padX},${chartHeight-padY} ${line} ${chartWidth-padX},${chartHeight-padY}`} fill="url(#forecast-area)" stroke="none"/><polyline points={line} fill="none" stroke="#126b59" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>{forecast.points.map((point,index) => (point.income > 0 || point.bills > 0) && <circle key={point.date} cx={x(index)} cy={y(point.balance)} r="4" className={point.income > 0 ? "forecast-income-dot" : "forecast-bill-dot"}/>)}</svg><div className="forecast-chart-axis"><span>{shortDate(asOfDate)}</span><span>Buffer {privacy ? "disamarkan" : formatIDR(settings.minimumCashBuffer, true)}</span><span>{shortDate(forecast.points.at(-1)?.date ?? asOfDate)}</span></div></div>
      {!forecast.observedMonths && <div className="roadmap-inline-warning"><History size={16}/><span>Belum ada histori transaksi; forecast saat ini hanya memakai saldo dan tagihan tersimpan.</span></div>}
    </section>
    <aside className="panel forecast-settings-panel">
      <span className="card-kicker">Forecast controls</span><h2>Atur asumsi</h2>
      <div className="forecast-horizon-tabs">{([30,60,90] as const).map((days) => <button key={days} className={settings.horizonDays === days ? "active" : ""} onClick={() => setSettings((value) => ({ ...value, horizonDays: days }))}>{days}<small>hari</small></button>)}</div>
      <div className="forecast-control-list"><label><span>Pemasukan bulanan <small>{settings.monthlyIncomeOverride ? "manual" : "otomatis"}</small></span><div className="roadmap-money-input"><small>Rp</small><input type="number" min={0} step={100000} value={settings.monthlyIncomeOverride} onChange={(event) => setSettings((value) => ({ ...value, monthlyIncomeOverride: Math.max(0, Number(event.target.value) || 0) }))}/></div><small>Kosongkan atau isi 0 untuk memakai rata-rata {forecast.observedMonths} bulan.</small></label><label><span>Tanggal pemasukan utama</span><input type="number" min={1} max={28} value={settings.incomeDay} onChange={(event) => setSettings((value) => ({ ...value, incomeDay: Math.max(1, Math.min(28, Number(event.target.value) || 1)) }))}/></label><label><span>Buffer kas minimum</span><div className="roadmap-money-input"><small>Rp</small><input type="number" min={0} step={100000} value={settings.minimumCashBuffer} onChange={(event) => setSettings((value) => ({ ...value, minimumCashBuffer: Math.max(0, Number(event.target.value) || 0) }))}/></div></label></div>
      <button className="primary-button roadmap-save" disabled={saving} onClick={() => void save()}><Check size={16}/>{saving ? "Menyimpan…" : "Simpan asumsi"}</button>
    </aside>
    <section className="forecast-summary-grid">
      <article className="panel"><span className="forecast-summary-icon income"><ArrowDownLeft size={18}/></span><div><small>Pemasukan terproyeksi</small><Amount value={forecast.projectedIncome} privacy={privacy}/><p>Rata-rata bulanan <Amount value={forecast.monthlyIncome} privacy={privacy} compact/></p></div></article>
      <article className="panel"><span className="forecast-summary-icon bill"><ReceiptText size={18}/></span><div><small>Tagihan terjadwal</small><Amount value={forecast.projectedBills} privacy={privacy}/><p>{bills.length} tagihan rutin aktif</p></div></article>
      <article className="panel"><span className="forecast-summary-icon spend"><WalletCards size={18}/></span><div><small>Biaya hidup proyeksi</small><Amount value={forecast.projectedLivingExpense} privacy={privacy}/><p>Dari pola transaksi historis</p></div></article>
      <article className="panel"><span className="forecast-summary-icon scenario"><Scale size={18}/></span><div><small>Skenario hati-hati</small><Amount value={cautious.endingBalance} privacy={privacy}/><p>Pemasukan 10% lebih rendah</p></div></article>
    </section>
    <section className="panel forecast-events-panel"><div className="card-title-row"><div><span className="card-kicker">Upcoming cash events</span><h2>Kalender arus kas</h2></div><span className="roadmap-data-badge">{events.length} kejadian terdekat</span></div><div className="forecast-event-list">{events.map((event) => <article key={event.date}><time><strong>{event.date.slice(8,10)}</strong><small>{shortMonth(event.date)}</small></time><span className={event.income ? "forecast-event-icon income" : "forecast-event-icon bill"}>{event.income ? <ArrowDownLeft size={17}/> : <ReceiptText size={17}/>}</span><span><strong>{event.income ? "Pemasukan utama" : "Tagihan rutin"}</strong><small>Saldo setelah kejadian <Amount value={event.balance} privacy={privacy}/></small></span><Amount value={event.income || event.bills} privacy={privacy} className={event.income ? "positive-text" : "negative-text"}/></article>)}{!events.length && <div className="settings-empty">Belum ada pemasukan atau tagihan terjadwal dalam horizon ini.</div>}</div></section>
  </div>;
}

const roadmapColors: Record<RoadmapScenario["key"], string> = {
  conservative: "#c76565",
  base: "#126b59",
  optimistic: "#5574b8",
};

function RoadmapChart({ scenarios, privacy }: { scenarios: RoadmapScenario[]; privacy: boolean }) {
  const width = 760;
  const height = 270;
  const padding = { top: 18, right: 20, bottom: 34, left: 24 };
  const allValues = scenarios.flatMap((scenario) => scenario.points.map((point) => point.netWorth));
  const minimum = Math.min(...allValues, 0);
  const maximum = Math.max(...allValues, 1);
  const span = Math.max(1, maximum - minimum);
  const x = (index: number, total: number) => padding.left + (index / Math.max(1, total - 1)) * (width - padding.left - padding.right);
  const y = (value: number) => padding.top + (1 - (value - minimum) / span) * (height - padding.top - padding.bottom);
  const basePoints = scenarios.find((scenario) => scenario.key === "base")?.points ?? [];
  const labelIndexes = [...new Set([0, Math.floor((basePoints.length - 1) / 2), basePoints.length - 1])].filter((index) => index >= 0);

  return <div className="roadmap-chart-wrap">
    <div className="roadmap-chart-legend">{scenarios.map((scenario) => <span key={scenario.key}><i style={{ background: roadmapColors[scenario.key] }} />{scenario.label}</span>)}</div>
    <svg className="roadmap-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Grafik proyeksi kekayaan bersih untuk tiga skenario">
      {[0, .25, .5, .75, 1].map((ratio) => <line key={ratio} x1={padding.left} x2={width - padding.right} y1={padding.top + ratio * (height - padding.top - padding.bottom)} y2={padding.top + ratio * (height - padding.top - padding.bottom)} className="roadmap-grid-line" />)}
      {scenarios.map((scenario) => <polyline key={scenario.key} points={scenario.points.map((point, index) => `${x(index, scenario.points.length)},${y(point.netWorth)}`).join(" ")} fill="none" stroke={roadmapColors[scenario.key]} strokeWidth={scenario.key === "base" ? 4 : 2.4} strokeLinecap="round" strokeLinejoin="round" opacity={scenario.key === "base" ? 1 : .78} />)}
      {labelIndexes.map((index) => <text key={index} x={x(index, basePoints.length)} y={height - 8} textAnchor={index === 0 ? "start" : index === basePoints.length - 1 ? "end" : "middle"} className="roadmap-axis-label">{basePoints[index]?.month}</text>)}
    </svg>
    <span className="roadmap-chart-scale">Rentang proyeksi {privacy ? "disembunyikan" : `${formatIDR(minimum, true)} – ${formatIDR(maximum, true)}`}</span>
  </div>;
}

function RoadmapPage({ month, transactions, accounts, goals, investmentAssets, privacy, onToast }: {
  month: string;
  transactions: Transaction[];
  accounts: Account[];
  goals: Goal[];
  investmentAssets: InvestmentAsset[];
  privacy: boolean;
  onToast: (message: string) => void;
}) {
  const [settings, setSettings] = useState<RoadmapSettings>(DEFAULT_ROADMAP_SETTINGS);
  const [savedSettings, setSavedSettings] = useState<RoadmapSettings>(DEFAULT_ROADMAP_SETTINGS);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsError, setSettingsError] = useState("");
  const investmentMarketValue = investmentAssets.reduce((sum, asset) => sum + asset.marketValue, 0);
  const roadmap = useMemo(() => buildFinancialRoadmap({ transactions, accounts, goals, investmentMarketValue, settings, asOfMonth: month }), [transactions, accounts, goals, investmentMarketValue, settings, month]);
  const baseScenario = roadmap.scenarios.find((scenario) => scenario.key === "base")!;
  const assumptionsChanged = JSON.stringify(settings) !== JSON.stringify(savedSettings);

  useEffect(() => {
    let active = true;
    loadFinanceRoadmapSettings()
      .then((value) => { if (active) { setSettings(value); setSavedSettings(value); } })
      .catch((reason) => { if (active) setSettingsError(reason instanceof Error ? reason.message : "Asumsi tersimpan tidak dapat dimuat."); })
      .finally(() => { if (active) setLoadingSettings(false); });
    return () => { active = false; };
  }, []);

  const saveSettings = async () => {
    setSavingSettings(true); setSettingsError("");
    try {
      const saved = await updateFinanceRoadmapSettings(settings);
      setSettings(saved); setSavedSettings(saved);
      onToast("Asumsi Financial Roadmap berhasil disimpan.");
    } catch (reason) {
      setSettingsError(reason instanceof Error ? reason.message : "Asumsi Roadmap tidak dapat disimpan.");
    } finally { setSavingSettings(false); }
  };

  const update = <K extends keyof RoadmapSettings>(field: K, value: RoadmapSettings[K]) => setSettings((current) => ({ ...current, [field]: value }));

  return <div className="roadmap-layout">
    <section className="roadmap-hero">
      <div><span className="card-kicker light">Rencana utama · {settings.horizonMonths} bulan</span><h2><Amount value={baseScenario.finalNetWorth} privacy={privacy} /></h2><p>Estimasi kekayaan bersih pada {formatMonthLabel(baseScenario.points.at(-1)?.month ?? month)} berdasarkan data dan asumsi saat ini.</p></div>
      <div className="roadmap-hero-metrics"><span><small>Posisi sekarang</small><Amount value={roadmap.baseline.startingNetWorth} privacy={privacy} /></span><span><small>Potensi perubahan</small><Amount value={baseScenario.growth} privacy={privacy} className={baseScenario.growth >= 0 ? "positive-light" : "negative-light"} /></span><span><small>Arus kas rata-rata</small><Amount value={roadmap.baseline.monthlySurplus} privacy={privacy} /></span></div>
    </section>

    <section className="panel roadmap-chart-panel">
      <div className="card-title-row"><div><span className="card-kicker">Scenario engine</span><h2>Tiga kemungkinan perjalanan</h2></div><span className="roadmap-data-badge">{roadmap.observedMonths ? `${roadmap.observedMonths} bulan data` : "Menunggu data transaksi"}</span></div>
      <RoadmapChart scenarios={roadmap.scenarios} privacy={privacy} />
      {!roadmap.observedMonths && <div className="roadmap-inline-warning"><History size={16} /><span>Tambahkan transaksi pemasukan dan pengeluaran agar proyeksi memakai pola keuangan nyata.</span></div>}
    </section>

    <aside className="panel roadmap-control-panel">
      <div className="settings-title"><span><Route size={20} /></span><div><h2>Asumsi rencana</h2><p>Ubah angka untuk menjalankan simulasi secara langsung.</p></div></div>
      <div className="roadmap-control-list">
        <label><span>Horizon perencanaan</span><select value={settings.horizonMonths} onChange={(event) => update("horizonMonths", Number(event.target.value) as RoadmapSettings["horizonMonths"])}><option value={12}>12 bulan</option><option value={24}>24 bulan</option><option value={36}>36 bulan</option><option value={60}>60 bulan</option></select></label>
        <label><span>Perubahan pendapatan <strong>{settings.incomeAdjustmentPct > 0 ? "+" : ""}{settings.incomeAdjustmentPct}%</strong></span><input type="range" min={-50} max={100} step={1} value={settings.incomeAdjustmentPct} onChange={(event) => update("incomeAdjustmentPct", Number(event.target.value))} /></label>
        <label><span>Perubahan pengeluaran <strong>{settings.expenseAdjustmentPct > 0 ? "+" : ""}{settings.expenseAdjustmentPct}%</strong></span><input type="range" min={-50} max={100} step={1} value={settings.expenseAdjustmentPct} onChange={(event) => update("expenseAdjustmentPct", Number(event.target.value))} /></label>
        <label><span>Inflasi tahunan <strong>{settings.annualInflationPct}%</strong></span><input type="range" min={0} max={15} step={1} value={settings.annualInflationPct} onChange={(event) => update("annualInflationPct", Number(event.target.value))} /></label>
        <label><span>Imbal hasil investasi <strong>{settings.annualInvestmentReturnPct}%</strong></span><input type="range" min={0} max={30} step={1} value={settings.annualInvestmentReturnPct} onChange={(event) => update("annualInvestmentReturnPct", Number(event.target.value))} /></label>
        <label><span>Investasi rutin per bulan</span><div className="roadmap-money-input"><small>Rp</small><input type="number" min={0} max={1_000_000_000} step={100_000} value={settings.monthlyInvestment} onChange={(event) => update("monthlyInvestment", Math.max(0, Math.min(1_000_000_000, Number(event.target.value) || 0)))} /></div></label>
      </div>
      {settingsError && <div className="roadmap-setting-error">{settingsError}</div>}
      <button className="primary-button roadmap-save" onClick={saveSettings} disabled={loadingSettings || savingSettings || !assumptionsChanged}><Check size={16} /> {savingSettings ? "Menyimpan…" : loadingSettings ? "Memuat asumsi…" : assumptionsChanged ? "Simpan asumsi" : "Asumsi tersimpan"}</button>
      <small className="roadmap-disclaimer">Proyeksi adalah simulasi, bukan jaminan hasil investasi atau kondisi finansial masa depan.</small>
    </aside>

    <section className="roadmap-scenario-grid">
      {roadmap.scenarios.map((scenario) => <article className={`panel roadmap-scenario ${scenario.key}`} key={scenario.key}><span className="roadmap-scenario-dot" style={{ background: roadmapColors[scenario.key] }} /><div><small>{scenario.label}</small><h3><Amount value={scenario.finalNetWorth} privacy={privacy} /></h3><p>{scenario.description}</p></div><dl><div><dt>Perubahan</dt><dd><Amount value={scenario.growth} privacy={privacy} compact /></dd></div><div><dt>Bulan defisit</dt><dd>{scenario.deficitMonths}</dd></div></dl>{scenario.firstDeficitMonth && <span className="roadmap-risk"><ShieldCheck size={14} /> Defisit pertama diperkirakan {formatMonthLabel(scenario.firstDeficitMonth)}</span>}</article>)}
    </section>

    <section className="panel roadmap-goal-panel">
      <div className="card-title-row"><div><span className="card-kicker">Goal forecast</span><h2>Kesiapan target finansial</h2></div><span className="roadmap-data-badge">Prioritas berdasarkan deadline</span></div>
      <div className="roadmap-goal-list">{roadmap.goalForecasts.map((goal) => <div key={goal.id}><span className={goal.onTrack ? "roadmap-goal-icon on-track" : "roadmap-goal-icon at-risk"}>{goal.onTrack ? <CheckCircle2 size={17} /> : <Clock3 size={17} />}</span><span><strong>{goal.name}</strong><small>Sisa <Amount value={goal.remaining} privacy={privacy} /> · kebutuhan <Amount value={goal.recommendedMonthly} privacy={privacy} compact />/bulan</small></span><span><small>Perkiraan</small><strong className={goal.onTrack ? "positive-text" : "warning-text"}>{goal.projectedMonth ? formatMonthLabel(goal.projectedMonth) : "Belum terjangkau"}</strong></span></div>)}{!roadmap.goalForecasts.length && <div className="roadmap-goal-empty"><span><Target size={18} /></span><div><strong>Belum ada target aktif</strong><small>Target baru akan muncul di sini beserta estimasi kesiapan dan prioritas deadline.</small></div></div>}</div>
    </section>
  </div>;
}

function DebtPayoffPage({ month, accounts, privacy, onToast }: { month: string; accounts: Account[]; privacy: boolean; onToast: (message: string) => void }) {
  const liabilityAccounts = accounts.filter((account) => account.liability);
  const [settings, setSettings] = useState<DebtPlannerSettings>(DEFAULT_DEBT_SETTINGS);
  const [savedDebts, setSavedDebts] = useState<DebtPlan[]>([]);
  const [editing, setEditing] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    loadFinanceDebtPlanner().then((value) => {
      if (!active) return;
      setSettings(value.settings); setSavedDebts(value.debts); setError("");
    }).catch((reason) => active && setError(reason instanceof Error ? reason.message : "Rencana utang tidak dapat dimuat."))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  const plans = useMemo(() => savedDebts.map((debt) => {
    const account = liabilityAccounts.find((item) => item.id === debt.accountId);
    return account ? { ...debt, name: account.name, balance: account.balance } : null;
  }).filter((debt): debt is DebtPlan => Boolean(debt)), [savedDebts, liabilityAccounts]);
  const result = useMemo(() => simulateDebtPayoff(plans, settings), [plans, settings]);
  const comparison = useMemo(() => compareDebtStrategies(plans, settings.extraMonthlyPayment), [plans, settings.extraMonthlyPayment]);
  const payoffPeriod = !result.nonAmortizing && result.startingBalance > 0 ? addMonthsToPeriod(month, result.months) : null;
  const chartMax = Math.max(1, ...result.schedule.map((point) => point.balance));
  const chartWidth = 720; const chartHeight = 190; const padX = 18; const padY = 18;
  const chartPoints = result.schedule.map((point, index) => `${padX + index / Math.max(1, result.schedule.length - 1) * (chartWidth - padX * 2)},${padY + (1 - point.balance / chartMax) * (chartHeight - padY * 2)}`).join(" ");

  const saveSettings = async () => {
    setSaving(true); setError("");
    try { const next = await updateFinanceDebtPlannerSettings(settings); setSettings(next.settings); setSavedDebts(next.debts); onToast("Strategi pelunasan berhasil disimpan."); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Strategi tidak dapat disimpan."); }
    finally { setSaving(false); }
  };
  const savePlan = async (plan: Omit<DebtPlan, "name" | "balance">) => {
    setSaving(true); setError("");
    try { const next = await upsertFinanceDebtPlan(plan); setSettings(next.settings); setSavedDebts(next.debts); setEditing(null); onToast("Detail utang berhasil disimpan."); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Detail utang tidak dapat disimpan."); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="panel settings-empty">Memuat strategi pelunasan utang…</div>;
  return <div className="debt-layout">
    <section className="debt-hero">
      <div><span className="card-kicker light">Debt-free forecast</span><h2>{payoffPeriod ? formatMonthLabel(payoffPeriod) : result.startingBalance ? "Perlu penyesuaian" : "Siap membuat rencana"}</h2><p>{payoffPeriod ? `Dengan strategi ${settings.strategy}, seluruh utang diproyeksikan selesai dalam ${result.months} bulan.` : result.nonAmortizing ? "Pembayaran saat ini belum cukup untuk melunasi seluruh saldo dalam 50 tahun." : "Tambahkan akun kewajiban dan detail cicilannya untuk memulai simulasi."}</p></div>
      <div className="debt-hero-metrics"><span><small>Total utang</small><Amount value={result.startingBalance} privacy={privacy} /></span><span><small>Komitmen bulanan</small><Amount value={result.monthlyCommitment} privacy={privacy} /></span><span><small>Estimasi bunga</small><Amount value={result.totalInterest} privacy={privacy} /></span></div>
    </section>

    {error && <div className="data-alert debt-error"><span><TrendingDown size={17} /></span><div><strong>Rencana perlu perhatian</strong><small>{error}</small></div></div>}

    <section className="panel debt-chart-panel">
      <div className="card-title-row"><div><span className="card-kicker">Payoff trajectory</span><h2>Saldo menuju nol</h2></div><span className="roadmap-data-badge">{plans.length} utang terkonfigurasi</span></div>
      {plans.length ? <div className="debt-chart-wrap"><svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} role="img" aria-label="Grafik proyeksi saldo utang"><defs><linearGradient id="debt-area" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#d4685c" stopOpacity=".28"/><stop offset="1" stopColor="#d4685c" stopOpacity="0"/></linearGradient></defs><polyline points={`${padX},${chartHeight - padY} ${chartPoints} ${chartWidth - padX},${chartHeight - padY}`} fill="url(#debt-area)" stroke="none"/><polyline points={chartPoints} fill="none" stroke="#d4685c" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/></svg><div><span>Sekarang</span><span>{payoffPeriod ? formatMonthLabel(payoffPeriod) : "Belum lunas"}</span></div></div> : <div className="empty-state compact"><TrendingDown size={28}/><h3>Belum ada detail utang</h3><p>Konfigurasikan bunga dan cicilan minimum dari akun kewajibanmu.</p></div>}
    </section>

    <aside className="panel debt-settings-panel">
      <span className="card-kicker">Strategi utama</span><h2>Atur akselerasi</h2>
      <div className="debt-strategy-tabs"><button className={settings.strategy === "avalanche" ? "active" : ""} onClick={() => setSettings((value) => ({ ...value, strategy: "avalanche" }))}><strong>Avalanche</strong><small>Bunga tertinggi dulu</small></button><button className={settings.strategy === "snowball" ? "active" : ""} onClick={() => setSettings((value) => ({ ...value, strategy: "snowball" }))}><strong>Snowball</strong><small>Saldo terkecil dulu</small></button></div>
      <label className="debt-extra-field"><span>Pembayaran ekstra per bulan</span><div className="roadmap-money-input"><small>Rp</small><input value={settings.extraMonthlyPayment} onChange={(event) => setSettings((value) => ({ ...value, extraMonthlyPayment: Math.max(0, Math.min(1_000_000_000, Number(event.target.value) || 0)) }))} type="number" min={0} step={100000}/></div></label>
      <button className="primary-button roadmap-save" disabled={saving} onClick={() => void saveSettings()}><Check size={16}/>{saving ? "Menyimpan…" : "Simpan strategi"}</button>
      <small className="roadmap-disclaimer">Avalanche biasanya menekan bunga; snowball memberi kemenangan psikologis lebih cepat.</small>
    </aside>

    <section className="debt-comparison-grid">
      {([comparison.avalanche, comparison.snowball] as const).map((item) => <article className={`panel debt-comparison ${settings.strategy === item.strategy ? "selected" : ""}`} key={item.strategy}><span>{item.strategy === "avalanche" ? "Bunga minimum" : "Momentum cepat"}</span><h3>{item.strategy === "avalanche" ? "Avalanche" : "Snowball"}</h3><dl><div><dt>Durasi</dt><dd>{item.nonAmortizing ? "> 50 tahun" : `${item.months} bulan`}</dd></div><div><dt>Total bunga</dt><dd><Amount value={item.totalInterest} privacy={privacy} compact/></dd></div></dl></article>)}
    </section>

    <section className="panel debt-list-panel">
      <div className="card-title-row"><div><span className="card-kicker">Liability accounts</span><h2>Detail seluruh utang</h2></div>{!liabilityAccounts.length && <button className="secondary-button" disabled>Tambahkan akun kewajiban dahulu</button>}</div>
      <div className="debt-account-list">{liabilityAccounts.map((account) => { const plan = plans.find((item) => item.accountId === account.id); const payoff = result.debts.find((item) => item.accountId === account.id); return <article key={account.id}><span className="debt-account-icon"><CreditCard size={18}/></span><span><strong>{account.name}</strong><small>{plan ? `${plan.annualInterestRatePct}% per tahun · jatuh tempo tanggal ${plan.dueDay}` : "Bunga dan cicilan belum diatur"}</small></span><span><small>Saldo</small><Amount value={account.balance} privacy={privacy}/></span><span><small>Estimasi selesai</small><strong>{payoff?.payoffMonth ? formatMonthLabel(addMonthsToPeriod(month, payoff.payoffMonth)) : "—"}</strong></span><button className="secondary-button" onClick={() => setEditing(account)}><Pencil size={14}/>{plan ? "Edit" : "Atur"}</button></article>; })}{!liabilityAccounts.length && <div className="empty-state compact"><CreditCard size={28}/><h3>Belum ada akun kewajiban</h3><p>Tambahkan Credit Card, Paylater, Loan, atau Mortgage dari halaman Akun.</p></div>}</div>
    </section>
    {editing && <DebtPlanModal account={editing} plan={plans.find((item) => item.accountId === editing.id)} saving={saving} onClose={() => setEditing(null)} onSubmit={savePlan}/>} 
  </div>;
}

function DebtPlanModal({ account, plan, saving, onClose, onSubmit }: { account: Account; plan?: DebtPlan; saving: boolean; onClose: () => void; onSubmit: (plan: Omit<DebtPlan, "name" | "balance">) => Promise<void> }) {
  const [rate, setRate] = useState(plan ? String(plan.annualInterestRatePct) : "0");
  const [minimum, setMinimum] = useState(plan ? String(plan.minimumPayment) : "");
  const [dueDay, setDueDay] = useState(plan ? String(plan.dueDay) : "1");
  return <SimpleModal title={`Atur ${account.name}`} kicker="Debt terms" saving={saving} onClose={onClose} onSubmit={(event) => { event.preventDefault(); return onSubmit({ accountId: account.id, annualInterestRatePct: Number(rate.replace(",", ".") || 0), minimumPayment: Number(minimum || 0), dueDay: Number(dueDay || 1) }); }}>
    <div className="debt-modal-balance"><small>Saldo utang saat ini</small><strong>{formatIDR(account.balance)}</strong></div>
    <div className="form-grid"><label><span>Bunga per tahun (%)</span><input type="number" min={0} max={100} step="0.01" value={rate} onChange={(event) => setRate(event.target.value)} required autoFocus/></label><label><span>Cicilan minimum / bulan</span><input value={formatMoneyInput(minimum)} onChange={(event) => setMinimum(moneyInputDigits(event.target.value))} inputMode="numeric" required/></label><label><span>Tanggal jatuh tempo</span><input type="number" min={1} max={31} value={dueDay} onChange={(event) => setDueDay(event.target.value)} required/></label></div>
  </SimpleModal>;
}

function RecurringPage({ accounts, categories, privacy, onRefresh, onToast }: { accounts: Account[]; categories: FinanceCategory[]; privacy: boolean; onRefresh: () => Promise<void>; onToast: (message: string) => void }) {
  const [templates, setTemplates] = useState<RecurringTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState("");
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const load = async () => { const rows = await loadFinanceRecurringTemplates(); setTemplates(rows); return rows; };
  useEffect(() => { let active = true; loadFinanceRecurringTemplates().then((rows) => active && setTemplates(rows)).catch((reason) => active && setError(reason instanceof Error ? reason.message : "Jadwal tidak dapat dimuat.")).finally(() => active && setLoading(false)); return () => { active = false; }; }, []);
  const overview = useMemo(() => buildRecurringOverview(templates, today()), [templates]);
  const frequencyLabel: Record<RecurringTemplate["frequency"], string> = { weekly: "Mingguan", monthly: "Bulanan", quarterly: "3 bulanan", yearly: "Tahunan" };
  const save = async (payload: Omit<RecurringTemplate, "id" | "lastPostedDate" | "updatedAt">) => {
    setWorking("create"); setError("");
    try { await createFinanceRecurringTemplate(payload); await load(); setOpen(false); onToast("Jadwal transaksi rutin berhasil dibuat."); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Jadwal tidak dapat disimpan."); }
    finally { setWorking(""); }
  };
  const confirm = async (item: RecurringTemplate) => {
    if (!window.confirm(`Catat ${item.name} sebesar ${formatIDR(item.amount)} pada ledger tanggal ${shortDate(item.nextDueDate)}?`)) return;
    setWorking(item.id); setError("");
    try { const updated = await confirmFinanceRecurring(item.id, item.nextDueDate); setTemplates((rows) => rows.map((row) => row.id === item.id ? updated : row)); await onRefresh(); onToast("Transaksi rutin masuk ke ledger dan jadwal berikutnya sudah dibuat."); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Transaksi rutin tidak dapat dikonfirmasi."); }
    finally { setWorking(""); }
  };
  const toggle = async (item: RecurringTemplate) => {
    setWorking(item.id); setError("");
    try { const updated = await setFinanceRecurringActive(item.id, !item.active); setTemplates((rows) => rows.map((row) => row.id === item.id ? updated : row)); onToast(updated.active ? "Jadwal diaktifkan kembali." : "Jadwal dinonaktifkan."); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Status jadwal tidak dapat diubah."); }
    finally { setWorking(""); }
  };
  return <div className="content-stack recurring-page">
    <div className="summary-strip">
      <div><span>Pemasukan rutin / bulan</span><Amount value={overview.monthlyIncome} privacy={privacy}/><small>Nilai ekuivalen bulanan</small></div>
      <div><span>Komitmen / bulan</span><Amount value={overview.monthlyExpense} privacy={privacy}/><small>Belum mengubah saldo</small></div>
      <div><span>Langganan / tahun</span><Amount value={overview.annualSubscriptions} privacy={privacy}/><small>{templates.filter((item) => item.active && item.isSubscription).length} subscription aktif</small></div>
      <div><span>30 hari ke depan</span><strong>{overview.upcomingCount} jadwal</strong><small className={overview.overdueCount ? "negative-text" : "positive-text"}>{overview.overdueCount ? `${overview.overdueCount} terlambat` : "Tidak ada yang terlambat"}</small></div>
    </div>
    <section className="panel recurring-panel">
      <div className="card-title-row"><div><span className="card-kicker">Renewal calendar</span><h2>Jadwal aktif</h2></div><button className="primary-button" onClick={() => setOpen(true)}><Plus size={16}/> Tambah jadwal</button></div>
      <div className="recurring-safety"><ShieldCheck size={17}/><span><strong>Konfirmasi manual.</strong> Jadwal hanya menjadi transaksi dan mengubah saldo setelah tombol “Catat ke ledger” ditekan.</span></div>
      {error && <div className="portability-error" role="alert">{error}</div>}
      {loading ? <div className="settings-empty">Memuat transaksi rutin…</div> : templates.length ? <div className="recurring-list">{templates.map((item) => {
        const account = accounts.find((value) => value.id === item.accountId);
        const overdue = item.active && item.nextDueDate < today();
        return <article key={item.id} className={!item.active ? "inactive" : overdue ? "overdue" : ""}>
          <span className={`recurring-icon ${item.type}`}><Repeat2 size={18}/></span>
          <span className="recurring-main"><strong>{item.name}{item.isSubscription && <small>Subscription</small>}</strong><small>{item.category} · {account?.name ?? "Akun tidak ditemukan"} · {frequencyLabel[item.frequency]}</small></span>
          <span className="recurring-due"><small>{overdue ? "Terlambat" : "Jadwal berikutnya"}</small><strong>{shortDate(item.nextDueDate)}</strong></span>
          <span className={`recurring-amount ${item.type}`}><small>{item.type === "income" ? "Pemasukan" : "Pengeluaran"}</small><Amount value={item.amount} privacy={privacy}/></span>
          <span className="recurring-actions"><button className="secondary-button" onClick={() => toggle(item)} disabled={working === item.id}>{item.active ? "Jeda" : "Aktifkan"}</button>{item.active && <button className="primary-button" onClick={() => confirm(item)} disabled={working === item.id}><CheckCircle2 size={14}/>{working === item.id ? "Mencatat…" : "Catat ke ledger"}</button>}</span>
        </article>;
      })}</div> : <div className="empty-state"><Repeat2 size={30}/><h3>Belum ada transaksi rutin</h3><p>Tambahkan gaji, sewa, internet, software, atau langganan lain untuk melihat komitmen bulanan dan kalender renewal.</p><button className="primary-button" onClick={() => setOpen(true)}><Plus size={16}/> Buat jadwal pertama</button></div>}
    </section>
    {open && <RecurringModal accounts={accounts} categories={categories} saving={working === "create"} onClose={() => setOpen(false)} onSubmit={save}/>}
  </div>;
}

function BillsPage({ bills, accounts, privacy, saving, onPay, onPayAll, onSyncLiability, onEdit, onDelete, onAdd }: { bills: Bill[]; accounts: Account[]; privacy: boolean; saving: boolean; onPay: (bill: Bill) => void; onPayAll: (account: Account, bills: Bill[]) => void; onSyncLiability: (account: Account, bills: Bill[]) => void; onEdit: (bill: Bill) => void; onDelete: (bill: Bill) => void; onAdd: () => void }) {
  const activeBills = bills.filter((bill) => !bill.completed);
  const pending = activeBills.filter((bill) => !bill.paid);
  const installmentGroups = accounts.filter((account) => account.liability).map((account) => {
    const schedules = activeBills.filter((bill) => bill.liabilityAccountId === account.id);
    return { account, schedules, monthly: schedules.reduce((sum, bill) => sum + bill.amount, 0) };
  }).filter((group) => group.schedules.length);
  const consumerInstallmentGroups = installmentGroups.filter(({ account }) => ["Paylater", "Credit Card"].includes(account.type));
  const longTermInstallmentGroups = installmentGroups.filter(({ account }) => !["Paylater", "Credit Card"].includes(account.type));
  const ordinaryBills = bills.filter((bill) => !bill.liabilityAccountId);
  const installmentSections = [
    {
      key: "consumer",
      kicker: "Paylater & kartu kredit",
      title: "Cicilan konsumtif",
      description: "Beberapa cicilan dalam satu penyedia seperti Kredivo, SPayLater, atau kartu kredit.",
      groups: consumerInstallmentGroups,
    },
    {
      key: "long-term",
      kicker: "Kredit kendaraan & pinjaman",
      title: "Cicilan jangka panjang",
      description: "Kontrak besar seperti motor, mobil, pinjaman tunai, atau KPR dipantau terpisah.",
      groups: longTermInstallmentGroups,
    },
  ].filter((section) => section.groups.length);
  return <div className="content-stack">
    <div className="summary-strip">
      <div><span>Belum dibayar</span><strong>{pending.length} tagihan</strong><small>{monthLabel(currentMonth())}</small></div>
      <div><span>Total mendatang</span><Amount value={pending.reduce((sum, bill) => sum + bill.amount, 0)} privacy={privacy} /><small>Menurut jatuh tempo</small></div>
      <div><span>Sudah dibayar</span><strong>{bills.filter((bill) => bill.paid).length} tagihan</strong><small className="positive-text">Tepat waktu</small></div>
      <div><span>Pencatatan tagihan</span><strong>Konfirmasi manual</strong><small>Setiap pembayaran tetap kamu kendalikan</small></div>
    </div>
    {installmentSections.map((section) => <section className="panel installment-groups" key={section.key}>
      <div className="card-title-row"><div><span className="card-kicker">{section.kicker}</span><h2>{section.title}</h2></div><small>{section.groups.reduce((sum, group) => sum + group.schedules.length, 0)} jadwal aktif</small></div>
      <p className="installment-section-copy">{section.description}</p>
      <div className="installment-group-grid">{section.groups.map(({ account, schedules, monthly }) => {
        const unpaidSchedules = schedules.filter((bill) => !bill.paid);
        const dueTotal = unpaidSchedules.reduce((sum, bill) => sum + bill.amount, 0);
        const remainingTotals = schedules.map(remainingInstallmentTotal);
        const scheduledBalance = remainingTotals.some((value) => value === null) ? null : remainingTotals.reduce<number>((sum, value) => sum + Number(value || 0), 0);
        return <article className="installment-group-card" key={account.id}>
          <div className="installment-group-head">
            <span className="bill-brand"><CreditCard size={18} /></span>
            <span><span className="installment-account-title"><strong>{account.name}</strong><small className="installment-account-type">{account.type}</small></span><small>{schedules.length} cicilan aktif · saldo utang <Amount value={account.balance} privacy={privacy} /></small></span>
            <span><small>Total per bulan</small><Amount value={monthly} privacy={privacy} /></span>
          </div>
          <div className="installment-group-items">{schedules.map((bill) => <div key={bill.id}>
            <span><span className="installment-item-title"><strong>{bill.name}</strong><small className={bill.paid ? "paid-pill" : "installment-waiting"}>{bill.paid ? <><Check size={12} /> Dibayar</> : "Menunggu"}</small></span><small>Jatuh tempo {shortDate(bill.dueDate)}{bill.durationMonths ? ` · ${bill.remainingMonths ?? 0} bulan tersisa` : ""}</small>{bill.installmentPhases?.length ? <small className="installment-phase-badge">{currentInstallmentPhase(bill)?.phase.label} · fase {(currentInstallmentPhase(bill)?.phaseIndex ?? 0) + 1}/{bill.installmentPhases.length}</small> : null}</span>
            <Amount value={bill.amount} privacy={privacy} />
            <span className="installment-item-actions"><button className={bill.paid ? "secondary-button" : "primary-button"} onClick={() => onPay(bill)} disabled={saving || bill.paid}>{bill.paid ? "Selesai" : "Bayar"}</button><button className="icon-button small" onClick={() => onEdit(bill)} aria-label={`Edit ${bill.name}`}><Pencil size={15} /></button><button className="icon-button small" onClick={() => window.confirm(`Hapus cicilan ${bill.name}?`) && onDelete(bill)} aria-label={`Hapus ${bill.name}`}><Trash2 size={15} /></button></span>
          </div>)}</div>
          <div className="installment-group-footer">
            <span><small>Tagihan gabungan bulan ini</small><strong><Amount value={dueTotal} privacy={privacy} /> · {unpaidSchedules.length} belum dibayar</strong>{scheduledBalance !== null && <small>Sisa jadwal <Amount value={scheduledBalance} privacy={privacy} />{scheduledBalance !== account.balance ? " · saldo perlu diselaraskan" : " · saldo sudah sesuai"}</small>}</span>
            <span className="installment-footer-actions"><button className="secondary-button" disabled={saving || scheduledBalance === null || scheduledBalance === account.balance} onClick={() => onSyncLiability(account, schedules)}><Scale size={16} /> Sinkronkan saldo</button><button className={unpaidSchedules.length ? "primary-button" : "secondary-button"} disabled={saving || !unpaidSchedules.length} onClick={() => onPayAll(account, schedules)}><CheckCircle2 size={16} />{saving ? "Memproses…" : unpaidSchedules.length ? "Bayar semua" : "Lunas bulan ini"}</button></span>
          </div>
        </article>;
      })}</div>
    </section>)}
    <section className="panel bills-full-panel">
      <div className="card-title-row"><div><span className="card-kicker">Tagihan biasa</span><h2>Kebutuhan rutin {monthLabel(currentMonth())}</h2></div><button className="secondary-button" onClick={onAdd}><Plus size={16} /> Tambah tagihan</button></div>
      <div className="bill-cards">
        {[...ordinaryBills].sort((a, b) => Number(Boolean(a.completed)) - Number(Boolean(b.completed)) || a.dueDate.localeCompare(b.dueDate)).map((bill) => { const account = accounts.find((item) => item.id === bill.accountId); return <article className={bill.paid ? "paid" : ""} key={bill.id}>
          <span className={`bill-brand bill-${bill.category.toLowerCase()}`}>{bill.name.slice(0, 1)}</span>
          <div className="bill-card-main"><span><strong>{bill.name}</strong>{bill.completed ? <small className="paid-pill"><Check size={12} /> Lunas</small> : bill.paid && <small className="paid-pill"><Check size={12} /> Dibayar bulan ini</small>}</span><small>{bill.category} · {account?.name ?? "akun"}</small>{bill.durationMonths ? <small className="installment-progress">{bill.paidCount ?? 0}/{bill.durationMonths} pembayaran · {bill.remainingMonths ?? 0} bulan tersisa</small> : <small className="installment-progress">Berulang tanpa batas</small>}{bill.installmentPhases?.length ? <small className="installment-phase-badge">{currentInstallmentPhase(bill)?.phase.label} · {bill.installmentPhases.length} fase</small> : null}</div>
          <div className="bill-due"><small>Jatuh tempo</small><strong>{shortDate(bill.dueDate)}</strong></div>
          <Amount value={bill.amount} privacy={privacy} className="bill-amount" />
          <span className="bill-card-actions"><button className={bill.paid ? "secondary-button" : "primary-button"} onClick={() => onPay(bill)} disabled={bill.paid}>{bill.paid ? "Selesai" : "Bayar"}</button><button className="icon-button small" onClick={() => onEdit(bill)} aria-label={`Edit ${bill.name}`}><Pencil size={15} /></button><button className="icon-button small" onClick={() => window.confirm(`Hapus tagihan ${bill.name}?`) && onDelete(bill)} aria-label={`Hapus ${bill.name}`}><Trash2 size={15} /></button></span>
        </article>; })}
        {!ordinaryBills.length && <div className="empty-state compact"><CalendarDays size={28} /><h3>Belum ada tagihan biasa</h3><p>Listrik, internet, sewa, dan kebutuhan rutin lain akan tampil di sini.</p><button className="primary-button" onClick={onAdd}><Plus size={16} /> Tambah tagihan</button></div>}
      </div>
    </section>
  </div>;
}

const calendarEventLabel: Record<FinancialCalendarEvent["kind"], string> = {
  bill: "Tagihan",
  installment: "Cicilan",
  income: "Pemasukan",
  recurring_expense: "Pengeluaran rutin",
  goal: "Deadline target",
};

function FinancialCalendarPage({ accounts, bills, goals, privacy, initialMonth }: { accounts: Account[]; bills: Bill[]; goals: Goal[]; privacy: boolean; initialMonth: string }) {
  const [viewMonth, setViewMonth] = useState(initialMonth);
  const [selectedDate, setSelectedDate] = useState(today());
  const [templates, setTemplates] = useState<RecurringTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    loadFinanceRecurringTemplates()
      .then((items) => active && setTemplates(items))
      .catch((reason) => active && setError(reason instanceof Error ? reason.message : "Transaksi rutin tidak dapat dimuat."))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  const monthRange = calendarMonthRange(viewMonth);
  const ninetyDayEnd = addCalendarDays(today(), 90);
  const eventStart = monthRange.startDate < today() ? monthRange.startDate : today();
  const eventEnd = monthRange.endDate > ninetyDayEnd ? monthRange.endDate : ninetyDayEnd;
  const events = useMemo(() => buildFinancialCalendarEvents({
    bills,
    goals,
    recurringTemplates: templates,
    fromDate: eventStart,
    throughDate: eventEnd,
  }), [bills, goals, templates, eventStart, eventEnd]);
  const eventsByDate = useMemo(() => {
    const index = new Map<string, FinancialCalendarEvent[]>();
    events.forEach((event) => index.set(event.date, [...(index.get(event.date) ?? []), event]));
    return index;
  }, [events]);
  const calendarDays = Array.from({ length: 42 }, (_, index) => addCalendarDays(monthRange.startDate, index));
  const selectedEvents = eventsByDate.get(selectedDate) ?? [];
  const agendaEnd = addCalendarDays(today(), 30);
  const upcoming = events.filter((event) => event.date >= today() && event.date <= agendaEnd);
  const needs7 = financialCalendarWindow(events, today(), 7);
  const needs14 = financialCalendarWindow(events, today(), 14);
  const needs30 = financialCalendarWindow(events, today(), 30);
  const accountName = (event: FinancialCalendarEvent) => accounts.find((account) => account.id === (event.liabilityAccountId || event.accountId))?.name ?? "";
  const changeMonth = (offset: number) => {
    const next = addMonthsToPeriod(viewMonth, offset);
    setViewMonth(next);
    setSelectedDate(`${next}-01`);
  };

  return <div className="calendar-page">
    <div className="calendar-horizon-strip">
      <div><span>Kebutuhan 7 hari</span><Amount value={needs7.outgoing} privacy={privacy}/><small>Setelah pemasukan: <Amount value={needs7.netNeed} privacy={privacy}/></small></div>
      <div><span>Kebutuhan 14 hari</span><Amount value={needs14.outgoing} privacy={privacy}/><small>Setelah pemasukan: <Amount value={needs14.netNeed} privacy={privacy}/></small></div>
      <div><span>Kebutuhan 30 hari</span><Amount value={needs30.outgoing} privacy={privacy}/><small>{needs30.criticalDays} hari perlu dana</small></div>
      <div><span>Pemasukan 30 hari</span><Amount value={needs30.incoming} privacy={privacy}/><small>{upcoming.filter((event) => event.kind === "income").length} jadwal pemasukan</small></div>
    </div>
    <div className="calendar-layout">
      <section className="panel financial-calendar-panel">
        <div className="calendar-toolbar">
          <div><span className="card-kicker">Timeline bulanan</span><h2>{monthLabel(viewMonth)}</h2></div>
          <span className="calendar-controls"><button className="icon-button" onClick={() => changeMonth(-1)} aria-label="Bulan sebelumnya"><ArrowRight size={17} /></button><button className="secondary-button" onClick={() => { setViewMonth(initialMonth); setSelectedDate(today()); }}>Hari ini</button><button className="icon-button" onClick={() => changeMonth(1)} aria-label="Bulan berikutnya"><ArrowRight size={17} /></button></span>
        </div>
        <div className="calendar-legend"><span><i className="income"/>Pemasukan</span><span><i className="bill"/>Tagihan</span><span><i className="installment"/>Cicilan</span><span><i className="goal"/>Target</span></div>
        <div className="calendar-weekdays">{["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"].map((day) => <span key={day}>{day}</span>)}</div>
        <div className="calendar-grid">{calendarDays.map((date) => {
          const dayEvents = eventsByDate.get(date) ?? [];
          const outgoing = dayEvents.filter((event) => event.countsTowardNeed).reduce((sum, event) => sum + event.amount, 0);
          const incoming = dayEvents.filter((event) => event.kind === "income").reduce((sum, event) => sum + event.amount, 0);
          const dayState = outgoing > incoming ? "critical" : dayEvents.length ? "safe" : "";
          return <button type="button" key={date} className={`${date.slice(0, 7) === viewMonth ? "" : "outside"} ${date === today() ? "today" : ""} ${date === selectedDate ? "selected" : ""} ${dayState}`} onClick={() => setSelectedDate(date)} aria-label={`${shortDate(date)}, ${dayEvents.length} agenda`}>
            <span>{Number(date.slice(-2))}</span>
            <span className="calendar-day-events">{dayEvents.slice(0, 3).map((event) => <i className={event.kind} key={event.id} title={event.title}/>)}</span>
            {dayEvents.length > 3 && <small>+{dayEvents.length - 3}</small>}
          </button>;
        })}</div>
        <div className="selected-day-agenda">
          <div><span className="card-kicker">Agenda terpilih</span><h3>{new Intl.DateTimeFormat("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date(`${selectedDate}T12:00:00`))}</h3></div>
          {selectedEvents.length ? <div>{selectedEvents.map((event) => <article key={event.id}>
            <span className={`calendar-event-icon ${event.kind}`}>{event.kind === "income" ? <ArrowDownLeft size={16}/> : event.kind === "goal" ? <Target size={16}/> : event.kind === "installment" ? <CreditCard size={16}/> : <ReceiptText size={16}/>}</span>
            <span><strong>{event.title}</strong><small>{calendarEventLabel[event.kind]}{accountName(event) ? ` · ${accountName(event)}` : ""}{event.paid ? " · sudah dibayar" : ""}</small></span>
            {event.amount > 0 && <Amount value={event.amount} privacy={privacy}/>}
          </article>)}</div> : <p>Tidak ada agenda finansial pada tanggal ini.</p>}
        </div>
      </section>
      <aside className="panel calendar-agenda-panel">
        <div className="card-title-row"><div><span className="card-kicker">30 hari ke depan</span><h2>Agenda mendatang</h2></div><small>{upcoming.length} agenda</small></div>
        {loading ? <div className="settings-empty">Menyatukan semua jadwal…</div> : error ? <div className="portability-error">{error}</div> : upcoming.length ? <div className="calendar-upcoming-list">{upcoming.slice(0, 14).map((event) => <button type="button" key={event.id} onClick={() => { setViewMonth(event.date.slice(0, 7)); setSelectedDate(event.date); }}>
          <span className={`calendar-date-chip ${event.kind}`}><strong>{event.date.slice(-2)}</strong><small>{shortMonth(event.date)}</small></span>
          <span><strong>{event.title}</strong><small>{calendarEventLabel[event.kind]}{accountName(event) ? ` · ${accountName(event)}` : ""}</small></span>
          {event.amount > 0 && <Amount value={event.amount} privacy={privacy}/>}
        </button>)}</div> : <div className="empty-state compact"><CalendarDays size={28}/><h3>Belum ada agenda</h3><p>Tambahkan tagihan, cicilan, target, atau transaksi rutin untuk mengisi kalender.</p></div>}
        <div className="calendar-safety-note"><ShieldCheck size={16}/><span><strong>Aman berarti jadwal terlihat.</strong><small>Transaksi rutin tetap membutuhkan konfirmasi sebelum mengubah saldo ledger.</small></span></div>
      </aside>
    </div>
  </div>;
}

const formatUnits = (value: number) => new Intl.NumberFormat("id-ID", { maximumFractionDigits: 8 }).format(value);

function InvestmentsPage({ assets, transactions, accounts, privacy, onAddAsset, onEditAsset, onTrade }: {
  assets: InvestmentAsset[];
  transactions: InvestmentTransaction[];
  accounts: Account[];
  privacy: boolean;
  onAddAsset: () => void;
  onEditAsset: (asset: InvestmentAsset) => void;
  onTrade: (type: "buy" | "sell", asset?: InvestmentAsset) => void;
}) {
  const marketValue = assets.reduce((sum, asset) => sum + asset.marketValue, 0);
  const costBasis = assets.reduce((sum, asset) => sum + asset.costBasis, 0);
  const unrealized = marketValue - costBasis;
  const realized = assets.reduce((sum, asset) => sum + asset.realizedPl, 0);
  const hasInvestmentAccount = accounts.some((account) => account.type === "Investment" && !account.liability);
  return <div className="content-stack">
    <div className="investment-hero">
      <div><span className="card-kicker light">Nilai portofolio</span><span className="investment-value"><Amount value={marketValue} privacy={privacy} /></span><p><span>{assets.length} aset aktif</span> Harga manual atau transaksi terakhir; bukan harga real-time.</p></div>
      <div className="investment-stats"><span><small>Cost basis</small><Amount value={costBasis} privacy={privacy} /></span><span><small>Unrealized P/L</small><Amount value={unrealized} privacy={privacy} className={unrealized >= 0 ? "positive-light" : "negative-light"} /></span><span><small>Realized P/L</small><Amount value={realized} privacy={privacy} className={realized >= 0 ? "positive-light" : "negative-light"} /></span></div>
    </div>
    <section className="panel investment-panel">
      <div className="card-title-row"><div><span className="card-kicker">Holdings</span><h2>Aset investasi</h2></div><div className="investment-actions"><button className="secondary-button" onClick={() => onTrade("sell")} disabled={!assets.some((asset) => asset.units > 0)}><ArrowDownLeft size={16} /> Jual</button><button className="primary-button" onClick={() => onTrade("buy")} disabled={!assets.length}><ArrowUpRight size={16} /> Beli</button></div></div>
      <div className="price-status"><CircleDollarSign size={14} /><span>Harga menyertakan sumber dan waktu pembaruan. Gunakan edit aset untuk memperbarui harga manual.</span></div>
      {assets.length ? <div className="asset-table">
        <div className="asset-head"><span>Aset</span><span>Unit</span><span>Harga rata-rata</span><span>Harga pasar</span><span>Nilai</span><span>P/L</span></div>
        {assets.map((asset, index) => <div className="asset-row" key={asset.id}>
          <span className="asset-logo" style={{ background: ["#126b59", "#5574b8", "#b17a34", "#865ab2"][index % 4] }}>{asset.ticker.slice(0, 3)}</span>
          <span className="asset-name"><strong>{asset.ticker} · {asset.name}</strong><small>{asset.assetClass}{asset.exchange ? ` · ${asset.exchange}` : ""} · {asset.priceStatus === "manual" ? "manual" : asset.priceStatus === "delayed" ? "harga transaksi terakhir" : "harga belum tersedia"}</small></span>
          <span>{formatUnits(asset.units)}</span>
          <Amount value={asset.averageCost} privacy={privacy} />
          <Amount value={asset.marketPrice} privacy={privacy} />
          <Amount value={asset.marketValue} privacy={privacy} />
          <span className={asset.unrealizedPl >= 0 ? "investment-profit" : "investment-loss"}><Amount value={asset.unrealizedPl} privacy={privacy} /><small><button className="asset-link" onClick={() => onTrade("buy", asset)}>Beli</button> · <button className="asset-link" onClick={() => onTrade("sell", asset)} disabled={asset.units <= 0}>Jual</button> · <button className="asset-link" onClick={() => onEditAsset(asset)}>Edit</button></small></span>
        </div>)}
      </div> : <div className="empty-state"><TrendingUp size={30} /><h3>Belum ada aset investasi</h3><p>{hasInvestmentAccount ? "Tambahkan saham, reksadana, kripto, emas, atau aset lainnya untuk mulai menghitung cost basis." : "Tambahkan akun bertipe Investment terlebih dahulu, lalu buat aset portofolio."}</p><button className="primary-button" onClick={onAddAsset}><Plus size={16} /> Tambah aset</button></div>}
    </section>
    <section className="panel investment-history">
      <div className="card-title-row"><div><span className="card-kicker">Riwayat</span><h2>Transaksi investasi</h2></div><span className="price-status">Weighted average cost</span></div>
      <div className="investment-history-list">{transactions.slice(0, 12).map((transaction) => { const asset = assets.find((item) => item.id === transaction.assetId); return <div key={transaction.id}><span className={transaction.type === "buy" ? "notice-icon good" : "notice-icon info"}>{transaction.type === "buy" ? <ArrowUpRight size={15} /> : <ArrowDownLeft size={15} />}</span><span><strong>{transaction.type === "buy" ? "Beli" : "Jual"} {asset?.ticker ?? "Aset"}</strong><small>{shortDate(transaction.date)} · {formatUnits(transaction.units)} unit @ {formatIDR(transaction.pricePerUnit)}</small></span><span><Amount value={transaction.netAmount} privacy={privacy} /><small>{transaction.type === "sell" ? `P/L ${privacy ? "disembunyikan" : formatIDR(transaction.realizedPl)}` : `Avg ${privacy ? "disembunyikan" : formatIDR(transaction.averageCostAfter)}`}</small></span></div>; })}{!transactions.length && <div className="investment-history-empty">Belum ada transaksi buy atau sell.</div>}</div>
    </section>
  </div>;
}

const reportSectionOptions: Array<{ key: ReportSection; label: string }> = [
  { key: "summary", label: "Ringkasan eksekutif" },
  { key: "cashflow", label: "Arus kas & transaksi" },
  { key: "categories", label: "Kategori" },
  { key: "accounts", label: "Saldo akun" },
  { key: "budgets", label: "Anggaran" },
  { key: "bills", label: "Tagihan" },
  { key: "goals", label: "Target" },
  { key: "roadmap", label: "Financial Roadmap" },
  { key: "forecast", label: "Cashflow Forecast" },
  { key: "emergency", label: "Dana darurat" },
  { key: "debts", label: "Pelunasan utang" },
  { key: "investments", label: "Investasi" },
  { key: "recurring", label: "Transaksi rutin & subscription" },
];

const downloadBrowserFile = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
};

const fileSizeLabel = (value: number) => value >= 1024 * 1024
  ? `${(value / 1024 / 1024).toFixed(1)} MB`
  : `${Math.max(1, Math.round(value / 1024))} KB`;

function MonthlyReviewPage({ period, transactions, accounts, budgets, goals, bills, privacy, onToast }: {
  period: string;
  transactions: Transaction[];
  accounts: Account[];
  budgets: Budget[];
  goals: Goal[];
  bills: Bill[];
  privacy: boolean;
  onToast: (message: string) => void;
}) {
  const review = useMemo(() => buildMonthlyReview({ period, transactions, accounts, budgets, goals, bills }), [period, transactions, accounts, budgets, goals, bills]);
  const [closing, setClosing] = useState<MonthlyClosing>({ period, status: "open", closedAt: null, snapshot: null });
  const [loadingClosing, setLoadingClosing] = useState(true);
  const [savingClosing, setSavingClosing] = useState(false);
  const [balanceConfirmed, setBalanceConfirmed] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoadingClosing(true);
    setBalanceConfirmed(false);
    loadFinanceMonthlyClosing(period)
      .then((value) => { if (active) { setClosing(value); setError(""); } })
      .catch((reason) => active && setError(reason instanceof Error ? reason.message : "Status tutup buku tidak dapat dimuat."))
      .finally(() => active && setLoadingClosing(false));
    return () => { active = false; };
  }, [period]);

  const displayed = closing.status === "closed" && closing.snapshot ? closing.snapshot : review;
  const budgetPercent = displayed.budgetLimit > 0 ? displayed.budgetSpent / displayed.budgetLimit * 100 : 0;
  const closeBook = async () => {
    if (!balanceConfirmed || review.pendingCount || savingClosing) return;
    setSavingClosing(true); setError("");
    try {
      const value = await closeFinanceMonthlyBook(period, review);
      setClosing(value);
      setBalanceConfirmed(false);
      onToast(`${monthLabel(period)} berhasil ditutup dan snapshot disimpan.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Bulan tidak dapat ditutup.");
    } finally { setSavingClosing(false); }
  };
  const reopenBook = async () => {
    if (!window.confirm(`Buka kembali ${monthLabel(period)}? Ledger bulan ini akan dapat diubah lagi.`) || savingClosing) return;
    setSavingClosing(true); setError("");
    try {
      const value = await reopenFinanceMonthlyBook(period);
      setClosing(value);
      onToast(`${monthLabel(period)} dibuka kembali.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Bulan tidak dapat dibuka kembali.");
    } finally { setSavingClosing(false); }
  };

  return <div className="monthly-review-layout">
    <section className={`monthly-review-hero ${closing.status}`}>
      <div><span className="card-kicker light">{closing.status === "closed" ? "Snapshot tersimpan" : "Review berjalan"}</span><h2>{monthLabel(period)}</h2><p>{closing.status === "closed" ? "Ledger periode ini terkunci. Nilai di bawah berasal dari snapshot saat tutup buku." : "Periksa arus kas, anggaran, kewajiban, dan transaksi tidak biasa sebelum menutup bulan."}</p></div>
      <span className="monthly-close-status">{closing.status === "closed" ? <LockKeyhole size={18} /> : <ShieldCheck size={18} />}<span><strong>{closing.status === "closed" ? "Bulan ditutup" : "Bulan masih terbuka"}</strong><small>{closing.closedAt ? new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date(closing.closedAt)) : `${displayed.transactionCount} transaksi selesai`}</small></span></span>
    </section>

    <section className="monthly-review-metrics">
      <article className="panel"><small>Arus kas bersih</small><Amount value={displayed.summary.cashflow} privacy={privacy} /><span className={displayed.summary.cashflow >= 0 ? "positive-text" : "negative-text"}>{displayed.summary.savingsRate.toFixed(1)}% savings rate</span></article>
      <article className="panel"><small>Perubahan kekayaan bersih</small><Amount value={displayed.netWorthChange} privacy={privacy} /><span>Posisi akhir <Amount value={displayed.netWorth} privacy={privacy} compact /></span></article>
      <article className="panel"><small>Realisasi anggaran</small><strong>{budgetPercent.toFixed(1)}%</strong><span><Amount value={displayed.budgetSpent} privacy={privacy} compact /> dari <Amount value={displayed.budgetLimit} privacy={privacy} compact /></span></article>
      <article className="panel"><small>Perubahan kewajiban</small><Amount value={displayed.liabilityChange} privacy={privacy} /><span>Sisa <Amount value={displayed.liabilities} privacy={privacy} compact /></span></article>
    </section>

    <section className="panel monthly-review-panel">
      <div className="card-title-row"><div><span className="card-kicker">Rencana vs realisasi</span><h2>Kinerja anggaran</h2></div><span className="roadmap-data-badge">{displayed.budgetRows.length} kategori</span></div>
      <div className="monthly-budget-list">{displayed.budgetRows.slice(0, 8).map((row) => <div key={row.category}><span><strong>{row.category}</strong><small><Amount value={row.spent} privacy={privacy} compact /> dari <Amount value={row.limit} privacy={privacy} compact /></small></span><span><strong className={row.percent > 100 ? "negative-text" : row.percent >= 80 ? "warning-text" : "positive-text"}>{row.percent.toFixed(0)}%</strong><ProgressBar value={row.percent} color={row.percent > 100 ? "var(--danger)" : row.percent >= 80 ? "var(--warning)" : "var(--primary)"} /></span></div>)}{!displayed.budgetRows.length && <div className="settings-empty">Belum ada anggaran pada periode ini.</div>}</div>
    </section>

    <section className="panel monthly-review-panel">
      <div className="card-title-row"><div><span className="card-kicker">Pengeluaran</span><h2>Terbesar & tidak biasa</h2></div><span className="roadmap-data-badge">{displayed.unusualExpenses.length} perlu ditinjau</span></div>
      <div className="monthly-insight-columns">
        <div><strong>Pengeluaran terbesar</strong>{displayed.topExpenses.map((item, index) => <div className="monthly-rank-row" key={item.label}><i>{index + 1}</i><span>{item.label}</span><Amount value={item.amount} privacy={privacy} /></div>)}{!displayed.topExpenses.length && <small>Belum ada pengeluaran selesai.</small>}</div>
        <div><strong>Perubahan pola</strong>{displayed.unusualExpenses.map((item) => <div className="monthly-unusual-row" key={item.category}><TriangleAlert size={16} /><span><strong>{item.category}</strong><small>{item.reason}</small></span><Amount value={item.amount} privacy={privacy} compact /></div>)}{!displayed.unusualExpenses.length && <small>Tidak ada lonjakan besar dibanding tiga bulan sebelumnya.</small>}</div>
      </div>
    </section>

    <section className="panel monthly-review-panel">
      <div className="card-title-row"><div><span className="card-kicker">Kemajuan</span><h2>Target & kewajiban</h2></div><span className="roadmap-data-badge">{displayed.unpaidBills} tagihan menunggu</span></div>
      <div className="monthly-goal-grid">{displayed.goals.slice(0, 6).map((goal) => <article key={goal.id}><span><strong>{goal.name}</strong><small><Amount value={goal.current} privacy={privacy} compact /> dari <Amount value={goal.target} privacy={privacy} compact /></small></span><strong>{goal.percent.toFixed(0)}%</strong><ProgressBar value={goal.percent} color="var(--primary)" /></article>)}{!displayed.goals.length && <div className="settings-empty">Belum ada target finansial aktif.</div>}</div>
      <div className="monthly-liability-strip"><CreditCard size={18} /><span><small>Total kewajiban saat ini</small><Amount value={displayed.liabilities} privacy={privacy} /></span><span><small>Komitmen tagihan berikutnya</small><Amount value={displayed.billsDue} privacy={privacy} /></span></div>
    </section>

    <aside className="panel monthly-closing-panel">
      <div className="settings-title"><span><LockKeyhole size={20} /></span><div><h2>Tutup buku bulanan</h2><p>Simpan snapshot dan hentikan perubahan ledger pada {monthLabel(period)}.</p></div></div>
      {closing.status === "closed" ? <>
        <div className="monthly-closed-notice"><CheckCircle2 size={20} /><span><strong>Snapshot aman</strong><small>Transaksi, impor, cicilan, rekonsiliasi, dan transaksi investasi pada bulan ini sudah dikunci.</small></span></div>
        <button className="secondary-button full" onClick={reopenBook} disabled={savingClosing}>{savingClosing ? "Membuka…" : "Buka kembali bulan"}</button>
      </> : <>
        <div className="monthly-checklist">
          <span className={review.pendingCount === 0 ? "done" : "blocked"}>{review.pendingCount === 0 ? <Check size={16} /> : <TriangleAlert size={16} />}<span><strong>Transaksi pending</strong><small>{review.pendingCount === 0 ? "Tidak ada transaksi pending." : `${review.pendingCount} transaksi harus diselesaikan.`}</small></span></span>
          <span className={accounts.length ? "done" : "blocked"}>{accounts.length ? <Check size={16} /> : <TriangleAlert size={16} />}<span><strong>Akun tersedia</strong><small>{accounts.length} akun masuk dalam pemeriksaan.</small></span></span>
          <span className="done"><Check size={16} /><span><strong>Snapshot siap</strong><small>{review.transactionCount} transaksi dan {review.budgetRows.length} anggaran diringkas.</small></span></span>
        </div>
        <label className="monthly-confirm"><input type="checkbox" checked={balanceConfirmed} onChange={(event) => setBalanceConfirmed(event.target.checked)} /><span><strong>Saya sudah memeriksa saldo akun</strong><small>Penutupan akan mengunci seluruh perubahan ledger pada periode ini.</small></span></label>
        <button className="primary-button full" onClick={closeBook} disabled={loadingClosing || savingClosing || review.pendingCount > 0 || !balanceConfirmed}><LockKeyhole size={17} />{savingClosing ? "Menutup bulan…" : "Tutup bulan & simpan snapshot"}</button>
      </>}
      {error && <div className="portability-error" role="alert">{error}</div>}
    </aside>
  </div>;
}

function ReportsPage({ period, profile, transactions, accounts, budgets, goals, bills, categories, investmentAssets, investmentTransactions, monthly, accountTotals, privacy, onToast }: {
  period: string;
  profile: FinanceProfile;
  transactions: Transaction[];
  accounts: Account[];
  budgets: Budget[];
  goals: Goal[];
  bills: Bill[];
  categories: FinanceCategory[];
  investmentAssets: InvestmentAsset[];
  investmentTransactions: InvestmentTransaction[];
  monthly: ReturnType<typeof monthlySummary>;
  accountTotals: ReturnType<typeof accountSummary>;
  privacy: boolean;
  onToast: (message: string) => void;
}) {
  const [sections, setSections] = useState<ReportSection[]>(reportSectionOptions.map((item) => item.key));
  const [maskPdf, setMaskPdf] = useState(privacy);
  const [generating, setGenerating] = useState(false);
  const [reports, setReports] = useState<ExportRecord[]>([]);
  const [roadmapReportSettings, setRoadmapReportSettings] = useState<RoadmapSettings>(DEFAULT_ROADMAP_SETTINGS);
  const [debtReportPlanner, setDebtReportPlanner] = useState<{ settings: DebtPlannerSettings; debts: DebtPlan[] }>({ settings: DEFAULT_DEBT_SETTINGS, debts: [] });
  const [forecastReportSettings, setForecastReportSettings] = useState<CashflowForecastSettings>(DEFAULT_CASHFLOW_FORECAST_SETTINGS);
  const [emergencyReportSettings, setEmergencyReportSettings] = useState<EmergencyFundSettings>(DEFAULT_EMERGENCY_FUND_SETTINGS);
  const [recurringReportTemplates, setRecurringReportTemplates] = useState<RecurringTemplate[]>([]);
  const [error, setError] = useState("");
  const monthTransactions = transactions.filter((item) => item.date.startsWith(period) && item.status === "completed");
  const expensesByCategory = monthTransactions.filter((item) => item.type === "expense").reduce<Record<string, number>>((result, item) => {
    result[item.category] = (result[item.category] ?? 0) + item.amount;
    return result;
  }, {});
  const topExpense = Object.entries(expensesByCategory).sort((a, b) => b[1] - a[1])[0];
  const liabilityRatio = accountTotals.assets > 0 ? accountTotals.liabilities / accountTotals.assets * 100 : accountTotals.liabilities > 0 ? 100 : 0;
  const chartMax = Math.max(1, monthly.income, monthly.expense, Math.max(0, monthly.cashflow));
  const reportHeadline = monthly.income === 0 && monthly.expense === 0
    ? "Belum ada arus kas untuk diringkas bulan ini."
    : monthly.cashflow >= 0
      ? "Arus kas bulan ini berada di posisi positif."
      : "Pengeluaran bulan ini lebih tinggi daripada pemasukan.";
  const reportNote = topExpense
    ? `${topExpense[0]} merupakan pengeluaran terbesar bulan ini sebesar ${formatIDR(topExpense[1])}.`
    : "Tambahkan transaksi agar laporan dapat mengidentifikasi pola pengeluaran utama.";
  useEffect(() => {
    let active = true;
    loadFinanceReports()
      .then((result) => active && setReports(result.reports))
      .catch((reason) => active && setError(reason instanceof Error ? reason.message : "Riwayat laporan tidak dapat dimuat."));
    loadFinanceRoadmapSettings().then((value) => active && setRoadmapReportSettings(value)).catch(() => undefined);
    loadFinanceDebtPlanner().then((value) => active && setDebtReportPlanner({ settings: value.settings, debts: value.debts.map((debt) => ({ ...debt, balance: accounts.find((account) => account.id === debt.accountId)?.balance ?? debt.balance })) })).catch(() => undefined);
    loadFinanceCashflowForecastSettings().then((value) => active && setForecastReportSettings(value)).catch(() => undefined);
    loadFinanceEmergencyFundSettings().then((value) => active && setEmergencyReportSettings(value)).catch(() => undefined);
    loadFinanceRecurringTemplates().then((value) => active && setRecurringReportTemplates(value)).catch(() => undefined);
    return () => { active = false; };
  }, [accounts]);

  const toggleSection = (section: ReportSection) => {
    setSections((current) => current.includes(section) ? current.filter((item) => item !== section) : [...current, section]);
  };

  const exportCsv = async () => {
    const report = await import("../lib/report");
    const csv = report.buildFinanceCsv({ period, transactions });
    downloadBrowserFile(new Blob([csv], { type: "text/csv;charset=utf-8" }), report.financeCsvFilename(profile.storeName, period));
    onToast("CSV transaksi berhasil diunduh.");
  };

  const exportPdf = async () => {
    if (!sections.length || generating) return;
    setGenerating(true);
    setError("");
    try {
      const report = await import("../lib/report");
      const result = report.generateFinancePdf({
        period,
        profile,
        transactions,
        accounts,
        budgets,
        goals,
        bills,
        categories,
        investmentAssets,
        investmentTransactions,
        privacy: maskPdf,
        sections,
        roadmapSettings: roadmapReportSettings,
        debtPlanner: debtReportPlanner,
        forecastSettings: forecastReportSettings,
        emergencyFundSettings: emergencyReportSettings,
        recurringTemplates: recurringReportTemplates,
      });
      const saved = await saveFinanceReport({
        filename: result.filename,
        contentBase64: byteArrayToBase64(result.bytes),
        period,
        sections,
        privacy: maskPdf,
        pageCount: result.pageCount,
      });
      downloadBrowserFile(new Blob([result.bytes as BlobPart], { type: "application/pdf" }), result.filename);
      setReports((current) => [saved, ...current.filter((item) => item.id !== saved.id)].slice(0, 30));
      onToast(`PDF ${result.pageCount} halaman dibuat, disimpan, dan diunduh.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "PDF tidak dapat dibuat.");
    } finally {
      setGenerating(false);
    }
  };

  return <div className="report-layout">
    <section className="report-sheet">
      <div className="report-brand"><BrandMark /><span><strong>{profile.storeName}</strong><small>Personal Finance</small></span><div><small>LAPORAN BULANAN</small><strong>{monthLabel(period)}</strong></div></div>
      <div className="report-title"><span>Ringkasan eksekutif</span><h2>{reportHeadline}</h2><p>Savings rate tercatat {monthly.savingsRate.toFixed(1)}% dan rasio kewajiban terhadap aset {liabilityRatio.toFixed(1)}%.</p></div>
      <div className="report-metrics"><div><span>Kekayaan bersih</span><Amount value={accountTotals.netWorth} privacy={privacy} /></div><div><span>Arus kas bersih</span><Amount value={monthly.cashflow} privacy={privacy} /></div><div><span>Savings rate</span><strong>{monthly.savingsRate.toFixed(1)}%</strong></div></div>
      <div className="report-section"><span className="card-kicker">Arus kas bulanan</span><div className="report-bars"><div><span>Pemasukan</span><i style={{ width: `${monthly.income / chartMax * 100}%` }} /><Amount value={monthly.income} privacy={privacy} /></div><div><span>Pengeluaran</span><i className="expense-bar" style={{ width: `${monthly.expense / chartMax * 100}%` }} /><Amount value={monthly.expense} privacy={privacy} /></div><div><span>Tabungan</span><i className="saving-bar" style={{ width: `${Math.max(0, monthly.cashflow) / chartMax * 100}%` }} /><Amount value={monthly.cashflow} privacy={privacy} /></div></div></div>
      <div className="report-note"><Sparkles size={18} /><p><strong>Catatan:</strong> {reportNote}</p></div>
    </section>
    <aside className="report-actions panel"><span className="card-kicker">Ekspor A4</span><h2>Buat laporan lengkap</h2><p>Pilih bagian yang diperlukan. PDF disimpan pada storage workspace dan juga diunduh ke perangkatmu.</p><div className="report-section-picker">{reportSectionOptions.map((item) => <label key={item.key}><input type="checkbox" checked={sections.includes(item.key)} onChange={() => toggleSection(item.key)} /><span>{item.label}</span></label>)}</div><label className="report-privacy-option"><input type="checkbox" checked={maskPdf} onChange={(event) => setMaskPdf(event.target.checked)} /><span>Samarkan semua nominal pada PDF</span></label><button className="primary-button full" onClick={exportPdf} disabled={generating || !sections.length}><FileText size={17} /> {generating ? "Membuat PDF…" : "Buat, simpan & unduh PDF"}</button><button className="secondary-button full" onClick={exportCsv}><Download size={17} /> Unduh CSV transaksi</button>{error && <div className="portability-error" role="alert">{error}</div>}<div className="security-note"><ShieldCheck size={18} /><span><strong>Snapshot periode terkunci</strong><small>Riwayat laporan menyimpan file yang sama dengan versi unduhan.</small></span></div>{reports.length > 0 && <div className="export-history"><strong>Riwayat PDF</strong>{reports.slice(0, 5).map((report) => <a key={report.id} href={report.downloadUrl} target="_blank" rel="noreferrer"><span><FileText size={15} /><span><b>{report.period ? monthLabel(report.period) : "Laporan"}</b><small>{new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date(report.createdAt))}</small></span></span><small>{fileSizeLabel(report.sizeBytes)}</small></a>)}</div>}</aside>
  </div>;
}

function AssistantPage({ period, onOpenSettings }: { period: string; onOpenSettings: () => void }) {
  const [settings, setSettings] = useState<AiSettingsStatus | null>(null);
  const [messages, setMessages] = useState<AiChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    Promise.all([getFinanceAiSettings(), loadFinanceAiMessages()])
      .then(([nextSettings, history]) => {
        if (!active) return;
        setSettings(nextSettings);
        setMessages(history.messages);
        setError("");
      })
      .catch((reason) => active && setError(reason instanceof Error ? reason.message : "AI tidak dapat dimuat."))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  const ready = Boolean(settings?.configured && settings.enabled && settings.consentAccepted);
  const send = async (question?: string) => {
    const text = (question ?? input).trim();
    if (!text || sending || !ready) return;
    const userMessage: AiChatMessage = {
      id: `local-${crypto.randomUUID()}`,
      role: "user",
      content: text,
      period,
      contextUsed: [],
      createdAt: new Date().toISOString(),
    };
    setMessages((current) => [...current, userMessage]);
    setInput("");
    setError("");
    setSending(true);
    try {
      const result = await askFinanceAi(text, period);
      setMessages((current) => [...current, result.message]);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Pertanyaan tidak dapat diproses.");
    } finally {
      setSending(false);
    }
  };

  const clearHistory = async () => {
    if (!messages.length || !window.confirm("Hapus seluruh histori percakapan Financial Insight?")) return;
    try {
      await clearFinanceAiMessages();
      setMessages([]);
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Histori tidak dapat dihapus.");
    }
  };

  const latestContext = [...messages].reverse().find((message) => message.role === "assistant")?.contextUsed ?? [
    `Ringkasan ${period}`,
    "Agregat kategori",
  ];

  return <div className="assistant-layout">
    <section className="assistant-chat panel">
      <div className="assistant-banner"><span><Bot size={21} /></span><div><strong>Financial Insight</strong><small>{settings?.model || "AI universal"} · {monthLabel(period)} · Read-only</small></div><span className={`online ${ready ? "" : "offline"}`}><i /> {loading ? "Memeriksa" : ready ? "Siap" : "Perlu setup"}</span></div>
      {!loading && !ready && <div className="ai-setup-callout"><KeyRound size={18} /><div><strong>Aktifkan AI terlebih dahulu</strong><small>Tambahkan Base URL, model, API key, lalu setujui disclosure privasi di Pengaturan.</small></div><button className="secondary-button" onClick={onOpenSettings}>Buka Pengaturan</button></div>}
      <div className="chat-body" aria-live="polite">
        {!messages.length && <div className="chat-message assistant"><span><Sparkles size={16} /></span><p>Halo! Saya dapat menjelaskan arus kas, anggaran, target, tagihan, dan investasi dari data yang kamu izinkan. Saya tidak dapat mengubah transaksi atau melakukan investasi.</p></div>}
        {messages.map((message) => <div className={`chat-message ${message.role}`} key={message.id}>{message.role === "assistant" && <span><Sparkles size={16} /></span>}<p>{message.content}</p></div>)}
        {sending && <div className="chat-message assistant"><span><Sparkles size={16} /></span><p className="ai-thinking">Menganalisis konteks terpilih…</p></div>}
      </div>
      {error && <div className="ai-error" role="alert">{error}</div>}
      <div className="suggestion-chips"><button disabled={!ready || sending} onClick={() => send("Mengapa saldo saya berubah bulan ini?")}>Mengapa saldo berubah?</button><button disabled={!ready || sending} onClick={() => send("Apakah anggaran saya berisiko terlampaui?")}>Risiko anggaran</button><button disabled={!ready || sending} onClick={() => send("Berapa keuntungan investasi yang sudah direalisasikan?")}>Realized P/L</button></div>
      <form className="chat-input" onSubmit={(event) => { event.preventDefault(); send(); }}><input maxLength={600} disabled={!ready || sending} value={input} onChange={(event) => setInput(event.target.value)} placeholder={ready ? "Tanya tentang kondisi keuanganmu…" : "Aktifkan AI di Pengaturan"} aria-label="Pertanyaan untuk Financial Insight" /><button disabled={!ready || sending || !input.trim()} aria-label="Kirim pertanyaan"><Send size={18} /></button></form>
    </section>
    <aside className="assistant-context panel"><div className="assistant-context-head"><span><span className="card-kicker">Data yang dikirim</span><h2>Konteks minimal</h2></span><button className="icon-button small danger" onClick={clearHistory} disabled={!messages.length} aria-label="Hapus histori AI"><Trash2 size={14} /></button></div><p>Backend memilih ringkasan yang relevan dengan pertanyaan—bukan seluruh spreadsheet.</p>{latestContext.map((item) => <div key={item}><span><CircleDollarSign size={17} /> {item}</span><strong>Digunakan</strong></div>)}<div><span><CreditCard size={17} /> PIN, OTP, CVV, nomor kartu lengkap</span><strong className="disabled-text">Tidak pernah</strong></div><small className="ai-disclaimer">Jawaban AI dapat keliru dan bukan pengganti penasihat keuangan profesional. Kamu tetap bertanggung jawab atas keputusan finansial.</small></aside>
  </div>;
}

function AiSettingsPanel({ onToast }: { onToast: (message: string) => void }) {
  const [status, setStatus] = useState<AiSettingsStatus | null>(null);
  const [baseUrl, setBaseUrl] = useState("");
  const [model, setModel] = useState("default");
  const [apiKey, setApiKey] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    getFinanceAiSettings().then((next) => {
      setStatus(next);
      setBaseUrl(next.baseUrl);
      setModel(next.model);
      setEnabled(next.enabled);
      setConsentAccepted(next.consentAccepted);
    }).catch((reason) => setError(reason instanceof Error ? reason.message : "Status AI tidak dapat dimuat."));
  }, []);

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const next = await updateFinanceAiSettings({
        enabled,
        consentAccepted,
        baseUrl: baseUrl.trim(),
        model: model.trim() || "default",
        ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
      });
      setStatus(next);
      setApiKey("");
      onToast("Pengaturan AI berhasil disimpan.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Pengaturan AI tidak dapat disimpan.");
    } finally {
      setSaving(false);
    }
  };

  const removeKey = async () => {
    if (!window.confirm("Hapus API key dan nonaktifkan AI?")) return;
    setSaving(true);
    try {
      const next = await updateFinanceAiSettings({ enabled: false, consentAccepted, removeApiKey: true });
      setStatus(next);
      setEnabled(false);
      setApiKey("");
      onToast("API key AI berhasil dihapus.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "API key tidak dapat dihapus.");
    } finally {
      setSaving(false);
    }
  };

  return <section className="panel settings-section settings-wide ai-settings-panel">
    <div className="settings-title"><span><Bot size={20} /></span><div><h2>AI & OCR Universal</h2><p>Hubungkan penyedia API berformat OpenAI-compatible melalui Base URL dan API key.</p></div><span className={`ai-config-badge ${status?.configured ? "ready" : ""}`}>{status?.configured ? "API terhubung" : "Belum dikonfigurasi"}</span></div>
    <div className="ai-settings-grid">
      <div className="ai-key-box"><label><span>Base URL API</span><input type="url" autoComplete="url" value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} placeholder="https://provider.example/v1" /></label><label><span>Model</span><input type="text" autoComplete="off" value={model} maxLength={120} onChange={(event) => setModel(event.target.value)} placeholder="default atau nama model dari penyedia" /></label><label><span>API key</span><input type="password" autoComplete="new-password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder={status?.configured ? "••••••••••••••••••••" : "Masukkan API key penyedia"} /></label><small>Masukkan Base URL API, bukan URL halaman kuota. Endpoint <b>/chat/completions</b> ditambahkan otomatis. Key disimpan di sisi server dan tidak pernah ditampilkan kembali.</small><div className="settings-actions"><button className="primary-button" onClick={save} disabled={saving || (enabled && (!consentAccepted || !baseUrl.trim() || !model.trim() || (!status?.configured && !apiKey.trim())))}><ShieldCheck size={16} /> {saving ? "Menyimpan…" : "Simpan pengaturan"}</button>{status?.configured && <button className="secondary-button danger-text" onClick={removeKey} disabled={saving}><Trash2 size={15} /> Hapus key</button>}</div>{error && <div className="ai-error" role="alert">{error}</div>}</div>
      <div className="ai-consent-box"><div className="settings-row"><div><strong>Aktifkan AI & OCR</strong><small>AI hanya membaca konteks yang relevan dan tidak dapat menulis transaksi.</small></div><button className={`switch ${enabled ? "on" : ""}`} onClick={() => setEnabled(!enabled)} aria-pressed={enabled}><span /></button></div><label className="ai-consent-check"><input type="checkbox" checked={consentAccepted} onChange={(event) => setConsentAccepted(event.target.checked)} /><span>Saya memahami data terpilih dan foto struk akan dikirim ke penyedia AI yang saya masukkan; hasil dapat keliru; AI bukan penasihat keuangan; dan transaksi OCR baru tersimpan setelah saya konfirmasi.</span></label><div className="ai-privacy-facts"><span><ShieldCheck size={15} /> Foto struk tidak disimpan setelah ekstraksi.</span><span><KeyRound size={15} /> API key tidak masuk ke histori atau audit log.</span><span><Bot size={15} /> Model: {model || "default"}</span></div></div>
    </div>
  </section>;
}

function NotificationSettingsPanel({ settings, onSave, onToast }: {
  settings: NotificationSettings;
  onSave: (settings: NotificationSettings) => Promise<NotificationSettings>;
  onToast: (message: string) => void;
}) {
  const [draft, setDraft] = useState(settings);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const toggleReminderDay = (day: number) => setDraft((current) => {
    const exists = current.billReminderDays.includes(day);
    const billReminderDays = exists ? current.billReminderDays.filter((item) => item !== day) : [...current.billReminderDays, day].sort((a, b) => b - a);
    return { ...current, billReminderDays };
  });

  const save = async () => {
    if (!draft.billReminderDays.length) return setError("Pilih minimal satu jadwal reminder tagihan.");
    setSaving(true);
    setError("");
    try {
      const result = await onSave(draft);
      setDraft(result);
      onToast("Pengaturan reminder berhasil disimpan.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Pengaturan reminder tidak dapat disimpan.");
    } finally { setSaving(false); }
  };

  return <section className="panel settings-section settings-wide notification-settings-panel">
    <div className="settings-title"><span><Bell size={20} /></span><div><h2>Notification center & reminder</h2><p>Peringatan dibuat dari data nyata untuk tagihan, anggaran, target, backup, dan harga investasi.</p></div><button className={`switch ${draft.enabled ? "on" : ""}`} onClick={() => setDraft((current) => ({ ...current, enabled: !current.enabled }))} aria-pressed={draft.enabled}><span /></button></div>
    <div className="notification-settings-grid">
      <div><strong>Pengingat tagihan</strong><small>Reminder tetap terlihat setelah ambang terlewati sampai tagihan dibayar atau diarsipkan.</small><div className="reminder-day-options">{[7, 3, 1, 0].map((day) => <label key={day}><input type="checkbox" checked={draft.billReminderDays.includes(day)} onChange={() => toggleReminderDay(day)} /><span>{day === 0 ? "Hari H" : `H-${day}`}</span></label>)}</div></div>
      <label><span>Peringatan anggaran</span><select value={draft.budgetWarningPercent} onChange={(event) => setDraft((current) => ({ ...current, budgetWarningPercent: Number(event.target.value) }))}><option value="75">Mulai 75%</option><option value="90">Mulai 90%</option></select><ChevronDown size={15} /></label>
      <label><span>Backup dianggap lama</span><select value={draft.backupWarningDays} onChange={(event) => setDraft((current) => ({ ...current, backupWarningDays: Number(event.target.value) }))}><option value="7">7 hari</option><option value="14">14 hari</option><option value="30">30 hari</option></select><ChevronDown size={15} /></label>
      <label><span>Deadline target</span><select value={draft.goalWarningDays} onChange={(event) => setDraft((current) => ({ ...current, goalWarningDays: Number(event.target.value) }))}><option value="7">7 hari sebelumnya</option><option value="30">30 hari sebelumnya</option><option value="60">60 hari sebelumnya</option></select><ChevronDown size={15} /></label>
      <label><span>Email tujuan</span><input type="email" value={draft.emailAddress} onChange={(event) => setDraft((current) => ({ ...current, emailAddress: event.target.value }))} placeholder="nama@email.com" disabled={!draft.emailEnabled}/><small>Dikirim otomatis pukul 07.00 dari Google Apps Script.</small></label>
      <div className="notification-delivery-options"><div className="settings-row"><div><strong>Kirim email penting</strong><small>Jatuh tempo dan peringatan kritis.</small></div><button className={`switch ${draft.emailEnabled ? "on" : ""}`} onClick={() => setDraft((current) => ({ ...current, emailEnabled: !current.emailEnabled }))} aria-pressed={draft.emailEnabled}><span /></button></div><div className="settings-row"><div><strong>Ringkasan mingguan</strong><small>Rangkuman tambahan setiap Senin.</small></div><button className={`switch ${draft.weeklyDigest ? "on" : ""}`} onClick={() => setDraft((current) => ({ ...current, weeklyDigest: !current.weeklyDigest }))} aria-pressed={draft.weeklyDigest}><span /></button></div></div>
    </div>
    <div className="settings-actions"><button className="primary-button" onClick={save} disabled={saving || !draft.billReminderDays.length || (draft.emailEnabled && !/^\S+@\S+\.\S+$/.test(draft.emailAddress))}><Bell size={15} /> {saving ? "Menyimpan…" : "Simpan reminder"}</button><small>Notifikasi hanya informatif dan tidak melakukan pembayaran atau perubahan data otomatis.</small></div>
    {error && <div className="portability-error" role="alert">{error}</div>}
  </section>;
}

function DataPortabilityPanel({ backendLabel, onToast, onRefresh }: { backendLabel: string; onToast: (message: string) => void; onRefresh: () => Promise<void> }) {
  const [overview, setOverview] = useState<BackupOverview | null>(null);
  const [migrations, setMigrations] = useState<MigrationPreview[]>([]);
  const [preview, setPreview] = useState<MigrationPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState<"backup" | "schedule" | "preview" | "apply" | "cancel" | "">("");
  const [error, setError] = useState("");

  const load = async () => {
    const [backupResult, migrationResult] = await Promise.all([loadFinanceBackups(), loadFinanceMigrations()]);
    setOverview(backupResult);
    setMigrations(migrationResult.migrations);
    const activePreview = migrationResult.migrations.find((item) => item.status === "preview");
    if (activePreview) setPreview(activePreview);
  };

  useEffect(() => {
    let active = true;
    Promise.all([loadFinanceBackups(), loadFinanceMigrations()])
      .then(([backupResult, migrationResult]) => {
        if (!active) return;
        setOverview(backupResult);
        setMigrations(migrationResult.migrations);
        setPreview(migrationResult.migrations.find((item) => item.status === "preview") ?? null);
        setError("");
      })
      .catch((reason) => active && setError(reason instanceof Error ? reason.message : "Status backup dan migrasi tidak dapat dimuat."))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  const createBackup = async () => {
    setWorking("backup");
    setError("");
    try {
      await createFinanceBackup();
      await load();
      onToast("Backup lengkap berhasil dibuat dan disimpan.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Backup tidak dapat dibuat.");
    } finally { setWorking(""); }
  };

  const changeSchedule = async (enabled: boolean, frequency = overview?.schedule.frequency ?? "weekly") => {
    setWorking("schedule");
    setError("");
    try {
      setOverview(await updateFinanceBackupSchedule(enabled, frequency));
      onToast(enabled ? "Backup otomatis berhasil diaktifkan." : "Backup otomatis dinonaktifkan.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Jadwal backup tidak dapat disimpan.");
    } finally { setWorking(""); }
  };

  const chooseMigrationFile = async (file?: File) => {
    if (!file) return;
    if (file.size > 12 * 1024 * 1024) return setError("File migrasi maksimal 12 MB.");
    if (!file.name.toLowerCase().endsWith(".json")) return setError("Gunakan file backup JSON Financial Planner.");
    setWorking("preview");
    setError("");
    try {
      const raw = JSON.parse(await file.text()) as unknown;
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("Isi file harus berupa object JSON.");
      const result = await previewFinanceMigration(file.name, raw as Record<string, unknown>);
      setPreview(result);
      setMigrations((current) => [result, ...current.filter((item) => item.id !== result.id)]);
      onToast(result.canApply ? "Preview migrasi lolos dan siap dikonfirmasi." : "Preview selesai; periksa catatan validasi.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "File migrasi tidak dapat diproses.");
    } finally { setWorking(""); }
  };

  const applyMigration = async () => {
    if (!preview?.canApply || !window.confirm(`Terapkan ${preview.totalRecords} baris dari ${preview.sourceName}? Backup pra-migrasi akan dibuat otomatis.`)) return;
    setWorking("apply");
    setError("");
    try {
      const result = await applyFinanceMigration(preview.id);
      setPreview(result);
      await Promise.all([load(), onRefresh()]);
      onToast("Migrasi berhasil diterapkan dan laporan validasi dibuat.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Migrasi tidak dapat diterapkan.");
    } finally { setWorking(""); }
  };

  const cancelMigration = async () => {
    if (!preview || preview.status !== "preview") return;
    setWorking("cancel");
    setError("");
    try {
      const result = await cancelFinanceMigration(preview.id);
      setPreview(result);
      await load();
      onToast("Preview dibatalkan; tidak ada data yang dimasukkan.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Preview tidak dapat dibatalkan.");
    } finally { setWorking(""); }
  };

  const schedule = overview?.schedule;
  return <section className="panel settings-section settings-wide portability-panel">
    <div className="settings-title"><span><HardDrive size={20} /></span><div><h2>Laporan data, backup & migrasi</h2><p>File tersimpan permanen di {backendLabel === "Google Sheets" ? "Google Drive" : "storage workspace"}; migrasi selalu melewati preview dan rekonsiliasi.</p></div>{loading && <span className="portability-loading">Memuat…</span>}</div>
    <div className="portability-grid">
      <div className="portability-column">
        <div className="portability-heading"><span><Database size={18} /></span><div><strong>Backup lengkap</strong><small>Akun, transaksi, planning, investasi, dan pengaturan aman. API key tidak pernah ikut.</small></div></div>
        <button className="primary-button full" onClick={createBackup} disabled={Boolean(working)}><Download size={16} /> {working === "backup" ? "Membuat backup…" : "Buat backup sekarang"}</button>
        <div className="backup-schedule-row"><div><strong>Backup otomatis</strong><small>{schedule?.mode === "scheduled" ? "Dijalankan oleh penjadwal Google." : "Dijalankan saat aplikasi dibuka setelah jadwal jatuh tempo."}</small></div><button className={`switch ${schedule?.enabled ? "on" : ""}`} onClick={() => changeSchedule(!schedule?.enabled)} disabled={working === "schedule"} aria-pressed={Boolean(schedule?.enabled)}><span /></button></div>
        <label className="schedule-select"><span>Frekuensi</span><select value={schedule?.frequency ?? "weekly"} onChange={(event) => changeSchedule(Boolean(schedule?.enabled), event.target.value as BackupOverview["schedule"]["frequency"])} disabled={working === "schedule"}><option value="daily">Harian</option><option value="weekly">Mingguan</option><option value="monthly">Bulanan</option></select><ChevronDown size={15} /></label>
        {schedule?.nextBackupAt && <div className="next-backup"><Clock3 size={15} /><span>Backup berikutnya <strong>{new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date(schedule.nextBackupAt))}</strong></span></div>}
        <div className="export-history compact"><strong>Backup terbaru</strong>{overview?.backups.slice(0, 5).map((backup) => <a key={backup.id} href={backup.downloadUrl} target="_blank" rel="noreferrer"><span><Database size={15} /><span><b>{new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date(backup.createdAt))}</b><small>{String(backup.metadata?.reason ?? "manual").replaceAll("_", " ")}</small></span></span><small>{fileSizeLabel(backup.sizeBytes)}</small></a>)}{!loading && !overview?.backups.length && <small className="empty-portability">Belum ada backup tersimpan.</small>}</div>
      </div>
      <div className="portability-column">
        <div className="portability-heading"><span><Upload size={18} /></span><div><strong>Migrasi backup lama</strong><small>Unggah JSON, periksa jumlah baris dan selisih saldo, lalu konfirmasi secara eksplisit.</small></div></div>
        <label className={`migration-drop ${working === "preview" ? "busy" : ""}`}><Upload size={21} /><span><strong>{working === "preview" ? "Memvalidasi file…" : "Pilih file backup JSON"}</strong><small>Maks. 12 MB · sumber tidak pernah dihapus</small></span><input type="file" accept="application/json,.json" disabled={Boolean(working)} onChange={(event) => { chooseMigrationFile(event.target.files?.[0]); event.currentTarget.value = ""; }} /></label>
        {preview && <div className={`migration-preview ${preview.canApply ? "valid" : preview.status === "applied" ? "applied" : "invalid"}`}><div className="migration-preview-head"><span>{preview.canApply || preview.status === "applied" ? <CheckCircle2 size={18} /> : <ShieldCheck size={18} />}</span><div><strong>{preview.status === "applied" ? "Migrasi sudah diterapkan" : preview.canApply ? "Preview siap diterapkan" : "Preview perlu diperbaiki"}</strong><small>{preview.sourceName} · skema {preview.sourceSchemaVersion}</small></div></div><div className="migration-counts">{Object.entries(preview.counts).filter(([, count]) => count > 0).map(([key, count]) => <span key={key}><small>{key.replace(/([A-Z])/g, " $1")}</small><strong>{count}</strong></span>)}</div><div className="balance-check"><Scale size={15} /><span>Selisih rekonsiliasi <strong>{formatIDR(preview.balanceDifference)}</strong></span></div>{preview.warnings.map((warning) => <small className="migration-warning" key={warning}>{warning}</small>)}{preview.errors.map((item) => <small className="migration-error" key={item}>{item}</small>)}{preview.status === "preview" && <div className="migration-actions"><button className="primary-button" onClick={applyMigration} disabled={!preview.canApply || Boolean(working)}>{working === "apply" ? "Menerapkan…" : "Konfirmasi & terapkan"}</button><button className="secondary-button" onClick={cancelMigration} disabled={Boolean(working)}>{working === "cancel" ? "Membatalkan…" : "Batalkan preview"}</button></div>}{preview.reportDownloadUrl && <a className="secondary-button report-download-link" href={preview.reportDownloadUrl} target="_blank" rel="noreferrer"><Download size={15} /> Unduh laporan migrasi</a>}</div>}
        {!preview && migrations.length > 0 && <div className="migration-history"><strong>Riwayat migrasi</strong>{migrations.slice(0, 4).map((item) => <div key={item.id}><span className={item.status}><i />{item.sourceName}</span><small>{item.status} · {item.totalRecords} baris</small></div>)}</div>}
      </div>
    </div>
    {error && <div className="portability-error" role="alert">{error}</div>}
  </section>;
}

function UpdateCenterPanel({ schemaVersion, backendLabel, onRefresh, onToast }: { schemaVersion: string; backendLabel: string; onRefresh: () => Promise<void>; onToast: (message: string) => void }) {
  const [working, setWorking] = useState(false);
  const current = schemaVersion === FINANCE_SCHEMA_VERSION;
  const update = async () => {
    setWorking(true);
    try {
      await upgradeFinanceWorkspace();
      await onRefresh();
      onToast("Pemeriksaan instalasi selesai; struktur data sudah diperbarui.");
    } catch (reason) { onToast(reason instanceof Error ? reason.message : "Pembaruan tidak dapat dijalankan."); }
    finally { setWorking(false); }
  };
  return <section className="panel settings-section settings-wide update-center-panel"><div className="settings-title"><span><Download size={20}/></span><div><h2>Pusat instalasi & pembaruan</h2><p>Memeriksa kelengkapan struktur data tanpa menghapus saldo atau riwayat.</p></div><span className={`connection-status ${current ? "" : "warning"}`}><i/>{current ? "Versi terbaru" : "Perlu diperiksa"}</span></div><div className="update-version-grid"><span><small>Versi aplikasi</small><strong>{FINANCE_SCHEMA_VERSION}</strong></span><span><small>Versi penyimpanan</small><strong>{schemaVersion}</strong></span><span><small>Backend</small><strong>{backendLabel}</strong></span><button className="primary-button" onClick={update} disabled={working}><ShieldCheck size={15}/>{working ? "Memeriksa…" : "Periksa & perbarui"}</button></div><small>Pembaruan aman dijalankan ulang. Pada Google Sheets, kolom atau sheet yang belum ada akan ditambahkan otomatis.</small></section>;
}

function SettingsPage({ profile, entitlement, onOpenLicense, saving, darkMode, setDarkMode, privacy, setPrivacy, featurePreferences, categories, categoryRules, auditLogs, backendLabel, schemaVersion, notificationSettings, onSaveProfile, onSaveFeaturePreferences, onSaveNotificationSettings, onAddCategory, onEditCategory, onArchiveCategory, onAddCategoryRule, onEditCategoryRule, onDeleteCategoryRule, onToast, onRefresh }: {
  profile: FinanceProfile;
  entitlement: PlanEntitlement;
  onOpenLicense: () => void;
  saving: boolean;
  darkMode: boolean;
  setDarkMode: (value: boolean) => void;
  privacy: boolean;
  setPrivacy: (value: boolean) => void;
  featurePreferences: FeaturePreferences;
  categories: FinanceCategory[];
  categoryRules: CategoryRule[];
  auditLogs: AuditLog[];
  backendLabel: string;
  schemaVersion: string;
  notificationSettings: NotificationSettings;
  onSaveProfile: (name: string) => Promise<boolean>;
  onSaveFeaturePreferences: (preferences: FeaturePreferences) => Promise<boolean>;
  onSaveNotificationSettings: (settings: NotificationSettings) => Promise<NotificationSettings>;
  onAddCategory: () => void;
  onEditCategory: (category: FinanceCategory) => void;
  onArchiveCategory: (categoryId: string) => void;
  onAddCategoryRule: () => void;
  onEditCategoryRule: (rule: CategoryRule) => void;
  onDeleteCategoryRule: (ruleId: string) => void;
  onToast: (message: string) => void;
  onRefresh: () => Promise<void>;
}) {
  const editableCategories = categories.filter((category) => category.active && (category.type === "income" || category.type === "expense"));
  return <div className="settings-layout">
    <OwnerProfilePanel key={profile.name} profile={profile} saving={saving} onSave={onSaveProfile} />
    <section className="panel settings-section settings-wide license-summary-panel"><div className="settings-title"><span><KeyRound size={20} /></span><div><h2>Paket & lisensi</h2><p>Aktivasi offline terikat ke satu instalasi.</p></div><b className={`plan-badge ${entitlement.tier}`}>{entitlement.label}</b></div><div className="connection-card"><span className="google-mark"><ShieldCheck size={18} /></span><div><strong>{entitlement.status === "active" ? `Paket ${entitlement.label} aktif` : entitlement.status === "expired" ? "Lisensi kedaluwarsa" : entitlement.status === "invalid" ? "Lisensi tidak valid" : "Paket Free aktif"}</strong><small>ID instalasi {entitlement.installationId}</small></div><button className="secondary-button" onClick={onOpenLicense}>Kelola</button></div></section>
    <FeaturePreferencesPanel key={JSON.stringify(featurePreferences)} preferences={featurePreferences} saving={saving} onSave={onSaveFeaturePreferences} />
    <SecurityAccessPanel privacy={privacy} />
    <section className="panel settings-section"><div className="settings-title"><span><Settings size={20} /></span><div><h2>Preferensi tampilan</h2><p>Atur pengalaman dashboard di perangkat ini.</p></div></div><div className="settings-row"><div><strong>Tema gelap</strong><small>Kurangi cahaya pada malam hari.</small></div><button className={`switch ${darkMode ? "on" : ""}`} onClick={() => setDarkMode(!darkMode)} aria-pressed={darkMode}><span /></button></div><div className="settings-row"><div><strong>Privacy mode</strong><small>Sembunyikan semua nominal sensitif.</small></div><button className={`switch ${privacy ? "on" : ""}`} onClick={() => setPrivacy(!privacy)} aria-pressed={privacy}><span /></button></div></section>
    <section className="panel settings-section"><div className="settings-title"><span><Building2 size={20} /></span><div><h2>Penyimpanan utama</h2><p>Status backend finansial aktif.</p></div></div><div className="connection-card"><span className="google-mark"><Database size={18} /></span><div><strong>{backendLabel}</strong><small>{backendLabel === "Google Sheets" ? "Terhubung melalui Google Apps Script." : "Terhubung ke database situs."}</small></div><span className="connection-status"><i /> Terhubung</span></div></section>
    <UpdateCenterPanel schemaVersion={schemaVersion} backendLabel={backendLabel} onRefresh={onRefresh} onToast={onToast}/>
    <NotificationSettingsPanel key={`${notificationSettings.enabled}-${notificationSettings.billReminderDays.join(",")}-${notificationSettings.budgetWarningPercent}-${notificationSettings.backupWarningDays}-${notificationSettings.goalWarningDays}-${notificationSettings.emailEnabled}-${notificationSettings.emailAddress}-${notificationSettings.weeklyDigest}`} settings={notificationSettings} onSave={onSaveNotificationSettings} onToast={onToast} />
    <AiSettingsPanel onToast={onToast} />
    <LedgerHealthPanel privacy={privacy} onToast={onToast} onRefresh={onRefresh} />
    <DataPortabilityPanel backendLabel={backendLabel} onToast={onToast} onRefresh={onRefresh} />
    <section className="panel settings-section settings-wide"><div className="settings-title"><span><Tags size={20} /></span><div><h2>Kategori transaksi</h2><p>Kategori aktif dipakai langsung pada transaksi, anggaran, dan tagihan.</p></div><button className="secondary-button settings-title-action" onClick={onAddCategory}><Plus size={15} /> Tambah kategori</button></div><div className="category-manager">{editableCategories.map((category) => <div className="category-manager-row" key={category.id}><i style={{ background: category.color }} /><div><strong>{category.name}</strong><small>{category.type === "income" ? "Pemasukan" : "Pengeluaran"}{category.isDefault ? " · bawaan" : ""}</small></div><span><button className="icon-button small" onClick={() => onEditCategory(category)} aria-label={`Edit kategori ${category.name}`}><Pencil size={14} /></button>{!category.isDefault && <button className="icon-button small danger" onClick={() => window.confirm(`Arsipkan kategori ${category.name}? Transaksi lama tetap aman.`) && onArchiveCategory(category.id)} aria-label={`Arsipkan kategori ${category.name}`}><Trash2 size={14} /></button>}</span></div>)}{!editableCategories.length && <div className="settings-empty">Belum ada kategori aktif.</div>}</div></section>
    <section className="panel settings-section settings-wide category-rules-panel">
      <div className="settings-title"><span><Sparkles size={20} /></span><div><h2>Aturan kategori otomatis</h2><p>Cocokkan merchant atau keterangan CSV dengan kategori yang tepat saat preview impor.</p></div><button className="secondary-button settings-title-action" onClick={onAddCategoryRule}><Plus size={15} /> Tambah aturan</button></div>
      <div className="category-rule-manager">
        {categoryRules.map((rule) => <div className={`category-rule-row ${rule.active ? "" : "inactive"}`} key={rule.id}>
          <span className="category-rule-keyword">{rule.matchType === "exact" ? "=" : rule.matchType === "starts_with" ? "Awal" : "Berisi"} <strong>{rule.keyword}</strong></span>
          <ArrowRight size={16} />
          <span className="category-rule-target"><strong>{rule.category}</strong><small>{rule.transactionType === "income" ? "Pemasukan" : "Pengeluaran"} · prioritas {rule.priority}{rule.active ? "" : " · nonaktif"}</small></span>
          <span className="category-rule-actions"><button className="icon-button small" onClick={() => onEditCategoryRule(rule)} aria-label={`Edit aturan ${rule.keyword}`}><Pencil size={14} /></button><button className="icon-button small danger" onClick={() => window.confirm(`Hapus aturan “${rule.keyword}”?`) && onDeleteCategoryRule(rule.id)} aria-label={`Hapus aturan ${rule.keyword}`}><Trash2 size={14} /></button></span>
        </div>)}
        {!categoryRules.length && <div className="settings-empty">Belum ada aturan. Contoh: “Indomaret” → Makanan atau “PLN” → Tagihan.</div>}
      </div>
    </section>
    <section className="panel settings-section"><div className="settings-title"><span><History size={20} /></span><div><h2>Audit trail</h2><p>20 aktivitas terbaru yang tercatat di workspace.</p></div></div><div className="audit-list">{auditLogs.slice(0, 20).map((log) => <div key={log.id}><span><strong>{log.action.replaceAll("_", " ")}</strong><small>{log.module}{log.entityId ? ` · ${log.entityId.slice(0, 18)}` : ""}</small></span><time>{log.createdAt ? new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date(log.createdAt)) : "—"}</time></div>)}{!auditLogs.length && <div className="settings-empty">Belum ada aktivitas yang tercatat.</div>}</div></section>
  </div>;
}

function FeaturePreferencesPanel({ preferences, saving, onSave }: {
  preferences: FeaturePreferences;
  saving: boolean;
  onSave: (preferences: FeaturePreferences) => Promise<boolean>;
}) {
  const [draft, setDraft] = useState<FeaturePreferences>({ ...preferences });
  const changed = JSON.stringify(draft) !== JSON.stringify(preferences);
  const enabledCount = Object.values(draft).filter(Boolean).length;

  return <section className="panel settings-section settings-wide feature-preferences-panel">
    <div className="settings-title">
      <span><SlidersHorizontal size={20} /></span>
      <div><h2>Fitur aktif</h2><p>Sembunyikan menu yang tidak digunakan tanpa menghapus data atau mengubah perhitungan.</p></div>
      <span className="feature-count">{enabledCount}/{Object.keys(draft).length} aktif</span>
    </div>
    <div className="feature-core-note"><ShieldCheck size={17} /><span><strong>Fitur inti selalu aktif</strong><small>Ringkasan, Transaksi, Akun, dan Pengaturan menjaga ledger tetap dapat dikelola.</small></span></div>
    <div className="feature-preference-groups">
      {featurePreferenceGroups.map((group) => <fieldset key={group.label}>
        <legend>{group.label}</legend>
        {group.items.map((item) => <div className="feature-preference-row" key={item.key}>
          <span><strong>{item.label}</strong><small>{item.description}</small></span>
          <button type="button" className={`switch ${draft[item.key] ? "on" : ""}`} onClick={() => setDraft((current) => ({ ...current, [item.key]: !current[item.key] }))} aria-pressed={draft[item.key]} aria-label={`${draft[item.key] ? "Nonaktifkan" : "Aktifkan"} fitur ${item.label}`} disabled={saving}><span /></button>
        </div>)}
      </fieldset>)}
    </div>
    <div className="feature-preference-actions">
      <small>Fitur yang dimatikan hanya disembunyikan. Data lama tetap masuk ke saldo, forecast, backup, dan laporan terkait.</small>
      <button className="primary-button" type="button" disabled={!changed || saving} onClick={() => void onSave(draft)}><Check size={16} /> {saving ? "Menyimpan…" : "Simpan pilihan fitur"}</button>
    </div>
  </section>;
}

function LicenseModal({ entitlement, onClose, onChanged }: { entitlement: PlanEntitlement; onClose: () => void; onChanged: (value: PlanEntitlement) => Promise<void> }) {
  const [token, setToken] = useState("");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const copyInstallation = async () => {
    try { await navigator.clipboard.writeText(entitlement.installationId); }
    catch { setError("ID instalasi tidak dapat disalin otomatis."); }
  };
  const activate = async () => {
    if (!token.trim() || working) return;
    setWorking(true); setError("");
    try { await onChanged(await activateFinanceLicense(token.trim())); setToken(""); onClose(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Kode lisensi tidak dapat diaktifkan."); }
    finally { setWorking(false); }
  };
  const deactivate = async () => {
    if (working || !window.confirm("Nonaktifkan lisensi pada instalasi ini? Data tetap aman; fitur berbayar kembali terkunci.")) return;
    setWorking(true); setError("");
    try { await onChanged(await deactivateFinanceLicense()); onClose(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Lisensi tidak dapat dinonaktifkan."); }
    finally { setWorking(false); }
  };
  return <div className="modal-backdrop" role="presentation"><section className="modal license-modal" role="dialog" aria-modal="true" aria-labelledby="license-title"><div className="modal-head"><div><span className="eyebrow">Paket produk</span><h2 id="license-title">Aktivasi lisensi</h2><p>Lisensi offline terikat ke satu instalasi. Kirim ID instalasi ke penjual untuk memperoleh kode Pro atau Premium.</p></div><button className="icon-button" onClick={onClose} aria-label="Tutup aktivasi lisensi"><X size={20}/></button></div><div className="license-current"><span><ShieldCheck size={20}/></span><div><small>Paket aktif</small><strong>{entitlement.label}</strong><p>{entitlement.expiresAt ? `Berlaku hingga ${new Intl.DateTimeFormat("id-ID", { dateStyle: "long" }).format(new Date(entitlement.expiresAt))}` : entitlement.status === "active" ? "Lisensi jual-putus tanpa tanggal berakhir." : "Fitur inti tersedia tanpa kode lisensi."}</p></div><b className={`plan-badge ${entitlement.tier}`}>{entitlement.label}</b></div><label className="license-installation"><span>ID instalasi</span><div><input value={entitlement.installationId} readOnly/><button className="secondary-button" type="button" onClick={() => void copyInstallation()}><Copy size={15}/> Salin</button></div><small>Token untuk instalasi lain akan ditolak.</small></label><label><span>Kode lisensi</span><textarea rows={4} value={token} onChange={(event) => setToken(event.target.value)} placeholder="FP1..." autoComplete="off" spellCheck={false}/></label>{error && <div className="portability-error" role="alert">{error}</div>}<div className="modal-actions"><button className="primary-button" onClick={() => void activate()} disabled={working || !token.trim()}>{working ? "Memproses…" : "Aktifkan lisensi"}</button>{entitlement.tier !== "free" && <button className="secondary-button danger" onClick={() => void deactivate()} disabled={working}>Nonaktifkan</button>}<button className="secondary-button" onClick={onClose} disabled={working}>Tutup</button></div><small className="license-limit-note">Lisensi lokal mengatur akses produk, bukan proteksi anti-tamper. Transfer instalasi memerlukan kode baru.</small></section></div>;
}

function SecurityAccessPanel({ privacy }: { privacy: boolean }) {
  const [status, setStatus] = useState<FinanceSecurityStatus | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    loadFinanceSecurity()
      .then((value) => active && setStatus(value))
      .catch((reason) => active && setError(reason instanceof Error ? reason.message : "Status keamanan tidak dapat dimuat."));
    return () => { active = false; };
  }, []);

  const accountLabel = status?.email
    ? privacy
      ? status.email.replace(/^(.{1,2}).*(@.*)$/, "$1••••$2")
      : status.email
    : status?.displayName ?? "Sesi pemilik";

  return <section className="panel settings-section settings-wide security-access-panel">
    <div className="settings-title"><span><ShieldCheck size={20} /></span><div><h2>Keamanan & akses</h2><p>Identitas, isolasi workspace, dan perlindungan respons aplikasi.</p></div><span className="security-badge"><CheckCircle2 size={13} /> Terlindungi</span></div>
    {error && <div className="portability-error" role="alert">{error}</div>}
    {!status && !error && <div className="settings-empty">Memeriksa keamanan sesi…</div>}
    {status && <>
      <div className="security-status-grid">
        <article><span><KeyRound size={18} /></span><div><small>Identitas aktif</small><strong>{accountLabel}</strong><p>{status.provider} · {status.sessionState === "local_preview" ? "mode pengembangan" : "sesi terverifikasi"}</p></div></article>
        <article><span><UserRound size={18} /></span><div><small>Kontrol akses</small><strong>{status.accessMode === "owner_only" ? "Hanya pemilik" : "Dikelola deployment"}</strong><p>{status.accessMode === "owner_only" ? "Pengunjung lain tidak dapat membuka workspace privat ini." : "Akses mengikuti pengguna yang diizinkan pada deployment Google Apps Script."}</p></div></article>
        <article><span><Database size={18} /></span><div><small>Isolasi data</small><strong>Dikunci di server</strong><p>ID workspace dari browser tidak dapat mengalihkan akses data.</p></div></article>
      </div>
      <div className="security-account-row"><span><ShieldCheck size={17} /><span><strong>Proteksi respons aktif</strong><small>API tidak disimpan di cache dan halaman dibatasi dari embedding pihak lain.</small></span></span>{status.signOutUrl && <a className="secondary-button" href={status.signOutUrl}><LogOut size={15} /> Keluar dari sesi</a>}</div>
    </>}
  </section>;
}

function OwnerProfilePanel({ profile, saving, onSave }: {
  profile: FinanceProfile;
  saving: boolean;
  onSave: (name: string) => Promise<boolean>;
}) {
  const [name, setName] = useState(profile.name);

  const normalizedName = name.trim();
  const hasChanged = normalizedName !== profile.name;
  const initials = normalizedName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "FP";

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!normalizedName || !hasChanged || saving) return;
    await onSave(normalizedName);
  };

  return <section className="panel settings-section settings-wide owner-profile-panel">
    <div className="settings-title"><span><UserRound size={20} /></span><div><h2>Profil pemilik</h2><p>Nama pemilik digunakan pada sapaan, laporan, backup, dan ekspor.</p></div></div>
    <form className="owner-profile-form" onSubmit={submit}>
      <span className="owner-avatar" aria-hidden="true">{initials}</span>
      <label>
        <span>Nama pemilik</span>
        <input value={name} onChange={(event) => setName(event.target.value)} maxLength={80} autoComplete="name" required aria-describedby="owner-name-help" />
        <small id="owner-name-help">Perubahan nama tidak mengubah akun, saldo, maupun riwayat transaksi.</small>
      </label>
      <button className="primary-button" type="submit" disabled={saving || !normalizedName || !hasChanged}><Check size={16} /> {saving ? "Menyimpan…" : "Simpan nama"}</button>
    </form>
  </section>;
}

function LedgerHealthPanel({ privacy, onToast, onRefresh }: { privacy: boolean; onToast: (message: string) => void; onRefresh: () => Promise<void> }) {
  const [report, setReport] = useState<LedgerHealthReport | null>(null);
  const [working, setWorking] = useState<"check" | "repair" | "">("check");
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");

  const inspect = async () => {
    setWorking("check"); setError(""); setConfirming(false);
    try { setReport(await loadFinanceLedgerHealth()); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Ledger tidak dapat diperiksa."); }
    finally { setWorking(""); }
  };

  useEffect(() => {
    let active = true;
    loadFinanceLedgerHealth()
      .then((next) => { if (active) setReport(next); })
      .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : "Ledger tidak dapat diperiksa."); })
      .finally(() => { if (active) setWorking(""); });
    return () => { active = false; };
  }, []);

  const repair = async () => {
    if (!report) return;
    setWorking("repair"); setError("");
    try {
      const next = await repairFinanceLedger(report.revision);
      setReport(next); setConfirming(false);
      await onRefresh();
      onToast(report.storageMode === "calculated" ? "Ledger dihitung ulang dan cache dashboard diperbarui." : `${next.repairedAccounts ?? report.summary.driftCount} saldo akun berhasil diperbaiki.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Ledger tidak dapat diperbaiki.");
    } finally { setWorking(""); }
  };

  const differences = report?.accounts.filter((account) => account.difference !== 0) ?? [];
  const statusTitle = report?.status === "healthy" ? "Ledger konsisten" : report?.status === "needs_repair" ? "Selisih saldo ditemukan" : report?.status === "blocked" ? "Perlu pemeriksaan manual" : "Memeriksa integritas ledger";
  const statusDescription = report?.storageMode === "calculated"
    ? "Saldo Google Sheets dihitung langsung dari saldo awal dan seluruh transaksi aktif."
    : report?.status === "healthy"
      ? "Saldo tersimpan cocok dengan hasil perhitungan ulang seluruh transaksi."
      : report?.status === "needs_repair"
        ? "Preview di bawah membandingkan saldo tersimpan dengan saldo hasil ledger."
        : "Perbaiki referensi atau transaksi bermasalah sebelum saldo dihitung ulang.";

  return <section className="panel settings-section settings-wide ledger-health-panel">
    <div className="settings-title"><span><Scale size={20} /></span><div><h2>Integritas ledger</h2><p>Periksa saldo setiap akun dari saldo awal dan riwayat transaksi lengkap.</p></div><button className="secondary-button settings-title-action" onClick={() => void inspect()} disabled={Boolean(working)}>{working === "check" ? "Memeriksa…" : "Periksa ulang"}</button></div>
    <div className={`ledger-health-status ${report?.status ?? "loading"}`}><span>{report?.status === "healthy" ? <CheckCircle2 size={20} /> : <ShieldCheck size={20} />}</span><div><strong>{statusTitle}</strong><small>{statusDescription}</small></div>{report?.checkedAt && <time>{new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date(report.checkedAt))}</time>}</div>
    {report && <>
      <div className="ledger-health-summary"><span><small>Akun diperiksa</small><strong>{report.summary.accountCount}</strong></span><span><small>Transaksi aktif</small><strong>{report.summary.completedTransactionCount}</strong></span><span><small>Saldo berbeda</small><strong>{report.summary.driftCount}</strong></span><span><small>Total selisih</small><Amount value={report.summary.totalAbsoluteDifference} privacy={privacy} /></span></div>
      {differences.length > 0 && <div className="ledger-difference-list"><div className="ledger-difference-head"><span>Akun</span><span>Tersimpan</span><span>Hasil ledger</span><span>Selisih</span></div>{differences.map((account) => <div className="ledger-difference-row" key={account.id}><span><strong>{account.name}</strong><small>{account.liability ? "Kewajiban" : "Aset"}{account.active ? "" : " · diarsipkan"}</small></span><Amount value={account.storedBalance} privacy={privacy} compact /><Amount value={account.expectedBalance} privacy={privacy} compact /><Amount value={Math.abs(account.difference)} privacy={privacy} compact className="ledger-difference-value" /></div>)}</div>}
      {report.issues.length > 0 && <div className="ledger-issue-list" role="alert">{report.issues.slice(0, 8).map((issue, index) => <small key={`${issue.code}-${issue.transactionId ?? issue.accountId ?? index}`}><ShieldCheck size={14} />{issue.message}</small>)}</div>}
      {report.canRepair && <div className="ledger-repair-actions">{!confirming ? <button className="primary-button" onClick={() => setConfirming(true)} disabled={Boolean(working)}>{report.storageMode === "calculated" ? "Tinjau hitung ulang" : `Tinjau perbaikan ${report.summary.driftCount} akun`}</button> : <div className="ledger-repair-confirm"><ShieldCheck size={18} /><span><strong>{report.storageMode === "calculated" ? "Hitung ulang ledger sekarang?" : "Terapkan saldo hasil ledger?"}</strong><small>{report.storageMode === "calculated" ? "Cache dashboard akan disegarkan tanpa mengubah transaksi." : "Hanya saldo ringkasan akun yang diperbarui. Saldo awal dan transaksi tidak diubah."}</small></span><button className="primary-button" onClick={() => void repair()} disabled={working === "repair"}>{working === "repair" ? "Memproses…" : "Konfirmasi & lanjutkan"}</button><button className="secondary-button" onClick={() => setConfirming(false)} disabled={working === "repair"}>Batal</button></div>}</div>}
    </>}
    {error && <div className="ledger-health-error" role="alert">{error}</div>}
  </section>;
}

async function compressReceiptImage(file: File) {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error("Gunakan gambar JPG, PNG, atau WebP.");
  if (file.size > 15 * 1024 * 1024) throw new Error("Foto terlalu besar. Pilih gambar di bawah 15 MB.");
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("Gambar tidak dapat dibaca."));
      element.src = objectUrl;
    });
    const maxEdge = 1600;
    const scale = Math.min(1, maxEdge / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Kompresi gambar tidak didukung perangkat ini.");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
    if (dataUrl.length > 5_600_000) throw new Error("Hasil kompresi masih terlalu besar. Potong foto agar hanya struk yang terlihat.");
    return { imageBase64: dataUrl.split(",")[1], mimeType: "image/jpeg", previewUrl: dataUrl };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

type TransactionModalMode = "create" | "edit" | "duplicate";

function TransactionModal({ accounts, categories, transactions, initial, mode, saving, onClose, onSubmit }: {
  accounts: Account[];
  categories: FinanceCategory[];
  transactions: Transaction[];
  initial?: Transaction;
  mode: TransactionModalMode;
  saving: boolean;
  onClose: () => void;
  onSubmit: (transaction: Transaction, requestId?: string, receiptFile?: File, removeReceipt?: boolean) => Promise<boolean>;
}) {
  const isEdit = mode === "edit";
  const isDuplicate = mode === "duplicate";
  const sourceAccounts = accounts.filter((account) => account.type !== "Investment");
  const initialAccountId = initial?.accountId ?? sourceAccounts[0]?.id ?? "";
  const [draftId] = useState(() => isEdit && initial ? initial.id : `tx-${crypto.randomUUID()}`);
  const [mutationRequestId] = useState(() => isEdit && initial ? `transaction-update:${initial.id}:${crypto.randomUUID()}` : draftId);
  const [type, setType] = useState<TransactionType>(initial?.type ?? "expense");
  const [amount, setAmount] = useState(initial ? String(initial.amount) : "");
  const [accountId, setAccountId] = useState(initialAccountId);
  const [destinationAccountId, setDestinationAccountId] = useState(initial?.destinationAccountId ?? accounts.find((account) => account.id !== initialAccountId)?.id ?? "");
  const [title, setTitle] = useState(isDuplicate && initial ? `${initial.title} (salinan)` : initial?.title ?? "");
  const [category, setCategory] = useState(initial?.category ?? categories.find((item) => item.active && item.type === "expense")?.name ?? "");
  const [date, setDate] = useState(isDuplicate ? today() : initial?.date ?? today());
  const [time, setTime] = useState(initial?.time ?? "");
  const [status, setStatus] = useState<Transaction["status"]>(initial?.status ?? "completed");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [tagsInput, setTagsInput] = useState(initial?.tags?.join(", ") ?? "");
  const [location, setLocation] = useState(initial?.location ?? "");
  const [splits, setSplits] = useState(() => (initial?.splits ?? []).map((split) => ({ ...split, id: isDuplicate ? `split-${crypto.randomUUID()}` : split.id })));
  const [splitEnabled, setSplitEnabled] = useState(Boolean(initial?.splits?.length));
  const [receiptFile, setReceiptFile] = useState<File | undefined>();
  const [removeReceipt, setRemoveReceipt] = useState(false);
  const [validationMessage, setValidationMessage] = useState("");
  const [ocrMessage, setOcrMessage] = useState("");
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrPreview, setOcrPreview] = useState("");
  const [ocrReceipt, setOcrReceipt] = useState<OcrReceipt | null>(null);
  const categoryType = type === "income" ? "income" : "expense";
  const availableCategories = categories.filter((item) => item.active && item.type === categoryType);
  const categoryOptions = availableCategories.some((item) => item.name === category)
    ? availableCategories
    : category ? [{ id: `legacy-${category}`, name: category, type: categoryType, color: categoryColors[category] ?? "#89918d", active: true } as FinanceCategory, ...availableCategories] : availableCategories;
  const splitTotal = splits.reduce((sum, split) => sum + Number(split.amount || 0), 0);
  const numericAmount = moneyInputNumber(amount);
  const recentTransactions = useMemo(() => {
    const seen = new Set<string>();
    return transactions
      .filter((transaction) =>
        !transaction.deletedAt
        && transaction.id !== initial?.id
        && transaction.type === type
        && accounts.some((account) => account.id === transaction.accountId),
      )
      .filter((transaction) => {
        const signature = [transaction.title.trim().toLowerCase(), transaction.accountId, transaction.destinationAccountId || "", transaction.category].join("|");
        if (seen.has(signature)) return false;
        seen.add(signature);
        return true;
      })
      .slice(0, 5);
  }, [accounts, initial?.id, transactions, type]);
  const changeType = (nextType: TransactionType) => {
    setType(nextType);
    setValidationMessage("");
    if (nextType === "income") setCategory(categories.find((item) => item.active && item.type === "income")?.name ?? "");
    if (nextType === "expense") setCategory(categories.find((item) => item.active && item.type === "expense")?.name ?? "");
    if (!["income", "expense", "refund"].includes(nextType)) { setSplitEnabled(false); setSplits([]); }
  };
  const addSplit = () => setSplits((current) => [...current, { id: `split-${crypto.randomUUID()}`, category: availableCategories[0]?.name ?? "", amount: 0, note: "" }]);
  const updateSplit = (id: string, patchValue: Partial<NonNullable<Transaction["splits"]>[number]>) => setSplits((current) => current.map((split) => split.id === id ? { ...split, ...patchValue } : split));
  const toggleSplit = () => {
    const next = !splitEnabled;
    setSplitEnabled(next);
    if (next && splits.length < 2) setSplits([
      { id: `split-${crypto.randomUUID()}`, category: availableCategories[0]?.name ?? "", amount: 0, note: "" },
      { id: `split-${crypto.randomUUID()}`, category: availableCategories[1]?.name ?? availableCategories[0]?.name ?? "", amount: 0, note: "" },
    ]);
  };
  const applyRecentTransaction = (recent: Transaction) => {
    setAmount(String(recent.amount));
    setTitle(recent.title);
    setAccountId(recent.accountId);
    if (recent.destinationAccountId) setDestinationAccountId(recent.destinationAccountId);
    setCategory(recent.category);
    setLocation(recent.location ?? "");
    setTagsInput(recent.tags?.join(", ") ?? "");
    setNotes(recent.notes ?? "");
    const recentSplits = (recent.splits ?? []).map((split) => ({ ...split, id: `split-${crypto.randomUUID()}` }));
    setSplits(recentSplits);
    setSplitEnabled(recentSplits.length >= 2);
    setValidationMessage(`Data dari "${recent.title}" sudah diisi. Tanggal, waktu, dan status tetap memakai pilihan saat ini.`);
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setValidationMessage("");
    if (!numericAmount || !title.trim() || !sourceAccounts.some((account) => account.id === accountId)) return;
    if ((type === "transfer" || type === "investment_buy") && (!destinationAccountId || accountId === destinationAccountId)) return;
    const activeSplits = splitEnabled ? splits : [];
    if (splitEnabled && (activeSplits.length < 2 || activeSplits.some((split) => !split.category || split.amount <= 0) || splitTotal !== numericAmount)) {
      setValidationMessage("Split harus memiliki minimal dua kategori dan totalnya tepat sama dengan nominal transaksi.");
      return;
    }
    if (type !== "transfer" && type !== "investment_buy" && !category && !activeSplits.length) return;
    const tags = [...new Set(tagsInput.split(/[,|]/).map((tag) => tag.trim()).filter(Boolean))].slice(0, 10);
    const saved = await onSubmit({
      id: draftId,
      type,
      date,
      time,
      title: title.trim(),
      merchant: title.trim(),
      category: type === "transfer" ? "Transfer" : type === "investment_buy" ? "Investasi" : activeSplits[0]?.category ?? category,
      notes: notes.trim(),
      tags,
      location: location.trim(),
      splits: activeSplits,
      accountId,
      destinationAccountId: type === "transfer" || type === "investment_buy" ? destinationAccountId : undefined,
      amount: numericAmount,
      status,
      transferGroupId: isEdit ? initial?.transferGroupId : undefined,
      updatedAt: isEdit ? initial?.updatedAt : undefined,
      receipt: isEdit ? initial?.receipt : undefined,
    }, mutationRequestId, receiptFile, removeReceipt);
    if (saved) onClose();
  };
  const selectReceipt = async (file?: File) => {
    if (!file) return;
    setOcrLoading(true); setOcrMessage(""); setOcrReceipt(null);
    try {
      const prepared = await compressReceiptImage(file);
      setOcrPreview(prepared.previewUrl);
      const result = await scanFinanceReceipt({ imageBase64: prepared.imageBase64, mimeType: prepared.mimeType, fileName: file.name });
      setOcrReceipt(result.receipt);
      setOcrMessage("Hasil OCR siap diperiksa. Belum ada transaksi yang disimpan.");
    } catch (reason) { setOcrMessage(reason instanceof Error ? reason.message : "Foto struk tidak dapat diproses."); }
    finally { setOcrLoading(false); }
  };
  const applyReceipt = () => {
    if (!ocrReceipt) return;
    changeType("expense"); setAmount(String(ocrReceipt.total)); setTitle(ocrReceipt.merchant || "Belanja dari struk"); setDate(ocrReceipt.date); setCategory(ocrReceipt.suggestedCategory);
    setOcrMessage("Form sudah diisi. Periksa nominal dan akun sebelum menyimpan.");
  };
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section className="modal transaction-advanced-modal" role="dialog" aria-modal="true" aria-labelledby="transaction-title">
      <div className="modal-head"><div><span className="card-kicker">{isEdit ? "Edit ledger" : isDuplicate ? "Duplikasi aman" : "Quick add"}</span><h2 id="transaction-title">{isEdit ? "Edit transaksi" : isDuplicate ? "Duplikasi transaksi" : "Transaksi baru"}</h2></div><button className="icon-button" onClick={onClose} aria-label="Tutup"><X size={20} /></button></div>
      <form onSubmit={submit}>
        <div className="transaction-type-tabs">{[{ key: "expense", label: "Pengeluaran", icon: ArrowUpRight }, { key: "income", label: "Pemasukan", icon: ArrowDownLeft }, { key: "transfer", label: "Transfer", icon: ArrowRight }].map((item) => { const Icon = item.icon; const locked = Boolean(isEdit && initial && (initial.type === "transfer" ? item.key !== "transfer" : item.key === "transfer")); return <button type="button" key={item.key} className={type === item.key ? "active" : ""} disabled={locked} onClick={() => changeType(item.key as TransactionType)}><Icon size={16} />{item.label}</button>; })}</div>
        {!isEdit && !isDuplicate && recentTransactions.length > 0 && <section className="transaction-recent"><div><span><Clock3 size={14} /> Terakhir digunakan</span><small>Ketuk untuk mengisi ulang</small></div><div>{recentTransactions.map((recent) => <button type="button" key={recent.id} onClick={() => applyRecentTransaction(recent)}><span><strong>{recent.title}</strong><small>{accounts.find((account) => account.id === recent.accountId)?.name ?? "Akun"} / {recent.category}</small></span><b>{formatIDR(recent.amount, true)}</b></button>)}</div></section>}
        <label className="amount-field"><span>Nominal</span><div><small>Rp</small><input value={formatMoneyInput(amount)} onChange={(event) => setAmount(moneyInputDigits(event.target.value))} inputMode="numeric" pattern="[0-9.]*" placeholder="0" required autoFocus /></div></label>
        <div className="form-grid">
          <label><span>Deskripsi / merchant</span><input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Contoh: Belanja mingguan" required /></label>
          <label><span>Tanggal & waktu</span><span className="date-time-fields"><input type="date" value={date} onChange={(event) => setDate(event.target.value)} required /><input type="time" value={time} onChange={(event) => setTime(event.target.value)} aria-label="Waktu transaksi" /></span></label>
          <label><span>Akun {type === "transfer" ? "sumber" : ""}</span><select value={accountId} required onChange={(event) => { const nextId = event.target.value; setAccountId(nextId); if (nextId === destinationAccountId) setDestinationAccountId(accounts.find((account) => account.id !== nextId)?.id ?? ""); }}><option value="" disabled>Pilih akun</option>{sourceAccounts.map((account) => <option value={account.id} key={account.id}>{account.name}</option>)}</select><ChevronDown size={15} /></label>
          {(type === "transfer" || type === "investment_buy") ? <label><span>Akun tujuan</span><select value={destinationAccountId} onChange={(event) => setDestinationAccountId(event.target.value)}>{accounts.filter((item) => item.id !== accountId).map((account) => <option value={account.id} key={account.id}>{account.name}</option>)}</select><ChevronDown size={15} /></label> : <label><span>Kategori utama</span><select value={category} required={!splitEnabled} onChange={(event) => setCategory(event.target.value)} disabled={splitEnabled}><option value="" disabled>Pilih kategori</option>{categoryOptions.map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}</select><ChevronDown size={15} /></label>}
          <label><span>Status</span><select value={status} onChange={(event) => setStatus(event.target.value as Transaction["status"])}><option value="completed">Selesai</option><option value="pending">Menunggu</option></select><ChevronDown size={15} /></label>
          <label><span>Lokasi</span><input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Opsional" maxLength={160} /></label>
          <label className="full-field"><span>Tag</span><input value={tagsInput} onChange={(event) => setTagsInput(event.target.value)} placeholder="operasional, stok, reimbursement" /><small>Pisahkan dengan koma, maksimal 10 tag.</small></label>
          <label className="full-field"><span>Catatan</span><textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Catatan tambahan transaksi" rows={3} maxLength={1000} /></label>
        </div>
        {["income", "expense", "refund"].includes(type) && <section className="transaction-split-box"><div><span><strong>Split kategori</strong><small>Bagi satu transaksi ke beberapa kategori.</small></span><button type="button" className={`split-toggle ${splitEnabled ? "active" : ""}`} onClick={toggleSplit}>{splitEnabled ? "Aktif" : "Gunakan split"}</button></div>{splitEnabled && <><div className="split-list">{splits.map((split, index) => <div className="split-row" key={split.id}><span>{index + 1}</span><select value={split.category} onChange={(event) => updateSplit(split.id, { category: event.target.value })}><option value="" disabled>Kategori</option>{availableCategories.map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}</select><input value={formatMoneyInput(split.amount || "")} onChange={(event) => updateSplit(split.id, { amount: moneyInputNumber(event.target.value) })} inputMode="numeric" placeholder="Nominal" /><input value={split.note ?? ""} onChange={(event) => updateSplit(split.id, { note: event.target.value })} placeholder="Catatan opsional" /><button type="button" className="icon-button small" onClick={() => setSplits((current) => current.filter((item) => item.id !== split.id))} disabled={splits.length <= 2}><X size={15} /></button></div>)}</div><div className={`split-total ${splitTotal === numericAmount ? "matched" : ""}`}><span>Total split <strong>{formatIDR(splitTotal)}</strong></span><span>Nominal <strong>{formatIDR(numericAmount)}</strong></span><button type="button" className="text-button" onClick={addSplit}><Plus size={14} /> Tambah rincian</button></div></>}</section>}
        <section className="transaction-attachment-box"><div><Paperclip size={17} /><span><strong>Lampiran struk</strong><small>JPG, PNG, WebP, atau PDF. Maksimal 5 MB dan disimpan privat.</small></span></div>{isEdit && initial?.receipt && !removeReceipt && !receiptFile && <div className="existing-receipt"><a href={financeTransactionReceiptUrl(initial.id, initial.receipt.id, initial.receipt.url)} target="_blank" rel="noreferrer">{initial.receipt.filename}</a><button type="button" onClick={() => setRemoveReceipt(true)}>Hapus lampiran</button></div>}<label className="secondary-button receipt-picker"><Upload size={15} /> {receiptFile ? receiptFile.name : initial?.receipt && !removeReceipt ? "Ganti lampiran" : "Pilih lampiran"}<input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(event) => { const file = event.target.files?.[0]; if (file) { setReceiptFile(file); setRemoveReceipt(false); } }} /></label>{removeReceipt && <small>Lampiran lama akan dihapus saat transaksi disimpan.</small>}</section>
        {!isEdit && !isDuplicate && <label className={`ocr-button ${ocrLoading ? "loading" : ""}`}><Upload size={17} /><span><strong>{ocrLoading ? "AI sedang membaca struk..." : "Isi form dari foto struk"}</strong><small>OCR tidak menyimpan gambar. Gunakan bagian Lampiran jika ingin menyimpannya.</small></span><input type="file" accept="image/jpeg,image/png,image/webp" disabled={ocrLoading} onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; void selectReceipt(file); }} /></label>}
        {!isEdit && !isDuplicate && ocrPreview && <div className="ocr-review">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={ocrPreview} alt="Preview foto struk" />
          {ocrLoading ? <div className="ocr-review-loading"><ScanLine size={21} /><strong>Mengekstrak data...</strong></div> : ocrReceipt ? <div className="ocr-result"><div><span>Merchant</span><strong>{ocrReceipt.merchant || "Tidak terbaca"}</strong></div><div><span>Total</span><strong>{formatIDR(ocrReceipt.total)}</strong></div><div><span>Tanggal</span><strong>{ocrReceipt.date}</strong></div><div><span>Kategori</span><strong>{ocrReceipt.suggestedCategory}</strong></div><button type="button" className="secondary-button" onClick={applyReceipt}><Check size={16} /> Gunakan hasil OCR</button></div> : null}
        </div>}
        {(validationMessage || ocrMessage) && <div className="ocr-message"><Sparkles size={15} />{validationMessage || ocrMessage}</div>}
        {!sourceAccounts.length && <div className="ocr-message"><WalletCards size={15} />Tambahkan akun pembayaran sebelum mencatat transaksi.</div>}
        <div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose} disabled={saving}>Batal</button><button className="primary-button" type="submit" disabled={saving || !sourceAccounts.length || (type === "transfer" && accounts.length < 2)}><Check size={17} /> {saving ? "Menyimpan..." : isEdit ? "Simpan perubahan" : isDuplicate ? "Simpan duplikat" : "Simpan transaksi"}</button></div>
      </form>
    </section>
  </div>;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function TransactionModalLegacy({ accounts, categories, initial, saving, onClose, onSubmit }: { accounts: Account[]; categories: FinanceCategory[]; initial?: Transaction; saving: boolean; onClose: () => void; onSubmit: (transaction: Transaction, requestId?: string) => Promise<boolean> }) {
  const sourceAccounts = accounts.filter((account) => account.type !== "Investment");
  const initialAccountId = initial?.accountId ?? sourceAccounts[0]?.id ?? "";
  const [draftId] = useState(() => initial?.id ?? `tx-${crypto.randomUUID()}`);
  const [mutationRequestId] = useState(() => initial ? `transaction-update:${initial.id}:${crypto.randomUUID()}` : draftId);
  const [type, setType] = useState<TransactionType>(initial?.type ?? "expense");
  const [amount, setAmount] = useState(initial ? String(initial.amount) : "");
  const [accountId, setAccountId] = useState(initialAccountId);
  const [destinationAccountId, setDestinationAccountId] = useState(initial?.destinationAccountId ?? accounts.find((account) => account.id !== initialAccountId)?.id ?? "");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [category, setCategory] = useState(initial?.category ?? categories.find((item) => item.active && item.type === "expense")?.name ?? "");
  const [date, setDate] = useState(initial?.date ?? today());
  const [ocrMessage, setOcrMessage] = useState("");
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrPreview, setOcrPreview] = useState("");
  const [ocrReceipt, setOcrReceipt] = useState<OcrReceipt | null>(null);
  const categoryType = type === "income" ? "income" : "expense";
  const availableCategories = categories.filter((item) => item.active && item.type === categoryType);
  const categoryOptions = availableCategories.some((item) => item.name === category)
    ? availableCategories
    : category ? [{ id: `legacy-${category}`, name: category, type: categoryType, color: categoryColors[category] ?? "#89918d", active: true } as FinanceCategory, ...availableCategories] : availableCategories;
  const changeType = (nextType: TransactionType) => {
    setType(nextType);
    if (nextType === "income") setCategory(categories.find((item) => item.active && item.type === "income")?.name ?? "");
    if (nextType === "expense") setCategory(categories.find((item) => item.active && item.type === "expense")?.name ?? "");
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const value = Number(amount.replace(/\D/g, ""));
    if (!value || value <= 0 || !title.trim() || !sourceAccounts.some((account) => account.id === accountId)) return;
    if ((type === "transfer" || type === "investment_buy") && (!destinationAccountId || accountId === destinationAccountId)) return;
    if (type !== "transfer" && type !== "investment_buy" && !category) return;
    const saved = await onSubmit({ id: draftId, type, date, title: title.trim(), merchant: title.trim(), category: type === "transfer" ? "Transfer" : type === "investment_buy" ? "Investasi" : category, accountId, destinationAccountId: type === "transfer" || type === "investment_buy" ? destinationAccountId : undefined, amount: value, status: initial?.status ?? "completed", transferGroupId: initial?.transferGroupId, updatedAt: initial?.updatedAt }, mutationRequestId);
    if (saved) onClose();
  };
  const selectReceipt = async (file?: File) => {
    if (!file) return;
    setOcrLoading(true);
    setOcrMessage("");
    setOcrReceipt(null);
    try {
      const prepared = await compressReceiptImage(file);
      setOcrPreview(prepared.previewUrl);
      const result = await scanFinanceReceipt({ imageBase64: prepared.imageBase64, mimeType: prepared.mimeType, fileName: file.name });
      setOcrReceipt(result.receipt);
      setOcrMessage("Hasil OCR siap diperiksa. Belum ada transaksi yang disimpan.");
    } catch (reason) {
      setOcrMessage(reason instanceof Error ? reason.message : "Foto struk tidak dapat diproses.");
    } finally {
      setOcrLoading(false);
    }
  };
  const applyReceipt = () => {
    if (!ocrReceipt) return;
    changeType("expense");
    setAmount(String(ocrReceipt.total));
    setTitle(ocrReceipt.merchant || "Belanja dari struk");
    setDate(ocrReceipt.date);
    setCategory(ocrReceipt.suggestedCategory);
    setOcrMessage("Form sudah diisi. Periksa nominal dan pilih akun, lalu tekan Simpan transaksi untuk mengonfirmasi.");
  };
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section className="modal" role="dialog" aria-modal="true" aria-labelledby="transaction-title">
      <div className="modal-head"><div><span className="card-kicker">{initial ? "Edit ledger" : "Quick add"}</span><h2 id="transaction-title">{initial ? "Edit transaksi" : "Transaksi baru"}</h2></div><button className="icon-button" onClick={onClose} aria-label="Tutup"><X size={20} /></button></div>
      <form onSubmit={submit}>
        <div className="transaction-type-tabs">
          {[{ key: "expense", label: "Pengeluaran", icon: ArrowUpRight }, { key: "income", label: "Pemasukan", icon: ArrowDownLeft }, { key: "transfer", label: "Transfer", icon: ArrowRight }].map((item) => { const Icon = item.icon; const locked = Boolean(initial && (initial.type === "transfer" ? item.key !== "transfer" : item.key === "transfer")); return <button type="button" key={item.key} className={type === item.key ? "active" : ""} disabled={locked} onClick={() => changeType(item.key as TransactionType)}><Icon size={16} />{item.label}</button>; })}
        </div>
        <label className="amount-field"><span>Nominal</span><div><small>Rp</small><input value={amount} onChange={(event) => setAmount(event.target.value.replace(/\D/g, ""))} inputMode="numeric" pattern="[1-9][0-9]*" placeholder="0" required autoFocus /></div></label>
        <div className="form-grid">
          <label><span>Deskripsi / merchant</span><input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Contoh: Belanja mingguan" required /></label>
          <label><span>Tanggal</span><input type="date" value={date} onChange={(event) => setDate(event.target.value)} required /></label>
          <label><span>Akun {type === "transfer" ? "sumber" : ""}</span><select value={accountId} required onChange={(event) => { const nextId = event.target.value; setAccountId(nextId); if (nextId === destinationAccountId) setDestinationAccountId(accounts.find((account) => account.id !== nextId)?.id ?? ""); }}><option value="" disabled>Pilih akun</option>{sourceAccounts.map((account) => <option value={account.id} key={account.id}>{account.name}</option>)}</select><ChevronDown size={15} /></label>
          {(type === "transfer" || type === "investment_buy") ? <label><span>Akun tujuan</span><select value={destinationAccountId} onChange={(event) => setDestinationAccountId(event.target.value)}>{accounts.filter((item) => item.id !== accountId).map((account) => <option value={account.id} key={account.id}>{account.name}</option>)}</select><ChevronDown size={15} /></label> : <label><span>Kategori</span><select value={category} required onChange={(event) => setCategory(event.target.value)}><option value="" disabled>Pilih kategori</option>{categoryOptions.map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}</select><ChevronDown size={15} /></label>}
        </div>
        {!initial && <label className={`ocr-button ${ocrLoading ? "loading" : ""}`}><Upload size={17} /><span><strong>{ocrLoading ? "AI sedang membaca struk…" : "Isi dari foto struk"}</strong><small>JPG, PNG, atau WebP · dikompresi di perangkat · gambar tidak disimpan.</small></span><input type="file" accept="image/jpeg,image/png,image/webp" disabled={ocrLoading} onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; selectReceipt(file); }} /></label>}
        {!initial && ocrPreview && <div className="ocr-review">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={ocrPreview} alt="Preview foto struk yang akan diperiksa" />
          {ocrLoading ? <div className="ocr-review-loading"><ScanLine size={21} /><strong>Mengekstrak merchant, tanggal, total, dan kategori…</strong></div> : ocrReceipt ? <div className="ocr-result"><div><span>Merchant</span><strong>{ocrReceipt.merchant || "Tidak terbaca"}</strong></div><div><span>Total</span><strong>{formatIDR(ocrReceipt.total)}</strong></div><div><span>Tanggal</span><strong>{ocrReceipt.date}</strong></div><div><span>Kategori</span><strong>{ocrReceipt.suggestedCategory}</strong></div><div><span>Pajak + layanan</span><strong>{formatIDR(ocrReceipt.tax + ocrReceipt.serviceFee)}</strong></div><div><span>Keyakinan</span><strong>{Math.round(ocrReceipt.confidence * 100)}%</strong></div>{ocrReceipt.items.length > 0 && <small>{ocrReceipt.items.length} item terdeteksi{ocrReceipt.paymentMethod ? ` · ${ocrReceipt.paymentMethod}` : ""}</small>}<button type="button" className="secondary-button" onClick={applyReceipt}><Check size={16} /> Gunakan hasil OCR</button></div> : null}
        </div>}
        {ocrMessage && <div className="ocr-message"><Sparkles size={15} />{ocrMessage}</div>}
        {!sourceAccounts.length && <div className="ocr-message"><WalletCards size={15} />Tambahkan akun pembayaran sebelum mencatat transaksi.</div>}
        {!availableCategories.length && type !== "transfer" && type !== "investment_buy" && !initial && <div className="ocr-message"><Tags size={15} />Tambahkan kategori {categoryType === "income" ? "pemasukan" : "pengeluaran"} di Pengaturan.</div>}
        <div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose} disabled={saving}>Batal</button><button className="primary-button" type="submit" disabled={saving || !sourceAccounts.length || (type === "transfer" && accounts.length < 2) || (type !== "transfer" && type !== "investment_buy" && !category)}><Check size={17} /> {saving ? "Menyimpan…" : initial ? "Simpan perubahan" : "Simpan transaksi"}</button></div>
      </form>
    </section>
  </div>;
}

function TransactionImportModal({ accounts, categories, categoryRules, existingTransactions, saving, onClose, onSubmit }: {
  accounts: Account[];
  categories: FinanceCategory[];
  categoryRules: CategoryRule[];
  existingTransactions: Transaction[];
  saving: boolean;
  onClose: () => void;
  onSubmit: (transactions: Transaction[]) => Promise<boolean>;
}) {
  const [preview, setPreview] = useState<TransactionImportPreview | null>(null);
  const [filename, setFilename] = useState("");
  const [error, setError] = useState("");
  const selectFile = async (file?: File) => {
    if (!file) return;
    setError(""); setFilename(file.name);
    if (file.size > 1024 * 1024) { setPreview(null); setError("Ukuran CSV maksimal 1 MB."); return; }
    try {
      const result = previewTransactionCsv(await file.text(), accounts, categories, categoryRules, existingTransactions);
      if (!result.rows.length) throw new Error("CSV kosong atau hanya berisi header.");
      setPreview(result);
    } catch (reason) { setPreview(null); setError(reason instanceof Error ? reason.message : "CSV tidak dapat dibaca."); }
  };
  const downloadTemplate = () => {
    const url = URL.createObjectURL(new Blob([transactionCsvTemplate], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = "template-transaksi-financial-planner.csv"; anchor.click(); URL.revokeObjectURL(url);
  };
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section className="modal import-modal" role="dialog" aria-modal="true" aria-labelledby="import-title">
      <div className="modal-head"><div><span className="card-kicker">Bulk import</span><h2 id="import-title">Impor transaksi CSV</h2></div><button className="icon-button" onClick={onClose} aria-label="Tutup"><X size={20} /></button></div>
      <div className="import-guide"><FileUp size={22} /><div><strong>Preview dulu, simpan setelah semua baris valid.</strong><p>Kolom wajib: tanggal, jenis, deskripsi, akun, dan nominal. Kategori boleh kosong jika deskripsi cocok dengan aturan otomatis.</p><button type="button" className="text-button" onClick={downloadTemplate}><Download size={14} /> Unduh template CSV</button></div></div>
      <label className="csv-dropzone"><Upload size={20} /><span><strong>{filename || "Pilih file CSV"}</strong><small>Maksimal 100 transaksi atau 1 MB</small></span><input type="file" accept=".csv,text/csv" onChange={(event) => void selectFile(event.target.files?.[0])} /></label>
      {error && <div className="ocr-message"><X size={15} />{error}</div>}
      {preview && <>
        <div className="import-summary"><span><small>Siap diimpor</small><strong>{preview.validCount}</strong></span><span><small>Sudah ada</small><strong>{preview.duplicateCount}</strong></span><span className={preview.errorCount ? "negative-text" : "positive-text"}><small>Perlu diperbaiki</small><strong>{preview.errorCount}</strong></span><span><small>Pengeluaran baru</small><strong>{formatIDR(preview.expense)}</strong></span></div>
        <div className="import-preview-table"><div className="import-preview-head"><span>Baris</span><span>Transaksi</span><span>Akun / kategori</span><span>Nominal</span><span>Status</span></div>{preview.rows.slice(0, 30).map((row) => <div className={row.errors.length ? "invalid" : row.duplicateOf ? "duplicate" : ""} key={row.rowNumber}><span>{row.rowNumber}</span><span><strong>{row.transaction?.title || row.raw.title || "-"}</strong><small>{row.transaction?.date || row.raw.date || "-"}</small></span><span>{row.transaction ? <>{accounts.find((item) => item.id === row.transaction?.accountId)?.name} · {row.transaction.category}{row.matchedRule && <small className="auto-category-badge"><Sparkles size={11} /> Otomatis: {row.matchedRule.keyword}</small>}</> : row.duplicateOf ? "Cocok dengan ledger" : "-"}</span><span>{row.transaction ? formatIDR(row.transaction.amount) : row.raw.amount || "-"}</span><span>{row.errors.length ? row.errors.join(" ") : row.duplicateOf ? "Sudah ada · dilewati" : "Siap"}</span></div>)}</div>
        {preview.rows.length > 30 && <small className="import-more">Menampilkan 30 dari {preview.rows.length} baris.</small>}
      </>}
      <div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose} disabled={saving}>Batal</button><button type="button" className="primary-button" disabled={saving || !preview?.validCount || Boolean(preview.errorCount)} onClick={() => preview && void onSubmit(preview.valid)}><FileUp size={17} /> {saving ? "Mengimpor..." : `Impor ${preview?.validCount || 0} transaksi`}</button></div>
    </section>
  </div>;
}

function AccountImportModal({ accounts, saving, onClose, onSubmit }: {
  accounts: Account[];
  saving: boolean;
  onClose: () => void;
  onSubmit: (items: AccountImportItem[]) => Promise<boolean>;
}) {
  const [preview, setPreview] = useState<AccountImportPreview | null>(null);
  const [filename, setFilename] = useState("");
  const [error, setError] = useState("");
  const selectFile = async (file?: File) => {
    if (!file) return;
    setError(""); setFilename(file.name);
    if (file.size > 1024 * 1024) { setPreview(null); setError("Ukuran CSV maksimal 1 MB."); return; }
    try {
      const result = previewAccountCsv(await file.text(), accounts);
      if (!result.rows.length) throw new Error("CSV kosong atau hanya berisi header.");
      setPreview(result);
    } catch (reason) { setPreview(null); setError(reason instanceof Error ? reason.message : "CSV tidak dapat dibaca."); }
  };
  const downloadTemplate = () => {
    const url = URL.createObjectURL(new Blob([accountCsvTemplate], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = "template-akun-financial-planner.csv"; anchor.click(); URL.revokeObjectURL(url);
  };
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section className="modal import-modal" role="dialog" aria-modal="true" aria-labelledby="account-import-title">
      <div className="modal-head"><div><span className="card-kicker">Penyiapan data</span><h2 id="account-import-title">Impor akun & saldo awal</h2></div><button className="icon-button" onClick={onClose} aria-label="Tutup"><X size={20} /></button></div>
      <div className="import-guide"><WalletCards size={22} /><div><strong>Periksa preview sebelum menyimpan.</strong><p>Kolom wajib: nama dan jenis. Saldo awal harus Rupiah bulat non-negatif; nama akun tidak boleh duplikat.</p><button type="button" className="text-button" onClick={downloadTemplate}><Download size={14} /> Unduh template CSV</button></div></div>
      <label className="csv-dropzone"><Upload size={20} /><span><strong>{filename || "Pilih file CSV akun"}</strong><small>Maksimal 100 akun atau 1 MB</small></span><input type="file" accept=".csv,text/csv" onChange={(event) => void selectFile(event.target.files?.[0])} /></label>
      {error && <div className="ocr-message"><X size={15} />{error}</div>}
      {preview && <>
        <div className="import-summary"><span><small>Baris valid</small><strong>{preview.validCount}</strong></span><span className={preview.errorCount ? "negative-text" : "positive-text"}><small>Perlu diperbaiki</small><strong>{preview.errorCount}</strong></span><span><small>Total saldo awal</small><strong>{formatIDR(preview.totalOpeningBalance)}</strong></span><span><small>Akun kewajiban</small><strong>{preview.liabilityCount}</strong></span></div>
        <div className="import-preview-table"><div className="import-preview-head"><span>Baris</span><span>Akun</span><span>Jenis / institusi</span><span>Saldo awal</span><span>Status</span></div>{preview.rows.slice(0, 30).map((row) => <div className={row.errors.length ? "invalid" : ""} key={row.rowNumber}><span>{row.rowNumber}</span><span><strong>{row.account?.name || row.raw.name || "-"}</strong><small>{row.account?.mask || row.raw.mask ? `Akhir ${row.account?.mask || row.raw.mask}` : "Tanpa nomor"}</small></span><span>{row.account ? `${row.account.type}${row.account.institution ? ` · ${row.account.institution}` : ""}` : row.raw.type || "-"}</span><span>{row.account ? formatIDR(row.account.openingBalance) : row.raw.opening_balance || "-"}</span><span>{row.errors.length ? row.errors.join(" ") : "Siap"}</span></div>)}</div>
        {preview.rows.length > 30 && <small className="import-more">Menampilkan 30 dari {preview.rows.length} baris.</small>}
      </>}
      <div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose} disabled={saving}>Batal</button><button type="button" className="primary-button" disabled={saving || !preview?.validCount || Boolean(preview.errorCount)} onClick={() => preview && void onSubmit(preview.valid)}><FileUp size={17} /> {saving ? "Mengimpor..." : `Impor ${preview?.validCount || 0} akun`}</button></div>
    </section>
  </div>;
}

function LoadingWorkspace() {
  return <main className="workspace-state"><BrandMark /><div className="workspace-spinner" /><h1>Menyiapkan Financial Planner</h1><p>Membaca akun, ledger, anggaran, target, dan tagihan dari penyimpanan utama.</p></main>;
}

function SetupWizard({ error, saving, onRetry, onSubmit }: { error: string | null; saving: boolean; onRetry: () => void; onSubmit: (input: SetupWorkspaceInput) => Promise<void> }) {
  const [profileName, setProfileName] = useState("Pemilik");
  const [storeName, setStoreName] = useState("Financial Planner");
  const [accountName, setAccountName] = useState("Rekening Utama");
  const [accountType, setAccountType] = useState("Bank");
  const [institution, setInstitution] = useState("");
  const [openingBalance, setOpeningBalance] = useState("");
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    await onSubmit({
      profileName: profileName.trim() || "Pemilik",
      storeName: storeName.trim() || "Financial Planner",
      currency: "IDR",
      timezone: "Asia/Jakarta",
      accounts: [{ name: accountName.trim(), type: accountType, institution: institution.trim(), openingBalance: Number(openingBalance.replace(/\D/g, "") || 0), color: "#126b59" }],
    });
  };
  return <main className="setup-shell">
    <section className="setup-copy">
      <div className="brand setup-brand"><BrandMark /><span className="brand-copy"><strong>Financial Planner</strong><small>Personal Finance</small></span></div>
      <span className="setup-kicker"><ShieldCheck size={15} /> Setup aman dan dapat dijalankan ulang</span>
      <h1>Mulai dari data keuanganmu sendiri.</h1>
      <p>Tambahkan akun utama untuk memulai. Seluruh dashboard akan dihitung otomatis dari transaksi yang kamu catat.</p>
      <div className="setup-benefits"><span><Check size={16} /> Rupiah dan zona waktu Jakarta</span><span><Check size={16} /> Transfer tidak dihitung sebagai pemasukan</span><span><Check size={16} /> Data tersimpan permanen di {financeBackendLabel()}</span></div>
    </section>
    <section className="setup-card">
      <span className="card-kicker">Langkah 1 dari 1</span><h2>Siapkan workspace</h2><p>Periksa nama workspace dan saldo awal sebelum menyimpan setup.</p>
      {error && <div className="setup-error"><Database size={17} /><span><strong>Koneksi belum siap</strong><small>{error}</small></span><button type="button" onClick={onRetry}>Coba lagi</button></div>}
      <form onSubmit={submit}>
        <div className="form-grid setup-form">
          <label><span>Nama profil</span><input value={profileName} onChange={(event) => setProfileName(event.target.value)} required /></label>
          <label><span>Nama workspace</span><input value={storeName} onChange={(event) => setStoreName(event.target.value)} required /></label>
        </div>
        <div className="setup-divider"><span>Akun pertama</span></div>
        <div className="form-grid setup-form">
          <label><span>Nama akun</span><input value={accountName} onChange={(event) => setAccountName(event.target.value)} placeholder="Contoh: BCA Utama" required /></label>
          <label><span>Jenis akun</span><select value={accountType} onChange={(event) => setAccountType(event.target.value)}>{["Bank", "E-Wallet", "Cash", "Credit Card", "Paylater", "Loan", "Mortgage"].map((item) => <option key={item}>{item}</option>)}</select><ChevronDown size={15} /></label>
          <label><span>Institusi</span><input value={institution} onChange={(event) => setInstitution(event.target.value)} placeholder="Contoh: Bank BCA" /></label>
          <label><span>Saldo awal</span><input value={formatMoneyInput(openingBalance)} onChange={(event) => setOpeningBalance(moneyInputDigits(event.target.value))} inputMode="numeric" placeholder="0" /></label>
        </div>
        <button className="primary-button setup-submit" disabled={saving}>{saving ? "Menyiapkan workspace…" : "Buat Financial Planner"}<ArrowRight size={17} /></button>
        <small className="setup-footnote"><ShieldCheck size={14} /> PIN, OTP, CVV, dan password bank tidak pernah diminta.</small>
      </form>
    </section>
  </main>;
}

function AccountModal({ account, saving, onClose, onSubmit }: { account?: Account; saving: boolean; onClose: () => void; onSubmit: (payload: Record<string, unknown>) => Promise<void> }) {
  const [name, setName] = useState(account?.name ?? "");
  const [type, setType] = useState(account?.type ?? "Bank");
  const [institution, setInstitution] = useState(account?.institution ?? "");
  const [mask, setMask] = useState(account?.mask ?? "");
  const [color, setColor] = useState(account?.color ?? "#126b59");
  const [openingBalance, setOpeningBalance] = useState("");
  const liability = ["Credit Card", "Paylater", "Loan", "Mortgage"].includes(type);
  return <SimpleModal title={account ? "Edit akun" : "Tambah akun"} kicker="Multi-account" saving={saving} onClose={onClose} onSubmit={(event) => { event.preventDefault(); return onSubmit({ name: name.trim(), type, institution: institution.trim(), mask: mask.trim(), ...(account ? {} : { openingBalance: Number(openingBalance || 0) }), color, liability, currency: "IDR" }); }}>
    <div className="form-grid"><label><span>Nama akun</span><input value={name} onChange={(event) => setName(event.target.value)} required autoFocus /></label><label><span>Jenis akun</span><select value={type} onChange={(event) => setType(event.target.value as Account["type"])}>{["Bank", "E-Wallet", "Cash", "Deposit", "Receivable", "Investment", "Credit Card", "Paylater", "Loan", "Mortgage", "Custom"].map((item) => <option key={item}>{item}</option>)}</select><ChevronDown size={15} /></label><label><span>Institusi</span><input value={institution} onChange={(event) => setInstitution(event.target.value)} placeholder="Opsional" /></label><label><span>Nomor akhir / label</span><input value={mask} onChange={(event) => setMask(event.target.value)} placeholder="Contoh: 1234" maxLength={40} /></label>{!account && <label><span>Saldo awal</span><input value={formatMoneyInput(openingBalance)} onChange={(event) => setOpeningBalance(moneyInputDigits(event.target.value))} inputMode="numeric" placeholder="0" /></label>}<label className="color-field"><span>Warna akun</span><input type="color" value={color} onChange={(event) => setColor(event.target.value)} /><small>{color.toUpperCase()}</small></label></div>
    {account && <div className="ocr-message"><Scale size={15} />Saldo tidak diubah dari form ini. Gunakan Cocokkan saldo agar jejak ledger tetap utuh.</div>}
  </SimpleModal>;
}

function LoanDrawdownModal({ accounts, saving, onClose, onSubmit }: { accounts: Account[]; saving: boolean; onClose: () => void; onSubmit: (payload: LoanDrawdownInput) => Promise<boolean> }) {
  const liabilityAccounts = accounts.filter((account) => account.liability);
  const destinationAccounts = accounts.filter((account) => !account.liability && account.type !== "Investment");
  const [liabilityAccountId, setLiabilityAccountId] = useState(liabilityAccounts[0]?.id ?? "");
  const [destinationAccountId, setDestinationAccountId] = useState(destinationAccounts[0]?.id ?? "");
  const [cashReceived, setCashReceived] = useState("");
  const [totalObligation, setTotalObligation] = useState("");
  const [obligationTouched, setObligationTouched] = useState(false);
  const [date, setDate] = useState(today());
  const [title, setTitle] = useState("Pencairan pinjaman");
  const [notes, setNotes] = useState("");
  const [requestId] = useState(() => `loan-drawdown-${crypto.randomUUID()}`);
  const liability = liabilityAccounts.find((account) => account.id === liabilityAccountId);
  const destination = destinationAccounts.find((account) => account.id === destinationAccountId);
  const received = Number(cashReceived || 0);
  const obligation = Number(totalObligation || 0);
  const financingCost = Math.max(0, obligation - received);
  const invalidObligation = received > 0 && obligation > 0 && obligation < received;
  const financingRate = received > 0 ? (financingCost / received) * 100 : 0;
  return <SimpleModal title="Catat pinjaman baru" kicker="Double-entry utang" saving={saving} onClose={onClose} onSubmit={async (event) => {
    event.preventDefault();
    if (!liability || !destination || !received || !obligation || invalidObligation) return;
    await onSubmit({
      requestId,
      liabilityAccountId: liability.id,
      destinationAccountId: destination.id,
      cashReceived: received,
      totalObligation: obligation,
      date,
      title: title.trim(),
      notes: [notes.trim(), `Pencairan dari ${liability.name} ke ${destination.name}.`].filter(Boolean).join(" "),
    });
  }}>
    <div className="loan-drawdown-flow">
      <span><CreditCard size={18} /><small>Sumber utang</small><strong>{liability?.name ?? "Pilih akun kewajiban"}</strong></span>
      <ArrowRight size={19} />
      <span><Landmark size={18} /><small>Dana diterima</small><strong>{destination?.name ?? "Pilih rekening"}</strong></span>
    </div>
    <div className="form-grid">
      <label><span>Akun utang / Paylater</span><select value={liabilityAccountId} onChange={(event) => setLiabilityAccountId(event.target.value)} required><option value="" disabled>Pilih akun kewajiban</option>{liabilityAccounts.map((account) => <option value={account.id} key={account.id}>{account.name} — {account.type}</option>)}</select><ChevronDown size={15} /></label>
      <label><span>Rekening penerima</span><select value={destinationAccountId} onChange={(event) => setDestinationAccountId(event.target.value)} required><option value="" disabled>Pilih rekening penerima</option>{destinationAccounts.map((account) => <option value={account.id} key={account.id}>{account.name}</option>)}</select><ChevronDown size={15} /></label>
      <label><span>Uang bersih yang diterima</span><input value={formatMoneyInput(cashReceived)} onChange={(event) => {
        const next = moneyInputDigits(event.target.value);
        setCashReceived(next);
        if (!obligationTouched) setTotalObligation(next);
      }} inputMode="numeric" pattern="[0-9.]*" placeholder="Contoh: 5.083.350" required autoFocus /><small>Nominal yang benar-benar masuk ke rekening.</small></label>
      <label><span>Total kewajiban kontrak</span><input value={formatMoneyInput(totalObligation)} onChange={(event) => {
        setObligationTouched(true);
        setTotalObligation(moneyInputDigits(event.target.value));
      }} inputMode="numeric" pattern="[0-9.]*" placeholder="Contoh: 6.105.120" required /><small>Jumlah seluruh pokok, bunga, dan biaya yang harus dilunasi.</small></label>
      <label><span>Tanggal pencairan</span><input type="date" value={date} max={today()} onChange={(event) => setDate(event.target.value)} required /></label>
      <label className="full-field"><span>Nama transaksi</span><input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Contoh: Pencairan Kredivo" required /></label>
      <label className="full-field"><span>Catatan</span><textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} placeholder="Nomor kontrak atau keterangan lain (opsional)" /></label>
    </div>
    {received > 0 && obligation > 0 && <div className={`loan-drawdown-breakdown ${invalidObligation ? "invalid" : ""}`}>
      <span><small>Masuk ke rekening</small><strong>{formatIDR(received)}</strong></span>
      <span><small>Total utang bertambah</small><strong>{formatIDR(obligation)}</strong></span>
      <span><small>Biaya pembiayaan</small><strong>{invalidObligation ? "Periksa nominal" : formatIDR(financingCost)}</strong>{!invalidObligation && financingCost > 0 && <em>{financingRate.toFixed(1)}% dari dana cair</em>}</span>
    </div>}
    {invalidObligation
      ? <div className="ocr-message"><TriangleAlert size={15} />Total kewajiban harus sama dengan atau lebih besar daripada uang yang diterima.</div>
      : <div className="loan-drawdown-note"><ShieldCheck size={16} /><span><strong>Bukan pemasukan.</strong> Kas bertambah sebesar dana bersih, utang bertambah sebesar total kontrak, dan selisih dicatat sebagai biaya pembiayaan tanpa menggandakan pengeluaran bulanan.</span></div>}
    {!liabilityAccounts.length && <div className="ocr-message"><CreditCard size={15} />Tambahkan akun Paylater, Credit Card, Loan, atau Mortgage terlebih dahulu.</div>}
    {!destinationAccounts.length && <div className="ocr-message"><Landmark size={15} />Tambahkan rekening Bank, E-Wallet, atau Cash untuk menerima dana.</div>}
  </SimpleModal>;
}

function BudgetModal({ budget, month, categories, saving, onClose, onSubmit }: { budget?: Budget; month: string; categories: FinanceCategory[]; saving: boolean; onClose: () => void; onSubmit: (payload: Record<string, unknown>) => Promise<void> }) {
  const expenseCategories = categories.filter((item) => item.active && item.type === "expense");
  const [category, setCategory] = useState(budget?.category ?? expenseCategories[0]?.name ?? "");
  const [limit, setLimit] = useState(budget ? String(budget.limit) : "");
  const color = expenseCategories.find((item) => item.name === category)?.color ?? categoryColors[category] ?? "#126b59";
  return <SimpleModal title={budget ? "Edit anggaran" : "Anggaran kategori"} kicker={monthLabel(month)} saving={saving} onClose={onClose} onSubmit={(event) => { event.preventDefault(); return onSubmit({ month, period: month, category, limitAmount: Number(limit || 0), limit: Number(limit || 0), color }); }}>
    <div className="form-grid"><label><span>Kategori</span><select value={category} disabled={Boolean(budget)} required onChange={(event) => setCategory(event.target.value)}><option value="" disabled>Pilih kategori</option>{expenseCategories.map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}</select><ChevronDown size={15} /></label><label><span>Batas anggaran</span><input value={formatMoneyInput(limit)} onChange={(event) => setLimit(moneyInputDigits(event.target.value))} inputMode="numeric" pattern="[0-9.]*" placeholder="0" required autoFocus /></label></div>
    {!expenseCategories.length && <div className="ocr-message"><Tags size={15} />Tambahkan kategori pengeluaran di Pengaturan terlebih dahulu.</div>}
  </SimpleModal>;
}

function GoalModal({ goal, saving, onClose, onSubmit }: { goal?: Goal; saving: boolean; onClose: () => void; onSubmit: (payload: Record<string, unknown>) => Promise<void> }) {
  const nextYear = new Date(); nextYear.setFullYear(nextYear.getFullYear() + 1);
  const [name, setName] = useState(goal?.name ?? "");
  const [targetAmount, setTargetAmount] = useState(goal ? String(goal.target) : "");
  const [currentAmount, setCurrentAmount] = useState(goal ? String(goal.current) : "0");
  const [deadline, setDeadline] = useState(goal?.deadline ?? nextYear.toISOString().slice(0, 10));
  return <SimpleModal title={goal ? "Edit target finansial" : "Target finansial"} kicker="Goal tracking" saving={saving} onClose={onClose} onSubmit={(event) => { event.preventDefault(); return onSubmit({ name: name.trim(), targetAmount: Number(targetAmount || 0), target: Number(targetAmount || 0), currentAmount: Number(currentAmount || 0), current: Number(currentAmount || 0), deadline, color: goal?.color ?? "#126b59", icon: goal?.icon ?? "target" }); }}>
    <div className="form-grid"><label><span>Nama target</span><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Contoh: Dana Darurat" required autoFocus /></label><label><span>Deadline</span><input type="date" min={goal ? undefined : today()} value={deadline} onChange={(event) => setDeadline(event.target.value)} required /></label><label><span>Nominal target</span><input value={formatMoneyInput(targetAmount)} onChange={(event) => setTargetAmount(moneyInputDigits(event.target.value))} inputMode="numeric" pattern="[0-9.]*" required /></label>{!goal && <label><span>Dana terkumpul</span><input value={formatMoneyInput(currentAmount)} onChange={(event) => setCurrentAmount(moneyInputDigits(event.target.value))} inputMode="numeric" pattern="[0-9.]*" /></label>}</div>
  </SimpleModal>;
}

function GoalProgressModal({ goal, privacy, saving, onClose, onSubmit }: { goal: Goal; privacy: boolean; saving: boolean; onClose: () => void; onSubmit: (amount: number, mode: "add" | "withdraw") => Promise<void> }) {
  const [mode, setMode] = useState<"add" | "withdraw">("add");
  const [amount, setAmount] = useState("");
  const maximum = mode === "add" ? Math.max(0, goal.target - goal.current) : goal.current;
  const value = Number(amount || 0);
  return <SimpleModal title={`Atur progress ${goal.name}`} kicker="Goal tracking" saving={saving} onClose={onClose} onSubmit={(event) => { event.preventDefault(); if (value <= 0 || value > maximum) return; return onSubmit(value, mode); }}>
    <div className="transaction-type-tabs"><button type="button" className={mode === "add" ? "active" : ""} onClick={() => { setMode("add"); setAmount(""); }}><Plus size={15} /> Tambah dana</button><button type="button" className={mode === "withdraw" ? "active" : ""} onClick={() => { setMode("withdraw"); setAmount(""); }}><Undo2 size={15} /> Kurangi dana</button></div>
    <div className="reconcile-summary"><span><small>Terkumpul</small><Amount value={goal.current} privacy={privacy} /></span><span><small>{mode === "add" ? "Sisa target" : "Maksimal dikurangi"}</small><Amount value={maximum} privacy={privacy} /></span></div>
    <div className="form-grid"><label className="full-field"><span>Nominal perubahan</span><input value={formatMoneyInput(amount)} onChange={(event) => setAmount(moneyInputDigits(event.target.value))} inputMode="numeric" pattern="[0-9.]*" required autoFocus /></label></div>
    {value > maximum && <div className="ocr-message"><TriangleAlert size={15} />Nominal melebihi batas yang tersedia.</div>}
  </SimpleModal>;
}

const sinkingFundPurposes: SinkingFundPurpose[] = ["Kendaraan", "Pajak", "Liburan", "Pendidikan", "Rumah", "Kesehatan", "Teknologi", "Lainnya"];

function SinkingFundModal({ fund, accounts, funds, saving, onClose, onSubmit }: {
  fund?: SinkingFund;
  accounts: Account[];
  funds: SinkingFund[];
  saving: boolean;
  onClose: () => void;
  onSubmit: (payload: Record<string, unknown>) => Promise<void>;
}) {
  const eligibleAccounts = accounts.filter((account) => !account.liability && ["Bank", "E-Wallet", "Cash", "Deposit"].includes(account.type));
  const defaultTargetDate = new Date(Date.now() + 365 * 86_400_000).toISOString().slice(0, 10);
  const [name, setName] = useState(fund?.name ?? "");
  const [purpose, setPurpose] = useState<SinkingFundPurpose>(fund?.purpose ?? "Kendaraan");
  const [targetAmount, setTargetAmount] = useState(fund ? String(fund.targetAmount) : "");
  const [initialAmount, setInitialAmount] = useState(fund ? String(fund.currentAmount) : "");
  const [monthlyContribution, setMonthlyContribution] = useState(fund?.monthlyContribution ? String(fund.monthlyContribution) : "");
  const [targetDate, setTargetDate] = useState(fund?.targetDate ?? defaultTargetDate);
  const [accountId, setAccountId] = useState(fund?.accountId ?? eligibleAccounts[0]?.id ?? "");
  const [color, setColor] = useState(fund?.color ?? "#16876f");
  const targetValue = moneyInputNumber(targetAmount);
  const currentValue = fund?.currentAmount ?? moneyInputNumber(initialAmount);
  const account = eligibleAccounts.find((item) => item.id === accountId);
  const allocatedElsewhere = funds.filter((item) => item.active && item.id !== fund?.id && item.accountId === accountId).reduce((sum, item) => sum + item.currentAmount, 0);
  const freeOnAccount = Math.max(0, (account?.balance ?? 0) - allocatedElsewhere);
  const invalid = !name.trim() || !accountId || targetValue <= 0 || currentValue > targetValue || currentValue > freeOnAccount;
  return <SimpleModal title={fund ? "Edit pos dana" : "Pos dana baru"} kicker="Sinking fund" saving={saving} onClose={onClose} onSubmit={(event) => { event.preventDefault(); if (invalid) return; return onSubmit({
    name: name.trim(),
    purpose,
    targetAmount: targetValue,
    currentAmount: currentValue,
    monthlyContribution: moneyInputNumber(monthlyContribution),
    targetDate,
    accountId,
    color,
    active: true,
    requestId: `fund-${fund ? "update" : "create"}:${fund?.id ?? crypto.randomUUID()}`,
  }); }}>
    <div className="form-grid sinking-fund-form">
      <label><span>Nama pos</span><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Contoh: Servis besar motor" required autoFocus /></label>
      <label><span>Jenis kebutuhan</span><select value={purpose} onChange={(event) => setPurpose(event.target.value as SinkingFundPurpose)}>{sinkingFundPurposes.map((item) => <option key={item}>{item}</option>)}</select><ChevronDown size={15} /></label>
      <label><span>Target dana</span><input value={formatMoneyInput(targetAmount)} onChange={(event) => setTargetAmount(moneyInputDigits(event.target.value))} inputMode="numeric" pattern="[0-9.]*" required /></label>
      <label><span>Target tersedia</span><input type="date" min={today()} value={targetDate} onChange={(event) => setTargetDate(event.target.value)} required /></label>
      <label><span>Akun tempat dana</span><select value={accountId} onChange={(event) => setAccountId(event.target.value)} required><option value="" disabled>Pilih akun kas</option>{eligibleAccounts.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select><ChevronDown size={15} /><small>Saldo akun tidak dipindahkan.</small></label>
      {!fund && <label><span>Alokasi awal</span><input value={formatMoneyInput(initialAmount)} onChange={(event) => setInitialAmount(moneyInputDigits(event.target.value))} inputMode="numeric" pattern="[0-9.]*" placeholder="Opsional" /><small>Maksimal saldo bebas {formatIDR(freeOnAccount)}.</small></label>}
      <label><span>Rencana per bulan</span><input value={formatMoneyInput(monthlyContribution)} onChange={(event) => setMonthlyContribution(moneyInputDigits(event.target.value))} inputMode="numeric" pattern="[0-9.]*" placeholder="Otomatis jika kosong" /></label>
      <label className="color-field"><span>Warna pos</span><input type="color" value={color} onChange={(event) => setColor(event.target.value)} /><small>{color.toUpperCase()}</small></label>
    </div>
    {currentValue > targetValue && <div className="ocr-message"><TriangleAlert size={15} />Target tidak boleh lebih kecil dari dana yang sudah dialokasikan.</div>}
    {currentValue > freeOnAccount && <div className="ocr-message"><TriangleAlert size={15} />Alokasi melebihi saldo bebas pada akun yang dipilih.</div>}
    {!eligibleAccounts.length && <div className="ocr-message"><WalletCards size={15} />Tambahkan akun Bank, E-Wallet, Cash, atau Deposit terlebih dahulu.</div>}
    <div className="ocr-message"><ShieldCheck size={15} />Pos dana adalah pembagian virtual dari saldo akun, bukan rekening atau transaksi baru.</div>
  </SimpleModal>;
}

function SinkingFundAdjustmentModal({ fund, type, saving, onClose, onSubmit }: {
  fund: SinkingFund;
  type: "allocate" | "release";
  saving: boolean;
  onClose: () => void;
  onSubmit: (amount: number, date: string, note: string) => Promise<void>;
}) {
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(today());
  const [note, setNote] = useState("");
  const value = moneyInputNumber(amount);
  const maximum = type === "allocate" ? sinkingFundRemaining(fund) : fund.currentAmount;
  return <SimpleModal title={type === "allocate" ? `Alokasikan ke ${fund.name}` : `Lepas dari ${fund.name}`} kicker="Pos dana" saving={saving} onClose={onClose} onSubmit={(event) => { event.preventDefault(); if (value <= 0 || value > maximum) return; return onSubmit(value, date, note.trim()); }}>
    <div className="reconcile-summary"><span><small>Sudah dialokasikan</small><strong>{formatIDR(fund.currentAmount)}</strong></span><span><small>{type === "allocate" ? "Sisa target" : "Maksimal dilepas"}</small><strong>{formatIDR(maximum)}</strong></span></div>
    <div className="form-grid">
      <label><span>Nominal</span><input value={formatMoneyInput(amount)} onChange={(event) => setAmount(moneyInputDigits(event.target.value))} inputMode="numeric" pattern="[0-9.]*" required autoFocus /></label>
      <label><span>Tanggal</span><input type="date" max={today()} value={date} onChange={(event) => setDate(event.target.value)} required /></label>
      <label className="full-field"><span>Catatan</span><input value={note} onChange={(event) => setNote(event.target.value)} placeholder={type === "allocate" ? "Contoh: Alokasi gaji bulan ini" : "Contoh: Dipakai untuk servis"} maxLength={240} /></label>
    </div>
    {value > maximum && <div className="ocr-message"><TriangleAlert size={15} />Nominal melebihi batas pos dana.</div>}
    <div className="ocr-message"><CircleDollarSign size={15} />{type === "allocate" ? "Alokasi tidak mengurangi saldo akun." : "Pelepasan tidak membuat transaksi pengeluaran. Catat transaksi saat uang benar-benar digunakan."}</div>
  </SimpleModal>;
}

function RecurringModal({ accounts, categories, saving, onClose, onSubmit }: { accounts: Account[]; categories: FinanceCategory[]; saving: boolean; onClose: () => void; onSubmit: (payload: Omit<RecurringTemplate, "id" | "lastPostedDate" | "updatedAt">) => Promise<void> }) {
  const cashAccounts = accounts.filter((item) => item.type !== "Investment");
  const [type, setType] = useState<"income" | "expense">("expense");
  const relevantCategories = useMemo(() => categories.filter((item) => item.active && item.type === type), [categories, type]);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState(categories.find((item) => item.active && item.type === "expense")?.name ?? "");
  const [accountId, setAccountId] = useState(cashAccounts[0]?.id ?? "");
  const [frequency, setFrequency] = useState<RecurringTemplate["frequency"]>("monthly");
  const [startDate, setStartDate] = useState(today());
  const [isSubscription, setIsSubscription] = useState(false);
  const changeType = (next: "income" | "expense") => { setType(next); setCategory(categories.find((item) => item.active && item.type === next)?.name ?? ""); if (next === "income") setIsSubscription(false); };
  return <SimpleModal title="Jadwal transaksi rutin" kicker="Recurring planner" saving={saving} onClose={onClose} onSubmit={(event) => { event.preventDefault(); return onSubmit({ name: name.trim(), type, amount: Number(amount || 0), category, accountId, frequency, startDate, nextDueDate: startDate, isSubscription: type === "expense" && isSubscription, active: true }); }}>
    <div className="transaction-type-tabs recurring-type-tabs"><button type="button" className={type === "expense" ? "active" : ""} onClick={() => changeType("expense")}><ArrowUpRight size={14}/> Pengeluaran</button><button type="button" className={type === "income" ? "active" : ""} onClick={() => changeType("income")}><ArrowDownLeft size={14}/> Pemasukan</button></div>
    <div className="form-grid recurring-form"><label><span>Nama jadwal</span><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Contoh: Netflix atau Gaji" required autoFocus/></label><label><span>Nominal</span><input value={formatMoneyInput(amount)} onChange={(event) => setAmount(moneyInputDigits(event.target.value))} inputMode="numeric" pattern="[0-9.]*" required/></label><label><span>Kategori</span><select value={category} onChange={(event) => setCategory(event.target.value)} required><option value="" disabled>Pilih kategori</option>{relevantCategories.map((item) => <option value={item.name} key={item.id}>{item.name}</option>)}</select><ChevronDown size={15}/></label><label><span>Akun</span><select value={accountId} onChange={(event) => setAccountId(event.target.value)} required><option value="" disabled>Pilih akun</option>{cashAccounts.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select><ChevronDown size={15}/></label><label><span>Frekuensi</span><select value={frequency} onChange={(event) => setFrequency(event.target.value as RecurringTemplate["frequency"])}><option value="weekly">Mingguan</option><option value="monthly">Bulanan</option><option value="quarterly">3 bulanan</option><option value="yearly">Tahunan</option></select><ChevronDown size={15}/></label><label><span>Tanggal pertama</span><input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} required/></label></div>
    {type === "expense" && <label className="recurring-subscription-check"><input type="checkbox" checked={isSubscription} onChange={(event) => setIsSubscription(event.target.checked)}/><span><strong>Tandai sebagai subscription</strong><small>Masuk perhitungan biaya langganan bulanan dan tahunan.</small></span></label>}
    {!cashAccounts.length && <div className="ocr-message"><WalletCards size={15}/>Tambahkan akun terlebih dahulu.</div>}
  </SimpleModal>;
}

function ReceivableModal({ accounts, saving, onClose, onSubmit }: { accounts: Account[]; saving: boolean; onClose: () => void; onSubmit: (payload: Record<string, unknown>) => Promise<void> }) {
  const cashAccounts = accounts.filter((account) => !account.liability && !["Investment", "Receivable"].includes(account.type));
  const [borrower, setBorrower] = useState("");
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [sourceAccountId, setSourceAccountId] = useState(cashAccounts[0]?.id ?? "");
  const [date, setDate] = useState(today());
  const [dueDate, setDueDate] = useState(today());
  return <SimpleModal title="Catat piutang" kicker="Uang dipinjamkan" saving={saving} onClose={onClose} onSubmit={(event) => { event.preventDefault(); return onSubmit({ borrower: borrower.trim(), name: name.trim(), amount: moneyInputNumber(amount), sourceAccountId, date, dueDate }); }}>
    <div className="form-grid"><label><span>Nama peminjam</span><input value={borrower} onChange={(event) => setBorrower(event.target.value)} placeholder="Contoh: Alvin" required autoFocus/></label><label><span>Nama piutang</span><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Contoh: Pinjaman pribadi" required/></label><label><span>Nominal</span><input value={formatMoneyInput(amount)} onChange={(event) => setAmount(moneyInputDigits(event.target.value))} inputMode="numeric" pattern="[0-9.]*" required/></label><label><span>Sumber dana</span><select value={sourceAccountId} onChange={(event) => setSourceAccountId(event.target.value)} required><option value="" disabled>Pilih akun</option>{cashAccounts.map((account) => <option value={account.id} key={account.id}>{account.name}</option>)}</select><ChevronDown size={15}/></label><label><span>Tanggal diberikan</span><input type="date" value={date} onChange={(event) => setDate(event.target.value)} required/></label><label><span>Jatuh tempo</span><input type="date" min={date} value={dueDate} onChange={(event) => setDueDate(event.target.value)} required/></label></div>
    <div className="ocr-message"><Scale size={15}/>Dana dipindahkan dari kas ke akun piutang. Kekayaan bersih tetap sama.</div>
  </SimpleModal>;
}

function ReceivablePaymentModal({ receivable, accounts, privacy, saving, onClose, onSubmit }: { receivable: Account; accounts: Account[]; privacy: boolean; saving: boolean; onClose: () => void; onSubmit: (destinationAccountId: string, amount: number, date: string) => Promise<void> }) {
  const cashAccounts = accounts.filter((account) => !account.liability && !["Investment", "Receivable"].includes(account.type));
  const [destinationAccountId, setDestinationAccountId] = useState(cashAccounts[0]?.id ?? "");
  const [amount, setAmount] = useState(String(receivable.balance));
  const [date, setDate] = useState(today());
  return <SimpleModal title={`Pembayaran ${receivable.name}`} kicker="Pengembalian piutang" saving={saving} onClose={onClose} onSubmit={(event) => { event.preventDefault(); return onSubmit(destinationAccountId, moneyInputNumber(amount), date); }}>
    <div className="payment-summary-card"><span><small>Sisa piutang</small><strong><Amount value={receivable.balance} privacy={privacy}/></strong></span><span><small>Peminjam</small><strong>{receivable.institution}</strong></span><span><small>Jatuh tempo</small><strong>{shortDate(receivable.mask.replace(/^JT\s*/, ""))}</strong></span></div>
    <div className="form-grid"><label><span>Nominal diterima</span><input value={formatMoneyInput(amount)} onChange={(event) => setAmount(moneyInputDigits(event.target.value))} inputMode="numeric" max={receivable.balance} required/></label><label><span>Masuk ke akun</span><select value={destinationAccountId} onChange={(event) => setDestinationAccountId(event.target.value)} required>{cashAccounts.map((account) => <option value={account.id} key={account.id}>{account.name}</option>)}</select><ChevronDown size={15}/></label><label><span>Tanggal diterima</span><input type="date" value={date} onChange={(event) => setDate(event.target.value)} required/></label></div>
    <div className="ocr-message"><ArrowRight size={15}/>Pembayaran menjadi transfer dari piutang ke kas, bukan pemasukan baru.</div>
  </SimpleModal>;
}

function BillPaymentModal({ bill, privacy, saving, onClose, onSubmit }: { bill: Bill; privacy: boolean; saving: boolean; onClose: () => void; onSubmit: (amount: number, fee: number, settlement: boolean) => Promise<void> }) {
  const currentPaid = bill.currentPeriodPaid ?? 0;
  const regularRemaining = Math.max(0, bill.amount - currentPaid);
  const payoff = remainingInstallmentTotal(bill);
  const [amount, setAmount] = useState(String(regularRemaining || bill.amount));
  const [fee, setFee] = useState("");
  const [settlement, setSettlement] = useState(false);
  const principal = settlement ? Number(payoff ?? regularRemaining) : moneyInputNumber(amount);
  return <SimpleModal title={`Bayar ${bill.name}`} kicker="Pembayaran fleksibel" saving={saving} onClose={onClose} submitLabel={settlement ? "Lunasi sekarang" : "Simpan pembayaran"} onSubmit={(event) => {
    event.preventDefault();
    return onSubmit(principal, moneyInputNumber(fee), settlement);
  }}>
    <div className="payment-summary-card">
      <span><small>Cicilan bulan ini</small><strong><Amount value={bill.amount} privacy={privacy}/></strong></span>
      <span><small>Sudah dibayar sebagian</small><strong><Amount value={currentPaid} privacy={privacy}/></strong></span>
      <span><small>Sisa seluruh kontrak</small><strong>{payoff === null ? "Tanpa tenor" : <Amount value={payoff} privacy={privacy}/>}</strong></span>
    </div>
    <div className="transaction-type-tabs bill-payment-tabs">
      <button type="button" className={!settlement ? "active" : ""} onClick={() => setSettlement(false)}>Bayar sebagian / ekstra</button>
      <button type="button" className={settlement ? "active" : ""} disabled={payoff === null} onClick={() => setSettlement(true)}>Pelunasan dipercepat</button>
    </div>
    <div className="form-grid">
      <label><span>Pokok yang dibayar</span><input value={formatMoneyInput(settlement ? String(payoff ?? 0) : amount)} onChange={(event) => setAmount(moneyInputDigits(event.target.value))} inputMode="numeric" pattern="[0-9.]*" readOnly={settlement} required/><small>Bayar kurang dari tagihan untuk parsial, atau lebih untuk memajukan cicilan berikutnya.</small></label>
      <label><span>Biaya admin / denda</span><input value={formatMoneyInput(fee)} onChange={(event) => setFee(moneyInputDigits(event.target.value))} inputMode="numeric" pattern="[0-9.]*" placeholder="Rp 0"/><small>Dicatat terpisah sebagai Biaya Keuangan.</small></label>
    </div>
    <div className="ocr-message"><Scale size={15}/><span>Pokok mengurangi saldo utang. Biaya admin menjadi pengeluaran, sehingga laporan tidak menghitung pembayaran dua kali.</span></div>
  </SimpleModal>;
}

function BillModal({ bill, accounts, categories, saving, onClose, onSubmit }: { bill?: Bill; accounts: Account[]; categories: FinanceCategory[]; saving: boolean; onClose: () => void; onSubmit: (payload: Record<string, unknown>) => Promise<void> }) {
  const paymentAccounts = accounts.filter((account) => !account.liability && account.type !== "Investment");
  const liabilityAccounts = accounts.filter((account) => account.liability);
  const expenseCategories = categories.filter((item) => item.active && item.type === "expense");
  const [name, setName] = useState(bill?.name ?? "");
  const [amount, setAmount] = useState(bill ? String(bill.amount) : "");
  const [category, setCategory] = useState(bill?.category ?? expenseCategories.find((item) => item.name === "Tagihan")?.name ?? expenseCategories[0]?.name ?? "");
  const [dueDate, setDueDate] = useState(bill?.dueDate ?? today());
  const [accountId, setAccountId] = useState(bill?.accountId ?? paymentAccounts[0]?.id ?? "");
  const [liabilityAccountId, setLiabilityAccountId] = useState(bill?.liabilityAccountId ?? "");
  const [durationMonths, setDurationMonths] = useState(bill?.durationMonths ? String(bill.durationMonths) : "");
  const [paidCount, setPaidCount] = useState(String(bill?.paidCount ?? 0));
  const [reminderDays, setReminderDays] = useState(bill?.reminderDays ?? [7, 3, 1, 0]);
  const [phased, setPhased] = useState(Boolean(bill?.installmentPhases?.length));
  const [phases, setPhases] = useState(() => bill?.installmentPhases?.length
    ? bill.installmentPhases.map((phase) => ({ label: phase.label, durationMonths: String(phase.durationMonths), amount: String(phase.amount) }))
    : [
      { label: "Fase 1 · bunga 0%", durationMonths: "6", amount: bill ? String(bill.amount) : "" },
      { label: "Fase 2 · dengan bunga", durationMonths: "6", amount: bill ? String(bill.amount) : "" },
    ]);
  const parsedPhases = phases.map((phase) => ({
    label: phase.label.trim(),
    durationMonths: Number(phase.durationMonths || 0),
    amount: moneyInputNumber(phase.amount),
  }));
  const phasesValid = parsedPhases.length >= 2 && parsedPhases.every((phase) => phase.label && phase.durationMonths >= 1 && phase.amount > 0);
  const phasedDuration = installmentDuration(parsedPhases);
  const durationValue = phased ? phasedDuration : Number(durationMonths || 0);
  const paidCountValue = Number(paidCount || 0);
  const remainingMonths = durationValue ? Math.max(0, durationValue - paidCountValue) : null;
  const progressPct = durationValue ? Math.min(100, paidCountValue / durationValue * 100) : 0;
  const activePhase = phased && phasesValid ? currentInstallmentPhase({ amount: parsedPhases[0].amount, paidCount: paidCountValue, installmentPhases: parsedPhases }) : null;
  const activeAmount = phased && phasesValid ? installmentAmountAt({ amount: parsedPhases[0].amount, paidCount: paidCountValue, installmentPhases: parsedPhases }) : Number(amount || 0);
  const planTotal = phased && phasesValid ? installmentPlanTotal(parsedPhases) : durationValue * Number(amount || 0);
  const invalidPlan = phased && (!phasesValid || phasedDuration > 120 || paidCountValue > phasedDuration);
  const toggleReminder = (day: number) => setReminderDays((current) => current.includes(day) ? current.filter((item) => item !== day) : [...current, day].sort((a, b) => b - a));
  const updatePhase = (index: number, field: "label" | "durationMonths" | "amount", value: string) => setPhases((current) => current.map((phase, phaseIndex) => phaseIndex === index ? { ...phase, [field]: value } : phase));
  return <SimpleModal title={bill ? "Edit tagihan rutin" : "Tagihan rutin"} kicker="Reminder & cicilan" saving={saving} onClose={onClose} onSubmit={(event) => {
    event.preventDefault();
    if (invalidPlan || (durationValue && paidCountValue > durationValue)) return;
    return onSubmit({
      name: name.trim(),
      amount: activeAmount,
      category,
      dueDate,
      accountId,
      liabilityAccountId: liabilityAccountId || null,
      durationMonths: durationValue || null,
      paidCount: durationValue ? paidCountValue : 0,
      installmentPhases: phased ? parsedPhases : [],
      frequency: "monthly",
      reminderDays,
      ...(bill ? { paid: bill.paid } : {}),
    });
  }}>
    <div className="transaction-type-tabs bill-plan-tabs">
      <button type="button" className={!phased ? "active" : ""} onClick={() => setPhased(false)}>Nominal tetap</button>
      <button type="button" className={phased ? "active" : ""} onClick={() => setPhased(true)}>Cicilan bertahap</button>
    </div>
    <div className="form-grid">
      <label><span>Nama tagihan / cicilan</span><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Contoh: Pinjaman Kredivo" required autoFocus /></label>
      {!phased && <label><span>Nominal per bulan</span><input value={formatMoneyInput(amount)} onChange={(event) => setAmount(moneyInputDigits(event.target.value))} inputMode="numeric" pattern="[0-9.]*" required /></label>}
      <label><span>Kategori</span><select value={category} onChange={(event) => setCategory(event.target.value)} required><option value="" disabled>Pilih kategori</option>{expenseCategories.map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}</select><ChevronDown size={15} /></label>
      <label><span>{paidCountValue > 0 ? "Jatuh tempo berikutnya" : "Jatuh tempo pertama"}</span><input type="date" min={bill ? undefined : today()} value={dueDate} onChange={(event) => setDueDate(event.target.value)} required /></label>
      <label><span>Akun pembayaran</span><select value={accountId} onChange={(event) => setAccountId(event.target.value)} required><option value="" disabled>Pilih akun kas</option>{paymentAccounts.map((account) => <option value={account.id} key={account.id}>{account.name}</option>)}</select><ChevronDown size={15} /></label>
      <label><span>Akun Paylater / utang</span><select value={liabilityAccountId} onChange={(event) => setLiabilityAccountId(event.target.value)}><option value="">Tagihan biasa (bukan cicilan utang)</option>{liabilityAccounts.map((account) => <option value={account.id} key={account.id}>{account.name} · {account.type}</option>)}</select><ChevronDown size={15} /></label>
      {!phased && <label><span>Total tenor (bulan)</span><input type="number" min={1} max={120} value={durationMonths} onChange={(event) => { const next = event.target.value.replace(/\D/g, "").slice(0, 3); setDurationMonths(next); if (!next) setPaidCount("0"); else if (Number(paidCount) > Number(next)) setPaidCount(next); }} inputMode="numeric" placeholder="Contoh: 9" /><small>Kosongkan jika tagihan berulang tanpa batas.</small></label>}
      <label><span>Sudah dibayar</span><input type="number" min={0} max={durationValue || 0} value={paidCount} onChange={(event) => setPaidCount(event.target.value.replace(/\D/g, "").slice(0, 3))} inputMode="numeric" disabled={!durationValue} required={Boolean(durationValue)} /><small>Isi 2 jika sebelumnya sudah membayar dua kali.</small></label>
      <label><span>Frekuensi</span><input value="Bulanan" readOnly aria-label="Frekuensi tagihan bulanan" /></label>
      {phased && <section className="installment-phase-editor full-field">
        <div className="installment-phase-title"><span><strong>Fase cicilan</strong><small>Nominal akan berganti otomatis saat fase berikutnya dimulai.</small></span><button type="button" className="secondary-button" onClick={() => setPhases((current) => [...current, { label: `Fase ${current.length + 1}`, durationMonths: "", amount: "" }])} disabled={phases.length >= 6}><Plus size={14}/> Tambah fase</button></div>
        <div className="installment-phase-list">
          {phases.map((phase, index) => <div className="installment-phase-row" key={index}>
            <span className="installment-phase-number">{index + 1}</span>
            <label><span>Nama fase</span><input value={phase.label} onChange={(event) => updatePhase(index, "label", event.target.value)} placeholder={`Fase ${index + 1}`} required /></label>
            <label><span>Durasi</span><input value={phase.durationMonths} onChange={(event) => updatePhase(index, "durationMonths", event.target.value.replace(/\D/g, "").slice(0, 3))} inputMode="numeric" placeholder="6 bulan" required /></label>
            <label><span>Nominal/bulan</span><input value={formatMoneyInput(phase.amount)} onChange={(event) => updatePhase(index, "amount", moneyInputDigits(event.target.value))} inputMode="numeric" placeholder="Rp 0" required /></label>
            <button type="button" className="icon-button small" aria-label={`Hapus fase ${index + 1}`} onClick={() => setPhases((current) => current.filter((_, phaseIndex) => phaseIndex !== index))} disabled={phases.length <= 2}><Trash2 size={14}/></button>
          </div>)}
        </div>
        <div className="installment-phase-summary">
          <span><small>Total tenor</small><strong>{phasedDuration} bulan</strong></span>
          <span><small>Nominal aktif</small><strong>{formatIDR(activeAmount)}</strong></span>
          <span><small>Total seluruh cicilan</small><strong>{formatIDR(planTotal)}</strong></span>
        </div>
        {activePhase && <div className="installment-active-phase"><CheckCircle2 size={15}/><span><strong>{activePhase.phase.label}</strong> · bulan {activePhase.monthInPhase} dari {activePhase.phase.durationMonths}</span></div>}
      </section>}
      {durationValue > 0 && <div className="bill-progress-preview full-field"><small>Progress cicilan</small><strong>{paidCountValue} dari {durationValue} cicilan sudah dibayar</strong><span>{remainingMonths} bulan tersisa</span><ProgressBar value={progressPct} color="var(--primary)" label={`Progress cicilan ${paidCountValue} dari ${durationValue}`} /></div>}
      <fieldset className="bill-reminder-field"><legend>Jadwal reminder</legend><div className="reminder-day-options">{[7, 3, 1, 0].map((day) => <label key={day}><input type="checkbox" checked={reminderDays.includes(day)} onChange={() => toggleReminder(day)} /><span>{day === 0 ? "Hari H" : `H-${day}`}</span></label>)}</div></fieldset>
    </div>
    {invalidPlan && <div className="ocr-message"><TriangleAlert size={15}/>Minimal dua fase wajib lengkap dan total tenor maksimal 120 bulan.</div>}
    {!reminderDays.length && <div className="ocr-message"><Bell size={15} />Pilih minimal satu jadwal reminder.</div>}
    {!paymentAccounts.length && <div className="ocr-message"><WalletCards size={15} />Tambahkan akun bank, e-wallet, atau cash untuk membayar tagihan.</div>}
    {liabilityAccountId && <div className="ocr-message"><CreditCard size={15} />Pembayaran menjadi transfer ke akun utang, sehingga tidak dihitung sebagai pengeluaran dua kali.</div>}
    {paidCountValue > 0 && <div className="ocr-message bill-history-note"><History size={15} /><span><strong>Progress awal saja.</strong> {paidCountValue} pembayaran lama tidak dibuat ulang sebagai transaksi. Pastikan saldo akun utang saat ini sudah sesuai.</span></div>}
    {!expenseCategories.length && <div className="ocr-message"><Tags size={15} />Tambahkan kategori pengeluaran di Pengaturan terlebih dahulu.</div>}
  </SimpleModal>;
}

function LegacyBillModal({ bill, accounts, categories, saving, onClose, onSubmit }: { bill?: Bill; accounts: Account[]; categories: FinanceCategory[]; saving: boolean; onClose: () => void; onSubmit: (payload: Record<string, unknown>) => Promise<void> }) {
  const paymentAccounts = accounts.filter((account) => !account.liability && account.type !== "Investment");
  const liabilityAccounts = accounts.filter((account) => account.liability);
  const expenseCategories = categories.filter((item) => item.active && item.type === "expense");
  const [name, setName] = useState(bill?.name ?? "");
  const [amount, setAmount] = useState(bill ? String(bill.amount) : "");
  const [category, setCategory] = useState(bill?.category ?? expenseCategories.find((item) => item.name === "Tagihan")?.name ?? expenseCategories[0]?.name ?? "");
  const [dueDate, setDueDate] = useState(bill?.dueDate ?? today());
  const [accountId, setAccountId] = useState(bill?.accountId ?? paymentAccounts[0]?.id ?? "");
  const [liabilityAccountId, setLiabilityAccountId] = useState(bill?.liabilityAccountId ?? "");
  const [durationMonths, setDurationMonths] = useState(bill?.durationMonths ? String(bill.durationMonths) : "");
  const [paidCount, setPaidCount] = useState(String(bill?.paidCount ?? 0));
  const [reminderDays, setReminderDays] = useState(bill?.reminderDays ?? [7, 3, 1, 0]);
  const durationValue = Number(durationMonths || 0);
  const paidCountValue = Number(paidCount || 0);
  const remainingMonths = durationValue ? Math.max(0, durationValue - paidCountValue) : null;
  const progressPct = durationValue ? Math.min(100, paidCountValue / durationValue * 100) : 0;
  const toggleReminder = (day: number) => setReminderDays((current) => current.includes(day) ? current.filter((item) => item !== day) : [...current, day].sort((a, b) => b - a));
  return <SimpleModal title={bill ? "Edit tagihan rutin" : "Tagihan rutin"} kicker="Reminder & cicilan" saving={saving} onClose={onClose} onSubmit={(event) => { event.preventDefault(); if (durationValue && paidCountValue > durationValue) return; return onSubmit({ name: name.trim(), amount: Number(amount || 0), category, dueDate, accountId, liabilityAccountId: liabilityAccountId || null, durationMonths: durationValue || null, paidCount: durationValue ? paidCountValue : 0, frequency: "monthly", reminderDays, ...(bill ? { paid: bill.paid } : {}) }); }}>
    <div className="form-grid">
      <label><span>Nama tagihan / cicilan</span><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Contoh: Cicilan HP" required autoFocus /></label>
      <label><span>Nominal per bulan</span><input value={formatMoneyInput(amount)} onChange={(event) => setAmount(moneyInputDigits(event.target.value))} inputMode="numeric" pattern="[0-9.]*" required /></label>
      <label><span>Kategori</span><select value={category} onChange={(event) => setCategory(event.target.value)} required><option value="" disabled>Pilih kategori</option>{expenseCategories.map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}</select><ChevronDown size={15} /></label>
      <label><span>{paidCountValue > 0 ? "Jatuh tempo berikutnya" : "Jatuh tempo pertama"}</span><input type="date" min={bill ? undefined : today()} value={dueDate} onChange={(event) => setDueDate(event.target.value)} required /></label>
      <label><span>Akun pembayaran</span><select value={accountId} onChange={(event) => setAccountId(event.target.value)} required><option value="" disabled>Pilih akun kas</option>{paymentAccounts.map((account) => <option value={account.id} key={account.id}>{account.name}</option>)}</select><ChevronDown size={15} /></label>
      <label><span>Akun Paylater / utang</span><select value={liabilityAccountId} onChange={(event) => setLiabilityAccountId(event.target.value)}><option value="">Tagihan biasa (bukan cicilan utang)</option>{liabilityAccounts.map((account) => <option value={account.id} key={account.id}>{account.name} · {account.type}</option>)}</select><ChevronDown size={15} /></label>
      <label><span>Total tenor (bulan)</span><input type="number" min={1} max={120} value={durationMonths} onChange={(event) => { const next = event.target.value.replace(/\D/g, "").slice(0, 3); setDurationMonths(next); if (!next) setPaidCount("0"); else if (Number(paidCount) > Number(next)) setPaidCount(next); }} inputMode="numeric" placeholder="Contoh: 9" /><small>Kosongkan jika tagihan berulang tanpa batas.</small></label>
      <label><span>Sudah dibayar</span><input type="number" min={0} max={durationValue || 0} value={paidCount} onChange={(event) => setPaidCount(event.target.value.replace(/\D/g, "").slice(0, 3))} inputMode="numeric" disabled={!durationValue} required={Boolean(durationValue)} /><small>Isi 2 jika sebelumnya sudah membayar dua kali.</small></label>
      <label><span>Frekuensi</span><input value="Bulanan" readOnly aria-label="Frekuensi tagihan bulanan" /></label>
      {durationValue > 0 && <div className="bill-progress-preview full-field"><small>Progress cicilan</small><strong>{paidCountValue} dari {durationValue} cicilan sudah dibayar</strong><span>{remainingMonths} bulan tersisa</span><ProgressBar value={progressPct} color="var(--primary)" label={`Progress cicilan ${paidCountValue} dari ${durationValue}`} /></div>}
      <fieldset className="bill-reminder-field"><legend>Jadwal reminder</legend><div className="reminder-day-options">{[7, 3, 1, 0].map((day) => <label key={day}><input type="checkbox" checked={reminderDays.includes(day)} onChange={() => toggleReminder(day)} /><span>{day === 0 ? "Hari H" : `H-${day}`}</span></label>)}</div></fieldset>
    </div>
    {!reminderDays.length && <div className="ocr-message"><Bell size={15} />Pilih minimal satu jadwal reminder.</div>}
    {!paymentAccounts.length && <div className="ocr-message"><WalletCards size={15} />Tambahkan akun bank, e-wallet, atau cash untuk membayar tagihan.</div>}
    {liabilityAccountId && <div className="ocr-message"><CreditCard size={15} />Pembayaran menjadi transfer ke akun utang, sehingga tidak dihitung sebagai pengeluaran dua kali.</div>}
    {paidCountValue > 0 && <div className="ocr-message bill-history-note"><History size={15} /><span><strong>Progress awal saja.</strong> {paidCountValue} pembayaran lama tidak dibuat ulang sebagai transaksi. Pastikan saldo akun utang saat ini sudah sesuai.</span></div>}
    {!expenseCategories.length && <div className="ocr-message"><Tags size={15} />Tambahkan kategori pengeluaran di Pengaturan terlebih dahulu.</div>}
  </SimpleModal>;
}

const investmentAssetClasses: InvestmentAsset["assetClass"][] = ["Saham", "ETF", "Reksadana", "Kripto", "Deposito", "Emas", "Obligasi", "Properti", "Custom"];

function InvestmentAssetModal({ asset, accounts, saving, onClose, onSubmit }: {
  asset?: InvestmentAsset;
  accounts: Account[];
  saving: boolean;
  onClose: () => void;
  onSubmit: (payload: Record<string, unknown>, requestId: string) => Promise<void>;
}) {
  const investmentAccounts = accounts.filter((account) => account.type === "Investment" && !account.liability);
  const [accountId, setAccountId] = useState(asset?.accountId ?? investmentAccounts[0]?.id ?? "");
  const [ticker, setTicker] = useState(asset?.ticker ?? "");
  const [name, setName] = useState(asset?.name ?? "");
  const [assetClass, setAssetClass] = useState<InvestmentAsset["assetClass"]>(asset?.assetClass ?? "Saham");
  const [exchange, setExchange] = useState(asset?.exchange ?? "");
  const [manualPrice, setManualPrice] = useState(asset?.marketPrice ? String(asset.marketPrice) : "");
  const [active, setActive] = useState(asset?.active ?? true);
  const [requestId] = useState(() => `investment-asset-${asset ? "update" : "create"}:${asset?.id ?? "new"}:${crypto.randomUUID()}`);
  return <SimpleModal title={asset ? "Edit aset investasi" : "Aset investasi baru"} kicker="Asset master" saving={saving} onClose={onClose} onSubmit={(event) => { event.preventDefault(); if (!investmentAccounts.length) return; return onSubmit({ accountId, ticker: ticker.trim().toUpperCase(), name: name.trim(), assetClass, exchange: exchange.trim(), currency: "IDR", manualPrice: manualPrice ? Number(manualPrice) : null, active }, requestId); }}>
    <div className="form-grid"><label><span>Kode / ticker</span><input value={ticker} onChange={(event) => setTicker(event.target.value.replace(/[^a-zA-Z0-9._-]/g, "").toUpperCase())} placeholder="BBCA" maxLength={24} required autoFocus /></label><label><span>Nama aset</span><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Bank Central Asia" required /></label><label><span>Kelas aset</span><select value={assetClass} onChange={(event) => setAssetClass(event.target.value as InvestmentAsset["assetClass"])}>{investmentAssetClasses.map((item) => <option key={item}>{item}</option>)}</select><ChevronDown size={15} /></label><label><span>Bursa / sumber</span><input value={exchange} onChange={(event) => setExchange(event.target.value)} placeholder="IDX, Binance, Bibit…" /></label><label><span>Akun investasi</span><select value={accountId} disabled={Boolean(asset && asset.units > 0)} onChange={(event) => setAccountId(event.target.value)} required><option value="" disabled>Pilih akun Investment</option>{investmentAccounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select><ChevronDown size={15} /></label><label><span>Harga manual (IDR)</span><input value={formatMoneyInput(manualPrice)} onChange={(event) => setManualPrice(moneyInputDigits(event.target.value))} inputMode="numeric" placeholder="Opsional" /></label>{asset && <label><span>Status aset</span><select value={active ? "active" : "archived"} onChange={(event) => setActive(event.target.value === "active")}><option value="active">Aktif</option><option value="archived" disabled={asset.units > 0}>Arsipkan</option></select><ChevronDown size={15} /></label>}</div>
    {!investmentAccounts.length && <div className="ocr-message"><WalletCards size={15} />Tambahkan akun bertipe Investment pada halaman Akun sebelum membuat aset.</div>}
    <div className="ocr-message"><CircleDollarSign size={15} />Harga manual tidak mengubah cashflow atau histori transaksi. Jika kosong, harga transaksi terakhir dipakai sebagai fallback delayed.</div>
  </SimpleModal>;
}

function InvestmentTradeModal({ type, initialAsset, assets, accounts, privacy, saving, onClose, onSubmit }: {
  type: "buy" | "sell";
  initialAsset?: InvestmentAsset;
  assets: InvestmentAsset[];
  accounts: Account[];
  privacy: boolean;
  saving: boolean;
  onClose: () => void;
  onSubmit: (payload: Record<string, unknown>, requestId: string) => Promise<void>;
}) {
  const tradableAssets = type === "sell" ? assets.filter((asset) => asset.units > 0) : assets;
  const cashAccounts = accounts.filter((account) => !account.liability && account.type !== "Investment");
  const firstAsset = initialAsset ?? tradableAssets[0];
  const [assetId, setAssetId] = useState(firstAsset?.id ?? "");
  const [accountId, setAccountId] = useState(cashAccounts[0]?.id ?? "");
  const [mode, setMode] = useState<"units" | "nominal" | "all">("units");
  const [unitsInput, setUnitsInput] = useState("");
  const [nominalInput, setNominalInput] = useState("");
  const [priceInput, setPriceInput] = useState(String(firstAsset?.marketPrice || firstAsset?.averageCost || ""));
  const [feeInput, setFeeInput] = useState("0");
  const [taxInput, setTaxInput] = useState("0");
  const [date, setDate] = useState(today());
  const [note, setNote] = useState("");
  const [requestId] = useState(() => `investment-${type}:${crypto.randomUUID()}`);
  const selected = assets.find((asset) => asset.id === assetId);
  const price = Number(priceInput || 0);
  const fee = Number(feeInput || 0);
  const tax = Number(taxInput || 0);
  const normalizedUnits = Number(unitsInput.replace(",", ".") || 0);
  const nominal = Number(nominalInput || 0);
  const units = mode === "all" && selected
    ? selected.units
    : mode === "nominal" && price > 0
      ? Math.max(0, (type === "buy" ? nominal - fee - tax : nominal + fee + tax) / price)
      : normalizedUnits;
  const safeUnits = Number(units.toFixed(8));
  const gross = Math.round(safeUnits * price);
  const net = type === "buy" ? gross + fee + tax : gross - fee - tax;
  const costBasisSold = type === "sell" && selected?.units
    ? (safeUnits >= selected.units ? selected.costBasis : Math.round(selected.costBasis * safeUnits / selected.units))
    : 0;
  const realized = type === "sell" ? net - costBasisSold : 0;
  const invalidUnits = !selected || safeUnits <= 0 || (type === "sell" && safeUnits > selected.units + 0.000000001);
  return <SimpleModal title={`${type === "buy" ? "Beli" : "Jual"} investasi`} kicker="Transaksi investasi" saving={saving} onClose={onClose} onSubmit={(event) => { event.preventDefault(); if (invalidUnits || net <= 0 || price <= 0 || !accountId) return; return onSubmit({ type, assetId, accountId, date, units: safeUnits, pricePerUnit: price, fee, tax, note: note.trim() }, requestId); }}>
    <div className="transaction-type-tabs investment-mode-tabs"><button type="button" className={mode === "units" ? "active" : ""} onClick={() => setMode("units")}>Berdasarkan unit</button><button type="button" className={mode === "nominal" ? "active" : ""} onClick={() => setMode("nominal")}>{type === "buy" ? "Budget nominal" : "Target pencairan"}</button>{type === "sell" && <button type="button" className={mode === "all" ? "active" : ""} onClick={() => setMode("all")}>Jual semua</button>}</div>
    <div className="form-grid investment-form-grid"><label><span>Aset</span><select value={assetId} onChange={(event) => { const next = assets.find((asset) => asset.id === event.target.value); setAssetId(event.target.value); setPriceInput(String(next?.marketPrice || next?.averageCost || "")); }} required><option value="" disabled>Pilih aset</option>{tradableAssets.map((asset) => <option key={asset.id} value={asset.id}>{asset.ticker} · {asset.name}</option>)}</select><ChevronDown size={15} /></label><label><span>{type === "buy" ? "Akun pembayaran" : "Akun penerima"}</span><select value={accountId} onChange={(event) => setAccountId(event.target.value)} required><option value="" disabled>Pilih akun kas</option>{cashAccounts.map((account) => <option key={account.id} value={account.id}>{account.name} · {privacy ? "saldo disembunyikan" : formatIDR(account.balance)}</option>)}</select><ChevronDown size={15} /></label><label><span>Harga per unit</span><input value={formatMoneyInput(priceInput)} onChange={(event) => setPriceInput(moneyInputDigits(event.target.value))} inputMode="numeric" required /></label><label><span>Tanggal</span><input type="date" value={date} max={today()} onChange={(event) => setDate(event.target.value)} required /></label>{mode === "units" && <label><span>Jumlah unit</span><input value={unitsInput} onChange={(event) => setUnitsInput(event.target.value.replace(/[^\d.,]/g, ""))} inputMode="decimal" placeholder="0,00000000" required /></label>}{mode === "nominal" && <label><span>{type === "buy" ? "Total budget" : "Target bersih"}</span><input value={formatMoneyInput(nominalInput)} onChange={(event) => setNominalInput(moneyInputDigits(event.target.value))} inputMode="numeric" required /></label>}{mode === "all" && <label><span>Unit dijual</span><input value={selected ? formatUnits(selected.units) : "0"} readOnly /></label>}<label><span>Fee</span><input value={formatMoneyInput(feeInput)} onChange={(event) => setFeeInput(moneyInputDigits(event.target.value))} inputMode="numeric" /></label><label><span>Pajak</span><input value={formatMoneyInput(taxInput)} onChange={(event) => setTaxInput(moneyInputDigits(event.target.value))} inputMode="numeric" /></label><label className="full-field"><span>Catatan</span><input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Opsional" /></label></div>
    <div className={`investment-preview ${type === "sell" && realized < 0 ? "loss" : ""}`}><span><small>Unit</small><strong>{formatUnits(safeUnits || 0)}</strong></span><span><small>{type === "buy" ? "Total pembelian" : "Hasil bersih"}</small><Amount value={Math.max(0, net)} privacy={privacy} /></span>{type === "sell" && <span><small>Estimasi realized P/L</small><Amount value={realized} privacy={privacy} /></span>}</div>
    {invalidUnits && safeUnits > 0 && <div className="ocr-message"><Scale size={15} />Unit penjualan melebihi unit tersedia.</div>}
    {!cashAccounts.length && <div className="ocr-message"><WalletCards size={15} />Tambahkan akun Bank, E-Wallet, atau Cash terlebih dahulu.</div>}
  </SimpleModal>;
}

function ReconcileModal({ account, privacy, saving, onClose, onSubmit }: { account: Account; privacy: boolean; saving: boolean; onClose: () => void; onSubmit: (actualBalance: number, date: string, note: string, requestId: string) => Promise<void> }) {
  const [actualBalance, setActualBalance] = useState(String(Math.max(0, account.balance)));
  const [date, setDate] = useState(today());
  const [note, setNote] = useState("");
  const [requestId] = useState(() => `reconcile:${account.id}:${crypto.randomUUID()}`);
  const actual = Number(actualBalance || 0);
  const difference = actual - account.balance;
  const direction = difference === 0
    ? "Saldo sudah cocok; tidak ada transaksi penyesuaian yang dibuat."
    : account.liability
      ? difference > 0 ? "Utang aktual lebih tinggi dari ledger." : "Utang aktual lebih rendah dari ledger."
      : difference > 0 ? "Saldo aktual lebih tinggi dari ledger." : "Saldo aktual lebih rendah dari ledger.";
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className="modal compact-modal" role="dialog" aria-modal="true" aria-labelledby="reconcile-title"><div className="modal-head"><div><span className="card-kicker">Rekonsiliasi</span><h2 id="reconcile-title">Cocokkan saldo {account.name}</h2></div><button className="icon-button" onClick={onClose} aria-label="Tutup"><X size={20} /></button></div><form onSubmit={(event) => { event.preventDefault(); return onSubmit(actual, date, note.trim(), requestId); }}>
    <div className="reconcile-summary"><span><small>Saldo ledger</small><Amount value={account.balance} privacy={privacy} /></span><span><small>Selisih</small><Amount value={Math.abs(difference)} privacy={privacy} className={difference === 0 ? "" : "reconcile-difference"} /></span></div>
    <div className="form-grid"><label><span>Saldo aktual</span><input value={formatMoneyInput(actualBalance)} onChange={(event) => setActualBalance(moneyInputDigits(event.target.value))} inputMode="numeric" pattern="[0-9.]*" required autoFocus /></label><label><span>Tanggal saldo</span><input type="date" value={date} max={today()} onChange={(event) => setDate(event.target.value)} required /></label><label className="full-field"><span>Alasan / catatan</span><input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Contoh: Cocokkan dengan mutasi rekening" required /></label></div>
    <div className={`reconcile-preview ${difference === 0 ? "matched" : ""}`}><Scale size={17} /><span><strong>{direction}</strong><small>Sistem membuat transaksi penyesuaian; saldo akun tidak diedit langsung.</small></span></div>
    <div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose} disabled={saving}>Batal</button><button className="primary-button" disabled={saving || !note.trim()}><Scale size={17} /> {saving ? "Mencocokkan…" : difference === 0 ? "Konfirmasi saldo cocok" : `Buat penyesuaian ${privacy ? "" : formatIDR(Math.abs(difference))}`}</button></div>
  </form></section></div>;
}

function CategoryModal({ category, saving, onClose, onSubmit }: { category?: FinanceCategory; saving: boolean; onClose: () => void; onSubmit: (payload: { name: string; type: "income" | "expense"; color: string }, requestId: string) => Promise<void> }) {
  const [name, setName] = useState(category?.name ?? "");
  const [type, setType] = useState<"income" | "expense">(category?.type === "income" ? "income" : "expense");
  const [color, setColor] = useState(category?.color ?? "#126b59");
  const [requestId] = useState(() => `category-${category ? "update" : "create"}:${category?.id ?? "new"}:${crypto.randomUUID()}`);
  return <SimpleModal title={category ? "Edit kategori" : "Kategori baru"} kicker="Kategori transaksi" saving={saving} onClose={onClose} onSubmit={(event) => { event.preventDefault(); return onSubmit({ name: name.trim(), type, color }, requestId); }}>
    <div className="form-grid"><label><span>Nama kategori</span><input value={name} maxLength={60} onChange={(event) => setName(event.target.value)} placeholder="Contoh: Operasional" required autoFocus /></label><label><span>Jenis</span><select value={type} disabled={category?.isDefault} onChange={(event) => setType(event.target.value as "income" | "expense")}><option value="expense">Pengeluaran</option><option value="income">Pemasukan</option></select><ChevronDown size={15} /></label><label className="color-field"><span>Warna</span><input type="color" value={color} onChange={(event) => setColor(event.target.value)} /><small>{color.toUpperCase()}</small></label></div>
    {category?.isDefault && <div className="ocr-message"><ShieldCheck size={15} />Jenis kategori bawaan dikunci agar histori tetap konsisten.</div>}
  </SimpleModal>;
}

function CategoryRuleModal({ rule, categories, saving, onClose, onSubmit }: {
  rule?: CategoryRule;
  categories: FinanceCategory[];
  saving: boolean;
  onClose: () => void;
  onSubmit: (payload: Omit<CategoryRule, "id" | "createdAt" | "updatedAt">) => Promise<void>;
}) {
  const [keyword, setKeyword] = useState(rule?.keyword ?? "");
  const [transactionType, setTransactionType] = useState<"expense" | "income">(rule?.transactionType ?? "expense");
  const availableCategories = categories.filter((category) => category.active && category.type === transactionType);
  const [category, setCategory] = useState(rule?.category ?? "");
  const [matchType, setMatchType] = useState<CategoryRule["matchType"]>(rule?.matchType ?? "contains");
  const [priority, setPriority] = useState(String(rule?.priority ?? 100));
  const [active, setActive] = useState(rule?.active ?? true);
  const selectedCategory = availableCategories.some((item) => item.name === category) ? category : availableCategories[0]?.name ?? "";
  return <SimpleModal title={rule ? "Edit aturan kategori" : "Aturan kategori baru"} kicker="Otomatisasi impor CSV" saving={saving} onClose={onClose} onSubmit={(event) => {
    event.preventDefault();
    return onSubmit({ keyword: keyword.trim(), category: selectedCategory, transactionType, matchType, priority: Number(priority || 100), active });
  }}>
    <div className="category-rule-example"><Sparkles size={17} /><span>Jika deskripsi transaksi cocok dengan <strong>{keyword.trim() || "kata kunci"}</strong>, gunakan kategori <strong>{selectedCategory || "yang dipilih"}</strong>.</span></div>
    <div className="form-grid">
      <label><span>Kata kunci merchant / keterangan</span><input value={keyword} minLength={2} maxLength={80} onChange={(event) => setKeyword(event.target.value)} placeholder="Contoh: Indomaret" required autoFocus /></label>
      <label><span>Jenis transaksi</span><select value={transactionType} onChange={(event) => { setTransactionType(event.target.value as "expense" | "income"); setCategory(""); }}><option value="expense">Pengeluaran</option><option value="income">Pemasukan</option></select><ChevronDown size={15} /></label>
      <label><span>Kategori tujuan</span><select value={selectedCategory} onChange={(event) => setCategory(event.target.value)} required><option value="" disabled>Pilih kategori</option>{availableCategories.map((item) => <option value={item.name} key={item.id}>{item.name}</option>)}</select><ChevronDown size={15} /></label>
      <label><span>Cara mencocokkan</span><select value={matchType} onChange={(event) => setMatchType(event.target.value as CategoryRule["matchType"])}><option value="contains">Mengandung kata kunci</option><option value="starts_with">Diawali kata kunci</option><option value="exact">Sama persis</option></select><ChevronDown size={15} /></label>
      <label><span>Prioritas</span><input value={priority} onChange={(event) => setPriority(event.target.value.replace(/\D/g, "").slice(0, 4))} inputMode="numeric" min="0" max="1000" required /><small>Angka lebih besar dijalankan lebih dulu.</small></label>
      <label className="category-rule-active"><span>Status aturan</span><button type="button" className={`switch ${active ? "on" : ""}`} onClick={() => setActive(!active)} aria-pressed={active}><span /></button><small>{active ? "Aktif saat impor" : "Disimpan tetapi tidak dijalankan"}</small></label>
    </div>
    {!availableCategories.length && <div className="ocr-message"><Tags size={15} />Tambahkan kategori {transactionType === "income" ? "pemasukan" : "pengeluaran"} terlebih dahulu.</div>}
  </SimpleModal>;
}

function SimpleModal({ title, kicker, saving, onClose, onSubmit, children, submitLabel = "Simpan" }: { title: string; kicker: string; saving: boolean; onClose: () => void; onSubmit: (event: FormEvent) => void | Promise<void>; children: React.ReactNode; submitLabel?: string }) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className="modal compact-modal" role="dialog" aria-modal="true"><div className="modal-head"><div><span className="card-kicker">{kicker}</span><h2>{title}</h2></div><button className="icon-button" onClick={onClose} aria-label="Tutup"><X size={20} /></button></div><form onSubmit={onSubmit}>{children}<div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose} disabled={saving}>Batal</button><button className="primary-button" disabled={saving}><Check size={17} /> {saving ? "Menyimpan…" : submitLabel}</button></div></form></section></div>;
}
