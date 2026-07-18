import { getD1 } from "@/db";
import { auditStatement } from "../../../../_lib/audit";
import { ApiError, makeId, nowIso, resolveWorkspaceId, routeError, validateId } from "../../../../_lib/api";
import { getFilesBucket } from "../../../../_lib/files";
import { getTransactionRow, requireWorkspace } from "../../../../_lib/repository";

type Context = { params: Promise<{ id: string }> };
const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);

export async function POST(request: Request, context: Context) {
  let objectKey: string | null = null;
  try {
    const workspaceId = resolveWorkspaceId(request);
    await requireWorkspace(workspaceId);
    const transactionId = validateId((await context.params).id);
    if (!await getTransactionRow(workspaceId, transactionId)) {
      throw new ApiError(404, "NOT_FOUND", "Transaksi tidak ditemukan.");
    }
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new ApiError(400, "FILE_REQUIRED", "Pilih gambar atau PDF struk.");
    if (!allowedTypes.has(file.type)) throw new ApiError(400, "INVALID_FILE_TYPE", "Lampiran harus JPG, PNG, WebP, atau PDF.");
    if (file.size < 1 || file.size > 5 * 1024 * 1024) throw new ApiError(400, "INVALID_FILE_SIZE", "Ukuran lampiran maksimal 5 MB.");
    const filename = file.name.replace(/[\r\n"\\/]/g, "_").slice(0, 120) || "lampiran-struk";
    const attachmentId = makeId("receipt");
    objectKey = `transactions/${workspaceId}/${transactionId}/${attachmentId}`;
    const bucket = getFilesBucket();
    await bucket.put(objectKey, await file.arrayBuffer(), {
      httpMetadata: { contentType: file.type },
      customMetadata: { filename, workspaceId, transactionId },
    });
    const d1 = getD1();
    const existing = await d1
      .prepare("SELECT id, object_key AS objectKey FROM transaction_attachments WHERE workspace_id = ? AND transaction_id = ?")
      .bind(workspaceId, transactionId)
      .all<{ id: string; objectKey: string }>();
    const now = nowIso();
    await d1.batch([
      d1.prepare("DELETE FROM transaction_attachments WHERE workspace_id = ? AND transaction_id = ?").bind(workspaceId, transactionId),
      d1.prepare(`INSERT INTO transaction_attachments (id, workspace_id, transaction_id, filename, content_type, object_key, size_bytes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(attachmentId, workspaceId, transactionId, filename, file.type, objectKey, file.size, now),
      auditStatement(d1, { workspaceId, action: "transaction.attachment", entityType: "transaction", entityId: transactionId, after: { id: attachmentId, filename, contentType: file.type, sizeBytes: file.size }, createdAt: now }),
    ]);
    await Promise.all(existing.results.map((row) => row.objectKey === objectKey ? Promise.resolve() : bucket.delete(row.objectKey)));
    return Response.json({ receipt: { id: attachmentId, filename, contentType: file.type, sizeBytes: file.size } }, { status: 201 });
  } catch (error) {
    if (objectKey) {
      try { await getFilesBucket().delete(objectKey); } catch { /* cleanup is best-effort */ }
    }
    return routeError(error);
  }
}
