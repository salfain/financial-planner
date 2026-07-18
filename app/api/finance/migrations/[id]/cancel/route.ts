import { resolveWorkspaceId, routeError, validateId } from "../../../../_lib/api";
import { cancelMigration } from "../../../../_lib/portability";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  try {
    const { id } = await context.params;
    return Response.json(await cancelMigration(resolveWorkspaceId(request), validateId(id, "migrationId")));
  } catch (error) {
    return routeError(error);
  }
}
