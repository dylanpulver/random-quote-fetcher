// __tests__/lib/config/scraping-config.test.ts
import {
    getScrapingConfig,
    getScrapingConfigWithEnvOverrides
} from '@/lib/config/scraping-config';

describe('Scraping Configuration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('getScrapingConfig', () => {
    it('should return default config for unknown environment', () => {
      process.env.NODE_ENV = 'unknown';
      const config = getScrapingConfig();

      expect(config.maxPuppeteerConcurrent).toBe(5);
      expect(config.maxTotalConcurrent).toBe(300);
      expect(config.maxCacheSize).toBe(2000);
      expect(config.enableBackgroundScraping).toBe(true);
    });

    it('should return development config', () => {
      process.env.NODE_ENV = 'development';
      const config = getScrapingConfig();

      expect(config.maxPuppeteerConcurrent).toBe(2); // Overridden for dev
      expect(config.backgroundScrapingInterval).toBe(120000); // 2 minutes
      expect(config.enableBackgroundScraping).toBe(false); // Disabled in dev
    });

    it('should return production config', () => {
      process.env.NODE_ENV = 'production';
      const config = getScrapingConfig();

      expect(config.maxPuppeteerConcurrent).toBe(8); // More aggressive
      expect(config.backgroundScrapingInterval).toBe(30000); // 30 seconds
      expect(config.cacheTTL).toBe(30 * 60 * 1000); // 30 minutes
    });

    it('should return test config', () => {
      process.env.NODE_ENV = 'test';
      const config = getScrapingConfig();

      expect(config.maxPuppeteerConcurrent).toBe(1);
      expect(config.maxTotalConcurrent).toBe(10);
      expect(config.maxCacheSize).toBe(50);
      expect(config.enableBackgroundScraping).toBe(false);
      expect(config.enableMemoryCleanup).toBe(false);
    });
  });

  describe('getScrapingConfigWithEnvOverrides', () => {
    it('should override config with environment variables', () => {
      process.env.NODE_ENV = 'development';
      process.env.MAX_PUPPETEER_CONCURRENT = '10';
      process.env.MAX_TOTAL_CONCURRENT = '500';
      process.env.MAX_CACHE_SIZE = '3000';
      process.env.CACHE_TTL = '120000';
      process.env.ENABLE_BACKGROUND_SCRAPING = 'false';

      const config = getScrapingConfigWithEnvOverrides();

      expect(config.maxPuppeteerConcurrent).toBe(10);
      expect(config.maxTotalConcurrent).toBe(500);
      expect(config.maxCacheSize).toBe(3000);
      expect(config.cacheTTL).toBe(120000);
      expect(config.enableBackgroundScraping).toBe(false);
    });

    it('should handle invalid environment variables gracefully', () => {
      process.env.NODE_ENV = 'development';
      process.env.MAX_PUPPETEER_CONCURRENT = 'invalid';
      process.env.MAX_TOTAL_CONCURRENT = '';
      process.env.MAX_CACHE_SIZE = 'not-a-number';

      const config = getScrapingConfigWithEnvOverrides();

      // Should fall back to default/environment-specific values
      expect(config.maxPuppeteerConcurrent).toBe(2); // Development default
      expect(config.maxTotalConcurrent).toBe(300); // Base default
      expect(config.maxCacheSize).toBe(2000); // Base default
    });

    it('should enable background scraping when env var is not "false"', () => {
      process.env.NODE_ENV = 'production';
      process.env.ENABLE_BACKGROUND_SCRAPING = 'true';

      const config = getScrapingConfigWithEnvOverrides();
      expect(config.enableBackgroundScraping).toBe(true);

      process.env.ENABLE_BACKGROUND_SCRAPING = 'anything';
      const config2 = getScrapingConfigWithEnvOverrides();
      expect(config2.enableBackgroundScraping).toBe(true);
    });

    it('should disable background scraping only when env var is exactly "false"', () => {
      process.env.NODE_ENV = 'production';
      process.env.ENABLE_BACKGROUND_SCRAPING = 'false';

      const config = getScrapingConfigWithEnvOverrides();
      expect(config.enableBackgroundScraping).toBe(false);
    });
  });

  describe('config validation', () => {
    it('should have consistent timeout values across environments', () => {
      const configs = ['development', 'production', 'test'].map(env => {
        process.env.NODE_ENV = env;
        return getScrapingConfig();
      });

      configs.forEach(config => {
        expect(config.requestTimeout).toBe(15000); // Should be consistent
        expect(config.requestTimeout).toBeGreaterThan(5000); // Should be reasonable
      });
    });

    it('should have reasonable concurrency limits', () => {
      const config = getScrapingConfig();

      expect(config.maxPuppeteerConcurrent).toBeGreaterThan(0);
      expect(config.maxPuppeteerConcurrent).toBeLessThanOrEqual(config.maxTotalConcurrent);
      expect(config.maxTotalConcurrent).toBeGreaterThan(config.maxPuppeteerConcurrent);
    });

    it('should have reasonable cache and cleanup intervals', () => {
      const config = getScrapingConfig();

      expect(config.cacheTTL).toBeGreaterThan(0);
      expect(config.cleanupInterval).toBeGreaterThan(0);
      expect(config.backgroundScrapingInterval).toBeGreaterThan(0);

      // Cleanup should happen less frequently than background scraping
      expect(config.cleanupInterval).toBeGreaterThanOrEqual(config.backgroundScrapingInterval);
    });

    it('should have reasonable cache sizes', () => {
      const config = getScrapingConfig();

      expect(config.maxCacheSize).toBeGreaterThan(0);
      expect(config.maxUsedQuotes).toBeGreaterThan(0);
      expect(config.maxUsedQuotes).toBeLessThanOrEqual(config.maxCacheSize);
    });
  });

  describe('environment-specific behavior', () => {
    it('should be more conservative in development', () => {
      process.env.NODE_ENV = 'development';
      const devConfig = getScrapingConfig();

      process.env.NODE_ENV = 'production';
      const prodConfig = getScrapingConfig();

      expect(devConfig.maxPuppeteerConcurrent).toBeLessThanOrEqual(prodConfig.maxPuppeteerConcurrent);
      expect(devConfig.backgroundScrapingInterval).toBeGreaterThanOrEqual(prodConfig.backgroundScrapingInterval);
    });

    it('should be most restrictive in test environment', () => {
      process.env.NODE_ENV = 'test';
      const testConfig = getScrapingConfig();

      process.env.NODE_ENV = 'development';
      const devConfig = getScrapingConfig();

      expect(testConfig.maxTotalConcurrent).toBeLessThanOrEqual(devConfig.maxTotalConcurrent);
      expect(testConfig.maxCacheSize).toBeLessThanOrEqual(devConfig.maxCacheSize);
      expect(testConfig.enableBackgroundScraping).toBe(false);
      expect(testConfig.enableMemoryCleanup).toBe(false);
    });
  });
});