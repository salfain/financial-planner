import assert from "node:assert/strict";
import test from "node:test";
import type { Account } from "../lib/finance";
import {
  allocatedByAccount,
  sinkingFundMonthlyNeed,
  sinkingFundProgress,
  sinkingFundRemaining,
  type SinkingFund,
  unallocatedCash,
} from "../lib/sinking-funds";

const fund = (overrides: Partial<SinkingFund> = {}): SinkingFund => ({
  id: "fund-1",
  name: "Pajak kendaraan",
  purpose: "Pajak",
  targetAmount: 12_000_000,
  currentAmount: 3_000_000,
  monthlyContribution: 1_000_000,
  targetDate: "2026-12-31",
  accountId: "bank",
  color: "#126b59",
  active: true,
  ...overrides,
});

const accounts: Account[] = [
  { id: "bank", name: "Rekening", type: "Bank", institution: "Bank", balance: 10_000_000, openingBalance: 10_000_000, mask: "1234", color: "#126b59" },
  { id: "cash", name: "Tunai", type: "Cash", institution: "Dompet", balance: 2_000_000, openingBalance: 2_000_000, mask: "", color: "#126b59" },
  { id: "loan", name: "Utang", type: "Loan", institution: "Bank", balance: 5_000_000, openingBalance: 5_000_000, mask: "9876", color: "#9f4439", liability: true },
];

test("pos dana menghitung progres, sisa target, dan kebutuhan per bulan", () => {
  const item = fund();
  assert.equal(sinkingFundProgress(item), 25);
  assert.equal(sinkingFundRemaining(item), 9_000_000);
  assert.equal(sinkingFundMonthlyNeed(item, new Date("2026-07-01T12:00:00")), 1_800_000);
});

test("alokasi hanya mengurangi saldo bebas dan tidak mengubah saldo akun", () => {
  const before = structuredClone(accounts);
  const funds = [
    fund(),
    fund({ id: "fund-2", name: "Liburan", purpose: "Liburan", currentAmount: 2_000_000 }),
    fund({ id: "fund-3", name: "Arsip", currentAmount: 1_000_000, active: false }),
  ];

  assert.deepEqual(allocatedByAccount(funds), { bank: 5_000_000 });
  assert.equal(unallocatedCash(accounts, funds), 7_000_000);
  assert.deepEqual(accounts, before);
});

test("progres dan sisa target dibatasi pada nilai yang aman", () => {
  const overfunded = fund({ currentAmount: 14_000_000 });
  assert.equal(sinkingFundProgress(overfunded), 100);
  assert.equal(sinkingFundRemaining(overfunded), 0);
});
