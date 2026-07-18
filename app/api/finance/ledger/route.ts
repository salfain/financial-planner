import { getD1 } from "@/db";
import { calculateLedgerHealth, type LedgerAccountSource, type LedgerHealthReport, type LedgerTransactionSource } from "@/lib/ledger";
import { getAuditByRequest } from "../../_lib/audit";
import { ApiError, makeId, nowIso, readJsonObject, requiredString, resolveWorkspaceId, routeError } from "../../_lib/api";
import { requireWorkspace } from "../../_lib/repository";

type LedgerAccountRow = {
  id: string;
  name: string;
  openingBalance: number;
  storedBalance: number;
  liability: number;
  active: number;
  updatedAt: string;
};

type LedgerTransactionRow = {
  id: string;
  type: string;
  amount: number;
  status: string;
  accountId: string;
  destinationAccountId: string | null;
  deletedAt: string | null;
  updatedAt: string;
};

async function revisionFor(accounts: LedgerAccountRow[], transactions: LedgerTransactionRow[]) {
  const payload = JSON.stringify({
    accounts: accounts.map((row) => [row.id, row.openingBalance, row.storedBalance, row.liability, row.active, row.updatedAt]),
    transactions: transactions.map((row) => [row.id, row.type, row.amount, row.status, row.accountId, row.destinationAccountId, row.deletedAt, row.updatedAt]),
  });
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(payload));
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

async function ledgerReport(workspaceId: string): Promise<LedgerHealthReport> {
  const d1 = getD1();
  const [accountResult, transactionResult] = await Promise.all([
    d1.prepare(
      `SELECT id, name, opening_balance AS openingBalance, balance AS storedBalance,
              liability, active, updated_at AS updatedAt
       FROM accounts WHERE workspace_id = ? ORDER BY created_at, id`,
    ).bind(workspaceId).all<LedgerAccountRow>(),
    d1.prepare(
      `SELECT id, type, amount, status, account_id AS accountId,
              destination_account_id AS destinationAccountId,
              deleted_at AS deletedAt, updated_at AS updatedAt
       FROM transactions WHERE workspace_id = ? ORDER BY created_at, id`,
    ).bind(workspaceId).all<LedgerTransactionRow>(),
  ]);
  const accountRows = accountResult.results;
  const transactionRows = transactionResult.results;
  const accounts: LedgerAccountSource[] = accountRows.map((row) => ({
    id: row.id,
    name: row.name,
    openingBalance: Number(row.openingBalance),
    storedBalance: Number(row.storedBalance),
    liability: Boolean(row.liability),
    active: Boolean(row.active),
    updatedAt: row.updatedAt,
  }));
  const transactions: LedgerTransactionSource[] = transactionRows.map((row) => ({
    id: row.id,
    type: row.type,
    amount: Number(row.amount),
    status: row.status,
    accountId: row.accountId,
    destinationAccountId: row.destinationAccountId,
    deletedAt: row.deletedAt,
    updatedAt: row.updatedAt,
  }));
  return {
    ...calculateLedgerHealth(accounts, transactions, "cached"),
    revision: await revisionFor(accountRows, transactionRows),
    checkedAt: nowIso(),
  };
}

function repairUpdateStatement(workspaceId: string, report: LedgerHealthReport, updatedAt: string) {
  const changes = report.accounts.filter((account) => account.valid && account.difference !== 0);
  const d1 = getD1();
  const cases = changes.map(() => "WHEN ? THEN ?").join(" ");
  const ids = changes.map(() => "?").join(", ");
  const staleGuards = changes.map(() => "(stale.id = ? AND (stale.balance <> ? OR stale.updated_at <> ?))").join(" OR ");
  return d1.prepare(
    `UPDATE accounts
     SET balance = CASE id ${cases} ELSE balance END, updated_at = ?
     WHERE workspace_id = ? AND id IN (${ids})
       AND (SELECT COUNT(*) FROM accounts present WHERE present.workspace_id = ? AND present.id IN (${ids})) = ?
       AND NOT EXISTS (
         SELECT 1 FROM accounts stale
         WHERE stale.workspace_id = ? AND (${staleGuards})
       )`,
  ).bind(
    ...changes.flatMap((account) => [account.id, account.expectedBalance]),
    updatedAt,
    workspaceId,
    ...changes.map((account) => account.id),
    workspaceId,
    ...changes.map((account) => account.id),
    changes.length,
    workspaceId,
    ...changes.flatMap((account) => [account.id, account.storedBalance, account.updatedAt ?? ""]),
  );
}

