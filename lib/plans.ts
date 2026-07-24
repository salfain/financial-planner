export const PLAN_TIERS = ["free", "pro", "premium"] as const;
export type PlanTier = (typeof PLAN_TIERS)[number];

export const PLAN_CAPABILITIES = [
  "advanced_transactions",
  "imports",
  "attachments",
  "planning",
  "recurring",
  "pdf_reports",
  "scheduled_backup",
  "investments",
  "ai",
  "ocr",
] as const;
export type PlanCapability = (typeof PLAN_CAPABILITIES)[number];

export const PLAN_LABELS: Record<PlanTier, string> = {
  free: "Free",
  pro: "Pro",
  premium: "Premium",
};

export const CAPABILITY_MINIMUM_TIER: Record<PlanCapability, PlanTier> = {
  advanced_transactions: "pro",
  imports: "pro",
  attachments: "pro",
  planning: "pro",
  recurring: "pro",
  pdf_reports: "pro",
  scheduled_backup: "pro",
  investments: "premium",
  ai: "premium",
  ocr: "premium",
};

const TIER_RANK: Record<PlanTier, number> = { free: 0, pro: 1, premium: 2 };

export function isPlanTier(value: unknown): value is PlanTier {
  return typeof value === "string" && PLAN_TIERS.includes(value as PlanTier);
}

export function planIncludes(tier: PlanTier, capability: PlanCapability): boolean {
  return TIER_RANK[tier] >= TIER_RANK[CAPABILITY_MINIMUM_TIER[capability]];
}

export function capabilityMap(tier: PlanTier): Record<PlanCapability, boolean> {
  return Object.fromEntries(
    PLAN_CAPABILITIES.map((capability) => [capability, planIncludes(tier, capability)]),
  ) as Record<PlanCapability, boolean>;
}

export type PlanEntitlement = {
  tier: PlanTier;
  label: string;
  status: "free" | "active" | "expired" | "invalid";
  capabilities: Record<PlanCapability, boolean>;
  installationId: string;
  licenseId: string | null;
  expiresAt: string | null;
};

export function freeEntitlement(
  installationId: string,
  status: PlanEntitlement["status"] = "free",
): PlanEntitlement {
  return {
    tier: "free",
    label: PLAN_LABELS.free,
    status,
    capabilities: capabilityMap("free"),
    installationId,
    licenseId: null,
    expiresAt: null,
  };
}
