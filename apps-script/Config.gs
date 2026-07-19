const VINN_CONFIG = Object.freeze({
  APP_NAME: 'Financial Planner',
  SCHEMA_VERSION: '1.6.0',
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
    AI_CHAT: 'AIChat',
    NOTIFICATION_STATES: 'NotificationStates',
    AUDIT_LOG: 'AuditLog',
    TRASH: 'Trash'
  },
  HEADERS: {
    Settings: ['key', 'value', 'updated_at'],
    Accounts: ['id', 'name', 'type', 'institution', 'mask', 'currency', 'opening_balance', 'color', 'is_liability', 'is_active', 'created_at', 'updated_at'],
    Categories: ['id', 'name', 'type', 'parent_id', 'color', 'icon', 'is_active', 'is_default', 'request_id', 'created_at', 'updated_at'],
    Transactions: ['id', 'transfer_group_id', 'request_id', 'date', 'time', 'type', 'account_id', 'destination_account_id', 'amount', 'category', 'merchant', 'notes', 'status', 'direction', 'created_at', 'updated_at', 'deleted_at', 'tags_json', 'location', 'splits_json', 'receipt_file_id', 'receipt_filename', 'receipt_content_type', 'receipt_size_bytes'],
    Budgets: ['id', 'month', 'category', 'limit_amount', 'rollover', 'created_at', 'updated_at'],
    Goals: ['id', 'name', 'target_amount', 'current_amount', 'deadline', 'account_id', 'color', 'icon', 'status', 'created_at', 'updated_at'],
    Bills: ['id', 'name', 'amount', 'category', 'account_id', 'frequency', 'due_date', 'reminder_days', 'status', 'last_paid_period', 'created_at', 'updated_at'],
    Assets: ['id', 'request_id', 'account_id', 'ticker', 'name', 'asset_class', 'exchange', 'currency', 'manual_price', 'latest_price_cache', 'price_source', 'price_status', 'price_updated_at', 'is_active', 'created_at', 'updated_at'],
    InvestmentTransactions: ['id', 'request_id', 'date', 'type', 'asset_id', 'account_id', 'units', 'price_per_unit', 'gross_amount', 'fee', 'tax', 'net_amount', 'average_cost_after', 'remaining_units_after', 'cost_basis_after', 'realized_pl', 'realized_pl_total', 'linked_cash_transaction_id', 'linked_adjustment_transaction_id', 'note', 'created_at', 'updated_at'],
    AIChat: ['id', 'role', 'content', 'period', 'context_manifest_json', 'created_at'],
    NotificationStates: ['notification_key', 'read_at', 'dismissed_at', 'created_at', 'updated_at'],
    AuditLog: ['id', 'request_id', 'action', 'module', 'entity_id', 'actor_email', 'details_json', 'created_at'],
    Trash: ['id', 'source_sheet', 'entity_id', 'payload_json', 'deleted_by', 'deleted_at']
  }
});

const DEFAULT_CATEGORIES = [
  ['cat-income', 'Pendapatan', 'income', '', '#16876f', 'wallet', true, true],
  ['cat-food', 'Makanan', 'expense', '', '#16876f', 'utensils', true, true],
  ['cat-home', 'Tempat Tinggal', 'expense', '', '#d4685c', 'home', true, true],
  ['cat-bill', 'Tagihan', 'expense', '', '#da9a3a', 'receipt', true, true],
  ['cat-transport', 'Transportasi', 'expense', '', '#4e79c7', 'car', true, true],
  ['cat-fun', 'Hiburan', 'expense', '', '#aa67a6', 'sparkles', true, true],
  ['cat-health', 'Kesehatan', 'expense', '', '#d26b7a', 'heart', true, true],
  ['cat-fee', 'Biaya Keuangan', 'expense', '', '#a36c5a', 'credit-card', true, true]
];
