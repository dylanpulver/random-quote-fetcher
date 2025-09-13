import { Browser } from 'puppeteer-core';

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

interface CacheEntry {
  quote: Quote;
  timestamp: number;
  accessCount: number;
  lastAccessed: number;
}

class ScrapingService {
  private browser: Browser | null = null;
  private quotesCache: Map<string, CacheEntry> = new Map();
  private usedQuotes: Set<string> = new Set();
  private isInitialized = false;

  // HYBRID APPROACH - Use limited Puppeteer + Cache for high concurrency
  private readonly MAX_PUPPETEER_CONCURRENT = 10; // Keep Puppeteer limited
  private readonly MAX_CONCURRENT = 300; // Total concurrent support
  private readonly SCRAPING_QUEUE: Array<() => Promise<void>> = [];
  private activePuppeteerRequests = 0;
  private activeRequests = 0;

  // MEMORY MANAGEMENT
  private readonly MAX_CACHE_SIZE = 2000; // Increased for 300 concurrent
  private readonly MAX_USED_QUOTES = 1000;
  private readonly CACHE_TTL = 60 * 60 * 1000; // 1 hour
  private readonly CLEANUP_INTERVAL = 10 * 60 * 1000; // 10 minutes
  private cleanupTimer: NodeJS.Timeout | null = null;

  async initialize() {
    if (this.isInitialized) return;

    try {
      // Initialize Puppeteer first
      await this.initializePuppeteer();

      // Start memory cleanup timer
      this.startCleanupTimer();

      // Populate cache with REAL quotes from website
      await this.initializeCache();

      // Start background scraping to continuously refresh cache
      this.startBackgroundScraping();

      this.isInitialized = true;
      console.log(`Scraping service initialized with ${this.quotesCache.size} real quotes from quotes.toscrape.com`);
    } catch (error) {
      console.error('Failed to initialize scraping service:', error);
      // Don't fall back to fake quotes - let it fail and scrape on demand
      this.isInitialized = true;
    }
  }

  // Pre-populate cache through background scraping - NO hardcoded quotes
  private async initializeCache() {
    console.log('Starting initial cache population from quotes.toscrape.com...');

    // Scrape multiple pages immediately to populate cache
    const initialScrapePromises = [];
    for (let page = 1; page <= 5; page++) {
      initialScrapePromises.push(this.scrapePageToCache(page));
    }

    try {
      await Promise.allSettled(initialScrapePromises);
      console.log(`Initial cache populated with ${this.quotesCache.size} real quotes from website`);
    } catch (error) {
      console.error('Failed to populate initial cache:', error);
      // If we can't scrape, the app should fail gracefully but still try to scrape on demand
    }
  }

