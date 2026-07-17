import { DELETE as archiveAccount } from "../../../../accounts/[id]/route";
import { requestWithoutBody } from "../../../../_lib/forward";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  return archiveAccount(requestWithoutBody(request, "/api/accounts/archive", "DELETE"), context);
}
