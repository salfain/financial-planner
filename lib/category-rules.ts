export type CategoryRuleMatchType = "contains" | "starts_with" | "exact";

export type CategoryRule = {
  id: string;
  keyword: string;
  category: string;
  transactionType: "expense" | "income";
  matchType: CategoryRuleMatchType;
  priority: number;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
};

const normalizeRuleText = (value: string) =>
  value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

export function categoryRuleMatches(rule: CategoryRule, description: string, transactionType: string) {
  if (!rule.active || rule.transactionType !== transactionType) return false;
  const source = normalizeRuleText(description);
  const keyword = normalizeRuleText(rule.keyword);
  if (!source || !keyword) return false;
  if (rule.matchType === "exact") return source === keyword;
  if (rule.matchType === "starts_with") return source.startsWith(keyword);
  return source.includes(keyword);
}

export function findCategoryRule(rules: CategoryRule[], description: string, transactionType: string) {
  return [...rules]
    .filter((rule) => categoryRuleMatches(rule, description, transactionType))
    .sort((a, b) => b.priority - a.priority || b.keyword.length - a.keyword.length || a.id.localeCompare(b.id))[0] ?? null;
}
