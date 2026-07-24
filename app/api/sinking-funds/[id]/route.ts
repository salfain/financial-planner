import { getD1 } from "@/db";
import { auditStatement } from "../../_lib/audit";
import {
  ApiError,
  nowIso,
  optionalString,
  readJsonObject,
  resolveWorkspaceId,
  routeError,
  validateId,
} from "../../_lib/api";
import { mergePayload, parseSinkingFund } from "../../_lib/domain";
import { requireCapability } from "../../_lib/license";
import {
  getAccountRow,
  getSinkingFundRow,
  requireWorkspace,
  serializeSinkingFund,
} from "../../_lib/repository";

type Context = { params: Promise<{ id: string }> };
const routeId = async (context: Context) => validateId((await context.params).id);

async function assertUpdateCapacity(workspaceId: string, fundId: string, accountId: string, currentAmount: number) {
  const account = await getAccountRow(workspaceId, accountId);
  if (!account || account.liability || !["Bank", "E-Wallet", "Cash", "Deposit"].includes(account.type)) {
    throw new ApiError(400, "INVALID_FUND_ACCOUNT", "Pos dana harus memakai akun kas atau deposito aktif.");
  }
  const allocated = await getD1()
    .prepare(`SELECT COALESCE(SUM(current_amount), 0) AS total FROM sinking_funds WHERE workspace_id = ? AND account_id = ? AND active = 1 AND id <> ?`)
    .bind(workspaceId, accountId, fundId)
    .first<{ total: number }>();
  if (Number(allocated?.total ?? 0) + currentAmount > account.balance) {
    throw new ApiError(400, "INSUFFICIENT_UNALLOCATED_BALANCE", "Alokasi melebihi saldo bebas pada akun tersebut.");
  }
}

export async function PATCH(request: Request, context: Context) {
  try {
    const payload = await readJsonObject(request);
    const workspaceId = resolveWorkspaceId(request, payload);
    await requireWorkspace(workspaceId);
    await requireCapability(workspaceId, "planning");
    const id = await routeId(context);
    const current = await getSinkingFundRow(workspaceId, id);
    if (!current) throw new ApiError(404, "NOT_FOUND", "Pos dana tidak ditemukan.");
    const fund = parseSinkingFund(mergePayload(current as unknown as Record<string, unknown>, payload, [
      "name", "purpose", "targetAmount", "currentAmount", "monthlyContribution",
      "targetDate", "accountId", "color", "active",
    ]), id);
    await assertUpdateCapacity(workspaceId, id, fund.accountId, fund.currentAmount);
    const requestId = optionalString(payload, "requestId", 120) ?? null;
    const now = nowIso();
    const d1 = getD1();
    await d1.batch([
      d1.prepare(
        `UPDATE sinking_funds SET name = ?, purpose = ?, target_amount = ?,
          monthly_contribution = ?, target_date = ?, account_id = ?, color = ?,
          active = ?, updated_at = ? WHERE workspace_id = ? AND id = ?`,
      ).bind(
        fund.name, fund.purpose, fund.targetAmount, fund.monthlyContribution,
        fund.targetDate, fund.accountId, fund.color, fund.active ? 1 : 0, now, workspaceId, id,
      ),
      auditStatement(d1, {
        workspaceId,
        action: "sinking_fund.update",
        entityType: "sinking_fund",
        entityId: id,
        requestId,
        before: serializeSinkingFund(current),
        after: fund,
        createdAt: now,
      }),
    ]);
    return Response.json({ sinkingFund: serializeSinkingFund((await getSinkingFundRow(workspaceId, id))!) });
  } catch (error) {
    return routeError(error);
  }
}

export async function DELETE(request: Request, context: Context) {
  try {
    const workspaceId = resolveWorkspaceId(request);
    await requireWorkspace(workspaceId);
    await requireCapability(workspaceId, "planning");
    const id = await routeId(context);
    const current = await getSinkingFundRow(workspaceId, id);
    if (!current) throw new ApiError(404, "NOT_FOUND", "Pos dana tidak ditemukan.");
    const now = nowIso();
    const d1 = getD1();
    await d1.batch([
      d1.prepare(`UPDATE sinking_funds SET active = 0, updated_at = ? WHERE workspace_id = ? AND id = ?`).bind(now, workspaceId, id),
      auditStatement(d1, {
        workspaceId,
        action: "sinking_fund.archive",
        entityType: "sinking_fund",
        entityId: id,
        before: serializeSinkingFund(current),
        after: { ...serializeSinkingFund(current), active: false },
        createdAt: now,
      }),
    ]);
    return Response.json({ archived: true, id });
  } catch (error) {
    return routeError(error);
  }
}
