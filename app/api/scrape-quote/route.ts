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
        // Try Puppeteer first
        quote = await scrapingService.getRandomQuote();
      } catch (puppeteerError) {
        console.warn('Puppeteer failed, falling back to simple scraper:', puppeteerError);
        quote = await simpleScrapingService.getRandomQuote();
        method = 'simple-fallback';
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