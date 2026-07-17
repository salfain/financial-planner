import { GET as listGoals, POST as createGoal } from "../../goals/route";
import { readJsonObject, routeError } from "../../_lib/api";
import { jsonRequest } from "../../_lib/forward";

export const GET = listGoals;

export async function POST(request: Request) {
  try {
    const payload = await readJsonObject(request);
    return createGoal(
      jsonRequest(request, "/api/goals", {
        ...payload,
        target: payload.target ?? payload.targetAmount,
        current: payload.current ?? payload.currentAmount ?? 0,
      }),
    );
  } catch (error) {
    return routeError(error);
  }
}
