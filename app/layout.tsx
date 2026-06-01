import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Script from "next/script"; // <-- 1. Uvozimo Next.js Script komponentu
import { Analytics } from '@vercel/analytics/react';
import { GoogleAnalytics } from '@next/third-parties/google';


const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "MUSIC TOP | Global Charts & MTA Awards",
  description: "Official Music Top Awards and Global Music Charts",

verification: {
    other: {
      "impact-site-verification": "43444915-bed2-46dc-987e-a11bf2cd3c46",
    },
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        {/* 2. Google AdSense Skripta */}
        {/* ZAMENI "ca-pub-XXXXXXXXXXXXXXXX" sa tvojim pravim AdSense ID-jem iz konzole! */}
        <Script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-XXXXXXXXXXXXXXXX"
          strategy="afterInteractive"
          crossOrigin="anonymous"
        />
      </head>
      {/* 3. Tvoj originalni body sa flex-col stilovima */}
      <body 
        className={`${inter.className} bg-black text-white flex flex-col min-h-screen`} 
        suppressHydrationWarning={true}
      >
        <Header />
        
        {/* Main zauzima sav slobodan prostor i gura footer na dno */}
        <main className="pt-32 flex-grow">
          {children}
        </main>

        <Footer />

        {/* --- OVDE NA SAMO DNO, ODMAH IZNAD </body>, DODAJEMO OBE ANALITIKE --- */}
        <Analytics />
        <GoogleAnalytics gaId="G-XXXXXX" /> {/* <-- Ovde posle upiši svoj pravi Google ID */}
      </body>
    </html>
  );
}
