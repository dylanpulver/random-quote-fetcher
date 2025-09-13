/**
 * Configuration for the scraping service
 * Centralized settings for easy tuning and environment-specific overrides
 */

export interface ScrapingConfig {
  // Concurrency limits
  maxPuppeteerConcurrent: number;
  maxTotalConcurrent: number;

  // Cache settings
  maxCacheSize: number;
  maxUsedQuotes: number;
  cacheTTL: number; // milliseconds

  // Cleanup intervals
  cleanupInterval: number; // milliseconds
  backgroundScrapingInterval: number; // milliseconds

  // Scraping settings
  initialCachePages: number;
  maxScrapingPages: number;
  requestTimeout: number; // milliseconds

  // Performance settings
  enableBackgroundScraping: boolean;
  enableMemoryCleanup: boolean;
}

// Default configuration
const DEFAULT_CONFIG: ScrapingConfig = {
  maxPuppeteerConcurrent: 5,
  maxTotalConcurrent: 300,
  maxCacheSize: 2000,
  maxUsedQuotes: 1000,
  cacheTTL: 60 * 60 * 1000, // 1 hour
  cleanupInterval: 10 * 60 * 1000, // 10 minutes
  backgroundScrapingInterval: 60000, // 1 minute
  initialCachePages: 3,
  maxScrapingPages: 10,
  requestTimeout: 15000, // 15 seconds
  enableBackgroundScraping: true,
  enableMemoryCleanup: true,
};

// Environment-specific overrides
const DEVELOPMENT_CONFIG: Partial<ScrapingConfig> = {
  maxPuppeteerConcurrent: 2, // Gentler on dev machines
  backgroundScrapingInterval: 120000, // 2 minutes - less aggressive
  enableBackgroundScraping: false, // Don't run in background during dev
};

const PRODUCTION_CONFIG: Partial<ScrapingConfig> = {
  maxPuppeteerConcurrent: 8, // More aggressive in production
  backgroundScrapingInterval: 30000, // 30 seconds - more aggressive
  cacheTTL: 30 * 60 * 1000, // 30 minutes - shorter TTL in production
};

const TEST_CONFIG: Partial<ScrapingConfig> = {
  maxPuppeteerConcurrent: 1,
  maxTotalConcurrent: 10,
  maxCacheSize: 50,
  maxUsedQuotes: 20,
  cacheTTL: 5 * 60 * 1000, // 5 minutes
  enableBackgroundScraping: false,
  enableMemoryCleanup: false,
};

/**
 * Get configuration based on current environment
 */
export function getScrapingConfig(): ScrapingConfig {
  const baseConfig = { ...DEFAULT_CONFIG };

  switch (process.env.NODE_ENV) {
    case 'development':
      return { ...baseConfig, ...DEVELOPMENT_CONFIG };
    case 'production':
      return { ...baseConfig, ...PRODUCTION_CONFIG };
    case 'test':
      return { ...baseConfig, ...TEST_CONFIG };
    default:
      return baseConfig;
  }
}

/**
 * Override config with environment variables if present
 */
export function getScrapingConfigWithEnvOverrides(): ScrapingConfig {
  const config = getScrapingConfig();

  return {
    ...config,
    maxPuppeteerConcurrent: parseInt(process.env.MAX_PUPPETEER_CONCURRENT || '') || config.maxPuppeteerConcurrent,
    maxTotalConcurrent: parseInt(process.env.MAX_TOTAL_CONCURRENT || '') || config.maxTotalConcurrent,
    maxCacheSize: parseInt(process.env.MAX_CACHE_SIZE || '') || config.maxCacheSize,
    cacheTTL: parseInt(process.env.CACHE_TTL || '') || config.cacheTTL,
    enableBackgroundScraping: process.env.ENABLE_BACKGROUND_SCRAPING === 'false' ? false : config.enableBackgroundScraping,
  };
}