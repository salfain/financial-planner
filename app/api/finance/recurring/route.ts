import { getD1 } from "@/db";
import { RECURRING_FREQUENCIES, type RecurringTemplate } from "@/lib/recurring";
import { auditStatement, auditStatementWhenRequestUnused } from "../../_lib/audit";
import { ApiError, booleanValue, enumValue, isoDate, makeId, nowIso, optionalString, positiveInteger, readJsonObject, requiredString, resolveWorkspaceId, routeError, validateId } from "../../_lib/api";
import { requireCapability } from "../../_lib/license";
import { getAccountRow, requireWorkspace } from "../../_lib/repository";

type RecurringRow = {
  id: string; name: string; type: "income" | "expense"; amount: number; category: string; accountId: string;
  frequency: RecurringTemplate["frequency"]; startDate: string; nextDueDate: string; isSubscription: number;
  active: number; lastPostedDate: string | null; updatedAt: string;
};

const select = `SELECT id, name, type, amount, category, account_id AS accountId, frequency,
  start_date AS startDate, next_due_date AS nextDueDate, is_subscription AS isSubscription,
  active, last_posted_date AS lastPostedDate, updated_at AS updatedAt FROM recurring_templates`;

const serialize = (row: RecurringRow): RecurringTemplate => ({ ...row, amount: Number(row.amount), isSubscription: Boolean(row.isSubscription), active: Boolean(row.active) });

export async function GET(request: Request) {
  try {
    const workspaceId = resolveWorkspaceId(request);
    await requireWorkspace(workspaceId);
    const result = await getD1().prepare(`${select} WHERE workspace_id = ? ORDER BY active DESC, next_due_date, created_at, id`).bind(workspaceId).all<RecurringRow>();
    return Response.json({ templates: result.results.map(serialize) });
  } catch (error) { return routeError(error); }
}

export async function POST(request: Request) {
  try {
    const payload = await readJsonObject(request);
    const workspaceId = resolveWorkspaceId(request, payload);
    await requireWorkspace(workspaceId);
    await requireCapability(workspaceId, "recurring");
    const requestId = optionalString(payload, "requestId", 120) ?? makeId("req");
    const replay = await getD1().prepare(`${select} WHERE workspace_id = ? AND id IN (SELECT id FROM recurring_templates WHERE workspace_id = ? AND request_id = ?) LIMIT 1`).bind(workspaceId, workspaceId, requestId).first<RecurringRow>();
    if (replay) return Response.json({ template: serialize(replay), replayed: true });
    const accountId = validateId(payload.accountId, "accountId");
    if (!(await getAccountRow(workspaceId, accountId))) throw new ApiError(400, "ACCOUNT_NOT_FOUND", "Akun transaksi rutin tidak ditemukan.");
    const type = enumValue(payload, "type", ["income", "expense"] as const);
    const startDate = isoDate(payload, "startDate");
    const nextDueDate = payload.nextDueDate === undefined ? startDate : isoDate(payload, "nextDueDate");
    if (nextDueDate < startDate) throw new ApiError(400, "INVALID_DUE_DATE", "Jadwal berikutnya tidak boleh sebelum tanggal mulai.");
    const template: RecurringTemplate = {
      id: payload.id === undefined ? makeId("rec") : validateId(payload.id),
      name: requiredString(payload, "name", 120), type, amount: positiveInteger(payload, "amount"),
      category: requiredString(payload, "category", 100), accountId,
      frequency: enumValue(payload, "frequency", RECURRING_FREQUENCIES), startDate, nextDueDate,
      isSubscription: payload.isSubscription === undefined ? false : booleanValue(payload, "isSubscription"),
      active: payload.active === undefined ? true : booleanValue(payload, "active"), lastPostedDate: null,
    };
    if (template.type === "income" && template.isSubscription) throw new ApiError(400, "INVALID_SUBSCRIPTION", "Langganan hanya dapat berupa pengeluaran.");
    const now = nowIso();
    const d1 = getD1();
    await d1.batch([
      d1.prepare(`INSERT INTO recurring_templates (id, workspace_id, name, type, amount, category, account_id, frequency, start_date, next_due_date, is_subscription, active, last_posted_date, request_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?)`).bind(template.id, workspaceId, template.name, template.type, template.amount, template.category, template.accountId, template.frequency, template.startDate, template.nextDueDate, template.isSubscription ? 1 : 0, template.active ? 1 : 0, requestId, now, now),
      auditStatement(d1, { workspaceId, action: "recurring.create", entityType: "recurring", entityId: template.id, requestId, after: template, createdAt: now }),
    ]);
    const created = await d1.prepare(`${select} WHERE workspace_id = ? AND id = ?`).bind(workspaceId, template.id).first<RecurringRow>();
    return Response.json({ template: serialize(created!), replayed: false }, { status: 201 });
  } catch (error) { return routeError(error); }
}

export async function PATCH(request: Request) {
  try {
    const payload = await readJsonObject(request);
    const workspaceId = resolveWorkspaceId(request, payload);
    await requireWorkspace(workspaceId);
    const id = validateId(payload.id);
    const active = booleanValue(payload, "active");
    const requestId = optionalString(payload, "requestId", 120) ?? makeId("req");
    const current = await getD1().prepare(`${select} WHERE workspace_id = ? AND id = ?`).bind(workspaceId, id).first<RecurringRow>();
    if (!current) throw new ApiError(404, "NOT_FOUND", "Transaksi rutin tidak ditemukan.");
    const now = nowIso();
    const d1 = getD1();
    await d1.batch([
      d1.prepare(`UPDATE recurring_templates SET active = ?, updated_at = ? WHERE workspace_id = ? AND id = ?`).bind(active ? 1 : 0, now, workspaceId, id),
      auditStatementWhenRequestUnused(d1, { workspaceId, action: "recurring.status", entityType: "recurring", entityId: id, requestId, before: serialize(current), after: { active }, createdAt: now }),
    ]);
    const updated = await d1.prepare(`${select} WHERE workspace_id = ? AND id = ?`).bind(workspaceId, id).first<RecurringRow>();
    return Response.json({ template: serialize(updated!) });
  } catch (error) { return routeError(error); }
}