function repairAuditStatement(workspaceId: string, report: LedgerHealthReport, requestId: string, createdAt: string) {
  const changes = report.accounts.filter((account) => account.valid && account.difference !== 0);
  const expectedRows = changes.map(() => "(id = ? AND balance = ?)").join(" OR ");
  const before = changes.map((account) => ({ id: account.id, name: account.name, balance: account.storedBalance }));
  const after = changes.map((account) => ({ id: account.id, name: account.name, balance: account.expectedBalance }));
  const details = {
    revision: report.revision,
    repairedAccounts: changes.length,
    totalAbsoluteDifference: report.summary.totalAbsoluteDifference,
  };
  return getD1().prepare(
    `INSERT INTO audit_logs
       (id, workspace_id, action, entity_type, entity_id, actor, request_id,
        before_json, after_json, details, created_at)
     SELECT ?, ?, 'ledger.repair', 'ledger', ?, 'system', ?, ?, ?, ?, ?
     WHERE (SELECT COUNT(*) FROM accounts WHERE workspace_id = ? AND (${expectedRows})) = ?
       AND NOT EXISTS (
         SELECT 1 FROM audit_logs WHERE workspace_id = ? AND request_id = ? AND action = 'ledger.repair'
       )`,
  ).bind(
    makeId("audit"), workspaceId, workspaceId, requestId,
    JSON.stringify(before), JSON.stringify(after), JSON.stringify(details), createdAt,
    workspaceId, ...changes.flatMap((account) => [account.id, account.expectedBalance]), changes.length,
    workspaceId, requestId,
  );
}

export async function GET(request: Request) {
  try {
    const workspaceId = resolveWorkspaceId(request);
    await requireWorkspace(workspaceId);
    return Response.json(await ledgerReport(workspaceId));
  } catch (error) {
    return routeError(error);
  }
}

export async function POST(request: Request) {
  try {
    const payload = await readJsonObject(request);
    const workspaceId = resolveWorkspaceId(request, payload);
    await requireWorkspace(workspaceId);
    const expectedRevision = requiredString(payload, "expectedRevision", 100);
    const requestId = requiredString(payload, "requestId", 160);
    const replay = await getAuditByRequest(workspaceId, requestId, "ledger.repair");
    if (replay) {
      const details = replay.details as Record<string, unknown>;
      return Response.json({
        ...(await ledgerReport(workspaceId)),
        replayed: true,
        noChange: false,
        repairedAccounts: Number(details.repairedAccounts ?? 0),
      });
    }

    const report = await ledgerReport(workspaceId);
    if (report.revision !== expectedRevision) {
      throw new ApiError(409, "LEDGER_CHANGED", "Ledger berubah setelah preview. Periksa ulang sebelum melakukan perbaikan.");
    }
    if (report.status === "blocked") {
      throw new ApiError(409, "LEDGER_REPAIR_BLOCKED", "Ledger memiliki referensi atau saldo yang perlu diperiksa manual.", { issues: report.issues });
    }
    if (report.summary.driftCount === 0) {
      return Response.json({ ...report, replayed: false, noChange: true, repairedAccounts: 0 });
    }

    const now = nowIso();
    const d1 = getD1();
    const results = await d1.batch([
      repairUpdateStatement(workspaceId, report, now),
      repairAuditStatement(workspaceId, report, requestId, now),
    ]);
    if (Number(results[0]?.meta?.changes ?? 0) !== report.summary.driftCount || Number(results[1]?.meta?.changes ?? 0) !== 1) {
      const concurrentReplay = await getAuditByRequest(workspaceId, requestId, "ledger.repair");
      if (!concurrentReplay) {
        throw new ApiError(409, "LEDGER_CHANGED", "Saldo berubah saat perbaikan. Periksa ulang ledger sebelum mencoba lagi.");
      }
    }
    return Response.json({
      ...(await ledgerReport(workspaceId)),
      replayed: false,
      noChange: false,
      repairedAccounts: report.summary.driftCount,
    });
  } catch (error) {
    return routeError(error);
  }
}
