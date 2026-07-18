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
import { parseBill } from "../_lib/domain";
import {
  billSelect,
  getAccountRow,
  getBillRow,
  requireWorkspace,
  serializeBill,
} from "../_lib/repository";

export async function GET(request: Request) {
  try {
    const workspaceId = resolveWorkspaceId(request);
    await requireWorkspace(workspaceId);
    const result = await getD1()
      .prepare(`${billSelect} WHERE workspace_id = ? ORDER BY paid, due_date, created_at, id`)
      .bind(workspaceId)
      .all();
    return Response.json({
      bills: result.results.map((row: Record<string, unknown>) => serializeBill(row as never)),
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
    const requestId = optionalString(payload, "requestId", 120) ?? null;
    const bill = parseBill(payload);
    if (!(await getAccountRow(workspaceId, bill.accountId))) {
      throw new ApiError(400, "ACCOUNT_NOT_FOUND", "Akun pembayaran tidak ditemukan.");
    }
    const now = nowIso();
    const d1 = getD1();
    await d1.batch([
      d1.prepare(
        `INSERT INTO bills
           (id, workspace_id, name, amount, due_date, category, account_id, frequency, reminder_days, paid, paid_at,
            last_paid_period, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        bill.id,
        workspaceId,
        bill.name,
        bill.amount,
        bill.dueDate,
        bill.category,
        bill.accountId,
        bill.frequency,
        bill.reminderDays.join(","),
        bill.paid ? 1 : 0,
        bill.paid ? now : null,
        bill.paid ? bill.dueDate.slice(0, 7) : null,
        now,
        now,
      ),
      auditStatement(d1, {
        workspaceId,
        action: "bill.create",
        entityType: "bill",
        entityId: bill.id,
        requestId,
        after: bill,
        createdAt: now,
      }),
    ]);
    return Response.json(
      { bill: serializeBill((await getBillRow(workspaceId, bill.id))!) },
      { status: 201 },
    );
  } catch (error) {
    return routeError(error);
  }
}
