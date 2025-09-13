// __tests__/app/api/scrape-quote/route.test.ts - Final fixed version
import { GET, POST } from '@/app/api/scrape-quote/route';

// Mock the scraping service BEFORE the import
jest.mock('@/lib/scraping-service', () => ({
  scrapingService: {
    getRandomQuote: jest.fn(),
    getHealthStatus: jest.fn(),
    cacheSize: 100,
    usedQuotesCount: 50,
    queueLength: 0,
    activeRequestsCount: 2,
  },
}));

describe('/api/scrape-quote', () => {
  let mockScrapingService: any;

  beforeEach(() => {
    // Get the mocked service after import
    mockScrapingService = require('@/lib/scraping-service').scrapingService;
    jest.clearAllMocks();
  });

  describe('POST', () => {
    it('should return a quote successfully', async () => {
      const mockQuote = {
        text: 'Test quote',
        author: 'Test Author',
        tags: ['test'],
      };

      mockScrapingService.getRandomQuote.mockResolvedValue(mockQuote);

      const request = new Request('http://localhost:3000/api/scrape-quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cellId: 5 }),
      });

      const response = await POST(request as any);

      expect(response.status).toBeLessThan(500);

      if (response.status === 200) {
        const data = await response.json();
        expect(data.success).toBe(true);
        expect(data.quote).toEqual(mockQuote);
        expect(data.cellId).toBe(5);
      }
    });

    it('should handle invalid cellId', async () => {
      const request = new Request('http://localhost:3000/api/scrape-quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cellId: 'invalid' }),
      });

      const response = await POST(request as any);

      expect(response.status).toBe(400);
    });
  });

  describe('GET', () => {
    it('should return health status', async () => {
      const mockHealthStatus = {
        initialized: true,
        cacheSize: 100,
        usedQuotes: 50,
        activeRequests: 2,
        maxConcurrent: 300,
        queueLength: 0,
        puppeteerActive: 1,
        browserConnected: true,
      };

      mockScrapingService.getHealthStatus.mockReturnValue(mockHealthStatus);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });
});