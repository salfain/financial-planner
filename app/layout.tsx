import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import "./globals.css";

const description = "Financial planner personal untuk mengelola transaksi, anggaran, target, investasi, laporan, backup, dan analisis keuangan dalam satu tempat.";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f3f6f4" },
    { media: "(prefers-color-scheme: dark)", color: "#0e1512" },
  ],
};

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host") ?? "localhost:3000";
  const protocol = host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https";
  const baseUrl = `${protocol}://${host}`;
  return {
    metadataBase: new URL(baseUrl),
    title: "Financial Planner",
    description,
    manifest: "/manifest.webmanifest",
    appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Financial Planner" },
    icons: { icon: "/favicon.svg", shortcut: "/favicon.svg", apple: "/favicon.svg" },
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
      <head>
        {/* Plus Jakarta Sans sesuai design handoff. Rentang variabel 200..800 dipakai
            agar bobot pecahan pada desain (650/750/760) tidak dibulatkan ke instans statis. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,200..800;1,200..800&display=swap"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
