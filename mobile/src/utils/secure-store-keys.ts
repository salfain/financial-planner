export const SECURE_STORE_KEYS = {
  auth: 'financial-planner.personal-access.v3',
  legacyAuth: 'financial-planner.auth.v1',
  transactionDraft: 'financial-planner.transaction-draft.v2',
} as const;

export const isValidSecureStoreKey = (key: string) => /^[A-Za-z0-9._-]+$/.test(key);
