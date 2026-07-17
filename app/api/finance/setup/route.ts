import { POST as bootstrap } from "../../bootstrap/route";
import { readJsonObject, routeError } from "../../_lib/api";
import { jsonRequest } from "../../_lib/forward";

export async function POST(request: Request) {
  try {
    const payload = await readJsonObject(request);
    const accounts = Array.isArray(payload.accounts)
      ? payload.accounts.map((value) => {
          const account = value as Record<string, unknown>;
          return {
            ...account,
            balance: account.balance ?? account.openingBalance ?? 0,
          };
        })
      : payload.accounts;
    return bootstrap(
      jsonRequest(request, "/api/bootstrap", {
        ...payload,
        profileName: payload.profileName ?? payload.name,
        accounts,
      }),
    );
  } catch (error) {
    return routeError(error);
  }
}