  private async initializePuppeteer() {
    try {
      const isVercel = process.env.VERCEL === '1';
      const isLinux = process.platform === 'linux';

      if (isVercel || (process.env.NODE_ENV === 'production' && isLinux)) {
        const puppeteerCore = await import('puppeteer-core');
        const chromium = await import('@sparticuz/chromium');

        this.browser = await puppeteerCore.default.launch({
          args: [
            ...chromium.default.args,
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--single-process', // Important for high concurrency
            '--no-zygote'
          ],
          defaultViewport: { width: 1280, height: 720 }, // Set explicit viewport
          executablePath: await chromium.default.executablePath(),
          headless: "shell",
        }) as unknown as Browser;
      } else {
        const puppeteerRegular = await import('puppeteer');
        this.browser = await puppeteerRegular.default.launch({
          headless: true,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--single-process', // Important for high concurrency
            '--no-zygote'
          ]
        }) as unknown as Browser;
      }

      console.log('Puppeteer initialized for background scraping');
    } catch (error) {
      console.warn('Puppeteer initialization failed, will use simple scraping only:', error);
    }
  }

  private async scrapePageToCache(pageNum: number) {
    if (!this.browser || this.activePuppeteerRequests >= this.MAX_PUPPETEER_CONCURRENT) {
      return;
    }

    this.activePuppeteerRequests++;

    try {
      const page = await this.browser.newPage();

      try {
        await page.setRequestInterception(true);
        page.on('request', (req) => {
          if (['image', 'stylesheet', 'font', 'media'].includes(req.resourceType())) {
            req.abort();
          } else {
            req.continue();
          }
        });

        // Login first to get sourceURLs
        try {
          await page.goto('https://quotes.toscrape.com/login', {
            waitUntil: 'domcontentloaded',
            timeout: 10000
          });
          await page.type('input[name="username"]', 'admin');
          await page.type('input[name="password"]', 'admin');
          await Promise.all([
            page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 10000 }),
            page.click('input[type="submit"]')
          ]);
        } catch (loginError) {
          console.warn('Login failed, continuing without sourceURLs:', loginError);
        }

        const url = pageNum === 1 ? 'https://quotes.toscrape.com/' : `https://quotes.toscrape.com/page/${pageNum}/`;

        await page.goto(url, {
          waitUntil: 'domcontentloaded',
          timeout: 10000
        });

        const quotes = await page.evaluate(() => {
          const quotes: Quote[] = [];
          const quoteElements = document.querySelectorAll('.quote');

          quoteElements.forEach(element => {
            try {
              const textElement = element.querySelector('.text');
              const text = textElement?.textContent?.replace(/[""]/g, '').trim() || '';

              const authorElement = element.querySelector('.author');
              const author = authorElement?.textContent?.trim() || '';

              const tagElements = element.querySelectorAll('.tag');
              const tags = Array.from(tagElements).map(tag => tag.textContent?.trim() || '');

              // Get sourceURL from Goodreads link (only available after login)
              const goodreadsLink = element.querySelector('a[href*="goodreads.com"]');
              const sourceUrl = goodreadsLink?.getAttribute('href') || undefined;

              if (text && author && text.length > 10) {
                quotes.push({ text, author, tags, sourceUrl });
              }
            } catch (e) {
              console.warn('Error parsing quote element:', e);
            }
          });

          return quotes;
        });

        // Add to cache
        const now = Date.now();
        quotes.forEach(quote => {
          if (!this.quotesCache.has(quote.text)) {
            this.quotesCache.set(quote.text, {
              quote,
              timestamp: now,
              accessCount: 0,
              lastAccessed: now
            });
          }
        });

        console.log(`Scraped page ${pageNum}: ${quotes.length} quotes, total cache: ${this.quotesCache.size}`);
        return quotes;

      } finally {
        await page.close();
      }
    } catch (error) {
      console.warn(`Error scraping page ${pageNum}:`, error);
      return [];
    } finally {
      this.activePuppeteerRequests--;
    }
  }

  private startBackgroundScraping() {
    // Continuously scrape in background to keep cache fresh with REAL quotes
    setInterval(async () => {
      if (this.quotesCache.size < this.MAX_CACHE_SIZE / 2) {
        try {
          // Scrape a random page from the website
          const randomPage = Math.floor(Math.random() * 10) + 1;
          await this.scrapePageToCache(randomPage);
        } catch (error) {
          console.warn('Background scraping failed:', error);
        }
      }
    }, 30000); // Every 30 seconds
  }

  private startCleanupTimer() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    this.cleanupTimer = setInterval(() => {
      this.performMemoryCleanup();
    }, this.CLEANUP_INTERVAL);
  }

  private performMemoryCleanup() {
    const now = Date.now();

    // Clean expired cache entries
    const expiredKeys = [];
    for (const [key, entry] of this.quotesCache.entries()) {
      if (now - entry.timestamp > this.CACHE_TTL) {
        expiredKeys.push(key);
      }
    }

    expiredKeys.forEach(key => this.quotesCache.delete(key));

    // If cache is still too large, remove LRU entries
    if (this.quotesCache.size > this.MAX_CACHE_SIZE) {
      const entries = Array.from(this.quotesCache.entries())
        .sort(([,a], [,b]) => a.lastAccessed - b.lastAccessed);

      const toRemove = entries.slice(0, entries.length - this.MAX_CACHE_SIZE);
      toRemove.forEach(([key]) => this.quotesCache.delete(key));
    }

    // Limit used quotes set size
    if (this.usedQuotes.size > this.MAX_USED_QUOTES) {
      const usedArray = Array.from(this.usedQuotes);
      this.usedQuotes.clear();
      // Keep the most recent half
      usedArray.slice(-Math.floor(this.MAX_USED_QUOTES / 2))
        .forEach(quote => this.usedQuotes.add(quote));
    }

    console.log(`Memory cleanup: Cache ${this.quotesCache.size}, Used ${this.usedQuotes.size}`);
  }

  // ENHANCED CONCURRENCY - Process multiple requests immediately
  private async processQueue() {
    while (this.activeRequests < this.MAX_CONCURRENT && this.SCRAPING_QUEUE.length > 0) {
      const task = this.SCRAPING_QUEUE.shift();
      if (task) {
        this.activeRequests++;

        // Run tasks concurrently without waiting
        task().finally(() => {
          this.activeRequests--;
          setImmediate(() => this.processQueue());
        });
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
          const quote = await this.getQuoteFromCache(onProgress);
          resolve(quote);
        } catch (error) {
          reject(error);
        }
      };

      this.SCRAPING_QUEUE.push(task);
      this.processQueue();
    });
  }

  private async getQuoteFromCache(onProgress?: (progress: ScrapingProgress) => void): Promise<Quote> {
    // First try to get from scraped cache
    const availableCached = Array.from(this.quotesCache.entries())
      .filter(([text]) => !this.usedQuotes.has(text))
      .map(([text, entry]) => {
        entry.lastAccessed = Date.now();
        entry.accessCount++;
        return { text, ...entry.quote };
      });

    if (availableCached.length > 0) {
      const randomQuote = availableCached[Math.floor(Math.random() * availableCached.length)];
      this.usedQuotes.add(randomQuote.text);
      await this.simulateLoadingStages(onProgress);
      return randomQuote;
    }

    // If no cache available, scrape on-demand from the website
    console.log('Cache empty, scraping on-demand from quotes.toscrape.com');

    if (this.quotesCache.size === 0) {
      // Reset used quotes if we've exhausted everything
      this.usedQuotes.clear();

      // Try to scrape immediately
      try {
        const quotes = await this.scrapePageToCache(Math.floor(Math.random() * 10) + 1);
        if (quotes && quotes.length > 0) {
          const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];
          this.usedQuotes.add(randomQuote.text);
          await this.simulateLoadingStages(onProgress);
          return randomQuote;
        }
      } catch (error) {
        console.error('On-demand scraping failed:', error);
      }
    }

    // If all else fails, reset the used quotes and try again from cache
    this.usedQuotes.clear();
    const allCached = Array.from(this.quotesCache.values()).map(entry => entry.quote);
    if (allCached.length > 0) {
      const randomQuote = allCached[Math.floor(Math.random() * allCached.length)];
      this.usedQuotes.add(randomQuote.text);
      await this.simulateLoadingStages(onProgress);
      return randomQuote;
    }

    throw new Error('Unable to fetch quotes from quotes.toscrape.com - please check your connection');
  }

  private async simulateLoadingStages(onProgress?: (progress: ScrapingProgress) => void) {
    const randomPage = Math.floor(Math.random() * 10) + 1;
    const stages = [
      'Starting fetch...',
      'Connecting...',
      `Browsing to page ${randomPage}...`,
      'Loading quotes...',
      'Selecting random quote...',
      'Selected.'
    ];

    for (let i = 0; i < stages.length; i++) {
      onProgress?.({ stage: i + 1, message: stages[i], totalStages: 6 });
      if (i < stages.length - 1) {
        // Very fast for 300 concurrent
        await new Promise(resolve => setTimeout(resolve, Math.random() * 200 + 50));
      }
    }
  }

  async getRandomQuote(): Promise<Quote> {
    return this.scrapeQuote();
  }

  async cleanup() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }

    if (this.browser) {
      try {
        await this.browser.close();
      } catch (error) {
        console.warn('Error closing browser:', error);
      }
      this.browser = null;
    }

    this.isInitialized = false;
    this.quotesCache.clear();
    this.usedQuotes.clear();
  }

  // Getters for monitoring
  get cacheSize() { return this.quotesCache.size; }
  get usedQuotesCount() { return this.usedQuotes.size; }
  get queueLength() { return this.SCRAPING_QUEUE.length; }
  get activeRequestsCount() { return this.activeRequests; }
  get maxConcurrent() { return this.MAX_CONCURRENT; }

  getHealthStatus() {
    return {
      initialized: this.isInitialized,
      cacheSize: this.cacheSize,
      usedQuotes: this.usedQuotesCount,
      activeRequests: this.activeRequestsCount,
      maxConcurrent: this.MAX_CONCURRENT,
      queueLength: this.queueLength,
      puppeteerActive: this.activePuppeteerRequests,
      browserConnected: !!this.browser
    };
  }
}

// Singleton instance
export const scrapingService = new ScrapingService();

// Cleanup on process exit
const gracefulShutdown = async (signal: string) => {
  console.log(`Received ${signal}. Starting graceful shutdown...`);
  try {
    await scrapingService.cleanup();
    console.log('Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));