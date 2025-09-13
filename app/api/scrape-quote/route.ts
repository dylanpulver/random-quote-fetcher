import {
  APILogger,
  createErrorResponse,
  createSuccessResponse,
  isValidCellId,
  parseRequestBody,
  PerformanceTimer
} from '@/lib/api-utils';
import { scrapingService } from '@/lib/scraping-service';
import { CacheInfo } from '@/lib/types';
import { NextRequest } from 'next/server';

const logger = new APILogger('API');

/**
 * POST /api/scrape-quote - Fetch a random quote synchronously
 * Returns a single quote with cache information
 */
export async function POST(request: NextRequest) {
  const timer = new PerformanceTimer(`Quote fetch`);

  try {
    const body = await parseRequestBody(request);
    const { cellId } = body;

    if (!isValidCellId(cellId)) {
      return createErrorResponse('cellId is required and must be a number between 0-299', 400);
    }

    logger.info(`Starting quote fetch for cell ${cellId}`);

    const quote = await scrapingService.getRandomQuote();
    const responseTime = timer.complete(logger);

    const cacheInfo: CacheInfo = {
      cacheSize: scrapingService.cacheSize,
      usedQuotes: scrapingService.usedQuotesCount,
      queueLength: scrapingService.queueLength,
      activeRequests: scrapingService.activeRequestsCount
    };

    return createSuccessResponse({
      cellId,
      quote,
      method: 'intelligent-scraper',
      cacheInfo,
      responseTime
    });

  } catch (error) {
    const responseTime = timer.elapsed();
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    logger.error(`Quote scraping failed after ${responseTime}ms:`, errorMessage);

    return createErrorResponse(
      'Failed to scrape quote',
      500,
      { details: errorMessage, responseTime }
    );
  }
}

/**
 * GET /api/scrape-quote - Health check and service status
 */
export async function GET() {
  try {
    const cacheInfo: CacheInfo = {
      cacheSize: scrapingService.cacheSize,
      usedQuotes: scrapingService.usedQuotesCount,
      queueLength: scrapingService.queueLength,
      activeRequests: scrapingService.activeRequestsCount
    };

    const healthStatus = scrapingService.getHealthStatus();

    return createSuccessResponse({
      status: 'Quote scraping service is running',
      cacheInfo,
      healthStatus
    });
  } catch (error) {
    logger.error('Health check failed:', error);
    return createErrorResponse('Health check failed', 500);
  }
}
