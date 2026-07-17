import { getD1 } from "@/db";
import { ApiError } from "./api";

type WorkspaceRow = {
  id: string;
  name: string;
  storeName: string;
  currency: string;
  timezone: string;
  configured: number;
  configuredAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type AccountRow = {
  id: string;
  name: string;
  type: string;
  institution: string;
  balance: number;
  mask: string;
  color: string;
  liability: number;
};

type TransactionRow = {
  id: string;
  type: string;
  date: string;
  title: string;
  merchant: string | null;
  category: string;
  accountId: string;
  destinationAccountId: string | null;
  amount: number;
  status: string;
  idempotencyKey?: string;
};

type BudgetRow = {
  id: string;
  category: string;
  amountLimit: number;
  period: string;
  color: string;
};

type GoalRow = {
  id: string;
  name: string;
  target: number;
  current: number;
  deadline: string;
  color: string;
  icon: string;
};

type BillRow = {
  id: string;
  name: string;
  amount: number;
  dueDate: string;
  category: string;
  accountId: string;
  paid: number;
  lastPaidPeriod: string | null;
};

export const accountSelect = `
  SELECT id, name, type, institution, balance, mask, color, liability
  FROM accounts
`;
export const transactionSelect = `
  SELECT id, type, date, title, merchant, category, account_id AS accountId,
         destination_account_id AS destinationAccountId, amount, status,
         idempotency_key AS idempotencyKey
  FROM transactions
`;
export const budgetSelect = `
  SELECT id, category, amount_limit AS amountLimit, period, color
  FROM budgets
`;
export const goalSelect = `
  SELECT id, name, target, current, deadline, color, icon
  FROM goals
`;
export const billSelect = `
  SELECT id, name, amount, due_date AS dueDate, category, account_id AS accountId, paid,
         last_paid_period AS lastPaidPeriod
  FROM bills
`;

export function serializeWorkspace(row: WorkspaceRow | null, workspaceId: string) {
  if (!row) {
    return {
      id: workspaceId,
      name: "Vinn",
      storeName: "VINN STORE",
      currency: "IDR",
      timezone: "Asia/Jakarta",
      configured: false,
      configuredAt: null,
      createdAt: null,
      updatedAt: null,
    };
  }
  return { ...row, configured: Boolean(row.configured) };
}

export const serializeAccount = (row: AccountRow) => ({
  ...row,
  liability: Boolean(row.liability),
});
export const serializeTransaction = (row: TransactionRow) => {
  return {
    id: row.id,
    type: row.type,
    date: row.date,
    title: row.title,
    merchant: row.merchant,
    category: row.category,
    accountId: row.accountId,
    destinationAccountId: row.destinationAccountId,
    amount: row.amount,
    status: row.status,
  };
};
export const serializeBudget = (row: BudgetRow) => ({
  id: row.id,
  category: row.category,
  limit: row.amountLimit,
  period: row.period,
  color: row.color,
});
export const serializeGoal = (row: GoalRow) => row;
export const serializeBill = (row: BillRow, period?: string) => ({
  id: row.id,
  name: row.name,
  amount: row.amount,
  dueDate: row.dueDate,
  category: row.category,
  accountId: row.accountId,
  paid: period ? row.lastPaidPeriod === period : Boolean(row.paid),
  lastPaidPeriod: row.lastPaidPeriod,
});

export async function getWorkspace(workspaceId: string): Promise<WorkspaceRow | null> {
  return getD1()
    .prepare(
      `SELECT id, profile_name AS name, store_name AS storeName, currency, timezone, configured,
              configured_at AS configuredAt, created_at AS createdAt, updated_at AS updatedAt
       FROM workspaces WHERE id = ? LIMIT 1`,
    )
    .bind(workspaceId)
    .first<WorkspaceRow>();
}

export async function requireWorkspace(workspaceId: string): Promise<WorkspaceRow> {
  const workspace = await getWorkspace(workspaceId);
  if (!workspace || !workspace.configured) {
    throw new ApiError(
      409,
      "WORKSPACE_NOT_CONFIGURED",
      "Selesaikan setup VINN STORE sebelum menyimpan data.",
    );
  }
  return workspace;
}

export async function getBootstrap(workspaceId: string, period?: string) {
  const d1 = getD1();
  const budgetsStatement = period
    ? d1
        .prepare(`${budgetSelect} WHERE workspace_id = ? AND period = ? ORDER BY category, id`)
        .bind(workspaceId, period)
    : d1
        .prepare(`${budgetSelect} WHERE workspace_id = ? ORDER BY period DESC, category, id`)
        .bind(workspaceId);
  const results = await d1.batch([
    d1
      .prepare(
        `SELECT id, profile_name AS name, store_name AS storeName, currency, timezone, configured,
                configured_at AS configuredAt, created_at AS createdAt, updated_at AS updatedAt
         FROM workspaces WHERE id = ? LIMIT 1`,
      )
      .bind(workspaceId),
    d1.prepare(`${accountSelect} WHERE workspace_id = ? AND active = 1 ORDER BY created_at, id`).bind(workspaceId),
    d1
      .prepare(
        `${transactionSelect} WHERE workspace_id = ? AND deleted_at IS NULL ORDER BY date DESC, created_at DESC, id DESC`,
      )
      .bind(workspaceId),
    budgetsStatement,
    d1.prepare(`${goalSelect} WHERE workspace_id = ? ORDER BY deadline, created_at, id`).bind(workspaceId),
    d1.prepare(`${billSelect} WHERE workspace_id = ? ORDER BY due_date, created_at, id`).bind(workspaceId),
  ]);

  const workspace = (results[0].results[0] as WorkspaceRow | undefined) ?? null;
  return {
    configured: Boolean(workspace?.configured),
    profile: serializeWorkspace(workspace, workspaceId),
    accounts: (results[1].results as AccountRow[]).map(serializeAccount),
    transactions: (results[2].results as TransactionRow[]).map(serializeTransaction),
    budgets: (results[3].results as BudgetRow[]).map(serializeBudget),
    goals: (results[4].results as GoalRow[]).map(serializeGoal),
    bills: (results[5].results as BillRow[]).map((bill) => serializeBill(bill, period)),
  };
}

export async function getAccountRow(
  workspaceId: string,
  id: string,
): Promise<AccountRow | null> {
  return getD1()
    .prepare(`${accountSelect} WHERE workspace_id = ? AND id = ? AND active = 1 LIMIT 1`)
    .bind(workspaceId, id)
    .first<AccountRow>();
}

export async function getTransactionRow(
  workspaceId: string,
  id: string,
): Promise<TransactionRow | null> {
  return getD1()
    .prepare(`${transactionSelect} WHERE workspace_id = ? AND id = ? AND deleted_at IS NULL LIMIT 1`)
    .bind(workspaceId, id)
    .first<TransactionRow>();
}

export async function getBudgetRow(workspaceId: string, id: string): Promise<BudgetRow | null> {
  return getD1()
    .prepare(`${budgetSelect} WHERE workspace_id = ? AND id = ? LIMIT 1`)
    .bind(workspaceId, id)
    .first<BudgetRow>();
}

export async function getGoalRow(workspaceId: string, id: string): Promise<GoalRow | null> {
  return getD1()
    .prepare(`${goalSelect} WHERE workspace_id = ? AND id = ? LIMIT 1`)
    .bind(workspaceId, id)
    .first<GoalRow>();
}

export async function getBillRow(workspaceId: string, id: string): Promise<BillRow | null> {
  return getD1()
    .prepare(`${billSelect} WHERE workspace_id = ? AND id = ? LIMIT 1`)
    .bind(workspaceId, id)
    .first<BillRow>();
}
