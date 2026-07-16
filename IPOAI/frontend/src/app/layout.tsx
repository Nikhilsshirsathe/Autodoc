import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/providers";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: { default: "AUTODOC — IPO Document Platform", template: "%s | AUTODOC" },
  description: "AI-powered platform for SME IPO offer document preparation and SEBI filing.",
  keywords: ["IPO", "SEBI", "SME IPO", "Offer Document", "DRHP", "AI"],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
