import { scrapingService } from '@/lib/scraping-service';
import { ScrapingProgress } from '@/lib/types';
import { NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
  let body;
  try {
    body = await request.json();
  } catch (error) {
    console.error('Invalid JSON in request body:', error);
    return new Response('Invalid JSON', { status: 400 });
  }

  const { cellId } = body;

  if (typeof cellId !== 'number') {
    return new Response('cellId is required and must be a number', { status: 400 });
  }

  // Set up SSE headers
  const headers = new Headers({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control'
  });

  const encoder = new TextEncoder();
  let controller: ReadableStreamDefaultController<Uint8Array>;
  let isClosed = false;

  const stream = new ReadableStream({
    start(ctrl) {
      controller = ctrl;
    },
    cancel() {
      isClosed = true;
    }
  });

  const sendMessage = (data: Record<string, unknown>) => {
    if (isClosed) return;

    const message = `data: ${JSON.stringify(data)}\n\n`;

    try {
      controller.enqueue(encoder.encode(message));
    } catch (error) {
      console.error('Error sending SSE message:', error);
      isClosed = true;
    }
  };

  // Start scraping with progress updates
  scrapingService.scrapeQuote((progress: ScrapingProgress) => {
    if (isClosed) return;

    const data = {
      cellId,
      stage: progress.stage,
      message: progress.message,
      totalStages: progress.totalStages,
      timestamp: Date.now()
    };

    sendMessage(data);
  })
  .then((quote) => {
    if (isClosed) return;

    // Send final result
    const finalData = {
      cellId,
      stage: 'complete',
      quote,
      timestamp: Date.now()
    };

    sendMessage(finalData);

    try {
      controller.close();
    } catch (error) {
      console.error('Error closing controller:', error);
    }
    isClosed = true;
  })
  .catch((error) => {
    if (isClosed) return;

    console.error('Scraping error for cell', cellId, ':', error);

    // Send error
    const errorData = {
      cellId,
      stage: 'error',
      error: error.message || 'Unknown scraping error',
      timestamp: Date.now()
    };

    sendMessage(errorData);

    try {
      controller.close();
    } catch (closeError) {
      console.error('Error closing controller after error:', closeError);
    }
    isClosed = true;
  });

  return new Response(stream, { headers });
}