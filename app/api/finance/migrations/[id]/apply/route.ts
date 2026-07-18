import { resolveWorkspaceId, routeError, validateId } from "../../../../_lib/api";
import { applyMigration } from "../../../../_lib/portability";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  try {
    const { id } = await context.params;
    return Response.json(await applyMigration(resolveWorkspaceId(request), validateId(id, "migrationId")));
  } catch (error) {
    return routeError(error);
  }
}
