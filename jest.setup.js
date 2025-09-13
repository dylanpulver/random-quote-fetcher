// jest.setup.js - Updated with NextResponse mock
require('@testing-library/jest-dom');

// Mock browser APIs that don't exist in Node.js test environment
global.TextEncoder = require('util').TextEncoder;
global.TextDecoder = require('util').TextDecoder;

// Mock Request/Response for Next.js API testing
global.Request = class MockRequest {
  constructor(url, init = {}) {
    this.url = url;
    this.method = init.method || 'GET';
    this.headers = new Map(Object.entries(init.headers || {}));
    this.body = init.body;
  }

  async json() {
    return JSON.parse(this.body);
  }
};

global.Response = class MockResponse {
  constructor(body, init = {}) {
    this.body = body;
    this.status = init.status || 200;
    this.headers = new Map(Object.entries(init.headers || {}));
  }

  async json() {
    if (typeof this.body === 'string') {
      return JSON.parse(this.body);
    }
    return this.body;
  }

  static json(data, init = {}) {
    return new MockResponse(JSON.stringify(data), {
      status: init.status || 200,
      headers: {
        'Content-Type': 'application/json',
        ...init.headers
      }
    });
  }
};

// Mock NextResponse specifically
jest.mock('next/server', () => ({
  NextRequest: global.Request,
  NextResponse: {
    json: (data, init = {}) => {
      const response = new global.Response(JSON.stringify(data), {
        status: init.status || 200,
        headers: {
          'Content-Type': 'application/json',
          ...init.headers
        }
      });
      response.json = async () => data;
      return response;
    }
  }
}));

// Mock Next.js Image component
jest.mock('next/image', () => ({
  __esModule: true,
  default: function MockImage(props) {
    const { src, alt, width, height, ...rest } = props;
    return require('react').createElement('img', { src, alt, width, height, ...rest });
  },
}));

// Mock Next.js navigation
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(() => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
  })),
  usePathname: jest.fn(() => '/'),
  useSearchParams: jest.fn(() => new URLSearchParams()),
}));

// Mock fetch for API tests
global.fetch = jest.fn();

// Mock browser APIs
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Mock performance API
Object.defineProperty(window, 'performance', {
  writable: true,
  value: {
    timing: {
      navigationStart: 0,
      loadEventEnd: 1000,
      domainLookupStart: 0,
      domainLookupEnd: 10,
      connectStart: 10,
      connectEnd: 20,
      responseStart: 30,
      responseEnd: 40,
      domLoading: 50,
      domContentLoadedEventEnd: 100,
    },
    now: jest.fn(() => Date.now()),
    getEntriesByType: jest.fn(() => []),
  },
});

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
  // Clean up any fake timers
  if (jest.isMockFunction(setTimeout)) {
    jest.useRealTimers();
  }
});

// COMPLETELY MOCK PUPPETEER - Don't try to actually launch browser in tests
jest.mock('puppeteer-core', () => {
  const mockPage = {
    goto: jest.fn().mockResolvedValue(undefined),
    evaluate: jest.fn().mockResolvedValue([]),
    close: jest.fn().mockResolvedValue(undefined),
    setRequestInterception: jest.fn().mockResolvedValue(undefined),
    on: jest.fn(),
    type: jest.fn().mockResolvedValue(undefined),
    click: jest.fn().mockResolvedValue(undefined),
    waitForNavigation: jest.fn().mockResolvedValue(undefined),
  };

  const mockBrowser = {
    newPage: jest.fn().mockResolvedValue(mockPage),
    close: jest.fn().mockResolvedValue(undefined),
  };

  return {
    launch: jest.fn().mockResolvedValue(mockBrowser),
  };
});

jest.mock('@sparticuz/chromium', () => ({
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
  executablePath: jest.fn().mockResolvedValue('/mock/path/to/chrome'),
}));

// Mock the actual puppeteer package too (since you have both)
jest.mock('puppeteer', () => {
  const mockPage = {
    goto: jest.fn().mockResolvedValue(undefined),
    evaluate: jest.fn().mockResolvedValue([]),
    close: jest.fn().mockResolvedValue(undefined),
    setRequestInterception: jest.fn().mockResolvedValue(undefined),
    on: jest.fn(),
    type: jest.fn().mockResolvedValue(undefined),
    click: jest.fn().mockResolvedValue(undefined),
    waitForNavigation: jest.fn().mockResolvedValue(undefined),
  };

  const mockBrowser = {
    newPage: jest.fn().mockResolvedValue(mockPage),
    close: jest.fn().mockResolvedValue(undefined),
  };

  return {
    default: {
      launch: jest.fn().mockResolvedValue(mockBrowser),
    },
    launch: jest.fn().mockResolvedValue(mockBrowser),
  };
});

// Silence console output in tests (except for actual test failures)
const originalError = console.error;
const originalWarn = console.warn;
const originalLog = console.log;

beforeAll(() => {
  console.error = jest.fn((message) => {
    // Still show actual test errors, but silence expected errors from our code
    if (message && typeof message === 'string' &&
        (message.includes('❌') || message.includes('Warning') || message.includes('act('))) {
      return;
    }
    originalError(message);
  });
  console.warn = jest.fn();
  console.log = jest.fn(); // Silence logs during tests
});

afterAll(() => {
  console.error = originalError;
  console.warn = originalWarn;
  console.log = originalLog;
});