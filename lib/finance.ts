export type TransactionType =
  | "income"
  | "expense"
  | "transfer"
  | "refund"
  | "investment_buy";

export type AccountType =
  | "Bank"
  | "E-Wallet"
  | "Cash"
  | "Investment"
  | "Credit Card";

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  institution: string;
  balance: number;
  mask: string;
  color: string;
  liability?: boolean;
}

export interface Transaction {
  id: string;
  type: TransactionType;
  date: string;
  title: string;
  merchant?: string;
  category: string;
  accountId: string;
  destinationAccountId?: string;
  amount: number;
  status: "completed" | "pending";
}

export interface Budget {
  id: string;
  category: string;
  limit: number;
  color: string;
}

export interface Goal {
  id: string;
  name: string;
  target: number;
  current: number;
  deadline: string;
  color: string;
  icon: string;
}

export interface Bill {
  id: string;
  name: string;
  amount: number;
  dueDate: string;
  category: string;
  accountId: string;
  paid: boolean;
}

export interface Investment {
  id: string;
  ticker: string;
  name: string;
  className: string;
  units: number;
  avgPrice: number;
  marketPrice: number;
  color: string;
}

export const initialAccounts: Account[] = [
  { id: "bca", name: "BCA Utama", type: "Bank", institution: "Bank Central Asia", balance: 18_450_000, mask: "•• 7812", color: "#2256a3" },
  { id: "jago", name: "Kantong Nabung", type: "Bank", institution: "Bank Jago", balance: 8_750_000, mask: "•• 1049", color: "#e58b27" },
  { id: "gopay", name: "GoPay", type: "E-Wallet", institution: "GoTo Financial", balance: 1_280_000, mask: "•• 0921", color: "#15966f" },
  { id: "cash", name: "Uang Tunai", type: "Cash", institution: "Dompet", balance: 850_000, mask: "Tunai", color: "#7d67b7" },
  { id: "portfolio", name: "Portofolio", type: "Investment", institution: "Multi-aset", balance: 32_400_000, mask: "3 aset", color: "#1c7567" },
  { id: "cc", name: "Kartu Kredit", type: "Credit Card", institution: "BCA Card", balance: 3_200_000, mask: "•• 4451", color: "#d65d67", liability: true },
];

export const initialTransactions: Transaction[] = [
  { id: "tx-001", type: "income", date: "2026-07-01", title: "Gaji bulanan", merchant: "VINN STORE", category: "Pendapatan", accountId: "bca", amount: 12_500_000, status: "completed" },
  { id: "tx-002", type: "expense", date: "2026-07-02", title: "Sewa apartemen", merchant: "Residence 88", category: "Tempat Tinggal", accountId: "bca", amount: 2_500_000, status: "completed" },
  { id: "tx-003", type: "transfer", date: "2026-07-03", title: "Isi kantong tabungan", category: "Transfer", accountId: "bca", destinationAccountId: "jago", amount: 3_000_000, status: "completed" },
  { id: "tx-004", type: "expense", date: "2026-07-05", title: "Belanja mingguan", merchant: "Ranch Market", category: "Makanan", accountId: "cc", amount: 625_000, status: "completed" },
  { id: "tx-005", type: "expense", date: "2026-07-07", title: "Tagihan listrik", merchant: "PLN", category: "Tagihan", accountId: "bca", amount: 450_000, status: "completed" },
  { id: "tx-006", type: "investment_buy", date: "2026-07-09", title: "Beli BBCA", merchant: "Stockbit", category: "Investasi", accountId: "jago", destinationAccountId: "portfolio", amount: 2_000_000, status: "completed" },
  { id: "tx-007", type: "expense", date: "2026-07-11", title: "Makan malam", merchant: "Sushi Hiro", category: "Makanan", accountId: "gopay", amount: 185_000, status: "completed" },
  { id: "tx-008", type: "expense", date: "2026-07-12", title: "Transportasi", merchant: "Grab", category: "Transportasi", accountId: "gopay", amount: 320_000, status: "completed" },
  { id: "tx-009", type: "expense", date: "2026-07-14", title: "Internet rumah", merchant: "MyRepublic", category: "Tagihan", accountId: "bca", amount: 350_000, status: "completed" },
  { id: "tx-010", type: "expense", date: "2026-07-16", title: "Kopi dan pastry", merchant: "Djournal", category: "Hiburan", accountId: "gopay", amount: 78_000, status: "completed" },
];

