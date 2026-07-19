import { getD1 } from "@/db";
import { auditStatement } from "../../_lib/audit";
import {
  ApiError,
  nowIso,
  readJsonObject,
  requiredString,
  resolveWorkspaceId,
  routeError,
} from "../../_lib/api";
import { requireWorkspace } from "../../_lib/repository";

type RequestAuditRow = {
  action: string;
  afterJson: string | null;
};

export async function PATCH(request: Request) {
  try {
    const payload = await readJsonObject(request);
    const workspaceId = resolveWorkspaceId(request, payload);
    const workspace = await requireWorkspace(workspaceId);
    const requestId = requiredString(payload, "requestId", 120);
    const name = requiredString(payload, "name", 80);
    const d1 = getD1();

    const replay = await d1
      .prepare(
        `SELECT action, after_json AS afterJson
         FROM audit_logs
         WHERE workspace_id = ? AND request_id = ?
         ORDER BY created_at, id LIMIT 1`,
      )
      .bind(workspaceId, requestId)
      .first<RequestAuditRow>();

    if (replay) {
      if (replay.action !== "profile.update") {
        throw new ApiError(409, "REQUEST_ID_REUSED", "requestId sudah digunakan oleh operasi lain.");
      }
      let previousName = workspace.name;
      try {
        const after = JSON.parse(replay.afterJson || "{}") as { name?: unknown };
        if (typeof after.name === "string" && after.name.trim()) previousName = after.name;
      } catch {
        // Audit lama tetap dapat diulang dengan nilai profil aktif.
      }
      return Response.json({ profileName: previousName, replayed: true });
    }

    const timestamp = nowIso();
    await d1.batch([
      d1
        .prepare("UPDATE workspaces SET profile_name = ?, updated_at = ? WHERE id = ?")
        .bind(name, timestamp, workspaceId),
      auditStatement(d1, {
        workspaceId,
        action: "profile.update",
        entityType: "profile",
        entityId: workspaceId,
        requestId,
        before: { name: workspace.name },
        after: { name },
        details: { field: "profileName" },
        createdAt: timestamp,
      }),
    ]);

    return Response.json({ profileName: name, replayed: false });
  } catch (error) {
    return routeError(error);
  }
}
