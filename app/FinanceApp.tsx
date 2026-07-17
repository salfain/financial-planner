"use client";

import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Bell,
  Bot,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  Check,
  ChevronDown,
  CircleDollarSign,
  CreditCard,
  Download,
  Eye,
  EyeOff,
  FileText,
  Landmark,
  LayoutDashboard,
  Menu,
  Moon,
  MoreHorizontal,
  Plus,
  ReceiptText,
  RefreshCw,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Sparkles,
  Sun,
  Target,
  TrendingUp,
  Upload,
  WalletCards,
  X,
  type LucideIcon,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Account,
  Bill,
  Goal,
  Transaction,
  TransactionType,
  accountSummary,
  applyTransaction,
  budgetSpent,
  calculateHealthScore,
  formatIDR,
  initialAccounts,
  initialBills,
  initialBudgets,
  initialGoals,
  initialInvestments,
  initialTransactions,
  investmentCost,
  investmentValue,
  monthlySummary,
} from "../lib/finance";

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
  goals: Goal[];
  bills: Bill[];
};

const STORAGE_KEY = "vinn-store-finance-v1";

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
  { key: "assistant", label: "VINN AI", icon: Sparkles },
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
  dashboard: { eyebrow: "Juli 2026", title: "Selamat malam, Vinn", subtitle: "Keuanganmu bergerak ke arah yang sehat bulan ini." },
  transactions: { eyebrow: "Ledger utama", title: "Semua transaksi", subtitle: "Pantau setiap pergerakan uang tanpa menghitung transfer dua kali." },
  accounts: { eyebrow: "6 akun aktif", title: "Akun & saldo", subtitle: "Semua rekening, dompet, kewajiban, dan investasi dalam satu tampilan." },
  budgets: { eyebrow: "Rencana Juli", title: "Anggaran bulanan", subtitle: "Kendalikan pengeluaran sebelum melewati batas yang kamu tentukan." },
  goals: { eyebrow: "3 target aktif", title: "Target finansial", subtitle: "Lihat kemajuan dan kebutuhan kontribusi bulanan untuk setiap tujuan." },
  bills: { eyebrow: "3 menunggu", title: "Tagihan rutin", subtitle: "Jangan lewatkan jatuh tempo dan hindari pencatatan ganda." },
  investments: { eyebrow: "Pembaruan 17 Jul, 19.40", title: "Portofolio investasi", subtitle: "Nilai pasar, biaya rata-rata, dan performa asetmu." },
  reports: { eyebrow: "Laporan Juli", title: "Laporan keuangan", subtitle: "Ringkasan siap cetak dengan data yang dapat ditelusuri kembali." },
  assistant: { eyebrow: "Read-only assistant", title: "VINN AI", subtitle: "Tanyakan kondisi keuanganmu tanpa memberi izin AI mengubah data." },
  settings: { eyebrow: "Workspace personal", title: "Pengaturan", subtitle: "Kelola preferensi, keamanan data, backup, dan koneksi Google." },
};

