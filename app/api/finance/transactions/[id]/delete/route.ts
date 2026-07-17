import { DELETE as deleteTransaction } from "../../../../transactions/[id]/route";
import { requestWithoutBody } from "../../../../_lib/forward";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  return deleteTransaction(requestWithoutBody(request, "/api/transactions/delete", "DELETE"), context);
}
