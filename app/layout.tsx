import { PerformanceMonitor } from "@/components/PerformanceMonitor";
import { ThemeScript } from "@/components/ThemeScript";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

// Font optimization
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: 'swap', // Better font loading performance
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: 'swap',
});

// Metadata configuration
export const metadata: Metadata = {
  title: "Random Quote Fetcher",
  description: "A high-performance web application for fetching random quotes with real-time scraping from quotes.toscrape.com. Supports up to 300 concurrent requests with intelligent caching, memory management, and keyboard navigation.",
  keywords: [
    "quotes",
    "inspiration",
    "web scraping",
    "next.js",
    "random quotes",
    "interactive",
    "keyboard navigation",
    "high performance",
    "concurrent requests",
    "puppeteer",
    "real-time scraping"
  ],
  authors: [{ name: "Random Quote Fetcher" }],
  creator: "Random Quote Fetcher",
  publisher: "Random Quote Fetcher",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL || 'https://www.randomquotefetcher.com'),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: "Random Quote Fetcher - High Performance Quote Discovery",
    description: "Discover inspiring quotes with an interactive grid interface. Supports 300 concurrent requests with real-time scraping and intelligent caching.",
    url: process.env.NEXT_PUBLIC_BASE_URL || 'https://www.randomquotefetcher.com',
    siteName: 'Random Quote Fetcher',
    images: [
      {
        url: '/images/social-preview-image.png',
        width: 1200,
        height: 630,
        alt: 'Random Quote Fetcher - High performance interactive quote discovery app with 300 concurrent request support',
      }
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Random Quote Fetcher - High Performance Quote Discovery',
    description: 'Interactive grid interface with 300 concurrent request support, real-time scraping, and intelligent memory management.',
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
  },
  other: {
    'color-scheme': 'light dark',
    'theme-color': '#f8fafc',
  }
};

interface RootLayoutProps {
  children: React.ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Performance optimizations */}
        <link rel="preconnect" href="https://quotes.toscrape.com" />
        <link rel="dns-prefetch" href="https://quotes.toscrape.com" />

        {/* Theme script to prevent FOUC */}
        <ThemeScript />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        suppressHydrationWarning={true}
      >
        {/* Fallback for users without JavaScript */}
        <noscript>
          <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
            <div className="max-w-md w-full bg-white border border-amber-200 rounded-xl p-6 shadow-lg text-center">
              <h1 className="text-lg font-semibold text-slate-900 mb-2">
                JavaScript Required
              </h1>
              <p className="text-sm text-slate-600">
                Random Quote Fetcher requires JavaScript to function properly.
                Please enable JavaScript in your browser and reload the page.
              </p>
            </div>
          </div>
        </noscript>

        {/* Main application content */}
        <div id="app-root">
          {children}
        </div>

        {/* Performance monitoring (development only) */}
        <PerformanceMonitor />
      </body>
    </html>
  );
}