const shortDate = (date: string) =>
  new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short" }).format(new Date(`${date}T12:00:00`));

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
  const [accounts, setAccounts] = useState(initialAccounts);
  const [transactions, setTransactions] = useState(initialTransactions);
  const [goals, setGoals] = useState(initialGoals);
  const [bills, setBills] = useState(initialBills);
  const [privacy, setPrivacy] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [transactionOpen, setTransactionOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const data = JSON.parse(saved) as StoredData;
        setAccounts(data.accounts ?? initialAccounts);
        setTransactions(data.transactions ?? initialTransactions);
        setGoals(data.goals ?? initialGoals);
        setBills(data.bills ?? initialBills);
      } catch {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    }
    setDarkMode(window.localStorage.getItem("vinn-store-theme") === "dark");
    setHydrated(true);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = darkMode ? "dark" : "light";
    if (hydrated) window.localStorage.setItem("vinn-store-theme", darkMode ? "dark" : "light");
  }, [darkMode, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ accounts, transactions, goals, bills }));
  }, [accounts, transactions, goals, bills, hydrated]);

  const monthly = useMemo(() => monthlySummary(transactions), [transactions]);
  const accountTotals = useMemo(() => accountSummary(accounts), [accounts]);
  const healthScore = useMemo(() => calculateHealthScore(transactions, accounts, initialBudgets), [transactions, accounts]);

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 2800);
  };

  const selectPage = (page: PageKey) => {
    setActivePage(page);
    setSidebarOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const addTransaction = (transaction: Transaction) => {
    setTransactions((current) => [transaction, ...current]);
    setAccounts((current) => applyTransaction(current, transaction));
    showToast(transaction.type === "transfer" ? "Transfer berhasil dicatat secara utuh." : "Transaksi berhasil disimpan.");
  };

  const payBill = (bill: Bill) => {
    if (bill.paid) return;
    const transaction: Transaction = {
      id: `tx-${Date.now()}`,
      type: "expense",
      date: "2026-07-17",
      title: `Bayar ${bill.name}`,
      merchant: bill.name,
      category: bill.category === "Kewajiban" ? "Tagihan" : bill.category,
      accountId: bill.accountId,
      amount: bill.amount,
      status: "completed",
    };
    setBills((current) => current.map((item) => (item.id === bill.id ? { ...item, paid: true } : item)));
    addTransaction(transaction);
  };

  const contributeGoal = (goal: Goal) => {
    const contribution = Math.min(500_000, goal.target - goal.current);
    if (contribution <= 0) return;
    setGoals((current) => current.map((item) => (item.id === goal.id ? { ...item, current: item.current + contribution } : item)));
    setTransactions((current) => [{
      id: `tx-${Date.now()}`,
      type: "transfer",
      date: "2026-07-17",
      title: `Alokasi ${goal.name}`,
      category: "Transfer",
      accountId: "jago",
      amount: contribution,
      status: "completed",
    }, ...current]);
    showToast(`${formatIDR(contribution)} dialokasikan ke ${goal.name}.`);
  };

  const resetDemo = () => {
    setAccounts(initialAccounts);
    setTransactions(initialTransactions);
    setGoals(initialGoals);
    setBills(initialBills);
    window.localStorage.removeItem(STORAGE_KEY);
    showToast("Data demo dipulihkan.");
  };

  const title = pageTitles[activePage];

  return (
    <div className="app-shell">
      <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="sidebar-head">
          <button className="brand" onClick={() => selectPage("dashboard")} aria-label="Buka dashboard VINN STORE">
            <BrandMark />
            <span className="brand-copy"><strong>VINN STORE</strong><small>Financial OS</small></span>
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
          <div className="sidebar-card-icon"><ShieldCheck size={20} /></div>
          <div><strong>Data milikmu</strong><p>Tersimpan lokal dalam mode demo dan siap dihubungkan ke Google Sheets.</p></div>
          <span className="status-pill"><span /> Aman</span>
        </div>
        <div className="profile-row">
          <div className="avatar">VI</div>
          <div><strong>Vinn</strong><small>Owner</small></div>
          <MoreHorizontal size={18} />
        </div>
      </aside>

      {sidebarOpen && <button className="sidebar-scrim" onClick={() => setSidebarOpen(false)} aria-label="Tutup menu" />}

      <main className="main-area">
        <header className="topbar">
          <button className="icon-button mobile-menu" onClick={() => setSidebarOpen(true)} aria-label="Buka menu"><Menu size={20} /></button>
          <div className="global-search">
            <Search size={18} />
            <input aria-label="Cari transaksi" placeholder="Cari transaksi, akun, atau kategori..." onFocus={() => activePage !== "transactions" && setActivePage("transactions")} />
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
                <Bell size={18} /><span className="notification-dot" />
              </button>
              {notificationOpen && (
                <div className="notification-popover">
                  <div className="popover-head"><strong>Notifikasi</strong><span>3 baru</span></div>
                  <button onClick={() => { selectPage("bills"); setNotificationOpen(false); }}><span className="notice-icon warning"><CalendarDays size={17} /></span><span><strong>Netflix jatuh tempo 2 hari lagi</strong><small>Siapkan Rp186.000 di kartu kredit.</small></span></button>
                  <button onClick={() => { selectPage("budgets"); setNotificationOpen(false); }}><span className="notice-icon good"><BarChart3 size={17} /></span><span><strong>Anggaran masih terkendali</strong><small>Baru 51% dari total batas bulan ini.</small></span></button>
                  <button onClick={() => { selectPage("goals"); setNotificationOpen(false); }}><span className="notice-icon info"><Target size={17} /></span><span><strong>Dana darurat makin dekat</strong><small>Sudah mencapai 71,7% dari target.</small></span></button>
                </div>
              )}
            </div>
            <button className="primary-button top-add" onClick={() => setTransactionOpen(true)}><Plus size={18} /> Transaksi</button>
          </div>
        </header>

        <div className="page-wrap">
          <section className="page-heading">
            <div><span className="eyebrow">{title.eyebrow}</span><h1>{title.title}</h1><p>{title.subtitle}</p></div>
            {activePage !== "dashboard" && activePage !== "assistant" && activePage !== "settings" && (
              <button className="primary-button" onClick={() => setTransactionOpen(true)}><Plus size={18} /> Tambah transaksi</button>
            )}
          </section>

          {activePage === "dashboard" && <DashboardPage transactions={transactions} accounts={accounts} bills={bills} goals={goals} privacy={privacy} monthly={monthly} accountTotals={accountTotals} healthScore={healthScore} onNavigate={selectPage} onAdd={() => setTransactionOpen(true)} />}
          {activePage === "transactions" && <TransactionsPage transactions={transactions} accounts={accounts} privacy={privacy} />}
          {activePage === "accounts" && <AccountsPage accounts={accounts} privacy={privacy} />}
          {activePage === "budgets" && <BudgetsPage transactions={transactions} privacy={privacy} />}
          {activePage === "goals" && <GoalsPage goals={goals} privacy={privacy} onContribute={contributeGoal} />}
          {activePage === "bills" && <BillsPage bills={bills} accounts={accounts} privacy={privacy} onPay={payBill} />}
          {activePage === "investments" && <InvestmentsPage privacy={privacy} />}
          {activePage === "reports" && <ReportsPage transactions={transactions} monthly={monthly} accountTotals={accountTotals} privacy={privacy} />}
          {activePage === "assistant" && <AssistantPage monthly={monthly} accountTotals={accountTotals} healthScore={healthScore} privacy={privacy} />}
          {activePage === "settings" && <SettingsPage darkMode={darkMode} setDarkMode={setDarkMode} privacy={privacy} setPrivacy={setPrivacy} data={{ accounts, transactions, goals, bills }} onReset={resetDemo} onToast={showToast} />}
        </div>
      </main>

      <nav className="mobile-nav" aria-label="Navigasi seluler">
        {[navPrimary[0], navPrimary[1], navPrimary[3], navPrimary[4]].map((item) => <NavButton key={item.key} item={item} active={activePage === item.key} onClick={() => selectPage(item.key)} />)}
        <button className="mobile-add" onClick={() => setTransactionOpen(true)} aria-label="Tambah transaksi"><Plus size={23} /></button>
      </nav>

      {transactionOpen && <TransactionModal accounts={accounts} onClose={() => setTransactionOpen(false)} onSubmit={addTransaction} />}
      {toast && <div className="toast"><span><Check size={16} /></span>{toast}</div>}
    </div>
  );
}

