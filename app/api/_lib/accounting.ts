import { getD1 } from "@/db";
import { ApiError, nowIso } from "./api";
import type { TransactionInput } from "./domain";

type BalanceAccount = {
  id: string;
  balance: number;
  liability: number;
};

function uniqueAccountIds(transactions: TransactionInput[]): string[] {
  const ids = new Set<string>();
  for (const transaction of transactions) {
    ids.add(transaction.accountId);
    if (transaction.destinationAccountId) ids.add(transaction.destinationAccountId);
  }
  return [...ids];
}

export async function loadBalanceAccounts(
  workspaceId: string,
  transactions: TransactionInput[],
): Promise<Map<string, BalanceAccount>> {
  const ids = uniqueAccountIds(transactions);
  const d1 = getD1();
  const results = await d1.batch(
    ids.map((id) =>
      d1
        .prepare(
          `SELECT id, balance, liability
           FROM accounts WHERE workspace_id = ? AND id = ? AND active = 1 LIMIT 1`,
        )
        .bind(workspaceId, id),
    ),
  );
  const accounts = new Map<string, BalanceAccount>();
  results.forEach((result: D1Result) => {
    const account = result.results[0] as BalanceAccount | undefined;
    if (account) accounts.set(account.id, account);
  });
  for (const id of ids) {
    if (!accounts.has(id)) {
      throw new ApiError(400, "ACCOUNT_NOT_FOUND", `Akun ${id} tidak ditemukan atau sudah diarsipkan.`, {
        accountId: id,
      });
    }
  }
  return accounts;
}

export function transactionDeltas(
  transaction: TransactionInput,
  accounts: Map<string, BalanceAccount>,
): Map<string, number> {
  const deltas = new Map<string, number>();
  if (transaction.status !== "completed") return deltas;
  const source = accounts.get(transaction.accountId)!;

  if (transaction.type === "income") {
    deltas.set(source.id, transaction.amount);
  } else if (transaction.type === "expense") {
    deltas.set(source.id, source.liability ? transaction.amount : -transaction.amount);
  } else if (transaction.type === "refund") {
    deltas.set(source.id, source.liability ? -transaction.amount : transaction.amount);
  } else {
    const destination = accounts.get(transaction.destinationAccountId!)!;
    deltas.set(source.id, source.liability ? transaction.amount : -transaction.amount);
    deltas.set(
      destination.id,
      (deltas.get(destination.id) ?? 0) +
        (destination.liability ? -transaction.amount : transaction.amount),
    );
  }
  return deltas;
}

export function netDeltas(
  accounts: Map<string, BalanceAccount>,
  previous: TransactionInput | null,
  next: TransactionInput | null,
): Map<string, number> {
  const result = new Map<string, number>();
  if (previous) {
    for (const [id, delta] of transactionDeltas(previous, accounts)) {
      result.set(id, (result.get(id) ?? 0) - delta);
    }
  }
  if (next) {
    for (const [id, delta] of transactionDeltas(next, accounts)) {
      result.set(id, (result.get(id) ?? 0) + delta);
    }
  }
  for (const [id, delta] of [...result]) {
    if (delta === 0) result.delete(id);
  }
  return result;
}

export function validateDeltas(
  accounts: Map<string, BalanceAccount>,
  deltas: Map<string, number>,
) {
  for (const [id, delta] of deltas) {
    const account = accounts.get(id)!;
    const nextBalance = account.balance + delta;
    if (!Number.isSafeInteger(nextBalance) || nextBalance < 0) {
      throw new ApiError(
        409,
        "INSUFFICIENT_BALANCE",
        `Saldo akun ${id} tidak cukup untuk transaksi ini.`,
        { accountId: id, available: account.balance, delta },
      );
    }
  }
}

export function balanceUpdateStatements(
  workspaceId: string,
  deltas: Map<string, number>,
): D1PreparedStatement[] {
  const d1 = getD1();
  const now = nowIso();
  return [...deltas].map(([id, delta]) =>
    d1
      .prepare(
        `UPDATE accounts
         SET balance = balance + ?, updated_at = ?
         WHERE workspace_id = ? AND id = ? AND active = 1`,
      )
      .bind(delta, now, workspaceId, id),
  );
}
