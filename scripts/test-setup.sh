# scripts/test-setup.sh - One-time test environment setup
#!/bin/bash

echo "🔧 Setting up test environment for Random Quote Fetcher"
echo "======================================================="

# Install test dependencies
echo "📦 Installing test dependencies..."
npm install --save-dev @testing-library/react @testing-library/jest-dom @testing-library/user-event
npm install --save-dev jest jest-environment-jsdom @types/jest ts-jest jest-mock
npm install --save-dev msw @jest/globals

# Create test directories
echo "📁 Creating test directory structure..."
mkdir -p __tests__/{lib/{services,config},hooks,components,app/api,integration}

# Create test configuration files
echo "⚙️  Creating Jest configuration..."

# Generate jest.config.js
cat > jest.config.js << 'EOF'
const nextJest = require('next/jest')

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files
  dir: './',
})

// Add any custom config to be passed to Jest
const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  moduleNameMapping: {
    // Handle module aliases (this will be automatically configured for you based on your tsconfig.json paths)
    '^@/(.*)$': '<rootDir>/$1',
  },
  testEnvironment: 'jest-environment-jsdom',
  collectCoverageFrom: [
    'lib/**/*.{ts,tsx}',
    'hooks/**/*.{ts,tsx}',
    'components/**/*.{ts,tsx}',
    'app/api/**/*.{ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**',
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  testMatch: [
    '**/__tests__/**/*.(ts|tsx|js)',
    '**/*.(test|spec).(ts|tsx|js)',
  ],
  testPathIgnorePatterns: [
    '<rootDir>/.next/',
    '<rootDir>/node_modules/',
  ],
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': ['babel-jest', { presets: ['next/babel'] }],
  },
  transformIgnorePatterns: [
    '/node_modules/',
    '^.+\\.module\\.(css|sass|scss)$',
  ],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
}

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
module.exports = createJestConfig(customJestConfig)
EOF

echo "📄 Creating additional test files..."

# Create GitHub Actions workflow for testing
mkdir -p .github/workflows
cat > .github/workflows/test.yml << 'EOF'
name: Tests

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main, develop ]

jobs:
  test:
    runs-on: ubuntu-latest

    strategy:
      matrix:
        node-version: [18.x, 20.x]

    steps:
    - name: Checkout code
      uses: actions/checkout@v4

    - name: Use Node.js ${{ matrix.node-version }}
      uses: actions/setup-node@v4
      with:
        node-version: ${{ matrix.node-version }}
        cache: 'npm'

    - name: Install dependencies
      run: npm ci

    - name: Run linter
      run: npm run lint

    - name: Run type check
      run: npm run build --dry-run || npx tsc --noEmit

    - name: Run unit tests
      run: npm run test:ci

    - name: Upload coverage to Codecov
      uses: codecov/codecov-action@v3
      with:
        file: ./coverage/lcov.info
        fail_ci_if_error: false
EOF

# Create test utilities
cat > __tests__/utils/test-utils.tsx << 'EOF'
import React, { ReactElement } from 'react'
import { render, RenderOptions } from '@testing-library/react'

// Add any providers here (Theme, Router, etc.)
const AllTheProviders = ({ children }: { children: React.ReactNode }) => {
  return <>{children}</>
}

const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>,
) => render(ui, { wrapper: AllTheProviders, ...options })

export * from '@testing-library/react'
export { customRender as render }

// Test utilities
export const createMockQuote = (overrides = {}) => ({
  text: 'Default test quote',
  author: 'Test Author',
  tags: ['test'],
  ...overrides,
})

export const createMockConfig = (overrides = {}) => ({
  maxPuppeteerConcurrent: 2,
  maxTotalConcurrent: 10,
  maxCacheSize: 50,
  maxUsedQuotes: 25,
  cacheTTL: 60000,
  cleanupInterval: 10000,
  backgroundScrapingInterval: 30000,
  initialCachePages: 2,
  maxScrapingPages: 5,
  requestTimeout: 15000,
  enableBackgroundScraping: false,
  enableMemoryCleanup: false,
  ...overrides,
})

export const waitForAsyncOperations = () =>
  new Promise(resolve => setTimeout(resolve, 0))

