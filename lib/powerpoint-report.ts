import PptxGenJS from "pptxgenjs";
import type {
  Account,
  Bill,
  Budget,
  Goal,
  InvestmentAsset,
  InvestmentTransaction,
  Transaction,
} from "./finance";
import { accountSummary, budgetSpent, formatIDR, formatMonthLabel, monthlySummary } from "./finance";
import { installmentAmountAt } from "./installment-phases";

// tsx exposes the CommonJS package as { default } while the browser bundler
// exposes the constructor directly. Normalize both shapes in one place.
const PowerPointConstructor = ((PptxGenJS as unknown as { default?: typeof PptxGenJS }).default ?? PptxGenJS);

export type MonthlyPowerPointInput = {
  period: string;
  profile: { name: string; storeName: string; currency: string; timezone: string };
  transactions: Transaction[];
  accounts: Account[];
  budgets: Budget[];
  goals: Goal[];
  bills: Bill[];
  investmentAssets: InvestmentAsset[];
  investmentTransactions: InvestmentTransaction[];
  privacy?: boolean;
  generatedAt?: string;
};

export type GeneratedMonthlyPowerPoint = {
  presentation: PptxGenJS;
  filename: string;
  slideCount: number;
};

const COLORS = {
  forest: "0B3D33",
  brand: "126B59",
  mint: "49C4A5",
  mintSoft: "DFF4ED",
  paper: "F5F8F6",
  white: "FFFFFF",
  ink: "172821",
  muted: "65756E",
  border: "D9E4DF",
  expense: "D9757B",
  expenseSoft: "F7E6E7",
  gold: "D6A343",
  blue: "5579B9",
} as const;

type Slide = PptxGenJS.Slide;

