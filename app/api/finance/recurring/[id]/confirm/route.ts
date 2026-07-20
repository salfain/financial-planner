import { getD1 } from "@/db";
import { addRecurringPeriod, type RecurringTemplate } from "@/lib/recurring";
import { auditStatementWhenRequestUnused } from "../../../../_lib/audit";
import { ApiError, isoDate, nowIso, optionalString, readJsonObject, resolveWorkspaceId, routeError, validateId } from "../../../../_lib/api";
import { jsonRequest } from "../../../../_lib/forward";
import { requireWorkspace } from "../../../../_lib/repository";
import { POST as createTransaction } from "../../../../transactions/route";

type Context = { params: Promise<{ id: string }> };
type Row = RecurringTemplate & { isSubscription: number; active: number };
const select = `SELECT id, name, type, amount, category, account_id AS accountId, frequency, start_date AS startDate, next_due_date AS nextDueDate, is_subscription AS isSubscription, active, last_posted_date AS lastPostedDate, updated_at AS updatedAt FROM recurring_templates`;
const serialize = (row: Row): RecurringTemplate => ({ ...row, amount: Number(row.amount), isSubscription: Boolean(row.isSubscription), active: Boolean(row.active) });

export async function POST(request: Request, context: Context) {
  try {
    const payload = await readJsonObject(request);
    const workspaceId = resolveWorkspaceId(request, payload);
    await requireWorkspace(workspaceId);
    const { id: rawId } = await context.params;
    const id = validateId(rawId);
    const row = await getD1().prepare(`${select} WHERE workspace_id = ? AND id = ?`).bind(workspaceId, id).first<Row>();
    if (!row) throw new ApiError(404, "NOT_FOUND", "Transaksi rutin tidak ditemukan.");
    const template = serialize(row);
    if (!template.active) throw new ApiError(409, "RECURRING_INACTIVE", "Aktifkan kembali jadwal sebelum mencatat transaksi.");
    const dueDate = isoDate(payload, "dueDate");
    if (template.nextDueDate !== dueDate) {
      if (template.lastPostedDate === dueDate) return Response.json({ template, replayed: true });
      throw new ApiError(409, "RECURRING_DATE_CHANGED", "Jadwal sudah berubah. Muat ulang data sebelum mengonfirmasi.");
    }
    const requestId = optionalString(payload, "requestId", 160) ?? `recurring:${id}:${dueDate}`;
    const transactionId = `rec_${id}_${dueDate.replaceAll("-", "")}`.slice(0, 80);
    const transactionResponse = await createTransaction(jsonRequest(request, "/api/transactions", {
      id: transactionId, idempotencyKey: requestId, requestId, type: template.type, date: dueDate, time: "",
      title: template.name, merchant: template.name, category: template.category, notes: `Dari jadwal transaksi rutin ${template.name}`,
      tags: ["transaksi-rutin", ...(template.isSubscription ? ["langganan"] : [])], location: "", splits: [],
      accountId: template.accountId, amount: template.amount, status: "completed",
    }));
    if (!transactionResponse.ok) return transactionResponse;
    const transactionResult = await transactionResponse.json() as Record<string, unknown>;
    const nextDueDate = addRecurringPeriod(dueDate, template.frequency);
    const now = nowIso();
    const d1 = getD1();
    await d1.batch([
      d1.prepare(`UPDATE recurring_templates SET last_posted_date = ?, next_due_date = ?, updated_at = ? WHERE workspace_id = ? AND id = ? AND next_due_date = ?`).bind(dueDate, nextDueDate, now, workspaceId, id, dueDate),
      auditStatementWhenRequestUnused(d1, { workspaceId, action: "recurring.confirm", entityType: "recurring", entityId: id, requestId, before: template, after: { lastPostedDate: dueDate, nextDueDate }, details: { transactionId }, createdAt: now }),
    ]);
    const updated = await d1.prepare(`${select} WHERE workspace_id = ? AND id = ?`).bind(workspaceId, id).first<Row>();
    return Response.json({ template: serialize(updated!), transaction: transactionResult });
  } catch (error) { return routeError(error); }
}
