import NetInfo, { useNetInfo } from '@react-native-community/netinfo';
import { createContext, type PropsWithChildren, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { MINIMUM_BACKEND_SCHEMA } from '@/domain/constants';
import { normalizeSnapshot } from '@/domain/normalize';
import type { AuthSession, FinanceSnapshot, PersonalAccessCredentials, SetupWorkspaceInput } from '@/domain/types';
import {
  createRequestId,
  isAuthApiError,
  MobileApiClient,
  MobileApiError,
  MutationCommittedError,
} from '@/services/api';
import {
  clearSensitiveLocalData,
  loadAuthSession,
  loadCachedSnapshot,
  saveAuthSession,
  saveCachedSnapshot,
} from '@/services/storage';
import { currentMonth } from '@/utils/format';
import { normalizeMobileApiUrl, normalizePersonalAccessKey } from '@/utils/personal-access';
import { isBackendCompatible } from '@/utils/version';

type AppPhase = 'booting' | 'signed-out' | 'ready';
const BOOT_STORAGE_TIMEOUT_MS = 4000;
const DEFAULT_READ_CACHE_TTL_MS = 5 * 60_000;
const RESUME_REFRESH_AFTER_MS = 60_000;

type ReadOptions = {
  cacheTtlMs?: number;
  force?: boolean;
};

type CachedRead = {
  value: unknown;
  expiresAt: number;
};

const readCacheKey = (action: string, payload: Record<string, unknown>) => {
  const sortedPayload = Object.keys(payload).sort().reduce<Record<string, unknown>>((result, key) => {
    result[key] = payload[key];
    return result;
  }, {});
  return `${action}:${JSON.stringify(sortedPayload)}`;
};

function withFallbackTimeout<T>(promise: Promise<T>, fallback: T, timeoutMs = BOOT_STORAGE_TIMEOUT_MS): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), timeoutMs)),
  ]);
}

type MutationResult<T> = {
  data?: T;
  requestId: string;
  committed: boolean;
};

type AppContextValue = {
  phase: AppPhase;
  session: AuthSession | null;
  snapshot: FinanceSnapshot | null;
  selectedMonth: string;
  cacheUpdatedAt: string | null;
  isOnline: boolean;
  isRefreshing: boolean;
  isMutating: boolean;
  authError: string | null;
  dataError: string | null;
  login: (credentials: PersonalAccessCredentials) => Promise<void>;
  logout: () => Promise<void>;
  refresh: (month?: string) => Promise<FinanceSnapshot | null>;
  setSelectedMonth: (month: string) => Promise<void>;
  setupWorkspace: (input: SetupWorkspaceInput, requestId?: string) => Promise<void>;
  mutate: <T>(action: string, payload: Record<string, unknown>, requestId?: string) => Promise<MutationResult<T>>;
  read: <T>(action: string, payload?: Record<string, unknown>, options?: ReadOptions) => Promise<T>;
  clearDataError: () => void;
};

const AppContext = createContext<AppContextValue | null>(null);
let currentApiCredentials: PersonalAccessCredentials | null = null;
const mobileApi = new MobileApiClient(async () => {
  if (!currentApiCredentials) throw new MobileApiError('AUTH_REQUIRED', 'URL dan access key pribadi diperlukan.');
  return currentApiCredentials;
});

