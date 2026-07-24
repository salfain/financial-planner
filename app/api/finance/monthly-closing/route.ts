import { getD1 } from "@/db";
import { auditStatement } from "../../_lib/audit";
import { ApiError, booleanValue, monthPeriod, nowIso, readJsonObject, resolveWorkspaceId, routeError } from "../../_lib/api";
import { getMonthlyClosing, serializeMonthlyClosing } from "../../_lib/monthly-closing";
import { requireWorkspace } from "../../_lib/repository";

export async function GET(request: Request) {
  try {
    const workspaceId = resolveWorkspaceId(request);
    await requireWorkspace(workspaceId);
    const period = monthPeriod({ period: new URL(request.url).searchParams.get("period") }, "period");
    return Response.json({ closing: serializeMonthlyClosing(await getMonthlyClosing(workspaceId, period), period) });
  } catch (error) { return routeError(error); }
}

export async function POST(request: Request) {
  try {
    const payload = await readJsonObject(request);
    const workspaceId = resolveWorkspaceId(request, payload);
    await requireWorkspace(workspaceId);
    const period = monthPeriod(payload, "period");
    if (!booleanValue(payload, "confirmed")) throw new ApiError(400, "CLOSING_CONFIRMATION_REQUIRED", "Konfirmasi pemeriksaan saldo diperlukan.");
    const pending = await getD1().prepare(
      "SELECT COUNT(*) AS total FROM transactions WHERE workspace_id = ? AND substr(date, 1, 7) = ? AND status = 'pending' AND deleted_at IS NULL",
    ).bind(workspaceId, period).first<{ total: number }>();
    if (Number(pending?.total ?? 0) > 0) throw new ApiError(409, "PENDING_TRANSACTIONS", `Selesaikan ${pending!.total} transaksi pending sebelum menutup buku.`);
    const snapshotJson = JSON.stringify(payload.snapshot ?? null);
    if (snapshotJson.length > 45000) throw new ApiError(413, "SNAPSHOT_TOO_LARGE", "Snapshot review bulanan terlalu besar.");
    const current = await getMonthlyClosing(workspaceId, period);
    if (current?.status === "closed") return Response.json({ closing: serializeMonthlyClosing(current, period), replayed: true });
    const now = nowIso();
    const id = current?.id ?? `close-${crypto.randomUUID()}`;
    const d1 = getD1();
    await d1.batch([
      d1.prepare(
        `INSERT INTO monthly_closings (id, workspace_id, period, status, snapshot_json, closed_at, reopened_at, created_at, updated_at)
         VALUES (?, ?, ?, 'closed', ?, ?, NULL, ?, ?)
         ON CONFLICT(workspace_id, period) DO UPDATE SET
           status = 'closed', snapshot_json = excluded.snapshot_json, closed_at = excluded.closed_at,
           reopened_at = NULL, updated_at = excluded.updated_at`,
      ).bind(id, workspaceId, period, snapshotJson, now, now, now),
      auditStatement(d1, { workspaceId, action: "monthly_closing.close", entityType: "monthly_closing", entityId: period, requestId: typeof payload.requestId === "string" ? payload.requestId : null, before: current ? serializeMonthlyClosing(current, period) : null, after: { period, status: "closed", closedAt: now }, createdAt: now }),
    ]);
    return Response.json({ closing: serializeMonthlyClosing((await getMonthlyClosing(workspaceId, period))!, period) }, { status: 201 });
  } catch (error) { return routeError(error); }
}

export async function DELETE(request: Request) {
  try {
    const payload = await readJsonObject(request);
    const workspaceId = resolveWorkspaceId(request, payload);
    await requireWorkspace(workspaceId);
    const period = monthPeriod(payload, "period");
    const current = await getMonthlyClosing(workspaceId, period);
    if (!current || current.status === "open") return Response.json({ closing: serializeMonthlyClosing(current, period), replayed: true });
    const now = nowIso();
    const d1 = getD1();
    await d1.batch([
      d1.prepare("UPDATE monthly_closings SET status = 'open', reopened_at = ?, updated_at = ? WHERE workspace_id = ? AND period = ?").bind(now, now, workspaceId, period),
      auditStatement(d1, { workspaceId, action: "monthly_closing.reopen", entityType: "monthly_closing", entityId: period, requestId: typeof payload.requestId === "string" ? payload.requestId : null, before: serializeMonthlyClosing(current, period), after: { period, status: "open", reopenedAt: now }, createdAt: now }),
    ]);
    return Response.json({ closing: serializeMonthlyClosing((await getMonthlyClosing(workspaceId, period))!, period) });
  } catch (error) { return routeError(error); }
}
