/**
 * Pembacaan rekening koran PDF menjadi record impor kanonik.
 *
 * Tabel rekening koran memakai posisi, bukan pemisah. Dua sifat penting:
 *
 * 1. Kolom KELUAR, MASUK, dan SALDO AKHIR rata kanan, dan hanya salah satu
 *    dari KELUAR/MASUK yang terisi per transaksi. Arah transaksi karena itu
 *    ditentukan oleh kolom tempat nominal berada, bukan oleh isi barisnya.
 * 2. Deskripsi transaksi mengapit baris tanggal: nama lawan transaksi berada
 *    satu baris di atas, jenis transaksi satu baris di bawah.
 *
 * Ekstraksi PDF-nya sendiri berada di pemanggil (pdfjs), sehingga modul ini
 * murni dan dapat diuji tanpa file PDF.
 */

export type PdfTextItem = { x: number; y: number; width: number; text: string };

export type BankStatementRow = {
  date: string;
  title: string;
  detail: string;
  direction: "in" | "out";
  amount: number;
  balance: number;
  /** Terisi bila selisih saldo berjalan tidak cocok dengan nominal baris ini. */
  warning?: string;
};

export type BankStatementParseResult = {
  bank: string;
  periodStart: string;
  periodEnd: string;
  openingBalance: number;
  closingBalance: number;
  rows: BankStatementRow[];
  warnings: string[];
};

const MONTHS: Record<string, number> = {
  JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, MEI: 5, JUN: 6,
  JUL: 7, AUG: 8, AGU: 8, SEP: 9, OCT: 10, OKT: 10, NOV: 11, DEC: 12, DES: 12,
};

/** Toleransi pencocokan tepi kanan kolom, dalam satuan poin PDF. */
const COLUMN_TOLERANCE = 14;

const pad = (value: number) => String(value).padStart(2, "0");
const right = (item: PdfTextItem) => item.x + item.width;

/** "1.969.877" -> 1969877. Rupiah pada rekening koran ini tidak memakai desimal. */
export function parseRupiah(value: string) {
  const digits = value.replace(/[^\d]/g, "");
  return digits ? Number(digits) : 0;
}

const isAmount = (text: string) => /^\d{1,3}(\.\d{3})*$/.test(text.trim());

/** Mengelompokkan item menjadi baris visual; y bisa meleset beberapa poin karena pembulatan font. */
export function groupIntoLines(items: PdfTextItem[], tolerance = 2): PdfTextItem[][] {
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x);
  const lines: PdfTextItem[][] = [];
  for (const item of sorted) {
    const line = lines[lines.length - 1];
    if (line && Math.abs(line[0].y - item.y) <= tolerance) line.push(item);
    else lines.push([item]);
  }
  return lines.map((line) => [...line].sort((a, b) => a.x - b.x));
}

export function isSeabankStatement(pages: PdfTextItem[][]) {
  const haystack = pages.flat().map((item) => item.text).join(" ");
  return haystack.includes("REKENING KORAN") && /SeaBank|RINCIAN TRANSAKSI/i.test(haystack);
}

/**
 * Header periode berbentuk "01 JUL 2026 sampai 31 JUL 2026". Baris transaksi
 * hanya memuat "01 JUL" tanpa tahun, jadi tahunnya diambil dari sini.
 */
function readPeriod(lines: PdfTextItem[][]) {
  for (const line of lines) {
    const text = line.map((item) => item.text).join(" ");
    const match = text.match(/(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})\s+sampai\s+(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})/);
    if (!match) continue;
    const from = MONTHS[match[2].toUpperCase()];
    const to = MONTHS[match[5].toUpperCase()];
    if (!from || !to) continue;
    return {
      periodStart: `${match[3]}-${pad(from)}-${pad(Number(match[1]))}`,
      periodEnd: `${match[6]}-${pad(to)}-${pad(Number(match[4]))}`,
    };
  }
  return null;
}

/**
 * Tepi kanan tiap kolom angka diambil dari baris header. Label "(IDR)" berakhir
 * tepat di tepi kanan kolomnya, sehingga jadi patokan yang stabil meski nominal
 * berubah panjang.
 */
function readColumns(lines: PdfTextItem[][]) {
  for (const line of lines) {
    const hasKeluar = line.some((item) => item.text.trim() === "KELUAR");
    const hasMasuk = line.some((item) => item.text.trim() === "MASUK");
    if (!hasKeluar || !hasMasuk) continue;
    const edges = line.filter((item) => /^\(?IDR\)?$/.test(item.text.trim())).map(right).sort((a, b) => a - b);
    if (edges.length >= 3) return { keluar: edges[0], masuk: edges[1], saldo: edges[2] };
  }
  return null;
}

type Anchor = {
  y: number;
  date: string;
  amount?: { value: number; column: "keluar" | "masuk" | "saldo" };
  balance?: number;
  parts: { y: number; text: string }[];
};

function columnOf(item: PdfTextItem, columns: { keluar: number; masuk: number; saldo: number }) {
  const edge = right(item);
  const candidates: Array<["keluar" | "masuk" | "saldo", number]> = [
    ["keluar", columns.keluar], ["masuk", columns.masuk], ["saldo", columns.saldo],
  ];
  let best: "keluar" | "masuk" | "saldo" | null = null;
  let bestDistance = COLUMN_TOLERANCE;
  for (const [name, target] of candidates) {
    const distance = Math.abs(edge - target);
    if (distance <= bestDistance) { best = name; bestDistance = distance; }
  }
  return best;
}

/**
 * Membaca rekening koran SeaBank.
 *
 * Arah transaksi diambil dari kolom tempat nominal berada, lalu diperiksa silang
 * terhadap selisih saldo berjalan. Baris yang tidak konsisten tetap dikembalikan
 * tetapi diberi peringatan, supaya pengguna melihat dan memutuskan alih-alih
 * diam-diam mengimpor angka yang salah.
 */
