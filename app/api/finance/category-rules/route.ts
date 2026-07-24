import { getD1 } from "@/db";
import { auditStatement } from "../../_lib/audit";
import { ApiError, makeId, nowIso, optionalString, readJsonObject, requiredString, resolveWorkspaceId, routeError } from "../../_lib/api";
import { requireCapability } from "../../_lib/license";
import { requireWorkspace } from "../../_lib/repository";

type CategoryRuleRow = {
  id: string;
  keyword: string;
  category: string;
  transactionType: "expense" | "income";
  matchType: "contains" | "starts_with" | "exact";
  priority: number;
  active: number;
  createdAt: string;
  updatedAt: string;
};

const select = `SELECT id, keyword, category, transaction_type AS transactionType,
  match_type AS matchType, priority, active, created_at AS createdAt, updated_at AS updatedAt
  FROM category_rules`;

const serialize = (row: CategoryRuleRow) => ({ ...row, active: Boolean(row.active) });

function parseRule(payload: Record<string, unknown>) {
  const keyword = requiredString(payload, "keyword", 80).replace(/\s+/g, " ").trim();
  if (keyword.length < 2) throw new ApiError(400, "INVALID_CATEGORY_RULE", "Kata kunci minimal dua karakter.");
  const category = requiredString(payload, "category", 100);
  const transactionType = requiredString(payload, "transactionType", 20);
  const matchType = payload.matchType === undefined ? "contains" : requiredString(payload, "matchType", 20);
  if (!["expense", "income"].includes(transactionType)) throw new ApiError(400, "INVALID_CATEGORY_RULE", "Jenis transaksi aturan tidak valid.");
  if (!["contains", "starts_with", "exact"].includes(matchType)) throw new ApiError(400, "INVALID_CATEGORY_RULE", "Pola pencocokan aturan tidak valid.");
  const priority = payload.priority === undefined ? 100 : Number(payload.priority);
  if (!Number.isSafeInteger(priority) || priority < 0 || priority > 1000) throw new ApiError(400, "INVALID_CATEGORY_RULE", "Prioritas harus 0 sampai 1000.");
  return { keyword, category, transactionType, matchType, priority, active: payload.active === undefined ? true : Boolean(payload.active) };
}

async function assertCategory(workspaceId: string, category: string, transactionType: string) {
  const row = await getD1().prepare(
    "SELECT id FROM categories WHERE workspace_id = ? AND lower(name) = lower(?) AND type = ? AND archived = 0 LIMIT 1",
  ).bind(workspaceId, category, transactionType).first();
  if (!row) throw new ApiError(400, "CATEGORY_NOT_FOUND", "Kategori aturan tidak ditemukan atau jenisnya tidak cocok.");
}

export async function GET(request: Request) {
  try {
    const workspaceId = resolveWorkspaceId(request);
    await requireWorkspace(workspaceId);
    const result = await getD1().prepare(`${select} WHERE workspace_id = ? ORDER BY active DESC, priority DESC, keyword, id`).bind(workspaceId).all<CategoryRuleRow>();
    return Response.json({ rules: result.results.map(serialize) });
  } catch (error) { return routeError(error); }
}

export async function POST(request: Request) {
  try {
    const payload = await readJsonObject(request);
    const workspaceId = resolveWorkspaceId(request, payload);
    await requireWorkspace(workspaceId);
    await requireCapability(workspaceId, "imports");
    const rule = parseRule(payload);
    await assertCategory(workspaceId, rule.category, rule.transactionType);
    const id = makeId("rule");
    const now = nowIso();
    const requestId = optionalString(payload, "requestId", 120) ?? null;
    const d1 = getD1();
    await d1.batch([
      d1.prepare(`INSERT INTO category_rules
        (id, workspace_id, keyword, category, transaction_type, match_type, priority, active, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(id, workspaceId, rule.keyword, rule.category, rule.transactionType, rule.matchType, rule.priority, rule.active ? 1 : 0, now, now),
      auditStatement(d1, { workspaceId, action: "category_rule.create", entityType: "category_rule", entityId: id, requestId, after: rule, createdAt: now }),
    ]);
    const created = await d1.prepare(`${select} WHERE workspace_id = ? AND id = ?`).bind(workspaceId, id).first<CategoryRuleRow>();
    return Response.json({ rule: serialize(created!) }, { status: 201 });
  } catch (error) { return routeError(error); }
}

export async function PATCH(request: Request) {
  try {
    const payload = await readJsonObject(request);
    const workspaceId = resolveWorkspaceId(request, payload);
    await requireWorkspace(workspaceId);
    await requireCapability(workspaceId, "imports");
    const id = requiredString(payload, "ruleId", 120);
    const before = await getD1().prepare(`${select} WHERE workspace_id = ? AND id = ?`).bind(workspaceId, id).first<CategoryRuleRow>();
    if (!before) throw new ApiError(404, "NOT_FOUND", "Aturan kategori tidak ditemukan.");
    const rule = parseRule(payload);
    await assertCategory(workspaceId, rule.category, rule.transactionType);
    const now = nowIso();
    const d1 = getD1();
    await d1.batch([
      d1.prepare(`UPDATE category_rules SET keyword = ?, category = ?, transaction_type = ?, match_type = ?,
        priority = ?, active = ?, updated_at = ? WHERE workspace_id = ? AND id = ?`)
        .bind(rule.keyword, rule.category, rule.transactionType, rule.matchType, rule.priority, rule.active ? 1 : 0, now, workspaceId, id),
      auditStatement(d1, { workspaceId, action: "category_rule.update", entityType: "category_rule", entityId: id, before: serialize(before), after: rule, createdAt: now }),
    ]);
    const updated = await d1.prepare(`${select} WHERE workspace_id = ? AND id = ?`).bind(workspaceId, id).first<CategoryRuleRow>();
    return Response.json({ rule: serialize(updated!) });
  } catch (error) { return routeError(error); }
}

export async function DELETE(request: Request) {
  try {
    const payload = await readJsonObject(request);
    const workspaceId = resolveWorkspaceId(request, payload);
    await requireWorkspace(workspaceId);
    await requireCapability(workspaceId, "imports");
    const id = requiredString(payload, "ruleId", 120);
    const before = await getD1().prepare(`${select} WHERE workspace_id = ? AND id = ?`).bind(workspaceId, id).first<CategoryRuleRow>();
    if (!before) return Response.json({ deleted: true, ruleId: id, replayed: true });
    const now = nowIso();
    const d1 = getD1();
    await d1.batch([
      d1.prepare("DELETE FROM category_rules WHERE workspace_id = ? AND id = ?").bind(workspaceId, id),
      auditStatement(d1, { workspaceId, action: "category_rule.delete", entityType: "category_rule", entityId: id, before: serialize(before), createdAt: now }),
    ]);
    return Response.json({ deleted: true, ruleId: id });
  } catch (error) { return routeError(error); }
}
