import { getD1 } from "@/db";
import { auditStatement } from "../../../_lib/audit";
import {
  ApiError,
  enumValue,
  isoDate,
  nowIso,
  optionalString,
  positiveInteger,
  readJsonObject,
  resolveWorkspaceId,
  routeError,
  validateId,
} from "../../../_lib/api";
import { requireCapability } from "../../../_lib/license";
import {
  getAccountRow,
  getSinkingFundRow,
  requireWorkspace,
  serializeSinkingFund,
  serializeSinkingFundEntry,
  sinkingFundEntrySelect,
} from "../../../_lib/repository";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  try {
    const payload = await readJsonObject(request);
    const workspaceId = resolveWorkspaceId(request, payload);
    await requireWorkspace(workspaceId);
    await requireCapability(workspaceId, "planning");
    const fundId = validateId((await context.params).id);
    const fund = await getSinkingFundRow(workspaceId, fundId);
    if (!fund || !fund.active) throw new ApiError(404, "NOT_FOUND", "Pos dana tidak ditemukan.");
    const amount = positiveInteger(payload, "amount");
    const type = enumValue(payload, "type", ["allocate", "release"] as const);
    const date = payload.date === undefined ? nowIso().slice(0, 10) : isoDate(payload, "date");
    const note = optionalString(payload, "note", 240) ?? "";
    const requestId = optionalString(payload, "requestId", 120) ?? `fund-entry:${crypto.randomUUID()}`;
    const d1 = getD1();
    const existing = await d1
      .prepare(`${sinkingFundEntrySelect} WHERE workspace_id = ? AND request_id = ? LIMIT 1`)
      .bind(workspaceId, requestId)
      .first();
    if (existing) {
      return Response.json({ sinkingFund: serializeSinkingFund(fund), entry: serializeSinkingFundEntry(existing as never) });
    }
    const nextCurrent = fund.currentAmount + (type === "allocate" ? amount : -amount);
    if (nextCurrent < 0) throw new ApiError(400, "SINKING_FUND_UNDERFUNDED", "Dana yang dilepas melebihi alokasi pos.");
    if (nextCurrent > fund.targetAmount) throw new ApiError(400, "SINKING_FUND_OVERFUNDED", "Alokasi melebihi target pos dana.");
    if (type === "allocate") {
      const account = await getAccountRow(workspaceId, fund.accountId);
      const allocated = await d1
        .prepare(`SELECT COALESCE(SUM(current_amount), 0) AS total FROM sinking_funds WHERE workspace_id = ? AND account_id = ? AND active = 1`)
        .bind(workspaceId, fund.accountId)
        .first<{ total: number }>();
      if (!account || Number(allocated?.total ?? 0) + amount > account.balance) {
        throw new ApiError(400, "INSUFFICIENT_UNALLOCATED_BALANCE", "Saldo bebas akun tidak cukup untuk alokasi ini.");
      }
    }
    const entryId = `fund-entry-${crypto.randomUUID()}`;
    const now = nowIso();
    await d1.batch([
      d1.prepare(`UPDATE sinking_funds SET current_amount = ?, updated_at = ? WHERE workspace_id = ? AND id = ?`)
        .bind(nextCurrent, now, workspaceId, fundId),
      d1.prepare(
        `INSERT INTO sinking_fund_entries
          (id, workspace_id, fund_id, type, amount, date, note, request_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(entryId, workspaceId, fundId, type, amount, date, note, requestId, now),
      auditStatement(d1, {
        workspaceId,
        action: type === "allocate" ? "sinking_fund.allocate" : "sinking_fund.release",
        entityType: "sinking_fund",
        entityId: fundId,
        requestId,
        before: { currentAmount: fund.currentAmount },
        after: { currentAmount: nextCurrent },
        details: { amount, date, note },
        createdAt: now,
      }),
    ]);
    return Response.json({
      sinkingFund: serializeSinkingFund((await getSinkingFundRow(workspaceId, fundId))!),
      entry: serializeSinkingFundEntry((await d1.prepare(`${sinkingFundEntrySelect} WHERE workspace_id = ? AND id = ? LIMIT 1`).bind(workspaceId, entryId).first()) as never),
    });
  } catch (error) {
    return routeError(error);
  }
}
