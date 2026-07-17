import { getD1 } from "@/db";
import { auditStatement, getAuditByRequestId } from "../../_lib/audit";
import {
  ApiError,
  nowIso,
  optionalString,
  readJsonObject,
  readOptionalJsonObject,
  resolveWorkspaceId,
  routeError,
  validateId,
} from "../../_lib/api";
import { mergePayload, parseCategory } from "../../_lib/domain";
import {
  getCategoryRow,
  requireWorkspace,
  serializeCategory,
} from "../../_lib/repository";

type Context = { params: Promise<{ id: string }> };
const routeId = async (context: Context) => validateId((await context.params).id);

export async function GET(request: Request, context: Context) {
  try {
    const workspaceId = resolveWorkspaceId(request);
    await requireWorkspace(workspaceId);
    const category = await getCategoryRow(workspaceId, await routeId(context));
    if (!category) throw new ApiError(404, "NOT_FOUND", "Kategori tidak ditemukan.");
    return Response.json({ category: serializeCategory(category) });
  } catch (error) {
    return routeError(error);
  }
}

export async function PATCH(request: Request, context: Context) {
  let workspaceId: string | null = null;
  let id: string | null = null;
  let requestId: string | null = null;
  try {
    const payload = await readJsonObject(request);
    workspaceId = resolveWorkspaceId(request, payload);
    await requireWorkspace(workspaceId);
    id = await routeId(context);
    requestId = optionalString(payload, "requestId", 120) ?? null;
    if (requestId) {
      const replayAudit = await getAuditByRequestId(
        workspaceId,
        requestId,
        "category.update",
        id,
      );
      if (replayAudit) {
        const replayCategory = await getCategoryRow(workspaceId, id);
        if (replayCategory) {
          return Response.json({ category: serializeCategory(replayCategory), replayed: true });
        }
      }
    }
    const current = await getCategoryRow(workspaceId, id);
    if (!current) throw new ApiError(404, "NOT_FOUND", "Kategori tidak ditemukan.");
    const before = serializeCategory(current);
    const category = parseCategory(
      mergePayload(before, payload, ["name", "type", "color", "icon"]),
      id,
    );
    if (
      category.type !== current.type &&
      (current.isDefault || current.type === "system")
    ) {
      throw new ApiError(
        409,
        "CATEGORY_TYPE_PROTECTED",
        "Tipe kategori bawaan atau sistem tidak dapat diubah.",
      );
    }
    if (category.type === "system" && current.type !== "system") {
      throw new ApiError(
        400,
        "CATEGORY_TYPE_RESERVED",
        "Tipe kategori system hanya dapat dikelola oleh sistem.",
      );
    }
    if (category.type !== current.type) {
      const references = await getD1()
        .prepare(
          `SELECT
             (SELECT COUNT(*) FROM transactions
              WHERE workspace_id = ? AND category = ? AND deleted_at IS NULL) AS transactionCount,
             (SELECT COUNT(*) FROM budgets
              WHERE workspace_id = ? AND category = ?) AS budgetCount,
             (SELECT COUNT(*) FROM bills
              WHERE workspace_id = ? AND category = ?) AS billCount`,
        )
        .bind(
          workspaceId,
          current.name,
          workspaceId,
          current.name,
          workspaceId,
          current.name,
        )
        .first<{ transactionCount: number; budgetCount: number; billCount: number }>();
      if (
        Number(references?.transactionCount ?? 0) > 0 ||
        Number(references?.budgetCount ?? 0) > 0 ||
        Number(references?.billCount ?? 0) > 0
      ) {
        throw new ApiError(
          409,
          "CATEGORY_IN_USE",
          "Tipe kategori yang sudah digunakan tidak dapat diubah.",
        );
      }
    }
    const now = nowIso();
    const d1 = getD1();
    const cascadeStatements: D1PreparedStatement[] =
      before.name === category.name
        ? []
        : [
            d1
              .prepare(
                `UPDATE transactions SET category = ?, updated_at = ?
                 WHERE workspace_id = ? AND category = ? AND deleted_at IS NULL`,
              )
              .bind(category.name, now, workspaceId, before.name),
            d1
              .prepare(
                `UPDATE budgets SET category = ?, updated_at = ?
                 WHERE workspace_id = ? AND category = ?`,
              )
              .bind(category.name, now, workspaceId, before.name),
            d1
              .prepare(
                `UPDATE bills SET category = ?, updated_at = ?
                 WHERE workspace_id = ? AND category = ?`,
              )
              .bind(category.name, now, workspaceId, before.name),
          ];
    await d1.batch([
      d1
        .prepare(
          `UPDATE categories
           SET name = ?, type = ?, color = ?, icon = ?, updated_at = ?
           WHERE workspace_id = ? AND id = ?`,
        )
        .bind(
          category.name,
          category.type,
          category.color,
          category.icon,
          now,
          workspaceId,
          id,
        ),
      ...cascadeStatements,
      auditStatement(d1, {
        workspaceId,
        action: "category.update",
        entityType: "category",
        entityId: id,
        requestId,
        before,
        after: { ...before, ...category },
        createdAt: now,
      }),
    ]);
    return Response.json({
      category: serializeCategory((await getCategoryRow(workspaceId, id))!),
      replayed: false,
    });
  } catch (error) {
    if (
      workspaceId &&
      id &&
      requestId &&
      error instanceof Error &&
      error.message.includes("UNIQUE constraint failed")
    ) {
      const replayAudit = await getAuditByRequestId(
        workspaceId,
        requestId,
        "category.update",
        id,
      );
      if (replayAudit) {
        const replayCategory = await getCategoryRow(workspaceId, id);
        if (replayCategory) {
          return Response.json({ category: serializeCategory(replayCategory), replayed: true });
        }
      }
    }
    if (error instanceof Error && error.message.includes("UNIQUE constraint failed")) {
      return routeError(
        new ApiError(409, "CATEGORY_NAME_EXISTS", "Nama kategori sudah digunakan."),
      );
    }
    return routeError(error);
  }
}

