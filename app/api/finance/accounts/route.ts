import { GET as listAccounts, POST as createAccount } from "../../accounts/route";
import { readJsonObject, routeError } from "../../_lib/api";
import { jsonRequest } from "../../_lib/forward";

export const GET = listAccounts;

export async function POST(request: Request) {
  try {
    const payload = await readJsonObject(request);
    return createAccount(
      jsonRequest(request, "/api/accounts", {
        ...payload,
        balance: payload.balance ?? payload.openingBalance ?? 0,
      }),
    );
  } catch (error) {
    return routeError(error);
  }
}