function DashboardPage({ transactions, accounts, bills, goals, privacy, monthly, accountTotals, healthScore, onNavigate, onAdd }: {
  transactions: Transaction[]; accounts: Account[]; bills: Bill[]; goals: Goal[]; privacy: boolean;
  monthly: ReturnType<typeof monthlySummary>; accountTotals: ReturnType<typeof accountSummary>; healthScore: number;
  onNavigate: (page: PageKey) => void; onAdd: () => void;
}) {
  const expenseByCategory = initialBudgets.map((budget) => ({ ...budget, value: budgetSpent(transactions, budget.category) }));
  const categoryTotal = expenseByCategory.reduce((sum, item) => sum + item.value, 0);
  const chartValues = [42, 58, 38, 74, 52, 68, 48, 82, 60, 72, 66, 88, 56, 78];
  const upcomingBills = bills.filter((bill) => !bill.paid).slice(0, 3);
  const recent = [...transactions].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6);

  return (
    <div className="dashboard-grid">
      <section className="hero-card">
        <div className="hero-copy">
          <span className="card-kicker"><span className="live-dot" /> Kekayaan bersih</span>
          <Amount value={accountTotals.netWorth} privacy={privacy} className="hero-value" />
          <div className="positive-change"><ArrowUpRight size={15} /> 8,4% <span>dari bulan lalu</span></div>
        </div>
        <div className="hero-mini-stats">
          <div><span>Total aset</span><Amount value={accountTotals.assets} privacy={privacy} /><small><ArrowUpRight size={13} /> 6,2%</small></div>
          <div><span>Total kewajiban</span><Amount value={accountTotals.liabilities} privacy={privacy} /><small className="muted-change"><ArrowDownLeft size={13} /> 3,1%</small></div>
        </div>
        <div className="hero-pattern" aria-hidden="true"><span /><span /><span /><span /><span /></div>
      </section>

      <section className="health-card">
        <div className="card-title-row"><div><span className="card-kicker">Skor kesehatan</span><h2>Kondisi finansial</h2></div><button className="icon-button small"><MoreHorizontal size={18} /></button></div>
        <div className="health-content">
          <div className="score-ring" style={{ "--score": `${healthScore * 3.6}deg` } as React.CSSProperties}><div><strong>{healthScore}</strong><small>/100</small></div></div>
          <div><span className="health-label">Sangat sehat</span><p>Tabungan kuat dan utangmu masih dalam batas aman.</p><button className="text-button" onClick={() => onNavigate("reports")}>Lihat analisis <ArrowRight size={15} /></button></div>
        </div>
      </section>

      <section className="metric-card income">
        <span className="metric-icon"><ArrowDownLeft size={19} /></span>
        <div><span>Pemasukan bulan ini</span><Amount value={monthly.income} privacy={privacy} className="metric-value" /><small><strong>+4,2%</strong> vs bulan lalu</small></div>
      </section>
      <section className="metric-card expense">
        <span className="metric-icon"><ArrowUpRight size={19} /></span>
        <div><span>Pengeluaran bulan ini</span><Amount value={monthly.expense} privacy={privacy} className="metric-value" /><small><strong>−6,8%</strong> vs bulan lalu</small></div>
      </section>
      <section className="metric-card cashflow">
        <span className="metric-icon"><TrendingUp size={19} /></span>
        <div><span>Arus kas bersih</span><Amount value={monthly.cashflow} privacy={privacy} className="metric-value" /><small><strong>{monthly.savingsRate.toFixed(1)}%</strong> savings rate</small></div>
      </section>

      <section className="panel cashflow-panel">
        <div className="card-title-row"><div><span className="card-kicker">Arus kas</span><h2>Pemasukan vs pengeluaran</h2></div><div className="chart-legend"><span className="legend-income" /> Masuk <span className="legend-expense" /> Keluar</div></div>
        <div className="bar-chart" aria-label="Grafik arus kas dua minggu terakhir">
          {chartValues.map((value, index) => <div className="bar-column" key={index}><span className="bar-income" style={{ height: `${value}%` }} /><span className="bar-expense" style={{ height: `${Math.max(18, value - (index % 3) * 16 - 14)}%` }} /><small>{index % 2 === 0 ? index + 1 : ""}</small></div>)}
        </div>
        <div className="chart-summary"><span><i className="green-dot" /> Total masuk <strong>{privacy ? "Rp ••••" : formatIDR(monthly.income)}</strong></span><span><i className="red-dot" /> Total keluar <strong>{privacy ? "Rp ••••" : formatIDR(monthly.expense)}</strong></span></div>
      </section>

      <section className="panel category-panel">
        <div className="card-title-row"><div><span className="card-kicker">Pengeluaran</span><h2>Per kategori</h2></div><button className="text-button" onClick={() => onNavigate("budgets")}>Detail <ArrowRight size={14} /></button></div>
        <div className="donut-wrap">
          <div className="donut" style={{ background: "conic-gradient(#d4685c 0 55%, #16876f 55% 73%, #da9a3a 73% 90%, #4e79c7 90% 97%, #aa67a6 97% 100%)" }}><div><small>Total</small><Amount value={categoryTotal} privacy={privacy} compact /></div></div>
          <div className="category-list">
            {expenseByCategory.filter((item) => item.value > 0).map((item) => <div key={item.id}><span className="category-name"><i style={{ background: item.color }} />{item.category}</span><strong>{privacy ? "••••" : formatIDR(item.value, true)}</strong></div>)}
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
        </div>
      </section>

      <section className="panel bills-panel">
        <div className="card-title-row"><div><span className="card-kicker">Mendatang</span><h2>Tagihan terdekat</h2></div><button className="text-button" onClick={() => onNavigate("bills")}>Lihat semua <ArrowRight size={14} /></button></div>
        <div className="bill-list">
          {upcomingBills.map((bill, index) => <button key={bill.id} onClick={() => onNavigate("bills")}><span className={`date-box ${index === 0 ? "urgent" : ""}`}><small>JUL</small><strong>{bill.dueDate.slice(-2)}</strong></span><span><strong>{bill.name}</strong><small>{bill.category}</small></span><Amount value={bill.amount} privacy={privacy} /></button>)}
        </div>
      </section>

      <section className="panel goals-panel">
        <div className="card-title-row"><div><span className="card-kicker">Target</span><h2>Progress tujuanmu</h2></div><button className="text-button" onClick={() => onNavigate("goals")}>Kelola <ArrowRight size={14} /></button></div>
        <div className="mini-goals">
          {goals.slice(0, 2).map((goal) => { const percent = goal.current / goal.target * 100; return <div key={goal.id}><span className="goal-icon" style={{ color: goal.color, background: `${goal.color}16` }}><Target size={18} /></span><div><span><strong>{goal.name}</strong><b>{percent.toFixed(0)}%</b></span><ProgressBar value={percent} color={goal.color} label={`Progress ${goal.name}`} /><small><Amount value={goal.current} privacy={privacy} /> dari <Amount value={goal.target} privacy={privacy} /></small></div></div>; })}
        </div>
      </section>

      <section className="panel recent-panel">
        <div className="card-title-row"><div><span className="card-kicker">Aktivitas</span><h2>Transaksi terbaru</h2></div><button className="primary-button compact" onClick={onAdd}><Plus size={16} /> Tambah</button></div>
        <TransactionTable transactions={recent} accounts={accounts} privacy={privacy} compact />
      </section>

      <section className="insight-card">
        <div className="insight-top"><span><Sparkles size={18} /></span><small>VINN INSIGHT</small></div>
        <h2>Kamu menghemat <strong>{privacy ? "Rp ••••" : formatIDR(842_000, true)}</strong> lebih banyak bulan ini.</h2>
        <p>Pengeluaran transportasi turun 21%. Kalau ritme ini bertahan, target Dana Darurat bisa selesai 1 bulan lebih cepat.</p>
        <button onClick={() => onNavigate("assistant")}>Tanya VINN AI <ArrowRight size={15} /></button>
      </section>
    </div>
  );
}

