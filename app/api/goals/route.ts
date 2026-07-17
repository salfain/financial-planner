import { getD1 } from "@/db";
import { auditStatement } from "../_lib/audit";
import {
  nowIso,
  optionalString,
  readJsonObject,
  resolveWorkspaceId,
  routeError,
} from "../_lib/api";
import { parseGoal } from "../_lib/domain";
import {
  getGoalRow,
  goalSelect,
  requireWorkspace,
  serializeGoal,
} from "../_lib/repository";

export async function GET(request: Request) {
  try {
    const workspaceId = resolveWorkspaceId(request);
    await requireWorkspace(workspaceId);
    const result = await getD1()
      .prepare(`${goalSelect} WHERE workspace_id = ? ORDER BY deadline, created_at, id`)
      .bind(workspaceId)
      .all();
    return Response.json({
      goals: result.results.map((row: Record<string, unknown>) => serializeGoal(row as never)),
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
    const goal = parseGoal(payload);
    const now = nowIso();
    const d1 = getD1();
    await d1.batch([
      d1.prepare(
        `INSERT INTO goals
           (id, workspace_id, name, target, current, deadline, color, icon, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        goal.id,
        workspaceId,
        goal.name,
        goal.target,
        goal.current,
        goal.deadline,
        goal.color,
        goal.icon,
        now,
        now,
      ),
      auditStatement(d1, {
        workspaceId,
        action: "goal.create",
        entityType: "goal",
        entityId: goal.id,
        requestId,
        after: goal,
        createdAt: now,
      }),
    ]);
    return Response.json(
      { goal: serializeGoal((await getGoalRow(workspaceId, goal.id))!) },
      { status: 201 },
    );
  } catch (error) {
    return routeError(error);
  }
}
