import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Script from "next/script"; // <-- 1. Uvozimo Next.js Script komponentu
import { Analytics } from '@vercel/analytics/react';
import { GoogleAnalytics } from '@next/third-parties/google';
import StructuredData from "@/components/StructuredData";


const inter = Inter({ subsets: ["latin"] });



export const metadata: Metadata = {
  metadataBase: new URL('https://musictop.net'),
  title: {
    default: "Official Music Charts, Concert Tickets & Music Awards 2026 | MUSIC TOP",
    template: "%s | MUSIC TOP"
  },
  description: "Discover the most popular songs globally. Follow the Official MUSIC TOP charts, vote for your favorite artists, find worldwide concert dates, and get the latest AI-exclusive music news. Your ultimate destination for global music rankings and festival tickets.",
  keywords: [
    "music charts 2026", 
    "global music top 100", 
    "concert tickets worldwide", 
    "MTA awards 2026", 
    "official song rankings", 
    "music festivals 2026", 
    "live tour dates",
    "k-pop charts", "rock charts", "pop charts", "hip-hop charts"
  ],
  openGraph: {
    title: "MUSIC TOP | Global Music Charts, Concerts & Awards",
    description: "The definitive source for global music rankings, live concert tickets, and AI-powered music news. Vote now and follow the charts!",
    url: "https://musictop.net",
    siteName: "MUSIC TOP",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "MUSIC TOP - Global Music Charts"
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "MUSIC TOP | Global Music Charts & Concerts",
    description: "Official music rankings and worldwide concert tickets.",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  }
};

const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "MUSIC TOP",
  "url": "https://musictop.net",
  "logo": "https://musictop.net/og-image.png",
  "sameAs": [
    "https://twitter.com/musictop",
    "https://facebook.com/musictop"
  ],
  "contactPoint": {
    "@type": "ContactPoint",
    "contactType": "customer service",
    "email": "contact@musictop.net"
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
        <StructuredData data={organizationSchema} />
        <meta name="google-site-verification" content="google-site-verification: google0f815af240dfb5bc.html"></meta>
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