function TransactionsPage({ transactions, accounts, privacy }: { transactions: Transaction[]; accounts: Account[]; privacy: boolean }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | TransactionType>("all");
  const filtered = transactions.filter((item) => {
    const matchesQuery = `${item.title} ${item.merchant ?? ""} ${item.category}`.toLowerCase().includes(query.toLowerCase());
    return matchesQuery && (filter === "all" || item.type === filter);
  }).sort((a, b) => b.date.localeCompare(a.date));
  return (
    <div className="content-stack">
      <div className="summary-strip">
        <div><span>Total transaksi</span><strong>{transactions.length}</strong><small>Juli 2026</small></div>
        <div><span>Pemasukan</span><Amount value={monthlySummary(transactions).income} privacy={privacy} /><small className="positive-text">Selesai</small></div>
        <div><span>Pengeluaran</span><Amount value={monthlySummary(transactions).expense} privacy={privacy} /><small>Di luar transfer</small></div>
        <div><span>Transfer internal</span><Amount value={transactions.filter((item) => item.type === "transfer").reduce((sum, item) => sum + item.amount, 0)} privacy={privacy} /><small>Tidak masuk cashflow</small></div>
      </div>
      <section className="panel table-panel">
        <div className="filter-row">
          <label className="table-search"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari merchant atau kategori" /></label>
          <div className="filter-tabs">
            {(["all", "income", "expense", "transfer"] as const).map((item) => <button key={item} className={filter === item ? "active" : ""} onClick={() => setFilter(item)}>{item === "all" ? "Semua" : item === "income" ? "Masuk" : item === "expense" ? "Keluar" : "Transfer"}</button>)}
          </div>
          <button className="secondary-button"><Upload size={16} /> Impor CSV</button>
        </div>
        {filtered.length > 0 ? <TransactionTable transactions={filtered} accounts={accounts} privacy={privacy} /> : <div className="empty-state"><Search size={28} /><h3>Transaksi tidak ditemukan</h3><p>Coba gunakan kata kunci atau filter yang berbeda.</p></div>}
      </section>
    </div>
  );
}

function TransactionTable({ transactions, accounts, privacy, compact = false }: { transactions: Transaction[]; accounts: Account[]; privacy: boolean; compact?: boolean }) {
  return <div className={`transaction-table ${compact ? "compact-table" : ""}`}>
    {!compact && <div className="transaction-head"><span>Transaksi</span><span>Tanggal</span><span>Akun</span><span>Status</span><span>Nominal</span></div>}
    {transactions.map((transaction) => {
      const account = accounts.find((item) => item.id === transaction.accountId);
      const isPositive = transaction.type === "income" || transaction.type === "refund";
      const isTransfer = transaction.type === "transfer" || transaction.type === "investment_buy";
      return <div className="transaction-row" key={transaction.id}>
        <span className={`transaction-icon ${isPositive ? "positive" : isTransfer ? "neutral" : "negative"}`}>{isPositive ? <ArrowDownLeft size={17} /> : isTransfer ? <ArrowRight size={17} /> : <ArrowUpRight size={17} />}</span>
        <span className="transaction-main"><strong>{transaction.title}</strong><small>{transaction.merchant ?? transaction.category}</small></span>
        <span className="transaction-date">{shortDate(transaction.date)}</span>
        <span className="transaction-account">{account?.name ?? "Alokasi virtual"}</span>
        <span className="transaction-status"><i /> Selesai</span>
        <Amount value={transaction.amount} privacy={privacy} className={`transaction-amount ${isPositive ? "positive-text" : isTransfer ? "" : "negative-text"}`} />
      </div>;
    })}
  </div>;
}

