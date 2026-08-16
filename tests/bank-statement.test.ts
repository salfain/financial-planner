import test from "node:test";
import assert from "node:assert/strict";
import {
  groupIntoLines,
  isSeabankStatement,
  parseRupiah,
  parseSeabankStatement,
  statementRowsToRecords,
  type PdfTextItem,
} from "../lib/bank-statement";

// Geometri meniru rekening koran SeaBank asli: kolom angka rata kanan pada
// tepi 343 (keluar), 445 (masuk), dan 545 (saldo akhir).
const item = (x: number, y: number, text: string, width = text.length * 5): PdfTextItem => ({ x, y, width, text });
const rightAligned = (edge: number, y: number, text: string): PdfTextItem => {
  const width = text.length * 5;
  return { x: edge - width, y, width, text };
};

const heading = (period = "01 JUL 2026 sampai 31 JUL 2026"): PdfTextItem[] => [
  item(460, 802, "REKENING KORAN"),
  item(189, 433, "TABUNGAN - RINCIAN TRANSAKSI"),
  item(223, 574, period),
  item(296, 403, "KELUAR"), rightAligned(343, 403, "(IDR)"),
  item(401, 403, "MASUK"), rightAligned(445, 403, "(IDR)"),
  item(477, 403, "SALDO AKHIR"), rightAligned(545, 403, "(IDR)"),
  item(49, 402, "TANGGAL"), item(148, 402, "TRANSAKSI"),
];

/** Deskripsi mengapit baris tanggal, persis seperti pada PDF aslinya. */
const transaction = (y: number, date: string, above: string, below: string, column: "keluar" | "masuk", amount: string, balance: string): PdfTextItem[] => [
  item(148, y + 6, above),
  item(49, y, date, 27),
  rightAligned(column === "keluar" ? 343 : 445, y, amount),
  rightAligned(545, y, balance),
  item(148, y - 7, below),
];

test("nominal rupiah dibaca tanpa desimal", () => {
  assert.equal(parseRupiah("1.969.877"), 1_969_877);
  assert.equal(parseRupiah("134"), 134);
  assert.equal(parseRupiah(""), 0);
});

test("item dikelompokkan menjadi baris visual dari atas ke bawah", () => {
  const lines = groupIntoLines([item(400, 100, "b"), item(50, 100, "a"), item(50, 200, "atas")]);
  assert.deepEqual(lines.map((line) => line.map((cell) => cell.text)), [["atas"], ["a", "b"]]);
});

test("rekening koran SeaBank dikenali dari penanda dokumen", () => {
  assert.equal(isSeabankStatement([heading()]), true);
  assert.equal(isSeabankStatement([[item(0, 0, "MUTASI REKENING BANK LAIN")]]), false);
});

test("arah transaksi diambil dari kolom tempat nominal berada", () => {
  const page = [
    ...heading(),
    ...transaction(369, "01 JUL", "Bunga Tabungan", "Bunga", "masuk", "134", "1.969.877"),
    ...transaction(326, "01 JUL", "ShopeePay", "Pembayaran", "keluar", "43.700", "1.926.177"),
  ];
  const result = parseSeabankStatement([page]);
  assert.equal(result.periodStart, "2026-07-01");
  assert.equal(result.periodEnd, "2026-07-31");
  assert.equal(result.rows.length, 2);
  assert.deepEqual(result.rows[0], {
    date: "2026-07-01", title: "Bunga Tabungan", detail: "Bunga",
    direction: "in", amount: 134, balance: 1_969_877, warning: undefined,
  });
  assert.equal(result.rows[1].direction, "out");
  assert.equal(result.rows[1].amount, 43_700);
  assert.equal(result.rows[1].title, "ShopeePay");
  assert.equal(result.rows[1].detail, "Pembayaran");
});

test("saldo awal direkonstruksi dari transaksi pertama", () => {
  const page = [...heading(), ...transaction(369, "01 JUL", "Bunga Tabungan", "Bunga", "masuk", "134", "1.969.877")];
  assert.equal(parseSeabankStatement([page]).openingBalance, 1_969_743);
});