export async function DELETE(request: Request, context: Context) {
  let workspaceId: string | null = null;
  let id: string | null = null;
  let requestId: string | null = null;
  try {
    const payload = await readOptionalJsonObject(request);
    workspaceId = resolveWorkspaceId(request, payload);
    await requireWorkspace(workspaceId);
    id = await routeId(context);
    requestId = optionalString(payload, "requestId", 120) ?? null;
    if (requestId) {
      const replayAudit = await getAuditByRequestId(
        workspaceId,
        requestId,
        "category.archive",
        id,
      );
      if (replayAudit) {
        const replayCategory = await getCategoryRow(workspaceId, id);
        if (replayCategory) {
          return Response.json({
            category: serializeCategory(replayCategory),
            archived: true,
            replayed: true,
          });
        }
      }
    }
    const current = await getCategoryRow(workspaceId, id);
    if (!current) throw new ApiError(404, "NOT_FOUND", "Kategori tidak ditemukan.");
    if (current.archived) {
      return Response.json({
        category: serializeCategory(current),
        archived: true,
        replayed: false,
      });
    }
    if (current.isDefault || current.type === "system") {
      throw new ApiError(
        409,
        "CATEGORY_PROTECTED",
        "Kategori bawaan atau sistem tidak dapat diarsipkan.",
      );
    }
    const before = serializeCategory(current);
    const now = nowIso();
    const d1 = getD1();
    await d1.batch([
      d1
        .prepare(
          `UPDATE categories SET archived = 1, updated_at = ?
           WHERE workspace_id = ? AND id = ? AND archived = 0`,
        )
        .bind(now, workspaceId, id),
      auditStatement(d1, {
        workspaceId,
        action: "category.archive",
        entityType: "category",
        entityId: id,
        requestId,
        before,
        after: { ...before, archived: true },
        createdAt: now,
      }),
    ]);
    return Response.json({
      category: serializeCategory((await getCategoryRow(workspaceId, id))!),
      archived: true,
      replayed: false,
    });
  } catch (error) {
    if (
      workspaceId &&
      id &&
      requestId &&
      error instanceof Error &&
      error.message.includes("UNIQUE constraint failed")
    ) {
      const replayAudit = await getAuditByRequestId(
        workspaceId,
        requestId,
        "category.archive",
        id,
      );
      if (replayAudit) {
        const replayCategory = await getCategoryRow(workspaceId, id);
        if (replayCategory) {
          return Response.json({
            category: serializeCategory(replayCategory),
            archived: true,
            replayed: true,
          });
        }
      }
    }
    return routeError(error);
  }
}
