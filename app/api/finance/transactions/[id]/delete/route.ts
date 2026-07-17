import { DELETE as deleteTransaction } from "../../../../transactions/[id]/route";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  return deleteTransaction(request, context);
}
