import type { BackupSchedule } from "@/lib/portability";
import { booleanValue, enumValue, readJsonObject, resolveWorkspaceId, routeError } from "../../_lib/api";
import { createBackup, getBackupOverview, updateBackupSchedule } from "../../_lib/portability";

const frequencies = ["daily", "weekly", "monthly"] as const;

export async function GET(request: Request) {
  try {
    return Response.json(await getBackupOverview(resolveWorkspaceId(request)));
  } catch (error) {
    return routeError(error);
  }
}

export async function POST(request: Request) {
  try {
    const payload = await readJsonObject(request);
    const workspaceId = resolveWorkspaceId(request, payload);
    return Response.json(await createBackup(workspaceId, "manual"), { status: 201 });
  } catch (error) {
    return routeError(error);
  }
}

export async function PUT(request: Request) {
  try {
    const payload = await readJsonObject(request);
    const workspaceId = resolveWorkspaceId(request, payload);
    const enabled = booleanValue(payload, "enabled");
    const frequency = enumValue(payload, "frequency", frequencies) as BackupSchedule["frequency"];
    return Response.json(await updateBackupSchedule(workspaceId, enabled, frequency));
  } catch (error) {
    return routeError(error);
  }
}
