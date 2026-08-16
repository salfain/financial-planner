import type { PdfTextItem } from "./bank-statement";

/**
 * Pengganti lib/pdf-text.ts untuk bundel Apps Script.
 *
 * Build GAS memakai format IIFE yang tidak mendukung code splitting, sehingga
 * pdfjs akan ikut ter-inline dan membengkakkan Frontend.html dari 1,4 MB menjadi
 * sekitar 4,7 MB untuk setiap pelanggan — termasuk yang tidak pernah mengimpor PDF.
 * Modul ini dialiaskan menggantikan aslinya di vite.gas.config.ts.
 */
export async function extractPdfTextItems(): Promise<PdfTextItem[][]> {
  throw new Error("Impor rekening koran PDF hanya tersedia pada versi web. Pada Apps Script, gunakan impor CSV.");
}