function safeFilenamePart(value: string) {
  return value.replace(/[^A-Za-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || "Financial-Planner";
}

export function financePowerPointFilename(storeName: string, period: string) {
  return `${safeFilenamePart(storeName)}_Presentasi_${period}.pptx`;
}

function money(value: number, privacy = false) {
  return privacy ? "Rp ••••••••" : formatIDR(Math.round(value));
}

function previousMonth(period: string) {
  const date = new Date(`${period}-01T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() - 1);
  return date.toISOString().slice(0, 7);
}

function monthOffset(fromPeriod: string, toPeriod: string) {
  const [fromYear, fromMonth] = fromPeriod.split("-").map(Number);
  const [toYear, toMonth] = toPeriod.split("-").map(Number);
  return (toYear - fromYear) * 12 + toMonth - fromMonth;
}

function billForPeriod(bill: Bill, period: string) {
  const startPeriod = (bill.startDueDate || bill.dueDate).slice(0, 7);
  const offset = monthOffset(startPeriod, period);
  if (offset < 0) return null;
  if (bill.frequency !== "monthly" && bill.dueDate.slice(0, 7) !== period) return null;
  if (bill.completed || (bill.durationMonths && offset >= bill.durationMonths)) return null;
  return {
    ...bill,
    amount: installmentAmountAt(bill, offset),
    paidInPeriod: bill.lastPaidPeriod === period || (bill.dueDate.slice(0, 7) === period && bill.paid),
  };
}

function percentageChange(current: number, previous: number) {
  if (!previous) return current ? null : 0;
  return (current - previous) / Math.abs(previous) * 100;
}

function addText(slide: Slide, text: string, x: number, y: number, w: number, h: number, options: PptxGenJS.TextPropsOptions = {}) {
  slide.addText(text, {
    x, y, w, h,
    fontFace: "Aptos",
    fontSize: 16,
    color: COLORS.ink,
    margin: 0,
    breakLine: false,
    fit: "shrink",
    valign: "mid",
    ...options,
  });
}

function addBrand(slide: Slide, light = false) {
  slide.addShape("roundRect", {
    x: 0.58, y: 0.42, w: 0.5, h: 0.5,
    rectRadius: 0.08,
    fill: { color: light ? COLORS.white : COLORS.brand },
    line: { color: light ? COLORS.white : COLORS.brand },
  });
  addText(slide, "FP", 0.58, 0.42, 0.5, 0.5, {
    bold: true, fontSize: 12, align: "center", color: light ? COLORS.brand : COLORS.white,
  });
}

function addFooter(slide: Slide, storeName: string, period: string, page: number, light = false) {
  const color = light ? "B6D5CA" : COLORS.muted;
  addText(slide, `${storeName} · ${formatMonthLabel(period)}`, 0.58, 7.12, 5.5, 0.18, { fontSize: 9, color });
  addText(slide, String(page).padStart(2, "0"), 12.15, 7.12, 0.58, 0.18, { fontSize: 9, color, align: "right" });
}

function addSlideTitle(slide: Slide, eyebrow: string, title: string, subtitle: string, page: number, input: MonthlyPowerPointInput) {
  addBrand(slide);
  addText(slide, eyebrow.toUpperCase(), 1.28, 0.41, 4.8, 0.2, { fontSize: 10, bold: true, color: COLORS.brand, charSpacing: 1.6 });
  addText(slide, title, 0.58, 1.12, 11.8, 0.62, { fontSize: 35, bold: true, color: COLORS.ink });
  addText(slide, subtitle, 0.58, 1.78, 11.8, 0.38, { fontSize: 16, color: COLORS.muted });
  addFooter(slide, input.profile.storeName, input.period, page);
}

function addMetric(slide: Slide, label: string, value: string, x: number, y: number, w: number, tone: string = COLORS.ink, note?: string) {
  addText(slide, label.toUpperCase(), x, y, w, 0.2, { fontSize: 9, bold: true, color: COLORS.muted, charSpacing: 1.1 });
  addText(slide, value, x, y + 0.28, w, 0.48, { fontSize: 24, bold: true, color: tone });
  if (note) addText(slide, note, x, y + 0.78, w, 0.25, { fontSize: 10, color: COLORS.muted });
}

function addProgressBar(slide: Slide, x: number, y: number, w: number, value: number, max: number, color: string) {
  slide.addShape("roundRect", { x, y, w, h: 0.11, rectRadius: 0.04, fill: { color: COLORS.border }, line: { color: COLORS.border } });
  const width = Math.max(0.04, Math.min(w, max > 0 ? value / max * w : 0.04));
  slide.addShape("roundRect", { x, y, w: width, h: 0.11, rectRadius: 0.04, fill: { color }, line: { color } });
}

function expenseTotals(transactions: Transaction[]) {
  return transactions.reduce<Record<string, number>>((result, item) => {
    const direction = item.type === "expense" ? 1 : item.type === "refund" ? -1 : 0;
    if (!direction) return result;
    const allocations = item.splits?.length ? item.splits : [{ category: item.category, amount: item.amount }];
    allocations.forEach((split) => { result[split.category] = (result[split.category] ?? 0) + split.amount * direction; });
    return result;
  }, {});
}

function buildRecommendations(input: MonthlyPowerPointInput, summary: ReturnType<typeof monthlySummary>, topExpense?: [string, number], overdueBills = 0) {
  const items: Array<{ title: string; detail: string; tone: string }> = [];
  if (summary.cashflow < 0) {
    items.push({ title: "Pulihkan arus kas", detail: `Tutup defisit ${money(Math.abs(summary.cashflow), input.privacy)} sebelum menambah komitmen baru.`, tone: COLORS.expense });
  } else if (summary.savingsRate < 20 && summary.income > 0) {
    items.push({ title: "Naikkan ruang tabungan", detail: `Savings rate ${summary.savingsRate.toFixed(1)}%. Arahkan kenaikan bertahap menuju 20%.`, tone: COLORS.gold });
  } else {
    items.push({ title: "Pertahankan surplus", detail: `Arus kas positif ${money(Math.max(0, summary.cashflow), input.privacy)} memberi ruang untuk target dan dana darurat.`, tone: COLORS.brand });
  }
  if (topExpense) items.push({ title: `Tinjau ${topExpense[0]}`, detail: `Kategori terbesar bulan ini mencapai ${money(topExpense[1], input.privacy)}. Periksa transaksi yang paling mudah dikurangi.`, tone: COLORS.blue });
  else items.push({ title: "Lengkapi pencatatan", detail: "Belum ada pengeluaran selesai pada periode ini. Pastikan transaksi bulan tersebut sudah masuk.", tone: COLORS.blue });
  if (overdueBills > 0) items.push({ title: "Selesaikan kewajiban", detail: `${overdueBills} tagihan periode ini belum ditandai dibayar. Cocokkan dengan rekening sumber.`, tone: COLORS.expense });
  else items.push({ title: "Siapkan bulan berikutnya", detail: "Tidak ada tagihan periode ini yang tertinggal. Sisihkan komitmen berikutnya sejak awal bulan.", tone: COLORS.brand });
  return items.slice(0, 3);
}

export function buildMonthlyFinancePowerPoint(input: MonthlyPowerPointInput): GeneratedMonthlyPowerPoint {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(input.period)) throw new Error("Periode presentasi harus berformat YYYY-MM.");

  const pptx = new PowerPointConstructor();
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = input.profile.name;
  pptx.company = input.profile.storeName;
  pptx.subject = `Laporan keuangan ${formatMonthLabel(input.period)}`;
  pptx.title = `${input.profile.storeName} — Laporan ${formatMonthLabel(input.period)}`;
  pptx.revision = "1";
  pptx.theme = {
    headFontFace: "Aptos Display",
    bodyFontFace: "Aptos",
    lang: "id-ID",
  };

  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const monthTransactions = input.transactions.filter((item) => item.date.startsWith(input.period) && item.status === "completed" && !item.deletedAt);
  const summary = monthlySummary(monthTransactions, input.period);
  const previousSummary = monthlySummary(input.transactions, previousMonth(input.period));
  const investmentValue = input.investmentAssets.filter((item) => item.active).reduce((sum, item) => sum + item.marketValue, 0);
  const totals = accountSummary(input.accounts, investmentValue);
  const expensesByCategory = Object.entries(expenseTotals(monthTransactions)).filter(([, value]) => value > 0).sort((a, b) => b[1] - a[1]);
  const topExpense = expensesByCategory[0];
  const periodBudgets = input.budgets.filter((budget) => !budget.period || budget.period === input.period);
  const periodBills = input.bills.map((bill) => billForPeriod(bill, input.period)).filter((bill): bill is NonNullable<ReturnType<typeof billForPeriod>> => Boolean(bill));
  const unpaidBills = periodBills.filter((bill) => !bill.paidInPeriod);
  const realizedInvestment = input.investmentTransactions.filter((item) => item.date.startsWith(input.period) && item.type === "sell").reduce((sum, item) => sum + item.realizedPl, 0);
  const recommendations = buildRecommendations(input, summary, topExpense, unpaidBills.length);

  // 01 — Cover
  {
    const slide = pptx.addSlide();
    slide.background = { color: COLORS.forest };
    addBrand(slide, true);
    addText(slide, "FINANCIAL PLANNER", 1.28, 0.42, 4.3, 0.42, { fontSize: 13, bold: true, color: "CDE9DF", charSpacing: 2 });
    addText(slide, "Laporan keuangan", 0.72, 1.48, 8.5, 0.72, { fontSize: 50, bold: true, color: COLORS.white });
    addText(slide, formatMonthLabel(input.period), 0.72, 2.21, 8.5, 0.72, { fontSize: 50, bold: true, color: COLORS.mint });
    addText(slide, `Ringkasan kondisi, pola arus kas, kewajiban, dan prioritas finansial ${input.profile.name}.`, 0.75, 3.23, 6.6, 0.82, { fontSize: 19, color: "D7E7E1", breakLine: true });
    slide.addShape("line", { x: 0.75, y: 4.45, w: 5.75, h: 0, line: { color: "3C6B5E", width: 1.2 } });
    addText(slide, summary.cashflow >= 0 ? "BULAN DITUTUP DENGAN SURPLUS" : "BULAN DITUTUP DENGAN DEFISIT", 0.75, 4.7, 5.9, 0.28, { fontSize: 11, bold: true, color: summary.cashflow >= 0 ? COLORS.mint : "F1A2A7", charSpacing: 1.2 });
    addText(slide, money(summary.cashflow, input.privacy), 0.75, 5.05, 5.9, 0.58, { fontSize: 32, bold: true, color: COLORS.white });
    slide.addShape("arc", { x: 9.0, y: 0.92, w: 4.75, h: 4.75, adjustPoint: 0.35, rotate: 20, fill: { color: COLORS.forest, transparency: 100 }, line: { color: "2A6858", transparency: 10, width: 1.2 } });
    slide.addShape("arc", { x: 9.5, y: 1.42, w: 3.75, h: 3.75, adjustPoint: 0.35, rotate: 20, fill: { color: COLORS.forest, transparency: 100 }, line: { color: COLORS.mint, transparency: 45, width: 1.5 } });
    addText(slide, `Dibuat ${new Intl.DateTimeFormat("id-ID", { dateStyle: "long", timeZone: input.profile.timezone }).format(new Date(generatedAt))}`, 0.75, 6.56, 6.8, 0.24, { fontSize: 10, color: "A9C8BE" });
    addFooter(slide, input.profile.storeName, input.period, 1, true);
  }

  // 02 — Executive summary
  {
    const slide = pptx.addSlide(); slide.background = { color: COLORS.paper };
    addSlideTitle(slide, "Ringkasan eksekutif", summary.cashflow >= 0 ? "Arus kas bulan ini memberi ruang untuk maju" : "Pengeluaran bulan ini perlu segera dikendalikan", "Angka arus kas hanya memakai transaksi selesai pada bulan yang dipilih; transfer internal tidak dihitung dua kali.", 2, input);
    const headline = summary.cashflow >= 0 ? `Surplus ${money(summary.cashflow, input.privacy)}` : `Defisit ${money(Math.abs(summary.cashflow), input.privacy)}`;
    addText(slide, headline, 0.62, 2.55, 7.15, 0.78, { fontSize: 42, bold: true, color: summary.cashflow >= 0 ? COLORS.brand : COLORS.expense });
    const incomeChange = percentageChange(summary.income, previousSummary.income);
    addText(slide, incomeChange === null ? "Periode sebelumnya belum memiliki pemasukan pembanding." : `Pemasukan ${incomeChange >= 0 ? "naik" : "turun"} ${Math.abs(incomeChange).toFixed(1)}% dibanding ${formatMonthLabel(previousMonth(input.period))}.`, 0.64, 3.32, 6.75, 0.42, { fontSize: 15, color: COLORS.muted });
    slide.addShape("line", { x: 0.62, y: 4.12, w: 12.1, h: 0, line: { color: COLORS.border, width: 1 } });
    addMetric(slide, "Pemasukan", money(summary.income, input.privacy), 0.65, 4.48, 3.05, COLORS.brand, `${monthTransactions.filter((item) => item.type === "income").length} transaksi masuk`);
    addMetric(slide, "Pengeluaran", money(summary.expense, input.privacy), 4.05, 4.48, 3.05, COLORS.expense, `${monthTransactions.filter((item) => item.type === "expense").length} transaksi keluar`);
    addMetric(slide, "Savings rate", `${summary.savingsRate.toFixed(1)}%`, 7.45, 4.48, 2.2, summary.savingsRate >= 20 ? COLORS.brand : COLORS.gold, "dari pemasukan bulan ini");
    addMetric(slide, "Kekayaan bersih", money(totals.netWorth, input.privacy), 10.0, 4.48, 2.7, totals.netWorth >= 0 ? COLORS.ink : COLORS.expense, "posisi saat presentasi dibuat");
    const topLine = topExpense ? `${topExpense[0]} menyerap porsi pengeluaran terbesar: ${money(topExpense[1], input.privacy)}.` : "Belum ada pola pengeluaran yang dapat dianalisis pada bulan ini.";
    slide.addShape("roundRect", { x: 0.62, y: 6.15, w: 12.08, h: 0.58, rectRadius: 0.08, fill: { color: COLORS.mintSoft }, line: { color: COLORS.mintSoft } });
    addText(slide, topLine, 0.92, 6.26, 11.48, 0.31, { fontSize: 15, bold: true, color: COLORS.forest });
  }

  // 03 — Weekly cashflow
  {
    const slide = pptx.addSlide(); slide.background = { color: COLORS.paper };
    addSlideTitle(slide, "Arus kas", "Kapan uang masuk dan keluar sepanjang bulan?", "Empat kelompok tanggal memperlihatkan ritme arus kas, bukan hanya total akhirnya.", 3, input);
    const buckets = [
      { label: "1–7", income: 0, expense: 0 },
      { label: "8–14", income: 0, expense: 0 },
      { label: "15–21", income: 0, expense: 0 },
      { label: "22–akhir", income: 0, expense: 0 },
    ];
    monthTransactions.forEach((item) => {
      const day = Number(item.date.slice(8, 10));
      const bucket = buckets[Math.min(3, Math.floor((day - 1) / 7))];
      if (item.type === "income") bucket.income += item.amount;
      if (item.type === "expense") bucket.expense += item.amount;
      if (item.type === "refund") bucket.expense -= item.amount;
    });
    const max = Math.max(1, ...buckets.flatMap((item) => [item.income, item.expense]));
    const chartX = 0.72; const chartY = 2.55; const chartW = 8.05; const chartH = 3.62;
    [0, 0.5, 1].forEach((ratio) => slide.addShape("line", { x: chartX, y: chartY + chartH * ratio, w: chartW, h: 0, line: { color: COLORS.border, width: 0.8 } }));
    buckets.forEach((bucket, index) => {
      const groupX = chartX + 0.75 + index * 1.92;
      const incomeH = bucket.income / max * 2.95;
      const expenseH = Math.max(0, bucket.expense) / max * 2.95;
      slide.addShape("roundRect", { x: groupX, y: chartY + chartH - incomeH, w: 0.38, h: Math.max(0.05, incomeH), rectRadius: 0.04, fill: { color: COLORS.mint }, line: { color: COLORS.mint } });
      slide.addShape("roundRect", { x: groupX + 0.5, y: chartY + chartH - expenseH, w: 0.38, h: Math.max(0.05, expenseH), rectRadius: 0.04, fill: { color: COLORS.expense }, line: { color: COLORS.expense } });
      addText(slide, bucket.label, groupX - 0.18, chartY + chartH + 0.18, 1.45, 0.28, { fontSize: 11, align: "center", color: COLORS.muted });
    });
    addText(slide, "MASUK", 0.76, 6.56, 0.82, 0.2, { fontSize: 9, bold: true, color: COLORS.brand });
    slide.addShape("rect", { x: 1.55, y: 6.60, w: 0.12, h: 0.12, fill: { color: COLORS.mint }, line: { color: COLORS.mint } });
    addText(slide, "KELUAR", 1.86, 6.56, 0.96, 0.2, { fontSize: 9, bold: true, color: COLORS.expense });
    slide.addShape("rect", { x: 2.75, y: 6.60, w: 0.12, h: 0.12, fill: { color: COLORS.expense }, line: { color: COLORS.expense } });
    slide.addShape("roundRect", { x: 9.32, y: 2.55, w: 3.38, h: 3.82, rectRadius: 0.12, fill: { color: COLORS.forest }, line: { color: COLORS.forest } });
    addText(slide, "HASIL BULAN INI", 9.72, 2.95, 2.58, 0.23, { fontSize: 10, bold: true, color: "A8D8C8", charSpacing: 1.1 });
    addText(slide, money(summary.cashflow, input.privacy), 9.72, 3.42, 2.58, 0.62, { fontSize: 27, bold: true, color: summary.cashflow >= 0 ? COLORS.mint : "F0A0A5" });
    addText(slide, `${summary.savingsRate.toFixed(1)}% dari pemasukan tersisa sebagai arus kas bersih.`, 9.72, 4.22, 2.48, 0.72, { fontSize: 15, color: COLORS.white, breakLine: true });
    addText(slide, `${monthTransactions.length} transaksi selesai dianalisis`, 9.72, 5.6, 2.48, 0.35, { fontSize: 11, color: "B8D2C9" });
  }

  // 04 — Spending pattern
  {
    const slide = pptx.addSlide(); slide.background = { color: COLORS.paper };
    addSlideTitle(slide, "Pola pengeluaran", topExpense ? `${topExpense[0]} menjadi pengeluaran terbesar` : "Belum ada pengeluaran yang dapat dibandingkan", "Kategori dan transaksi di bawah hanya berasal dari transaksi selesai pada bulan laporan.", 4, input);
    const categories = expensesByCategory.slice(0, 5);
    const maxCategory = Math.max(1, ...categories.map(([, value]) => value));
    addText(slide, "5 KATEGORI TERBESAR", 0.66, 2.5, 5.7, 0.22, { fontSize: 10, bold: true, color: COLORS.brand, charSpacing: 1.2 });
    if (!categories.length) {
      addText(slide, "Belum ada pengeluaran selesai pada periode ini.", 0.66, 3.08, 5.7, 0.62, { fontSize: 20, color: COLORS.muted });
    }
    categories.forEach(([name, value], index) => {
      const y = 2.98 + index * 0.73;
      addText(slide, name, 0.66, y, 2.25, 0.24, { fontSize: 13, bold: true });
      addText(slide, money(value, input.privacy), 4.12, y, 2.02, 0.24, { fontSize: 12, bold: true, align: "right", color: COLORS.expense });
      addProgressBar(slide, 0.66, y + 0.36, 5.48, value, maxCategory, COLORS.expense);
    });
    slide.addShape("line", { x: 6.57, y: 2.48, w: 0, h: 3.72, line: { color: COLORS.border, width: 1 } });
    addText(slide, "TRANSAKSI KELUAR TERBESAR", 7.02, 2.5, 5.57, 0.22, { fontSize: 10, bold: true, color: COLORS.brand, charSpacing: 1.2 });
    const topTransactions = monthTransactions.filter((item) => item.type === "expense").sort((a, b) => b.amount - a.amount).slice(0, 5);
    if (!topTransactions.length) addText(slide, "Belum ada transaksi keluar pada periode ini.", 7.02, 3.08, 5.4, 0.62, { fontSize: 20, color: COLORS.muted });
    topTransactions.forEach((item, index) => {
      const y = 2.96 + index * 0.68;
      addText(slide, String(index + 1).padStart(2, "0"), 7.02, y, 0.38, 0.32, { fontSize: 10, bold: true, color: COLORS.brand });
      addText(slide, item.title, 7.52, y - 0.03, 3.2, 0.3, { fontSize: 14, bold: true });
      addText(slide, `${item.category} · ${item.date.slice(8, 10)} ${formatMonthLabel(input.period).split(" ")[0]}`, 7.52, y + 0.27, 3.35, 0.2, { fontSize: 9, color: COLORS.muted });
      addText(slide, money(item.amount, input.privacy), 10.88, y, 1.65, 0.28, { fontSize: 12, bold: true, align: "right", color: COLORS.expense });
      slide.addShape("line", { x: 7.02, y: y + 0.55, w: 5.52, h: 0, line: { color: COLORS.border, width: 0.6 } });
    });
  }

  // 05 — Balance position
  {
    const slide = pptx.addSlide(); slide.background = { color: COLORS.paper };
    addSlideTitle(slide, "Posisi keuangan", totals.netWorth >= 0 ? "Aset masih berada di atas kewajiban" : "Kewajiban melampaui aset yang tercatat", "Saldo akun adalah posisi terbaru saat presentasi dibuat; arus kas pada slide sebelumnya tetap khusus bulan laporan.", 5, input);
    addMetric(slide, "Total aset", money(totals.assets, input.privacy), 0.68, 2.5, 3.3, COLORS.brand, `${input.accounts.filter((item) => !item.liability).length} akun aset`);
    addMetric(slide, "Total kewajiban", money(totals.liabilities, input.privacy), 4.23, 2.5, 3.3, COLORS.expense, `${input.accounts.filter((item) => item.liability).length} akun kewajiban`);
    addMetric(slide, "Kekayaan bersih", money(totals.netWorth, input.privacy), 8.0, 2.5, 4.55, totals.netWorth >= 0 ? COLORS.ink : COLORS.expense, `Portofolio investasi ${money(investmentValue, input.privacy)}`);
    const balanceMax = Math.max(1, totals.assets, totals.liabilities);
    addProgressBar(slide, 0.68, 3.74, 5.7, totals.assets, balanceMax, COLORS.mint);
    addProgressBar(slide, 0.68, 4.15, 5.7, totals.liabilities, balanceMax, COLORS.expense);
    addText(slide, "Aset", 6.55, 3.60, 0.8, 0.25, { fontSize: 11, bold: true, color: COLORS.brand });
    addText(slide, "Kewajiban", 6.55, 4.02, 1.15, 0.25, { fontSize: 11, bold: true, color: COLORS.expense });
    slide.addShape("line", { x: 0.68, y: 4.68, w: 11.98, h: 0, line: { color: COLORS.border, width: 1 } });
    addText(slide, "AKUN TERBESAR", 0.68, 4.98, 4.4, 0.2, { fontSize: 10, bold: true, color: COLORS.brand, charSpacing: 1.2 });
    const largestAccounts = [...input.accounts].sort((a, b) => b.balance - a.balance).slice(0, 6);
    largestAccounts.forEach((account, index) => {
      const column = index % 3; const row = Math.floor(index / 3); const x = 0.68 + column * 4.02; const y = 5.38 + row * 0.68;
      addText(slide, account.name, x, y, 2.18, 0.26, { fontSize: 13, bold: true });
      addText(slide, account.liability ? "Kewajiban" : account.type, x, y + 0.27, 1.55, 0.2, { fontSize: 9, color: COLORS.muted });
      addText(slide, money(account.balance, input.privacy), x + 2.25, y, 1.35, 0.27, { fontSize: 12, bold: true, align: "right", color: account.liability ? COLORS.expense : COLORS.ink });
    });
    if (realizedInvestment !== 0) addText(slide, `Realized P/L investasi bulan ini: ${money(realizedInvestment, input.privacy)}`, 8.25, 4.02, 4.35, 0.28, { fontSize: 12, bold: true, align: "right", color: realizedInvestment >= 0 ? COLORS.brand : COLORS.expense });
  }

  // 06 — Commitments
  {
    const slide = pptx.addSlide(); slide.background = { color: COLORS.paper };
    addSlideTitle(slide, "Rencana dan kewajiban", unpaidBills.length ? `${unpaidBills.length} tagihan bulan ini masih perlu perhatian` : "Komitmen bulan ini terkendali", "Anggaran dan tagihan disaring untuk periode laporan; progress target adalah status saat presentasi dibuat.", 6, input);
    addText(slide, "ANGGARAN BULAN INI", 0.68, 2.48, 5.72, 0.22, { fontSize: 10, bold: true, color: COLORS.brand, charSpacing: 1.2 });
    const budgetRows = periodBudgets.map((budget) => ({ budget, spent: budgetSpent(input.transactions, budget.category, input.period) })).sort((a, b) => b.spent / Math.max(1, b.budget.limit) - a.spent / Math.max(1, a.budget.limit)).slice(0, 4);
    if (!budgetRows.length) addText(slide, "Belum ada anggaran untuk periode ini.", 0.68, 3.05, 5.72, 0.52, { fontSize: 19, color: COLORS.muted });
    budgetRows.forEach(({ budget, spent }, index) => {
      const y = 2.95 + index * 0.82; const ratio = budget.limit > 0 ? spent / budget.limit : 0;
      addText(slide, budget.category, 0.68, y, 2.2, 0.25, { fontSize: 13, bold: true });
      addText(slide, `${money(spent, input.privacy)} / ${money(budget.limit, input.privacy)}`, 3.1, y, 2.98, 0.25, { fontSize: 11, bold: true, align: "right", color: ratio > 1 ? COLORS.expense : COLORS.ink });
      addProgressBar(slide, 0.68, y + 0.37, 5.4, Math.min(spent, budget.limit), Math.max(1, budget.limit), ratio > 1 ? COLORS.expense : ratio >= 0.8 ? COLORS.gold : COLORS.mint);
    });
    slide.addShape("line", { x: 6.56, y: 2.44, w: 0, h: 3.55, line: { color: COLORS.border, width: 1 } });
    addText(slide, "TAGIHAN JATUH TEMPO", 7.02, 2.48, 5.55, 0.22, { fontSize: 10, bold: true, color: COLORS.brand, charSpacing: 1.2 });
    if (!periodBills.length) addText(slide, "Tidak ada tagihan terjadwal pada periode ini.", 7.02, 3.05, 5.45, 0.52, { fontSize: 19, color: COLORS.muted });
    periodBills.slice(0, 5).forEach((bill, index) => {
      const y = 2.92 + index * 0.63;
      slide.addShape("ellipse", { x: 7.02, y: y + 0.04, w: 0.16, h: 0.16, fill: { color: bill.paidInPeriod ? COLORS.mint : COLORS.expense }, line: { color: bill.paidInPeriod ? COLORS.mint : COLORS.expense } });
      addText(slide, bill.name, 7.35, y - 0.02, 3.15, 0.26, { fontSize: 13, bold: true });
      addText(slide, bill.paidInPeriod ? "Dibayar" : `Jatuh tempo ${bill.dueDate.slice(8, 10)}`, 7.35, y + 0.26, 2.35, 0.19, { fontSize: 9, color: bill.paidInPeriod ? COLORS.brand : COLORS.expense });
      addText(slide, money(bill.amount, input.privacy), 10.65, y, 1.82, 0.26, { fontSize: 12, bold: true, align: "right" });
    });
    const nearestGoal = [...input.goals].filter((goal) => goal.deadline >= `${input.period}-01`).sort((a, b) => a.deadline.localeCompare(b.deadline))[0];
    slide.addShape("roundRect", { x: 0.68, y: 6.28, w: 11.95, h: 0.48, rectRadius: 0.06, fill: { color: nearestGoal ? COLORS.mintSoft : "EDF1EF" }, line: { color: nearestGoal ? COLORS.mintSoft : "EDF1EF" } });
    addText(slide, nearestGoal ? `Target terdekat: ${nearestGoal.name} — ${money(nearestGoal.current, input.privacy)} dari ${money(nearestGoal.target, input.privacy)} (${nearestGoal.target > 0 ? (nearestGoal.current / nearestGoal.target * 100).toFixed(1) : "0.0"}%).` : "Belum ada target aktif. Tambahkan target agar surplus bulanan memiliki tujuan yang jelas.", 0.96, 6.36, 11.38, 0.28, { fontSize: 13, bold: true, color: COLORS.forest });
  }

  // 07 — Actions
  {
    const slide = pptx.addSlide(); slide.background = { color: COLORS.forest };
    addBrand(slide, true);
    addText(slide, "PRIORITAS BERIKUTNYA", 1.28, 0.42, 5.2, 0.32, { fontSize: 11, bold: true, color: "B8DCCF", charSpacing: 1.8 });
    addText(slide, "Tiga langkah untuk bulan depan", 0.72, 1.28, 10.7, 0.72, { fontSize: 40, bold: true, color: COLORS.white });
    addText(slide, "Rekomendasi dibuat secara deterministik dari data bulan laporan—tanpa mengirim data ke AI atau pihak ketiga.", 0.74, 2.04, 10.8, 0.45, { fontSize: 16, color: "C7DBD4" });
    recommendations.forEach((item, index) => {
      const y = 2.95 + index * 1.05;
      addText(slide, String(index + 1).padStart(2, "0"), 0.74, y, 0.62, 0.36, { fontSize: 13, bold: true, color: item.tone });
      addText(slide, item.title, 1.58, y - 0.05, 3.5, 0.4, { fontSize: 21, bold: true, color: COLORS.white });
      addText(slide, item.detail, 5.2, y - 0.04, 7.2, 0.5, { fontSize: 15, color: "D7E4DF", breakLine: true });
      if (index < recommendations.length - 1) slide.addShape("line", { x: 0.74, y: y + 0.72, w: 11.65, h: 0, line: { color: "315F53", width: 0.8 } });
    });
    slide.addShape("roundRect", { x: 0.74, y: 6.3, w: 11.65, h: 0.48, rectRadius: 0.06, fill: { color: "164B3F" }, line: { color: "164B3F" } });
    addText(slide, "Gunakan presentasi ini sebagai bahan review. Cocokkan keputusan penting dengan rekening dan dokumen sumber.", 1.02, 6.38, 11.1, 0.28, { fontSize: 12, color: "CBE1D9", align: "center" });
    addFooter(slide, input.profile.storeName, input.period, 7, true);
  }

  return {
    presentation: pptx,
    filename: financePowerPointFilename(input.profile.storeName, input.period),
    slideCount: 7,
  };
}
