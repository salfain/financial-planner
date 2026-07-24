import assert from "node:assert/strict";
import test from "node:test";
import {
  currentInstallmentPhase,
  installmentAmountAt,
  installmentDuration,
  installmentPlanTotal,
  normalizeInstallmentPhases,
} from "../lib/installment-phases";

const phases = [
  { label: "6 bulan bunga 0%", durationMonths: 6, amount: 450_000 },
  { label: "6 bulan dengan bunga", durationMonths: 6, amount: 567_520 },
];

test("skema bertahap berpindah nominal setelah fase pertama selesai", () => {
  assert.equal(installmentAmountAt({ amount: 450_000, paidCount: 0, installmentPhases: phases }), 450_000);
  assert.equal(installmentAmountAt({ amount: 450_000, paidCount: 5, installmentPhases: phases }), 450_000);
  assert.equal(installmentAmountAt({ amount: 450_000, paidCount: 6, installmentPhases: phases }), 567_520);
  assert.equal(currentInstallmentPhase({ amount: 450_000, paidCount: 7, installmentPhases: phases })?.monthInPhase, 2);
});

test("ringkasan skema menghitung tenor dan total seluruh cicilan", () => {
  assert.equal(installmentDuration(phases), 12);
  assert.equal(installmentPlanTotal(phases), 6_105_120);
});

test("normalisasi menolak fase yang rusak", () => {
  assert.deepEqual(normalizeInstallmentPhases([{ label: "Valid", durationMonths: 3, amount: 100_000 }, { label: "Rusak", durationMonths: 0, amount: 0 }]), [
    { label: "Valid", durationMonths: 3, amount: 100_000 },
  ]);
});
