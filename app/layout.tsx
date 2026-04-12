import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "MUSIC TOP | Global Charts & MTA Awards",
  description: "Official Music Top Awards and Global Music Charts",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-black text-white`} suppressHydrationWarning={true}>
        <Header />
        <main className="pt-32 min-h-screen">
          {children}
        </main>
      </body>
    </html>
  );
}