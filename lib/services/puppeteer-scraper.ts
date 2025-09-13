import { ScrapingConfig } from '@/lib/config/scraping-config';
import { Quote } from '@/lib/types';
import { Browser, Page } from 'puppeteer-core';

export interface ScrapingResult {
  quotes: Quote[];
  pageNumber: number;
  success: boolean;
  error?: string;
}

/**
 * Puppeteer-based web scraper for quotes.toscrape.com
 * Handles browser management and page scraping operations
 */
export class PuppeteerScraper {
  private browser: Browser | null = null;
  private config: ScrapingConfig;
  private activeScrapes = 0;
  private isInitialized = false;

  constructor(config: ScrapingConfig) {
    this.config = config;
  }

  /**
   * Initialize the browser instance
   */
  async initialize(): Promise<void> {
    if (this.isInitialized && this.browser) {
      return;
    }

    try {
      console.log('🚀 Initializing Puppeteer browser...');

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
            '--single-process',
            '--no-zygote'
          ],
          defaultViewport: { width: 1280, height: 720 },
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
            '--single-process',
            '--no-zygote'
          ]
        }) as unknown as Browser;
      }

      this.isInitialized = true;
      console.log('✅ Puppeteer browser initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Puppeteer:', error);
      throw error;
    }
  }

  /**
   * Scrape a specific page for quotes
   */
  async scrapePage(pageNumber: number): Promise<ScrapingResult> {
    if (!this.browser || !this.isInitialized) {
      throw new Error('Browser not initialized');
    }

    if (this.activeScrapes >= this.config.maxPuppeteerConcurrent) {
      throw new Error('Maximum concurrent scraping limit reached');
    }

    this.activeScrapes++;

    try {
      console.log(`📖 Scraping page ${pageNumber}...`);

      const page = await this.browser.newPage();

      try {
        // Optimize page loading
        await this.optimizePage(page);

        // Login first to get source URLs
        const loginSuccess = await this.performLogin(page);
        if (!loginSuccess) {
          console.warn(`⚠️ Login failed for page ${pageNumber}, continuing without source URLs`);
        }

        // Navigate to quotes page
        const url = pageNumber === 1
          ? 'https://quotes.toscrape.com/'
          : `https://quotes.toscrape.com/page/${pageNumber}/`;

        await page.goto(url, {
          waitUntil: 'domcontentloaded',
          timeout: this.config.requestTimeout
        });

        // Extract quotes from page
        const quotes = await this.extractQuotes(page);

        console.log(`✅ Successfully scraped ${quotes.length} quotes from page ${pageNumber}`);

        return {
          quotes,
          pageNumber,
          success: true
        };

      } finally {
        await page.close();
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown scraping error';
      console.error(`❌ Failed to scrape page ${pageNumber}:`, errorMessage);

      return {
        quotes: [],
        pageNumber,
        success: false,
        error: errorMessage
      };
    } finally {
      this.activeScrapes--;
    }
  }

  /**
   * Optimize page for faster loading
   */
  private async optimizePage(page: Page): Promise<void> {
    await page.setRequestInterception(true);

    page.on('request', (req) => {
      // Block unnecessary resources for faster scraping
      if (['image', 'stylesheet', 'font', 'media'].includes(req.resourceType())) {
        req.abort();
      } else {
        req.continue();
      }
    });
  }

  /**
   * Perform login to access source URLs
   */
  private async performLogin(page: Page): Promise<boolean> {
    try {
      await page.goto('https://quotes.toscrape.com/login', {
        waitUntil: 'domcontentloaded',
        timeout: this.config.requestTimeout
      });

      await page.type('input[name="username"]', 'admin');
      await page.type('input[name="password"]', 'admin');

      await Promise.all([
        page.waitForNavigation({
          waitUntil: 'domcontentloaded',
          timeout: this.config.requestTimeout
        }),
        page.click('input[type="submit"]')
      ]);

      return true;
    } catch (error) {
      console.warn('Login failed:', error);
      return false;
    }
  }

  /**
   * Extract quotes from the current page
   */
  private async extractQuotes(page: Page): Promise<Quote[]> {
    return await page.evaluate(() => {
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

          // Get source URL from Goodreads link (only available after login)
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
  }

  /**
   * Scrape multiple pages concurrently
   */
  async scrapeMultiplePages(pageNumbers: number[]): Promise<ScrapingResult[]> {
    const availableSlots = this.config.maxPuppeteerConcurrent - this.activeScrapes;
    const pagesToScrape = pageNumbers.slice(0, availableSlots);

    if (pagesToScrape.length === 0) {
      console.warn('No available slots for scraping');
      return [];
    }

    console.log(`🔄 Scraping ${pagesToScrape.length} pages concurrently`);

    const scrapePromises = pagesToScrape.map(pageNum => this.scrapePage(pageNum));
    const results = await Promise.allSettled(scrapePromises);

    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        console.error(`Failed to scrape page ${pagesToScrape[index]}:`, result.reason);
        return {
          quotes: [],
          pageNumber: pagesToScrape[index],
          success: false,
          error: result.reason?.message || 'Unknown error'
        };
      }
    });
  }

  /**
   * Check if scraper can handle more requests
   */
  canAcceptRequest(): boolean {
    return this.isInitialized &&
           this.browser !== null &&
           this.activeScrapes < this.config.maxPuppeteerConcurrent;
  }

  /**
   * Get current scraper status
   */
  getStatus() {
    return {
      initialized: this.isInitialized,
      browserConnected: !!this.browser,
      activeScrapes: this.activeScrapes,
      maxConcurrent: this.config.maxPuppeteerConcurrent,
      availableSlots: Math.max(0, this.config.maxPuppeteerConcurrent - this.activeScrapes)
    };
  }

  /**
   * Cleanup browser resources
   */
  async cleanup(): Promise<void> {
    if (this.browser) {
      try {
        console.log('🧹 Closing Puppeteer browser...');
        await this.browser.close();
        this.browser = null;
        this.isInitialized = false;
        console.log('✅ Puppeteer browser closed successfully');
      } catch (error) {
        console.error('❌ Error closing browser:', error);
      }
    }
  }
}