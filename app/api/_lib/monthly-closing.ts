import { getD1 } from "@/db";
import { ApiError } from "./api";

export type MonthlyClosingRow = {
  id: string;
  workspaceId: string;
  period: string;
  status: "closed" | "open";
  snapshotJson: string;
  closedAt: string | null;
  reopenedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export async function getMonthlyClosing(workspaceId: string, period: string) {
  return getD1().prepare(
    `SELECT id, workspace_id AS workspaceId, period, status,
            snapshot_json AS snapshotJson, closed_at AS closedAt,
            reopened_at AS reopenedAt, created_at AS createdAt, updated_at AS updatedAt
     FROM monthly_closings WHERE workspace_id = ? AND period = ? LIMIT 1`,
  ).bind(workspaceId, period).first<MonthlyClosingRow>();
}

export function serializeMonthlyClosing(row: MonthlyClosingRow | null, period: string) {
  if (!row) return { period, status: "open" as const, closedAt: null, reopenedAt: null, snapshot: null };
  let snapshot: unknown = null;
  try { snapshot = JSON.parse(row.snapshotJson); } catch { snapshot = null; }
  return { period: row.period, status: row.status, closedAt: row.closedAt, reopenedAt: row.reopenedAt, snapshot };
}

export async function assertMonthlyPeriodOpen(workspaceId: string, dateOrPeriod: string) {
  const period = dateOrPeriod.slice(0, 7);
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) return;
  const row = await getMonthlyClosing(workspaceId, period);
  if (row?.status === "closed") {
    throw new ApiError(409, "MONTH_CLOSED", `Bulan ${period} sudah ditutup. Buka kembali bulan tersebut sebelum mengubah ledger.`, { period });
  }
}
