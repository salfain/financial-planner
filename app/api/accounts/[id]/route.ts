import { getD1 } from "@/db";
import { auditStatement } from "../../_lib/audit";
import {
  ApiError,
  nowIso,
  optionalString,
  readJsonObject,
  readOptionalJsonObject,
  resolveWorkspaceId,
  routeError,
  validateId,
} from "../../_lib/api";
import { mergePayload, parseAccount } from "../../_lib/domain";
import {
  getAccountRow,
  requireWorkspace,
  serializeAccount,
} from "../../_lib/repository";

type Context = { params: Promise<{ id: string }> };

async function routeId(context: Context) {
  return validateId((await context.params).id);
}

export async function GET(request: Request, context: Context) {
  try {
    const workspaceId = resolveWorkspaceId(request);
    await requireWorkspace(workspaceId);
    const account = await getAccountRow(workspaceId, await routeId(context));
    if (!account) throw new ApiError(404, "NOT_FOUND", "Akun tidak ditemukan.");
    return Response.json({ account: serializeAccount(account) });
  } catch (error) {
    return routeError(error);
  }
}

export async function PATCH(request: Request, context: Context) {
  try {
    const payload = await readJsonObject(request);
    const workspaceId = resolveWorkspaceId(request, payload);
    await requireWorkspace(workspaceId);
    const id = await routeId(context);
    const current = await getAccountRow(workspaceId, id);
    if (!current) throw new ApiError(404, "NOT_FOUND", "Akun tidak ditemukan.");
    const account = parseAccount(
      mergePayload(serializeAccount(current), payload, [
        "name",
        "type",
        "institution",
        "mask",
        "color",
        "liability",
      ]),
      id,
    );
    const requestId = optionalString(payload, "requestId", 120) ?? null;
    const before = serializeAccount(current);
    const now = nowIso();
    const d1 = getD1();
    await d1.batch([
      d1.prepare(
        `UPDATE accounts
         SET name = ?, type = ?, institution = ?, mask = ?, color = ?,
             liability = ?, updated_at = ?
         WHERE workspace_id = ? AND id = ? AND active = 1`,
      )
      .bind(
        account.name,
        account.type,
        account.institution,
        account.mask,
        account.color,
        account.liability ? 1 : 0,
        now,
        workspaceId,
        id,
      ),
      auditStatement(d1, {
        workspaceId,
        action: "account.update",
        entityType: "account",
        entityId: id,
        requestId,
        before,
        after: { ...before, ...account, openingBalance: before.openingBalance },
        createdAt: now,
      }),
    ]);
    return Response.json({ account: serializeAccount((await getAccountRow(workspaceId, id))!) });
  } catch (error) {
    return routeError(error);
  }
}

export async function DELETE(request: Request, context: Context) {
  try {
    const payload = await readOptionalJsonObject(request);
    const workspaceId = resolveWorkspaceId(request, payload);
    await requireWorkspace(workspaceId);
    const requestId = optionalString(payload, "requestId", 120) ?? null;
    const id = await routeId(context);
    const current = await getAccountRow(workspaceId, id);
    if (!current) throw new ApiError(404, "NOT_FOUND", "Akun tidak ditemukan.");
    const references = await getD1()
      .prepare(
        `SELECT
           (SELECT COUNT(*) FROM transactions
            WHERE workspace_id = ? AND deleted_at IS NULL
              AND (account_id = ? OR destination_account_id = ?)) AS transactionCount,
           (SELECT COUNT(*) FROM bills
            WHERE workspace_id = ? AND account_id = ?) AS billCount`,
      )
      .bind(workspaceId, id, id, workspaceId, id)
      .first<{ transactionCount: number; billCount: number }>();
    if ((references?.transactionCount ?? 0) > 0 || (references?.billCount ?? 0) > 0) {
      throw new ApiError(
        409,
        "ACCOUNT_IN_USE",
        "Akun masih dipakai oleh transaksi atau tagihan. Arsipkan catatan terkait terlebih dahulu.",
      );
    }
    const before = serializeAccount(current);
    const now = nowIso();
    const d1 = getD1();
    await d1.batch([
      d1
        .prepare(`UPDATE accounts SET active = 0, updated_at = ? WHERE workspace_id = ? AND id = ?`)
        .bind(now, workspaceId, id),
      auditStatement(d1, {
        workspaceId,
        action: "account.archive",
        entityType: "account",
        entityId: id,
        requestId,
        before,
        after: { ...before, active: false },
        createdAt: now,
      }),
    ]);
    return Response.json({ deleted: true, id });
  } catch (error) {
    return routeError(error);
  }
}
