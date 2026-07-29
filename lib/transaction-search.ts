import type { Account, Transaction } from "./finance";

export type TransactionSearchFilters = {
  query?: string;
  type?: string;
  category?: string;
  accountId?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
};

const searchableText = (value: unknown) => String(value ?? "").trim().toLocaleLowerCase("id-ID");

export function searchTransactions(
  transactions: Transaction[],
  accounts: Account[],
  filters: TransactionSearchFilters = {},
) {
  const query = searchableText(filters.query);
  const accountNames = new Map(accounts.map((account) => [account.id, account.name]));

  return transactions
    .filter((transaction) => {
      const typeMatch = !filters.type || filters.type === "all"
        || transaction.type === filters.type
        || (filters.type === "adjustment" && ["adjustment_in", "adjustment_out"].includes(transaction.type));
      const categoryMatch = !filters.category
        || transaction.category === filters.category
        || transaction.splits?.some((split) => split.category === filters.category);
      if (!typeMatch || !categoryMatch) return false;
      if (filters.accountId && transaction.accountId !== filters.accountId) return false;
      if (filters.status && transaction.status !== filters.status) return false;
      if (filters.dateFrom && transaction.date < filters.dateFrom) return false;
      if (filters.dateTo && transaction.date > filters.dateTo) return false;
      if (!query) return true;

      const searchIndex = [
        transaction.title,
        transaction.merchant,
        transaction.category,
        transaction.notes,
        transaction.location,
        transaction.tags?.join(" "),
        transaction.splits?.map((split) => `${split.category} ${split.note ?? ""}`).join(" "),
        accountNames.get(transaction.accountId),
      ].map(searchableText).join(" ");
      return searchIndex.includes(query);
    })
    .sort((left, right) => `${right.date} ${right.time ?? ""}`.localeCompare(`${left.date} ${left.time ?? ""}`));
}
