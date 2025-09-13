# Random Quote Fetcher

A high-performance web application for fetching random quotes with real-time scraping from quotes.toscrape.com. Built to handle concurrent operations with intelligent caching and keyboard-driven navigation.

**🚀 Live Demo:** [randomquotefetcher.com](https://www.randomquotefetcher.com/)

## Features

- **Interactive Grid Interface**: 300-cell grid (100×3) with keyboard navigation
- **Real-time Web Scraping**: Live data from quotes.toscrape.com using Puppeteer
- **Concurrent Operations**: Handles multiple simultaneous fetch requests
- **Intelligent Caching**: LRU cache with TTL and memory management
- **Responsive Design**: Works on mobile and desktop
- **Production Ready**: Error boundaries, fallback systems, performance monitoring

## Architecture Overview

### Frontend
- **Next.js 15** with React 19
- **TypeScript** for type safety
- **Tailwind CSS** for styling
- **Custom hook architecture** for state management

### Backend
- **Puppeteer-core** for web scraping
- **@sparticuz/chromium** for serverless compatibility (Vercel)
- **Server-Sent Events (SSE)** for real-time progress updates
- **Dual scraping strategy** (Puppeteer + fallback)

### Data Model

```typescript
interface Quote {
  text: string;
  author: string;
  tags: string[];
  sourceUrl?: string; // Available after login to quotes.toscrape.com
}

interface CacheEntry {
  quote: Quote;
  timestamp: number;
  accessCount: number;
  lastAccessed: number;
}
```

**Relationships:**
- Quotes contain embedded author and tags (denormalized for performance)
- Authors and tags stored as strings (simple but functional)
- Source URLs available only after authenticated scraping

## Performance Engineering

### Current Capabilities
- **Concurrent Requests**: Configured for production load balancing
- **Memory Management**: LRU eviction, TTL expiration, used quote tracking
- **DOM Efficiency**: React's virtual DOM handles 300 cells without issues
- **Response Times**: ~2 seconds for bulk operations

### Implementation Details

**Request Queuing & Throttling:**
```typescript
// lib/scraping-service.ts
private async processQueue(): Promise<void> {
  while (this.activeRequests < this.config.maxTotalConcurrent &&
         this.SCRAPING_QUEUE.length > 0) {
    // Process tasks concurrently
  }
}
```

**Caching Strategy:**
```typescript
// lib/services/quote-cache.ts
performLRUEviction(): void {
  const entries = Array.from(this.cache.entries())
    .sort(([,a], [,b]) => a.lastAccessed - b.lastAccessed);
  // Remove least recently used entries
}
```

**Error Recovery:**
- SSE with fallback to direct API calls
- Browser instance recovery
- Request timeout handling
- Component-level error boundaries

## Scaling Discussion

### Current Scale (Production Ready)
- **100 quotes**: Immediate response from cache
- **1K quotes**: Cache + background scraping
- **10K quotes**: Current architecture with optimizations

### Proposed Scaling Strategy

**10K - 100K Quotes:**
1. **Database Layer**: PostgreSQL with indexed author/tag tables
2. **Pre-population Strategy**: Batch scraping with scheduled updates
3. **CDN Caching**: Static quote data with API for fresh content
4. **Horizontal Scaling**: Multiple scraping instances

**100K - 1M+ Quotes:**
1. **Microservices Architecture**: Separate scraping, caching, and API services
2. **Queue System**: Redis/RabbitMQ for distributed job processing
3. **Database Sharding**: Partition by author, category, or hash
4. **Rate Limiting**: Respect source website limits with intelligent delays

**Data Model Evolution:**
```sql
-- Normalized schema for scale
quotes(id, text, author_id, created_at, source_url)
authors(id, name, bio, birth_year)
tags(id, name, category)
quote_tags(quote_id, tag_id)
```

## System Limitations & Solutions

### Current Limitations

**1. Browser Resource Management**
- *Issue*: Puppeteer instances can accumulate memory
- *Solution*: Implemented cleanup timers and resource monitoring
- *Code*: `lib/services/puppeteer-scraper.ts`

**2. Source Website Rate Limits**
- *Issue*: quotes.toscrape.com may throttle high-frequency requests
- *Solution*: Intelligent caching and request spacing
- *Future*: Distributed scraping with IP rotation

**3. Memory Growth with Extended Usage**
- *Issue*: Cache and used quotes tracking grows indefinitely
- *Solution*: LRU eviction and periodic cleanup
- *Code*: `lib/services/quote-cache.ts`

**4. Serverless Cold Starts**
- *Issue*: Vercel functions need browser initialization
- *Solution*: Keep-alive strategies and optimized Chromium loading
- *Code*: `lib/services/puppeteer-scraper.ts`

### Error Scenarios Handled

**Network Failures:**
```typescript
// Fallback from SSE to direct API
try {
  await startScrapingWithSSE(cellIndex);
} catch (error) {
  await startScrapingFallback(cellIndex);
}
```

**Browser Crashes:**
```typescript
// Browser recovery and reinitialization
if (!this.browser || !this.isInitialized) {
  await this.initialize();
}
```

**Memory Pressure:**
```typescript
// Automatic cleanup on intervals
setInterval(() => {
  const { expired, evicted } = this.cache.performMemoryCleanup();
}, this.config.cleanupInterval);
```

## Technical Implementation

### Deployment Challenges Solved

**Vercel Serverless Compatibility:**
- Dynamic imports for Puppeteer vs Puppeteer-core
- @sparticuz/chromium for serverless Chrome
- Environment-specific configuration

```typescript
// lib/services/puppeteer-scraper.ts
const isVercel = process.env.VERCEL === '1';
if (isVercel || (process.env.NODE_ENV === 'production' && isLinux)) {
  const puppeteerCore = await import('puppeteer-core');
  const chromium = await import('@sparticuz/chromium');
  // Use optimized serverless browser
} else {
  const puppeteerRegular = await import('puppeteer');
  // Use full Puppeteer for development
}
```

### Frontend Excellence

**Complex Keyboard Navigation:**
- Arrow key movement with boundary awareness
- Multi-selection with Shift+Arrow
- Bulk operations with Space key
- Complete keyboard accessibility

**State Management at Scale:**
- Custom hook architecture (`useQuoteGrid`)
- Efficient re-renders with React.memo patterns
- Performance metrics tracking

**Responsive Design:**
- CSS Grid with adaptive columns
- Mobile-optimized touch targets
- Progressive enhancement for keyboard controls

## Development & Testing

### Local Development
```bash
npm install
npm run dev
# Visit http://localhost:3000
```

### Production Build
```bash
npm run build
npm start
```

### Testing Framework
- Jest with React Testing Library
- Puppeteer mocking for CI/CD
- Performance monitoring in development

## Production Readiness

### Error Boundaries
- Component-level error recovery
- API error handling
- Graceful degradation patterns

### Loading States
- 5-stage loading animation
- Real-time progress via SSE
- Visual feedback for all operations

### Edge Case Handling
- Duplicate request prevention
- Resource cleanup on unmount
- Graceful shutdown handlers

## Monitoring & Observability

### Performance Metrics
- Request success rates
- Concurrent operation tracking
- Average response times
- Cache hit rates

### Health Checks
- Browser connectivity status
- Cache size monitoring
- Active request tracking
- Memory usage patterns

---

**Built for Legix Engineering Assessment**
*Demonstrating full-stack development, performance optimization, and production readiness*