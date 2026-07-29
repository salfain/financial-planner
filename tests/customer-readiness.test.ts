import assert from "node:assert/strict";
import test from "node:test";
import { customerReadiness } from "../lib/customer-readiness";
import { freeEntitlement } from "../lib/plans";

test("onboarding pelanggan selesai ketika instalasi, akun, transaksi, dan paket valid", () => {
  const result = customerReadiness({
    configured: true,
    schemaCurrent: true,
    accountCount: 2,
    transactionCount: 4,
    entitlement: freeEntitlement("inst-test"),
  });
  assert.equal(result.ready, true);
  assert.equal(result.percent, 100);
});

test("diagnostik kesiapan menunjukkan langkah yang masih kurang", () => {
  const result = customerReadiness({
    configured: true,
    schemaCurrent: false,
    accountCount: 1,
    transactionCount: 0,
    entitlement: { ...freeEntitlement("inst-test"), status: "invalid" },
  });
  assert.equal(result.ready, false);
  assert.deepEqual(result.steps.filter((step) => !step.done).map((step) => step.key), ["schema", "transaction", "license"]);
});
