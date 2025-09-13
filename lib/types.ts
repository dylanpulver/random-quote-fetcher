// Core data models
export interface Quote {
  text: string;
  author: string;
  tags: string[];
  sourceUrl?: string; // Available only after login to quotes.toscrape.com
}

// Scraping service types
export interface ScrapingProgress {
  stage: number;
  message: string;
  totalStages: number;
}

export interface CacheInfo {
  puppeteerCache?: number;
  simpleCache?: number;
  usedQuotes: number;
  queueLength: number;
  activeRequests: number;
  cacheSize?: number;
}

export interface HealthStatus {
  initialized: boolean;
  cacheSize: number;
  usedQuotes: number;
  activeRequests: number;
  maxConcurrent: number;
  queueLength: number;
  puppeteerActive: number;
  browserConnected: boolean;
}

// UI component types
export interface CellState {
  content?: Quote;
  isLoading: boolean;
  loadingMessage?: string;
  error?: string;
}

export interface PerformanceMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number; // in milliseconds
  concurrentRequests: number;
  maxConcurrentReached: number;
}

// API types
export interface ApiResponse {
  success: boolean;
  cellId: number;
  quote?: Quote;
  error?: string;
  details?: string;
  method?: string;
  cacheInfo?: CacheInfo;
}

export interface SSEMessage {
  cellId: number;
  stage: number | 'complete' | 'error';
  message?: string;
  quote?: Quote;
  error?: string;
  totalStages?: number;
  timestamp: number;
}

// Error handling types
export type ScrapingError = 'NETWORK_ERROR' | 'BROWSER_ERROR' | 'PARSING_ERROR' | 'TIMEOUT_ERROR' | 'UNKNOWN_ERROR';

export interface ScrapingErrorDetails {
  type: ScrapingError;
  message: string;
  cellId?: number;
  timestamp: number;
}