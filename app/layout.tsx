import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Random Quote Fetcher",
  description: "A modern web application for fetching random quotes with real-time scraping from quotes.toscrape.com. Navigate with keyboard controls and discover inspiring quotes in an interactive grid interface.",
  keywords: ["quotes", "inspiration", "web scraping", "next.js", "random quotes", "interactive", "keyboard navigation"],
  authors: [{ name: "Random Quote Fetcher" }],
  creator: "Random Quote Fetcher",
  publisher: "Random Quote Fetcher",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL('https://www.randomquotefetcher.com'),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: "Random Quote Fetcher",
    description: "Discover inspiring quotes with an interactive grid interface. Navigate with keyboard controls and fetch quotes in real-time.",
    url: 'https://www.randomquotefetcher.com',
    siteName: 'Random Quote Fetcher',
    images: [
      {
        url: '/images/social-preview-image.png',
        width: 1200,
        height: 630,
        alt: 'Random Quote Fetcher - Interactive quote discovery app',
      }
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Random Quote Fetcher',
    description: 'Discover inspiring quotes with an interactive grid interface. Navigate with keyboard controls and fetch quotes in real-time.',
    images: ['/images/social-preview-image.png'],
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
  },
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon-16x16.png',
    apple: '/apple-touch-icon.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}