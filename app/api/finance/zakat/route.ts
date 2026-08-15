import { getD1 } from "@/db";
import { DEFAULT_ZAKAT_SETTINGS, type ZakatSettings } from "@/lib/zakat";
import { auditStatement } from "../../_lib/audit";
import { ApiError, nowIso, readJsonObject, requiredString, resolveWorkspaceId, routeError } from "../../_lib/api";
import { requireCapability } from "../../_lib/license";
import { requireWorkspace } from "../../_lib/repository";

type Row = {
  goldPricePerGram: number;
  nisabGrams: number;
  haulStartDate: string;
  includeInvestments: number;
  excludedAccountIdsJson: string;
};

const selectSql = `SELECT gold_price_per_gram AS goldPricePerGram, nisab_grams AS nisabGrams,
  haul_start_date AS haulStartDate, include_investments AS includeInvestments,
  excluded_account_ids_json AS excludedAccountIdsJson
  FROM zakat_settings WHERE workspace_id = ? LIMIT 1`;

const parseRow = (row?: Row | null): ZakatSettings => {
  if (!row) return DEFAULT_ZAKAT_SETTINGS;
  let excludedAccountIds: string[] = [];
  try { const value = JSON.parse(row.excludedAccountIdsJson); if (Array.isArray(value)) excludedAccountIds = value.map(String); } catch { /* default */ }
  return {
    goldPricePerGram: row.goldPricePerGram,
    nisabGrams: row.nisabGrams,
    haulStartDate: row.haulStartDate,
    includeInvestments: Boolean(row.includeInvestments),
    excludedAccountIds,
  };
};

const integer = (payload: Record<string, unknown>, field: string, max = 10_000_000_000) => {
  const value = payload[field];
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0 || value > max) throw new ApiError(400, "INVALID_FIELD", `${field} tidak valid.`, { field });
  return value;
};

function parseSettings(payload: Record<string, unknown>): ZakatSettings {
  const nisabGrams = integer(payload, "nisabGrams", 10_000);
  if (nisabGrams < 1) throw new ApiError(400, "INVALID_FIELD", "Gram nisab harus lebih dari nol.", { field: "nisabGrams" });
  const haulStartDate = typeof payload.haulStartDate === "string" ? payload.haulStartDate : "";
  if (haulStartDate && !/^\d{4}-\d{2}-\d{2}$/.test(haulStartDate)) throw new ApiError(400, "INVALID_FIELD", "Tanggal mulai haul harus berformat YYYY-MM-DD.", { field: "haulStartDate" });
  if (typeof payload.includeInvestments !== "boolean") throw new ApiError(400, "INVALID_FIELD", "includeInvestments tidak valid.", { field: "includeInvestments" });
  if (!Array.isArray(payload.excludedAccountIds) || payload.excludedAccountIds.length > 30 || payload.excludedAccountIds.some((id) => typeof id !== "string" || !id || id.length > 120)) throw new ApiError(400, "INVALID_FIELD", "Pilihan akun tidak valid.", { field: "excludedAccountIds" });
  return {
    goldPricePerGram: integer(payload, "goldPricePerGram"),
    nisabGrams,
    haulStartDate,
    includeInvestments: payload.includeInvestments,
    excludedAccountIds: [...new Set(payload.excludedAccountIds as string[])],
  };
}

export async function GET(request: Request) {
  try {
    const workspaceId = resolveWorkspaceId(request);
    await requireWorkspace(workspaceId);
    return Response.json(parseRow(await getD1().prepare(selectSql).bind(workspaceId).first<Row>()));
  } catch (error) { return routeError(error); }
}

export async function PATCH(request: Request) {
  try {
    const payload = await readJsonObject(request);
    const workspaceId = resolveWorkspaceId(request, payload);
    await requireWorkspace(workspaceId);
    await requireCapability(workspaceId, "planning");
    const requestId = requiredString(payload, "requestId", 120);
    const next = parseSettings(payload);
    const d1 = getD1();
    const replay = await d1.prepare("SELECT action FROM audit_logs WHERE workspace_id = ? AND request_id = ? ORDER BY created_at, id LIMIT 1").bind(workspaceId, requestId).first<{ action: string }>();
    if (replay) {
      if (replay.action !== "zakat.settings.update") throw new ApiError(409, "REQUEST_ID_REUSED", "requestId sudah digunakan oleh operasi lain.");
      return Response.json(parseRow(await d1.prepare(selectSql).bind(workspaceId).first<Row>()));
    }
    const before = parseRow(await d1.prepare(selectSql).bind(workspaceId).first<Row>());
    const timestamp = nowIso();
    await d1.batch([
      d1.prepare(`INSERT INTO zakat_settings (workspace_id, gold_price_per_gram, nisab_grams, haul_start_date, include_investments, excluded_account_ids_json, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(workspace_id) DO UPDATE SET gold_price_per_gram = excluded.gold_price_per_gram, nisab_grams = excluded.nisab_grams,
          haul_start_date = excluded.haul_start_date, include_investments = excluded.include_investments,
          excluded_account_ids_json = excluded.excluded_account_ids_json, updated_at = excluded.updated_at`)
        .bind(workspaceId, next.goldPricePerGram, next.nisabGrams, next.haulStartDate, next.includeInvestments ? 1 : 0, JSON.stringify(next.excludedAccountIds), timestamp, timestamp),
      auditStatement(d1, { workspaceId, action: "zakat.settings.update", entityType: "zakat", entityId: workspaceId, requestId, before, after: next, createdAt: timestamp }),
    ]);
    return Response.json(next);
  } catch (error) { return routeError(error); }
}
