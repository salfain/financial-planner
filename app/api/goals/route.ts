import { getD1 } from "@/db";
import { nowIso, readJsonObject, resolveWorkspaceId, routeError } from "../_lib/api";
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
    const goal = parseGoal(payload);
    const now = nowIso();
    await getD1()
      .prepare(
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
      )
      .run();
    return Response.json(
      { goal: serializeGoal((await getGoalRow(workspaceId, goal.id))!) },
      { status: 201 },
    );
  } catch (error) {
    return routeError(error);
  }
}
