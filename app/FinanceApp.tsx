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
  Menu,
  Moon,
  MoreHorizontal,
  Paperclip,
  Pencil,
  Plus,
  ReceiptText,
  Route,
  Search,
  Send,
  Settings,
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
import { accountCsvTemplate, previewAccountCsv, type AccountImportItem, type AccountImportPreview } from "../lib/account-import";
import { previewTransactionCsv, transactionCsvTemplate, type TransactionImportPreview } from "../lib/transaction-import";
import { byteArrayToBase64, type BackupOverview, type ExportRecord, type MigrationPreview } from "../lib/portability";
import { DEFAULT_NOTIFICATION_SETTINGS, type FinanceNotification, type NotificationOverview, type NotificationSettings } from "../lib/notifications";
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
} from "../lib/finance";
import {
  FinanceProfile,
  SetupWorkspaceInput,
  askFinanceAi,
  archiveFinanceAccount,
  archiveFinanceCategory,
  clearFinanceAiMessages,
  contributeFinanceGoal,
  createFinanceAccount,
  createFinanceBackup,
  createFinanceBill,
  createFinanceCategory,
  createFinanceGoal,
  createFinanceInvestmentAsset,
  createFinanceInvestmentTrade,
  createFinanceTransaction,
  deleteFinanceTransaction,
  deleteFinanceTransactionReceipt,
  financeBackendLabel,
  getFinanceAiSettings,
  loadFinanceBackups,
  loadFinanceMigrations,
  loadFinanceLedgerHealth,
  loadFinanceNotifications,
  loadFinanceRoadmapSettings,
  loadFinanceDebtPlanner,
  loadFinanceCashflowForecastSettings,
  loadFinanceReports,
  loadFinanceSnapshot,
  loadFinanceTransactions,
  loadFinanceAiMessages,
  markFinanceBillPaid,
  importFinanceTransactions,
  importFinanceAccounts,
  reconcileFinanceAccount,
  repairFinanceLedger,
  setupFinanceWorkspace,
  scanFinanceReceipt,
  saveFinanceReport,
  updateFinanceCategory,
  updateFinanceBackupSchedule,
  updateFinanceAiSettings,
  updateFinanceInvestmentAsset,
  updateFinanceNotificationSettings,
  updateFinanceNotificationStates,
  updateFinanceProfile,
  updateFinanceRoadmapSettings,
  updateFinanceDebtPlannerSettings,
  upsertFinanceDebtPlan,
  updateFinanceCashflowForecastSettings,
  updateFinanceTransaction,
  undoLastFinanceTransactionAction,
  uploadFinanceTransactionReceipt,
  financeTransactionReceiptUrl,
  upsertFinanceBudget,
  previewFinanceMigration,
  applyFinanceMigration,
  cancelFinanceMigration,
} from "../lib/finance-client";

type PageKey =
  | "dashboard"
  | "roadmap"
  | "forecast"
  | "debts"
  | "transactions"
  | "accounts"
  | "budgets"
  | "goals"
  | "bills"
  | "investments"
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

const navPrimary: { key: PageKey; label: string; icon: LucideIcon }[] = [
  { key: "dashboard", label: "Ringkasan", icon: LayoutDashboard },
  { key: "roadmap", label: "Roadmap", icon: Route },
  { key: "forecast", label: "Cashflow Forecast", icon: Activity },
  { key: "transactions", label: "Transaksi", icon: ReceiptText },
  { key: "accounts", label: "Akun", icon: WalletCards },
  { key: "budgets", label: "Anggaran", icon: BarChart3 },
  { key: "goals", label: "Target", icon: Target },
  { key: "bills", label: "Tagihan", icon: CalendarDays },
  { key: "debts", label: "Pelunasan Utang", icon: TrendingDown },
  { key: "investments", label: "Investasi", icon: TrendingUp },
];