function AccountsPage({ accounts, privacy }: { accounts: Account[]; privacy: boolean }) {
  const totals = accountSummary(accounts);
  return <div className="content-stack">
    <div className="summary-strip account-summary">
      <div><span>Saldo likuid</span><Amount value={totals.liquid} privacy={privacy} /><small>Bank, e-wallet, cash</small></div>
      <div><span>Nilai investasi</span><Amount value={totals.investment} privacy={privacy} /><small className="positive-text">+8,7% YTD</small></div>
      <div><span>Total kewajiban</span><Amount value={totals.liabilities} privacy={privacy} /><small className="negative-text">Perlu dibayar</small></div>
      <div><span>Kekayaan bersih</span><Amount value={totals.netWorth} privacy={privacy} /><small>Setelah kewajiban</small></div>
    </div>
    <div className="account-grid">
      {accounts.map((account) => <article className={`account-card ${account.liability ? "liability" : ""}`} key={account.id}>
        <div className="account-card-top"><span className="large-account-logo" style={{ background: `${account.color}18`, color: account.color }}>{account.type === "Bank" ? <Landmark size={22} /> : account.type === "Investment" ? <TrendingUp size={22} /> : account.liability ? <CreditCard size={22} /> : <WalletCards size={22} />}</span><button className="icon-button small"><MoreHorizontal size={18} /></button></div>
        <span>{account.type}</span><h3>{account.name}</h3><p>{account.institution} · {account.mask}</p>
        <Amount value={account.balance} privacy={privacy} className="account-card-value" />
        <div className="account-card-footer"><span><i style={{ background: account.color }} /> {account.liability ? "Kewajiban" : "Aktif"}</span><button>Detail <ArrowRight size={14} /></button></div>
      </article>)}
      <button className="add-card"><span><Plus size={21} /></span><strong>Tambah akun baru</strong><small>Bank, e-wallet, cash, atau lainnya</small></button>
    </div>
  </div>;
}

function BudgetsPage({ transactions, privacy }: { transactions: Transaction[]; privacy: boolean }) {
  const totalLimit = initialBudgets.reduce((sum, item) => sum + item.limit, 0);
  const totalSpent = initialBudgets.reduce((sum, item) => sum + budgetSpent(transactions, item.category), 0);
  const daysLeft = 14;
  return <div className="content-stack">
    <div className="budget-hero">
      <div><span className="card-kicker light">Total anggaran Juli</span><Amount value={totalLimit} privacy={privacy} className="budget-hero-value" /><p><strong>{privacy ? "Rp ••••" : formatIDR(totalLimit - totalSpent)}</strong> masih tersedia untuk {daysLeft} hari ke depan.</p></div>
      <div className="budget-ring" style={{ "--score": `${Math.min(100, totalSpent / totalLimit * 100) * 3.6}deg` } as React.CSSProperties}><div><strong>{Math.round(totalSpent / totalLimit * 100)}%</strong><small>terpakai</small></div></div>
    </div>
    <section className="panel budget-list-panel">
      <div className="card-title-row"><div><span className="card-kicker">Kategori</span><h2>Realisasi anggaran</h2></div><button className="secondary-button"><RefreshCw size={16} /> Salin bulan lalu</button></div>
      <div className="budget-list">
        {initialBudgets.map((budget) => { const spent = budgetSpent(transactions, budget.category); const percent = spent / budget.limit * 100; const state = percent > 100 ? "Terlampaui" : percent >= 90 ? "Hampir penuh" : percent >= 75 ? "Waspada" : "Aman"; return <div className="budget-row" key={budget.id}>
          <span className="budget-category-icon" style={{ background: `${budget.color}16`, color: budget.color }}><CircleDollarSign size={20} /></span>
          <div className="budget-details"><span><strong>{budget.category}</strong><small className={`budget-state state-${state.toLowerCase().replace(" ", "-")}`}>{state}</small></span><ProgressBar value={percent} color={percent > 100 ? "#d4685c" : budget.color} label={`Anggaran ${budget.category}`} /><small><Amount value={spent} privacy={privacy} /> terpakai dari <Amount value={budget.limit} privacy={privacy} /></small></div>
          <strong>{Math.round(percent)}%</strong><button className="icon-button small"><MoreHorizontal size={18} /></button>
        </div>; })}
      </div>
    </section>
  </div>;
}

function GoalsPage({ goals, privacy, onContribute }: { goals: Goal[]; privacy: boolean; onContribute: (goal: Goal) => void }) {
  return <div className="goal-grid">
    {goals.map((goal) => { const percent = goal.current / goal.target * 100; const remaining = goal.target - goal.current; const months = Math.max(1, Math.ceil((new Date(goal.deadline).getTime() - new Date("2026-07-17").getTime()) / 2_628_000_000)); return <article className="goal-card" key={goal.id}>
      <div className="goal-card-head"><span className="large-goal-icon" style={{ background: `${goal.color}18`, color: goal.color }}><Target size={24} /></span><button className="icon-button small"><MoreHorizontal size={18} /></button></div>
      <span className="goal-deadline">Target · {shortDate(goal.deadline)}</span><h2>{goal.name}</h2>
      <div className="goal-amount"><Amount value={goal.current} privacy={privacy} /><small>dari <Amount value={goal.target} privacy={privacy} /></small></div>
      <ProgressBar value={percent} color={goal.color} label={`Progress ${goal.name}`} />
      <div className="goal-meta"><span><small>Tercapai</small><strong>{percent.toFixed(1)}%</strong></span><span><small>Sisa</small><Amount value={remaining} privacy={privacy} compact /></span><span><small>Rekomendasi/bln</small><Amount value={remaining / months} privacy={privacy} compact /></span></div>
      <button className="secondary-button full" onClick={() => onContribute(goal)} disabled={percent >= 100}><Plus size={16} /> {percent >= 100 ? "Target selesai" : "Tambah Rp500.000"}</button>
    </article>; })}
    <button className="add-card goal-add"><span><Plus size={21} /></span><strong>Buat target baru</strong><small>Tentukan nominal, deadline, dan kontribusi rutin</small></button>
  </div>;
}