export const initialBudgets: Budget[] = [
  { id: "bd-1", category: "Makanan", limit: 2_500_000, color: "#16876f" },
  { id: "bd-2", category: "Transportasi", limit: 1_000_000, color: "#4e79c7" },
  { id: "bd-3", category: "Tagihan", limit: 1_500_000, color: "#da9a3a" },
  { id: "bd-4", category: "Hiburan", limit: 750_000, color: "#aa67a6" },
  { id: "bd-5", category: "Tempat Tinggal", limit: 3_000_000, color: "#d4685c" },
];

export const initialGoals: Goal[] = [
  { id: "goal-1", name: "Dana Darurat", target: 30_000_000, current: 21_500_000, deadline: "2026-12-31", color: "#16876f", icon: "shield" },
  { id: "goal-2", name: "Liburan Jepang", target: 18_000_000, current: 7_250_000, deadline: "2027-04-01", color: "#d6953b", icon: "plane" },
  { id: "goal-3", name: "Laptop Baru", target: 24_000_000, current: 4_800_000, deadline: "2027-01-15", color: "#5574b8", icon: "laptop" },
];

export const initialBills: Bill[] = [
  { id: "bill-1", name: "Netflix", amount: 186_000, dueDate: "2026-07-19", category: "Hiburan", accountId: "cc", paid: false },
  { id: "bill-2", name: "Kartu Kredit BCA", amount: 3_200_000, dueDate: "2026-07-22", category: "Kewajiban", accountId: "bca", paid: false },
  { id: "bill-3", name: "BPJS Kesehatan", amount: 150_000, dueDate: "2026-07-25", category: "Kesehatan", accountId: "bca", paid: false },
  { id: "bill-4", name: "Spotify", amount: 54_990, dueDate: "2026-07-14", category: "Hiburan", accountId: "gopay", paid: true },
];

export const initialInvestments: Investment[] = [
  { id: "inv-1", ticker: "BBCA", name: "Bank Central Asia", className: "Saham", units: 1_500, avgPrice: 8_950, marketPrice: 9_875, color: "#2462a7" },
  { id: "inv-2", ticker: "BTC", name: "Bitcoin", className: "Kripto", units: 0.0062, avgPrice: 1_450_000_000, marketPrice: 1_620_000_000, color: "#e49a2f" },
  { id: "inv-3", ticker: "RDPU", name: "Reksa Dana Pasar Uang", className: "Reksadana", units: 5_850, avgPrice: 1_165, marketPrice: 1_212, color: "#21836f" },
];

export const formatIDR = (value: number, compact = false) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
    notation: compact ? "compact" : "standard",
  }).format(value);

export const monthlySummary = (transactions: Transaction[], month = "2026-07") => {
  const filtered = transactions.filter((item) => item.date.startsWith(month) && item.status === "completed");
  const income = filtered
    .filter((item) => item.type === "income")
    .reduce((sum, item) => sum + item.amount, 0);
  const expense = filtered
    .filter((item) => item.type === "expense")
    .reduce((sum, item) => sum + item.amount, 0);
  const refund = filtered
    .filter((item) => item.type === "refund")
    .reduce((sum, item) => sum + item.amount, 0);
  const netExpense = Math.max(0, expense - refund);
  return {
    income,
    expense: netExpense,
    cashflow: income - netExpense,
    savingsRate: income > 0 ? ((income - netExpense) / income) * 100 : 0,
  };
};

