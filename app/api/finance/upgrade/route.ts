import { FINANCE_SCHEMA_VERSION } from "@/lib/schema-version";
import { readJsonObject, resolveWorkspaceId, routeError } from "../../_lib/api";
import { requireWorkspace } from "../../_lib/repository";

export async function POST(request: Request) {
  try {
    const payload = await readJsonObject(request);
    await requireWorkspace(resolveWorkspaceId(request, payload));
    return Response.json({ schemaVersion: FINANCE_SCHEMA_VERSION, upgraded: false, message: "Database situs mengikuti migrasi deployment secara otomatis." });
  } catch (error) { return routeError(error); }
}