test("saldo akhir dan aritmetika sepanjang rekening koran konsisten", () => {
  const page = [
    ...heading(),
    ...transaction(369, "01 JUL", "Bunga Tabungan", "Bunga", "masuk", "134", "1.969.877"),
    ...transaction(326, "01 JUL", "ShopeePay", "Pembayaran", "keluar", "43.700", "1.926.177"),
    ...transaction(283, "02 JUL", "Transfer", "Keluar", "keluar", "26.177", "1.900.000"),
  ];
  const result = parseSeabankStatement([page]);
  const masuk = result.rows.filter((row) => row.direction === "in").reduce((sum, row) => sum + row.amount, 0);
  const keluar = result.rows.filter((row) => row.direction === "out").reduce((sum, row) => sum + row.amount, 0);
  assert.equal(result.openingBalance + masuk - keluar, result.closingBalance);
  assert.equal(result.closingBalance, 1_900_000);
  assert.equal(result.rows.filter((row) => row.warning).length, 0);
});

test("nominal yang tidak cocok dengan pergerakan saldo ditandai, bukan dibuang", () => {
  const page = [
    ...heading(),
    ...transaction(369, "01 JUL", "Bunga Tabungan", "Bunga", "masuk", "134", "1.969.877"),
    ...transaction(326, "01 JUL", "ShopeePay", "Pembayaran", "keluar", "43.700", "1.000.000"),
  ];
  const result = parseSeabankStatement([page]);
  assert.equal(result.rows.length, 2);
  assert.match(result.rows[1].warning ?? "", /Selisih saldo/);
});

test("arah kolom yang bertentangan dengan pergerakan saldo ditandai", () => {
  const page = [
    ...heading(),
    ...transaction(369, "01 JUL", "Bunga Tabungan", "Bunga", "masuk", "134", "1.969.877"),
    // Nominal berada di kolom masuk, tetapi saldo justru berkurang.
    ...transaction(326, "01 JUL", "ShopeePay", "Pembayaran", "masuk", "43.700", "1.926.177"),
  ];
  const result = parseSeabankStatement([page]);
  assert.match(result.rows[1].warning ?? "", /Arah transaksi tidak cocok/);
});

test("rekening koran yang melewati pergantian tahun memakai tahun berikutnya", () => {
  const page = [
    ...heading("01 DEC 2026 sampai 31 JAN 2027"),
    ...transaction(369, "31 DEC", "Bunga Tabungan", "Bunga", "masuk", "100", "1.000.100"),
    ...transaction(326, "02 JAN", "ShopeePay", "Pembayaran", "keluar", "100", "1.000.000"),
  ];
  const result = parseSeabankStatement([page]);
  assert.equal(result.rows[0].date, "2026-12-31");
  assert.equal(result.rows[1].date, "2027-01-02");
});

test("transaksi terkumpul lintas halaman", () => {
  const first = [...heading(), ...transaction(369, "01 JUL", "Bunga Tabungan", "Bunga", "masuk", "134", "1.969.877")];
  const second = [
    item(296, 403, "KELUAR"), rightAligned(343, 403, "(IDR)"),
    item(401, 403, "MASUK"), rightAligned(445, 403, "(IDR)"),
    item(477, 403, "SALDO AKHIR"), rightAligned(545, 403, "(IDR)"),
    ...transaction(369, "02 JUL", "ShopeePay", "Pembayaran", "keluar", "877", "1.969.000"),
  ];
  const result = parseSeabankStatement([first, second]);
  assert.equal(result.rows.length, 2);
  assert.equal(result.closingBalance, 1_969_000);
});

test("tanpa header kolom rekening koran ditolak dengan peringatan", () => {
  const result = parseSeabankStatement([[item(460, 802, "REKENING KORAN"), item(49, 369, "01 JUL")]]);
  assert.equal(result.rows.length, 0);
  assert.match(result.warnings.join(" "), /Header kolom/);
});

test("baris rekening koran diubah menjadi record impor kanonik", () => {
  const page = [
    ...heading(),
    ...transaction(369, "01 JUL", "Bunga Tabungan", "Bunga", "masuk", "134", "1.969.877"),
    ...transaction(326, "01 JUL", "ShopeePay", "Pembayaran", "keluar", "43.700", "1.926.177"),
  ];
  const records = statementRowsToRecords(parseSeabankStatement([page]), "Rekening Utama");
  assert.deepEqual(records[0], {
    date: "2026-07-01", type: "pemasukan", title: "Bunga Tabungan",
    account: "Rekening Utama", amount: "134", status: "completed", notes: "SeaBank · Bunga",
  });
  assert.equal(records[1].type, "pengeluaran");
  assert.equal(records[1].amount, "43700");
});