export const accountSummary = (accounts: Account[]) => {
  const assets = accounts.filter((account) => !account.liability).reduce((sum, account) => sum + account.balance, 0);
  const liabilities = accounts.filter((account) => account.liability).reduce((sum, account) => sum + account.balance, 0);
  const liquid = accounts
    .filter((account) => ["Bank", "E-Wallet", "Cash"].includes(account.type))
    .reduce((sum, account) => sum + account.balance, 0);
  const investment = accounts.filter((account) => account.type === "Investment").reduce((sum, account) => sum + account.balance, 0);
  return { assets, liabilities, liquid, investment, netWorth: assets - liabilities };
};

export const budgetSpent = (transactions: Transaction[], category: string, month = "2026-07") =>
  transactions
    .filter((item) => item.date.startsWith(month) && item.category === category && item.status === "completed")
    .reduce((sum, item) => {
      if (item.type === "expense") return sum + item.amount;
      if (item.type === "refund") return sum - item.amount;
      return sum;
    }, 0);

export const investmentValue = (investment: Investment) => investment.units * investment.marketPrice;
export const investmentCost = (investment: Investment) => investment.units * investment.avgPrice;

export const weightedAverageCost = (
  currentUnits: number,
  currentAverage: number,
  newUnits: number,
  newPrice: number,
  fee = 0,
) => {
  const totalUnits = currentUnits + newUnits;
  if (totalUnits <= 0) return 0;
  return (currentUnits * currentAverage + newUnits * newPrice + fee) / totalUnits;
};

export const calculateHealthScore = (
  transactions: Transaction[],
  accounts: Account[],
  budgets: Budget[],
) => {
  const monthly = monthlySummary(transactions);
  const account = accountSummary(accounts);
  const savingsPoints = Math.min(25, Math.max(0, (monthly.savingsRate / 30) * 25));
  const emergencyMonths = monthly.expense > 0 ? account.liquid / monthly.expense : 6;
  const emergencyPoints = Math.min(20, (emergencyMonths / 6) * 20);
  const debtRatio = account.assets > 0 ? account.liabilities / account.assets : 0;
  const debtPoints = Math.max(0, 20 * (1 - debtRatio * 2));
  const budgetAverage = budgets.reduce((sum, budget) => {
    const ratio = budgetSpent(transactions, budget.category) / budget.limit;
    return sum + Math.min(ratio, 1.5);
  }, 0) / Math.max(budgets.length, 1);
  const budgetPoints = Math.max(0, 15 * (1 - Math.max(0, budgetAverage - 0.75)));
  return Math.round(Math.min(100, savingsPoints + emergencyPoints + debtPoints + budgetPoints + 18));
};

export const applyTransaction = (accounts: Account[], transaction: Transaction) => {
  return accounts.map((account) => {
    if (transaction.type === "income" && account.id === transaction.accountId) {
      return { ...account, balance: account.balance + transaction.amount };
    }
    if (transaction.type === "expense" && account.id === transaction.accountId) {
      return account.liability
        ? { ...account, balance: account.balance + transaction.amount }
        : { ...account, balance: account.balance - transaction.amount };
    }
    if (transaction.type === "refund" && account.id === transaction.accountId) {
      return account.liability
        ? { ...account, balance: Math.max(0, account.balance - transaction.amount) }
        : { ...account, balance: account.balance + transaction.amount };
    }
    if ((transaction.type === "transfer" || transaction.type === "investment_buy") && account.id === transaction.accountId) {
      return account.liability
        ? { ...account, balance: account.balance + transaction.amount }
        : { ...account, balance: account.balance - transaction.amount };
    }
    if ((transaction.type === "transfer" || transaction.type === "investment_buy") && account.id === transaction.destinationAccountId) {
      return account.liability
        ? { ...account, balance: Math.max(0, account.balance - transaction.amount) }
        : { ...account, balance: account.balance + transaction.amount };
    }
    return account;
  });
};
