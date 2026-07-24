import { getD1 } from "@/db";
import { auditStatement } from "../../_lib/audit";
import {
  nowIso,
  optionalString,
  readJsonObject,
  readOptionalJsonObject,
  requiredString,
  resolveWorkspaceId,
  routeError,
} from "../../_lib/api";
import { activateLicense, deactivateLicense, getEntitlement } from "../../_lib/license";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    return Response.json(await getEntitlement(resolveWorkspaceId(request)));
  } catch (error) {
    return routeError(error);
  }
}

export async function POST(request: Request) {
  try {
    const payload = await readJsonObject(request);
    const workspaceId = resolveWorkspaceId(request, payload);
    const requestId = optionalString(payload, "requestId", 120) ?? null;
    const entitlement = await activateLicense(workspaceId, requiredString(payload, "token", 4096));
    const timestamp = nowIso();
    await getD1().batch([
      auditStatement(getD1(), {
        workspaceId,
        action: "license.activate",
        entityType: "license",
        entityId: entitlement.licenseId ?? workspaceId,
        requestId,
        after: { tier: entitlement.tier, expiresAt: entitlement.expiresAt },
        createdAt: timestamp,
      }),
    ]);
    return Response.json(entitlement);
  } catch (error) {
    return routeError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const payload = await readOptionalJsonObject(request);
    const workspaceId = resolveWorkspaceId(request, payload);
    const requestId = optionalString(payload, "requestId", 120) ?? null;
    const before = await getEntitlement(workspaceId);
    const entitlement = await deactivateLicense(workspaceId);
    await getD1().batch([
      auditStatement(getD1(), {
        workspaceId,
        action: "license.deactivate",
        entityType: "license",
        entityId: before.licenseId ?? workspaceId,
        requestId,
        before: { tier: before.tier, expiresAt: before.expiresAt },
        after: { tier: "free" },
        createdAt: nowIso(),
      }),
    ]);
    return Response.json(entitlement);
  } catch (error) {
    return routeError(error);
  }
}
