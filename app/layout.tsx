import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header"; // Proveri da li ti je Header u components folderu

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "MUSIC TOP | Global Charts & MTA Awards",
  description: "Official Music Top Awards and Global Music Charts",
};

// app/layout.tsx
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-black text-white" suppressHydrationWarning={true}>
        <Header />
        <main className="pt-32 min-h-screen">
          {children}
        </main>
      </body>
    </html>
  );
}