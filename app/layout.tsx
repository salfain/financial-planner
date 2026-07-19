import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

const description = "Financial planner personal untuk mengelola transaksi, anggaran, target, investasi, laporan, backup, dan analisis keuangan dalam satu tempat.";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host") ?? "localhost:3000";
  const protocol = host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https";
  const baseUrl = `${protocol}://${host}`;
  return {
    metadataBase: new URL(baseUrl),
    title: "Financial Planner",
    description,
    icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
    openGraph: {
      type: "website",
      title: "Financial Planner",
      description,
      images: [{ url: `${baseUrl}/og-financial-planner.png`, width: 1672, height: 941, alt: "Financial Planner — Keuangan lebih terarah" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "Financial Planner",
      description,
      images: [`${baseUrl}/og-financial-planner.png`],
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
