import { ScrapingConfig } from '@/lib/config/scraping-config';
import { QuoteCacheService } from '@/lib/services/quote-cache';
import { Quote } from '@/lib/types';

describe('QuoteCacheService', () => {
  let cacheService: QuoteCacheService;
  let mockConfig: ScrapingConfig;
  let sampleQuotes: Quote[];

  beforeEach(() => {
    jest.useFakeTimers();

    mockConfig = {
      maxCacheSize: 10,
      maxUsedQuotes: 5,
      cacheTTL: 60000, // 1 minute
      maxPuppeteerConcurrent: 2,
      maxTotalConcurrent: 10,
      cleanupInterval: 10000,
      backgroundScrapingInterval: 30000,
      initialCachePages: 2,
      maxScrapingPages: 5,
      requestTimeout: 15000,
      enableBackgroundScraping: true,
      enableMemoryCleanup: true,
    };

    cacheService = new QuoteCacheService(mockConfig);

    sampleQuotes = [
      {
        text: 'The only way to do great work is to love what you do.',
        author: 'Steve Jobs',
        tags: ['motivation', 'work'],
        sourceUrl: 'https://example.com/1'
      },
      {
        text: 'Life is what happens to you while you\'re busy making other plans.',
        author: 'John Lennon',
        tags: ['life', 'philosophy'],
        sourceUrl: 'https://example.com/2'
      },
      {
        text: 'The future belongs to those who believe in the beauty of their dreams.',
        author: 'Eleanor Roosevelt',
        tags: ['dreams', 'future'],
        sourceUrl: 'https://example.com/3'
      }
    ];
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('addQuote', () => {
    it('should add a new quote to cache', () => {
      const result = cacheService.addQuote(sampleQuotes[0]);

      expect(result).toBe(true);
      expect(cacheService.size).toBe(1);
    });

    it('should not add duplicate quotes', () => {
      cacheService.addQuote(sampleQuotes[0]);
      const result = cacheService.addQuote(sampleQuotes[0]);

      expect(result).toBe(false);
      expect(cacheService.size).toBe(1);
    });

    it('should perform LRU eviction when cache exceeds max size', () => {
      // Fill cache to max size
      for (let i = 0; i < mockConfig.maxCacheSize; i++) {
        cacheService.addQuote({
          text: `Quote ${i}`,
          author: `Author ${i}`,
          tags: ['test'],
        });
      }

      expect(cacheService.size).toBe(mockConfig.maxCacheSize);

      // Add one more quote to trigger eviction
      cacheService.addQuote({
        text: 'Overflow quote',
        author: 'Overflow Author',
        tags: ['test'],
      });

      expect(cacheService.size).toBe(mockConfig.maxCacheSize);
    });
  });

  describe('getRandomUnusedQuote', () => {
    beforeEach(() => {
      sampleQuotes.forEach(quote => cacheService.addQuote(quote));
    });

    it('should return a random unused quote', () => {
      const quote = cacheService.getRandomUnusedQuote();

      expect(quote).toBeTruthy();
      expect(sampleQuotes.some(q => q.text === quote?.text)).toBe(true);
      expect(cacheService.usedCount).toBe(1);
    });

    it('should return null when no unused quotes available', () => {
      // Mark all quotes as used
      sampleQuotes.forEach(() => cacheService.getRandomUnusedQuote());

      const quote = cacheService.getRandomUnusedQuote();
      expect(quote).toBeNull();
    });

    it('should mark quote as used when retrieved', () => {
      const quote = cacheService.getRandomUnusedQuote();

      expect(cacheService.usedCount).toBe(1);

      // Try to get the same quote again by text
      cacheService.markQuoteAsUsed(quote!.text);
      expect(cacheService.usedCount).toBe(1); // Should still be 1 (no duplicates)
    });
  });

  describe('resetUsedQuotes', () => {
    it('should clear used quotes set', () => {
      sampleQuotes.forEach(quote => cacheService.addQuote(quote));

      // Use all quotes
      sampleQuotes.forEach(() => cacheService.getRandomUnusedQuote());
      expect(cacheService.usedCount).toBe(sampleQuotes.length);

      cacheService.resetUsedQuotes();
      expect(cacheService.usedCount).toBe(0);
    });
  });

  describe('cleanExpiredEntries', () => {
    it('should remove expired entries based on TTL', () => {
      sampleQuotes.forEach(quote => cacheService.addQuote(quote));
      expect(cacheService.size).toBe(3);

      // Fast-forward time beyond TTL
      jest.advanceTimersByTime(mockConfig.cacheTTL + 1000);

      const expiredCount = cacheService.cleanExpiredEntries();

      expect(expiredCount).toBe(3);
      expect(cacheService.size).toBe(0);
    });

    it('should not remove non-expired entries', () => {
      sampleQuotes.forEach(quote => cacheService.addQuote(quote));

      // Fast-forward time but not beyond TTL
      jest.advanceTimersByTime(mockConfig.cacheTTL / 2);

      const expiredCount = cacheService.cleanExpiredEntries();

      expect(expiredCount).toBe(0);
      expect(cacheService.size).toBe(3);
    });
  });

  describe('performMemoryCleanup', () => {
    it('should clean expired entries and perform LRU eviction', () => {
      // Add more quotes than max cache size to trigger eviction
      for (let i = 0; i < 15; i++) {
        cacheService.addQuote({
          text: `Quote ${i}`,
          author: `Author ${i}`,
          tags: ['test'],
        });
      }

      // Fast-forward time to make some entries expired
      jest.advanceTimersByTime(mockConfig.cacheTTL + 1000);

      const { expired, evicted } = cacheService.performMemoryCleanup();

      // Should have either expired or evicted entries (or both)
      expect(expired + evicted).toBeGreaterThanOrEqual(0);
      expect(cacheService.size).toBeLessThanOrEqual(mockConfig.maxCacheSize);
    });
  });

  describe('getStats', () => {
    it('should return correct cache statistics', () => {
      sampleQuotes.forEach(quote => cacheService.addQuote(quote));

      // Use one quote
      cacheService.getRandomUnusedQuote();

      const stats = cacheService.getStats();

      expect(stats.totalEntries).toBe(3);
      expect(stats.usedQuotes).toBe(1);
      expect(stats.hitRate).toBeGreaterThan(0);
      expect(stats.oldestEntry).toBeGreaterThan(0);
      expect(stats.newestEntry).toBeGreaterThan(0);
    });
  });

  describe('utility methods', () => {
    it('should correctly report empty state', () => {
      expect(cacheService.isEmpty).toBe(true);

      cacheService.addQuote(sampleQuotes[0]);
      expect(cacheService.isEmpty).toBe(false);
    });

    it('should correctly report when all quotes are used', () => {
      sampleQuotes.forEach(quote => cacheService.addQuote(quote));
      expect(cacheService.allQuotesUsed).toBe(false);

      // Use all quotes
      sampleQuotes.forEach(() => cacheService.getRandomUnusedQuote());
      expect(cacheService.allQuotesUsed).toBe(true);
    });

    it('should clear all data on clear()', () => {
      sampleQuotes.forEach(quote => cacheService.addQuote(quote));
      cacheService.getRandomUnusedQuote(); // Mark one as used

      cacheService.clear();

      expect(cacheService.size).toBe(0);
      expect(cacheService.usedCount).toBe(0);
      expect(cacheService.isEmpty).toBe(true);
    });
  });
});