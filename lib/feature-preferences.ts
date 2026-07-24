export const OPTIONAL_FEATURE_KEYS = [
  "budgets",
  "goals",
  "funds",
  "roadmap",
  "forecast",
  "emergency",
  "bills",
  "calendar",
  "recurring",
  "debts",
  "investments",
  "review",
  "reports",
  "assistant",
] as const;

export type OptionalFeatureKey = typeof OPTIONAL_FEATURE_KEYS[number];
export type FeaturePreferences = Record<OptionalFeatureKey, boolean>;

export const DEFAULT_FEATURE_PREFERENCES = Object.freeze(
  Object.fromEntries(OPTIONAL_FEATURE_KEYS.map((key) => [key, true])) as FeaturePreferences,
);

export const normalizeFeaturePreferences = (value: unknown): FeaturePreferences => {
  let source: Record<string, unknown> = {};
  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) source = parsed as Record<string, unknown>;
    } catch {
      source = {};
    }
  } else if (value && typeof value === "object" && !Array.isArray(value)) {
    source = value as Record<string, unknown>;
  }
  return Object.fromEntries(
    OPTIONAL_FEATURE_KEYS.map((key) => [key, source[key] === undefined ? true : source[key] === true]),
  ) as FeaturePreferences;
};

export const isOptionalFeatureEnabled = (
  preferences: FeaturePreferences,
  key: string,
) => !OPTIONAL_FEATURE_KEYS.includes(key as OptionalFeatureKey) || preferences[key as OptionalFeatureKey];
