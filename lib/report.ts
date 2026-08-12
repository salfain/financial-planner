import { jsPDF } from "jspdf";
import type {
  Account,
  Bill,
  Budget,
  FinanceCategory,
  Goal,
  InvestmentAsset,
  InvestmentTransaction,
  Transaction,
} from "./finance";
import { accountSummary, budgetsForPeriod, budgetSpent, formatIDR, formatMonthLabel, monthlySummary } from "./finance";
import { buildFinancialRoadmap, DEFAULT_ROADMAP_SETTINGS, type RoadmapSettings } from "./roadmap";
import { addMonthsToPeriod, simulateDebtPayoff, type DebtPlan, type DebtPlannerSettings } from "./debt";
import { buildCashflowForecast, DEFAULT_CASHFLOW_FORECAST_SETTINGS, type CashflowForecastSettings } from "./cashflow-forecast";
import { buildEmergencyFundPlan, DEFAULT_EMERGENCY_FUND_SETTINGS, type EmergencyFundSettings } from "./emergency-fund";
import { buildRecurringOverview, type RecurringTemplate } from "./recurring";
import { accountBalancesAtPeriod } from "./monthly-review";

export const REPORT_SECTIONS = [
  "summary",
  "cashflow",
  "categories",
  "accounts",
  "budgets",
  "bills",
  "goals",
  "roadmap",
  "forecast",
  "emergency",
  "debts",
  "investments",
  "recurring",
] as const;

export type ReportSection = (typeof REPORT_SECTIONS)[number];

export type FinanceReportInput = {
  period: string;
  profile: { name: string; storeName: string; currency: string; timezone: string };
  transactions: Transaction[];
  accounts: Account[];
  budgets: Budget[];
  goals: Goal[];
  bills: Bill[];
  categories: FinanceCategory[];
  investmentAssets: InvestmentAsset[];
  investmentTransactions: InvestmentTransaction[];
  privacy: boolean;
  sections: ReportSection[];
  roadmapSettings?: RoadmapSettings;
  debtPlanner?: { settings: DebtPlannerSettings; debts: DebtPlan[] };
  forecastSettings?: CashflowForecastSettings;
  emergencyFundSettings?: EmergencyFundSettings;
  recurringTemplates?: RecurringTemplate[];
  generatedAt?: string;
};

export type GeneratedFinanceReport = {
  bytes: Uint8Array;
  filename: string;
  pageCount: number;
};

const BRAND = [18, 107, 89] as const;
const BRAND_SOFT = [231, 244, 239] as const;
const INK = [24, 41, 36] as const;
const MUTED = [91, 107, 101] as const;
const BORDER = [218, 226, 222] as const;
const NEGATIVE = [185, 79, 67] as const;

function safePdfText(value: unknown, fallback = "-") {
  const normalized = String(value ?? "")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/[^\x20-\x7E\u00A0-\u00FF]/g, "?")
    .replace(/\s+/g, " ")
    .trim();
  return normalized || fallback;
}

function safeFilenamePart(value: string) {
  return value.replace(/[^A-Za-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || "Financial-Planner";
}

function money(value: number, privacy: boolean) {
  return privacy ? "Rp ********" : formatIDR(value);
}

function displayDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return safePdfText(value);
  return new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" })
    .format(new Date(`${value}T00:00:00Z`));
}

function previousMonth(period: string) {
  const date = new Date(`${period}-01T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() - 1);
  return date.toISOString().slice(0, 7);
}

function percentageDifference(current: number, previous: number) {
  if (previous === 0) return current === 0 ? "0.0%" : "Baru";
  const change = (current - previous) / Math.abs(previous) * 100;
  return `${change >= 0 ? "+" : ""}${change.toFixed(1)}%`;
}

function selected(input: FinanceReportInput, section: ReportSection) {
  return input.sections.includes(section);
}

export function financeReportFilename(storeName: string, period: string) {
  return `${safeFilenamePart(storeName)}_Laporan_${period}.pdf`;
}

export function financePresentationPdfFilename(storeName: string, period: string) {
  return `${safeFilenamePart(storeName)}_Presentasi_${period}.pdf`;
}

export function financeCsvFilename(storeName: string, period: string) {
  return `${safeFilenamePart(storeName)}_Transaksi_${period}.csv`;
}

export function buildFinanceCsv(input: Pick<FinanceReportInput, "period" | "transactions">) {
  const escape = (value: unknown) => {
    const text = String(value ?? "");
    const protectedText = /^[=+\-@]/.test(text) ? `'${text}` : text;
    return `"${protectedText.replaceAll('"', '""')}"`;
  };
  const rows: unknown[][] = [["Tanggal", "Waktu", "Tipe", "Deskripsi", "Merchant", "Kategori", "Split kategori", "Akun", "Akun tujuan", "Nominal", "Status", "Catatan", "Tag", "Lokasi", "Lampiran"]];
  input.transactions
    .filter((item) => item.date.startsWith(input.period) && !item.deletedAt)
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))
    .forEach((item) => rows.push([
      item.date,
      item.time ?? "",
      item.type,
      item.title,
      item.merchant ?? "",
      item.category,
      item.splits?.map((split) => `${split.category}:${split.amount}`).join("|") ?? "",
      item.accountId,
      item.destinationAccountId ?? "",
      item.amount,
      item.status,
      item.notes ?? "",
      item.tags?.join("|") ?? "",
      item.location ?? "",
      item.receipt?.filename ?? "",
    ]));
  return `\uFEFF${rows.map((row) => row.map(escape).join(",")).join("\r\n")}`;
}

