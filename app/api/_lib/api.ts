export const DEFAULT_WORKSPACE_ID = "vinn-store";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function routeError(error: unknown): Response {
  if (error instanceof ApiError) {
    return Response.json(
      {
        error: {
          code: error.code,
          message: error.message,
          ...(error.details === undefined ? {} : { details: error.details }),
        },
      },
      { status: error.status },
    );
  }

  const message = error instanceof Error ? error.message : "Unexpected error";
  if (message.includes("no such table")) {
    return Response.json(
      {
        error: {
          code: "DATABASE_NOT_MIGRATED",
          message: "Database belum siap. Terapkan migration D1 terbaru lalu coba lagi.",
        },
      },
      { status: 503 },
    );
  }
  if (message.includes("UNIQUE constraint failed")) {
    return Response.json(
      { error: { code: "CONFLICT", message: "Data yang sama sudah tersimpan." } },
      { status: 409 },
    );
  }
  if (message.includes("FOREIGN KEY constraint failed")) {
    return Response.json(
      {
        error: {
          code: "REFERENCE_CONFLICT",
          message: "Data masih dipakai oleh catatan lain dan tidak dapat dihapus.",
        },
      },
      { status: 409 },
    );
  }
  if (message.includes("CHECK constraint failed")) {
    return Response.json(
      {
        error: {
          code: "BALANCE_CONFLICT",
          message: "Operasi dibatalkan karena akan menghasilkan saldo yang tidak valid.",
        },
      },
      { status: 409 },
    );
  }

  return Response.json(
    { error: { code: "INTERNAL_ERROR", message } },
    { status: 500 },
  );
}

export async function readJsonObject(request: Request): Promise<Record<string, unknown>> {
  let value: unknown;
  try {
    value = await request.json();
  } catch {
    throw new ApiError(400, "INVALID_JSON", "Body harus berupa JSON yang valid.");
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ApiError(400, "INVALID_BODY", "Body harus berupa object JSON.");
  }
  return value as Record<string, unknown>;
}

export async function readOptionalJsonObject(
  request: Request,
): Promise<Record<string, unknown>> {
  const text = await request.text();
  if (!text.trim()) return {};
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new ApiError(400, "INVALID_JSON", "Body harus berupa JSON yang valid.");
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ApiError(400, "INVALID_BODY", "Body harus berupa object JSON.");
  }
  return value as Record<string, unknown>;
}

export function resolveWorkspaceId(
  request: Request,
  payload?: Record<string, unknown>,
): string {
  const url = new URL(request.url);
  const value =
    payload?.workspaceId ??
    request.headers.get("X-Workspace-Id") ??
    url.searchParams.get("workspaceId") ??
    DEFAULT_WORKSPACE_ID;
  return validateId(value, "workspaceId");
}

export function validateId(value: unknown, field = "id"): string {
  if (typeof value !== "string" || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/.test(value)) {
    throw new ApiError(
      400,
      "INVALID_FIELD",
      `${field} harus 1-80 karakter alfanumerik, dash, atau underscore.`,
      { field },
    );
  }
  return value;
}

export function requiredString(
  input: Record<string, unknown>,
  field: string,
  maxLength = 160,
): string {
  const value = input[field];
  if (typeof value !== "string" || !value.trim()) {
    throw new ApiError(400, "INVALID_FIELD", `${field} wajib diisi.`, { field });
  }
  const normalized = value.trim();
  if (normalized.length > maxLength) {
    throw new ApiError(400, "INVALID_FIELD", `${field} terlalu panjang.`, { field });
  }
  return normalized;
}

export function optionalString(
  input: Record<string, unknown>,
  field: string,
  maxLength = 160,
): string | null | undefined {
  const value = input[field];
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (typeof value !== "string") {
    throw new ApiError(400, "INVALID_FIELD", `${field} harus berupa teks.`, { field });
  }
  const normalized = value.trim();
  if (normalized.length > maxLength) {
    throw new ApiError(400, "INVALID_FIELD", `${field} terlalu panjang.`, { field });
  }
  return normalized || null;
}

export function positiveInteger(input: Record<string, unknown>, field: string): number {
  const value = input[field];
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0) {
    throw new ApiError(
      400,
      "INVALID_FIELD",
      `${field} harus berupa bilangan bulat positif dalam Rupiah.`,
      { field },
    );
  }
  return value;
}

export function nonnegativeInteger(input: Record<string, unknown>, field: string): number {
  const value = input[field];
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new ApiError(
      400,
      "INVALID_FIELD",
      `${field} harus berupa bilangan bulat non-negatif dalam Rupiah.`,
      { field },
    );
  }
  return value;
}

export function booleanValue(input: Record<string, unknown>, field: string): boolean {
  const value = input[field];
  if (typeof value !== "boolean") {
    throw new ApiError(400, "INVALID_FIELD", `${field} harus berupa boolean.`, { field });
  }
  return value;
}

export function enumValue<const T extends readonly string[]>(
  input: Record<string, unknown>,
  field: string,
  allowed: T,
): T[number] {
  const value = input[field];
  if (typeof value !== "string" || !(allowed as readonly string[]).includes(value)) {
    throw new ApiError(
      400,
      "INVALID_FIELD",
      `${field} harus salah satu dari: ${allowed.join(", ")}.`,
      { field },
    );
  }
  return value as T[number];
}

export function isoDate(input: Record<string, unknown>, field: string): string {
  const value = input[field];
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new ApiError(400, "INVALID_FIELD", `${field} harus berformat YYYY-MM-DD.`, {
      field,
    });
  }
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new ApiError(400, "INVALID_FIELD", `${field} bukan tanggal yang valid.`, {
      field,
    });
  }
  return value;
}

export function monthPeriod(input: Record<string, unknown>, field = "period"): string {
  const value = input[field];
  if (typeof value !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) {
    throw new ApiError(400, "INVALID_FIELD", `${field} harus berformat YYYY-MM.`, {
      field,
    });
  }
  return value;
}

export function colorValue(input: Record<string, unknown>, field = "color"): string {
  const value = input[field];
  if (typeof value !== "string" || !/^#[0-9a-fA-F]{6}$/.test(value)) {
    throw new ApiError(400, "INVALID_FIELD", `${field} harus berupa warna hex #RRGGBB.`, {
      field,
    });
  }
  return value.toLowerCase();
}

export function makeId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}
