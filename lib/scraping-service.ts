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
        const chromium = await import('@sparticuz/chromium');

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
            args: chromium.default.args,
            headless: "shell"
          }),
          defaultViewport: viewport,
          executablePath: await chromium.default.executablePath(),
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
        'Logging in...',
        `Browsing to page ${randomPage}...`,
        'Loading quotes...',
        'Selecting random quote...',
        'Selected.'
      ];

      // Stage 1: Starting
      onProgress?.({ stage: 1, message: stages[0], totalStages: 6 });
      await this.randomDelay(500, 800); // Shorter delay for starting

      // Stage 2: Logging in
      onProgress?.({ stage: 2, message: stages[1], totalStages: 6 });
      try {
        await this.performLogin(page);
      } catch (loginError) {
        console.warn('Login failed, continuing without login:', loginError);
        // Continue without login - some quotes might not have Goodreads links
      }
      await this.randomDelay(300, 600); // Small delay for login

      // Stage 3: Browsing to page
      onProgress?.({ stage: 3, message: stages[2], totalStages: 6 });

      const targetUrl = randomPage === 1 ? 'https://quotes.toscrape.com/' : `https://quotes.toscrape.com/page/${randomPage}/`;
      await page.goto(targetUrl, { waitUntil: 'networkidle2' });
      await this.randomDelay();

      // Stage 4: Loading quotes
      onProgress?.({ stage: 4, message: stages[3], totalStages: 6 });
      await this.randomDelay();

      // Stage 5: Selecting quote
      onProgress?.({ stage: 5, message: stages[4], totalStages: 6 });

      // Scrape quotes from current page
      const newQuotes = await page.evaluate(() => {
        const quotes: Quote[] = [];
        const quoteElements = document.querySelectorAll('.quote');

        quoteElements.forEach(element => {
          const text = element.querySelector('.text')?.textContent?.replace(/[""]/g, '').trim() || '';
          const author = element.querySelector('.author')?.textContent?.trim() || '';
          const tagElements = element.querySelectorAll('.tag');
          const tags = Array.from(tagElements).map(tag => tag.textContent?.trim() || '');

          // Extract Goodreads URL (available after login)
          const goodreadsLink = element.querySelector('a[href*="goodreads.com"]')?.getAttribute('href');
          const sourceUrl = goodreadsLink || undefined;

          if (text && author) {
            quotes.push({ text, author, tags, sourceUrl });
          }
        });

        return quotes;
      });

      // Add new quotes to cache
      this.quotesCache.push(...newQuotes);
      await this.randomDelay();

      // Stage 6: Selected
      onProgress?.({ stage: 6, message: stages[5], totalStages: 6 });

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

  private async performLogin(page: Page): Promise<void> {
    try {
      // Navigate to login page
      await page.goto('https://quotes.toscrape.com/login', { waitUntil: 'networkidle2' });

      // Fill in the login form with dummy credentials
      await page.type('input[name="username"]', 'abc');
      await page.type('input[name="password"]', '123');

      // Submit the form
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle2' }),
        page.click('input[type="submit"]')
      ]);

      // Verify login was successful by checking if we're redirected away from login page
      const currentUrl = page.url();
      if (currentUrl.includes('/login')) {
        throw new Error('Login appears to have failed - still on login page');
      }

      console.log('Login successful');
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }

  private async simulateLoadingStages(onProgress?: (progress: ScrapingProgress) => void) {
    const randomPage = Math.floor(Math.random() * 10) + 1;
    const stages = [
      'Starting fetch...',
      'Logging in...',
      `Browsing to page ${randomPage}...`,
      'Loading quotes...',
      'Selecting random quote...',
      'Selected.'
    ];

    for (let i = 0; i < stages.length; i++) {
      onProgress?.({ stage: i + 1, message: stages[i], totalStages: 6 });
      if (i === 0) {
        await this.randomDelay(500, 800); // Shorter for starting
      } else if (i === 1) {
        await this.randomDelay(300, 600); // Small delay for login
      } else {
        await this.randomDelay();
      }
    }
  }

  private async randomDelay(min: number = 1200, max: number = 2400): Promise<void> {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
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