function BillsPage({ bills, accounts, privacy, onPay }: { bills: Bill[]; accounts: Account[]; privacy: boolean; onPay: (bill: Bill) => void }) {
  const pending = bills.filter((bill) => !bill.paid);
  return <div className="content-stack">
    <div className="summary-strip">
      <div><span>Belum dibayar</span><strong>{pending.length} tagihan</strong><small>Periode Juli</small></div>
      <div><span>Total mendatang</span><Amount value={pending.reduce((sum, bill) => sum + bill.amount, 0)} privacy={privacy} /><small>Sebelum 25 Juli</small></div>
      <div><span>Sudah dibayar</span><strong>{bills.filter((bill) => bill.paid).length} tagihan</strong><small className="positive-text">Tepat waktu</small></div>
      <div><span>Autopost</span><strong>Nonaktif</strong><small>Sesuai rekomendasi PRD</small></div>
    </div>
    <section className="panel bills-full-panel">
      <div className="card-title-row"><div><span className="card-kicker">Jadwal</span><h2>Tagihan Juli</h2></div><button className="secondary-button"><CalendarDays size={16} /> Atur pengingat</button></div>
      <div className="bill-cards">
        {[...bills].sort((a, b) => a.dueDate.localeCompare(b.dueDate)).map((bill) => { const account = accounts.find((item) => item.id === bill.accountId); return <article className={bill.paid ? "paid" : ""} key={bill.id}>
          <span className={`bill-brand bill-${bill.category.toLowerCase()}`}>{bill.name.slice(0, 1)}</span>
          <div className="bill-card-main"><span><strong>{bill.name}</strong>{bill.paid && <small className="paid-pill"><Check size={12} /> Dibayar</small>}</span><small>{bill.category} · {account?.name}</small></div>
          <div className="bill-due"><small>Jatuh tempo</small><strong>{shortDate(bill.dueDate)}</strong></div>
          <Amount value={bill.amount} privacy={privacy} className="bill-amount" />
          <button className={bill.paid ? "secondary-button" : "primary-button"} onClick={() => onPay(bill)} disabled={bill.paid}>{bill.paid ? "Selesai" : "Bayar"}</button>
        </article>; })}
      </div>
    </section>
  </div>;
}

function InvestmentsPage({ privacy }: { privacy: boolean }) {
  const totalValue = initialInvestments.reduce((sum, item) => sum + investmentValue(item), 0);
  const totalCost = initialInvestments.reduce((sum, item) => sum + investmentCost(item), 0);
  const gain = totalValue - totalCost;
  return <div className="content-stack">
    <div className="investment-hero">
      <div><span className="card-kicker light">Nilai portofolio</span><Amount value={totalValue} privacy={privacy} className="investment-value" /><p><span><ArrowUpRight size={15} /> {((gain / totalCost) * 100).toFixed(2)}%</span> keuntungan belum terealisasi</p></div>
      <div className="investment-stats"><span><small>Total modal</small><Amount value={totalCost} privacy={privacy} /></span><span><small>Unrealized P/L</small><Amount value={gain} privacy={privacy} className="positive-light" /></span><span><small>Aset aktif</small><strong>3</strong></span></div>
    </div>
    <section className="panel investment-panel">
      <div className="card-title-row"><div><span className="card-kicker">Kepemilikan</span><h2>Daftar aset</h2></div><div className="price-status"><span /> Harga tertunda 15 menit</div></div>
      <div className="asset-table">
        <div className="asset-head"><span>Aset</span><span>Unit</span><span>Harga rata-rata</span><span>Harga pasar</span><span>Nilai</span><span>Return</span></div>
        {initialInvestments.map((investment) => { const value = investmentValue(investment); const cost = investmentCost(investment); const gainValue = value - cost; return <div className="asset-row" key={investment.id}>
          <span className="asset-logo" style={{ background: investment.color }}>{investment.ticker.slice(0, 2)}</span><span className="asset-name"><strong>{investment.ticker}</strong><small>{investment.name} · {investment.className}</small></span>
          <span>{investment.units.toLocaleString("id-ID", { maximumFractionDigits: 4 })}</span><Amount value={investment.avgPrice} privacy={privacy} /><Amount value={investment.marketPrice} privacy={privacy} /><span><Amount value={value} privacy={privacy} /><small className="positive-text">+{privacy ? "••" : formatIDR(gainValue, true)} · +{((gainValue / cost) * 100).toFixed(1)}%</small></span>
        </div>; })}
      </div>
    </section>
  </div>;
}

