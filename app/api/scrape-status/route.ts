import { ScrapingProgress, scrapingService } from '@/lib/scraping-service';
import { NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { cellId } = body;

  if (typeof cellId !== 'number') {
    return new Response('cellId is required', { status: 400 });
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

  const stream = new ReadableStream({
    start(ctrl) {
      controller = ctrl;
    },
    cancel() {
      // Clean up if stream is cancelled
    }
  });

  // Start scraping with progress updates
  scrapingService.scrapeQuote((progress: ScrapingProgress) => {
    const data = {
      cellId,
      stage: progress.stage,
      message: progress.message,
      totalStages: progress.totalStages,
      timestamp: Date.now()
    };

    const message = `data: ${JSON.stringify(data)}\n\n`;

    try {
      controller.enqueue(encoder.encode(message));
    } catch (error) {
      console.error('Error sending SSE message:', error);
    }
  })
  .then((quote) => {
    // Send final result
    const finalData = {
      cellId,
      stage: 'complete',
      quote,
      timestamp: Date.now()
    };

    const message = `data: ${JSON.stringify(finalData)}\n\n`;

    try {
      controller.enqueue(encoder.encode(message));
      controller.close();
    } catch (error) {
      console.error('Error sending final SSE message:', error);
    }
  })
  .catch((error) => {
    // Send error
    const errorData = {
      cellId,
      stage: 'error',
      error: error.message,
      timestamp: Date.now()
    };

    const message = `data: ${JSON.stringify(errorData)}\n\n`;

    try {
      controller.enqueue(encoder.encode(message));
      controller.close();
    } catch (error) {
      console.error('Error sending error SSE message:', error);
    }
  });

  return new Response(stream, { headers });
}