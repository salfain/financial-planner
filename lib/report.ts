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
import { accountSummary, budgetSpent, formatIDR, formatMonthLabel, monthlySummary } from "./finance";

export const REPORT_SECTIONS = [
  "summary",
  "cashflow",
  "categories",
  "accounts",
  "budgets",
  "bills",
  "goals",
  "investments",
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
  return value.replace(/[^A-Za-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || "VINN-STORE";
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

export function financeCsvFilename(storeName: string, period: string) {
  return `${safeFilenamePart(storeName)}_Transaksi_${period}.csv`;
}

export function buildFinanceCsv(input: Pick<FinanceReportInput, "period" | "transactions">) {
  const escape = (value: unknown) => {
    const text = String(value ?? "");
    const protectedText = /^[=+\-@]/.test(text) ? `'${text}` : text;
    return `"${protectedText.replaceAll('"', '""')}"`;
  };
  const rows: unknown[][] = [["Tanggal", "Tipe", "Deskripsi", "Merchant", "Kategori", "Akun", "Akun tujuan", "Nominal", "Status"]];
  input.transactions
    .filter((item) => item.date.startsWith(input.period) && !item.deletedAt)
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))
    .forEach((item) => rows.push([
      item.date,
      item.type,
      item.title,
      item.merchant ?? "",
      item.category,
      item.accountId,
      item.destinationAccountId ?? "",
      item.amount,
      item.status,
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
  const totals = accountSummary(input.accounts, investmentValue);
  const expensesByCategory = monthTransactions.filter((item) => item.type === "expense").reduce<Record<string, number>>((result, item) => {
    result[item.category] = (result[item.category] ?? 0) + item.amount;
    return result;
  }, {});
  const incomeByCategory = monthTransactions.filter((item) => item.type === "income").reduce<Record<string, number>>((result, item) => {
    result[item.category] = (result[item.category] ?? 0) + item.amount;
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
    doc.text(`${safePdfText(input.profile.storeName)} Financial OS`, margin, pageHeight - 8);
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
  doc.text("FINANCIAL OS", margin + 18, 20.5);
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
  doc.text("Dokumen ini dibuat dari data VINN STORE pada periode yang dipilih. Transfer internal tidak dihitung sebagai income/expense.", margin, 169, { maxWidth: contentWidth });
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
        item.category,
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
      input.budgets.map((budget) => {
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

  if (selected(input, "investments")) {
    sectionTitle("08 - Investasi", "Portofolio investasi", "Harga manual atau transaksi terakhir dapat bersifat delayed dan bukan harga real-time.");
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
