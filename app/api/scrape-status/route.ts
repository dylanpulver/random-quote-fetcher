import {
  APILogger,
  createPlainErrorResponse,
  createSSEHeaders,
  formatSSEMessage,
  isValidCellId,
  parseRequestBody,
  PerformanceTimer
} from '@/lib/api-utils';
import { scrapingService } from '@/lib/scraping-service';
import { ScrapingProgress } from '@/lib/types';
import { NextRequest } from 'next/server';

const logger = new APILogger('SSE');

/**
 * POST /api/scrape-status - Stream quote fetching progress via Server-Sent Events
 * Provides real-time updates on scraping progress
 */
export async function POST(request: NextRequest) {
  try {
    const body = await parseRequestBody(request);
    const { cellId } = body;

    if (!isValidCellId(cellId)) {
      return createPlainErrorResponse('cellId is required and must be a number between 0-299', 400);
    }

    logger.info(`Starting streaming quote fetch for cell ${cellId}`);
    return createSSEStream(cellId);

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Invalid request';
    logger.error('Failed to start stream:', errorMessage);
    return createPlainErrorResponse(errorMessage, 400);
  }
}

// ========================================
// SSE Stream Implementation
// ========================================

function createSSEStream(cellId: number): Response {
  const headers = createSSEHeaders();
  const encoder = new TextEncoder();
  const timer = new PerformanceTimer(`SSE stream for cell ${cellId}`);

  let controller: ReadableStreamDefaultController<Uint8Array>;
  let isClosed = false;

  const stream = new ReadableStream({
    start(ctrl) {
      controller = ctrl;
      logger.info(`Stream started for cell ${cellId}`);
    },
    cancel() {
      isClosed = true;
      logger.info(`Stream cancelled for cell ${cellId}`);
    }
  });

  const sendMessage = (data: Record<string, unknown>) => {
    if (isClosed) return;

    try {
      const message = formatSSEMessage(data);
      controller.enqueue(encoder.encode(message));
    } catch (error) {
      logger.error(`Error sending message to cell ${cellId}:`, error);
      closeStream();
    }
  };

  const closeStream = () => {
    if (isClosed) return;

    try {
      controller.close();
    } catch (error) {
      logger.error(`Error closing stream for cell ${cellId}:`, error);
    }

    isClosed = true;
  };

  // Start scraping with progress updates
  scrapingService.scrapeQuote((progress: ScrapingProgress) => {
    if (isClosed) return;

    sendMessage({
      cellId,
      stage: progress.stage,
      message: progress.message,
      totalStages: progress.totalStages,
      timestamp: Date.now()
    });
  })
  .then((quote) => {
    if (isClosed) return;

    const responseTime = timer.complete(logger);

    // Send final result
    sendMessage({
      cellId,
      stage: 'complete',
      quote,
      responseTime,
      timestamp: Date.now()
    });

    closeStream();
  })
  .catch((error) => {
    if (isClosed) return;

    const responseTime = timer.elapsed();
    const errorMessage = error instanceof Error ? error.message : 'Unknown scraping error';

    logger.error(`Scraping error for cell ${cellId} after ${responseTime}ms:`, errorMessage);

    // Send error with additional context
    sendMessage({
      cellId,
      stage: 'error',
      error: errorMessage,
      responseTime,
      timestamp: Date.now(),
      cacheInfo: {
        cacheSize: scrapingService.cacheSize,
        usedQuotes: scrapingService.usedQuotesCount,
        queueLength: scrapingService.queueLength,
        activeRequests: scrapingService.activeRequestsCount
      }
    });

    closeStream();
  });

  return new Response(stream, { headers });
}