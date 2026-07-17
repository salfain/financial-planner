import { DELETE as archiveAccount } from "../../../../accounts/[id]/route";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  return archiveAccount(request, context);
}