export function generateFinancePdf(input: FinanceReportInput): GeneratedFinanceReport {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(input.period)) throw new Error("Periode laporan harus berformat YYYY-MM.");
  if (!input.sections.length) throw new Error("Pilih minimal satu bagian laporan.");

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true, putOnlyUsedFonts: true });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 17;
  const contentWidth = pageWidth - margin * 2;
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const monthTransactions = input.transactions.filter((item) => item.date.startsWith(input.period) && item.status === "completed" && !item.deletedAt);
  const summary = monthlySummary(monthTransactions, input.period);
  const previousPeriod = previousMonth(input.period);
  const previousSummary = monthlySummary(input.transactions, previousPeriod);
  const investmentValue = input.investmentAssets.reduce((sum, asset) => sum + asset.marketValue, 0);
  const totals = accountSummary(accountBalancesAtPeriod(input.accounts, input.transactions, input.period), investmentValue);
  const expensesByCategory = monthTransactions.filter((item) => item.type === "expense").reduce<Record<string, number>>((result, item) => {
    const allocations = item.splits?.length ? item.splits : [{ category: item.category, amount: item.amount }];
    allocations.forEach((split) => { result[split.category] = (result[split.category] ?? 0) + split.amount; });
    return result;
  }, {});
  const incomeByCategory = monthTransactions.filter((item) => item.type === "income").reduce<Record<string, number>>((result, item) => {
    const allocations = item.splits?.length ? item.splits : [{ category: item.category, amount: item.amount }];
    allocations.forEach((split) => { result[split.category] = (result[split.category] ?? 0) + split.amount; });
    return result;
  }, {});
  let y = 0;
  let page = 1;

  const drawFooter = () => {
    doc.setDrawColor(...BORDER);
    doc.line(margin, pageHeight - 13, pageWidth - margin, pageHeight - 13);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);
    doc.text(safePdfText(input.profile.storeName), margin, pageHeight - 8);
    doc.text(`Halaman ${page}`, pageWidth - margin, pageHeight - 8, { align: "right" });
  };

  const newPage = () => {
    drawFooter();
    doc.addPage("a4", "portrait");
    page += 1;
    y = 20;
  };

  const ensureSpace = (height: number) => {
    if (y + height > pageHeight - 19) newPage();
  };

  const sectionTitle = (eyebrow: string, title: string, subtitle?: string) => {
    // Keep a section heading with enough room for its first content block.
    ensureSpace(subtitle ? 42 : 36);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(...BRAND);
    doc.text(safePdfText(eyebrow).toUpperCase(), margin, y);
    y += 6;
    doc.setFontSize(15);
    doc.setTextColor(...INK);
    doc.text(safePdfText(title), margin, y);
    y += 5;
    if (subtitle) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...MUTED);
      const lines = doc.splitTextToSize(safePdfText(subtitle), contentWidth);
      doc.text(lines, margin, y);
      y += lines.length * 3.8;
    }
    y += 3;
  };

  const keyValueCards = (items: Array<{ label: string; value: string; tone?: "negative" | "positive" }>) => {
    const gap = 3;
    const width = (contentWidth - gap * (items.length - 1)) / items.length;
    ensureSpace(23);
    items.forEach((item, index) => {
      const x = margin + index * (width + gap);
      doc.setFillColor(247, 250, 248);
      doc.setDrawColor(...BORDER);
      doc.roundedRect(x, y, width, 20, 2.5, 2.5, "FD");
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(...MUTED);
      doc.text(safePdfText(item.label), x + 3.5, y + 6);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      const tone: readonly [number, number, number] = item.tone === "negative" ? NEGATIVE : item.tone === "positive" ? BRAND : INK;
      doc.setTextColor(tone[0], tone[1], tone[2]);
      doc.text(safePdfText(item.value), x + 3.5, y + 14);
    });
    y += 25;
  };

  const table = (headers: string[], rows: string[][], widths: number[]) => {
    const lineHeight = 4.2;
    const rowPadding = 2.5;
    const drawHeader = () => {
      doc.setFillColor(...BRAND_SOFT);
      doc.rect(margin, y, contentWidth, 8, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.setTextColor(...BRAND);
      let x = margin + 2;
      headers.forEach((header, index) => {
        doc.text(safePdfText(header), x, y + 5.2, { maxWidth: widths[index] - 3 });
        x += widths[index];
      });
      y += 8;
    };
    // Reserve room for the header and at least one normal row so a table header
    // is never stranded directly above the footer.
    ensureSpace(24);
    drawHeader();
    if (!rows.length) rows = [["Belum ada data", ...headers.slice(1).map(() => "-")]];
    rows.forEach((row) => {
      const wrapped = row.map((value, index) => doc.splitTextToSize(safePdfText(value), Math.max(4, widths[index] - 4)) as string[]);
      const height = Math.max(1, ...wrapped.map((lines) => lines.length)) * lineHeight + rowPadding * 2;
      if (y + height > pageHeight - 19) {
        newPage();
        drawHeader();
      }
      doc.setDrawColor(...BORDER);
      doc.line(margin, y + height, pageWidth - margin, y + height);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.2);
      doc.setTextColor(...INK);
      let x = margin + 2;
      wrapped.forEach((lines, index) => {
        doc.text(lines, x, y + rowPadding + 3, { maxWidth: widths[index] - 4 });
        x += widths[index];
      });
      y += height;
    });
    y += 7;
  };

  doc.setFillColor(...BRAND);
  doc.rect(0, 0, pageWidth, 63, "F");
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(margin, 16, 13, 13, 3, 3, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...BRAND);
  doc.text("V", margin + 6.5, 25.3, { align: "center" });
  doc.setFontSize(9);
  doc.setTextColor(214, 239, 229);
  doc.text("FINANCIAL PLANNER", margin + 18, 20.5);
  doc.setFontSize(22);
  doc.setTextColor(255, 255, 255);
  doc.text(safePdfText(input.profile.storeName), margin + 18, 29);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text("Laporan keuangan bulanan yang dapat ditelusuri ke ledger.", margin, 48);
  doc.setTextColor(...INK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text(`Laporan ${safePdfText(formatMonthLabel(input.period))}`, margin, 81);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.text(`Pemilik: ${safePdfText(input.profile.name)}  |  Mata uang: ${safePdfText(input.profile.currency)}  |  Zona waktu: ${safePdfText(input.profile.timezone)}`, margin, 90);
  doc.text(`Dibuat: ${safePdfText(new Intl.DateTimeFormat("id-ID", { dateStyle: "long", timeStyle: "short", timeZone: input.profile.timezone }).format(new Date(generatedAt)))}`, margin, 97);
  doc.setFillColor(...BRAND_SOFT);
  doc.roundedRect(margin, 114, contentWidth, 33, 3, 3, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...BRAND);
  doc.text("RINGKASAN CEPAT", margin + 5, 123);
  doc.setFontSize(13);
  doc.setTextColor(...INK);
  doc.text(`Net worth ${money(totals.netWorth, input.privacy)}`, margin + 5, 133);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text(`Arus kas ${money(summary.cashflow, input.privacy)}  |  Savings rate ${summary.savingsRate.toFixed(1)}%`, margin + 5, 141);
  doc.setFontSize(7.5);
  doc.text("Dokumen ini dibuat dari data Financial Planner pada periode yang dipilih. Transfer internal tidak dihitung sebagai income/expense.", margin, 169, { maxWidth: contentWidth });
  y = 188;

  if (selected(input, "summary")) {
    sectionTitle("01 - Ringkasan eksekutif", "Posisi keuangan", summary.cashflow >= 0 ? "Arus kas periode ini positif atau seimbang." : "Pengeluaran periode ini lebih besar daripada pemasukan.");
    keyValueCards([
      { label: "Kekayaan bersih", value: money(totals.netWorth, input.privacy), tone: totals.netWorth >= 0 ? "positive" : "negative" },
      { label: "Total aset", value: money(totals.assets, input.privacy) },
      { label: "Total kewajiban", value: money(totals.liabilities, input.privacy), tone: totals.liabilities > 0 ? "negative" : undefined },
    ]);
    keyValueCards([
      { label: "Pemasukan", value: money(summary.income, input.privacy), tone: "positive" },
      { label: "Pengeluaran", value: money(summary.expense, input.privacy), tone: "negative" },
      { label: "Arus kas bersih", value: money(summary.cashflow, input.privacy), tone: summary.cashflow >= 0 ? "positive" : "negative" },
    ]);
    ensureSpace(23);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...INK);
    doc.text(`Perbandingan dengan ${safePdfText(formatMonthLabel(previousPeriod))}`, margin, y);
    y += 4;
    table(
      ["Metrik", "Bulan ini", "Bulan lalu", "Perubahan"],
      [
        ["Pemasukan", money(summary.income, input.privacy), money(previousSummary.income, input.privacy), percentageDifference(summary.income, previousSummary.income)],
        ["Pengeluaran", money(summary.expense, input.privacy), money(previousSummary.expense, input.privacy), percentageDifference(summary.expense, previousSummary.expense)],
        ["Arus kas", money(summary.cashflow, input.privacy), money(previousSummary.cashflow, input.privacy), percentageDifference(summary.cashflow, previousSummary.cashflow)],
      ],
      [44, 46, 46, contentWidth - 136],
    );
  }

  if (selected(input, "cashflow")) {
    sectionTitle("02 - Arus kas", "Transaksi periode berjalan", `${monthTransactions.length} transaksi selesai pada ${formatMonthLabel(input.period)}.`);
    table(
      ["Tanggal", "Deskripsi", "Kategori", "Tipe", "Nominal"],
      monthTransactions.slice().sort((a, b) => a.date.localeCompare(b.date)).map((item) => [
        displayDate(item.date),
        item.title,
        item.splits?.length ? item.splits.map((split) => split.category).join(", ") : item.category,
        item.type,
        money(item.amount, input.privacy),
      ]),
      [25, 55, 36, 26, contentWidth - 142],
    );
  }

  if (selected(input, "categories")) {
    sectionTitle("03 - Kategori", "Pemasukan dan pengeluaran", "Agregasi hanya memakai transaksi selesai dan mengabaikan transfer internal.");
    const categoryRows = [
      ...Object.entries(incomeByCategory).map(([name, value]) => [name, "Pemasukan", money(value, input.privacy)]),
      ...Object.entries(expensesByCategory).map(([name, value]) => [name, "Pengeluaran", money(value, input.privacy)]),
    ].sort((a, b) => a[1].localeCompare(b[1]) || a[0].localeCompare(b[0]));
    table(["Kategori", "Jenis", "Total"], categoryRows, [80, 45, contentWidth - 125]);
  }

  if (selected(input, "accounts")) {
    sectionTitle("04 - Akun", "Saldo akun", "Nilai investasi ditampilkan terpisah dari saldo kas untuk mencegah penghitungan ganda.");
    table(
      ["Akun", "Jenis", "Institusi", "Status", "Saldo"],
      input.accounts.map((account) => [account.name, account.type, account.institution || "-", account.liability ? "Kewajiban" : "Aset", money(account.balance, input.privacy)]),
      [45, 31, 39, 31, contentWidth - 146],
    );
  }

  if (selected(input, "budgets")) {
    sectionTitle("05 - Anggaran", "Kinerja anggaran", "Realisasi dihitung dari expense periode yang sama; refund mengurangi pemakaian.");
    table(
      ["Kategori", "Batas", "Realisasi", "Sisa", "Status"],
      budgetsForPeriod(input.budgets, input.period).map((budget) => {
        const spent = budgetSpent(input.transactions, budget.category, input.period);
        const ratio = budget.limit > 0 ? spent / budget.limit * 100 : 0;
        return [budget.category, money(budget.limit, input.privacy), money(spent, input.privacy), money(budget.limit - spent, input.privacy), ratio > 100 ? "Terlampaui" : ratio >= 90 ? "Waspada" : "Aman"];
      }),
      [45, 33, 33, 33, contentWidth - 144],
    );
  }

  if (selected(input, "bills")) {
    sectionTitle("06 - Tagihan", "Status tagihan", "Pembayaran tetap membutuhkan akun sumber dan tidak boleh dicatat dua kali.");
    table(
      ["Tagihan", "Jatuh tempo", "Kategori", "Status", "Nominal"],
      input.bills.map((bill) => [bill.name, displayDate(bill.dueDate), bill.category, bill.paid ? "Dibayar" : "Menunggu", money(bill.amount, input.privacy)]),
      [43, 33, 35, 30, contentWidth - 141],
    );
  }

  if (selected(input, "goals")) {
    sectionTitle("07 - Target", "Progress target finansial", "Progress berasal dari kontribusi yang sudah dikonfirmasi pengguna.");
    table(
      ["Target", "Deadline", "Terkumpul", "Sisa", "Progress"],
      input.goals.map((goal) => [goal.name, displayDate(goal.deadline), money(goal.current, input.privacy), money(Math.max(0, goal.target - goal.current), input.privacy), `${goal.target > 0 ? Math.min(100, goal.current / goal.target * 100).toFixed(1) : "0.0"}%`]),
      [43, 32, 37, 37, contentWidth - 149],
    );
  }

  if (selected(input, "roadmap")) {
    const roadmap = buildFinancialRoadmap({
      transactions: input.transactions,
      accounts: input.accounts,
      goals: input.goals,
      investmentMarketValue: investmentValue,
      settings: input.roadmapSettings ?? DEFAULT_ROADMAP_SETTINGS,
      asOfMonth: input.period,
    });
    sectionTitle("08 - Financial Roadmap", "Proyeksi kekayaan bersih", "Simulasi menggunakan pola arus kas hingga enam bulan terakhir dan asumsi yang tersimpan. Hasil bukan jaminan kondisi masa depan.");
    keyValueCards(roadmap.scenarios.map((scenario) => ({
      label: `${scenario.label} - ${input.roadmapSettings?.horizonMonths ?? DEFAULT_ROADMAP_SETTINGS.horizonMonths} bulan`,
      value: money(scenario.finalNetWorth, input.privacy),
      tone: scenario.growth >= 0 ? "positive" as const : "negative" as const,
    })));

    ensureSpace(67);
    const chartTop = y + 2;
    const chartHeight = 52;
    const chartBottom = chartTop + chartHeight;
    const values = roadmap.scenarios.flatMap((scenario) => scenario.points.map((point) => point.netWorth));
    const chartMin = Math.min(...values, 0);
    const chartMaxValue = Math.max(...values, 1);
    const chartSpan = Math.max(1, chartMaxValue - chartMin);
    doc.setDrawColor(...BORDER);
    [0, .5, 1].forEach((ratio) => doc.line(margin, chartTop + chartHeight * ratio, pageWidth - margin, chartTop + chartHeight * ratio));
    const lineColors: Record<string, readonly [number, number, number]> = { conservative: [199, 101, 101], base: BRAND, optimistic: [85, 116, 184] };
    roadmap.scenarios.forEach((scenario) => {
      const color = lineColors[scenario.key];
      doc.setDrawColor(color[0], color[1], color[2]);
      doc.setLineWidth(scenario.key === "base" ? 1.1 : .6);
      scenario.points.slice(1).forEach((point, index) => {
        const previous = scenario.points[index];
        const x1 = margin + index / Math.max(1, scenario.points.length - 1) * contentWidth;
        const x2 = margin + (index + 1) / Math.max(1, scenario.points.length - 1) * contentWidth;
        const y1 = chartBottom - (previous.netWorth - chartMin) / chartSpan * chartHeight;
        const y2 = chartBottom - (point.netWorth - chartMin) / chartSpan * chartHeight;
        doc.line(x1, y1, x2, y2);
      });
    });
    doc.setLineWidth(.2);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.8);
    doc.setTextColor(...MUTED);
    const basePoints = roadmap.scenarios.find((scenario) => scenario.key === "base")?.points ?? [];
    doc.text(basePoints[0]?.month ?? input.period, margin, chartBottom + 5);
    doc.text(basePoints.at(-1)?.month ?? input.period, pageWidth - margin, chartBottom + 5, { align: "right" });
    y = chartBottom + 11;

    table(
      ["Target", "Sisa", "Kebutuhan/bln", "Perkiraan", "Status"],
      roadmap.goalForecasts.map((goal) => [goal.name, money(goal.remaining, input.privacy), money(goal.recommendedMonthly, input.privacy), goal.projectedMonth ? formatMonthLabel(goal.projectedMonth) : "Belum terjangkau", goal.onTrack ? "Sesuai rencana" : "Perlu penyesuaian"]),
      [43, 34, 38, 38, contentWidth - 153],
    );
  }

  if (selected(input, "forecast")) {
    const forecast = buildCashflowForecast({ accounts: input.accounts, transactions: input.transactions, bills: input.bills, settings: input.forecastSettings ?? DEFAULT_CASHFLOW_FORECAST_SETTINGS, asOfDate: generatedAt.slice(0, 10) });
    sectionTitle("09 - Cashflow Forecast", "Proyeksi likuiditas", "Saldo diproyeksikan dari kas saat ini, pola transaksi, pemasukan utama, dan tagihan rutin. Hasil bukan jaminan arus kas masa depan.");
    keyValueCards([
      { label: "Kas sekarang", value: money(forecast.startingBalance, input.privacy) },
      { label: `Saldo ${input.forecastSettings?.horizonDays ?? 60} hari`, value: money(forecast.endingBalance, input.privacy), tone: forecast.endingBalance >= 0 ? "positive" : "negative" },
      { label: "Saldo terendah", value: money(forecast.lowestBalance, input.privacy), tone: forecast.firstNegativeDate ? "negative" : undefined },
    ]);
    table(["Komponen", "Proyeksi", "Catatan"], [
      ["Pemasukan", money(forecast.projectedIncome, input.privacy), `Rata-rata ${money(forecast.monthlyIncome, input.privacy)}/bulan`],
      ["Tagihan rutin", money(forecast.projectedBills, input.privacy), `${input.bills.length} tagihan aktif`],
      ["Biaya hidup", money(forecast.projectedLivingExpense, input.privacy), `Dari ${forecast.observedMonths} bulan data`],
      ["Peringatan pertama", forecast.firstNegativeDate ? displayDate(forecast.firstNegativeDate) : forecast.firstBelowBufferDate ? displayDate(forecast.firstBelowBufferDate) : "Tidak ada", forecast.firstNegativeDate ? "Saldo negatif" : forecast.firstBelowBufferDate ? "Di bawah buffer" : "Dalam batas aman"],
    ], [50, 49, contentWidth - 99]);
  }

  if (selected(input, "emergency")) {
    const emergency = buildEmergencyFundPlan({ accounts: input.accounts, transactions: input.transactions, settings: input.emergencyFundSettings ?? DEFAULT_EMERGENCY_FUND_SETTINGS, asOfMonth: input.period });
    sectionTitle("10 - Dana Darurat", "Financial Safety", "Target dihitung dari pola pengeluaran dan akun likuid yang dipilih pengguna.");
    keyValueCards([{ label: "Safety score", value: `${emergency.safetyScore}/100` }, { label: "Coverage", value: `${emergency.coverageMonths.toFixed(1)} bulan` }, { label: "Target", value: money(emergency.targetAmount, input.privacy) }]);
    table(["Dana tersedia", "Kekurangan", "Kontribusi/bln", "Perkiraan selesai"], [[money(emergency.currentFund, input.privacy), money(emergency.gap, input.privacy), money(input.emergencyFundSettings?.monthlyContribution ?? 0, input.privacy), emergency.projectedMonth ? formatMonthLabel(emergency.projectedMonth) : "Belum tersedia"]], [45,45,45,contentWidth-135]);
  }

  if (selected(input, "debts")) {
    const planner = input.debtPlanner;
    const payoff = planner ? simulateDebtPayoff(planner.debts, planner.settings) : null;
    sectionTitle("11 - Pelunasan Utang", "Debt Payoff Planner", "Proyeksi menggunakan bunga, cicilan minimum, dan pembayaran ekstra yang tersimpan. Simulasi bukan perubahan otomatis pada transaksi.");
    keyValueCards([
      { label: "Total utang", value: money(payoff?.startingBalance ?? 0, input.privacy), tone: "negative" },
      { label: "Komitmen bulanan", value: money(payoff?.monthlyCommitment ?? 0, input.privacy) },
      { label: "Estimasi bebas utang", value: payoff && !payoff.nonAmortizing && payoff.startingBalance > 0 ? formatMonthLabel(addMonthsToPeriod(input.period, payoff.months)) : "Belum tersedia" },
    ]);
    table(
      ["Utang", "Bunga/thn", "Minimum", "Jatuh tempo", "Estimasi selesai"],
      (payoff?.debts ?? []).map((debt) => [debt.name, `${debt.annualInterestRatePct.toFixed(2)}%`, money(debt.minimumPayment, input.privacy), `Tanggal ${debt.dueDay}`, debt.payoffMonth ? formatMonthLabel(addMonthsToPeriod(input.period, debt.payoffMonth)) : "Belum lunas"]),
      [45, 29, 36, 31, contentWidth - 141],
    );
  }

  if (selected(input, "investments")) {
    sectionTitle("12 - Investasi", "Portofolio investasi", "Harga manual atau transaksi terakhir dapat bersifat delayed dan bukan harga real-time.");
    table(
      ["Aset", "Unit", "Cost basis", "Nilai", "Unrealized P/L"],
      input.investmentAssets.map((asset) => [`${asset.ticker} - ${asset.name}`, asset.units.toLocaleString("id-ID", { maximumFractionDigits: 8 }), money(asset.costBasis, input.privacy), money(asset.marketValue, input.privacy), money(asset.unrealizedPl, input.privacy)]),
      [50, 28, 35, 35, contentWidth - 148],
    );
    const realized = input.investmentTransactions.filter((item) => item.date.startsWith(input.period) && item.type === "sell").reduce((sum, item) => sum + item.realizedPl, 0);
    keyValueCards([
      { label: "Nilai portofolio", value: money(investmentValue, input.privacy) },
      { label: "Realized P/L periode", value: money(realized, input.privacy), tone: realized >= 0 ? "positive" : "negative" },
      { label: "Jumlah aset", value: String(input.investmentAssets.length) },
    ]);
  }

  if (selected(input, "recurring")) {
    const recurring = buildRecurringOverview(input.recurringTemplates ?? [], generatedAt.slice(0, 10));
    sectionTitle("13 - Transaksi Rutin", "Recurring & subscription tracker", "Jadwal bersifat perencanaan dan hanya mengubah ledger setelah dikonfirmasi pengguna.");
    keyValueCards([
      { label: "Pemasukan rutin / bulan", value: money(recurring.monthlyIncome, input.privacy), tone: "positive" },
      { label: "Komitmen / bulan", value: money(recurring.monthlyExpense, input.privacy), tone: "negative" },
      { label: "Subscription / tahun", value: money(recurring.annualSubscriptions, input.privacy) },
    ]);
    table(["Jadwal", "Jenis", "Frekuensi", "Berikutnya", "Nominal"], (input.recurringTemplates ?? []).map((item) => [item.name, item.type === "income" ? "Pemasukan" : item.isSubscription ? "Subscription" : "Pengeluaran", item.frequency, displayDate(item.nextDueDate), money(item.amount, input.privacy)]), [48, 30, 27, 36, contentWidth - 141]);
  }

  ensureSpace(30);
  doc.setFillColor(247, 250, 248);
  doc.roundedRect(margin, y, contentWidth, 22, 3, 3, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...INK);
  doc.text("Catatan penggunaan", margin + 4, y + 7);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.2);
  doc.setTextColor(...MUTED);
  doc.text("Laporan ini adalah ringkasan pencatatan pengguna, bukan laporan audit atau nasihat investasi. Cocokkan dengan rekening sumber bila diperlukan.", margin + 4, y + 13, { maxWidth: contentWidth - 8 });
  y += 25;
  drawFooter();

  return {
    bytes: new Uint8Array(doc.output("arraybuffer")),
    filename: financeReportFilename(input.profile.storeName, input.period),
    pageCount: doc.getNumberOfPages(),
  };
}

