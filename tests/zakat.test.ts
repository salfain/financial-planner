import test from "node:test";
import assert from "node:assert/strict";
import { buildZakatReport, DEFAULT_ZAKAT_SETTINGS, HAUL_DAYS, addDays } from "../lib/zakat";
import type { Account, InvestmentAsset } from "../lib/finance";

const accounts: Account[] = [
  { id: "bank", name: "Bank", type: "Bank", institution: "", balance: 150_000_000, mask: "", color: "#000" },
  { id: "wallet", name: "E-Wallet", type: "E-Wallet", institution: "", balance: 5_000_000, mask: "", color: "#000" },
  { id: "invest", name: "Sekuritas", type: "Investment", institution: "", balance: 90_000_000, mask: "", color: "#000" },
  { id: "card", name: "Paylater", type: "Credit Card", institution: "", balance: 20_000_000, mask: "", color: "#000", liability: true },
];

const investmentAssets = [
  { id: "a1", marketValue: 90_000_000, active: true },
  { id: "a2", marketValue: 10_000_000, active: false },
] as unknown as InvestmentAsset[];

// Harga emas dipilih agar nisab 85 gram jatuh tepat di 102.000.000.
const settings = { ...DEFAULT_ZAKAT_SETTINGS, goldPricePerGram: 1_200_000, haulStartDate: "2025-08-01" };

test("basis zakat memakai kas dan investasi aktif lalu dikurangi kewajiban", () => {
  const result = buildZakatReport({ accounts, investmentAssets, settings, asOfDate: "2026-08-15" });
  assert.equal(result.cashAssets, 155_000_000);
  assert.equal(result.investmentAssets, 90_000_000);
  assert.equal(result.liabilities, 20_000_000);
  assert.equal(result.netAssets, 225_000_000);
  assert.deepEqual(result.accountIds, ["bank", "wallet"]);
});

test("akun investasi tidak dihitung dua kali lewat saldo akun", () => {
  const result = buildZakatReport({ accounts, investmentAssets, settings, asOfDate: "2026-08-15" });
  // Saldo akun "invest" 90 juta diabaikan; yang dipakai nilai pasar aset investasi.
  assert.equal(result.zakatableAssets, 245_000_000);
});

test("zakat 2,5 persen terutang setelah nisab dan haul terpenuhi", () => {
  const result = buildZakatReport({ accounts, investmentAssets, settings, asOfDate: "2026-08-15" });
  assert.equal(result.nisabAmount, 102_000_000);
  assert.equal(result.reachesNisab, true);
  assert.equal(result.haulComplete, true);
  assert.equal(result.status, "wajib");
  assert.equal(result.zakatDue, 5_625_000);
});

test("haul yang belum genap menunda kewajiban meski nisab tercapai", () => {
  const haulStartDate = "2026-08-01";
  const result = buildZakatReport({
    accounts,
    investmentAssets,
    settings: { ...settings, haulStartDate },
    asOfDate: "2026-08-15",
  });
  assert.equal(result.reachesNisab, true);
  assert.equal(result.status, "menunggu_haul");
  assert.equal(result.zakatDue, 0);
  assert.equal(result.haulDaysElapsed, 14);
  assert.equal(result.haulDaysRemaining, HAUL_DAYS - 14);
  assert.equal(result.haulCompleteDate, addDays(haulStartDate, HAUL_DAYS));
});

test("harta di bawah nisab tidak menghasilkan kewajiban", () => {
  const result = buildZakatReport({
    accounts: [{ id: "bank", name: "Bank", type: "Bank", institution: "", balance: 10_000_000, mask: "", color: "#000" }],
    investmentAssets: [],
    settings,
    asOfDate: "2026-08-15",
  });
  assert.equal(result.status, "belum_nisab");
  assert.equal(result.zakatDue, 0);
  assert.equal(result.shortfallToNisab, 92_000_000);
});

test("harga emas belum diisi ditandai belum diatur, bukan belum nisab", () => {
  const result = buildZakatReport({ accounts, investmentAssets, settings: DEFAULT_ZAKAT_SETTINGS, asOfDate: "2026-08-15" });
  assert.equal(result.status, "belum_diatur");
  assert.equal(result.nisabAmount, 0);
  assert.equal(result.zakatDue, 0);
});

test("investasi dapat dikeluarkan dan akun tertentu dikecualikan", () => {
  const result = buildZakatReport({
    accounts,
    investmentAssets,
    settings: { ...settings, includeInvestments: false, excludedAccountIds: ["wallet"] },
    asOfDate: "2026-08-15",
  });
  assert.equal(result.investmentAssets, 0);
  assert.equal(result.cashAssets, 150_000_000);
  assert.equal(result.netAssets, 130_000_000);
  assert.equal(result.zakatDue, 3_250_000);
});

test("kewajiban melebihi harta tidak menghasilkan basis negatif", () => {
  const result = buildZakatReport({
    accounts: [
      { id: "bank", name: "Bank", type: "Bank", institution: "", balance: 1_000_000, mask: "", color: "#000" },
      { id: "card", name: "Kartu", type: "Credit Card", institution: "", balance: 9_000_000, mask: "", color: "#000", liability: true },
    ],
    investmentAssets: [],
    settings,
    asOfDate: "2026-08-15",
  });
  assert.equal(result.netAssets, 0);
  assert.equal(result.zakatDue, 0);
});
