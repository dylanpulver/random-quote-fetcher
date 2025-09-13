#!/bin/bash
# scripts/test.sh - Test runner script

set -e

echo "🧪 Running Random Quote Fetcher Test Suite"
echo "============================================"

# Check if dependencies are installed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Run different test suites based on argument
case "${1:-all}" in
    "unit")
        echo "🔬 Running unit tests..."
        npm run test -- --testPathPattern="(lib|hooks|components)" --verbose
        ;;
    "integration")
        echo "🔗 Running integration tests..."
        npm run test -- --testPathPattern="integration" --verbose --runInBand
        ;;
    "api")
        echo "🌐 Running API tests..."
        npm run test -- --testPathPattern="api" --verbose
        ;;
    "coverage")
        echo "📊 Running tests with coverage..."
        npm run test:coverage
        ;;
    "watch")
        echo "👀 Running tests in watch mode..."
        npm run test:watch
        ;;
    "ci")
        echo "🚀 Running CI test suite..."
        npm run test:ci
        ;;
    "all"|*)
        echo "🧪 Running all tests..."
        npm run test:ci

        echo ""
        echo "📈 Generating coverage report..."
        npm run test:coverage

        echo ""
        echo "✅ All tests completed!"
        ;;
esac

echo ""
echo "🎉 Test execution finished!"

