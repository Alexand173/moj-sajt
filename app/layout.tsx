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
  title: {
    default: "MUSIC TOP | Global Music Charts & Concert Tickets 2026 & MTA Awards",
    template: "%s | MUSIC TOP"
  },
  description: "Currently most popular songs in all music genres rock, pop hip-hop r&b/soul country dance, j-pop, j-rock, k-pop, jazz, classic ,ranked by audience votes, mta awards, the latest music news, and find official concert dates and festival tickets worldwide,  listen to the latest world music charts from the usa, europe, latin america and asia. follow mta awards, concert announcements, festivals and buy tickets. World Music in one place.",
  keywords: [
    "music charts", 
    "global music top", 
    "concert tickets 2026", 
    "MTA awards", 
    "top 100 songs", 
    "music festivals", 
    "tour dates",
   "audience voting", "MTA awards 2026", "concert dates", 
    "buy festival tickets", "popular songs by genre", "K-Pop charts", 
    "Rock charts", "Hip-Hop music charts", "Pop music charts", "R&B/Soul charts", "Country music charts", "Dance music charts", "J-Pop charts", 
    "J-Rock charts", "Jazz charts", "Classic music charts", 
    "latest music news", "world music charts", "music awards 2026"


  ],
  openGraph: {
    title: "MUSIC TOP | Global Music Charts & Concert Tickets & Festivals &  MTA Awards",
    description: "Official Music Top Awards and Global Music Charts. Don't miss out on the latest concert dates!",
    url: "https://musictop.net",
    siteName: "MUSIC TOP",
    images: [
      {
        url: "/og-image.png", // Ako imaš logo ili sliku sajta, stavi je ovde
        width: 1200,
        height: 630,
      },
    ],
    locale: "en_US",
    type: "website",
  },
  robots: {
    index: true,
    follow: true,
  }
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
         <meta name='impact-site-verification' content='e731ab44-d92b-4034-9fa2-f684ac52903b' />
        {/* 2. Google AdSense Skripta */}
        {/* ZAMENI "ca-pub-XXXXXXXXXXXXXXXX" sa tvojim pravim AdSense ID-jem iz konzole! */}
        {/* Koristi običan script tag umesto <Script /> za verifikaciju */}
  <script 
    async 
    src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-5019317238845372" 
    crossOrigin="anonymous">
  </script>
        /
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
