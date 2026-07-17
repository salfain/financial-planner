"use client";

import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Bell,
  Bot,
  Building2,
  CalendarDays,
  Check,
  ChevronDown,
  CircleDollarSign,
  CreditCard,
  Database,
  Download,
  Eye,
  EyeOff,
  FileText,
  History,
  Landmark,
  LayoutDashboard,
  Menu,
  Moon,
  MoreHorizontal,
  Pencil,
  Plus,
  ReceiptText,
  Search,
  Send,
  Settings,
  Scale,
  ShieldCheck,
  Sparkles,
  Sun,
  Target,
  Tags,
  Trash2,
  TrendingUp,
  Upload,
  WalletCards,
  X,
  type LucideIcon,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
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
  archiveFinanceAccount,
  archiveFinanceCategory,
  contributeFinanceGoal,
  createFinanceAccount,
  createFinanceBill,
  createFinanceCategory,
  createFinanceGoal,
  createFinanceInvestmentAsset,
  createFinanceInvestmentTrade,
  createFinanceTransaction,
  deleteFinanceTransaction,
  financeBackendLabel,
  loadFinanceSnapshot,
  markFinanceBillPaid,
  reconcileFinanceAccount,
  setupFinanceWorkspace,
  updateFinanceCategory,
  updateFinanceInvestmentAsset,
  updateFinanceTransaction,
  upsertFinanceBudget,
} from "../lib/finance-client";

type PageKey =
  | "dashboard"
  | "transactions"
  | "accounts"
  | "budgets"
  | "goals"
  | "bills"
  | "investments"
  | "reports"
  | "assistant"
  | "settings";

type StoredData = {
  accounts: Account[];
  transactions: Transaction[];
  budgets: Budget[];
  goals: Goal[];
  bills: Bill[];
  categories: FinanceCategory[];
  auditLogs: AuditLog[];
  investmentAssets: InvestmentAsset[];
  investmentTransactions: InvestmentTransaction[];
};

const currentMonth = () => getCurrentMonth();
const today = () => {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
};
const monthLabel = (month: string) => formatMonthLabel(month);

