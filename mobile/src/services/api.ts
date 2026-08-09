import * as Crypto from 'expo-crypto';

import { normalizeMobileApiUrl } from '@/utils/personal-access';
import { shouldClearSessionForCode } from '@/utils/auth-errors';

export type ApiErrorPayload = {
  code: string;
  message: string;
  details?: unknown;
};

export type ApiEnvelope<T> = {
  ok: boolean;
  data?: T;
  error?: ApiErrorPayload;
  requestId: string;
  timestamp?: string;
};

export class MobileApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: unknown,
    public requestId?: string,
  ) {
    super(message);
    this.name = 'MobileApiError';
  }
}

export class MutationUncertainError extends MobileApiError {
  constructor(public action: string, requestId: string) {
    super(
      'MUTATION_STATUS_UNKNOWN',
      'Status penyimpanan belum dapat dipastikan. Jangan membuat requestId baru; periksa koneksi lalu coba periksa status.',
      undefined,
      requestId,
    );
    this.name = 'MutationUncertainError';
  }
}

export class MutationCommittedError extends MobileApiError {
  constructor(public action: string, requestId: string) {
    super('MUTATION_COMMITTED', 'Perubahan sudah tersimpan. Data sedang dimuat ulang.', undefined, requestId);
    this.name = 'MutationCommittedError';
  }
}

const READ_ACTIONS = new Set([
  'health', 'mutationStatus', 'bootstrap', 'licenseStatus', 'getRoadmapSettings',
  'getDebtPlanner', 'getCashflowForecastSettings', 'getEmergencyFundSettings',
  'monthlyClosingStatus', 'listTransactions', 'inspectLedger', 'listCategories',
  'categoryRules', 'listAuditLogs', 'listRecurring', 'backupOverview', 'listReports',
  'migrationHistory', 'notificationOverview', 'aiKeyStatus', 'aiSettings', 'aiHistory',
]);

const wait = (duration: number) => new Promise((resolve) => setTimeout(resolve, duration));

export type ApiCredentials = { apiUrl: string; accessKey: string };

export const createRequestId = () => Crypto.randomUUID();
export const isAuthApiError = (error: unknown) => error instanceof MobileApiError && shouldClearSessionForCode(error.code);
export const isMutationAction = (action: string) => !READ_ACTIONS.has(action);

async function fetchEnvelope<T>(
  action: string,
  payload: Record<string, unknown>,
  credentials: ApiCredentials,
  requestId: string,
  timeoutMs: number,
): Promise<ApiEnvelope<T>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(normalizeMobileApiUrl(credentials.apiUrl), {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, requestId, accessKey: credentials.accessKey, payload }),
      signal: controller.signal,
    });
    const raw = await response.text();
    let envelope: ApiEnvelope<T>;
    try { envelope = JSON.parse(raw) as ApiEnvelope<T>; }
    catch { throw new MobileApiError('INVALID_API_RESPONSE', 'Backend tidak mengembalikan JSON yang valid.', undefined, requestId); }
    if (typeof envelope.ok !== 'boolean') {
      throw new MobileApiError('INVALID_API_RESPONSE', 'Envelope respons backend tidak valid.', undefined, requestId);
    }
    return envelope;
  } catch (error) {
    if (error instanceof MobileApiError) throw error;
    if (error instanceof Error && error.name === 'AbortError') {
      throw new MobileApiError('REQUEST_TIMEOUT', 'Waktu tunggu Google Apps Script habis.', undefined, requestId);
    }
    throw new MobileApiError('NETWORK_ERROR', 'Tidak dapat terhubung ke backend. Periksa koneksi internet.', undefined, requestId);
  } finally {
    clearTimeout(timer);
  }
}

function unwrap<T>(envelope: ApiEnvelope<T>): T {
  if (!envelope.ok) {
    throw new MobileApiError(
      envelope.error?.code ?? 'REQUEST_FAILED',
      envelope.error?.message ?? 'Permintaan gagal.',
      envelope.error?.details,
      envelope.requestId,
    );
  }
  return envelope.data as T;
}

export class MobileApiClient {
  constructor(private readonly credentialProvider: () => Promise<ApiCredentials>) {}

  async read<T>(action: string, payload: Record<string, unknown> = {}, options?: { requestId?: string; retries?: number }) {
    const requestId = options?.requestId ?? createRequestId();
    const retries = Math.max(0, Math.min(2, options?.retries ?? 1));
    for (let attempt = 0; attempt <= retries; attempt += 1) {
      try {
        const credentials = await this.credentialProvider();
        return unwrap(await fetchEnvelope<T>(action, payload, credentials, requestId, 15_000));
      } catch (error) {
        const retryable = error instanceof MobileApiError && ['NETWORK_ERROR', 'REQUEST_TIMEOUT', 'LOCK_TIMEOUT'].includes(error.code);
        if (!retryable || attempt === retries) throw error;
        await wait(500 * (2 ** attempt));
      }
    }
    throw new MobileApiError('REQUEST_FAILED', 'Permintaan tidak dapat diselesaikan.', undefined, requestId);
  }

  async mutation<T>(action: string, payload: Record<string, unknown>, requestId = createRequestId()) {
    const credentials = await this.credentialProvider();
    try {
      const result = unwrap(await fetchEnvelope<T & { committed?: boolean }>(action, payload, credentials, requestId, 15_000));
      if (result && typeof result === 'object' && result.committed) throw new MutationCommittedError(action, requestId);
      return { data: result as T, requestId };
    } catch (error) {
      if (!(error instanceof MobileApiError) || !['NETWORK_ERROR', 'REQUEST_TIMEOUT'].includes(error.code)) throw error;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        await wait(800 * (attempt + 1));
        try {
          const status = await this.mutationStatus(requestId);
          if (status.completed) throw new MutationCommittedError(action, requestId);
        } catch (statusError) {
          if (statusError instanceof MutationCommittedError) throw statusError;
        }
      }
      throw new MutationUncertainError(action, requestId);
    }
  }

  async mutationStatus(requestId: string) {
    const credentials = await this.credentialProvider();
    return unwrap(await fetchEnvelope<{
      completed: boolean;
      action: string | null;
      module: string | null;
      entityId: string | null;
      completedAt: string | null;
    }>('mutationStatus', {}, credentials, requestId, 8_000));
  }
}
