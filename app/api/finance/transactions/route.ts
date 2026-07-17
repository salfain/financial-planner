import {
  GET as listTransactions,
  POST as createTransaction,
} from "../../transactions/route";
import { readJsonObject, routeError } from "../../_lib/api";
import { jsonRequest } from "../../_lib/forward";

export const GET = listTransactions;

export async function POST(request: Request) {
  try {
    const payload = await readJsonObject(request);
    return createTransaction(
      jsonRequest(request, "/api/transactions", {
        ...payload,
        idempotencyKey: payload.idempotencyKey ?? payload.requestId,
      }),
    );
  } catch (error) {
    return routeError(error);
  }
}
