export type InstallmentPhase = {
  label: string;
  durationMonths: number;
  amount: number;
};

type InstallmentPlan = {
  amount: number;
  paidCount?: number;
  installmentPhases?: InstallmentPhase[];
};

export function normalizeInstallmentPhases(value: unknown): InstallmentPhase[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((phase, index) => {
      if (!phase || typeof phase !== "object" || Array.isArray(phase)) return null;
      const row = phase as Record<string, unknown>;
      const durationMonths = Number(row.durationMonths ?? row.duration_months);
      const amount = Number(row.amount);
      if (!Number.isSafeInteger(durationMonths) || durationMonths < 1 || durationMonths > 120) return null;
      if (!Number.isSafeInteger(amount) || amount <= 0) return null;
      return {
        label: String(row.label || `Fase ${index + 1}`).trim().slice(0, 60) || `Fase ${index + 1}`,
        durationMonths,
        amount,
      };
    })
    .filter((phase): phase is InstallmentPhase => Boolean(phase));
}

export function installmentDuration(phases: InstallmentPhase[]) {
  return phases.reduce((sum, phase) => sum + phase.durationMonths, 0);
}

export function installmentPlanTotal(phases: InstallmentPhase[]) {
  return phases.reduce((sum, phase) => sum + phase.durationMonths * phase.amount, 0);
}

export function installmentPhaseAt(phases: InstallmentPhase[], installmentIndex: number) {
  if (!phases.length) return null;
  let cursor = Math.max(0, Math.floor(installmentIndex));
  for (let index = 0; index < phases.length; index += 1) {
    const phase = phases[index];
    if (cursor < phase.durationMonths) {
      return { phase, phaseIndex: index, monthInPhase: cursor + 1 };
    }
    cursor -= phase.durationMonths;
  }
  const phaseIndex = phases.length - 1;
  const phase = phases[phaseIndex];
  return { phase, phaseIndex, monthInPhase: phase.durationMonths };
}

export function installmentAmountAt(plan: InstallmentPlan, occurrenceOffset = 0) {
  const phases = plan.installmentPhases ?? [];
  if (!phases.length) return plan.amount;
  return installmentPhaseAt(phases, (plan.paidCount ?? 0) + occurrenceOffset)?.phase.amount ?? plan.amount;
}

export function currentInstallmentPhase(plan: InstallmentPlan) {
  return installmentPhaseAt(plan.installmentPhases ?? [], plan.paidCount ?? 0);
}
