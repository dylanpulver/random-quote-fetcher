import chromium from '@sparticuz/chromium';
import { Browser, Page } from 'puppeteer-core';

export interface Quote {
  text: string;
  author: string;
  tags: string[];
  sourceUrl?: string;
}

export interface ScrapingProgress {
  stage: number;
  message: string;
  totalStages: number;
}

class ScrapingService {
  private browser: Browser | null = null;
  private pages: Page[] = [];
  private pagePool: Page[] = [];
  private quotesCache: Quote[] = [];
  private usedQuotes: Set<string> = new Set();
  private isInitialized = false;
  private readonly MAX_PAGES = 3;
  private readonly SCRAPING_QUEUE: Array<() => Promise<void>> = [];
  private activeRequests = 0;
  private readonly MAX_CONCURRENT = 5;

  async initialize() {
    if (this.isInitialized) return;

    try {
      // Check if we're running on Vercel/Linux or local development
      const isVercel = process.env.VERCEL === '1';
      const isLinux = process.platform === 'linux';

      console.log('Environment check:', {
        isVercel,
        isLinux,
        platform: process.platform,
        nodeEnv: process.env.NODE_ENV
      });

      if (isVercel || (process.env.NODE_ENV === 'production' && isLinux)) {
        console.log('Using @sparticuz/chromium for serverless environment');
        // Use @sparticuz/chromium for production Linux environments
        const puppeteerCore = await import('puppeteer-core');

        // Define custom viewport as required by new API
        const viewport = {
          deviceScaleFactor: 1,
          hasTouch: false,
          height: 1080,
          isLandscape: true,
          isMobile: false,
          width: 1920,
        };

        const browser = await puppeteerCore.default.launch({
          args: puppeteerCore.default.defaultArgs({
            args: chromium.args,
            headless: "shell"
          }),
          defaultViewport: viewport,
          executablePath: await chromium.executablePath(),
          headless: "shell",
        });
        this.browser = browser as unknown as Browser;
      } else {
        console.log('Using regular puppeteer for local development');
        // Use regular puppeteer for local development (macOS/Windows)
        const puppeteerRegular = await import('puppeteer');
        const browser = await puppeteerRegular.default.launch({
          headless: true,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu',
            '--disable-web-security',
            '--disable-features=VizDisplayCompositor'
          ]
        });
        this.browser = browser as unknown as Browser;
      }

      // Create page pool
      for (let i = 0; i < this.MAX_PAGES; i++) {
        const page = await this.browser.newPage();
        await page.setUserAgent(
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        );
        this.pagePool.push(page as unknown as Page);
      }

      this.isInitialized = true;
      console.log('Puppeteer initialized successfully');
    } catch (error) {
      console.error('Failed to initialize scraping service:', error);
      throw error;
    }
  }

  private async getPage(): Promise<Page> {
    if (this.pagePool.length > 0) {
      return this.pagePool.pop()!;
    }

    // If no pages available, wait a bit and try again
    await new Promise(resolve => setTimeout(resolve, 100));
    return this.getPage();
  }

  private returnPage(page: Page) {
    this.pagePool.push(page);
  }

  private async processQueue() {
    if (this.activeRequests >= this.MAX_CONCURRENT || this.SCRAPING_QUEUE.length === 0) {
      return;
    }

    const task = this.SCRAPING_QUEUE.shift();
    if (task) {
      this.activeRequests++;
      try {
        await task();
      } finally {
        this.activeRequests--;
        // Process next item in queue
        setImmediate(() => this.processQueue());
      }
    }
  }

  async scrapeQuote(onProgress?: (progress: ScrapingProgress) => void): Promise<Quote> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    return new Promise((resolve, reject) => {
      const task = async () => {
        try {
          const quote = await this.performScraping(onProgress);
          resolve(quote);
        } catch (error) {
          reject(error);
        }
      };

      this.SCRAPING_QUEUE.push(task);
      this.processQueue();
    });
  }

  private async performScraping(onProgress?: (progress: ScrapingProgress) => void): Promise<Quote> {
    const page = await this.getPage();

    try {
      // Check if we have unused quotes in cache first
      if (this.quotesCache.length > 0) {
        const availableQuotes = this.quotesCache.filter(q => !this.usedQuotes.has(q.text));
        if (availableQuotes.length > 0) {
          const randomQuote = availableQuotes[Math.floor(Math.random() * availableQuotes.length)];
          this.usedQuotes.add(randomQuote.text);

          // Still show loading animation for UX
          await this.simulateLoadingStages(onProgress);
          return randomQuote;
        }
      }

      // Need to scrape new quotes
      const randomPage = Math.floor(Math.random() * 10) + 1;
      const stages = [
        'Starting fetch...',
        `Browsing to page ${randomPage}...`,
        'Loading quotes...',
        'Selecting random quote...',
        'Selected.'
      ];

      // Stage 1: Starting
      onProgress?.({ stage: 1, message: stages[0], totalStages: 5 });
      await this.randomDelay();

      // Stage 2: Browsing to page
      onProgress?.({ stage: 2, message: stages[1], totalStages: 5 });

      const targetUrl = randomPage === 1 ? 'https://quotes.toscrape.com/' : `https://quotes.toscrape.com/page/${randomPage}/`;
      await page.goto(targetUrl, { waitUntil: 'networkidle2' });
      await this.randomDelay();

      // Stage 3: Loading quotes
      onProgress?.({ stage: 3, message: stages[2], totalStages: 5 });
      await this.randomDelay();

      // Stage 4: Selecting quote
      onProgress?.({ stage: 4, message: stages[3], totalStages: 5 });

      // Scrape quotes from current page
      const newQuotes = await page.evaluate(() => {
        const quotes: Quote[] = [];
        const quoteElements = document.querySelectorAll('.quote');

        quoteElements.forEach(element => {
          const text = element.querySelector('.text')?.textContent?.replace(/[""]/g, '').trim() || '';
          const author = element.querySelector('.author')?.textContent?.trim() || '';
          const tagElements = element.querySelectorAll('.tag');
          const tags = Array.from(tagElements).map(tag => tag.textContent?.trim() || '');

          // Get author URL (available without login)
          const aboutLink = element.querySelector('a[href*="/author/"]')?.getAttribute('href');
          const sourceUrl = aboutLink ? `https://quotes.toscrape.com${aboutLink}` : undefined;

          if (text && author) {
            quotes.push({ text, author, tags, sourceUrl });
          }
        });

        return quotes;
      });

      // Add new quotes to cache
      this.quotesCache.push(...newQuotes);
      await this.randomDelay();

      // Stage 5: Selected
      onProgress?.({ stage: 5, message: stages[4], totalStages: 5 });

      // Select a random quote from newly scraped ones
      if (newQuotes.length === 0) {
        throw new Error('No quotes found on the page');
      }

      const selectedQuote = newQuotes[Math.floor(Math.random() * newQuotes.length)];
      this.usedQuotes.add(selectedQuote.text);

      return selectedQuote;

    } catch (error) {
      console.error('Scraping error:', error);
      throw new Error('Failed to scrape quote');
    } finally {
      this.returnPage(page);
    }
  }

  private async simulateLoadingStages(onProgress?: (progress: ScrapingProgress) => void) {
    const randomPage = Math.floor(Math.random() * 10) + 1;
    const stages = [
      'Starting fetch...',
      `Browsing to page ${randomPage}...`,
      'Loading quotes...',
      'Selecting random quote...',
      'Selected.'
    ];

    for (let i = 0; i < stages.length; i++) {
      onProgress?.({ stage: i + 1, message: stages[i], totalStages: 5 });
      await this.randomDelay();
    }
  }

  private async randomDelay(): Promise<void> {
    const delay = Math.floor(Math.random() * (2400 - 1200 + 1)) + 1200;
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  async getRandomQuote(): Promise<Quote> {
    // Get from cache if available
    const availableQuotes = this.quotesCache.filter(q => !this.usedQuotes.has(q.text));

    if (availableQuotes.length > 0) {
      const randomQuote = availableQuotes[Math.floor(Math.random() * availableQuotes.length)];
      this.usedQuotes.add(randomQuote.text);
      return randomQuote;
    }

    // If no cached quotes available, scrape new ones
    return this.scrapeQuote();
  }

  async cleanup() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.isInitialized = false;
      this.pagePool = [];
      this.quotesCache = [];
      this.usedQuotes.clear();
    }
  }

  // Getters for debugging/monitoring
  get cacheSize() { return this.quotesCache.length; }
  get usedQuotesCount() { return this.usedQuotes.size; }
  get queueLength() { return this.SCRAPING_QUEUE.length; }
  get activeRequestsCount() { return this.activeRequests; }
}

// Singleton instance
export const scrapingService = new ScrapingService();

// Cleanup on process exit
process.on('SIGINT', async () => {
  await scrapingService.cleanup();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await scrapingService.cleanup();
  process.exit(0);
});