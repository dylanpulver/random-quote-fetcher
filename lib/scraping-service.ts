import { getScrapingConfigWithEnvOverrides } from './config/scraping-config';
import { PuppeteerScraper } from './services/puppeteer-scraper';
import { QuoteCacheService } from './services/quote-cache';
import { HealthStatus, Quote, ScrapingProgress } from './types';

/**
 * Main scraping service that orchestrates caching, scraping, and queue management
 * Supports up to 300 concurrent requests with intelligent fallbacks
 */
class ScrapingService {
  private config = getScrapingConfigWithEnvOverrides();
  private cache = new QuoteCacheService(this.config);
  private scraper = new PuppeteerScraper(this.config);

  private isInitialized = false;
  private initializationPromise: Promise<void> | null = null;

  // Queue and concurrency management
  private readonly SCRAPING_QUEUE: Array<() => Promise<void>> = [];
  private activeRequests = 0;

  // Background timers
  private cleanupTimer: NodeJS.Timeout | null = null;
  private backgroundScrapingTimer: NodeJS.Timeout | null = null;

  /**
   * Initialize the scraping service
   */
  async initialize(): Promise<void> {
    // Prevent multiple concurrent initializations
    if (this.initializationPromise) {
      console.log('⏳ Waiting for existing initialization to complete...');
      return this.initializationPromise;
    }

    if (this.isInitialized) {
      console.log('✅ Scraping service already initialized');
      return;
    }

    this.initializationPromise = this._performInitialization();
    return this.initializationPromise;
  }

  /**
   * Perform the actual initialization
   */
  private async _performInitialization(): Promise<void> {
    try {
      console.log('🚀 Starting scraping service initialization...');

      // Initialize Puppeteer scraper
      await this.scraper.initialize();

      // Start background processes
      if (this.config.enableMemoryCleanup) {
        this.startCleanupTimer();
      }

      // Populate initial cache
      await this.initializeCache();

      // Start background scraping
      if (this.config.enableBackgroundScraping) {
        this.startBackgroundScraping();
      }

      this.isInitialized = true;
      this.initializationPromise = null;

      console.log(`✅ Scraping service initialized with ${this.cache.size} quotes from quotes.toscrape.com`);
    } catch (error) {
      console.error('❌ Failed to initialize scraping service:', error);
      this.initializationPromise = null;
      // Still mark as initialized to allow graceful degradation
      this.isInitialized = true;
    }
  }

  /**
   * Pre-populate cache with quotes from the website
   */
  private async initializeCache(): Promise<void> {
    console.log('📚 Populating initial cache from quotes.toscrape.com...');

    try {
      const pageNumbers = Array.from(
        { length: this.config.initialCachePages },
        (_, i) => i + 1
      );

      const results = await this.scraper.scrapeMultiplePages(pageNumbers);

      let totalQuotes = 0;
      results.forEach(result => {
        if (result.success) {
          result.quotes.forEach(quote => {
            if (this.cache.addQuote(quote)) {
              totalQuotes++;
            }
          });
        }
      });

      const successfulPages = results.filter(r => r.success).length;
      console.log(`📖 Initial cache populated: ${totalQuotes} quotes from ${successfulPages}/${results.length} pages`);
    } catch (error) {
      console.error('❌ Failed to populate initial cache:', error);
    }
  }

  /**
   * Start background scraping to keep cache fresh
   */
  private startBackgroundScraping(): void {
    if (this.backgroundScrapingTimer) {
      clearInterval(this.backgroundScrapingTimer);
    }

    this.backgroundScrapingTimer = setInterval(async () => {
      // Only scrape if we have available capacity and cache needs refilling
      if (this.cache.size < this.config.maxCacheSize / 2 && this.scraper.canAcceptRequest()) {
        try {
          const randomPage = Math.floor(Math.random() * this.config.maxScrapingPages) + 1;
          const result = await this.scraper.scrapePage(randomPage);

          if (result.success) {
            let addedQuotes = 0;
            result.quotes.forEach(quote => {
              if (this.cache.addQuote(quote)) {
                addedQuotes++;
              }
            });

            if (addedQuotes > 0) {
              console.log(`🔄 Background scraping: Added ${addedQuotes} new quotes from page ${randomPage}`);
            }
          }
        } catch (error) {
          console.warn('⚠️ Background scraping failed:', error);
        }
      }
    }, this.config.backgroundScrapingInterval);
  }