export const mockFetch = (response: any, ok = true) => {
  global.fetch = jest.fn(() =>
    Promise.resolve({
      ok,
      json: () => Promise.resolve(response),
      text: () => Promise.resolve(JSON.stringify(response)),
    })
  ) as jest.Mock
}

export const mockSSEResponse = (messages: any[]) => {
  const mockReader = {
    read: jest.fn(),
  }

  let callCount = 0
  mockReader.read.mockImplementation(() => {
    if (callCount < messages.length) {
      const message = messages[callCount]
      callCount++
      return Promise.resolve({
        done: false,
        value: new TextEncoder().encode(`data: ${JSON.stringify(message)}\n\n`),
      })
    }
    return Promise.resolve({ done: true })
  })

  global.fetch = jest.fn(() =>
    Promise.resolve({
      ok: true,
      body: { getReader: () => mockReader },
      headers: { get: (name: string) =>
        name === 'Content-Type' ? 'text/event-stream' : null
      },
    })
  ) as jest.Mock
}
EOF

# Create performance test utilities
cat > __tests__/utils/performance-utils.ts << 'EOF'
/**
 * Performance testing utilities
 */

export class PerformanceTimer {
  private startTime: number
  private endTime?: number

  constructor() {
    this.startTime = performance.now()
  }

  stop(): number {
    this.endTime = performance.now()
    return this.getDuration()
  }

  getDuration(): number {
    const end = this.endTime || performance.now()
    return end - this.startTime
  }
}

export const measureAsync = async <T>(
  fn: () => Promise<T>
): Promise<{ result: T; duration: number }> => {
  const timer = new PerformanceTimer()
  const result = await fn()
  const duration = timer.stop()
  return { result, duration }
}

export const expectPerformance = (
  duration: number,
  maxExpected: number,
  operation?: string
) => {
  if (duration > maxExpected) {
    const message = operation
      ? `${operation} took ${duration}ms, expected under ${maxExpected}ms`
      : `Operation took ${duration}ms, expected under ${maxExpected}ms`
    console.warn(`⚠️  Performance warning: ${message}`)
  }
  return duration <= maxExpected
}

export const runConcurrentTest = async <T>(
  fn: () => Promise<T>,
  concurrency: number,
  description?: string
): Promise<{
  results: Array<{ status: 'fulfilled' | 'rejected'; value?: T; reason?: any }>
  duration: number
  successRate: number
}> => {
  const timer = new PerformanceTimer()

  const promises = Array.from({ length: concurrency }, () => fn())
  const settled = await Promise.allSettled(promises)

  const duration = timer.stop()
  const successful = settled.filter(r => r.status === 'fulfilled').length
  const successRate = successful / concurrency

  if (description) {
    console.log(`📊 ${description}: ${successful}/${concurrency} successful (${(successRate * 100).toFixed(1)}%) in ${duration.toFixed(2)}ms`)
  }

  return {
    results: settled,
    duration,
    successRate,
  }
}
EOF

echo ""
echo "✅ Test environment setup completed!"
echo ""
echo "📋 Next steps:"
echo "  1. Run 'npm test' to execute all tests"
echo "  2. Run 'npm run test:watch' for development"
echo "  3. Run 'npm run test:coverage' for coverage reports"
echo "  4. Add your custom test cases to the __tests__ directory"
echo ""
echo "🧪 Happy testing!"

# Makefile for common test operations
cat > Makefile << 'EOF'
.PHONY: test test-unit test-integration test-api test-coverage test-watch setup-tests

# Default test command
test:
	npm run test:ci

# Run only unit tests
test-unit:
	npm test -- --testPathPattern="(lib|hooks|components)" --verbose

# Run only integration tests
test-integration:
	npm test -- --testPathPattern="integration" --verbose --runInBand

# Run only API tests
test-api:
	npm test -- --testPathPattern="api" --verbose

# Run tests with coverage
test-coverage:
	npm run test:coverage

# Run tests in watch mode (for development)
test-watch:
	npm run test:watch

# Setup test environment
setup-tests:
	./scripts/test-setup.sh

# Clean test cache
clean-test:
	npm test -- --clearCache
	rm -rf coverage/

# Run tests for CI/CD
test-ci:
	npm run test:ci
EOF

echo "📝 Created Makefile for easy test management"
echo "   Use 'make test-unit', 'make test-coverage', etc."