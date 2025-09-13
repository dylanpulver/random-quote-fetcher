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
  metadataBase: new URL('https://www.randomquotefetcher.com'),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: "Random Quote Fetcher - High Performance Quote Discovery",
    description: "Discover inspiring quotes with an interactive grid interface. Supports 300 concurrent requests with real-time scraping and intelligent caching.",
    url: 'https://www.randomquotefetcher.com',
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
    shortcut: '/favicon-16x16.png',
    apple: '/apple-touch-icon.png',
  },
  other: {
    // Performance hints
    'color-scheme': 'light dark',
    'theme-color': '#f8fafc',
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        {/* Performance optimizations */}
        <link rel="preconnect" href="https://quotes.toscrape.com" />
        <link rel="dns-prefetch" href="https://quotes.toscrape.com" />

        {/* Prevent FOUC (Flash of Unstyled Content) */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var theme = localStorage.getItem('theme') || 'light';
                  document.documentElement.setAttribute('data-theme', theme);
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        suppressHydrationWarning={true}
      >
        {/* Global error boundary wrapper */}
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

        {/* Performance monitoring script for development */}
        {process.env.NODE_ENV === 'development' && (
          <script
            dangerouslySetInnerHTML={{
              __html: `
                (function() {
                  if (typeof window !== 'undefined' && window.performance) {
                    window.addEventListener('load', function() {
                      setTimeout(function() {
                        var timing = window.performance.timing;
                        var loadTime = timing.loadEventEnd - timing.navigationStart;
                        console.log('Page load time:', loadTime + 'ms');

                        // Log memory usage if available
                        if (window.performance.memory) {
                          console.log('Memory usage:', {
                            used: Math.round(window.performance.memory.usedJSHeapSize / 1024 / 1024) + 'MB',
                            total: Math.round(window.performance.memory.totalJSHeapSize / 1024 / 1024) + 'MB',
                            limit: Math.round(window.performance.memory.jsHeapSizeLimit / 1024 / 1024) + 'MB'
                          });
                        }
                      }, 0);
                    });
                  }
                })();
              `,
            }}
          />
        )}
      </body>
    </html>
  );
}