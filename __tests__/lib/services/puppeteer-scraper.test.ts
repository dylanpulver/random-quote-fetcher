import { ScrapingConfig } from '@/lib/config/scraping-config';
import { PuppeteerScraper } from '@/lib/services/puppeteer-scraper';

describe('PuppeteerScraper', () => {
  let scraper: PuppeteerScraper;
  let mockConfig: ScrapingConfig;

  beforeEach(() => {
    mockConfig = {
      maxPuppeteerConcurrent: 3,
      maxTotalConcurrent: 100,
      maxCacheSize: 1000,
      maxUsedQuotes: 500,
      cacheTTL: 60000,
      cleanupInterval: 10000,
      backgroundScrapingInterval: 30000,
      initialCachePages: 2,
      maxScrapingPages: 10,
      requestTimeout: 15000,
      enableBackgroundScraping: true,
      enableMemoryCleanup: true,
    };

    scraper = new PuppeteerScraper(mockConfig);
  });

  describe('basic functionality', () => {
    it('should initialize successfully', async () => {
      await scraper.initialize();

      const status = scraper.getStatus();
      expect(status.initialized).toBe(true);
      expect(status.maxConcurrent).toBe(mockConfig.maxPuppeteerConcurrent);
    });

    it('should return correct status when not initialized', () => {
      const status = scraper.getStatus();

      expect(status).toMatchObject({
        initialized: false,
        browserConnected: false,
        activeScrapes: 0,
        maxConcurrent: mockConfig.maxPuppeteerConcurrent,
        availableSlots: mockConfig.maxPuppeteerConcurrent,
      });
    });

    it('should handle cleanup gracefully', async () => {
      await scraper.initialize();

      // Should not throw
      await expect(scraper.cleanup()).resolves.not.toThrow();

      const status = scraper.getStatus();
      expect(status.initialized).toBe(false);
    });

    it('should check request acceptance correctly', () => {
      // Before initialization
      expect(scraper.canAcceptRequest()).toBe(false);
    });
  });

  describe('configuration', () => {
    it('should use provided configuration', () => {
      const status = scraper.getStatus();
      expect(status.maxConcurrent).toBe(mockConfig.maxPuppeteerConcurrent);
    });
  });
});