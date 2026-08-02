import assert from "node:assert/strict";
import test from "node:test";
import { loadFinanceSnapshot } from "../lib/finance-client";

function installDemoWindow() {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      __FINANCE_DEMO__: true,
      __FINANCE_DEMO_WHATSAPP_URL__: "https://wa.me/628123456789",
      location: { search: "?demo=1" },
      setTimeout: (handler: () => void, timeout?: number) => setTimeout(handler, timeout),
      clearTimeout: (id: ReturnType<typeof setTimeout>) => clearTimeout(id),
    },
  });
}

test("snapshot mode demo dimuat tanpa menunggu nilai non-Promise", async () => {
  installDemoWindow();
  const snapshot = await loadFinanceSnapshot("2026-07");
  assert.equal(snapshot.configured, true);
  assert.ok(snapshot.accounts.length >= 4);
  assert.ok(snapshot.transactions.length >= 10);
});