const navPrimary: { key: PageKey; label: string; icon: LucideIcon }[] = [
  { key: "dashboard", label: "Ringkasan", icon: LayoutDashboard },
  { key: "transactions", label: "Transaksi", icon: ReceiptText },
  { key: "accounts", label: "Akun", icon: WalletCards },
  { key: "budgets", label: "Anggaran", icon: BarChart3 },
  { key: "goals", label: "Target", icon: Target },
  { key: "bills", label: "Tagihan", icon: CalendarDays },
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
  transactions: { eyebrow: "Ledger utama", title: "Semua transaksi", subtitle: "Pantau setiap pergerakan uang tanpa menghitung transfer dua kali." },
  accounts: { eyebrow: "6 akun aktif", title: "Akun & saldo", subtitle: "Semua rekening, dompet, kewajiban, dan investasi dalam satu tampilan." },
  budgets: { eyebrow: "Rencana Juli", title: "Anggaran bulanan", subtitle: "Kendalikan pengeluaran sebelum melewati batas yang kamu tentukan." },
  goals: { eyebrow: "3 target aktif", title: "Target finansial", subtitle: "Lihat kemajuan dan kebutuhan kontribusi bulanan untuk setiap tujuan." },
  bills: { eyebrow: "3 menunggu", title: "Tagihan rutin", subtitle: "Jangan lewatkan jatuh tempo dan hindari pencatatan ganda." },
  investments: { eyebrow: "Portofolio", title: "Portofolio investasi", subtitle: "Pantau unit, cost basis, harga, dan profit/loss tanpa mengubah arus kas operasional." },
  reports: { eyebrow: "Laporan bulanan", title: "Laporan keuangan", subtitle: "Ringkasan siap cetak dengan data yang dapat ditelusuri kembali." },
  assistant: { eyebrow: "Analisis lokal · read-only", title: "VINN Insight", subtitle: "Baca indikator keuangan tanpa mengubah data apa pun." },
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
  return <span className="brand-mark">V</span>;
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
  const [profile, setProfile] = useState<FinanceProfile>({ name: "Vinn", storeName: "VINN STORE", currency: "IDR", timezone: "Asia/Jakarta" });
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

  const monthly = useMemo(() => monthlySummary(transactions, month), [transactions, month]);
  const investmentMarketValue = useMemo(() => investmentAssets.reduce((sum, asset) => sum + asset.marketValue, 0), [investmentAssets]);
  const accountTotals = useMemo(() => accountSummary(accounts, investmentMarketValue), [accounts, investmentMarketValue]);
  const healthScore = useMemo(() => calculateHealthScore(transactions, accounts, budgets, month), [transactions, accounts, budgets, month]);

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

  const addTransaction = async (transaction: Transaction) => runMutation(
    () => createFinanceTransaction(transaction),
    transaction.type === "transfer" ? "Transfer berhasil dicatat secara utuh." : "Transaksi berhasil disimpan.",
  );

  const editTransaction = async (transaction: Transaction, requestId?: string) => runMutation(
    () => updateFinanceTransaction(transaction, requestId),
    "Transaksi dan saldo terkait berhasil diperbarui.",
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

  const openCreateForPage = () => {
    if (activePage === "accounts") return setAccountOpen(true);
    if (activePage === "budgets") return setBudgetOpen(true);
    if (activePage === "goals") return setGoalOpen(true);
    if (activePage === "bills") return setBillOpen(true);
    if (activePage === "investments") return setInvestmentAssetModal({});
    setTransactionOpen(true);
  };

  const createLabel = activePage === "accounts" ? "Tambah akun" : activePage === "budgets" ? "Tambah anggaran" : activePage === "goals" ? "Buat target" : activePage === "bills" ? "Tambah tagihan" : activePage === "investments" ? "Tambah aset" : "Tambah transaksi";
  const pendingBills = [...bills].filter((bill) => !bill.paid).sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  const title = { ...pageTitles[activePage] };
  if (activePage === "dashboard") { title.eyebrow = monthLabel(month); title.title = `Selamat datang, ${profile.name}`; }
  if (activePage === "accounts") title.eyebrow = `${accounts.length} akun aktif`;
  if (activePage === "budgets") title.eyebrow = `Rencana ${monthLabel(month)}`;
  if (activePage === "goals") title.eyebrow = `${goals.length} target aktif`;
  if (activePage === "bills") title.eyebrow = `${bills.filter((bill) => !bill.paid).length} menunggu`;
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
          <button className="brand" onClick={() => selectPage("dashboard")} aria-label="Buka dashboard VINN STORE">
            <BrandMark />
            <span className="brand-copy"><strong>{profile.storeName}</strong><small>Financial OS</small></span>
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
              <button className="icon-button" onClick={() => setNotificationOpen((value) => !value)} aria-label="Notifikasi" aria-expanded={notificationOpen}>
                <Bell size={18} />{pendingBills.length > 0 && <span className="notification-dot" />}
              </button>
              {notificationOpen && (
                <div className="notification-popover">
                  <div className="popover-head"><strong>Notifikasi</strong><span>{pendingBills.length} perlu dicek</span></div>
                  {pendingBills[0] ? <button onClick={() => { selectPage("bills"); setNotificationOpen(false); }}><span className="notice-icon warning"><CalendarDays size={17} /></span><span><strong>{pendingBills[0].name} belum dibayar</strong><small>Jatuh tempo {shortDate(pendingBills[0].dueDate)}.</small></span></button> : <button onClick={() => { selectPage("bills"); setNotificationOpen(false); }}><span className="notice-icon good"><Check size={17} /></span><span><strong>Semua tagihan selesai</strong><small>Tidak ada tagihan yang menunggu bulan ini.</small></span></button>}
                  <button onClick={() => { selectPage("budgets"); setNotificationOpen(false); }}><span className="notice-icon good"><BarChart3 size={17} /></span><span><strong>{budgets.length} anggaran aktif</strong><small>Pantau realisasi langsung dari transaksi.</small></span></button>
                  <button onClick={() => { selectPage("goals"); setNotificationOpen(false); }}><span className="notice-icon info"><Target size={17} /></span><span><strong>{goals.length} target finansial</strong><small>Kontribusi tersimpan pada data utama.</small></span></button>
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
            {activePage !== "dashboard" && activePage !== "assistant" && activePage !== "settings" && (
              <button className="primary-button" onClick={openCreateForPage}><Plus size={18} /> {createLabel}</button>
            )}
          </section>

          {activePage === "dashboard" && <DashboardPage transactions={transactions} accounts={accounts} budgets={budgets} bills={bills} goals={goals} privacy={privacy} monthly={monthly} accountTotals={accountTotals} healthScore={healthScore} month={month} onNavigate={selectPage} onAdd={() => setTransactionOpen(true)} />}
          {activePage === "transactions" && <TransactionsPage transactions={transactions} accounts={accounts} privacy={privacy} month={month} query={transactionQuery} onQueryChange={setTransactionQuery} onEdit={setEditingTransaction} onDelete={deleteTransaction} />}
          {activePage === "accounts" && <AccountsPage accounts={accounts} privacy={privacy} onAdd={() => setAccountOpen(true)} onArchive={archiveAccount} onReconcile={setReconcileTarget} onInspect={(account) => { setTransactionQuery(account.name); selectPage("transactions"); }} />}
          {activePage === "budgets" && <BudgetsPage budgets={budgets} transactions={transactions} privacy={privacy} month={month} onAdd={() => setBudgetOpen(true)} />}
          {activePage === "goals" && <GoalsPage goals={goals} privacy={privacy} onContribute={contributeGoal} onAdd={() => setGoalOpen(true)} />}
          {activePage === "bills" && <BillsPage bills={bills} accounts={accounts} privacy={privacy} onPay={payBill} onAdd={() => setBillOpen(true)} />}
          {activePage === "investments" && <InvestmentsPage assets={investmentAssets} transactions={investmentTransactions} accounts={accounts} privacy={privacy} onAddAsset={() => setInvestmentAssetModal({})} onEditAsset={(asset) => setInvestmentAssetModal({ asset })} onTrade={(type, asset) => setInvestmentTradeModal({ type, asset })} />}
          {activePage === "reports" && <ReportsPage transactions={transactions} monthly={monthly} accountTotals={accountTotals} privacy={privacy} />}
          {activePage === "assistant" && <AssistantPage monthly={monthly} accountTotals={accountTotals} healthScore={healthScore} privacy={privacy} />}
          {activePage === "settings" && <SettingsPage darkMode={darkMode} setDarkMode={setDarkMode} privacy={privacy} setPrivacy={setPrivacy} data={{ accounts, transactions, budgets, goals, bills, categories, auditLogs, investmentAssets, investmentTransactions }} categories={categories} auditLogs={auditLogs} backendLabel={financeBackendLabel()} onAddCategory={() => setCategoryModal({})} onEditCategory={(category) => setCategoryModal({ category })} onArchiveCategory={archiveCategory} onToast={showToast} />}
        </div>
      </main>

      <nav className="mobile-nav" aria-label="Navigasi seluler">
        {[navPrimary[0], navPrimary[1], navPrimary[3], navPrimary[4]].map((item) => <NavButton key={item.key} item={item} active={activePage === item.key} onClick={() => selectPage(item.key)} />)}
        <button className="mobile-add" onClick={() => setTransactionOpen(true)} aria-label="Tambah transaksi"><Plus size={23} /></button>
      </nav>

      {(transactionOpen || editingTransaction) && <TransactionModal accounts={accounts} categories={categories} initial={editingTransaction ?? undefined} saving={saving} onClose={() => { setTransactionOpen(false); setEditingTransaction(null); }} onSubmit={editingTransaction ? editTransaction : addTransaction} />}
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
        <div className="insight-top"><span><Sparkles size={18} /></span><small>VINN INSIGHT</small></div>
        <h2>Arus kas bulan ini <strong>{monthly.cashflow >= 0 ? "positif" : "perlu perhatian"}</strong>.</h2>
        <p>{monthly.income > 0 ? `Savings rate berada di ${monthly.savingsRate.toFixed(1)}%. Insight ini dihitung langsung dari transaksi yang tersimpan.` : "Tambahkan pemasukan dan pengeluaran agar VINN dapat menyusun insight berdasarkan ledger-mu."}</p>
        <button onClick={() => onNavigate("assistant")}>Buka VINN Insight <ArrowRight size={15} /></button>
      </section>
    </div>
  );
}

function TransactionsPage({ transactions, accounts, privacy, month, query, onQueryChange, onEdit, onDelete }: { transactions: Transaction[]; accounts: Account[]; privacy: boolean; month: string; query: string; onQueryChange: (value: string) => void; onEdit: (transaction: Transaction) => void; onDelete: (transaction: Transaction) => void }) {
  const [filter, setFilter] = useState<"all" | "income" | "expense" | "transfer" | "adjustment">("all");
  const monthTransactions = transactions.filter((item) => item.date.startsWith(month));
  const filtered = transactions.filter((item) => {
    const account = accounts.find((candidate) => candidate.id === item.accountId);
    const matchesQuery = `${item.title} ${item.merchant ?? ""} ${item.category} ${account?.name ?? ""}`.toLowerCase().includes(query.toLowerCase());
    const matchesType = filter === "all" || item.type === filter || (filter === "adjustment" && (item.type === "adjustment_in" || item.type === "adjustment_out"));
    return matchesQuery && matchesType;
  }).sort((a, b) => b.date.localeCompare(a.date));
  return (
    <div className="content-stack">
      <div className="summary-strip">
        <div><span>Total transaksi</span><strong>{monthTransactions.length}</strong><small>{monthLabel(month)}</small></div>
        <div><span>Pemasukan</span><Amount value={monthlySummary(monthTransactions, month).income} privacy={privacy} /><small className="positive-text">Bulan aktif</small></div>
        <div><span>Pengeluaran</span><Amount value={monthlySummary(monthTransactions, month).expense} privacy={privacy} /><small>Di luar transfer</small></div>
        <div><span>Transfer internal</span><Amount value={monthTransactions.filter((item) => item.type === "transfer").reduce((sum, item) => sum + item.amount, 0)} privacy={privacy} /><small>Tidak masuk cashflow</small></div>
      </div>
      <section className="panel table-panel">
        <div className="filter-row">
          <label className="table-search"><Search size={17} /><input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="Cari merchant, akun, atau kategori" /></label>
          <div className="filter-tabs">
            {(["all", "income", "expense", "transfer", "adjustment"] as const).map((item) => <button key={item} className={filter === item ? "active" : ""} onClick={() => setFilter(item)}>{item === "all" ? "Semua" : item === "income" ? "Masuk" : item === "expense" ? "Keluar" : item === "transfer" ? "Transfer" : "Penyesuaian"}</button>)}
          </div>
          <button className="secondary-button" disabled title="Impor CSV akan tersedia pada tahap integrasi berikutnya"><Upload size={16} /> Impor CSV · segera</button>
        </div>
        {filtered.length > 0 ? <TransactionTable transactions={filtered} accounts={accounts} privacy={privacy} onEdit={onEdit} onDelete={onDelete} /> : <div className="empty-state"><Search size={28} /><h3>Transaksi tidak ditemukan</h3><p>Coba gunakan kata kunci atau filter yang berbeda.</p></div>}
      </section>
    </div>
  );
}

function TransactionTable({ transactions, accounts, privacy, compact = false, onEdit, onDelete }: { transactions: Transaction[]; accounts: Account[]; privacy: boolean; compact?: boolean; onEdit?: (transaction: Transaction) => void; onDelete?: (transaction: Transaction) => void }) {
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
        <span className="transaction-main"><strong>{transaction.title}</strong><small>{isAdjustment ? adjustmentLabel : transaction.merchant ?? transaction.category}</small></span>
        <span className="transaction-date">{shortDate(transaction.date)}</span>
        <span className="transaction-account">{account?.name ?? "Alokasi virtual"}</span>
        <span className={`transaction-status ${transaction.status === "pending" ? "pending" : ""}`}><i /> {transaction.status === "pending" ? "Menunggu" : "Selesai"}</span>
        <Amount value={transaction.amount} privacy={privacy} className={`transaction-amount ${isAdjustment || isTransfer ? "" : isPositive ? "positive-text" : "negative-text"}`} />
        {(onEdit || onDelete) && <span className="transaction-actions">{onEdit && editable && <button className="transaction-edit" onClick={() => onEdit(transaction)} aria-label={`Edit ${transaction.title}`}><Pencil size={14} /></button>}{onDelete && <button className="transaction-delete" onClick={() => window.confirm("Pindahkan transaksi ini ke Trash?") && onDelete(transaction)} aria-label={`Hapus ${transaction.title}`}><Trash2 size={14} /></button>}</span>}
      </div>;
    })}
  </div>;
}

