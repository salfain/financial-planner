import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import type { AuthSession, CachedSnapshot, TransactionDraft } from '@/domain/types';
import { SECURE_STORE_KEYS } from '@/utils/secure-store-keys';

const SNAPSHOT_KEY = 'financial-planner:snapshot:v1';
const DRAFT_LATEST_AT_KEY = 'financial-planner:transaction-draft-latest-at:v1';
const DRAFT_CLEARED_AT_KEY = 'financial-planner:transaction-draft-cleared-at:v1';
const DRAFT_IO_TIMEOUT_MS = 1500;

type StoredTransactionDraft = {
  draft: TransactionDraft;
  savedAt: number;
};

let webSession: AuthSession | null = null;

function settleWithin<T>(operation: Promise<T>, fallback: T, timeoutMs = DRAFT_IO_TIMEOUT_MS): Promise<T> {
  return Promise.race([
    operation.catch(() => fallback),
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), timeoutMs)),
  ]);
}

const numericTimestamp = (value: string | null) => {
  const timestamp = Number(value ?? 0);
  return Number.isFinite(timestamp) && timestamp > 0 ? timestamp : 0;
};

const isStoredTransactionDraft = (value: StoredTransactionDraft | TransactionDraft): value is StoredTransactionDraft =>
  typeof (value as StoredTransactionDraft).savedAt === 'number'
  && Boolean((value as StoredTransactionDraft).draft);

async function secureGet<T>(key: string): Promise<T | null> {
  if (Platform.OS === 'web') return key === SECURE_STORE_KEYS.auth ? webSession as T | null : null;
  const raw = await SecureStore.getItemAsync(key);
  if (!raw) return null;
  try { return JSON.parse(raw) as T; } catch { return null; }
}

async function secureSet<T>(key: string, value: T | null) {
  if (Platform.OS === 'web') {
    if (key === SECURE_STORE_KEYS.auth) webSession = value as AuthSession | null;
    return;
  }
  if (value === null) await SecureStore.deleteItemAsync(key);
  else await SecureStore.setItemAsync(key, JSON.stringify(value), {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

export async function loadAuthSession() {
  const session = await secureGet<AuthSession>(SECURE_STORE_KEYS.auth);
  if (!session) await secureSet<AuthSession>(SECURE_STORE_KEYS.legacyAuth, null);
  return session;
}
export const saveAuthSession = (session: AuthSession) => secureSet(SECURE_STORE_KEYS.auth, session);
export const clearAuthSession = () => Promise.all([
  secureSet<AuthSession>(SECURE_STORE_KEYS.auth, null),
  secureSet<AuthSession>(SECURE_STORE_KEYS.legacyAuth, null),
]);

export async function loadCachedSnapshot(): Promise<CachedSnapshot | null> {
  const raw = await AsyncStorage.getItem(SNAPSHOT_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw) as CachedSnapshot; } catch { return null; }
}

export async function saveCachedSnapshot(cache: CachedSnapshot) {
  const sanitized: CachedSnapshot = {
    ...cache,
    snapshot: {
      ...cache.snapshot,
      transactions: cache.snapshot.transactions.slice(0, 100).map((transaction) => ({
        ...transaction,
        merchant: undefined,
        notes: undefined,
        tags: [],
        location: undefined,
        receipt: undefined,
      })),
      auditLogs: cache.snapshot.auditLogs.slice(0, 20).map((audit) => ({ ...audit, details: undefined, actor: undefined })),
    },
  };
  await AsyncStorage.setItem(SNAPSHOT_KEY, JSON.stringify(sanitized));
}

export const clearCachedSnapshot = () => AsyncStorage.removeItem(SNAPSHOT_KEY);

export async function loadTransactionDraft(): Promise<TransactionDraft | null> {
  const [stored, latestAtRaw, clearedAtRaw] = await Promise.all([
    settleWithin(secureGet<StoredTransactionDraft | TransactionDraft>(SECURE_STORE_KEYS.transactionDraft), null),
    AsyncStorage.getItem(DRAFT_LATEST_AT_KEY).catch(() => null),
    AsyncStorage.getItem(DRAFT_CLEARED_AT_KEY).catch(() => null),
  ]);
  if (!stored) return null;
  const latestAt = numericTimestamp(latestAtRaw);
  const clearedAt = numericTimestamp(clearedAtRaw);
  if (!isStoredTransactionDraft(stored)) {
    return latestAt || clearedAt ? null : stored;
  }
  if (stored.savedAt < latestAt || stored.savedAt <= clearedAt) return null;
  return stored.draft;
}

export async function saveTransactionDraft(draft: TransactionDraft) {
  const savedAt = Date.now();
  await AsyncStorage.setItem(DRAFT_LATEST_AT_KEY, String(savedAt));
  await settleWithin(secureSet(SECURE_STORE_KEYS.transactionDraft, { draft, savedAt }), undefined);
}

export async function clearTransactionDraft() {
  const clearedAt = Date.now();
  await AsyncStorage.setItem(DRAFT_CLEARED_AT_KEY, String(clearedAt));
  await settleWithin(secureSet<StoredTransactionDraft>(SECURE_STORE_KEYS.transactionDraft, null), undefined);
}

export async function clearSensitiveLocalData() {
  await Promise.all([
    clearAuthSession(),
    clearCachedSnapshot(),
    clearTransactionDraft(),
  ]);
}
