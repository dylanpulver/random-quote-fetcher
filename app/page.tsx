"use client"

import Image from "next/image";
import { APIErrorBoundary, ErrorBoundary, GridErrorBoundary } from "../components/ErrorBoundary";
import { QuoteGridCells } from "../components/QuoteGridCells";
import { useQuoteGrid } from "../hooks/useQuoteGrid";

export default function Home() {
  // All state and logic is handled by the custom hook
  const {
    focusedCell,
    selectedCells,
    cellContent,
    loadingCells,
    loadingMessages,
    error,
    performanceMetrics,
    columns,
    handleCellClick,
    getSuccessRateClass,
    truncateQuote,
    setError,
  } = useQuoteGrid();

  return (
    <ErrorBoundary>
      <main className="min-h-screen p-4 sm:p-6 lg:p-8 bg-slate-50">
        <div className="mx-auto max-w-7xl">
          {/* Header */}
          <div className="text-center mb-8 md:mb-12">
            <div className="relative">
              <div className="absolute inset-0 -top-4 -bottom-4">
                <div className="w-full h-full bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 rounded-3xl opacity-60"></div>
              </div>

              <div className="relative py-6 md:py-8 px-4 md:px-6">
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 mb-3">
                  <div className="w-12 h-12 md:w-14 md:h-14 relative">
                    <Image
                      src="/images/quote-logo.png"
                      alt="Quote Fetcher Logo"
                      width={56}
                      height={56}
                      className="object-contain"
                      priority
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  </div>
                  <h1 className="text-2xl sm:text-4xl md:text-5xl font-bold text-gradient text-center sm:text-left">
                    Random Quote Fetcher
                  </h1>
                </div>

                <p className="text-base md:text-lg text-slate-600 mb-6 max-w-2xl mx-auto leading-relaxed px-4">
                  Discover inspiring quotes with an interactive grid interface
                </p>

                {/* Performance stats */}
                {(performanceMetrics.totalRequests > 0 || performanceMetrics.concurrentRequests > 0) && (
                  <div className="inline-flex items-center gap-4 glass-effect border border-slate-200/50 rounded-2xl px-4 py-2 text-xs text-slate-600 mb-6">
                    <span>Requests: {performanceMetrics.totalRequests}</span>
                    <span className={getSuccessRateClass(Math.round((performanceMetrics.successfulRequests / Math.max(performanceMetrics.totalRequests, 1)) * 100))}>
                      Success: {Math.round((performanceMetrics.successfulRequests / Math.max(performanceMetrics.totalRequests, 1)) * 100)}%
                    </span>
                    <span>Concurrent: {performanceMetrics.concurrentRequests}</span>
                    <span>Max: {performanceMetrics.maxConcurrentReached}</span>
                  </div>
                )}

                {/* Controls */}
                <div className="hidden sm:inline-flex items-center gap-4 glass-effect border border-slate-200/50 rounded-2xl px-6 py-3 shadow-sm">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                      <div className="w-6 h-6 bg-slate-100 border border-slate-300 rounded text-xs flex items-center justify-center font-medium text-slate-600">↑</div>
                      <div className="w-6 h-6 bg-slate-100 border border-slate-300 rounded text-xs flex items-center justify-center font-medium text-slate-600">↓</div>
                      <div className="w-6 h-6 bg-slate-100 border border-slate-300 rounded text-xs flex items-center justify-center font-medium text-slate-600">←</div>
                      <div className="w-6 h-6 bg-slate-100 border border-slate-300 rounded text-xs flex items-center justify-center font-medium text-slate-600">→</div>
                    </div>
                    <span className="text-sm text-slate-600">Navigate</span>
                  </div>

                  <div className="w-px h-4 bg-slate-300"></div>

                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 bg-slate-100 border border-slate-300 rounded text-xs flex items-center justify-center font-medium text-slate-600">X</div>
                    <span className="text-sm text-slate-600">Toggle</span>
                  </div>

                  <div className="w-px h-4 bg-slate-300"></div>

                  <div className="flex items-center gap-2">
                    <div className="px-2 h-6 bg-slate-100 border border-slate-300 rounded text-xs flex items-center justify-center font-medium text-slate-600">Space</div>
                    <span className="text-sm text-slate-600">Fetch</span>
                  </div>
                </div>

                <div className="sm:hidden text-xs text-slate-500 glass-effect border border-slate-200/50 rounded-xl px-4 py-2 max-w-xs mx-auto">
                  Click cells to select • Use Space to fetch quotes
                </div>
              </div>
            </div>
          </div>

          {/* Error display */}
          <APIErrorBoundary>
            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-800 text-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-start gap-2">
                    <svg className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01" />
                    </svg>
                    <div>
                      <div className="font-semibold mb-1">Error occurred</div>
                      <div className="text-sm">{error}</div>
                    </div>
                  </div>
                  <button
                    onClick={() => setError(null)}
                    className="text-red-600 hover:text-red-800 transition-colors ml-4"
                  >
                    ✕
                  </button>
                </div>
              </div>
            )}
          </APIErrorBoundary>

          <div className="flex flex-col lg:flex-row gap-4 md:gap-6 lg:gap-8">
            {/* Left section - Controls */}
            <div className="hidden md:block w-full lg:w-72 bg-white border border-slate-200 rounded-xl p-4 md:p-6 shadow-sm order-2 lg:order-1">
              <h2 className="text-base md:text-lg font-semibold mb-4 md:mb-5 text-slate-900">Controls</h2>
              <div className="space-y-2 md:space-y-3 text-xs md:text-sm">
                <div className="flex justify-between items-center">
                  <span className="font-medium text-slate-700">Click Cell</span>
                  <span className="text-slate-500">Select/Focus</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-medium text-slate-700">Arrow Keys</span>
                  <span className="text-slate-500">Navigate (keep selection)</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-medium text-slate-700">X</span>
                  <span className="text-slate-500">Toggle current cell</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-medium text-slate-700">Shift + Arrows</span>
                  <span className="text-slate-500">Range select</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-medium text-slate-700">Space</span>
                  <span className="text-slate-500">Fetch quotes</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-medium text-slate-700">Escape</span>
                  <span className="text-slate-500">Clear selection</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-medium text-slate-700">Ctrl + A</span>
                  <span className="text-slate-500">Select all</span>
                </div>

                {/* Performance info */}
                {performanceMetrics.totalRequests > 0 && (
                  <div className="mt-3 md:mt-4 pt-3 md:pt-4 border-t border-slate-200">
                    <h3 className="text-xs font-semibold text-slate-800 mb-2">Performance</h3>
                    <div className="space-y-1 text-xs text-slate-600">
                      <div className="flex justify-between">
                        <span>Total Requests:</span>
                        <span>{performanceMetrics.totalRequests}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Success Rate:</span>
                        <span className={getSuccessRateClass(Math.round((performanceMetrics.successfulRequests / Math.max(performanceMetrics.totalRequests, 1)) * 100))}>
                          {Math.round((performanceMetrics.successfulRequests / Math.max(performanceMetrics.totalRequests, 1)) * 100)}%
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Max Concurrent:</span>
                        <span>{performanceMetrics.maxConcurrentReached}</span>
                      </div>
                      {performanceMetrics.averageResponseTime > 0 && (
                        <div className="flex justify-between">
                          <span>Avg Response:</span>
                          <span>{Math.round(performanceMetrics.averageResponseTime)}ms</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="mt-3 md:mt-4 pt-3 md:pt-4 border-t border-slate-200">
                  <p className="text-xs text-slate-500 leading-relaxed">
                    <span className="font-medium text-slate-700">Live scraping</span> from quotes.toscrape.com.
                    Supports up to 300 concurrent requests with intelligent caching and memory management.
                  </p>
                </div>
              </div>
            </div>

            {/* Center section - Grid */}
            <GridErrorBoundary>
              <QuoteGridCells
                focusedCell={focusedCell}
                selectedCells={selectedCells}
                loadingCells={loadingCells}
                cellContent={cellContent}
                loadingMessages={loadingMessages}
                columns={columns}
                onCellClick={handleCellClick}
                truncateQuote={truncateQuote}
              />
            </GridErrorBoundary>

            {/* Right section - Details */}
            <div className="w-full lg:w-72 bg-white border border-slate-200 rounded-xl p-4 md:p-6 shadow-sm order-3">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base md:text-lg font-semibold text-slate-900">Quote Details</h2>
                {focusedCell !== null && cellContent[focusedCell]?.sourceUrl && (
                  <a
                    href={cellContent[focusedCell].sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                      />
                    </svg>
                  </a>
                )}
              </div>

              {focusedCell !== null && cellContent[focusedCell] ? (
                <div className="space-y-3 md:space-y-4">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-800 mb-2">Quote</h3>
                    <p className="text-xs md:text-sm text-slate-600 leading-relaxed">
                      &ldquo;{cellContent[focusedCell].text}&rdquo;
                    </p>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-800 mb-1">Author</h3>
                    <p className="text-xs md:text-sm text-slate-600 font-medium">
                      {cellContent[focusedCell].author}
                    </p>
                  </div>
                  {cellContent[focusedCell].tags.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-slate-800 mb-2">Tags</h3>
                      <div className="flex flex-wrap gap-1 md:gap-1.5">
                        {cellContent[focusedCell].tags.map((tag: string, index: number) => (
                          <span
                            key={index}
                            className="px-2 md:px-2.5 py-1 bg-slate-100 text-slate-600 text-xs rounded-full font-medium"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-6 md:py-8">
                  <div className="text-slate-400 text-sm">
                    {focusedCell !== null ? (
                      <>
                        <div className="mb-2">📝</div>
                        <p>This cell is empty</p>
                        <p className="text-xs mt-1">
                          Press Space to fetch a quote
                        </p>
                      </>
                    ) : (
                      <>
                        <div className="mb-2">⌨️</div>
                        <p>Click a cell to select and view details</p>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Selection info */}
              {selectedCells.size > 0 && (
                <div className="mt-3 md:mt-4 pt-3 md:pt-4 border-t border-slate-200">
                  <p className="text-xs text-slate-500">
                    <span className="font-medium text-slate-700">{selectedCells.size}</span> cells selected
                  </p>
                  {selectedCells.size >= 50 && (
                    <p className="text-xs text-amber-600 mt-1">
                      ⚡ Large bulk operation - may take a moment
                    </p>
                  )}
                </div>
              )}

              {/* Mobile controls hint */}
              <div className="md:hidden mt-4 pt-4 border-t border-slate-200">
                <p className="text-xs text-slate-500 leading-relaxed text-center">
                  💡 Click cells to select • Use Space to fetch quotes
                </p>
              </div>
            </div>
          </div>

          {/* Footer */}
          <footer className="mt-12 md:mt-16 pt-6 md:pt-8 border-t border-slate-200">
            <div className="text-center">
              <p className="text-xs md:text-sm text-slate-500 px-4">
                Built with ❤️ using Next.js • Data from{' '}
                <a
                  href="https://quotes.toscrape.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-slate-600 hover:text-slate-800 transition-colors underline"
                >
                  quotes.toscrape.com
                </a>
                {performanceMetrics.maxConcurrentReached > 0 && (
                  <span className="block mt-1 text-xs text-slate-400">
                    Peak concurrent requests: {performanceMetrics.maxConcurrentReached}
                  </span>
                )}
              </p>
            </div>
          </footer>
        </div>
      </main>
    </ErrorBoundary>
  );
}