export function AppProvider({ children }: PropsWithChildren) {
  const network = useNetInfo();
  const [phase, setPhase] = useState<AppPhase>('booting');
  const [session, setSession] = useState<AuthSession | null>(null);
  const [snapshot, setSnapshot] = useState<FinanceSnapshot | null>(null);
  const [selectedMonthState, setSelectedMonthState] = useState(currentMonth());
  const [cacheUpdatedAt, setCacheUpdatedAt] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [mutationCount, setMutationCount] = useState(0);
  const [authError, setAuthError] = useState<string | null>(null);
  const [dataError, setDataError] = useState<string | null>(null);
  const sessionRef = useRef<AuthSession | null>(null);
  const monthRef = useRef(selectedMonthState);
  const inFlightMutations = useRef(new Set<string>());
  const readCacheRef = useRef(new Map<string, CachedRead>());
  const inFlightReadsRef = useRef(new Map<string, Promise<unknown>>());
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const backgroundedAtRef = useRef<number | null>(null);

  const isOnline = network.isConnected !== false && network.isInternetReachable !== false;

  const clearReadCache = useCallback(() => {
    readCacheRef.current.clear();
    inFlightReadsRef.current.clear();
  }, []);

  const primeSnapshotReadCache = useCallback((next: FinanceSnapshot, month: string) => {
    const expiresAt = Date.now() + DEFAULT_READ_CACHE_TTL_MS;
    const set = (action: string, payload: Record<string, unknown>, value: unknown) => {
      readCacheRef.current.set(readCacheKey(action, payload), { value, expiresAt });
    };
    const transactions = next.transactions.filter((item) => !item.deletedAt);
    const transactionPage = {
      items: transactions.slice(0, 25),
      page: 1,
      pageSize: 25,
      total: transactions.length,
      totalPages: Math.max(1, Math.ceil(transactions.length / 25)),
    };
    set('bootstrap', { month }, next);
    set('listTransactions', { month, page: 1, pageSize: 25 }, transactionPage);
    set('listCategories', {}, { items: next.categories, categories: next.categories });
    set('listAuditLogs', { page: 1, pageSize: 50 }, { items: next.auditLogs });
    set('listRecurring', {}, { templates: next.recurring });
  }, []);

  const applySession = useCallback(async (next: AuthSession | null) => {
    clearReadCache();
    sessionRef.current = next;
    currentApiCredentials = next ? { apiUrl: next.apiUrl, accessKey: next.accessKey } : null;
    setSession(next);
    if (next) await saveAuthSession(next);
  }, [clearReadCache]);

  const validateSnapshot = useCallback((value: unknown) => {
    const normalized = normalizeSnapshot(value);
    if (!isBackendCompatible(normalized.schemaVersion, MINIMUM_BACKEND_SCHEMA)) {
      throw new MobileApiError(
        'BACKEND_UPDATE_REQUIRED',
        `Backend perlu diperbarui ke schema ${MINIMUM_BACKEND_SCHEMA} atau lebih baru.`,
      );
    }
    return normalized;
  }, []);

  const read = useCallback(async <T,>(
    action: string,
    payload: Record<string, unknown> = {},
    options: ReadOptions = {},
  ) => {
    const key = readCacheKey(action, payload);
    const ttl = action === 'mutationStatus'
      ? 0
      : Math.max(0, options.cacheTtlMs ?? DEFAULT_READ_CACHE_TTL_MS);
    if (!options.force) {
      const cached = readCacheRef.current.get(key);
      if (cached && cached.expiresAt > Date.now()) return cached.value as T;
      const existing = inFlightReadsRef.current.get(key);
      if (existing) return existing as Promise<T>;
    }
    if (!isOnline) throw new MobileApiError('OFFLINE_READ_ONLY', 'Tidak ada koneksi. Data cache tetap dapat dilihat.');
    const request = mobileApi.read<T>(action, payload).then((value) => {
      if (ttl > 0) readCacheRef.current.set(key, { value, expiresAt: Date.now() + ttl });
      return value;
    });
    inFlightReadsRef.current.set(key, request);
    try {
      return await request;
    } catch (error) {
      if (isAuthApiError(error)) {
        await clearSensitiveLocalData();
        clearReadCache();
        sessionRef.current = null;
        currentApiCredentials = null;
        setSession(null);
        setSnapshot(null);
        setPhase('signed-out');
        setAuthError('Akses ditolak. Periksa kembali URL dan access key pribadi.');
      }
      throw error;
    } finally {
      if (inFlightReadsRef.current.get(key) === request) inFlightReadsRef.current.delete(key);
    }
  }, [clearReadCache, isOnline]);

  const refresh = useCallback(async (month = monthRef.current) => {
    if (!sessionRef.current || !isOnline) return snapshot;
    setIsRefreshing(true);
    setDataError(null);
    try {
      const raw = await read<unknown>('bootstrap', { month }, { force: true });
      const next = validateSnapshot(raw);
      const updatedAt = new Date().toISOString();
      primeSnapshotReadCache(next, month);
      setSnapshot(next);
      setCacheUpdatedAt(updatedAt);
      await saveCachedSnapshot({ month, snapshot: next, updatedAt });
      return next;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Data tidak dapat dimuat.';
      setDataError(message);
      if (isAuthApiError(error)) {
        await clearSensitiveLocalData();
        sessionRef.current = null;
        currentApiCredentials = null;
        setSession(null);
        setSnapshot(null);
        setPhase('signed-out');
        setAuthError('Akses ditolak. Periksa kembali URL dan access key pribadi.');
      }
      return null;
    } finally {
      setIsRefreshing(false);
    }
  }, [isOnline, primeSnapshotReadCache, read, snapshot, validateSnapshot]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [storedSession, cached] = await Promise.all([
          loadAuthSession(),
          withFallbackTimeout(loadCachedSnapshot(), null),
        ]);
        if (!active) return;
        if (cached) {
          setSnapshot(cached.snapshot);
          setCacheUpdatedAt(cached.updatedAt);
          setSelectedMonthState(cached.month);
          monthRef.current = cached.month;
        }

        if (!storedSession) {
          setPhase('signed-out');
          return;
        }
        const usableSession: AuthSession = {
          apiUrl: normalizeMobileApiUrl(storedSession.apiUrl),
          accessKey: normalizePersonalAccessKey(storedSession.accessKey),
          storedAt: storedSession.storedAt || new Date().toISOString(),
        };
        await applySession(usableSession);
        if (cached) primeSnapshotReadCache(cached.snapshot, cached.month);
        setPhase('ready');
        // Network probing is only needed when restoring an existing session.
        // It must not hold the signed-out screen hostage on a fresh install.
        const connection = await withFallbackTimeout(NetInfo.fetch(), null);
        const online = connection !== null
          && connection.isConnected !== false
          && connection.isInternetReachable !== false;
        if (online) {
          const raw = await mobileApi.read<unknown>('bootstrap', { month: monthRef.current }, { retries: 1 });
          const next = validateSnapshot(raw);
          if (!active) return;
          const updatedAt = new Date().toISOString();
          primeSnapshotReadCache(next, monthRef.current);
          setSnapshot(next);
          setCacheUpdatedAt(updatedAt);
          await saveCachedSnapshot({ month: monthRef.current, snapshot: next, updatedAt });
        }
      } catch (error) {
        if (!active) return;
        const message = error instanceof Error ? error.message : 'Sesi tidak dapat dipulihkan.';
        if (isAuthApiError(error)) {
          await clearSensitiveLocalData();
          clearReadCache();
          sessionRef.current = null;
          currentApiCredentials = null;
          setSession(null);
          setSnapshot(null);
          setAuthError('Akses ditolak. Periksa kembali URL dan access key pribadi.');
          setPhase('signed-out');
        } else if (sessionRef.current) {
          setDataError(message);
          setPhase('ready');
        } else {
          setAuthError(message);
          setPhase('signed-out');
        }
      }
    })();
    return () => { active = false; };
  }, [applySession, clearReadCache, primeSnapshotReadCache, validateSnapshot]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      const previousState = appStateRef.current;
      appStateRef.current = nextState;
      if (nextState !== 'active') {
        if (previousState === 'active') backgroundedAtRef.current = Date.now();
        return;
      }
      const backgroundedAt = backgroundedAtRef.current;
      backgroundedAtRef.current = null;
      if (!backgroundedAt || Date.now() - backgroundedAt < RESUME_REFRESH_AFTER_MS || !sessionRef.current) return;
      clearReadCache();
      void refresh(monthRef.current);
    });
    return () => subscription.remove();
  }, [clearReadCache, refresh]);

  const login = useCallback(async (credentials: PersonalAccessCredentials) => {
    setAuthError(null);
    try {
      const next: AuthSession = {
        apiUrl: normalizeMobileApiUrl(credentials.apiUrl),
        accessKey: normalizePersonalAccessKey(credentials.accessKey),
        storedAt: new Date().toISOString(),
      };
      await applySession(next);
      setPhase('ready');
      const raw = await mobileApi.read<unknown>('bootstrap', { month: monthRef.current }, { retries: 1 });
      const normalized = validateSnapshot(raw);
      const updatedAt = new Date().toISOString();
      primeSnapshotReadCache(normalized, monthRef.current);
      setSnapshot(normalized);
      setCacheUpdatedAt(updatedAt);
      await saveCachedSnapshot({ month: monthRef.current, snapshot: normalized, updatedAt });
    } catch (error) {
      await clearSensitiveLocalData();
      sessionRef.current = null;
      currentApiCredentials = null;
      setSession(null);
      setSnapshot(null);
      setPhase('signed-out');
      setAuthError(error instanceof Error ? error.message : 'Perangkat tidak dapat dihubungkan.');
      throw error;
    }
  }, [applySession, primeSnapshotReadCache, validateSnapshot]);

  const logout = useCallback(async () => {
    await clearSensitiveLocalData();
    clearReadCache();
    sessionRef.current = null;
    currentApiCredentials = null;
    setSession(null);
    setSnapshot(null);
    setCacheUpdatedAt(null);
    setDataError(null);
    setPhase('signed-out');
  }, [clearReadCache]);

  const mutate = useCallback(async <T,>(
    action: string,
    payload: Record<string, unknown>,
    requestId = createRequestId(),
  ): Promise<MutationResult<T>> => {
    if (!isOnline) throw new MobileApiError('OFFLINE_READ_ONLY', 'Perubahan dinonaktifkan saat offline. Sambungkan internet lalu coba lagi.', undefined, requestId);
    const key = `${action}:${requestId}`;
    if (inFlightMutations.current.has(key)) {
      throw new MobileApiError('MUTATION_IN_PROGRESS', 'Perubahan ini sedang diproses.', undefined, requestId);
    }
    inFlightMutations.current.add(key);
    setMutationCount((value) => value + 1);
    try {
      const result = await mobileApi.mutation<T>(action, payload, requestId);
      clearReadCache();
      await refresh(monthRef.current);
      return { data: result.data, requestId, committed: true };
    } catch (error) {
      if (error instanceof MutationCommittedError) {
        clearReadCache();
        await refresh(monthRef.current);
        return { requestId, committed: true };
      }
      if (isAuthApiError(error)) {
        await clearSensitiveLocalData();
        clearReadCache();
        sessionRef.current = null;
        currentApiCredentials = null;
        setSession(null);
        setSnapshot(null);
        setPhase('signed-out');
        setAuthError('Access key tidak lagi diterima. Hubungkan perangkat kembali.');
      }
      throw error;
    } finally {
      inFlightMutations.current.delete(key);
      setMutationCount((value) => Math.max(0, value - 1));
    }
  }, [clearReadCache, isOnline, refresh]);

  const setupWorkspace = useCallback(async (input: SetupWorkspaceInput, requestId = createRequestId()) => {
    const result = await mutate<unknown>('setupWorkspace', input as unknown as Record<string, unknown>, requestId);
    if (result.data) {
      const normalized = validateSnapshot(result.data);
      const updatedAt = new Date().toISOString();
      primeSnapshotReadCache(normalized, monthRef.current);
      setSnapshot(normalized);
      setCacheUpdatedAt(updatedAt);
      await saveCachedSnapshot({ month: monthRef.current, snapshot: normalized, updatedAt });
    } else {
      await refresh(monthRef.current);
    }
  }, [mutate, primeSnapshotReadCache, refresh, validateSnapshot]);

  const setSelectedMonth = useCallback(async (month: string) => {
    if (!/^\d{4}-\d{2}$/.test(month)) return;
    monthRef.current = month;
    setSelectedMonthState(month);
    await refresh(month);
  }, [refresh]);

  const value = useMemo<AppContextValue>(() => ({
    phase,
    session,
    snapshot,
    selectedMonth: selectedMonthState,
    cacheUpdatedAt,
    isOnline,
    isRefreshing,
    isMutating: mutationCount > 0,
    authError,
    dataError,
    login,
    logout,
    refresh,
    setSelectedMonth,
    setupWorkspace,
    mutate,
    read,
    clearDataError: () => setDataError(null),
  }), [
    authError, cacheUpdatedAt, dataError, isOnline, isRefreshing, login, logout,
    mutate, mutationCount, phase, read, refresh, selectedMonthState, session,
    setSelectedMonth, setupWorkspace, snapshot,
  ]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const value = useContext(AppContext);
  if (!value) throw new Error('useApp harus dipakai di dalam AppProvider.');
  return value;
}
