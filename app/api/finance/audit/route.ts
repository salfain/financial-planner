import { getD1 } from "@/db";
import { ApiError, resolveWorkspaceId, routeError } from "../../_lib/api";
import {
  auditLogSelect,
  requireWorkspace,
  serializeAuditLog,
  type AuditLogRow,
} from "../../_lib/repository";

export async function GET(request: Request) {
  try {
    const workspaceId = resolveWorkspaceId(request);
    await requireWorkspace(workspaceId);
    const rawLimit = new URL(request.url).searchParams.get("limit") ?? "50";
    const limit = Number(rawLimit);
    if (!Number.isInteger(limit) || limit < 1 || limit > 200) {
      throw new ApiError(400, "INVALID_LIMIT", "limit harus berupa bilangan bulat 1-200.");
    }
    const result = await getD1()
      .prepare(
        `${auditLogSelect}
         WHERE workspace_id = ? ORDER BY created_at DESC, id DESC LIMIT ?`,
      )
      .bind(workspaceId, limit)
      .all<AuditLogRow>();
    return Response.json({ auditLogs: result.results.map(serializeAuditLog) });
  } catch (error) {
    return routeError(error);
  }
}
