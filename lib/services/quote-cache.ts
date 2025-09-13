import { ScrapingConfig } from '@/lib/config/scraping-config';
import { Quote } from '@/lib/types';

export interface CacheEntry {
  quote: Quote;
  timestamp: number;
  accessCount: number;
  lastAccessed: number;
}

export interface CacheStats {
  totalEntries: number;
  usedQuotes: number;
  hitRate: number;
  oldestEntry: number;
  newestEntry: number;
}

/**
 * LRU Cache service for managing quote storage and retrieval
 * Handles TTL expiration, usage tracking, and memory management
 */
export class QuoteCacheService {
  private cache: Map<string, CacheEntry> = new Map();
  private usedQuotes: Set<string> = new Set();
  private cacheHits = 0;
  private cacheMisses = 0;
  private config: ScrapingConfig;

  constructor(config: ScrapingConfig) {
    this.config = config;
  }

  /**
   * Add a quote to the cache
   */
  addQuote(quote: Quote): boolean {
    if (this.cache.has(quote.text)) {
      return false; // Already exists
    }

    const entry: CacheEntry = {
      quote,
      timestamp: Date.now(),
      accessCount: 0,
      lastAccessed: Date.now()
    };

    this.cache.set(quote.text, entry);

    // Perform cleanup if cache is getting too large
    if (this.cache.size > this.config.maxCacheSize) {
      this.performLRUEviction();
    }

    return true;
  }

  /**
   * Get a random unused quote from cache
   */
  getRandomUnusedQuote(): Quote | null {
    const availableEntries = Array.from(this.cache.entries())
      .filter(([text]) => !this.usedQuotes.has(text))
      .map(([text, entry]) => ({ text, entry }));

    if (availableEntries.length === 0) {
      this.cacheMisses++;
      return null;
    }

    // Get random quote
    const randomIndex = Math.floor(Math.random() * availableEntries.length);
    const { text, entry } = availableEntries[randomIndex];

    // Update access statistics
    entry.lastAccessed = Date.now();
    entry.accessCount++;
    this.cacheHits++;

    // Mark as used
    this.usedQuotes.add(text);

    return entry.quote;
  }

  /**
   * Get all unused quotes (for fallback scenarios)
   */
  getAllUnusedQuotes(): Quote[] {
    return Array.from(this.cache.entries())
      .filter(([text]) => !this.usedQuotes.has(text))
      .map(([, entry]) => {
        entry.lastAccessed = Date.now();
        entry.accessCount++;
        return entry.quote;
      });
  }

  /**
   * Reset used quotes (when all quotes have been used)
   */
  resetUsedQuotes(): void {
    console.log(`🔄 Resetting used quotes set (was ${this.usedQuotes.size} quotes)`);
    this.usedQuotes.clear();
  }

  /**
   * Clean expired entries based on TTL
   */
  cleanExpiredEntries(): number {
    const now = Date.now();
    const expiredKeys: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.config.cacheTTL) {
        expiredKeys.push(key);
      }
    }

    // Remove expired entries
    expiredKeys.forEach(key => {
      this.cache.delete(key);
      this.usedQuotes.delete(key);
    });

    return expiredKeys.length;
  }

  /**
   * Perform LRU eviction when cache is too large
   */
  private performLRUEviction(): void {
    const entries = Array.from(this.cache.entries())
      .sort(([,a], [,b]) => a.lastAccessed - b.lastAccessed);

    const toRemove = entries.slice(0, entries.length - this.config.maxCacheSize);

    toRemove.forEach(([key]) => {
      this.cache.delete(key);
      this.usedQuotes.delete(key);
    });

    if (toRemove.length > 0) {
      console.log(`🧹 LRU eviction: Removed ${toRemove.length} least recently used quotes`);
    }
  }

  /**
   * Clean up used quotes if set gets too large
   */
  cleanupUsedQuotes(): void {
    if (this.usedQuotes.size > this.config.maxUsedQuotes) {
      // Keep the most recent half
      const usedArray = Array.from(this.usedQuotes);
      this.usedQuotes.clear();

      usedArray.slice(-Math.floor(this.config.maxUsedQuotes / 2))
        .forEach(quote => this.usedQuotes.add(quote));

      console.log(`🧹 Used quotes cleanup: Reduced from ${usedArray.length} to ${this.usedQuotes.size}`);
    }
  }

  /**
   * Perform comprehensive memory cleanup
   */
  performMemoryCleanup(): { expired: number; evicted: number } {
    const expiredCount = this.cleanExpiredEntries();

    // Perform LRU eviction if still too large
    const sizeBeforeLRU = this.cache.size;
    this.performLRUEviction();
    const evictedCount = sizeBeforeLRU - this.cache.size;

    // Clean up used quotes
    this.cleanupUsedQuotes();

    return { expired: expiredCount, evicted: evictedCount };
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const entries = Array.from(this.cache.values());
    const timestamps = entries.map(e => e.timestamp);

    return {
      totalEntries: this.cache.size,
      usedQuotes: this.usedQuotes.size,
      hitRate: this.cacheHits + this.cacheMisses > 0
        ? this.cacheHits / (this.cacheHits + this.cacheMisses)
        : 0,
      oldestEntry: timestamps.length > 0 ? Math.min(...timestamps) : 0,
      newestEntry: timestamps.length > 0 ? Math.max(...timestamps) : 0
    };
  }

  /**
   * Clear all cache data
   */
  clear(): void {
    this.cache.clear();
    this.usedQuotes.clear();
    this.cacheHits = 0;
    this.cacheMisses = 0;
  }

  /**
   * Get cache size
   */
  get size(): number {
    return this.cache.size;
  }

  /**
   * Get used quotes count
   */
  get usedCount(): number {
    return this.usedQuotes.size;
  }

  /**
   * Mark a quote as used
   */
  markQuoteAsUsed(quoteText: string): void {
    this.usedQuotes.add(quoteText);
  }

  /**
   * Check if cache is empty
   */
  get isEmpty(): boolean {
    return this.cache.size === 0;
  }

  /**
   * Check if all quotes have been used
   */
  get allQuotesUsed(): boolean {
    return this.usedQuotes.size >= this.cache.size && this.cache.size > 0;
  }
}