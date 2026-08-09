export type TransactionType =
  | 'income'
  | 'expense'
  | 'transfer'
  | 'refund'
  | 'investment_buy'
  | 'adjustment_in'
  | 'adjustment_out';

export type AccountType =
  | 'Bank'
  | 'E-Wallet'
  | 'Cash'
  | 'Investment'
  | 'Credit Card'
  | 'Paylater'
  | 'Loan'
  | 'Mortgage'
  | 'Deposit'
  | 'Receivable'
  | 'Custom';

export type PlanTier = 'free' | 'pro' | 'premium';
export type PlanCapability =
  | 'advanced_transactions'
  | 'imports'
  | 'attachments'
  | 'planning'
  | 'recurring'
  | 'pdf_reports'
  | 'scheduled_backup'
  | 'investments'
  | 'ai'
  | 'ocr';

export type OptionalFeatureKey =
  | 'budgets'
  | 'goals'
  | 'funds'
  | 'roadmap'
  | 'forecast'
  | 'emergency'
  | 'bills'
  | 'calendar'
  | 'recurring'
  | 'debts'
  | 'investments'
  | 'review'
  | 'reports'
  | 'assistant';

export type PlanEntitlement = {
  tier: PlanTier;
  label: string;
  status: 'free' | 'active' | 'expired' | 'invalid';
  capabilities: Record<PlanCapability, boolean>;
  installationId: string;
  licenseId: string | null;
  expiresAt: string | null;
};

export type Account = {
  id: string;
  name: string;
  type: AccountType;
  institution: string;
  balance: number;
  openingBalance: number;
  mask: string;
  color: string;
  liability: boolean;
  updatedAt?: string;
};

export type TransactionSplit = {
  id: string;
  category: string;
  amount: number;
  note?: string;
};

export type TransactionReceipt = {
  id: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  url?: string;
};

export type Transaction = {
  id: string;
  type: TransactionType;
  date: string;
  time?: string;
  title: string;
  merchant?: string;
  category: string;
  notes?: string;
  tags: string[];
  location?: string;
  splits: TransactionSplit[];
  receipt?: TransactionReceipt;
  accountId: string;
  destinationAccountId?: string;
  transferGroupId?: string;
  amount: number;
  status: 'completed' | 'pending';
  updatedAt?: string;
  deletedAt?: string;
};

export type Category = {
  id: string;
  name: string;
  type: 'income' | 'expense';
  color: string;
  active: boolean;
  archived: boolean;
  isDefault: boolean;
  icon?: string;
  updatedAt?: string;
};

export type Budget = {
  id: string;
  category: string;
  limit: number;
  color: string;
  period?: string;
  rollover?: boolean;
};

export type Goal = {
  id: string;
  name: string;
  target: number;
  current: number;
  deadline: string;
  accountId?: string;
  color: string;
  icon: string;
};

export type Bill = {
  id: string;
  name: string;
  amount: number;
  dueDate: string;
  category: string;
  accountId: string;
  liabilityAccountId: string | null;
  paid: boolean;
  completed: boolean;
  lastPaidPeriod: string | null;
  paidCount: number;
  durationMonths: number | null;
  reminderDays: number[];
  installmentPhases: Array<{ label: string; durationMonths: number; amount: number }>;
  status: string;
};

export type SinkingFund = {
  id: string;
  name: string;
  purpose: string;
  targetAmount: number;
  currentAmount: number;
  monthlyContribution: number;
  targetDate: string;
  accountId: string;
  color: string;
  active: boolean;
  updatedAt?: string;
};

export type RecurringTemplate = {
  id: string;
  name: string;
  type: 'income' | 'expense';
  amount: number;
  category: string;
  accountId: string;
  frequency: 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  nextDueDate: string;
  isSubscription: boolean;
  active: boolean;
  lastPostedDate?: string | null;
  updatedAt?: string;
};

export type InvestmentAsset = {
  id: string;
  accountId: string;
  ticker: string;
  name: string;
  assetClass: string;
  exchange: string;
  currency: string;
  units: number;
  costBasis: number;
  averageCost: number;
  marketPrice: number;
  marketValue: number;
  unrealizedPl: number;
  realizedPl: number;
  priceSource: string;
  priceStatus: string;
  priceUpdatedAt?: string;
  updatedAt?: string;
  active: boolean;
};

export type AuditLog = {
  id: string;
  action: string;
  module: string;
  entityId?: string;
  details?: unknown;
  actor?: string;
  createdAt: string;
};

export type FinanceSummary = {
  income: number;
  expense: number;
  cashflow: number;
  savingsRate: number;
};

export type FinanceSnapshot = {
  configured: boolean;
  schemaVersion?: string;
  profile: {
    name: string;
    storeName: string;
    currency: string;
    timezone: string;
  };
  entitlement: PlanEntitlement;
  summary: FinanceSummary;
  featurePreferences: Record<OptionalFeatureKey, boolean>;
  accounts: Account[];
  transactions: Transaction[];
  budgets: Budget[];
  goals: Goal[];
  bills: Bill[];
  sinkingFunds: SinkingFund[];
  recurring: RecurringTemplate[];
  categories: Category[];
  investmentAssets: InvestmentAsset[];
  auditLogs: AuditLog[];
};

export type CachedSnapshot = {
  month: string;
  updatedAt: string;
  snapshot: FinanceSnapshot;
};

export type AuthSession = {
  apiUrl: string;
  accessKey: string;
  storedAt: string;
};

export type PersonalAccessCredentials = Pick<AuthSession, 'apiUrl' | 'accessKey'>;

export type SetupWorkspaceInput = {
  profileName: string;
  storeName: string;
  currency: string;
  timezone: string;
  accounts: Array<{
    name: string;
    type: AccountType;
    institution?: string;
    mask?: string;
    openingBalance: number;
    color?: string;
  }>;
};

export type TransactionDraft = {
  id?: string;
  type: 'income' | 'expense' | 'transfer' | 'refund';
  amount: number;
  accountId: string;
  destinationAccountId?: string;
  category: string;
  date: string;
  time?: string;
  merchant?: string;
  notes?: string;
  tags?: string[];
  location?: string;
  status: 'completed' | 'pending';
  splits?: TransactionSplit[];
  expectedUpdatedAt?: string;
};
