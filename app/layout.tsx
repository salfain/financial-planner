import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

const description = "Financial OS personal dengan transaksi lanjutan, split kategori, impor CSV, lampiran privat, undo, investasi, reminder, laporan, backup, dan migrasi tervalidasi.";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host") ?? "localhost:3000";
  const protocol = host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https";
  const baseUrl = `${protocol}://${host}`;
  return {
    metadataBase: new URL(baseUrl),
    title: "VINN STORE — Financial OS",
    description,
    icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
    openGraph: {
      type: "website",
      title: "VINN STORE — Financial OS",
      description,
      images: [{ url: `${baseUrl}/og-advanced-transactions.png`, width: 1672, height: 942, alt: "VINN STORE Financial OS — Transaksi Lanjutan dengan split kategori, impor CSV, filter, lampiran, dan undo" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "VINN STORE — Financial OS",
      description,
      images: [`${baseUrl}/og-advanced-transactions.png`],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
