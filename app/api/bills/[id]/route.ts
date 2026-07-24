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
import { mergePayload, parseBill } from "../../_lib/domain";
import {
  getAccountRow,
  getBillRow,
  requireWorkspace,
  serializeBill,
} from "../../_lib/repository";

type Context = { params: Promise<{ id: string }> };
const routeId = async (context: Context) => validateId((await context.params).id);

export async function GET(request: Request, context: Context) {
  try {
    const workspaceId = resolveWorkspaceId(request);
    await requireWorkspace(workspaceId);
    const bill = await getBillRow(workspaceId, await routeId(context));
    if (!bill) throw new ApiError(404, "NOT_FOUND", "Tagihan tidak ditemukan.");
    return Response.json({ bill: serializeBill(bill) });
  } catch (error) {
    return routeError(error);
  }
}

export async function PATCH(request: Request, context: Context) {
  try {
    const payload = await readJsonObject(request);
    const workspaceId = resolveWorkspaceId(request, payload);
    await requireWorkspace(workspaceId);
    const id = await routeId(context);
    const current = await getBillRow(workspaceId, id);
    if (!current) throw new ApiError(404, "NOT_FOUND", "Tagihan tidak ditemukan.");
    const bill = parseBill(
      mergePayload(serializeBill(current), payload, [
        "name",
        "amount",
        "dueDate",
        "category",
        "accountId",
        "paid",
        "frequency",
        "reminderDays",
        "liabilityAccountId",
        "durationMonths",
        "paidCount",
      ]),
      id,
    );
    if (!(await getAccountRow(workspaceId, bill.accountId))) {
      throw new ApiError(400, "ACCOUNT_NOT_FOUND", "Akun pembayaran tidak ditemukan.");
    }
    const liabilityAccount = bill.liabilityAccountId ? await getAccountRow(workspaceId, bill.liabilityAccountId) : null;
    if (bill.liabilityAccountId && !liabilityAccount?.liability) {
      throw new ApiError(400, "LIABILITY_ACCOUNT_REQUIRED", "Akun tujuan cicilan harus berupa Paylater, kartu kredit, atau akun utang.");
    }
    if (bill.durationMonths !== null && bill.durationMonths < bill.paidCount) {
      throw new ApiError(400, "INVALID_BILL_DURATION", "Durasi tidak boleh lebih kecil dari cicilan yang sudah dibayar.");
    }
    const requestId = optionalString(payload, "requestId", 120) ?? null;
    const before = serializeBill(current);
    const now = nowIso();
    const d1 = getD1();
    await d1.batch([
      d1.prepare(
        `UPDATE bills
         SET name = ?, amount = ?, due_date = ?, category = ?, account_id = ?, frequency = ?, reminder_days = ?, paid = ?,
             paid_at = CASE WHEN ? = 1 THEN COALESCE(paid_at, ?) ELSE NULL END,
             last_paid_period = CASE
               WHEN ? = 1 THEN COALESCE(last_paid_period, substr(?, 1, 7))
               ELSE NULL
             END,
             liability_account_id = ?, duration_months = ?, paid_count = ?,
             completed = CASE WHEN ? IS NOT NULL AND ? >= ? THEN 1 ELSE 0 END,
             updated_at = ?
         WHERE workspace_id = ? AND id = ?`,
      )
      .bind(
        bill.name,
        bill.amount,
        bill.dueDate,
        bill.category,
        bill.accountId,
        bill.frequency,
        bill.reminderDays.join(","),
        bill.paid ? 1 : 0,
        bill.paid ? 1 : 0,
        now,
        bill.paid ? 1 : 0,
        bill.dueDate,
        bill.liabilityAccountId,
        bill.durationMonths,
        bill.paidCount,
        bill.durationMonths,
        bill.paidCount,
        bill.durationMonths ?? 0,
        now,
        workspaceId,
        id,
      ),
      auditStatement(d1, {
        workspaceId,
        action: "bill.update",
        entityType: "bill",
        entityId: id,
        requestId,
        before,
        after: bill,
        createdAt: now,
      }),
    ]);
    return Response.json({ bill: serializeBill((await getBillRow(workspaceId, id))!) });
  } catch (error) {
    return routeError(error);
  }
}

export async function DELETE(request: Request, context: Context) {
  try {
    const workspaceId = resolveWorkspaceId(request);
    await requireWorkspace(workspaceId);
    const id = await routeId(context);
    const current = await getBillRow(workspaceId, id);
    if (!current) {
      throw new ApiError(404, "NOT_FOUND", "Tagihan tidak ditemukan.");
    }
    const d1 = getD1();
    const now = nowIso();
    const before = serializeBill(current);
    await d1.batch([
      d1.prepare(`DELETE FROM bills WHERE workspace_id = ? AND id = ?`).bind(workspaceId, id),
      auditStatement(d1, {
        workspaceId,
        action: "bill.delete",
        entityType: "bill",
        entityId: id,
        before,
        after: { ...before, deleted: true },
        createdAt: now,
      }),
    ]);
    return Response.json({ deleted: true, id });
  } catch (error) {
    return routeError(error);
  }
}
