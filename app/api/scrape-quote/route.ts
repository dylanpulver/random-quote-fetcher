import { scrapingService } from '@/lib/scraping-service';
import { simpleScrapingService } from '@/lib/simple-scraper';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    const { cellId, useSimple = false } = body;

    if (typeof cellId !== 'number') {
      return NextResponse.json(
        { error: 'cellId is required and must be a number' },
        { status: 400 }
      );
    }

    let quote;
    let method = 'puppeteer';

    if (useSimple) {
      // Use simple HTTP-based scraping
      quote = await simpleScrapingService.getRandomQuote();
      method = 'simple';
    } else {
      try {
        // Try Puppeteer first with timeout
        const puppeteerPromise = scrapingService.getRandomQuote();
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Puppeteer timeout after 90 seconds')), 90000)
        );

        quote = await Promise.race([puppeteerPromise, timeoutPromise]);
      } catch (puppeteerError) {
        console.warn('Puppeteer failed, falling back to simple scraper:', puppeteerError);
        try {
          quote = await simpleScrapingService.getRandomQuote();
          method = 'simple-fallback';
        } catch (fallbackError) {
          console.error('Both scrapers failed:', fallbackError);
          return NextResponse.json(
            {
              error: 'All scraping methods failed',
              details: `Puppeteer: ${puppeteerError instanceof Error ? puppeteerError.message : 'Unknown error'}, Simple: ${fallbackError instanceof Error ? fallbackError.message : 'Unknown error'}`
            },
            { status: 500 }
          );
        }
      }
    }

    return NextResponse.json({
      success: true,
      cellId,
      quote,
      method,
      cacheInfo: {
        puppeteerCache: scrapingService.cacheSize,
        simpleCache: simpleScrapingService.cacheSize,
        usedQuotes: scrapingService.usedQuotesCount,
        queueLength: scrapingService.queueLength,
        activeRequests: scrapingService.activeRequestsCount
      }
    });

  } catch (error) {
    console.error('Quote scraping error:', error);

    return NextResponse.json(
      {
        error: 'Failed to scrape quote',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'Quote scraping service is running',
    cacheInfo: {
      puppeteerCache: scrapingService.cacheSize,
      simpleCache: simpleScrapingService.cacheSize,
      usedQuotes: scrapingService.usedQuotesCount,
      queueLength: scrapingService.queueLength,
      activeRequests: scrapingService.activeRequestsCount
    }
  });
}