const navSecondary: { key: PageKey; label: string; icon: LucideIcon }[] = [
  { key: "reports", label: "Laporan", icon: FileText },
  { key: "assistant", label: "Insight", icon: Sparkles },
  { key: "settings", label: "Pengaturan", icon: Settings },
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
  transactions: { eyebrow: "Ledger utama", title: "Semua transaksi", subtitle: "Pantau setiap pergerakan uang tanpa menghitung transfer dua kali." },
  accounts: { eyebrow: "6 akun aktif", title: "Akun & saldo", subtitle: "Semua rekening, dompet, kewajiban, dan investasi dalam satu tampilan." },
  budgets: { eyebrow: "Rencana Juli", title: "Anggaran bulanan", subtitle: "Kendalikan pengeluaran sebelum melewati batas yang kamu tentukan." },
  goals: { eyebrow: "3 target aktif", title: "Target finansial", subtitle: "Lihat kemajuan dan kebutuhan kontribusi bulanan untuk setiap tujuan." },
  bills: { eyebrow: "3 menunggu", title: "Tagihan rutin", subtitle: "Jangan lewatkan jatuh tempo dan hindari pencatatan ganda." },
  debts: { eyebrow: "Strategi pelunasan", title: "Debt Payoff Planner", subtitle: "Bandingkan metode avalanche dan snowball, lalu lihat kapan kamu bisa bebas utang." },
  investments: { eyebrow: "Portofolio", title: "Portofolio investasi", subtitle: "Pantau unit, cost basis, harga, dan profit/loss tanpa mengubah arus kas operasional." },
  reports: { eyebrow: "Laporan bulanan", title: "Laporan keuangan", subtitle: "Ringkasan siap cetak dengan data yang dapat ditelusuri kembali." },
  assistant: { eyebrow: "Gemini · read-only", title: "Financial Insight", subtitle: "Tanyakan kondisi keuanganmu dengan konteks terpilih dan kontrol privasi yang jelas." },
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

function NavButton({ item, active, onClick }: { item: { key: PageKey; label: string; icon: LucideIcon }; active: boolean; onClick: () => void }) {
  const Icon = item.icon;
  return (
    <button className={`nav-item ${active ? "active" : ""}`} onClick={onClick} aria-current={active ? "page" : undefined}>
      <Icon size={19} strokeWidth={active ? 2.4 : 1.8} />
      <span>{item.label}</span>
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
  const [bills, setBills] = useState<Bill[]>([]);
  const [categories, setCategories] = useState<FinanceCategory[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [investmentAssets, setInvestmentAssets] = useState<InvestmentAsset[]>([]);
  const [investmentTransactions, setInvestmentTransactions] = useState<InvestmentTransaction[]>([]);
  const [notificationOverview, setNotificationOverview] = useState<NotificationOverview | null>(null);
  const [profile, setProfile] = useState<FinanceProfile>({ name: "Vinn", storeName: "Financial Planner", currency: "IDR", timezone: "Asia/Jakarta" });
  const [configured, setConfigured] = useState(false);
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
  const [accountOpen, setAccountOpen] = useState(false);
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [goalOpen, setGoalOpen] = useState(false);
  const [billOpen, setBillOpen] = useState(false);
  const [investmentAssetModal, setInvestmentAssetModal] = useState<{ asset?: InvestmentAsset } | null>(null);
  const [investmentTradeModal, setInvestmentTradeModal] = useState<{ type: "buy" | "sell"; asset?: InvestmentAsset } | null>(null);
  const [transactionQuery, setTransactionQuery] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const month = currentMonth();

  const applySnapshot = (snapshot: Awaited<ReturnType<typeof loadFinanceSnapshot>>) => {
    setConfigured(snapshot.configured);
    setProfile(snapshot.profile);
    setAccounts(snapshot.accounts);
    setTransactions(snapshot.transactions);
    setBudgets(snapshot.budgets);
    setGoals(snapshot.goals);
    setBills(snapshot.bills);
    setCategories(snapshot.categories);
    setAuditLogs(snapshot.auditLogs);
    setInvestmentAssets(snapshot.investmentAssets);
    setInvestmentTransactions(snapshot.investmentTransactions);
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

  const selectPage = (page: PageKey) => {
    setActivePage(page);
    setSidebarOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const runMutation = async (work: () => Promise<unknown>, successMessage: string) => {
    if (saving) return false;
    setSaving(true);
    try {
      await work();
      try {
        await refreshData();
        setDataError(null);
        showToast(successMessage);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Data terbaru belum dapat dimuat.";
        setDataError(message);
        showToast("Perubahan tersimpan; muat ulang data untuk melihat hasil terbaru.");
      }
      return true;
    } catch (error) {
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

  const undoLastTransaction = async () => runMutation(
    () => undoLastFinanceTransactionAction(),
    "Aksi transaksi terakhir berhasil dibatalkan.",
  );

  const payBill = async (bill: Bill) => {
    if (bill.paid) return;
    if (bill.category === "Kewajiban") {
      showToast("Gunakan Tambah transaksi > Transfer ke akun kartu kredit agar pembayaran tidak menjadi pengeluaran ganda.");
      return;
    }
    await runMutation(
      () => markFinanceBillPaid(bill, month, today()),
      `${bill.name} dibayar dan dicatat sebagai pengeluaran.`,
    );
  };

  const contributeGoal = async (goal: Goal) => {
    const contribution = Math.min(500_000, goal.target - goal.current);
    if (contribution <= 0) return;
    await runMutation(() => contributeFinanceGoal(goal.id, contribution), `Progress ${goal.name} bertambah ${formatIDR(contribution)}.`);
  };

  const deleteTransaction = async (transaction: Transaction) => {
    await runMutation(() => deleteFinanceTransaction(transaction.id, transaction.updatedAt), "Transaksi dipindahkan ke Trash.");
  };

  const archiveAccount = async (accountId: string) => {
    await runMutation(() => archiveFinanceAccount(accountId), "Akun berhasil diarsipkan.");
  };

  const reconcileAccount = async (account: Account, actualBalance: number, date: string, note: string, requestId: string) => runMutation(
    () => reconcileFinanceAccount(account.id, actualBalance, date, note, requestId),
    actualBalance === account.balance ? "Saldo akun sudah cocok." : "Saldo berhasil direkonsiliasi dan jejak penyesuaian dibuat.",
  );

  const saveCategory = async (payload: { name: string; type: "income" | "expense"; color: string }, category?: FinanceCategory, requestId?: string) => runMutation(
    () => category
      ? updateFinanceCategory(category.id, payload, requestId)
      : createFinanceCategory(payload, requestId),
    category ? "Kategori berhasil diperbarui." : "Kategori baru berhasil dibuat.",
  );

  const archiveCategory = async (categoryId: string) => {
    await runMutation(() => archiveFinanceCategory(categoryId), "Kategori berhasil diarsipkan.");
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

  const openCreateForPage = () => {
    if (activePage === "accounts") return setAccountOpen(true);
    if (activePage === "budgets") return setBudgetOpen(true);
    if (activePage === "goals") return setGoalOpen(true);
    if (activePage === "bills") return setBillOpen(true);
    if (activePage === "investments") return setInvestmentAssetModal({});
    setTransactionOpen(true);
  };

  const createLabel = activePage === "accounts" ? "Tambah akun" : activePage === "budgets" ? "Tambah anggaran" : activePage === "goals" ? "Buat target" : activePage === "bills" ? "Tambah tagihan" : activePage === "investments" ? "Tambah aset" : "Tambah transaksi";
  const notifications = notificationOverview?.notifications ?? [];
  const unreadNotifications = notificationOverview?.unreadCount ?? 0;

  const title = { ...pageTitles[activePage] };
  if (activePage === "dashboard") { title.eyebrow = monthLabel(month); title.title = `Selamat datang, ${profile.name}`; }
  if (activePage === "roadmap") title.eyebrow = `Proyeksi mulai ${monthLabel(month)}`;
  if (activePage === "forecast") title.eyebrow = "Proyeksi dari hari ini";
  if (activePage === "accounts") title.eyebrow = `${accounts.length} akun aktif`;
  if (activePage === "budgets") title.eyebrow = `Rencana ${monthLabel(month)}`;
  if (activePage === "goals") title.eyebrow = `${goals.length} target aktif`;
  if (activePage === "bills") title.eyebrow = `${bills.filter((bill) => !bill.paid).length} menunggu`;
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
          <span className="nav-label">Workspace</span>
          {navPrimary.map((item) => <NavButton key={item.key} item={item} active={activePage === item.key} onClick={() => selectPage(item.key)} />)}
          <span className="nav-label lower">Lainnya</span>
          {navSecondary.map((item) => <NavButton key={item.key} item={item} active={activePage === item.key} onClick={() => selectPage(item.key)} />)}
        </nav>
        <div className="sidebar-card">
          <div className="sidebar-card-icon"><Database size={20} /></div>
          <div><strong>{financeBackendLabel()}</strong><p>Data finansial tersimpan permanen dan setiap perubahan melewati validasi ledger.</p></div>
          <span className="status-pill"><span /> Terhubung</span>
        </div>
        <div className="profile-row">
          <div className="avatar">{profile.name.slice(0, 2).toUpperCase()}</div>
          <div><strong>{profile.name}</strong><small>Owner</small></div>
          <MoreHorizontal size={18} />
        </div>
      </aside>

      {sidebarOpen && <button className="sidebar-scrim" onClick={() => setSidebarOpen(false)} aria-label="Tutup menu" />}

      <main className="main-area">
        <header className="topbar">
          <button className="icon-button mobile-menu" onClick={() => setSidebarOpen(true)} aria-label="Buka menu"><Menu size={20} /></button>
          <div className="global-search">
            <Search size={18} />
            <input id="global-transaction-search" aria-label="Cari transaksi" placeholder="Cari transaksi, akun, atau kategori..." value={transactionQuery} onChange={(event) => { setTransactionQuery(event.target.value); setActivePage("transactions"); }} onFocus={() => activePage !== "transactions" && setActivePage("transactions")} />
            <kbd>⌘ K</kbd>
          </div>
          <div className="topbar-actions">
            <button className="privacy-toggle" onClick={() => setPrivacy((value) => !value)} aria-pressed={privacy} title="Privacy mode">
              {privacy ? <EyeOff size={17} /> : <Eye size={17} />}<span>{privacy ? "Tampilkan" : "Sembunyikan"}</span>
            </button>
            <button className="icon-button" onClick={() => setDarkMode((value) => !value)} aria-label={darkMode ? "Gunakan tema terang" : "Gunakan tema gelap"}>
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

        <div className="page-wrap">
          {dataError && <div className="data-alert"><span><Database size={17} /></span><div><strong>Sinkronisasi perlu perhatian</strong><small>{dataError}</small></div><button onClick={() => refreshData().then(() => setDataError(null)).catch((error) => setDataError(error instanceof Error ? error.message : "Gagal memuat data."))}>Coba lagi</button></div>}
          <section className="page-heading">
            <div><span className="eyebrow">{title.eyebrow}</span><h1>{title.title}</h1><p>{title.subtitle}</p></div>
            {activePage !== "dashboard" && activePage !== "roadmap" && activePage !== "forecast" && activePage !== "debts" && activePage !== "assistant" && activePage !== "settings" && (
              <button className="primary-button" onClick={openCreateForPage}><Plus size={18} /> {createLabel}</button>
            )}
          </section>

          {activePage === "dashboard" && <DashboardPage transactions={transactions} accounts={accounts} budgets={budgets} bills={bills} goals={goals} privacy={privacy} monthly={monthly} accountTotals={accountTotals} healthScore={healthScore} month={month} onNavigate={selectPage} onAdd={() => setTransactionOpen(true)} />}
          {activePage === "roadmap" && <RoadmapPage month={month} transactions={transactions} accounts={accounts} goals={goals} investmentAssets={investmentAssets} privacy={privacy} onToast={showToast} />}
          {activePage === "forecast" && <CashflowForecastPage transactions={transactions} accounts={accounts} bills={bills} privacy={privacy} onToast={showToast} />}
          {activePage === "debts" && <DebtPayoffPage month={month} accounts={accounts} privacy={privacy} onToast={showToast} />}
          {activePage === "transactions" && <TransactionsPage transactions={transactions} accounts={accounts} categories={categories} privacy={privacy} month={month} query={transactionQuery} onQueryChange={setTransactionQuery} onEdit={setEditingTransaction} onDuplicate={setDuplicatingTransaction} onDelete={deleteTransaction} onImport={() => setTransactionImportOpen(true)} onUndo={undoLastTransaction} saving={saving} />}
          {activePage === "accounts" && <AccountsPage accounts={accounts} privacy={privacy} onAdd={() => setAccountOpen(true)} onImport={() => setAccountImportOpen(true)} onArchive={archiveAccount} onReconcile={setReconcileTarget} onInspect={(account) => { setTransactionQuery(account.name); selectPage("transactions"); }} />}
          {activePage === "budgets" && <BudgetsPage budgets={budgets} transactions={transactions} privacy={privacy} month={month} onAdd={() => setBudgetOpen(true)} />}
          {activePage === "goals" && <GoalsPage goals={goals} privacy={privacy} onContribute={contributeGoal} onAdd={() => setGoalOpen(true)} />}
          {activePage === "bills" && <BillsPage bills={bills} accounts={accounts} privacy={privacy} onPay={payBill} onAdd={() => setBillOpen(true)} />}
          {activePage === "investments" && <InvestmentsPage assets={investmentAssets} transactions={investmentTransactions} accounts={accounts} privacy={privacy} onAddAsset={() => setInvestmentAssetModal({})} onEditAsset={(asset) => setInvestmentAssetModal({ asset })} onTrade={(type, asset) => setInvestmentTradeModal({ type, asset })} />}
          {activePage === "reports" && <ReportsPage period={month} profile={profile} transactions={transactions} accounts={accounts} budgets={budgets} goals={goals} bills={bills} categories={categories} investmentAssets={investmentAssets} investmentTransactions={investmentTransactions} monthly={monthly} accountTotals={accountTotals} privacy={privacy} onToast={showToast} />}
          {activePage === "assistant" && <AssistantPage period={month} onOpenSettings={() => selectPage("settings")} />}
          {activePage === "settings" && <SettingsPage profile={profile} saving={saving} darkMode={darkMode} setDarkMode={setDarkMode} privacy={privacy} setPrivacy={setPrivacy} categories={categories} auditLogs={auditLogs} backendLabel={financeBackendLabel()} notificationSettings={notificationOverview?.settings ?? DEFAULT_NOTIFICATION_SETTINGS} onSaveProfile={saveOwnerProfile} onSaveNotificationSettings={saveNotificationSettings} onAddCategory={() => setCategoryModal({})} onEditCategory={(category) => setCategoryModal({ category })} onArchiveCategory={archiveCategory} onToast={showToast} onRefresh={refreshData} />}
        </div>
      </main>

      <nav className="mobile-nav" aria-label="Navigasi seluler">
        {navPrimary.filter((item) => ["dashboard", "transactions", "budgets", "goals"].includes(item.key)).map((item) => <NavButton key={item.key} item={item} active={activePage === item.key} onClick={() => selectPage(item.key)} />)}
        <button className="mobile-add" onClick={() => setTransactionOpen(true)} aria-label="Tambah transaksi"><Plus size={23} /></button>
      </nav>

      {(transactionOpen || editingTransaction || duplicatingTransaction) && <TransactionModal accounts={accounts} categories={categories} initial={editingTransaction ?? duplicatingTransaction ?? undefined} mode={editingTransaction ? "edit" : duplicatingTransaction ? "duplicate" : "create"} saving={saving} onClose={() => { setTransactionOpen(false); setEditingTransaction(null); setDuplicatingTransaction(null); }} onSubmit={editingTransaction ? editTransaction : addTransaction} />}
      {transactionImportOpen && <TransactionImportModal accounts={accounts} categories={categories} saving={saving} onClose={() => setTransactionImportOpen(false)} onSubmit={async (items) => { const ok = await importTransactions(items); if (ok) setTransactionImportOpen(false); return ok; }} />}
      {accountImportOpen && <AccountImportModal accounts={accounts} saving={saving} onClose={() => setAccountImportOpen(false)} onSubmit={async (items) => { const ok = await importAccounts(items); if (ok) setAccountImportOpen(false); return ok; }} />}
      {accountOpen && <AccountModal saving={saving} onClose={() => setAccountOpen(false)} onSubmit={async (payload) => { const ok = await runMutation(() => createFinanceAccount(payload), "Akun baru berhasil ditambahkan."); if (ok) setAccountOpen(false); }} />}
      {budgetOpen && <BudgetModal month={month} categories={categories} saving={saving} onClose={() => setBudgetOpen(false)} onSubmit={async (payload) => { const ok = await runMutation(() => upsertFinanceBudget(payload), "Anggaran berhasil disimpan."); if (ok) setBudgetOpen(false); }} />}
      {goalOpen && <GoalModal saving={saving} onClose={() => setGoalOpen(false)} onSubmit={async (payload) => { const ok = await runMutation(() => createFinanceGoal(payload), "Target finansial berhasil dibuat."); if (ok) setGoalOpen(false); }} />}
      {billOpen && <BillModal accounts={accounts} categories={categories} saving={saving} onClose={() => setBillOpen(false)} onSubmit={async (payload) => { const ok = await runMutation(() => createFinanceBill(payload), "Tagihan rutin berhasil ditambahkan."); if (ok) setBillOpen(false); }} />}
      {reconcileTarget && <ReconcileModal account={reconcileTarget} privacy={privacy} saving={saving} onClose={() => setReconcileTarget(null)} onSubmit={async (actualBalance, date, note, requestId) => { const ok = await reconcileAccount(reconcileTarget, actualBalance, date, note, requestId); if (ok) setReconcileTarget(null); }} />}
      {categoryModal && <CategoryModal category={categoryModal.category} saving={saving} onClose={() => setCategoryModal(null)} onSubmit={async (payload, requestId) => { const ok = await saveCategory(payload, categoryModal.category, requestId); if (ok) setCategoryModal(null); }} />}
      {investmentAssetModal && <InvestmentAssetModal asset={investmentAssetModal.asset} accounts={accounts} saving={saving} onClose={() => setInvestmentAssetModal(null)} onSubmit={async (payload, requestId) => { const ok = await saveInvestmentAsset(payload, investmentAssetModal.asset, requestId); if (ok) setInvestmentAssetModal(null); }} />}
      {investmentTradeModal && <InvestmentTradeModal type={investmentTradeModal.type} initialAsset={investmentTradeModal.asset} assets={investmentAssets} accounts={accounts} privacy={privacy} saving={saving} onClose={() => setInvestmentTradeModal(null)} onSubmit={async (payload, requestId) => { const ok = await saveInvestmentTrade(payload, requestId); if (ok) setInvestmentTradeModal(null); }} />}
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
        <div className="hero-pattern" aria-hidden="true"><span /><span /><span /><span /><span /></div>
      </section>

      <section className="health-card">
        <div className="card-title-row"><div><span className="card-kicker">Skor kesehatan</span><h2>Kondisi finansial</h2></div></div>
        <div className="health-content">
          <div className="score-ring" style={{ "--score": `${healthScore * 3.6}deg` } as React.CSSProperties}><div><strong>{healthScore}</strong><small>/100</small></div></div>
          <div><span className="health-label">{healthLabel}</span><p>Skor dihitung deterministik dari savings rate, likuiditas, utang, dan kepatuhan anggaran.</p><button className="text-button" onClick={() => onNavigate("reports")}>Lihat analisis <ArrowRight size={15} /></button></div>
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
            <span><strong>{account.name}</strong><small>{account.institution} · {account.mask}</small></span>
            <Amount value={account.balance} privacy={privacy} className={account.liability ? "negative-text" : ""} />
          </div>)}
          {!accounts.length && <button className="dashboard-empty action" onClick={() => onNavigate("accounts")}>Tambahkan akun pertama</button>}
        </div>
      </section>

      <section className="panel bills-panel">
        <div className="card-title-row"><div><span className="card-kicker">Mendatang</span><h2>Tagihan terdekat</h2></div><button className="text-button" onClick={() => onNavigate("bills")}>Lihat semua <ArrowRight size={14} /></button></div>
        <div className="bill-list">
          {upcomingBills.map((bill, index) => <button key={bill.id} onClick={() => onNavigate("bills")}><span className={`date-box ${index === 0 ? "urgent" : ""}`}><small>{shortMonth(bill.dueDate)}</small><strong>{validDate(bill.dueDate) ? bill.dueDate.slice(-2) : "—"}</strong></span><span><strong>{bill.name}</strong><small>{bill.category}</small></span><Amount value={bill.amount} privacy={privacy} /></button>)}
          {!upcomingBills.length && <button className="dashboard-empty action" onClick={() => onNavigate("bills")}>Belum ada tagihan mendatang</button>}
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

function AccountsPage({ accounts, privacy, onAdd, onImport, onArchive, onReconcile, onInspect }: { accounts: Account[]; privacy: boolean; onAdd: () => void; onImport: () => void; onArchive: (id: string) => void; onReconcile: (account: Account) => void; onInspect: (account: Account) => void }) {
  const totals = accountSummary(accounts);
  return <div className="content-stack">
    <div className="summary-strip account-summary">
      <div><span>Saldo likuid</span><Amount value={totals.liquid} privacy={privacy} /><small>Bank, e-wallet, cash</small></div>
      <div><span>Nilai investasi</span><Amount value={totals.investment} privacy={privacy} /><small>Menurut saldo ledger</small></div>
      <div><span>Total kewajiban</span><Amount value={totals.liabilities} privacy={privacy} /><small className="negative-text">Perlu dibayar</small></div>
      <div><span>Kekayaan bersih</span><Amount value={totals.netWorth} privacy={privacy} /><small>Setelah kewajiban</small></div>
    </div>
    <div className="account-import-bar"><div><FileUp size={18} /><span><strong>Pindahkan daftar akun sekaligus</strong><small>Impor hingga 100 akun dan tetapkan saldo awal dari CSV.</small></span></div><button className="secondary-button" onClick={onImport}><FileUp size={16} /> Impor akun</button></div>
    <div className="account-grid">
      {accounts.map((account) => <article className={`account-card ${account.liability ? "liability" : ""}`} key={account.id}>
        <div className="account-card-top"><span className="large-account-logo" style={{ background: `${account.color}18`, color: account.color }}>{account.type === "Bank" ? <Landmark size={22} /> : account.type === "Investment" ? <TrendingUp size={22} /> : account.liability ? <CreditCard size={22} /> : <WalletCards size={22} />}</span><span className="account-card-actions"><button className="icon-button small" onClick={() => onReconcile(account)} aria-label={`Rekonsiliasi ${account.name}`} title="Cocokkan saldo"><Scale size={16} /></button><button className="icon-button small" onClick={() => window.confirm(`Arsipkan ${account.name}?`) && onArchive(account.id)} aria-label={`Arsipkan ${account.name}`}><Trash2 size={16} /></button></span></div>
        <span>{account.type}</span><h3>{account.name}</h3><p>{account.institution} · {account.mask}</p>
        <Amount value={account.balance} privacy={privacy} className="account-card-value" />
        <div className="account-card-footer"><span><i style={{ background: account.color }} /> {account.liability ? "Kewajiban" : "Aktif"}</span><button onClick={() => onInspect(account)}>Lihat transaksi <ArrowRight size={14} /></button></div>
      </article>)}
      <button className="add-card" onClick={onAdd}><span><Plus size={21} /></span><strong>Tambah akun baru</strong><small>Bank, e-wallet, cash, atau lainnya</small></button>
    </div>
  </div>;
}

function BudgetsPage({ budgets, transactions, privacy, month, onAdd }: { budgets: Budget[]; transactions: Transaction[]; privacy: boolean; month: string; onAdd: () => void }) {
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
          <strong>{Math.round(percent)}%</strong>
        </div>; })}
        {!budgets.length && <div className="empty-state"><BarChart3 size={28} /><h3>Belum ada anggaran</h3><p>Tambahkan batas kategori agar realisasi dapat dipantau otomatis.</p><button className="primary-button" onClick={onAdd}><Plus size={16} /> Tambah anggaran</button></div>}
      </div>
    </section>
  </div>;
}

function GoalsPage({ goals, privacy, onContribute, onAdd }: { goals: Goal[]; privacy: boolean; onContribute: (goal: Goal) => void; onAdd: () => void }) {
  return <div className="goal-grid">
    {goals.map((goal) => { const percent = goal.target > 0 ? goal.current / goal.target * 100 : 0; const remaining = Math.max(0, goal.target - goal.current); const deadlineTime = validDate(goal.deadline) ? new Date(`${goal.deadline}T12:00:00`).getTime() : new Date().getTime(); const months = Math.max(1, Math.ceil((deadlineTime - new Date().getTime()) / 2_628_000_000)); return <article className="goal-card" key={goal.id}>
      <div className="goal-card-head"><span className="large-goal-icon" style={{ background: `${goal.color}18`, color: goal.color }}><Target size={24} /></span></div>
      <span className="goal-deadline">Target · {shortDate(goal.deadline)}</span><h2>{goal.name}</h2>
      <div className="goal-amount"><Amount value={goal.current} privacy={privacy} /><small>dari <Amount value={goal.target} privacy={privacy} /></small></div>
      <ProgressBar value={percent} color={goal.color} label={`Progress ${goal.name}`} />
      <div className="goal-meta"><span><small>Tercapai</small><strong>{percent.toFixed(1)}%</strong></span><span><small>Sisa</small><Amount value={remaining} privacy={privacy} compact /></span><span><small>Rekomendasi/bln</small><Amount value={remaining / months} privacy={privacy} compact /></span></div>
      <button className="secondary-button full" onClick={() => onContribute(goal)} disabled={percent >= 100}><Plus size={16} /> {percent >= 100 ? "Target selesai" : "Tambah progress Rp500.000"}</button>
    </article>; })}
    <button className="add-card goal-add" onClick={onAdd}><span><Plus size={21} /></span><strong>Buat target baru</strong><small>Tentukan nominal, deadline, dan kontribusi rutin</small></button>
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
      <div className="roadmap-goal-list">{roadmap.goalForecasts.map((goal) => <div key={goal.id}><span className={goal.onTrack ? "roadmap-goal-icon on-track" : "roadmap-goal-icon at-risk"}>{goal.onTrack ? <CheckCircle2 size={17} /> : <Clock3 size={17} />}</span><span><strong>{goal.name}</strong><small>Sisa <Amount value={goal.remaining} privacy={privacy} /> · kebutuhan <Amount value={goal.recommendedMonthly} privacy={privacy} compact />/bulan</small></span><span><small>Perkiraan</small><strong className={goal.onTrack ? "positive-text" : "warning-text"}>{goal.projectedMonth ? formatMonthLabel(goal.projectedMonth) : "Belum terjangkau"}</strong></span></div>)}{!roadmap.goalForecasts.length && <div className="settings-empty">Semua target sudah tercapai atau belum ada target aktif.</div>}</div>
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
    <div className="form-grid"><label><span>Bunga per tahun (%)</span><input type="number" min={0} max={100} step="0.01" value={rate} onChange={(event) => setRate(event.target.value)} required autoFocus/></label><label><span>Cicilan minimum / bulan</span><input value={minimum} onChange={(event) => setMinimum(event.target.value.replace(/\D/g, ""))} inputMode="numeric" required/></label><label><span>Tanggal jatuh tempo</span><input type="number" min={1} max={31} value={dueDay} onChange={(event) => setDueDay(event.target.value)} required/></label></div>
  </SimpleModal>;
}

function BillsPage({ bills, accounts, privacy, onPay, onAdd }: { bills: Bill[]; accounts: Account[]; privacy: boolean; onPay: (bill: Bill) => void; onAdd: () => void }) {
  const pending = bills.filter((bill) => !bill.paid);
  return <div className="content-stack">
    <div className="summary-strip">
      <div><span>Belum dibayar</span><strong>{pending.length} tagihan</strong><small>{monthLabel(currentMonth())}</small></div>
      <div><span>Total mendatang</span><Amount value={pending.reduce((sum, bill) => sum + bill.amount, 0)} privacy={privacy} /><small>Menurut jatuh tempo</small></div>
      <div><span>Sudah dibayar</span><strong>{bills.filter((bill) => bill.paid).length} tagihan</strong><small className="positive-text">Tepat waktu</small></div>
      <div><span>Pencatatan tagihan</span><strong>Konfirmasi manual</strong><small>Setiap pembayaran tetap kamu kendalikan</small></div>
    </div>
    <section className="panel bills-full-panel">
      <div className="card-title-row"><div><span className="card-kicker">Jadwal</span><h2>Tagihan {monthLabel(currentMonth())}</h2></div><button className="secondary-button" onClick={onAdd}><Plus size={16} /> Tambah tagihan</button></div>
      <div className="bill-cards">
        {[...bills].sort((a, b) => a.dueDate.localeCompare(b.dueDate)).map((bill) => { const account = accounts.find((item) => item.id === bill.accountId); return <article className={bill.paid ? "paid" : ""} key={bill.id}>
          <span className={`bill-brand bill-${bill.category.toLowerCase()}`}>{bill.name.slice(0, 1)}</span>
          <div className="bill-card-main"><span><strong>{bill.name}</strong>{bill.paid && <small className="paid-pill"><Check size={12} /> Dibayar</small>}</span><small>{bill.category} · {account?.name}</small></div>
          <div className="bill-due"><small>Jatuh tempo</small><strong>{shortDate(bill.dueDate)}</strong></div>
          <Amount value={bill.amount} privacy={privacy} className="bill-amount" />
          <button className={bill.paid ? "secondary-button" : "primary-button"} onClick={() => onPay(bill)} disabled={bill.paid}>{bill.paid ? "Selesai" : "Bayar"}</button>
        </article>; })}
        {!bills.length && <div className="empty-state"><CalendarDays size={28} /><h3>Belum ada tagihan</h3><p>Tambahkan tagihan rutin agar jatuh tempo tidak terlewat.</p><button className="primary-button" onClick={onAdd}><Plus size={16} /> Tambah tagihan</button></div>}
      </div>
    </section>
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
      <div className="investment-history-list">{transactions.slice(0, 12).map((transaction) => { const asset = assets.find((item) => item.id === transaction.assetId); return <div key={transaction.id}><span className={transaction.type === "buy" ? "notice-icon good" : "notice-icon info"}>{transaction.type === "buy" ? <ArrowUpRight size={15} /> : <ArrowDownLeft size={15} />}</span><span><strong>{transaction.type === "buy" ? "Beli" : "Jual"} {asset?.ticker ?? "Aset"}</strong><small>{shortDate(transaction.date)} · {formatUnits(transaction.units)} unit @ {formatIDR(transaction.pricePerUnit)}</small></span><span><Amount value={transaction.netAmount} privacy={privacy} /><small>{transaction.type === "sell" ? `P/L ${privacy ? "disembunyikan" : formatIDR(transaction.realizedPl)}` : `Avg ${privacy ? "disembunyikan" : formatIDR(transaction.averageCostAfter)}`}</small></span></div>; })}{!transactions.length && <div className="settings-empty">Belum ada transaksi buy atau sell.</div>}</div>
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
  { key: "debts", label: "Pelunasan utang" },
  { key: "investments", label: "Investasi" },
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
      <div className="assistant-banner"><span><Bot size={21} /></span><div><strong>Financial Insight</strong><small>Gemini · {monthLabel(period)} · Read-only</small></div><span className={`online ${ready ? "" : "offline"}`}><i /> {loading ? "Memeriksa" : ready ? "Siap" : "Perlu setup"}</span></div>
      {!loading && !ready && <div className="ai-setup-callout"><KeyRound size={18} /><div><strong>Aktifkan AI terlebih dahulu</strong><small>Tambahkan API key Gemini dan setujui disclosure privasi di Pengaturan. Key hanya disimpan terenkripsi di server.</small></div><button className="secondary-button" onClick={onOpenSettings}>Buka Pengaturan</button></div>}
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
  const [apiKey, setApiKey] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    getFinanceAiSettings().then((next) => {
      setStatus(next);
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
    if (!window.confirm("Hapus API key Gemini dan nonaktifkan AI?")) return;
    setSaving(true);
    try {
      const next = await updateFinanceAiSettings({ enabled: false, consentAccepted, removeApiKey: true });
      setStatus(next);
      setEnabled(false);
      setApiKey("");
      onToast("API key Gemini berhasil dihapus.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "API key tidak dapat dihapus.");
    } finally {
      setSaving(false);
    }
  };

  return <section className="panel settings-section settings-wide ai-settings-panel">
    <div className="settings-title"><span><Bot size={20} /></span><div><h2>AI & OCR Gemini</h2><p>Kelola akses read-only, API key, dan persetujuan pengiriman data.</p></div><span className={`ai-config-badge ${status?.configured ? "ready" : ""}`}>{status?.configured ? "Key tersimpan" : "Belum dikonfigurasi"}</span></div>
    <div className="ai-settings-grid">
      <div className="ai-key-box"><label><span>API key Gemini</span><input type="password" autoComplete="off" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder={status?.configured ? "••••••••••••••••••••" : "Masukkan API key dari Google AI Studio"} /></label><small>Key dikirim sekali melalui HTTPS, dienkripsi di server, dan tidak pernah ditampilkan kembali ke browser.</small><div className="settings-actions"><button className="primary-button" onClick={save} disabled={saving || (enabled && !consentAccepted) || (!status?.configured && !apiKey.trim())}><ShieldCheck size={16} /> {saving ? "Menyimpan…" : "Simpan pengaturan"}</button>{status?.configured && <button className="secondary-button danger-text" onClick={removeKey} disabled={saving}><Trash2 size={15} /> Hapus key</button>}</div>{error && <div className="ai-error" role="alert">{error}</div>}</div>
      <div className="ai-consent-box"><div className="settings-row"><div><strong>Aktifkan AI & OCR</strong><small>AI hanya membaca konteks yang relevan dan tidak dapat menulis transaksi.</small></div><button className={`switch ${enabled ? "on" : ""}`} onClick={() => setEnabled(!enabled)} aria-pressed={enabled}><span /></button></div><label className="ai-consent-check"><input type="checkbox" checked={consentAccepted} onChange={(event) => setConsentAccepted(event.target.checked)} /><span>Saya memahami data terpilih dan foto struk akan dikirim ke Gemini; hasil dapat keliru; AI bukan penasihat keuangan; dan transaksi OCR baru tersimpan setelah saya konfirmasi.</span></label><div className="ai-privacy-facts"><span><ShieldCheck size={15} /> Foto struk tidak disimpan setelah ekstraksi.</span><span><KeyRound size={15} /> API key tidak masuk ke histori atau audit log.</span><span><Bot size={15} /> Model: {status?.model ?? "gemini-3.5-flash"}</span></div></div>
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
    </div>
    <div className="settings-actions"><button className="primary-button" onClick={save} disabled={saving || !draft.billReminderDays.length}><Bell size={15} /> {saving ? "Menyimpan…" : "Simpan reminder"}</button><small>Notifikasi hanya informatif dan tidak melakukan pembayaran atau perubahan data otomatis.</small></div>
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

function SettingsPage({ profile, saving, darkMode, setDarkMode, privacy, setPrivacy, categories, auditLogs, backendLabel, notificationSettings, onSaveProfile, onSaveNotificationSettings, onAddCategory, onEditCategory, onArchiveCategory, onToast, onRefresh }: {
  profile: FinanceProfile;
  saving: boolean;
  darkMode: boolean;
  setDarkMode: (value: boolean) => void;
  privacy: boolean;
  setPrivacy: (value: boolean) => void;
  categories: FinanceCategory[];
  auditLogs: AuditLog[];
  backendLabel: string;
  notificationSettings: NotificationSettings;
  onSaveProfile: (name: string) => Promise<boolean>;
  onSaveNotificationSettings: (settings: NotificationSettings) => Promise<NotificationSettings>;
  onAddCategory: () => void;
  onEditCategory: (category: FinanceCategory) => void;
  onArchiveCategory: (categoryId: string) => void;
  onToast: (message: string) => void;
  onRefresh: () => Promise<void>;
}) {
  const editableCategories = categories.filter((category) => category.active && (category.type === "income" || category.type === "expense"));
  return <div className="settings-layout">
    <OwnerProfilePanel key={profile.name} profile={profile} saving={saving} onSave={onSaveProfile} />
    <section className="panel settings-section"><div className="settings-title"><span><Settings size={20} /></span><div><h2>Preferensi tampilan</h2><p>Atur pengalaman dashboard di perangkat ini.</p></div></div><div className="settings-row"><div><strong>Tema gelap</strong><small>Kurangi cahaya pada malam hari.</small></div><button className={`switch ${darkMode ? "on" : ""}`} onClick={() => setDarkMode(!darkMode)} aria-pressed={darkMode}><span /></button></div><div className="settings-row"><div><strong>Privacy mode</strong><small>Sembunyikan semua nominal sensitif.</small></div><button className={`switch ${privacy ? "on" : ""}`} onClick={() => setPrivacy(!privacy)} aria-pressed={privacy}><span /></button></div></section>
    <section className="panel settings-section"><div className="settings-title"><span><Building2 size={20} /></span><div><h2>Penyimpanan utama</h2><p>Status backend finansial aktif.</p></div></div><div className="connection-card"><span className="google-mark"><Database size={18} /></span><div><strong>{backendLabel}</strong><small>{backendLabel === "Google Sheets" ? "Terhubung melalui Google Apps Script." : "Terhubung ke database situs."}</small></div><span className="connection-status"><i /> Terhubung</span></div></section>
    <NotificationSettingsPanel key={`${notificationSettings.enabled}-${notificationSettings.billReminderDays.join(",")}-${notificationSettings.budgetWarningPercent}-${notificationSettings.backupWarningDays}-${notificationSettings.goalWarningDays}`} settings={notificationSettings} onSave={onSaveNotificationSettings} onToast={onToast} />
    <AiSettingsPanel onToast={onToast} />
    <LedgerHealthPanel privacy={privacy} onToast={onToast} onRefresh={onRefresh} />
    <DataPortabilityPanel backendLabel={backendLabel} onToast={onToast} onRefresh={onRefresh} />
    <section className="panel settings-section settings-wide"><div className="settings-title"><span><Tags size={20} /></span><div><h2>Kategori transaksi</h2><p>Kategori aktif dipakai langsung pada transaksi, anggaran, dan tagihan.</p></div><button className="secondary-button settings-title-action" onClick={onAddCategory}><Plus size={15} /> Tambah kategori</button></div><div className="category-manager">{editableCategories.map((category) => <div className="category-manager-row" key={category.id}><i style={{ background: category.color }} /><div><strong>{category.name}</strong><small>{category.type === "income" ? "Pemasukan" : "Pengeluaran"}{category.isDefault ? " · bawaan" : ""}</small></div><span><button className="icon-button small" onClick={() => onEditCategory(category)} aria-label={`Edit kategori ${category.name}`}><Pencil size={14} /></button>{!category.isDefault && <button className="icon-button small danger" onClick={() => window.confirm(`Arsipkan kategori ${category.name}? Transaksi lama tetap aman.`) && onArchiveCategory(category.id)} aria-label={`Arsipkan kategori ${category.name}`}><Trash2 size={14} /></button>}</span></div>)}{!editableCategories.length && <div className="settings-empty">Belum ada kategori aktif.</div>}</div></section>
    <section className="panel settings-section"><div className="settings-title"><span><History size={20} /></span><div><h2>Audit trail</h2><p>20 aktivitas terbaru yang tercatat di workspace.</p></div></div><div className="audit-list">{auditLogs.slice(0, 20).map((log) => <div key={log.id}><span><strong>{log.action.replaceAll("_", " ")}</strong><small>{log.module}{log.entityId ? ` · ${log.entityId.slice(0, 18)}` : ""}</small></span><time>{log.createdAt ? new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date(log.createdAt)) : "—"}</time></div>)}{!auditLogs.length && <div className="settings-empty">Belum ada aktivitas yang tercatat.</div>}</div></section>
  </div>;
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

function TransactionModal({ accounts, categories, initial, mode, saving, onClose, onSubmit }: {
  accounts: Account[];
  categories: FinanceCategory[];
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
  const numericAmount = Number(amount.replace(/\D/g, "") || 0);
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
        <label className="amount-field"><span>Nominal</span><div><small>Rp</small><input value={amount} onChange={(event) => setAmount(event.target.value.replace(/\D/g, ""))} inputMode="numeric" pattern="[1-9][0-9]*" placeholder="0" required autoFocus /></div></label>
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
        {["income", "expense", "refund"].includes(type) && <section className="transaction-split-box"><div><span><strong>Split kategori</strong><small>Bagi satu transaksi ke beberapa kategori.</small></span><button type="button" className={`split-toggle ${splitEnabled ? "active" : ""}`} onClick={toggleSplit}>{splitEnabled ? "Aktif" : "Gunakan split"}</button></div>{splitEnabled && <><div className="split-list">{splits.map((split, index) => <div className="split-row" key={split.id}><span>{index + 1}</span><select value={split.category} onChange={(event) => updateSplit(split.id, { category: event.target.value })}><option value="" disabled>Kategori</option>{availableCategories.map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}</select><input value={split.amount || ""} onChange={(event) => updateSplit(split.id, { amount: Number(event.target.value.replace(/\D/g, "") || 0) })} inputMode="numeric" placeholder="Nominal" /><input value={split.note ?? ""} onChange={(event) => updateSplit(split.id, { note: event.target.value })} placeholder="Catatan opsional" /><button type="button" className="icon-button small" onClick={() => setSplits((current) => current.filter((item) => item.id !== split.id))} disabled={splits.length <= 2}><X size={15} /></button></div>)}</div><div className={`split-total ${splitTotal === numericAmount ? "matched" : ""}`}><span>Total split <strong>{formatIDR(splitTotal)}</strong></span><span>Nominal <strong>{formatIDR(numericAmount)}</strong></span><button type="button" className="text-button" onClick={addSplit}><Plus size={14} /> Tambah rincian</button></div></>}</section>}
        <section className="transaction-attachment-box"><div><Paperclip size={17} /><span><strong>Lampiran struk</strong><small>JPG, PNG, WebP, atau PDF. Maksimal 5 MB dan disimpan privat.</small></span></div>{isEdit && initial?.receipt && !removeReceipt && !receiptFile && <div className="existing-receipt"><a href={financeTransactionReceiptUrl(initial.id, initial.receipt.id, initial.receipt.url)} target="_blank" rel="noreferrer">{initial.receipt.filename}</a><button type="button" onClick={() => setRemoveReceipt(true)}>Hapus lampiran</button></div>}<label className="secondary-button receipt-picker"><Upload size={15} /> {receiptFile ? receiptFile.name : initial?.receipt && !removeReceipt ? "Ganti lampiran" : "Pilih lampiran"}<input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(event) => { const file = event.target.files?.[0]; if (file) { setReceiptFile(file); setRemoveReceipt(false); } }} /></label>{removeReceipt && <small>Lampiran lama akan dihapus saat transaksi disimpan.</small>}</section>
        {!isEdit && !isDuplicate && <label className={`ocr-button ${ocrLoading ? "loading" : ""}`}><Upload size={17} /><span><strong>{ocrLoading ? "Gemini sedang membaca struk..." : "Isi form dari foto struk"}</strong><small>OCR tidak menyimpan gambar. Gunakan bagian Lampiran jika ingin menyimpannya.</small></span><input type="file" accept="image/jpeg,image/png,image/webp" disabled={ocrLoading} onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; void selectReceipt(file); }} /></label>}
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
        {!initial && <label className={`ocr-button ${ocrLoading ? "loading" : ""}`}><Upload size={17} /><span><strong>{ocrLoading ? "Gemini sedang membaca struk…" : "Isi dari foto struk"}</strong><small>JPG, PNG, atau WebP · dikompresi di perangkat · gambar tidak disimpan.</small></span><input type="file" accept="image/jpeg,image/png,image/webp" disabled={ocrLoading} onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; selectReceipt(file); }} /></label>}
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

function TransactionImportModal({ accounts, categories, saving, onClose, onSubmit }: {
  accounts: Account[];
  categories: FinanceCategory[];
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
      const result = previewTransactionCsv(await file.text(), accounts, categories);
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
      <div className="import-guide"><FileUp size={22} /><div><strong>Preview dulu, simpan setelah semua baris valid.</strong><p>Kolom wajib: tanggal, jenis, deskripsi, kategori, akun, dan nominal. Nama akun harus sama dengan akun di Financial Planner.</p><button type="button" className="text-button" onClick={downloadTemplate}><Download size={14} /> Unduh template CSV</button></div></div>
      <label className="csv-dropzone"><Upload size={20} /><span><strong>{filename || "Pilih file CSV"}</strong><small>Maksimal 100 transaksi atau 1 MB</small></span><input type="file" accept=".csv,text/csv" onChange={(event) => void selectFile(event.target.files?.[0])} /></label>
      {error && <div className="ocr-message"><X size={15} />{error}</div>}
      {preview && <>
        <div className="import-summary"><span><small>Baris valid</small><strong>{preview.validCount}</strong></span><span className={preview.errorCount ? "negative-text" : "positive-text"}><small>Perlu diperbaiki</small><strong>{preview.errorCount}</strong></span><span><small>Pemasukan</small><strong>{formatIDR(preview.income)}</strong></span><span><small>Pengeluaran</small><strong>{formatIDR(preview.expense)}</strong></span></div>
        <div className="import-preview-table"><div className="import-preview-head"><span>Baris</span><span>Transaksi</span><span>Akun / kategori</span><span>Nominal</span><span>Status</span></div>{preview.rows.slice(0, 30).map((row) => <div className={row.errors.length ? "invalid" : ""} key={row.rowNumber}><span>{row.rowNumber}</span><span><strong>{row.transaction?.title || row.raw.title || "-"}</strong><small>{row.transaction?.date || row.raw.date || "-"}</small></span><span>{row.transaction ? `${accounts.find((item) => item.id === row.transaction?.accountId)?.name} · ${row.transaction.category}` : "-"}</span><span>{row.transaction ? formatIDR(row.transaction.amount) : row.raw.amount || "-"}</span><span>{row.errors.length ? row.errors.join(" ") : "Siap"}</span></div>)}</div>
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
  const [profileName, setProfileName] = useState("Vinn");
  const [storeName, setStoreName] = useState("Financial Planner");
  const [accountName, setAccountName] = useState("Rekening Utama");
  const [accountType, setAccountType] = useState("Bank");
  const [institution, setInstitution] = useState("");
  const [openingBalance, setOpeningBalance] = useState("");
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    await onSubmit({
      profileName: profileName.trim() || "Vinn",
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
          <label><span>Saldo awal</span><input value={openingBalance} onChange={(event) => setOpeningBalance(event.target.value.replace(/\D/g, ""))} inputMode="numeric" placeholder="0" /></label>
        </div>
        <button className="primary-button setup-submit" disabled={saving}>{saving ? "Menyiapkan workspace…" : "Buat Financial Planner"}<ArrowRight size={17} /></button>
        <small className="setup-footnote"><ShieldCheck size={14} /> PIN, OTP, CVV, dan password bank tidak pernah diminta.</small>
      </form>
    </section>
  </main>;
}

function AccountModal({ saving, onClose, onSubmit }: { saving: boolean; onClose: () => void; onSubmit: (payload: Record<string, unknown>) => Promise<void> }) {
  const [name, setName] = useState("");
  const [type, setType] = useState("Bank");
  const [institution, setInstitution] = useState("");
  const [openingBalance, setOpeningBalance] = useState("");
  return <SimpleModal title="Tambah akun" kicker="Multi-account" saving={saving} onClose={onClose} onSubmit={(event) => { event.preventDefault(); return onSubmit({ name: name.trim(), type, institution: institution.trim(), openingBalance: Number(openingBalance || 0), color: categoryColors[name] || "#126b59", currency: "IDR" }); }}>
    <div className="form-grid"><label><span>Nama akun</span><input value={name} onChange={(event) => setName(event.target.value)} required autoFocus /></label><label><span>Jenis akun</span><select value={type} onChange={(event) => setType(event.target.value)}>{["Bank", "E-Wallet", "Cash", "Credit Card", "Paylater", "Loan", "Mortgage", "Investment"].map((item) => <option key={item}>{item}</option>)}</select><ChevronDown size={15} /></label><label><span>Institusi</span><input value={institution} onChange={(event) => setInstitution(event.target.value)} placeholder="Opsional" /></label><label><span>Saldo awal</span><input value={openingBalance} onChange={(event) => setOpeningBalance(event.target.value.replace(/\D/g, ""))} inputMode="numeric" placeholder="0" /></label></div>
  </SimpleModal>;
}

function BudgetModal({ month, categories, saving, onClose, onSubmit }: { month: string; categories: FinanceCategory[]; saving: boolean; onClose: () => void; onSubmit: (payload: Record<string, unknown>) => Promise<void> }) {
  const expenseCategories = categories.filter((item) => item.active && item.type === "expense");
  const [category, setCategory] = useState(expenseCategories[0]?.name ?? "");
  const [limit, setLimit] = useState("");
  const color = expenseCategories.find((item) => item.name === category)?.color ?? categoryColors[category] ?? "#126b59";
  return <SimpleModal title="Anggaran kategori" kicker={monthLabel(month)} saving={saving} onClose={onClose} onSubmit={(event) => { event.preventDefault(); return onSubmit({ month, category, limitAmount: Number(limit || 0), limit: Number(limit || 0), color }); }}>
    <div className="form-grid"><label><span>Kategori</span><select value={category} required onChange={(event) => setCategory(event.target.value)}><option value="" disabled>Pilih kategori</option>{expenseCategories.map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}</select><ChevronDown size={15} /></label><label><span>Batas anggaran</span><input value={limit} onChange={(event) => setLimit(event.target.value.replace(/\D/g, ""))} inputMode="numeric" pattern="[1-9][0-9]*" placeholder="0" required autoFocus /></label></div>
    {!expenseCategories.length && <div className="ocr-message"><Tags size={15} />Tambahkan kategori pengeluaran di Pengaturan terlebih dahulu.</div>}
  </SimpleModal>;
}

function GoalModal({ saving, onClose, onSubmit }: { saving: boolean; onClose: () => void; onSubmit: (payload: Record<string, unknown>) => Promise<void> }) {
  const nextYear = new Date(); nextYear.setFullYear(nextYear.getFullYear() + 1);
  const [name, setName] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [currentAmount, setCurrentAmount] = useState("0");
  const [deadline, setDeadline] = useState(nextYear.toISOString().slice(0, 10));
  return <SimpleModal title="Target finansial" kicker="Goal tracking" saving={saving} onClose={onClose} onSubmit={(event) => { event.preventDefault(); return onSubmit({ name: name.trim(), targetAmount: Number(targetAmount || 0), target: Number(targetAmount || 0), currentAmount: Number(currentAmount || 0), current: Number(currentAmount || 0), deadline, color: "#126b59", icon: "target" }); }}>
    <div className="form-grid"><label><span>Nama target</span><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Contoh: Dana Darurat" required autoFocus /></label><label><span>Deadline</span><input type="date" min={today()} value={deadline} onChange={(event) => setDeadline(event.target.value)} required /></label><label><span>Nominal target</span><input value={targetAmount} onChange={(event) => setTargetAmount(event.target.value.replace(/\D/g, ""))} inputMode="numeric" pattern="[1-9][0-9]*" required /></label><label><span>Dana terkumpul</span><input value={currentAmount} onChange={(event) => setCurrentAmount(event.target.value.replace(/\D/g, ""))} inputMode="numeric" pattern="[0-9]+" /></label></div>
  </SimpleModal>;
}

function BillModal({ accounts, categories, saving, onClose, onSubmit }: { accounts: Account[]; categories: FinanceCategory[]; saving: boolean; onClose: () => void; onSubmit: (payload: Record<string, unknown>) => Promise<void> }) {
  const paymentAccounts = accounts.filter((account) => !account.liability && account.type !== "Investment");
  const expenseCategories = categories.filter((item) => item.active && item.type === "expense");
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState(expenseCategories.find((item) => item.name === "Tagihan")?.name ?? expenseCategories[0]?.name ?? "");
  const [dueDate, setDueDate] = useState(today());
  const [accountId, setAccountId] = useState(paymentAccounts[0]?.id ?? "");
  const [reminderDays, setReminderDays] = useState([7, 3, 1, 0]);
  const toggleReminder = (day: number) => setReminderDays((current) => current.includes(day) ? current.filter((item) => item !== day) : [...current, day].sort((a, b) => b - a));
  return <SimpleModal title="Tagihan rutin" kicker="Reminder" saving={saving} onClose={onClose} onSubmit={(event) => { event.preventDefault(); return onSubmit({ name: name.trim(), amount: Number(amount || 0), category, dueDate, accountId, frequency: "monthly", reminderDays }); }}>
    <div className="form-grid"><label><span>Nama tagihan</span><input value={name} onChange={(event) => setName(event.target.value)} required autoFocus /></label><label><span>Nominal</span><input value={amount} onChange={(event) => setAmount(event.target.value.replace(/\D/g, ""))} inputMode="numeric" pattern="[1-9][0-9]*" required /></label><label><span>Kategori</span><select value={category} onChange={(event) => setCategory(event.target.value)} required><option value="" disabled>Pilih kategori</option>{expenseCategories.map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}</select><ChevronDown size={15} /></label><label><span>Jatuh tempo pertama</span><input type="date" min={today()} value={dueDate} onChange={(event) => setDueDate(event.target.value)} required /></label><label><span>Akun pembayaran</span><select value={accountId} onChange={(event) => setAccountId(event.target.value)} required><option value="" disabled>Pilih akun</option>{paymentAccounts.map((account) => <option value={account.id} key={account.id}>{account.name}</option>)}</select><ChevronDown size={15} /></label><label><span>Frekuensi</span><select value="monthly" disabled><option value="monthly">Bulanan</option></select><ChevronDown size={15} /></label><fieldset className="bill-reminder-field"><legend>Jadwal reminder</legend><div className="reminder-day-options">{[7, 3, 1, 0].map((day) => <label key={day}><input type="checkbox" checked={reminderDays.includes(day)} onChange={() => toggleReminder(day)} /><span>{day === 0 ? "Hari H" : `H-${day}`}</span></label>)}</div></fieldset></div>
    {!reminderDays.length && <div className="ocr-message"><Bell size={15} />Pilih minimal satu jadwal reminder.</div>}
    {!paymentAccounts.length && <div className="ocr-message"><WalletCards size={15} />Tambahkan akun bank, e-wallet, atau cash untuk membayar tagihan.</div>}
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
    <div className="form-grid"><label><span>Kode / ticker</span><input value={ticker} onChange={(event) => setTicker(event.target.value.replace(/[^a-zA-Z0-9._-]/g, "").toUpperCase())} placeholder="BBCA" maxLength={24} required autoFocus /></label><label><span>Nama aset</span><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Bank Central Asia" required /></label><label><span>Kelas aset</span><select value={assetClass} onChange={(event) => setAssetClass(event.target.value as InvestmentAsset["assetClass"])}>{investmentAssetClasses.map((item) => <option key={item}>{item}</option>)}</select><ChevronDown size={15} /></label><label><span>Bursa / sumber</span><input value={exchange} onChange={(event) => setExchange(event.target.value)} placeholder="IDX, Binance, Bibit…" /></label><label><span>Akun investasi</span><select value={accountId} disabled={Boolean(asset && asset.units > 0)} onChange={(event) => setAccountId(event.target.value)} required><option value="" disabled>Pilih akun Investment</option>{investmentAccounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select><ChevronDown size={15} /></label><label><span>Harga manual (IDR)</span><input value={manualPrice} onChange={(event) => setManualPrice(event.target.value.replace(/\D/g, ""))} inputMode="numeric" placeholder="Opsional" /></label>{asset && <label><span>Status aset</span><select value={active ? "active" : "archived"} onChange={(event) => setActive(event.target.value === "active")}><option value="active">Aktif</option><option value="archived" disabled={asset.units > 0}>Arsipkan</option></select><ChevronDown size={15} /></label>}</div>
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
    <div className="form-grid investment-form-grid"><label><span>Aset</span><select value={assetId} onChange={(event) => { const next = assets.find((asset) => asset.id === event.target.value); setAssetId(event.target.value); setPriceInput(String(next?.marketPrice || next?.averageCost || "")); }} required><option value="" disabled>Pilih aset</option>{tradableAssets.map((asset) => <option key={asset.id} value={asset.id}>{asset.ticker} · {asset.name}</option>)}</select><ChevronDown size={15} /></label><label><span>{type === "buy" ? "Akun pembayaran" : "Akun penerima"}</span><select value={accountId} onChange={(event) => setAccountId(event.target.value)} required><option value="" disabled>Pilih akun kas</option>{cashAccounts.map((account) => <option key={account.id} value={account.id}>{account.name} · {privacy ? "saldo disembunyikan" : formatIDR(account.balance)}</option>)}</select><ChevronDown size={15} /></label><label><span>Harga per unit</span><input value={priceInput} onChange={(event) => setPriceInput(event.target.value.replace(/\D/g, ""))} inputMode="numeric" required /></label><label><span>Tanggal</span><input type="date" value={date} max={today()} onChange={(event) => setDate(event.target.value)} required /></label>{mode === "units" && <label><span>Jumlah unit</span><input value={unitsInput} onChange={(event) => setUnitsInput(event.target.value.replace(/[^\d.,]/g, ""))} inputMode="decimal" placeholder="0,00000000" required /></label>}{mode === "nominal" && <label><span>{type === "buy" ? "Total budget" : "Target bersih"}</span><input value={nominalInput} onChange={(event) => setNominalInput(event.target.value.replace(/\D/g, ""))} inputMode="numeric" required /></label>}{mode === "all" && <label><span>Unit dijual</span><input value={selected ? formatUnits(selected.units) : "0"} readOnly /></label>}<label><span>Fee</span><input value={feeInput} onChange={(event) => setFeeInput(event.target.value.replace(/\D/g, ""))} inputMode="numeric" /></label><label><span>Pajak</span><input value={taxInput} onChange={(event) => setTaxInput(event.target.value.replace(/\D/g, ""))} inputMode="numeric" /></label><label className="full-field"><span>Catatan</span><input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Opsional" /></label></div>
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
    <div className="form-grid"><label><span>Saldo aktual</span><input value={actualBalance} onChange={(event) => setActualBalance(event.target.value.replace(/\D/g, ""))} inputMode="numeric" pattern="[0-9]+" required autoFocus /></label><label><span>Tanggal saldo</span><input type="date" value={date} max={today()} onChange={(event) => setDate(event.target.value)} required /></label><label className="full-field"><span>Alasan / catatan</span><input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Contoh: Cocokkan dengan mutasi rekening" required /></label></div>
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

function SimpleModal({ title, kicker, saving, onClose, onSubmit, children }: { title: string; kicker: string; saving: boolean; onClose: () => void; onSubmit: (event: FormEvent) => void | Promise<void>; children: React.ReactNode }) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className="modal compact-modal" role="dialog" aria-modal="true"><div className="modal-head"><div><span className="card-kicker">{kicker}</span><h2>{title}</h2></div><button className="icon-button" onClick={onClose} aria-label="Tutup"><X size={20} /></button></div><form onSubmit={onSubmit}>{children}<div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose} disabled={saving}>Batal</button><button className="primary-button" disabled={saving}><Check size={17} /> {saving ? "Menyimpan…" : "Simpan"}</button></div></form></section></div>;
}
