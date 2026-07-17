import { getD1 } from "@/db";
import {
  auditStatement,
  auditStatementWhenCategoryExists,
  getAuditByRequest,
} from "../_lib/audit";
import {
  ApiError,
  nowIso,
  optionalString,
  readJsonObject,
  resolveWorkspaceId,
  routeError,
} from "../_lib/api";
import { parseCategory } from "../_lib/domain";
import {
  categorySelect,
  getCategoryRow,
  requireWorkspace,
  serializeCategory,
} from "../_lib/repository";

export async function GET(request: Request) {
  try {
    const workspaceId = resolveWorkspaceId(request);
    await requireWorkspace(workspaceId);
    const includeArchived = new URL(request.url).searchParams.get("includeArchived") === "true";
    const statement = includeArchived
      ? getD1()
          .prepare(`${categorySelect} WHERE workspace_id = ? ORDER BY archived, type, name, id`)
          .bind(workspaceId)
      : getD1()
          .prepare(
            `${categorySelect} WHERE workspace_id = ? AND archived = 0 ORDER BY type, name, id`,
          )
          .bind(workspaceId);
    const result = await statement.all();
    return Response.json({
      categories: result.results.map((row: Record<string, unknown>) =>
        serializeCategory(row as never),
      ),
    });
  } catch (error) {
    return routeError(error);
  }
}

export async function POST(request: Request) {
  let workspaceId: string | null = null;
  let requestId: string | null = null;
  try {
    const payload = await readJsonObject(request);
    workspaceId = resolveWorkspaceId(request, payload);
    await requireWorkspace(workspaceId);
    requestId = optionalString(payload, "requestId", 120) ?? null;

    if (requestId) {
      const replayAudit = await getAuditByRequest(workspaceId, requestId, "category.create");
      if (replayAudit?.entityId) {
        const replayCategory = await getCategoryRow(workspaceId, replayAudit.entityId);
        if (replayCategory) {
          return Response.json({ category: serializeCategory(replayCategory), replayed: true });
        }
      }
    }

    const category = parseCategory(payload);
    if (category.type === "system") {
      throw new ApiError(
        400,
        "CATEGORY_TYPE_RESERVED",
        "Tipe kategori system hanya dapat dibuat oleh sistem.",
      );
    }
    const now = nowIso();
    const d1 = getD1();
    const insertStatement = requestId
      ? d1
          .prepare(
            `INSERT INTO categories
               (id, workspace_id, name, type, color, icon, archived, is_default,
                created_at, updated_at)
             SELECT ?, ?, ?, ?, ?, ?, 0, 0, ?, ?
             WHERE NOT EXISTS (
               SELECT 1 FROM audit_logs
               WHERE workspace_id = ? AND request_id = ? AND action = 'category.create'
             )`,
          )
          .bind(
            category.id,
            workspaceId,
            category.name,
            category.type,
            category.color,
            category.icon,
            now,
            now,
            workspaceId,
            requestId,
          )
      : d1
          .prepare(
            `INSERT INTO categories
               (id, workspace_id, name, type, color, icon, archived, is_default,
                created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, 0, 0, ?, ?)`,
          )
          .bind(
            category.id,
            workspaceId,
            category.name,
            category.type,
            category.color,
            category.icon,
            now,
            now,
          );
    const auditEntry = {
        workspaceId,
        action: "category.create",
        entityType: "category",
        entityId: category.id,
        requestId,
        after: category,
        createdAt: now,
      };
    const results = await d1.batch([
      insertStatement,
      requestId
        ? auditStatementWhenCategoryExists(d1, auditEntry, category.id)
        : auditStatement(d1, auditEntry),
    ]);

    if (requestId && Number(results[0]?.meta?.changes ?? 0) === 0) {
      const replayAudit = await getAuditByRequest(workspaceId, requestId, "category.create");
      if (replayAudit?.entityId) {
        const replayCategory = await getCategoryRow(workspaceId, replayAudit.entityId);
        if (replayCategory) {
          return Response.json({ category: serializeCategory(replayCategory), replayed: true });
        }
      }
      throw new ApiError(
        409,
        "IDEMPOTENCY_CONFLICT",
        "requestId sudah digunakan tetapi hasil sebelumnya tidak ditemukan.",
      );
    }
    return Response.json(
      {
        category: serializeCategory((await getCategoryRow(workspaceId, category.id))!),
        replayed: false,
      },
      { status: 201 },
    );
  } catch (error) {
    if (
      workspaceId &&
      requestId &&
      error instanceof Error &&
      error.message.includes("UNIQUE constraint failed")
    ) {
      const replayAudit = await getAuditByRequest(workspaceId, requestId, "category.create");
      if (replayAudit?.entityId) {
        const replayCategory = await getCategoryRow(workspaceId, replayAudit.entityId);
        if (replayCategory) {
          return Response.json({ category: serializeCategory(replayCategory), replayed: true });
        }
      }
    }
    if (error instanceof Error && error.message.includes("UNIQUE constraint failed")) {
      return routeError(
        new ApiError(
          409,
          error.message.includes("categories.id")
            ? "CATEGORY_ID_EXISTS"
            : "CATEGORY_NAME_EXISTS",
          error.message.includes("categories.id")
            ? "ID kategori sudah digunakan."
            : "Nama kategori sudah digunakan.",
        ),
      );
    }
    return routeError(error);
  }
}
