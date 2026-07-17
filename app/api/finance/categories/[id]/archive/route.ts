import { DELETE as archiveCategory } from "../../../../categories/[id]/route";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  return archiveCategory(request, context);
}
