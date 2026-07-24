import { getD1 } from "@/db";
import { normalizeFeaturePreferences } from "@/lib/feature-preferences";
import { auditStatement } from "../../_lib/audit";
import {
  nowIso,
  readJsonObject,
  requiredString,
  resolveWorkspaceId,
  routeError,
} from "../../_lib/api";
import { requireWorkspace } from "../../_lib/repository";

export async function GET(request: Request) {
  try {
    const workspaceId = resolveWorkspaceId(request);
    await requireWorkspace(workspaceId);
    const row = await getD1()
      .prepare("SELECT preferences_json AS preferencesJson FROM feature_preferences WHERE workspace_id = ? LIMIT 1")
      .bind(workspaceId)
      .first<{ preferencesJson?: string }>();
    return Response.json({ preferences: normalizeFeaturePreferences(row?.preferencesJson) });
  } catch (error) {
    return routeError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const payload = await readJsonObject(request);
    const workspaceId = resolveWorkspaceId(request, payload);
    await requireWorkspace(workspaceId);
    const requestId = requiredString(payload, "requestId", 120);
    const preferences = normalizeFeaturePreferences(payload.preferences);
    const d1 = getD1();
    const previous = await d1
      .prepare("SELECT preferences_json AS preferencesJson FROM feature_preferences WHERE workspace_id = ? LIMIT 1")
      .bind(workspaceId)
      .first<{ preferencesJson?: string }>();
    const timestamp = nowIso();
    await d1.batch([
      d1.prepare(
        `INSERT INTO feature_preferences (workspace_id, preferences_json, updated_at)
         VALUES (?, ?, ?)
         ON CONFLICT(workspace_id) DO UPDATE SET preferences_json = excluded.preferences_json, updated_at = excluded.updated_at`,
      ).bind(workspaceId, JSON.stringify(preferences), timestamp),
      auditStatement(d1, {
        workspaceId,
        action: "feature_preferences.update",
        entityType: "feature_preferences",
        entityId: workspaceId,
        requestId,
        before: normalizeFeaturePreferences(previous?.preferencesJson),
        after: preferences,
        createdAt: timestamp,
      }),
    ]);
    return Response.json({ preferences });
  } catch (error) {
    return routeError(error);
  }
}
