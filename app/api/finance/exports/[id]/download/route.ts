import { resolveWorkspaceId, routeError, validateId } from "../../../../_lib/api";
import { downloadExport } from "../../../../_lib/portability";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Context) {
  try {
    const { id } = await context.params;
    return await downloadExport(resolveWorkspaceId(request), validateId(id, "exportId"));
  } catch (error) {
    return routeError(error);
  }
}
