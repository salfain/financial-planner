import { resolveWorkspaceId, routeError } from "../../_lib/api";
import { listMigrations } from "../../_lib/portability";

export async function GET(request: Request) {
  try {
    return Response.json({ migrations: await listMigrations(resolveWorkspaceId(request)) });
  } catch (error) {
    return routeError(error);
  }
}
