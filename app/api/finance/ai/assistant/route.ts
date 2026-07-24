import { monthPeriod, readJsonObject, requiredString, resolveWorkspaceId, routeError } from "../../../_lib/api";
import { askAi, clearAiMessages, listAiMessages } from "../../../_lib/ai";
import { requireCapability } from "../../../_lib/license";

export async function GET(request: Request) {
  try {
    return Response.json({ messages: await listAiMessages(resolveWorkspaceId(request)) });
  } catch (error) {
    return routeError(error);
  }
}

export async function POST(request: Request) {
  try {
    const payload = await readJsonObject(request);
    const workspaceId = resolveWorkspaceId(request, payload);
    await requireCapability(workspaceId, "ai");
    const question = requiredString(payload, "question", 600);
    const period = monthPeriod(payload, "period");
    return Response.json(await askAi(workspaceId, question, period));
  } catch (error) {
    return routeError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    return Response.json(await clearAiMessages(resolveWorkspaceId(request)));
  } catch (error) {
    return routeError(error);
  }
}
