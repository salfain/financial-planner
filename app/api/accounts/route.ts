import { getD1 } from "@/db";
import { nowIso, readJsonObject, resolveWorkspaceId, routeError } from "../_lib/api";
import { parseAccount } from "../_lib/domain";
import {
  accountSelect,
  getAccountRow,
  requireWorkspace,
  serializeAccount,
} from "../_lib/repository";

export async function GET(request: Request) {
  try {
    const workspaceId = resolveWorkspaceId(request);
    await requireWorkspace(workspaceId);
    const result = await getD1()
      .prepare(`${accountSelect} WHERE workspace_id = ? AND active = 1 ORDER BY created_at, id`)
      .bind(workspaceId)
      .all();
    return Response.json({
      accounts: result.results.map((row: Record<string, unknown>) => serializeAccount(row as never)),
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
    const account = parseAccount(payload);
    const now = nowIso();
    await getD1()
      .prepare(
        `INSERT INTO accounts
           (id, workspace_id, name, type, institution, balance, mask, color, liability,
            active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      )
      .bind(
        account.id,
        workspaceId,
        account.name,
        account.type,
        account.institution,
        account.balance,
        account.mask,
        account.color,
        account.liability ? 1 : 0,
        now,
        now,
      )
      .run();
    const created = await getAccountRow(workspaceId, account.id);
    return Response.json({ account: serializeAccount(created!) }, { status: 201 });
  } catch (error) {
    return routeError(error);
  }
}
