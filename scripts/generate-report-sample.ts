import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { generateFinancePdf } from "../lib/report";

const outputDirectory = resolve("output/pdf");
const report = generateFinancePdf({
  period: "2026-07",
  generatedAt: "2026-07-18T03:00:00.000Z",
  profile: { name: "Vinn", storeName: "VINN STORE", currency: "IDR", timezone: "Asia/Jakarta" },
  accounts: [
    { id: "bank", name: "Bank Operasional", type: "Bank", institution: "Bank Indonesia", balance: 12_500_000, openingBalance: 10_000_000, mask: "•• 8842", color: "#16876f" },
    { id: "cash", name: "Kas", type: "Cash", institution: "", balance: 1_200_000, openingBalance: 1_500_000, mask: "", color: "#4e79c7" },
  ],
  transactions: [
    { id: "previous-income", type: "income", date: "2026-06-02", title: "Pendapatan Juni", merchant: "VINN STORE", category: "Pendapatan", accountId: "bank", amount: 4_200_000, status: "completed" },
    { id: "previous-expense", type: "expense", date: "2026-06-06", title: "Belanja Juni", merchant: "VINN Mart", category: "Makanan", accountId: "bank", amount: 1_100_000, status: "completed" },
    { id: "income", type: "income", date: "2026-07-02", title: "Pendapatan usaha", merchant: "VINN STORE", category: "Pendapatan", accountId: "bank", amount: 5_000_000, status: "completed" },
    { id: "food", type: "expense", date: "2026-07-05", title: "Belanja operasional", merchant: "VINN Mart", category: "Makanan", accountId: "bank", amount: 1_250_000, status: "completed" },
    { id: "internet", type: "expense", date: "2026-07-12", title: "Internet", merchant: "Provider", category: "Tagihan", accountId: "bank", amount: 350_000, status: "completed" },
  ],
  budgets: [
    { id: "food-budget", category: "Makanan", limit: 2_000_000, color: "#16876f" },
    { id: "bill-budget", category: "Tagihan", limit: 1_000_000, color: "#da9a3a" },
  ],
  goals: [
    { id: "emergency", name: "Dana darurat", target: 20_000_000, current: 8_000_000, deadline: "2026-12-31", color: "#16876f", icon: "target" },
  ],
  bills: [
    { id: "electricity", name: "Listrik", amount: 475_000, dueDate: "2026-07-20", category: "Tagihan", accountId: "bank", paid: false },
  ],
  categories: [],
  investmentAssets: [
    { id: "asset", accountId: "bank", ticker: "BBCA", name: "Bank Central Asia", assetClass: "Saham", exchange: "IDX", currency: "IDR", units: 10, costBasis: 8_500_000, averageCost: 850_000, marketPrice: 900_000, marketValue: 9_000_000, unrealizedPl: 500_000, realizedPl: 0, priceSource: "manual", priceStatus: "manual", active: true },
  ],
  investmentTransactions: [],
  privacy: false,
  sections: ["summary", "cashflow", "categories", "accounts", "budgets", "bills", "goals", "investments"],
});

await mkdir(outputDirectory, { recursive: true });
const outputPath = resolve(outputDirectory, "VINN-STORE_Laporan_2026-07_sample.pdf");
await writeFile(outputPath, report.bytes);
console.log(`${outputPath}\n${report.pageCount} pages\n${report.bytes.byteLength} bytes`);
