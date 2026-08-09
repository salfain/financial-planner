import type { OptionalFeatureKey, PlanCapability } from './types';

export const PLAN_CAPABILITIES: PlanCapability[] = [
  'advanced_transactions',
  'imports',
  'attachments',
  'planning',
  'recurring',
  'pdf_reports',
  'scheduled_backup',
  'investments',
  'ai',
  'ocr',
];

export const OPTIONAL_FEATURE_KEYS: OptionalFeatureKey[] = [
  'budgets', 'goals', 'funds', 'roadmap', 'forecast', 'emergency', 'bills',
  'calendar', 'recurring', 'debts', 'investments', 'review', 'reports', 'assistant',
];

export const DEFAULT_FEATURE_PREFERENCES = Object.fromEntries(
  OPTIONAL_FEATURE_KEYS.map((key) => [key, true]),
) as Record<OptionalFeatureKey, boolean>;

export const ACCOUNT_TYPES = [
  'Bank', 'E-Wallet', 'Cash', 'Investment', 'Credit Card', 'Paylater', 'Loan',
  'Mortgage', 'Deposit', 'Receivable', 'Custom',
] as const;

export const LIABILITY_TYPES = new Set(['Credit Card', 'Paylater', 'Loan', 'Mortgage']);

export const CATEGORY_COLORS: Record<string, string> = {
  Makanan: '#16876f',
  'Tempat Tinggal': '#d4685c',
  Tagihan: '#da9a3a',
  Transportasi: '#4e79c7',
  Hiburan: '#aa67a6',
  Investasi: '#5574b8',
  Kesehatan: '#d26b7a',
  Lainnya: '#74827b',
};

export const MINIMUM_BACKEND_SCHEMA = '1.16.0';