export function parseSeabankStatement(pages: PdfTextItem[][]): BankStatementParseResult {
  const warnings: string[] = [];
  const allLines = pages.map((items) => groupIntoLines(items));
  const flatLines = allLines.flat();
  const period = readPeriod(flatLines);
  const columns = readColumns(flatLines);
  if (!period) warnings.push("Periode rekening koran tidak ditemukan, tahun transaksi tidak dapat dipastikan.");
  if (!columns) warnings.push("Header kolom KELUAR/MASUK/SALDO AKHIR tidak ditemukan, rekening koran tidak dapat dibaca.");
  if (!columns) return { bank: "SeaBank", periodStart: period?.periodStart ?? "", periodEnd: period?.periodEnd ?? "", openingBalance: 0, closingBalance: 0, rows: [], warnings };

  const year = period ? Number(period.periodStart.slice(0, 4)) : new Date().getUTCFullYear();
  const startMonth = period ? Number(period.periodStart.slice(5, 7)) : 1;
  const anchors: Anchor[] = [];

  for (const lines of allLines) {
    // Satu transaksi berlabuh pada baris yang memuat tanggal beserta angkanya.
    const pageAnchors: Anchor[] = [];
    const loose: { y: number; text: string }[] = [];
    for (const line of lines) {
      const dateCell = line.find((item) => /^\d{1,2}\s+[A-Za-z]{3}$/.test(item.text.trim()));
      const month = dateCell ? MONTHS[dateCell.text.trim().split(/\s+/)[1].toUpperCase()] : undefined;
      if (dateCell && month) {
        const day = Number(dateCell.text.trim().split(/\s+/)[0]);
        // Rekening koran bisa melewati pergantian tahun; bulan yang mengecil berarti tahun berikutnya.
        const rowYear = month < startMonth ? year + 1 : year;
        const anchor: Anchor = { y: dateCell.y, date: `${rowYear}-${pad(month)}-${pad(day)}`, parts: [] };
        for (const item of line) {
          if (item === dateCell) continue;
          if (!isAmount(item.text)) continue;
          const column = columnOf(item, columns);
          if (column === "saldo") anchor.balance = parseRupiah(item.text);
          else if (column) anchor.amount = { value: parseRupiah(item.text), column };
        }
        pageAnchors.push(anchor);
        continue;
      }
      for (const item of line) {
        const text = item.text.trim();
        // Hanya kolom TRANSAKSI yang memuat deskripsi; angka di kolom kanan diabaikan.
        if (!text || isAmount(text) || right(item) > columns.keluar - COLUMN_TOLERANCE) continue;
        loose.push({ y: item.y, text });
      }
    }
    // Deskripsi mengapit baris tanggal, jadi tiap potongan diberikan ke tanggal terdekat.
    for (const part of loose) {
      let nearest: Anchor | null = null;
      let nearestDistance = Infinity;
      for (const anchor of pageAnchors) {
        const distance = Math.abs(anchor.y - part.y);
        if (distance < nearestDistance) { nearest = anchor; nearestDistance = distance; }
      }
      if (nearest && nearestDistance <= 30) nearest.parts.push(part);
    }
    anchors.push(...pageAnchors);
  }

  const rows: BankStatementRow[] = [];
  let previousBalance: number | null = null;
  let openingBalance = 0;
  let closingBalance = 0;

  for (const anchor of anchors) {
    if (anchor.amount === undefined || anchor.balance === undefined) {
      warnings.push(`Transaksi ${anchor.date} dilewati karena nominal atau saldo tidak terbaca.`);
      continue;
    }
    const direction: "in" | "out" = anchor.amount.column === "masuk" ? "in" : "out";
    let warning: string | undefined;
    if (previousBalance === null) {
      openingBalance = direction === "in" ? anchor.balance - anchor.amount.value : anchor.balance + anchor.amount.value;
    } else {
      const delta = anchor.balance - previousBalance;
      if (Math.abs(delta) !== anchor.amount.value) {
        warning = `Selisih saldo ${Math.abs(delta).toLocaleString("id-ID")} tidak sama dengan nominal ${anchor.amount.value.toLocaleString("id-ID")}.`;
      } else if ((delta >= 0 ? "in" : "out") !== direction) {
        warning = "Arah transaksi tidak cocok dengan pergerakan saldo.";
      }
    }
    previousBalance = anchor.balance;
    closingBalance = anchor.balance;
    const parts = [...anchor.parts].sort((a, b) => b.y - a.y).map((part) => part.text);
    rows.push({
      date: anchor.date,
      title: parts[0] || "Transaksi",
      detail: parts.slice(1).join(" · "),
      direction,
      amount: anchor.amount.value,
      balance: anchor.balance,
      warning,
    });
  }

  return {
    bank: "SeaBank",
    periodStart: period?.periodStart ?? "",
    periodEnd: period?.periodEnd ?? "",
    openingBalance,
    closingBalance,
    rows,
    warnings,
  };
}

/**
 * Mengubah hasil baca rekening koran menjadi record impor kanonik agar bisa
 * masuk ke previewTransactionRecords tanpa jalur validasi terpisah.
 */
export function statementRowsToRecords(result: BankStatementParseResult, accountName: string): Record<string, string>[] {
  return result.rows.map((row) => ({
    date: row.date,
    type: row.direction === "in" ? "pemasukan" : "pengeluaran",
    title: row.title,
    account: accountName,
    amount: String(row.amount),
    status: "completed",
    notes: [result.bank, row.detail].filter(Boolean).join(" · "),
  }));
}
