const VINN_CONFIG = Object.freeze({
  APP_NAME: 'VINN STORE',
  SCHEMA_VERSION: '1.0.0',
  TIMEZONE: 'Asia/Jakarta',
  CURRENCY: 'IDR',
  CACHE_SECONDS: 300,
  SHEETS: {
    SETTINGS: 'Settings',
    ACCOUNTS: 'Accounts',
    CATEGORIES: 'Categories',
    TRANSACTIONS: 'Transactions',
    BUDGETS: 'Budgets',
    GOALS: 'Goals',
    BILLS: 'Bills',
    ASSETS: 'Assets',
    INVESTMENT_TX: 'InvestmentTransactions',
    AUDIT_LOG: 'AuditLog',
    TRASH: 'Trash'
  },
  HEADERS: {
    Settings: ['key', 'value', 'updated_at'],
    Accounts: ['id', 'name', 'type', 'institution', 'mask', 'currency', 'opening_balance', 'color', 'is_liability', 'is_active', 'created_at', 'updated_at'],
    Categories: ['id', 'name', 'type', 'parent_id', 'color', 'icon', 'is_active'],
    Transactions: ['id', 'transfer_group_id', 'request_id', 'date', 'time', 'type', 'account_id', 'destination_account_id', 'amount', 'category', 'merchant', 'notes', 'status', 'direction', 'created_at', 'updated_at', 'deleted_at'],
    Budgets: ['id', 'month', 'category', 'limit_amount', 'rollover', 'created_at', 'updated_at'],
    Goals: ['id', 'name', 'target_amount', 'current_amount', 'deadline', 'account_id', 'color', 'icon', 'status', 'created_at', 'updated_at'],
    Bills: ['id', 'name', 'amount', 'category', 'account_id', 'frequency', 'due_date', 'reminder_days', 'status', 'last_paid_period', 'created_at', 'updated_at'],
    Assets: ['id', 'ticker', 'name', 'asset_class', 'currency', 'market_price', 'price_source', 'price_updated_at', 'is_active'],
    InvestmentTransactions: ['id', 'request_id', 'date', 'type', 'asset_id', 'account_id', 'units', 'price', 'fee', 'tax', 'total_amount', 'created_at'],
    AuditLog: ['id', 'request_id', 'action', 'module', 'entity_id', 'actor_email', 'details_json', 'created_at'],
    Trash: ['id', 'source_sheet', 'entity_id', 'payload_json', 'deleted_by', 'deleted_at']
  }
});

const DEFAULT_CATEGORIES = [
  ['cat-income', 'Pendapatan', 'income', '', '#16876f', 'wallet', true],
  ['cat-food', 'Makanan', 'expense', '', '#16876f', 'utensils', true],
  ['cat-home', 'Tempat Tinggal', 'expense', '', '#d4685c', 'home', true],
  ['cat-bill', 'Tagihan', 'expense', '', '#da9a3a', 'receipt', true],
  ['cat-transport', 'Transportasi', 'expense', '', '#4e79c7', 'car', true],
  ['cat-fun', 'Hiburan', 'expense', '', '#aa67a6', 'sparkles', true],
  ['cat-health', 'Kesehatan', 'expense', '', '#d26b7a', 'heart', true],
  ['cat-fee', 'Biaya Keuangan', 'expense', '', '#a36c5a', 'credit-card', true]
];
