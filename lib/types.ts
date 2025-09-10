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

export interface CellState {
  content?: Quote;
  isLoading: boolean;
  loadingMessage?: string;
  error?: string;
}

export interface ApiResponse {
  success: boolean;
  cellId: number;
  quote?: Quote;
  error?: string;
  details?: string;
  method?: string;
  cacheInfo?: {
    puppeteerCache: number;
    simpleCache: number;
    usedQuotes: number;
    queueLength: number;
    activeRequests: number;
  };
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