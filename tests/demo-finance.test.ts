import assert from "node:assert/strict";
import test from "node:test";
import { demoRequest, financeDemoWhatsAppUrl, isFinanceDemoMode } from "../lib/demo-finance";

function installDemoWindow(whatsappUrl = "https://wa.me/628123456789") {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      __FINANCE_DEMO__: true,
      __FINANCE_DEMO_WHATSAPP_URL__: whatsappUrl,
      location: { search: "?demo=1" },
    },
  });
}

test("mode demo membuka Premium dan memakai data contoh read-only", () => {
  installDemoWindow();
  assert.equal(isFinanceDemoMode(), true);
  assert.equal(financeDemoWhatsAppUrl(), "https://wa.me/628123456789");
  const snapshot = demoRequest<any>("bootstrap", { month: "2026-07" });
  assert.equal(snapshot.configured, true);
  assert.equal(snapshot.entitlement.tier, "premium");
  assert.equal(snapshot.entitlement.capabilities.investments, true);
  assert.ok(snapshot.accounts.length >= 4);
  assert.ok(snapshot.transactions.length >= 10);
  assert.ok(snapshot.goals.length >= 2);
});

test("query demo tidak dapat mengaktifkan mode pada build pelanggan", () => {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { __FINANCE_DEMO__: false, location: { search: "?demo=1" } },
  });
  assert.equal(isFinanceDemoMode(), false);
});

test("setiap mutasi demo ditolak tanpa mengubah fixture", () => {
  installDemoWindow();
  const before = demoRequest<any>("bootstrap", { month: "2026-07" });
  const actions = [
    "setupWorkspace", "createGoal", "updateTransaction", "deleteBill", "importAccounts",
    "askAi", "ocrReceipt", "createBackup", "previewMigration", "updateNotificationSettings",
  ];
  for (const action of actions) {
    assert.throws(() => demoRequest(action, {}), /Mode demo hanya-baca/);
  }
  const after = demoRequest<any>("bootstrap", { month: "2026-07" });
  assert.equal(JSON.stringify(after), JSON.stringify(before));
});

test("CTA demo hanya menerima host WhatsApp HTTPS", () => {
  installDemoWindow("https://example.com/beli");
  assert.equal(financeDemoWhatsAppUrl(), null);
  installDemoWindow("javascript:alert(1)");
  assert.equal(financeDemoWhatsAppUrl(), null);
});
