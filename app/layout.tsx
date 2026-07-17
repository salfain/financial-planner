import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

const description = "Dashboard keuangan personal untuk transaksi, anggaran, target, tagihan, dan investasi dalam satu tempat.";

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
      images: [{ url: `${baseUrl}/og-investment.png`, width: 1200, height: 630, alt: "VINN STORE Financial OS — Core Finance dan Investment" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "VINN STORE — Financial OS",
      description,
      images: [`${baseUrl}/og-investment.png`],
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