export function generateFinancePresentationPdf(input: FinanceReportInput): GeneratedFinanceReport {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(input.period)) throw new Error("Periode presentasi harus berformat YYYY-MM.");

  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: [960, 540], compress: true, putOnlyUsedFonts: true });
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();
  const margin = 54;
  const periodTransactions = input.transactions.filter((item) => !item.deletedAt && item.status === "completed" && item.date.startsWith(input.period));
  const summary = monthlySummary(periodTransactions, input.period);
  const priorSummary = monthlySummary(input.transactions, previousMonth(input.period));
  const historicalAccounts = accountBalancesAtPeriod(input.accounts, input.transactions, input.period);
  const investmentValue = input.investmentAssets.reduce((sum, asset) => sum + asset.marketValue, 0);
  const totals = accountSummary(historicalAccounts, investmentValue);
  const expensesByCategory = periodTransactions.filter((item) => item.type === "expense").reduce<Record<string, number>>((result, item) => {
    const splits = item.splits?.length ? item.splits : [{ category: item.category, amount: item.amount }];
    splits.forEach((split) => { result[split.category] = (result[split.category] ?? 0) + split.amount; });
    return result;
  }, {});
  const topCategories = Object.entries(expensesByCategory).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const topTransactions = periodTransactions.filter((item) => item.type === "expense").sort((a, b) => b.amount - a.amount).slice(0, 5);
  const liabilityAccounts = historicalAccounts.filter((account) => account.liability).sort((a, b) => b.balance - a.balance).slice(0, 5);
  const visibleBills = input.bills.filter((bill) => !bill.completed).sort((a, b) => a.dueDate.localeCompare(b.dueDate)).slice(0, 5);
  const goals = [...input.goals].sort((a, b) => (b.target > 0 ? b.current / b.target : 0) - (a.target > 0 ? a.current / a.target : 0)).slice(0, 4);
  const investments = [...input.investmentAssets].sort((a, b) => b.marketValue - a.marketValue).slice(0, 4);
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  let page = 1;

  const valueText = (value: number) => money(value, input.privacy);
  const setText = (size: number, color: readonly number[], style: "normal" | "bold" = "normal") => {
    doc.setFont("helvetica", style);
    doc.setFontSize(size);
    doc.setTextColor(color[0], color[1], color[2]);
  };
  const text = (value: unknown, x: number, y: number, options: { maxWidth?: number; align?: "left" | "center" | "right" } = {}) => {
    doc.text(safePdfText(value), x, y, { maxWidth: options.maxWidth, align: options.align });
  };
  const fill = (color: readonly number[]) => doc.setFillColor(color[0], color[1], color[2]);
  const line = (color: readonly number[]) => doc.setDrawColor(color[0], color[1], color[2]);
  const footer = (dark = false) => {
    line(dark ? [63, 118, 104] : BORDER);
    doc.line(margin, height - 28, width - margin, height - 28);
    setText(8, dark ? [187, 217, 207] : MUTED);
    text(`${input.profile.storeName} - ${formatMonthLabel(input.period)}`, margin, height - 14);
    text(`${page} / 7`, width - margin, height - 14, { align: "right" });
  };
  const nextPage = (dark = false) => {
    doc.addPage([960, 540], "landscape");
    page += 1;
    fill(dark ? [13, 50, 43] : [248, 250, 249]);
    doc.rect(0, 0, width, height, "F");
  };
  const slideTitle = (eyebrow: string, titleValue: string, subtitle: string) => {
    setText(10, BRAND, "bold");
    text(eyebrow.toUpperCase(), margin, 54);
    setText(36, INK, "bold");
    text(titleValue, margin, 96, { maxWidth: width - margin * 2 });
    setText(14, MUTED);
    text(subtitle, margin, 122, { maxWidth: width - margin * 2 });
  };
  const metric = (label: string, value: string, x: number, y: number, metricWidth: number, accent: readonly number[] = BRAND) => {
    fill([255, 255, 255]);
    line(BORDER);
    doc.roundedRect(x, y, metricWidth, 102, 12, 12, "FD");
    fill(accent);
    doc.roundedRect(x, y, 6, 102, 3, 3, "F");
    setText(10, MUTED, "bold");
    text(label.toUpperCase(), x + 22, y + 29);
    setText(23, INK, "bold");
    text(value, x + 22, y + 64, { maxWidth: metricWidth - 36 });
  };
  const recommendationRows: Array<{ title: string; detail: string }> = [];
  if (summary.cashflow < 0) recommendationRows.push({ title: "Pulihkan arus kas", detail: `Kurangi pengeluaran terbesar pada ${topCategories[0]?.[0] ?? "kategori utama"} dan tetapkan batas mingguan.` });
  else recommendationRows.push({ title: "Pertahankan surplus", detail: `Arus kas positif ${valueText(summary.cashflow)} dapat diarahkan ke target prioritas atau dana darurat.` });
  if (summary.savingsRate < 20) recommendationRows.push({ title: "Naikkan savings rate", detail: "Mulai dari target 20% pemasukan dan otomatisasi alokasi setelah pendapatan masuk." });
  else recommendationRows.push({ title: "Savings rate sehat", detail: `Tingkat ${summary.savingsRate.toFixed(1)}% sudah memberi ruang untuk mempercepat tujuan keuangan.` });
  if (totals.liabilities > 0) recommendationRows.push({ title: "Kendalikan kewajiban", detail: `Pantau sisa ${valueText(totals.liabilities)} dan prioritaskan bunga atau biaya tertinggi.` });
  if (!input.goals.length) recommendationRows.push({ title: "Tetapkan tujuan", detail: "Tambahkan satu target bernominal dan deadline agar surplus memiliki arah yang jelas." });
  while (recommendationRows.length < 3) recommendationRows.push({ title: "Jaga konsistensi", detail: "Lakukan review mingguan singkat dan rekonsiliasi saldo sebelum tutup buku berikutnya." });

  // 1 - Cover
  fill([13, 50, 43]);
  doc.rect(0, 0, width, height, "F");
  fill([19, 112, 92]);
  doc.circle(width - 110, 75, 210, "F");
  fill([29, 133, 111]);
  doc.circle(width - 45, 510, 235, "F");
  setText(11, [106, 220, 185], "bold");
  text("MONTHLY FINANCIAL REVIEW", margin, 72);
  setText(52, [255, 255, 255], "bold");
  text(formatMonthLabel(input.period), margin, 145);
  setText(20, [198, 226, 217]);
  text(input.profile.storeName, margin, 180);
  setText(13, [178, 211, 201]);
  text("Ringkasan visual untuk memahami posisi, perubahan, dan keputusan bulan ini.", margin, 220, { maxWidth: 560 });
  setText(10, [157, 200, 187]);
  text(`Disiapkan ${new Intl.DateTimeFormat("id-ID", { dateStyle: "long", timeZone: input.profile.timezone }).format(new Date(generatedAt))}`, margin, 438);
  footer(true);

  // 2 - Executive summary
  nextPage();
  slideTitle("01 - Ringkasan", summary.cashflow >= 0 ? "Bulan ditutup dengan arus kas positif" : "Pengeluaran melampaui pemasukan", "Empat angka utama yang menentukan kondisi keuangan bulan ini.");
  metric("Pemasukan", valueText(summary.income), margin, 164, 195, [37, 154, 123]);
  metric("Pengeluaran", valueText(summary.expense), 273, 164, 195, NEGATIVE);
  metric("Arus kas bersih", valueText(summary.cashflow), 492, 164, 195, summary.cashflow >= 0 ? BRAND : NEGATIVE);
  metric("Kekayaan bersih", valueText(totals.netWorth), 711, 164, 195, [55, 97, 168]);
  setText(18, INK, "bold");
  text(`${summary.savingsRate.toFixed(1)}% savings rate`, margin, 320);
  setText(13, MUTED);
  text(`Pemasukan ${percentageDifference(summary.income, priorSummary.income)} dan pengeluaran ${percentageDifference(summary.expense, priorSummary.expense)} dibanding bulan sebelumnya.`, margin, 348, { maxWidth: 800 });
  fill(summary.cashflow >= 0 ? [230, 246, 239] : [251, 235, 233]);
  doc.roundedRect(margin, 380, width - margin * 2, 58, 10, 10, "F");
  setText(15, summary.cashflow >= 0 ? BRAND : NEGATIVE, "bold");
  text(summary.cashflow >= 0 ? "Surplus memberi ruang untuk memperkuat tujuan keuangan." : "Defisit perlu ditangani sebelum menambah komitmen baru.", margin + 18, 414);
  footer();

  // 3 - Cash flow
  nextPage();
  slideTitle("02 - Arus kas", "Dari mana uang masuk dan ke mana uang pergi", "Perbandingan nilai bulan pilihan dengan periode sebelumnya.");
  const flowMax = Math.max(1, summary.income, summary.expense, priorSummary.income, priorSummary.expense);
  const bars = [
    { label: "Pemasukan bulan ini", value: summary.income, color: [37, 154, 123] as const },
    { label: "Pemasukan sebelumnya", value: priorSummary.income, color: [128, 196, 177] as const },
    { label: "Pengeluaran bulan ini", value: summary.expense, color: NEGATIVE },
    { label: "Pengeluaran sebelumnya", value: priorSummary.expense, color: [220, 154, 148] as const },
  ];
  bars.forEach((bar, index) => {
    const y = 170 + index * 64;
    setText(12, INK, "bold");
    text(bar.label, margin, y);
    fill([226, 233, 230]);
    doc.roundedRect(230, y - 13, 500, 16, 8, 8, "F");
    fill(bar.color);
    doc.roundedRect(230, y - 13, Math.max(5, 500 * bar.value / flowMax), 16, 8, 8, "F");
    setText(13, INK, "bold");
    text(valueText(bar.value), width - margin, y, { align: "right" });
  });
  setText(14, summary.cashflow >= 0 ? BRAND : NEGATIVE, "bold");
  text(`Selisih bulan ini: ${valueText(summary.cashflow)}`, margin, 445);
  footer();

  // 4 - Spending
  nextPage();
  slideTitle("03 - Pengeluaran", topCategories.length ? `${topCategories[0][0]} menjadi kategori terbesar` : "Belum ada pengeluaran tercatat", "Fokus pada pengeluaran yang paling memengaruhi hasil bulan ini.");
  const categoryMax = Math.max(1, ...topCategories.map((item) => item[1]));
  topCategories.forEach(([category, amount], index) => {
    const y = 172 + index * 50;
    setText(12, INK, "bold");
    text(`${index + 1}. ${category}`, margin, y, { maxWidth: 190 });
    fill([227, 237, 233]);
    doc.roundedRect(250, y - 12, 285, 14, 7, 7, "F");
    fill(index === 0 ? NEGATIVE : BRAND);
    doc.roundedRect(250, y - 12, Math.max(5, 285 * amount / categoryMax), 14, 7, 7, "F");
    setText(12, INK, "bold");
    text(valueText(amount), 620, y, { align: "right" });
  });
  fill([255, 255, 255]); line(BORDER);
  doc.roundedRect(640, 150, 266, 262, 12, 12, "FD");
  setText(12, BRAND, "bold"); text("TRANSAKSI TERBESAR", 662, 178);
  topTransactions.forEach((item, index) => {
    const y = 215 + index * 39;
    setText(11, INK, "bold"); text(item.merchant || item.title, 662, y, { maxWidth: 150 });
    setText(10, MUTED); text(valueText(item.amount), 884, y, { align: "right" });
  });
  if (!topTransactions.length) { setText(12, MUTED); text("Belum ada data pada bulan ini.", 662, 220); }
  footer();

  // 5 - Liabilities
  nextPage();
  slideTitle("04 - Kewajiban", totals.liabilities > 0 ? "Kewajiban perlu dilihat bersama jadwal bayar" : "Tidak ada kewajiban aktif", "Saldo historis dihitung sampai akhir bulan pilihan; jadwal memakai data terakhir yang tersimpan.");
  setText(13, MUTED, "bold"); text("TOTAL KEWAJIBAN", margin, 172);
  setText(38, totals.liabilities > 0 ? NEGATIVE : BRAND, "bold"); text(valueText(totals.liabilities), margin, 218);
  setText(12, MUTED); text(`${liabilityAccounts.length} akun kewajiban teratas`, margin, 244);
  liabilityAccounts.forEach((account, index) => {
    const y = 292 + index * 34;
    setText(12, INK, "bold"); text(account.name, margin, y, { maxWidth: 220 });
    setText(12, NEGATIVE, "bold"); text(valueText(account.balance), 360, y, { align: "right" });
  });
  fill([255, 255, 255]); line(BORDER);
  doc.roundedRect(455, 150, 451, 290, 12, 12, "FD");
  setText(12, BRAND, "bold"); text("JADWAL BERIKUTNYA", 478, 179);
  visibleBills.forEach((bill, index) => {
    const y = 220 + index * 42;
    setText(11, INK, "bold"); text(bill.name, 478, y, { maxWidth: 210 });
    setText(9, MUTED); text(displayDate(bill.dueDate), 478, y + 15);
    setText(11, INK, "bold"); text(valueText(bill.amount), 882, y, { align: "right" });
  });
  if (!visibleBills.length) { setText(12, MUTED); text("Tidak ada jadwal aktif.", 478, 224); }
  footer();

  // 6 - Goals and investments
  nextPage();
  slideTitle("05 - Pertumbuhan", "Surplus menjadi berarti ketika diberi tujuan", "Lihat kemajuan target dan aset investasi dalam satu pandangan.");
  setText(12, BRAND, "bold"); text("TARGET FINANSIAL", margin, 162);
  goals.forEach((goal, index) => {
    const progress = goal.target > 0 ? Math.min(100, goal.current / goal.target * 100) : 0;
    const y = 200 + index * 62;
    setText(12, INK, "bold"); text(goal.name, margin, y, { maxWidth: 200 });
    setText(10, MUTED); text(`${progress.toFixed(0)}% - ${valueText(goal.current)}`, margin, y + 18);
    fill([226, 234, 231]); doc.roundedRect(280, y - 10, 170, 12, 6, 6, "F");
    fill(BRAND); doc.roundedRect(280, y - 10, Math.max(4, 170 * progress / 100), 12, 6, 6, "F");
  });
  if (!goals.length) { setText(13, MUTED); text("Belum ada target aktif.", margin, 210); }
  fill([255, 255, 255]); line(BORDER);
  doc.roundedRect(510, 146, 396, 292, 12, 12, "FD");
  setText(12, BRAND, "bold"); text("PORTOFOLIO INVESTASI", 534, 177);
  investments.forEach((asset, index) => {
    const y = 220 + index * 48;
    setText(11, INK, "bold"); text(`${asset.name}${asset.ticker ? ` (${asset.ticker})` : ""}`, 534, y, { maxWidth: 210 });
    setText(9, asset.unrealizedPl >= 0 ? BRAND : NEGATIVE); text(`P/L ${valueText(asset.unrealizedPl)}`, 534, y + 15);
    setText(11, INK, "bold"); text(valueText(asset.marketValue), 882, y, { align: "right" });
  });
  if (!investments.length) { setText(13, MUTED); text("Belum ada aset investasi.", 534, 224); }
  footer();

  // 7 - Actions
  nextPage(true);
  setText(10, [106, 220, 185], "bold"); text("06 - PRIORITAS BULAN BERIKUTNYA", margin, 66);
  setText(42, [255, 255, 255], "bold"); text("Tiga keputusan berdampak besar", margin, 116, { maxWidth: 800 });
  setText(14, [184, 215, 205]); text("Gunakan hasil review ini sebagai dasar tindakan, bukan sekadar arsip.", margin, 145);
  recommendationRows.slice(0, 3).forEach((item, index) => {
    const y = 198 + index * 88;
    fill(index === 0 ? [20, 117, 96] : [20, 70, 59]);
    doc.roundedRect(margin, y, width - margin * 2, 68, 10, 10, "F");
    setText(20, [115, 229, 194], "bold"); text(String(index + 1).padStart(2, "0"), margin + 18, y + 42);
    setText(16, [255, 255, 255], "bold"); text(item.title, margin + 70, y + 28);
    setText(11, [190, 220, 211]); text(item.detail, margin + 70, y + 48, { maxWidth: width - margin * 2 - 100 });
  });
  footer(true);

  return {
    bytes: new Uint8Array(doc.output("arraybuffer")),
    filename: financePresentationPdfFilename(input.profile.storeName, input.period),
    pageCount: doc.getNumberOfPages(),
  };
}
