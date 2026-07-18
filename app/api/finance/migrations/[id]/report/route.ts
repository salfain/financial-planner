import { resolveWorkspaceId, routeError, validateId } from "../../../../_lib/api";
import { downloadMigrationReport } from "../../../../_lib/portability";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Context) {
  try {
    const { id } = await context.params;
    return await downloadMigrationReport(resolveWorkspaceId(request), validateId(id, "migrationId"));
  } catch (error) {
    return routeError(error);
  }
}
