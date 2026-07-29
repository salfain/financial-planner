import type { PlanEntitlement } from "./plans";

export type CustomerReadinessInput = {
  configured: boolean;
  schemaCurrent: boolean;
  accountCount: number;
  transactionCount: number;
  entitlement: PlanEntitlement;
};

export function customerReadiness(input: CustomerReadinessInput) {
  const steps = [
    { key: "workspace", label: "Workspace siap", detail: "Profil dan penyimpanan utama sudah terhubung.", done: input.configured },
    { key: "schema", label: "Struktur data terbaru", detail: "Versi aplikasi dan penyimpanan sudah cocok.", done: input.schemaCurrent },
    { key: "account", label: "Akun pertama tersedia", detail: "Saldo dan transaksi mempunyai sumber yang jelas.", done: input.accountCount > 0 },
    { key: "transaction", label: "Transaksi pertama tercatat", detail: "Dashboard sudah memakai data finansial nyata.", done: input.transactionCount > 0 },
    { key: "license", label: "Status paket valid", detail: input.entitlement.tier === "free" ? "Paket Free aktif; upgrade dapat dilakukan kapan saja." : `Paket ${input.entitlement.label} aktif.`, done: input.entitlement.status === "free" || input.entitlement.status === "active" },
  ];
  const completed = steps.filter((step) => step.done).length;
  return { steps, completed, total: steps.length, percent: Math.round(completed / steps.length * 100), ready: completed === steps.length };
}
