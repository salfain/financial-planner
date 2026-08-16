import type { PdfTextItem } from "./bank-statement";

/**
 * Ekstraksi teks berposisi dari PDF, dipisahkan dari parser rekening koran
 * agar pdfjs hanya dimuat saat pengguna benar-benar mengimpor PDF.
 *
 * Rekening koran memakai font subset dengan encoding kustom, sehingga
 * pembacaan byte mentah menghasilkan teks sampah. pdfjs membaca peta
 * ToUnicode dokumen dan mengembalikan karakter yang benar.
 *
 * Seluruh proses berjalan di perangkat pengguna; file tidak pernah diunggah.
 */
export async function extractPdfTextItems(data: ArrayBuffer): Promise<PdfTextItem[][]> {
  const pdfjs = await import("pdfjs-dist");
  try {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.mjs", import.meta.url).toString();
  } catch {
    // Tanpa worker, pdfjs jatuh ke mode satu utas. Lebih lambat, tetap benar.
  }
  const doc = await pdfjs.getDocument({ data: new Uint8Array(data), useSystemFonts: true }).promise;
  try {
    const pages: PdfTextItem[][] = [];
    for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
      const page = await doc.getPage(pageNumber);
      const content = await page.getTextContent();
      const items: PdfTextItem[] = [];
      for (const entry of content.items) {
        if (!("str" in entry) || !entry.str.trim()) continue;
        items.push({ x: entry.transform[4], y: entry.transform[5], width: entry.width, text: entry.str });
      }
      pages.push(items);
      page.cleanup();
    }
    return pages;
  } finally {
    await doc.cleanup();
  }
}