  /**
   * Start memory cleanup timer
   */
  private startCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    this.cleanupTimer = setInterval(() => {
      const { expired, evicted } = this.cache.performMemoryCleanup();

      if (expired > 0 || evicted > 0) {
        console.log(`🧹 Memory cleanup: ${expired} expired, ${evicted} evicted. Cache: ${this.cache.size}, Used: ${this.cache.usedCount}`);
      }
    }, this.config.cleanupInterval);
  }

  /**
   * Process the request queue
   */
  private async processQueue(): Promise<void> {
    while (this.activeRequests < this.config.maxTotalConcurrent && this.SCRAPING_QUEUE.length > 0) {
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

  /**
   * Get a quote from cache or scrape on-demand
   */
  private async getQuoteFromCache(onProgress?: (progress: ScrapingProgress) => void): Promise<Quote> {
    // Try to get from cache first
    const cachedQuote = this.cache.getRandomUnusedQuote();
    if (cachedQuote) {
      await this.simulateLoadingStages(onProgress);
      return cachedQuote;
    }

    console.log('💭 Cache miss - checking for fallback options...');

    // If all quotes have been used, reset and try again
    if (this.cache.allQuotesUsed) {
      this.cache.resetUsedQuotes();
      const resetQuote = this.cache.getRandomUnusedQuote();
      if (resetQuote) {
        await this.simulateLoadingStages(onProgress);
        return resetQuote;
      }
    }

    // Last resort: scrape on-demand
    console.log('🔄 Performing on-demand scraping...');

    if (!this.scraper.canAcceptRequest()) {
      throw new Error('Scraper at capacity - please try again shortly');
    }

    try {
      const randomPage = Math.floor(Math.random() * this.config.maxScrapingPages) + 1;
      const result = await this.scraper.scrapePage(randomPage);

      if (result.success && result.quotes.length > 0) {
        // Add all quotes to cache
        result.quotes.forEach(quote => this.cache.addQuote(quote));

        // Return a random quote from the newly scraped ones
        const randomQuote = result.quotes[Math.floor(Math.random() * result.quotes.length)];
        this.cache.markQuoteAsUsed(randomQuote.text); // Mark as used

        await this.simulateLoadingStages(onProgress);
        return randomQuote;
      } else {
        throw new Error(result.error || 'Failed to scrape quotes');
      }
    } catch (error) {
      console.error('❌ On-demand scraping failed:', error);
      throw new Error('Unable to fetch quotes from quotes.toscrape.com - please check your connection');
    }
  }

  /**
   * Simulate loading stages for user feedback
   */
  private async simulateLoadingStages(onProgress?: (progress: ScrapingProgress) => void): Promise<void> {
    const randomPage = Math.floor(Math.random() * this.config.maxScrapingPages) + 1;
    const stages = [
      'Starting fetch...',
      'Connecting...',
      `Browsing to page ${randomPage}...`,
      'Loading quotes...',
      'Selecting random quote...',
      'Selected.'
    ];

    for (let i = 0; i < stages.length; i++) {
      onProgress?.({ stage: i + 1, message: stages[i], totalStages: stages.length });
      if (i < stages.length - 1) {
        // Fast for 300 concurrent requests
        await new Promise(resolve => setTimeout(resolve, Math.random() * 200 + 50));
      }
    }
  }

  /**
   * Main method to scrape a quote with progress updates
   */
  async scrapeQuote(onProgress?: (progress: ScrapingProgress) => void): Promise<Quote> {
    if (!this.isInitialized || this.initializationPromise) {
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

  /**
   * Get a random quote (alias for scrapeQuote without progress)
   */
  async getRandomQuote(): Promise<Quote> {
    return this.scrapeQuote();
  }

  /**
   * Get health status of the service
   */
  getHealthStatus(): HealthStatus {
    const scraperStatus = this.scraper.getStatus();

    return {
      initialized: this.isInitialized,
      cacheSize: this.cache.size,
      usedQuotes: this.cache.usedCount,
      activeRequests: this.activeRequests,
      maxConcurrent: this.config.maxTotalConcurrent,
      queueLength: this.SCRAPING_QUEUE.length,
      puppeteerActive: scraperStatus.activeScrapes,
      browserConnected: scraperStatus.browserConnected
    };
  }

  /**
   * Get detailed service statistics
   */
  getDetailedStats() {
    return {
      config: this.config,
      cache: this.cache.getStats(),
      scraper: this.scraper.getStatus(),
      service: this.getHealthStatus()
    };
  }

  /**
   * Cleanup all resources
   */
  async cleanup(): Promise<void> {
    console.log('🧹 Starting scraping service cleanup...');

    // Clear timers
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }

    if (this.backgroundScrapingTimer) {
      clearInterval(this.backgroundScrapingTimer);
      this.backgroundScrapingTimer = null;
    }

    // Cleanup scraper
    await this.scraper.cleanup();

    // Clear cache
    this.cache.clear();

    // Reset state
    this.isInitialized = false;
    this.initializationPromise = null;
    this.SCRAPING_QUEUE.length = 0;
    this.activeRequests = 0;

    console.log('✅ Scraping service cleanup completed');
  }

  // Getters for backward compatibility
  get cacheSize(): number { return this.cache.size; }
  get usedQuotesCount(): number { return this.cache.usedCount; }
  get queueLength(): number { return this.SCRAPING_QUEUE.length; }
  get activeRequestsCount(): number { return this.activeRequests; }
  get maxConcurrent(): number { return this.config.maxTotalConcurrent; }
}

// Singleton instance
export const scrapingService = new ScrapingService();

// Graceful shutdown handlers
const gracefulShutdown = async (signal: string) => {
  console.log(`📢 Received ${signal}. Starting graceful shutdown...`);
  try {
    await scrapingService.cleanup();
    console.log('✅ Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));