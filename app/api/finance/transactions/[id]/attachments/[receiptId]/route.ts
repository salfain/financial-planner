import { getD1 } from "@/db";
import { auditStatement } from "../../../../../_lib/audit";
import { ApiError, nowIso, readOptionalJsonObject, resolveWorkspaceId, routeError, validateId } from "../../../../../_lib/api";
import { getFilesBucket } from "../../../../../_lib/files";
import { requireWorkspace } from "../../../../../_lib/repository";

type Context = { params: Promise<{ id: string; receiptId: string }> };

async function attachment(request: Request, context: Context) {
  const workspaceId = resolveWorkspaceId(request);
  await requireWorkspace(workspaceId);
  const params = await context.params;
  const transactionId = validateId(params.id);
  const receiptId = validateId(params.receiptId, "receiptId");
  const row = await getD1().prepare(`SELECT id, transaction_id AS transactionId, filename, content_type AS contentType, object_key AS objectKey, size_bytes AS sizeBytes FROM transaction_attachments WHERE workspace_id = ? AND transaction_id = ? AND id = ? LIMIT 1`)
    .bind(workspaceId, transactionId, receiptId)
    .first<{ id: string; transactionId: string; filename: string; contentType: string; objectKey: string; sizeBytes: number }>();
  if (!row) throw new ApiError(404, "NOT_FOUND", "Lampiran transaksi tidak ditemukan.");
  return { workspaceId, transactionId, row };
}

export async function GET(request: Request, context: Context) {
  try {
    const { row } = await attachment(request, context);
    const object = await getFilesBucket().get(row.objectKey);
    if (!object) throw new ApiError(404, "FILE_NOT_FOUND", "File lampiran tidak ditemukan di penyimpanan.");
    return new Response(object.body, { headers: {
      "content-type": row.contentType,
      "content-length": String(row.sizeBytes),
      "content-disposition": `inline; filename="${row.filename.replaceAll('"', "")}"`,
      "cache-control": "private, max-age=60",
    } });
  } catch (error) { return routeError(error); }
}

export async function DELETE(request: Request, context: Context) {
  try {
    await readOptionalJsonObject(request);
    const { workspaceId, transactionId, row } = await attachment(request, context);
    const d1 = getD1();
    const now = nowIso();
    await d1.batch([
      d1.prepare("DELETE FROM transaction_attachments WHERE workspace_id = ? AND transaction_id = ? AND id = ?").bind(workspaceId, transactionId, row.id),
      auditStatement(d1, { workspaceId, action: "transaction.attachment.delete", entityType: "transaction", entityId: transactionId, before: row, createdAt: now }),
    ]);
    await getFilesBucket().delete(row.objectKey);
    return Response.json({ deleted: true, receiptId: row.id });
  } catch (error) { return routeError(error); }
}