function ReportsPage({ transactions, monthly, accountTotals, privacy }: { transactions: Transaction[]; monthly: ReturnType<typeof monthlySummary>; accountTotals: ReturnType<typeof accountSummary>; privacy: boolean }) {
  const exportCsv = () => {
    const rows = [["Tanggal", "Tipe", "Deskripsi", "Kategori", "Nominal"], ...transactions.map((item) => [item.date, item.type, item.title, item.category, String(item.amount)])];
    const blob = new Blob([rows.map((row) => row.join(",")).join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = "vinn-store-transaksi-juli-2026.csv"; anchor.click(); URL.revokeObjectURL(url);
  };
  return <div className="report-layout">
    <section className="report-sheet">
      <div className="report-brand"><BrandMark /><span><strong>VINN STORE</strong><small>Financial OS</small></span><div><small>LAPORAN BULANAN</small><strong>Juli 2026</strong></div></div>
      <div className="report-title"><span>Ringkasan eksekutif</span><h2>Keuangan tumbuh sehat dengan arus kas positif.</h2><p>Savings rate bulan ini berada di atas target 30%, sementara kewajiban hanya {((accountTotals.liabilities / accountTotals.assets) * 100).toFixed(1)}% dari total aset.</p></div>
      <div className="report-metrics"><div><span>Kekayaan bersih</span><Amount value={accountTotals.netWorth} privacy={privacy} /></div><div><span>Arus kas bersih</span><Amount value={monthly.cashflow} privacy={privacy} /></div><div><span>Savings rate</span><strong>{monthly.savingsRate.toFixed(1)}%</strong></div></div>
      <div className="report-section"><span className="card-kicker">Arus kas bulanan</span><div className="report-bars"><div><span>Pemasukan</span><i style={{ width: "100%" }} /><Amount value={monthly.income} privacy={privacy} /></div><div><span>Pengeluaran</span><i className="expense-bar" style={{ width: `${monthly.expense / monthly.income * 100}%` }} /><Amount value={monthly.expense} privacy={privacy} /></div><div><span>Tabungan</span><i className="saving-bar" style={{ width: `${monthly.cashflow / monthly.income * 100}%` }} /><Amount value={monthly.cashflow} privacy={privacy} /></div></div></div>
      <div className="report-note"><Sparkles size={18} /><p><strong>Catatan:</strong> Belanja transportasi menurun 21%, namun kategori makanan perlu dipantau menjelang akhir bulan.</p></div>
    </section>
    <aside className="report-actions panel"><span className="card-kicker">Ekspor</span><h2>Bagikan laporan</h2><p>Unduh data transaksi atau cetak laporan ini sebagai PDF melalui browser.</p><button className="primary-button full" onClick={() => window.print()}><FileText size={17} /> Cetak / Simpan PDF</button><button className="secondary-button full" onClick={exportCsv}><Download size={17} /> Unduh CSV</button><div className="security-note"><ShieldCheck size={18} /><span><strong>Privasi terjaga</strong><small>Ekspor dibuat langsung di perangkatmu.</small></span></div></aside>
  </div>;
}

function AssistantPage({ monthly, accountTotals, healthScore, privacy }: { monthly: ReturnType<typeof monthlySummary>; accountTotals: ReturnType<typeof accountSummary>; healthScore: number; privacy: boolean }) {
  const [messages, setMessages] = useState<{ role: "ai" | "user"; text: string }[]>([{ role: "ai", text: "Halo Vinn! Aku siap membantu membaca kondisi keuanganmu. Aku hanya memberi insight dan tidak dapat mengubah transaksi." }]);
  const [input, setInput] = useState("");
  const send = (question?: string) => {
    const text = (question ?? input).trim(); if (!text) return;
    const answer = text.toLowerCase().includes("hemat") || text.toLowerCase().includes("tabung")
      ? `Savings rate Juli ada di ${monthly.savingsRate.toFixed(1)}%. Setelah pengeluaran, arus kas positifmu ${privacy ? "masih sangat sehat" : formatIDR(monthly.cashflow)}. Prioritas terbaik adalah menambah Dana Darurat.`
      : text.toLowerCase().includes("utang")
        ? `Total kewajibanmu ${privacy ? "berada dalam rasio aman" : formatIDR(accountTotals.liabilities)}, sekitar ${((accountTotals.liabilities / accountTotals.assets) * 100).toFixed(1)}% dari aset. Bayar kartu kredit sebelum 22 Juli untuk menjaga skor.`
        : `Skor kesehatan finansialmu ${healthScore}/100. Faktor terkuatnya adalah arus kas positif dan likuiditas yang cukup; kategori makanan tetap perlu dipantau sampai akhir bulan.`;
    setMessages((current) => [...current, { role: "user", text }, { role: "ai", text: answer }]); setInput("");
  };
  return <div className="assistant-layout">
    <section className="assistant-chat panel">
      <div className="assistant-banner"><span><Bot size={21} /></span><div><strong>VINN AI</strong><small>Terhubung ke ringkasan Juli · Read only</small></div><span className="online"><i /> Online</span></div>
      <div className="chat-body">
        {messages.map((message, index) => <div className={`chat-message ${message.role}`} key={index}>{message.role === "ai" && <span><Sparkles size={16} /></span>}<p>{message.text}</p></div>)}
      </div>
      <div className="suggestion-chips"><button onClick={() => send("Bagaimana cara menabung lebih banyak?")}>Cara menabung lebih banyak</button><button onClick={() => send("Apakah utang saya aman?")}>Apakah utang saya aman?</button></div>
      <form className="chat-input" onSubmit={(event) => { event.preventDefault(); send(); }}><input value={input} onChange={(event) => setInput(event.target.value)} placeholder="Tanya tentang kondisi keuanganmu..." aria-label="Pertanyaan untuk VINN AI" /><button aria-label="Kirim pertanyaan"><Send size={18} /></button></form>
    </section>
    <aside className="assistant-context panel"><span className="card-kicker">Konteks yang dibagikan</span><h2>Ringkasan terpilih</h2><p>Hanya angka agregat berikut yang digunakan untuk menjawab pertanyaan.</p><div><span><CircleDollarSign size={17} /> Arus kas Juli</span><strong>Diizinkan</strong></div><div><span><WalletCards size={17} /> Total akun</span><strong>Diizinkan</strong></div><div><span><ReceiptText size={17} /> Detail merchant</span><strong className="disabled-text">Tidak dibagikan</strong></div><div><span><CreditCard size={17} /> Nomor akun</span><strong className="disabled-text">Tidak dibagikan</strong></div><small className="ai-disclaimer">AI dapat membuat kesalahan dan bukan pengganti penasihat keuangan profesional.</small></aside>
  </div>;
}

function SettingsPage({ darkMode, setDarkMode, privacy, setPrivacy, data, onReset, onToast }: { darkMode: boolean; setDarkMode: (value: boolean) => void; privacy: boolean; setPrivacy: (value: boolean) => void; data: StoredData; onReset: () => void; onToast: (message: string) => void }) {
  const backup = () => { const blob = new Blob([JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), ...data }, null, 2)], { type: "application/json" }); const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = "vinn-store-backup.json"; anchor.click(); URL.revokeObjectURL(url); onToast("Backup berhasil dibuat."); };
  return <div className="settings-layout">
    <section className="panel settings-section"><div className="settings-title"><span><Settings size={20} /></span><div><h2>Preferensi tampilan</h2><p>Atur pengalaman dashboard di perangkat ini.</p></div></div><div className="settings-row"><div><strong>Tema gelap</strong><small>Kurangi cahaya pada malam hari.</small></div><button className={`switch ${darkMode ? "on" : ""}`} onClick={() => setDarkMode(!darkMode)} aria-pressed={darkMode}><span /></button></div><div className="settings-row"><div><strong>Privacy mode</strong><small>Sembunyikan semua nominal sensitif.</small></div><button className={`switch ${privacy ? "on" : ""}`} onClick={() => setPrivacy(!privacy)} aria-pressed={privacy}><span /></button></div></section>
    <section className="panel settings-section"><div className="settings-title"><span><Building2 size={20} /></span><div><h2>Google workspace</h2><p>Status integrasi penyimpanan utama.</p></div></div><div className="connection-card"><span className="google-mark">G</span><div><strong>Google Sheets</strong><small>Backend siap dikonfigurasi melalui Apps Script.</small></div><span className="connection-status"><i /> Siap</span></div><button className="secondary-button">Lihat panduan koneksi <ArrowRight size={15} /></button></section>
    <section className="panel settings-section"><div className="settings-title"><span><ShieldCheck size={20} /></span><div><h2>Data & keamanan</h2><p>Backup lokal dan pemulihan data demo.</p></div></div><div className="settings-actions"><button className="secondary-button" onClick={backup}><Download size={17} /> Unduh backup JSON</button><button className="danger-button" onClick={onReset}><RefreshCw size={17} /> Pulihkan data demo</button></div><div className="settings-footnote">API key AI tidak disimpan di browser. Pada deployment Google, key disimpan di Script Properties.</div></section>
  </div>;
}

