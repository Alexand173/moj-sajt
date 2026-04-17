import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer"; // 1. Uvezi Footer

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
      {/* 2. Dodajemo 'flex flex-col' na body da bi footer mogao biti gurnut na dno */}
      <body 
        className={`${inter.className} bg-black text-white flex flex-col min-h-screen`} 
        suppressHydrationWarning={true}
      >
        <Header />
        
        {/* 3. Dodajemo 'flex-grow' na main - ovo je ključno! */}
        {/* 'flex-grow' tera main da zauzme sav slobodan prostor, gurajući footer skroz dole */}
        <main className="pt-32 flex-grow">
          {children}
        </main>

        {/* 4. Ubaci Footer ovde */}
        <Footer />
      </body>
    </html>
  );
}