import { Quote } from './types';

class SimpleScrapingService {
  private quotesCache: Quote[] = [];
  private usedQuotes: Set<string> = new Set();
  private isInitialized = false;

  async initialize() {
    if (this.isInitialized) return;

    try {
      // Scrape quotes using simple HTTP requests
      await this.scrapeAllPages();
      this.isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize simple scraping service:', error);
      // Use fallback quotes if scraping fails
      this.quotesCache = this.getFallbackQuotes();
      this.isInitialized = true;
    }
  }

  private async scrapeAllPages() {
    const allQuotes: Quote[] = [];

    // Try to scrape pages 1-10
    for (let page = 1; page <= 10; page++) {
      try {
        const url = page === 1 ? 'https://quotes.toscrape.com/' : `https://quotes.toscrape.com/page/${page}/`;
        const response = await fetch(url);

        if (!response.ok) {
          console.warn(`Failed to fetch page ${page}: ${response.status}`);
          continue;
        }

        const html = await response.text();
        const quotes = this.parseQuotesFromHTML(html);
        allQuotes.push(...quotes);

        // Add delay to be respectful
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.warn(`Error scraping page ${page}:`, error);
      }
    }

    this.quotesCache = allQuotes;
  }

  private parseQuotesFromHTML(html: string): Quote[] {
    const quotes: Quote[] = [];

    // Simple regex-based parsing (not ideal but works for this site)
    const quotePattern = /<div class="quote"[\s\S]*?<\/div>/g;
    const matches = html.match(quotePattern);

    if (!matches) {
      return quotes;
    }

    matches.forEach((match: string) => {
      try {
        // Extract text
        const textMatch = match.match(/<span class="text"[^>]*>"([^"]*)"<\/span>/);
        const text = textMatch ? textMatch[1].replace(/&#39;/g, "'").replace(/&quot;/g, '"') : '';

        // Extract author
        const authorMatch = match.match(/<small class="author"[^>]*>([^<]*)<\/small>/);
        const author = authorMatch ? authorMatch[1].trim() : '';

        // Extract tags
        const tagMatches = match.match(/<a class="tag"[^>]*>([^<]*)<\/a>/g);
        const tags = (tagMatches || []).map((tagMatch: string) => {
          const tagTextMatch = tagMatch.match(/>([^<]*)</);
          return tagTextMatch ? tagTextMatch[1].trim() : '';
        }).filter((tag: string) => tag);

        if (text && author) {
          quotes.push({ text, author, tags });
        }
      } catch (error) {
        console.warn('Error parsing individual quote:', error);
      }
    });

    return quotes;
  }

  private getFallbackQuotes(): Quote[] {
    return [
      {
        text: "The world as we have created it is a process of our thinking. It cannot be changed without changing our thinking.",
        author: "Albert Einstein",
        tags: ["change", "deep-thoughts", "thinking", "world"]
      },
      {
        text: "It is our choices, Harry, that show what we truly are, far more than our abilities.",
        author: "J.K. Rowling",
        tags: ["abilities", "choices"]
      },
      {
        text: "There are only two ways to live your life. One is as though nothing is a miracle. The other is as though everything is a miracle.",
        author: "Albert Einstein",
        tags: ["inspirational", "life", "live", "miracle", "miracles"]
      },
      {
        text: "The person, be it gentleman or lady, who has not pleasure in a good novel, must be intolerably stupid.",
        author: "Jane Austen",
        tags: ["aliteracy", "books", "classic", "humor"]
      },
      {
        text: "Imperfection is beauty, madness is genius and it's better to be absolutely ridiculous than absolutely boring.",
        author: "Marilyn Monroe",
        tags: ["be-yourself", "inspirational"]
      },
      {
        text: "Try not to become a man of success. Rather become a man of value.",
        author: "Albert Einstein",
        tags: ["adulthood", "success", "value"]
      },
      {
        text: "It is better to be hated for what you are than to be loved for what you are not.",
        author: "André Gide",
        tags: ["life", "love"]
      },
      {
        text: "I have not failed. I've just found 10,000 ways that won't work.",
        author: "Thomas A. Edison",
        tags: ["edison", "failure", "inspirational", "paraphrased"]
      },
      {
        text: "A woman is like a tea bag; you never know how strong it is until it's in hot water.",
        author: "Eleanor Roosevelt",
        tags: ["misattributed-eleanor-roosevelt"]
      },
      {
        text: "A day without sunshine is like, you know, night.",
        author: "Steve Martin",
        tags: ["humor", "obvious", "simile"]
      }
    ];
  }

  async getRandomQuote(): Promise<Quote> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    // Get available quotes (not yet used)
    const availableQuotes = this.quotesCache.filter(q => !this.usedQuotes.has(q.text));

    if (availableQuotes.length === 0) {
      // Reset if all quotes have been used
      this.usedQuotes.clear();
      const randomQuote = this.quotesCache[Math.floor(Math.random() * this.quotesCache.length)];
      this.usedQuotes.add(randomQuote.text);
      return randomQuote;
    }

    const randomQuote = availableQuotes[Math.floor(Math.random() * availableQuotes.length)];
    this.usedQuotes.add(randomQuote.text);
    return randomQuote;
  }

  get cacheSize() { return this.quotesCache.length; }
  get usedQuotesCount() { return this.usedQuotes.size; }
}

export const simpleScrapingService = new SimpleScrapingService();