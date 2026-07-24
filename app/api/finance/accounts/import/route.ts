import { getD1 } from "@/db";
import { auditStatement } from "../../../_lib/audit";
import { ApiError, nowIso, readJsonObject, requiredString, resolveWorkspaceId, routeError } from "../../../_lib/api";
import { parseAccount, type AccountInput } from "../../../_lib/domain";
import { requireCapability } from "../../../_lib/license";
import { requireWorkspace } from "../../../_lib/repository";

export async function POST(request: Request) {
  try {
    const payload = await readJsonObject(request);
    const workspaceId = resolveWorkspaceId(request, payload);
    await requireWorkspace(workspaceId);
    await requireCapability(workspaceId, "imports");
    const requestId = requiredString(payload, "requestId", 120);
    const d1 = getD1();
    const existingAudit = await d1
      .prepare("SELECT action, details FROM audit_logs WHERE workspace_id = ? AND request_id = ? ORDER BY created_at LIMIT 1")
      .bind(workspaceId, requestId)
      .first<{ action: string; details: string }>();
    if (existingAudit) {
      if (existingAudit.action !== "account.import") {
        throw new ApiError(409, "REQUEST_ID_REUSED", "requestId sudah digunakan oleh operasi lain.");
      }
      const details = JSON.parse(existingAudit.details || "{}") as { imported?: number };
      return Response.json({ imported: Number(details.imported || 0), replayed: true });
    }
    if (!Array.isArray(payload.accounts) || payload.accounts.length < 1 || payload.accounts.length > 100) {
      throw new ApiError(400, "INVALID_IMPORT", "Impor harus berisi 1 sampai 100 akun.");
    }

    const accounts = payload.accounts.map((row, index): AccountInput => {
      if (!row || typeof row !== "object" || Array.isArray(row)) {
        throw new ApiError(400, "INVALID_IMPORT_ROW", `Baris ${index + 2} tidak valid.`);
      }
      try {
        const input = row as Record<string, unknown>;
        return parseAccount({ ...input, balance: input.openingBalance ?? input.balance ?? 0 });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Data akun tidak valid.";
        throw new ApiError(400, "INVALID_IMPORT_ROW", `Baris ${index + 2}: ${message}`);
      }
    });
    if (new Set(accounts.map((account) => account.id)).size !== accounts.length) {
      throw new ApiError(400, "DUPLICATE_IMPORT_ID", "File impor memuat ID akun yang sama lebih dari sekali.");
    }
    const normalizedNames = accounts.map((account) => account.name.toLocaleLowerCase("id-ID"));
    if (new Set(normalizedNames).size !== normalizedNames.length) {
      throw new ApiError(400, "DUPLICATE_IMPORT_NAME", "File impor memuat nama akun yang sama lebih dari sekali.");
    }
    const storedNames = await d1
      .prepare("SELECT lower(name) AS name FROM accounts WHERE workspace_id = ?")
      .bind(workspaceId)
      .all<{ name: string }>();
    const duplicateName = normalizedNames.find((name) => storedNames.results.some((row) => row.name === name));
    if (duplicateName) {
      const account = accounts[normalizedNames.indexOf(duplicateName)];
      throw new ApiError(409, "ACCOUNT_NAME_EXISTS", `Nama akun \"${account.name}\" sudah digunakan.`);
    }

    const now = nowIso();
    const statements = accounts.map((account) => d1.prepare(
      `INSERT INTO accounts
         (id, workspace_id, name, type, institution, balance, opening_balance, mask,
          color, liability, active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
    ).bind(
      account.id, workspaceId, account.name, account.type, account.institution,
      account.balance, account.balance, account.mask, account.color,
      account.liability ? 1 : 0, now, now,
    ));
    await d1.batch([
      ...statements,
      auditStatement(d1, {
        workspaceId,
        action: "account.import",
        entityType: "account_batch",
        entityId: requestId,
        requestId,
        after: accounts,
        details: { imported: accounts.length, accountIds: accounts.map((account) => account.id) },
        createdAt: now,
      }),
    ]);
    return Response.json({ imported: accounts.length, replayed: false }, { status: 201 });
  } catch (error) {
    return routeError(error);
  }
}
