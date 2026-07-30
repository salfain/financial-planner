import assert from "node:assert/strict";
import test from "node:test";
import JSZip from "jszip";
import type { MonthlyPowerPointInput } from "../lib/powerpoint-report";
import { buildMonthlyFinancePowerPoint, financePowerPointFilename } from "../lib/powerpoint-report";

const input: MonthlyPowerPointInput = {
  period: "2026-07",
  profile: { name: "Vinn", storeName: "Financial Planner", currency: "IDR", timezone: "Asia/Jakarta" },
  accounts: [
    { id: "cash", name: "Rekening Utama", type: "Bank", institution: "Bank", balance: 8_000_000, openingBalance: 1_000_000, mask: "1234", color: "#126B59" },
    { id: "debt", name: "Kredivo", type: "Paylater", institution: "Kredivo", balance: 2_500_000, openingBalance: 3_000_000, mask: "", color: "#D9757B", liability: true },
  ],
  transactions: [
    { id: "income-jul", type: "income", date: "2026-07-02", title: "Gaji Juli", category: "Pendapatan", accountId: "cash", amount: 10_000_000, status: "completed" },
    { id: "food-jul", type: "expense", date: "2026-07-06", title: "Belanja Juli", category: "Makanan", accountId: "cash", amount: 1_500_000, status: "completed" },
    { id: "transport-jul", type: "expense", date: "2026-07-20", title: "Transport Juli", category: "Transportasi", accountId: "cash", amount: 750_000, status: "completed" },
    { id: "income-jun", type: "income", date: "2026-06-02", title: "Gaji Juni Rahasia", category: "Pendapatan", accountId: "cash", amount: 99_000_000, status: "completed" },
    { id: "pending-jul", type: "expense", date: "2026-07-21", title: "Pending Rahasia", category: "Hiburan", accountId: "cash", amount: 88_000_000, status: "pending" },
  ],
  budgets: [{ id: "budget-food", category: "Makanan", limit: 2_000_000, color: "#126B59", period: "2026-07" }],
  goals: [{ id: "goal", name: "Dana Darurat", target: 12_000_000, current: 6_000_000, deadline: "2026-12-31", color: "#126B59", icon: "umbrella" }],
  bills: [
    { id: "bill-jul", name: "Internet Juli", amount: 500_000, dueDate: "2026-07-25", category: "Tagihan", accountId: "cash", paid: false },
    { id: "bill-aug", name: "Internet Agustus Rahasia", amount: 500_000, dueDate: "2026-08-25", category: "Tagihan", accountId: "cash", paid: false },
  ],
  investmentAssets: [],
  investmentTransactions: [],
  generatedAt: "2026-07-31T12:00:00.000Z",
};

test("presentasi bulanan menghasilkan PPTX valid dengan tujuh slide", async () => {
  const result = buildMonthlyFinancePowerPoint(input);
  assert.equal(result.slideCount, 7);
  assert.equal(result.filename, "Financial-Planner_Presentasi_2026-07.pptx");

  const output = await result.presentation.write({ outputType: "uint8array", compression: true });
  assert.ok(output instanceof Uint8Array);
  assert.equal(String.fromCharCode(output[0], output[1]), "PK");

  const zip = await JSZip.loadAsync(output);
  assert.ok(zip.file("[Content_Types].xml"));
  assert.ok(zip.file("ppt/presentation.xml"));
  assert.equal(Object.keys(zip.files).filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name)).length, 7);
});

test("isi presentasi hanya memakai transaksi dan tagihan dari bulan pilihan", async () => {
  const result = buildMonthlyFinancePowerPoint(input);
  const output = await result.presentation.write({ outputType: "uint8array", compression: true });
  const zip = await JSZip.loadAsync(output);
  const slideXml = await Promise.all(
    Object.entries(zip.files)
      .filter(([name]) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
      .map(([, file]) => file.async("string")),
  );
  const content = slideXml.join("\n");
  assert.match(content, /Belanja Juli/);
  assert.match(content, /Internet Juli/);
  assert.doesNotMatch(content, /Gaji Juni Rahasia/);
  assert.doesNotMatch(content, /Pending Rahasia/);
  assert.doesNotMatch(content, /Internet Agustus Rahasia/);
});

test("nama file PowerPoint aman digunakan untuk unduhan", () => {
  assert.equal(financePowerPointFilename("My Financial / Planner", "2026-07"), "My-Financial-Planner_Presentasi_2026-07.pptx");
});

