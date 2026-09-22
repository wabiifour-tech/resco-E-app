import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { Providers } from "@/app/providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "RESCO eCard | Redeemer's Schools and College",
  description:
    "Electronic report-card and academic result management system for Redeemer's Schools and College, Owotoro. Excellence, Knowledge, and Wisdom.",
  icons: { icon: "/logo.svg" },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} antialiased bg-background text-foreground`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