function TransactionModal({ accounts, onClose, onSubmit }: { accounts: Account[]; onClose: () => void; onSubmit: (transaction: Transaction) => void }) {
  const [type, setType] = useState<TransactionType>("expense");
  const [amount, setAmount] = useState("");
  const [accountId, setAccountId] = useState("bca");
  const [destinationAccountId, setDestinationAccountId] = useState("jago");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Makanan");
  const [date, setDate] = useState("2026-07-17");
  const [ocrMessage, setOcrMessage] = useState("");
  const submit = (event: FormEvent) => {
    event.preventDefault(); const value = Number(amount.replace(/\D/g, ""));
    if (!value || value <= 0 || !title.trim()) return;
    if ((type === "transfer" || type === "investment_buy") && accountId === destinationAccountId) return;
    onSubmit({ id: `tx-${Date.now()}`, type, date, title: title.trim(), merchant: title.trim(), category: type === "transfer" ? "Transfer" : type === "investment_buy" ? "Investasi" : category, accountId, destinationAccountId: type === "transfer" || type === "investment_buy" ? destinationAccountId : undefined, amount: value, status: "completed" }); onClose();
  };
  const simulateOcr = () => { setOcrMessage("Struk dibaca sebagai draft — periksa kembali sebelum menyimpan."); setTitle("Belanja dari struk"); setAmount("248000"); setCategory("Makanan"); };
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section className="modal" role="dialog" aria-modal="true" aria-labelledby="transaction-title">
      <div className="modal-head"><div><span className="card-kicker">Quick add</span><h2 id="transaction-title">Transaksi baru</h2></div><button className="icon-button" onClick={onClose} aria-label="Tutup"><X size={20} /></button></div>
      <form onSubmit={submit}>
        <div className="transaction-type-tabs">
          {[{ key: "expense", label: "Pengeluaran", icon: ArrowUpRight }, { key: "income", label: "Pemasukan", icon: ArrowDownLeft }, { key: "transfer", label: "Transfer", icon: ArrowRight }].map((item) => { const Icon = item.icon; return <button type="button" key={item.key} className={type === item.key ? "active" : ""} onClick={() => setType(item.key as TransactionType)}><Icon size={16} />{item.label}</button>; })}
        </div>
        <label className="amount-field"><span>Nominal</span><div><small>Rp</small><input value={amount} onChange={(event) => setAmount(event.target.value.replace(/\D/g, ""))} inputMode="numeric" placeholder="0" required autoFocus /></div></label>
        <div className="form-grid">
          <label><span>Deskripsi / merchant</span><input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Contoh: Belanja mingguan" required /></label>
          <label><span>Tanggal</span><input type="date" value={date} onChange={(event) => setDate(event.target.value)} required /></label>
          <label><span>Akun {type === "transfer" ? "sumber" : ""}</span><select value={accountId} onChange={(event) => setAccountId(event.target.value)}>{accounts.filter((item) => item.type !== "Investment").map((account) => <option value={account.id} key={account.id}>{account.name}</option>)}</select><ChevronDown size={15} /></label>
          {(type === "transfer" || type === "investment_buy") ? <label><span>Akun tujuan</span><select value={destinationAccountId} onChange={(event) => setDestinationAccountId(event.target.value)}>{accounts.filter((item) => item.id !== accountId).map((account) => <option value={account.id} key={account.id}>{account.name}</option>)}</select><ChevronDown size={15} /></label> : <label><span>Kategori</span><select value={category} onChange={(event) => setCategory(event.target.value)}>{["Makanan", "Transportasi", "Tagihan", "Tempat Tinggal", "Hiburan", "Kesehatan", "Pendapatan"].map((item) => <option key={item}>{item}</option>)}</select><ChevronDown size={15} /></label>}
        </div>
        <button type="button" className="ocr-button" onClick={simulateOcr}><Upload size={17} /><span><strong>Isi dari foto struk</strong><small>Data hanya menjadi draft sampai kamu konfirmasi.</small></span></button>
        {ocrMessage && <div className="ocr-message"><Sparkles size={15} />{ocrMessage}</div>}
        <div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Batal</button><button className="primary-button" type="submit"><Check size={17} /> Simpan transaksi</button></div>
      </form>
    </section>
  </div>;
}