function AccountsPage({ accounts, privacy, onAdd, onArchive, onReconcile, onInspect }: { accounts: Account[]; privacy: boolean; onAdd: () => void; onArchive: (id: string) => void; onReconcile: (account: Account) => void; onInspect: (account: Account) => void }) {
  const totals = accountSummary(accounts);
  return <div className="content-stack">
    <div className="summary-strip account-summary">
      <div><span>Saldo likuid</span><Amount value={totals.liquid} privacy={privacy} /><small>Bank, e-wallet, cash</small></div>
      <div><span>Nilai investasi</span><Amount value={totals.investment} privacy={privacy} /><small>Menurut saldo ledger</small></div>
      <div><span>Total kewajiban</span><Amount value={totals.liabilities} privacy={privacy} /><small className="negative-text">Perlu dibayar</small></div>
      <div><span>Kekayaan bersih</span><Amount value={totals.netWorth} privacy={privacy} /><small>Setelah kewajiban</small></div>
    </div>
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

function BillsPage({ bills, accounts, privacy, onPay, onAdd }: { bills: Bill[]; accounts: Account[]; privacy: boolean; onPay: (bill: Bill) => void; onAdd: () => void }) {
  const pending = bills.filter((bill) => !bill.paid);
  return <div className="content-stack">
    <div className="summary-strip">
      <div><span>Belum dibayar</span><strong>{pending.length} tagihan</strong><small>{monthLabel(currentMonth())}</small></div>
      <div><span>Total mendatang</span><Amount value={pending.reduce((sum, bill) => sum + bill.amount, 0)} privacy={privacy} /><small>Menurut jatuh tempo</small></div>
      <div><span>Sudah dibayar</span><strong>{bills.filter((bill) => bill.paid).length} tagihan</strong><small className="positive-text">Tepat waktu</small></div>
      <div><span>Autopost</span><strong>Nonaktif</strong><small>Sesuai rekomendasi PRD</small></div>
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

function ReportsPage({ transactions, monthly, accountTotals, privacy }: { transactions: Transaction[]; monthly: ReturnType<typeof monthlySummary>; accountTotals: ReturnType<typeof accountSummary>; privacy: boolean }) {
  const month = currentMonth();
  const monthTransactions = transactions.filter((item) => item.date.startsWith(month) && item.status === "completed");
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
  const escapeCsv = (value: string) => {
    const safe = /^[=+\-@]/.test(value) ? `'${value}` : value;
    return `"${safe.replaceAll('"', '""')}"`;
  };
  const exportCsv = () => {
    const rows = [["Tanggal", "Tipe", "Deskripsi", "Kategori", "Nominal"], ...monthTransactions.map((item) => [item.date, item.type, item.title, item.category, String(item.amount)])];
    const blob = new Blob(["\uFEFF", rows.map((row) => row.map(escapeCsv).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = `vinn-store-transaksi-${month}.csv`; anchor.click(); URL.revokeObjectURL(url);
  };
  return <div className="report-layout">
    <section className="report-sheet">
      <div className="report-brand"><BrandMark /><span><strong>VINN STORE</strong><small>Financial OS</small></span><div><small>LAPORAN BULANAN</small><strong>{monthLabel(month)}</strong></div></div>
      <div className="report-title"><span>Ringkasan eksekutif</span><h2>{reportHeadline}</h2><p>Savings rate tercatat {monthly.savingsRate.toFixed(1)}% dan rasio kewajiban terhadap aset {liabilityRatio.toFixed(1)}%.</p></div>
      <div className="report-metrics"><div><span>Kekayaan bersih</span><Amount value={accountTotals.netWorth} privacy={privacy} /></div><div><span>Arus kas bersih</span><Amount value={monthly.cashflow} privacy={privacy} /></div><div><span>Savings rate</span><strong>{monthly.savingsRate.toFixed(1)}%</strong></div></div>
      <div className="report-section"><span className="card-kicker">Arus kas bulanan</span><div className="report-bars"><div><span>Pemasukan</span><i style={{ width: `${monthly.income / chartMax * 100}%` }} /><Amount value={monthly.income} privacy={privacy} /></div><div><span>Pengeluaran</span><i className="expense-bar" style={{ width: `${monthly.expense / chartMax * 100}%` }} /><Amount value={monthly.expense} privacy={privacy} /></div><div><span>Tabungan</span><i className="saving-bar" style={{ width: `${Math.max(0, monthly.cashflow) / chartMax * 100}%` }} /><Amount value={monthly.cashflow} privacy={privacy} /></div></div></div>
      <div className="report-note"><Sparkles size={18} /><p><strong>Catatan:</strong> {reportNote}</p></div>
    </section>
    <aside className="report-actions panel"><span className="card-kicker">Ekspor</span><h2>Bagikan laporan</h2><p>Unduh data transaksi atau cetak laporan ini sebagai PDF melalui browser.</p><button className="primary-button full" onClick={() => window.print()}><FileText size={17} /> Cetak / Simpan PDF</button><button className="secondary-button full" onClick={exportCsv}><Download size={17} /> Unduh CSV</button><div className="security-note"><ShieldCheck size={18} /><span><strong>Privasi terjaga</strong><small>Ekspor dibuat langsung di perangkatmu.</small></span></div></aside>
  </div>;
}

function AssistantPage({ monthly, accountTotals, healthScore, privacy }: { monthly: ReturnType<typeof monthlySummary>; accountTotals: ReturnType<typeof accountSummary>; healthScore: number; privacy: boolean }) {
  const month = currentMonth();
  const liabilityRatio = accountTotals.assets > 0 ? accountTotals.liabilities / accountTotals.assets * 100 : accountTotals.liabilities > 0 ? 100 : 0;
  const [messages, setMessages] = useState<{ role: "ai" | "user"; text: string }[]>([{ role: "ai", text: "Halo Vinn! Insight ini dihitung secara lokal dari ringkasan ledger. Modul ini tidak menggunakan AI eksternal dan tidak dapat mengubah transaksi." }]);
  const [input, setInput] = useState("");
  const send = (question?: string) => {
    const text = (question ?? input).trim(); if (!text) return;
    const answer = text.toLowerCase().includes("hemat") || text.toLowerCase().includes("tabung")
      ? monthly.income > 0 ? `Savings rate ${monthLabel(month)} ada di ${monthly.savingsRate.toFixed(1)}%. Arus kas bersihmu ${privacy ? "sudah dihitung dari ledger" : formatIDR(monthly.cashflow)}. Pertahankan pengeluaran di bawah pemasukan dan alokasikan surplus sesuai prioritasmu.` : "Belum ada pemasukan bulan ini, jadi savings rate belum dapat menjadi dasar rekomendasi. Catat pemasukan dan pengeluaran terlebih dahulu."
      : text.toLowerCase().includes("utang")
        ? `Total kewajibanmu ${privacy ? "telah dihitung" : formatIDR(accountTotals.liabilities)}, setara ${liabilityRatio.toFixed(1)}% dari aset. Tinjau jadwal tagihan dan prioritaskan kewajiban dengan jatuh tempo terdekat.`
        : `Skor kesehatan finansialmu ${healthScore}/100. Skor ini dihitung deterministik dari savings rate, likuiditas, rasio utang, dan kepatuhan anggaran.`;
    setMessages((current) => [...current, { role: "user", text }, { role: "ai", text: answer }]); setInput("");
  };
  return <div className="assistant-layout">
    <section className="assistant-chat panel">
      <div className="assistant-banner"><span><Bot size={21} /></span><div><strong>VINN Insight</strong><small>Analisis lokal {monthLabel(month)} · Read only</small></div><span className="online"><i /> Aktif</span></div>
      <div className="chat-body">
        {messages.map((message, index) => <div className={`chat-message ${message.role}`} key={index}>{message.role === "ai" && <span><Sparkles size={16} /></span>}<p>{message.text}</p></div>)}
      </div>
      <div className="suggestion-chips"><button onClick={() => send("Bagaimana cara menabung lebih banyak?")}>Cara menabung lebih banyak</button><button onClick={() => send("Apakah utang saya aman?")}>Apakah utang saya aman?</button></div>
      <form className="chat-input" onSubmit={(event) => { event.preventDefault(); send(); }}><input value={input} onChange={(event) => setInput(event.target.value)} placeholder="Tanya tentang kondisi keuanganmu..." aria-label="Pertanyaan untuk VINN Insight" /><button aria-label="Kirim pertanyaan"><Send size={18} /></button></form>
    </section>
    <aside className="assistant-context panel"><span className="card-kicker">Data yang dibaca</span><h2>Ringkasan agregat</h2><p>Analisis rule-based ini hanya membaca angka ringkasan berikut.</p><div><span><CircleDollarSign size={17} /> Arus kas {monthLabel(month)}</span><strong>Digunakan</strong></div><div><span><WalletCards size={17} /> Total akun</span><strong>Digunakan</strong></div><div><span><ReceiptText size={17} /> Detail merchant</span><strong className="disabled-text">Tidak digunakan</strong></div><div><span><CreditCard size={17} /> Nomor akun</span><strong className="disabled-text">Tidak digunakan</strong></div><small className="ai-disclaimer">Insight bersifat informatif dan bukan pengganti penasihat keuangan profesional.</small></aside>
  </div>;
}

function SettingsPage({ darkMode, setDarkMode, privacy, setPrivacy, data, categories, auditLogs, backendLabel, onAddCategory, onEditCategory, onArchiveCategory, onToast }: {
  darkMode: boolean;
  setDarkMode: (value: boolean) => void;
  privacy: boolean;
  setPrivacy: (value: boolean) => void;
  data: StoredData;
  categories: FinanceCategory[];
  auditLogs: AuditLog[];
  backendLabel: string;
  onAddCategory: () => void;
  onEditCategory: (category: FinanceCategory) => void;
  onArchiveCategory: (categoryId: string) => void;
  onToast: (message: string) => void;
}) {
  const backup = () => {
    const blob = new Blob([JSON.stringify({ version: 2, exportedAt: new Date().toISOString(), ...data }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "vinn-store-backup.json";
    anchor.click();
    URL.revokeObjectURL(url);
    onToast("Backup berhasil dibuat.");
  };
  const editableCategories = categories.filter((category) => category.active && (category.type === "income" || category.type === "expense"));
  return <div className="settings-layout">
    <section className="panel settings-section"><div className="settings-title"><span><Settings size={20} /></span><div><h2>Preferensi tampilan</h2><p>Atur pengalaman dashboard di perangkat ini.</p></div></div><div className="settings-row"><div><strong>Tema gelap</strong><small>Kurangi cahaya pada malam hari.</small></div><button className={`switch ${darkMode ? "on" : ""}`} onClick={() => setDarkMode(!darkMode)} aria-pressed={darkMode}><span /></button></div><div className="settings-row"><div><strong>Privacy mode</strong><small>Sembunyikan semua nominal sensitif.</small></div><button className={`switch ${privacy ? "on" : ""}`} onClick={() => setPrivacy(!privacy)} aria-pressed={privacy}><span /></button></div></section>
    <section className="panel settings-section"><div className="settings-title"><span><Building2 size={20} /></span><div><h2>Penyimpanan utama</h2><p>Status backend finansial aktif.</p></div></div><div className="connection-card"><span className="google-mark"><Database size={18} /></span><div><strong>{backendLabel}</strong><small>{backendLabel === "Google Sheets" ? "Terhubung melalui Google Apps Script." : "Terhubung ke database situs."}</small></div><span className="connection-status"><i /> Terhubung</span></div></section>
    <section className="panel settings-section settings-wide"><div className="settings-title"><span><Tags size={20} /></span><div><h2>Kategori transaksi</h2><p>Kategori aktif dipakai langsung pada transaksi, anggaran, dan tagihan.</p></div><button className="secondary-button settings-title-action" onClick={onAddCategory}><Plus size={15} /> Tambah kategori</button></div><div className="category-manager">{editableCategories.map((category) => <div className="category-manager-row" key={category.id}><i style={{ background: category.color }} /><div><strong>{category.name}</strong><small>{category.type === "income" ? "Pemasukan" : "Pengeluaran"}{category.isDefault ? " · bawaan" : ""}</small></div><span><button className="icon-button small" onClick={() => onEditCategory(category)} aria-label={`Edit kategori ${category.name}`}><Pencil size={14} /></button>{!category.isDefault && <button className="icon-button small danger" onClick={() => window.confirm(`Arsipkan kategori ${category.name}? Transaksi lama tetap aman.`) && onArchiveCategory(category.id)} aria-label={`Arsipkan kategori ${category.name}`}><Trash2 size={14} /></button>}</span></div>)}{!editableCategories.length && <div className="settings-empty">Belum ada kategori aktif.</div>}</div></section>
    <section className="panel settings-section"><div className="settings-title"><span><ShieldCheck size={20} /></span><div><h2>Data & keamanan</h2><p>Backup portabel dari data yang sedang tersinkron.</p></div></div><div className="settings-actions"><button className="secondary-button" onClick={backup}><Download size={17} /> Unduh backup JSON</button></div><div className="settings-footnote">Data finansial utama tersimpan di backend, bukan localStorage. Setiap perubahan melewati validasi API dan ledger.</div></section>
    <section className="panel settings-section"><div className="settings-title"><span><History size={20} /></span><div><h2>Audit trail</h2><p>20 aktivitas terbaru yang tercatat di workspace.</p></div></div><div className="audit-list">{auditLogs.slice(0, 20).map((log) => <div key={log.id}><span><strong>{log.action.replaceAll("_", " ")}</strong><small>{log.module}{log.entityId ? ` · ${log.entityId.slice(0, 18)}` : ""}</small></span><time>{log.createdAt ? new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date(log.createdAt)) : "—"}</time></div>)}{!auditLogs.length && <div className="settings-empty">Belum ada aktivitas yang tercatat.</div>}</div></section>
  </div>;
}

function TransactionModal({ accounts, categories, initial, saving, onClose, onSubmit }: { accounts: Account[]; categories: FinanceCategory[]; initial?: Transaction; saving: boolean; onClose: () => void; onSubmit: (transaction: Transaction, requestId?: string) => Promise<boolean> }) {
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
  const explainOcr = () => setOcrMessage("OCR belum diaktifkan. Hubungkan Gemini API pada tahap AI/OCR; tidak ada data contoh yang dimasukkan.");
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
        {!initial && <button type="button" className="ocr-button" onClick={explainOcr}><Upload size={17} /><span><strong>Isi dari foto struk</strong><small>Memerlukan konfigurasi Gemini API.</small></span></button>}
        {ocrMessage && <div className="ocr-message"><Sparkles size={15} />{ocrMessage}</div>}
        {!sourceAccounts.length && <div className="ocr-message"><WalletCards size={15} />Tambahkan akun pembayaran sebelum mencatat transaksi.</div>}
        {!availableCategories.length && type !== "transfer" && type !== "investment_buy" && !initial && <div className="ocr-message"><Tags size={15} />Tambahkan kategori {categoryType === "income" ? "pemasukan" : "pengeluaran"} di Pengaturan.</div>}
        <div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose} disabled={saving}>Batal</button><button className="primary-button" type="submit" disabled={saving || !sourceAccounts.length || (type === "transfer" && accounts.length < 2) || (type !== "transfer" && type !== "investment_buy" && !category)}><Check size={17} /> {saving ? "Menyimpan…" : initial ? "Simpan perubahan" : "Simpan transaksi"}</button></div>
      </form>
    </section>
  </div>;
}

function LoadingWorkspace() {
  return <main className="workspace-state"><BrandMark /><div className="workspace-spinner" /><h1>Menyiapkan VINN STORE</h1><p>Membaca akun, ledger, anggaran, target, dan tagihan dari penyimpanan utama.</p></main>;
}

function SetupWizard({ error, saving, onRetry, onSubmit }: { error: string | null; saving: boolean; onRetry: () => void; onSubmit: (input: SetupWorkspaceInput) => Promise<void> }) {
  const [profileName, setProfileName] = useState("Vinn");
  const [storeName, setStoreName] = useState("VINN STORE");
  const [accountName, setAccountName] = useState("Rekening Utama");
  const [accountType, setAccountType] = useState("Bank");
  const [institution, setInstitution] = useState("");
  const [openingBalance, setOpeningBalance] = useState("");
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    await onSubmit({
      profileName: profileName.trim() || "Vinn",
      storeName: storeName.trim() || "VINN STORE",
      currency: "IDR",
      timezone: "Asia/Jakarta",
      accounts: [{ name: accountName.trim(), type: accountType, institution: institution.trim(), openingBalance: Number(openingBalance.replace(/\D/g, "") || 0), color: "#126b59" }],
    });
  };
  return <main className="setup-shell">
    <section className="setup-copy">
      <div className="brand setup-brand"><BrandMark /><span className="brand-copy"><strong>VINN STORE</strong><small>Financial OS</small></span></div>
      <span className="setup-kicker"><ShieldCheck size={15} /> Setup aman dan dapat dijalankan ulang</span>
      <h1>Mulai dari data keuanganmu sendiri.</h1>
      <p>Tidak ada transaksi dummy yang dimasukkan. Buat akun pertama, lalu seluruh dashboard akan dihitung dari ledger yang kamu catat.</p>
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
          <label><span>Jenis akun</span><select value={accountType} onChange={(event) => setAccountType(event.target.value)}>{["Bank", "E-Wallet", "Cash", "Credit Card"].map((item) => <option key={item}>{item}</option>)}</select><ChevronDown size={15} /></label>
          <label><span>Institusi</span><input value={institution} onChange={(event) => setInstitution(event.target.value)} placeholder="Contoh: Bank BCA" /></label>
          <label><span>Saldo awal</span><input value={openingBalance} onChange={(event) => setOpeningBalance(event.target.value.replace(/\D/g, ""))} inputMode="numeric" placeholder="0" /></label>
        </div>
        <button className="primary-button setup-submit" disabled={saving}>{saving ? "Menyiapkan workspace…" : "Buat workspace VINN STORE"}<ArrowRight size={17} /></button>
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
    <div className="form-grid"><label><span>Nama akun</span><input value={name} onChange={(event) => setName(event.target.value)} required autoFocus /></label><label><span>Jenis akun</span><select value={type} onChange={(event) => setType(event.target.value)}>{["Bank", "E-Wallet", "Cash", "Credit Card", "Investment"].map((item) => <option key={item}>{item}</option>)}</select><ChevronDown size={15} /></label><label><span>Institusi</span><input value={institution} onChange={(event) => setInstitution(event.target.value)} placeholder="Opsional" /></label><label><span>Saldo awal</span><input value={openingBalance} onChange={(event) => setOpeningBalance(event.target.value.replace(/\D/g, ""))} inputMode="numeric" placeholder="0" /></label></div>
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
  return <SimpleModal title="Tagihan rutin" kicker="Reminder" saving={saving} onClose={onClose} onSubmit={(event) => { event.preventDefault(); return onSubmit({ name: name.trim(), amount: Number(amount || 0), category, dueDate, accountId, frequency: "monthly" }); }}>
    <div className="form-grid"><label><span>Nama tagihan</span><input value={name} onChange={(event) => setName(event.target.value)} required autoFocus /></label><label><span>Nominal</span><input value={amount} onChange={(event) => setAmount(event.target.value.replace(/\D/g, ""))} inputMode="numeric" pattern="[1-9][0-9]*" required /></label><label><span>Kategori</span><select value={category} onChange={(event) => setCategory(event.target.value)} required><option value="" disabled>Pilih kategori</option>{expenseCategories.map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}</select><ChevronDown size={15} /></label><label><span>Jatuh tempo</span><input type="date" min={today()} value={dueDate} onChange={(event) => setDueDate(event.target.value)} required /></label><label><span>Akun pembayaran</span><select value={accountId} onChange={(event) => setAccountId(event.target.value)} required><option value="" disabled>Pilih akun</option>{paymentAccounts.map((account) => <option value={account.id} key={account.id}>{account.name}</option>)}</select><ChevronDown size={15} /></label></div>
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
