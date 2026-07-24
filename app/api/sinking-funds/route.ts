import { getD1 } from "@/db";
import { auditStatement } from "../_lib/audit";
import {
  ApiError,
  nowIso,
  optionalString,
  readJsonObject,
  resolveWorkspaceId,
  routeError,
} from "../_lib/api";
import { parseSinkingFund } from "../_lib/domain";
import { requireCapability } from "../_lib/license";
import {
  getAccountRow,
  getSinkingFundRow,
  requireWorkspace,
  serializeSinkingFund,
  serializeSinkingFundEntry,
  sinkingFundEntrySelect,
  sinkingFundSelect,
} from "../_lib/repository";

async function assertFundCapacity(workspaceId: string, accountId: string, amount: number) {
  const account = await getAccountRow(workspaceId, accountId);
  if (!account || account.liability || !["Bank", "E-Wallet", "Cash", "Deposit"].includes(account.type)) {
    throw new ApiError(400, "INVALID_FUND_ACCOUNT", "Pos dana harus memakai akun kas atau deposito aktif.");
  }
  const allocated = await getD1()
    .prepare(`SELECT COALESCE(SUM(current_amount), 0) AS total FROM sinking_funds WHERE workspace_id = ? AND account_id = ? AND active = 1`)
    .bind(workspaceId, accountId)
    .first<{ total: number }>();
  if (Number(allocated?.total ?? 0) + amount > account.balance) {
    throw new ApiError(400, "INSUFFICIENT_UNALLOCATED_BALANCE", "Alokasi melebihi saldo bebas pada akun tersebut.");
  }
}

export async function GET(request: Request) {
  try {
    const workspaceId = resolveWorkspaceId(request);
    await requireWorkspace(workspaceId);
    const d1 = getD1();
    const [funds, entries] = await d1.batch([
      d1.prepare(`${sinkingFundSelect} WHERE workspace_id = ? AND active = 1 ORDER BY target_date, created_at, id`).bind(workspaceId),
      d1.prepare(`${sinkingFundEntrySelect} WHERE workspace_id = ? ORDER BY date DESC, created_at DESC, id DESC LIMIT 200`).bind(workspaceId),
    ]);
    return Response.json({
      sinkingFunds: funds.results.map((row) => serializeSinkingFund(row as never)),
      sinkingFundEntries: entries.results.map((row) => serializeSinkingFundEntry(row as never)),
    });
  } catch (error) {
    return routeError(error);
  }
}

export async function POST(request: Request) {
  try {
    const payload = await readJsonObject(request);
    const workspaceId = resolveWorkspaceId(request, payload);
    await requireWorkspace(workspaceId);
    await requireCapability(workspaceId, "planning");
    const requestId = optionalString(payload, "requestId", 120) ?? `fund-create:${crypto.randomUUID()}`;
    const fund = parseSinkingFund(payload);
    await assertFundCapacity(workspaceId, fund.accountId, fund.currentAmount);
    const now = nowIso();
    const d1 = getD1();
    const statements = [
      d1.prepare(
        `INSERT INTO sinking_funds
          (id, workspace_id, name, purpose, target_amount, current_amount,
           monthly_contribution, target_date, account_id, color, active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(
        fund.id, workspaceId, fund.name, fund.purpose, fund.targetAmount, fund.currentAmount,
        fund.monthlyContribution, fund.targetDate, fund.accountId, fund.color, 1, now, now,
      ),
      auditStatement(d1, {
        workspaceId,
        action: "sinking_fund.create",
        entityType: "sinking_fund",
        entityId: fund.id,
        requestId,
        after: fund,
        createdAt: now,
      }),
    ];
    if (fund.currentAmount > 0) {
      statements.splice(1, 0, d1.prepare(
        `INSERT INTO sinking_fund_entries
          (id, workspace_id, fund_id, type, amount, date, note, request_id, created_at)
         VALUES (?, ?, ?, 'allocate', ?, ?, ?, ?, ?)`,
      ).bind(
        `fund-entry-${crypto.randomUUID()}`, workspaceId, fund.id, fund.currentAmount,
        now.slice(0, 10), "Alokasi awal", `${requestId}:initial`, now,
      ));
    }
    await d1.batch(statements);
    return Response.json({ sinkingFund: serializeSinkingFund((await getSinkingFundRow(workspaceId, fund.id))!) }, { status: 201 });
  } catch (error) {
    return routeError(error);
  }
}
