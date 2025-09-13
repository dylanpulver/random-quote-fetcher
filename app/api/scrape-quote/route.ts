import { scrapingService } from '@/lib/scraping-service';
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

    const { cellId } = body;

    if (typeof cellId !== 'number') {
      return NextResponse.json(
        { error: 'cellId is required and must be a number' },
        { status: 400 }
      );
    }

    // Use the main scraping service with built-in fallbacks
    const quote = await scrapingService.getRandomQuote();

    return NextResponse.json({
      success: true,
      cellId,
      quote,
      method: 'intelligent-scraper',
      cacheInfo: {
        cacheSize: scrapingService.cacheSize,
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
      cacheSize: scrapingService.cacheSize,
      usedQuotes: scrapingService.usedQuotesCount,
      queueLength: scrapingService.queueLength,
      activeRequests: scrapingService.activeRequestsCount
    }
  });
}