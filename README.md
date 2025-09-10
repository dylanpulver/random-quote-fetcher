# Random Quote Fetcher

A high-performance, keyboard-driven quote scraping application that demonstrates real-time web scraping, complex state management, and concurrent request handling.

## 🚀 Features

- **Real-time Web Scraping**: Scrapes quotes from quotes.toscrape.com using Puppeteer
- **Keyboard-Centric Navigation**: Full keyboard control with complex multi-selection
- **Concurrent Request Handling**: Manages up to 300 simultaneous quote fetches
- **Real-time Updates**: Server-Sent Events for live loading progress
- **Responsive Design**: Works seamlessly on mobile and desktop
- **Smart Caching**: Avoids duplicate quotes and optimizes performance

## 🎯 Architecture

### Frontend
- **Next.js 15** with TypeScript
- **Tailwind CSS** for responsive styling
- **Real-time SSE** for loading state updates
- **Complex state management** for 300-cell grid

### Backend
- **Puppeteer** for headless browser automation
- **Request queuing** with configurable concurrency limits
- **Connection pooling** for optimal resource usage
- **Error recovery** and graceful degradation

### Key Design Decisions

1. **Request Queue with Concurrency Limiting**: Prevents overwhelming the target site
2. **Single Browser Instance with Page Pool**: Optimizes resource usage
3. **Smart Caching with Uniqueness Tracking**: Ensures unique quotes per session
4. **Server-Sent Events**: Real-time updates without WebSocket complexity
5. **Responsive Grid Layout**: Adapts from 3 columns to single column on mobile

## 🛠️ Setup

### Prerequisites
- Node.js 18+
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd random-quote-fetcher
```

2. Install dependencies:
```bash
npm install
```

3. Run development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000)

## 🎮 Usage

### Keyboard Controls

| Key Combination | Action |
|----------------|--------|
| `↑ ↓ ← →` | Navigate/focus cells |
| `X` | Select/deselect focused cell |
| `Shift + Arrow Keys` | Multi-select cells in path |
| `Space` | Fetch quote for focused or selected empty cells |
| `Esc` | Clear all selected cells |
| `Ctrl+A / Cmd+A` | Select all cells |

### User Flows

1. **Single Quote**: Navigate to empty cell, press Space
2. **Bulk Fetch**: Select multiple cells with X or Shift+Arrow, press Space
3. **View Details**: Navigate to filled cell to see full quote, author, and tags

## 🏗️ Deployment

### Vercel (Recommended)

1. Connect repository to Vercel
2. Set build command: `npm run build`
3. Deploy automatically on push

### Manual Deployment

1. Build the application:
```bash
npm run build
```

2. Start production server:
```bash
npm start
```

## 📊 Performance Characteristics

### Concurrent Request Handling
- **Queue-based processing**: Max 5 concurrent scraping operations
- **Page pooling**: 3 browser pages for optimal resource usage
- **Smart caching**: Reduces redundant scraping operations
- **Memory management**: Efficient cleanup and resource management

### Scalability Analysis

| Scale | Strategy | Considerations |
|-------|----------|----------------|
| **1K quotes** | Current architecture | Memory-based caching sufficient |
| **10K quotes** | Add Redis caching | Distributed cache for multiple instances |
| **100K quotes** | Database + indexing | PostgreSQL with full-text search |
| **1M+ quotes** | Microservices | Separate scraping service, message queues |

### Known Limitations

1. **Memory Usage**: Current in-memory caching limited by available RAM
2. **Single Instance**: No horizontal scaling without external cache
3. **Rate Limiting**: Dependent on target site's rate limiting policies
4. **Browser Resources**: Puppeteer instances consume significant memory

### Potential Solutions

1. **Redis Integration**: Distributed caching for multi-instance deployments
2. **Database Layer**: PostgreSQL for persistent quote storage
3. **Message Queues**: Bull/BullMQ for distributed job processing
4. **CDN Integration**: Cache static quote data at edge locations

## 🔧 System Failures & Edge Cases

### Identified Failure Modes

1. **Network Failures**: Target site unreachable
   - **Solution**: Exponential backoff, fallback quotes
2. **Rate Limiting**: Too many requests blocked
   - **Solution**: Dynamic throttling, request spacing
3. **Memory Exhaustion**: Large cache or too many concurrent operations
   - **Solution**: LRU cache eviction, connection limits
4. **Browser Crashes**: Puppeteer instance failure
   - **Solution**: Auto-restart, circuit breaker pattern

### Error Recovery

- **Graceful degradation**: Show cached quotes if scraping fails
- **User feedback**: Clear error messages with retry options
- **Circuit breaker**: Temporarily disable scraping if consistent failures
- **Fallback data**: Static quote set for extreme failure scenarios

## 🔍 Monitoring & Debugging

### Available Endpoints

- `GET /api/scrape-quote` - Service status and cache info
- `POST /api/scrape-quote` - Single quote fetch
- `POST /api/scrape-status` - SSE endpoint for real-time updates

### Cache Metrics

The scraping service exposes real-time metrics:
- Cache size
- Used quotes count
- Queue length
- Active requests count

## 🧰 Development Tools Used

### AI-Assisted Development
- **Claude Sonnet 4**: Architecture design and code generation
- **Strategy**: Used for rapid prototyping and debugging complex state logic
- **Effectiveness**: Significantly accelerated development, especially for error handling

### Technology Choices

- **Next.js**: Chosen for integrated API routes and deployment simplicity
- **Puppeteer**: Required for login-protected scraping
- **TypeScript**: Ensures type safety in complex state management
- **Tailwind**: Rapid responsive design iteration

## 📈 Future Improvements

1. **Performance Monitoring**: Add APM tools (DataDog, New Relic)
2. **Database Integration**: PostgreSQL for persistent storage
3. **Load Testing**: Comprehensive stress testing with Artillery/k6
4. **Mobile UX**: Dedicated mobile interface optimizations
5. **Quote Categories**: Filter and search functionality
6. **User Preferences**: Persistent settings and favorites

## 🤝 Contributing

This is a prototype project for demonstration purposes. For production use, consider the scalability improvements and monitoring additions outlined above.

## 📄 License

MIT License - see LICENSE file for details.