"use client"

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { APIErrorBoundary, ErrorBoundary, GridErrorBoundary, useErrorHandler } from "../components/ErrorBoundary";

interface Quote {
  text: string;
  author: string;
  tags: string[];
  sourceUrl?: string;
}

interface PerformanceMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  concurrentRequests: number;
  maxConcurrentReached: number;
}

export default function Home() {
  const [focusedCell, setFocusedCell] = useState<number | null>(null)
  const [selectedCells, setSelectedCells] = useState<Set<number>>(new Set())
  const [selectionStart, setSelectionStart] = useState<number | null>(null)
  const [selectionPath, setSelectionPath] = useState<number[]>([])
  const [cellContent, setCellContent] = useState<{ [key: number]: Quote }>({})
  const [loadingCells, setLoadingCells] = useState<Set<number>>(new Set())
  const [loadingMessages, setLoadingMessages] = useState<{ [key: number]: string }>({})
  const [error, setError] = useState<string | null>(null)

  // Performance tracking
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetrics>({
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    averageResponseTime: 0,
    concurrentRequests: 0,
    maxConcurrentReached: 0
  });

  // Error handling
  const throwError = useErrorHandler();

  // Track active requests for performance monitoring
  const activeRequestsRef = useState(new Set<number>())[0];

  // Get current number of columns based on screen size
  const getColumns = useCallback(() => {
    if (typeof window !== 'undefined') {
      if (window.innerWidth >= 768) return 3 // md and up - 3 columns
      if (window.innerWidth >= 480) return 2 // sm to md - 2 columns
      return 2 // xs - 2 columns (but smaller cells)
    }
    return 3 // default for SSR
  }, []);

  const [columns, setColumns] = useState(3)

  useEffect(() => {
    const updateColumns = () => setColumns(getColumns())
    updateColumns()
    window.addEventListener('resize', updateColumns)
    return () => window.removeEventListener('resize', updateColumns)
  }, [getColumns])

  const truncateQuote = useCallback((quote: Quote) => {
    const words = quote.text.split(" ")
    const firstWords = words.slice(0, Math.min(5, Math.max(3, words.length)))
    return `"${firstWords.join(" ")}..."`
  }, []);

  // Enhanced request tracking
  const updatePerformanceMetrics = useCallback((success: boolean, responseTime: number) => {
    setPerformanceMetrics(prev => ({
      ...prev,
      totalRequests: prev.totalRequests + 1,
      successfulRequests: prev.successfulRequests + (success ? 1 : 0),
      failedRequests: prev.failedRequests + (success ? 0 : 1),
      averageResponseTime: (prev.averageResponseTime * (prev.totalRequests - 1) + responseTime) / prev.totalRequests,
      concurrentRequests: activeRequestsRef.size,
      maxConcurrentReached: Math.max(prev.maxConcurrentReached, activeRequestsRef.size)
    }));
  }, [activeRequestsRef]);

  const startScrapingWithSSE = useCallback(async (cellIndex: number) => {
    if (loadingCells.has(cellIndex)) {
      console.warn(`Cell ${cellIndex} is already loading, skipping`);
      return;
    }

    const startTime = Date.now();
    activeRequestsRef.add(cellIndex);

    setLoadingCells((prev) => new Set([...prev, cellIndex]))
    setError(null)

    try {
      const response = await fetch('/api/scrape-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ cellId: cellIndex })
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      if (!reader) {
        throw new Error('No response body')
      }

      let hasReceivedData = false;

      while (true) {
        const { done, value } = await reader.read()

        if (done) break

        hasReceivedData = true;
        const chunk = decoder.decode(value)
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))

              if (data.cellId === cellIndex) {
                if (data.stage === 'complete') {
                  // Success - update metrics and set content
                  const responseTime = Date.now() - startTime;
                  updatePerformanceMetrics(true, responseTime);

                  setCellContent((prev) => ({
                    ...prev,
                    [cellIndex]: data.quote,
                  }))

                  // Clean up loading state
                  setLoadingCells((prev) => {
                    const newSet = new Set(prev)
                    newSet.delete(cellIndex)
                    return newSet
                  })
                  setLoadingMessages((prev) => {
                    const newMessages = { ...prev }
                    delete newMessages[cellIndex]
                    return newMessages
                  })
                } else if (data.stage === 'error') {
                  // Error - update metrics and show error
                  const responseTime = Date.now() - startTime;
                  updatePerformanceMetrics(false, responseTime);

                  console.error('Scraping error:', data.error)
                  const errorMessage = `Failed to fetch quote for cell ${cellIndex}: ${data.error}`;
                  setError(errorMessage);

                  // For critical errors, trigger error boundary
                  if (data.error.includes('Browser') || data.error.includes('Memory')) {
                    throwError(new Error(errorMessage));
                  }

                  // Clean up loading state
                  setLoadingCells((prev) => {
                    const newSet = new Set(prev)
                    newSet.delete(cellIndex)
                    return newSet
                  })
                  setLoadingMessages((prev) => {
                    const newMessages = { ...prev }
                    delete newMessages[cellIndex]
                    return newMessages
                  })
                } else if (typeof data.stage === 'number') {
                  // Update loading message
                  setLoadingMessages((prev) => ({
                    ...prev,
                    [cellIndex]: data.message
                  }))
                }
              }
            } catch (parseError) {
              console.error('Error parsing SSE data:', parseError)
            }
          }
        }
      }

      if (!hasReceivedData) {
        throw new Error('No data received from server');
      }

    } catch (fetchError) {
      const responseTime = Date.now() - startTime;
      updatePerformanceMetrics(false, responseTime);

      console.error('Fetch error:', fetchError)
      const errorMessage = `Network error for cell ${cellIndex}: ${fetchError instanceof Error ? fetchError.message : 'Unknown error'}`;
      setError(errorMessage);

      // For network errors during bulk operations, don't crash the whole app
      if (activeRequestsRef.size > 10 && fetchError instanceof Error &&
          (fetchError.message.includes('Failed to fetch') || fetchError.message.includes('NetworkError'))) {
        console.warn('Network error during bulk operation, continuing with other requests');
      }

      // Clean up loading state on error
      setLoadingCells((prev) => {
        const newSet = new Set(prev)
        newSet.delete(cellIndex)
        return newSet
      })
      setLoadingMessages((prev) => {
        const newMessages = { ...prev }
        delete newMessages[cellIndex]
        return newMessages
      })
    } finally {
      activeRequestsRef.delete(cellIndex);
    }
  }, [loadingCells, updatePerformanceMetrics, throwError, activeRequestsRef])

  const startScrapingFallback = useCallback(async (cellIndex: number) => {
    if (loadingCells.has(cellIndex)) {
      console.warn(`Cell ${cellIndex} is already loading (fallback), skipping`);
      return;
    }

    const startTime = Date.now();
    activeRequestsRef.add(cellIndex);

    setLoadingCells((prev) => new Set([...prev, cellIndex]))
    setError(null)

    const messages = [
      "Starting fetch...",
      "Logging in...",
      `Browsing to page ${Math.floor(Math.random() * 10) + 1}...`,
      "Selecting random quote...",
      "Selected.",
    ]

    try {
      // Simulate loading stages with better error handling
      for (let i = 0; i < messages.length; i++) {
        // Check if component is still mounted and cell should still be loading
        if (!loadingCells.has(cellIndex)) {
          console.log(`Cell ${cellIndex} loading cancelled`);
          return;
        }

        setLoadingMessages((prev) => ({ ...prev, [cellIndex]: messages[i] }))
        const randomDelay = Math.floor(Math.random() * (1200 - 600 + 1)) + 600; // Faster for better UX
        await new Promise((resolve) => setTimeout(resolve, randomDelay))
      }

      // Fetch the actual quote using simple scraper
      const response = await fetch('/api/scrape-quote', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ cellId: cellIndex, useSimple: true }),
        signal: AbortSignal.timeout(15000) // 15 second timeout
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result = await response.json()

      if (result.success) {
        const responseTime = Date.now() - startTime;
        updatePerformanceMetrics(true, responseTime);

        setCellContent((prev) => ({
          ...prev,
          [cellIndex]: result.quote,
        }))
      } else {
        throw new Error(result.error || 'Unknown error')
      }

    } catch (error) {
      const responseTime = Date.now() - startTime;
      updatePerformanceMetrics(false, responseTime);

      console.error('Scraping error:', error)
      const errorMessage = `Failed to fetch quote for cell ${cellIndex}: ${error instanceof Error ? error.message : 'Unknown error'}`;
      setError(errorMessage);
    } finally {
      activeRequestsRef.delete(cellIndex);

      // Clean up loading state
      setLoadingCells((prev) => {
        const newSet = new Set(prev)
        newSet.delete(cellIndex)
        return newSet
      })
      setLoadingMessages((prev) => {
        const newMessages = { ...prev }
        delete newMessages[cellIndex]
        return newMessages
      })
    }
  }, [loadingCells, updatePerformanceMetrics, activeRequestsRef])

  // Enhanced bulk fetch with better concurrency handling
  const handleBulkFetch = useCallback(async (cellIndices: number[]) => {
    const emptyCells = cellIndices.filter(cellIndex =>
      !cellContent[cellIndex] && !loadingCells.has(cellIndex)
    );

    if (emptyCells.length === 0) {
      console.log('No empty cells to fetch');
      return;
    }

    console.log(`Starting bulk fetch for ${emptyCells.length} cells`);

    // Update concurrent request tracking
    setPerformanceMetrics(prev => ({
      ...prev,
      concurrentRequests: emptyCells.length,
      maxConcurrentReached: Math.max(prev.maxConcurrentReached, emptyCells.length)
    }));

    // Use SSE for better performance, fallback if needed
    const promises = emptyCells.map(async (cellIndex) => {
      try {
        await startScrapingWithSSE(cellIndex);
      } catch (error) {
        console.warn(`SSE failed for cell ${cellIndex}, trying fallback:`, error);
        try {
          await startScrapingFallback(cellIndex);
        } catch (fallbackError) {
          console.error(`Both methods failed for cell ${cellIndex}:`, fallbackError);
        }
      }
    });

    // Don't await all - let them run concurrently
    Promise.allSettled(promises).then((results) => {
      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;
      console.log(`Bulk fetch completed: ${successful} successful, ${failed} failed`);
    });

  }, [cellContent, loadingCells, startScrapingWithSSE, startScrapingFallback]);

  // Keyboard navigation with enhanced error handling
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      try {
        if (focusedCell === null) {
          e.preventDefault()
          setFocusedCell(0)
          return
        }

        const currentRow = Math.floor(focusedCell / columns)
        const currentCol = focusedCell % columns

        switch (e.key) {
          case "ArrowUp":
            e.preventDefault()
            if (currentRow > 0) {
              const newFocus = focusedCell - columns
              setFocusedCell(newFocus)
              if (e.shiftKey) {
                if (selectionStart === null) {
                  setSelectionStart(focusedCell)
                  setSelectionPath([focusedCell])
                  setSelectedCells(new Set([focusedCell]))
                }
                setSelectionPath((prev) => [...prev, newFocus])
                setSelectedCells((prev) => new Set([...prev, newFocus]))
              } else {
                setSelectionStart(null)
                setSelectionPath([])
                setSelectedCells(new Set())
              }
            }
            break
          case "ArrowDown":
            e.preventDefault()
            const maxRow = Math.floor(299 / columns)
            if (currentRow < maxRow) {
              const newFocus = Math.min(focusedCell + columns, 299)
              setFocusedCell(newFocus)
              if (e.shiftKey) {
                if (selectionStart === null) {
                  setSelectionStart(focusedCell)
                  setSelectionPath([focusedCell])
                  setSelectedCells(new Set([focusedCell]))
                }
                setSelectionPath((prev) => [...prev, newFocus])
                setSelectedCells((prev) => new Set([...prev, newFocus]))
              } else {
                setSelectionStart(null)
                setSelectionPath([])
                setSelectedCells(new Set())
              }
            }
            break
          case "ArrowLeft":
            e.preventDefault()
            if (currentCol > 0) {
              const newFocus = focusedCell - 1
              setFocusedCell(newFocus)
              if (e.shiftKey) {
                if (selectionStart === null) {
                  setSelectionStart(focusedCell)
                  setSelectionPath([focusedCell])
                  setSelectedCells(new Set([focusedCell]))
                }
                setSelectionPath((prev) => [...prev, newFocus])
                setSelectedCells((prev) => new Set([...prev, newFocus]))
              } else {
                setSelectionStart(null)
                setSelectionPath([])
                setSelectedCells(new Set())
              }
            }
            break
          case "ArrowRight":
            e.preventDefault()
            if (currentCol < columns - 1) {
              const newFocus = focusedCell + 1
              setFocusedCell(newFocus)
              if (e.shiftKey) {
                if (selectionStart === null) {
                  setSelectionStart(focusedCell)
                  setSelectionPath([focusedCell])
                  setSelectedCells(new Set([focusedCell]))
                }
                setSelectionPath((prev) => [...prev, newFocus])
                setSelectedCells((prev) => new Set([...prev, newFocus]))
              } else {
                setSelectionStart(null)
                setSelectionPath([])
                setSelectedCells(new Set())
              }
            }
            break
          case "x":
          case "X":
            e.preventDefault()
            setSelectedCells((prev) => {
              const newSet = new Set(prev)
              if (newSet.has(focusedCell)) {
                newSet.delete(focusedCell)
              } else {
                newSet.add(focusedCell)
              }
              return newSet
            })
            setSelectionStart(null)
            setSelectionPath([])
            break
          case " ":
            e.preventDefault()
            if (selectedCells.size > 0) {
              handleBulkFetch(Array.from(selectedCells));
            } else if (focusedCell !== null) {
              if (!cellContent[focusedCell] && !loadingCells.has(focusedCell)) {
                handleBulkFetch([focusedCell]);
              }
            }
            break
          case "Escape":
            e.preventDefault()
            setSelectedCells(new Set())
            setSelectionStart(null)
            setSelectionPath([])
            setError(null)
            break
          case "a":
          case "A":
            if (e.ctrlKey || e.metaKey) {
              e.preventDefault()
              const allCells = new Set(Array.from({ length: 300 }, (_, i) => i))
              setSelectedCells(allCells)
              setSelectionStart(null)
              setSelectionPath([])
            }
            break
        }
      } catch (error) {
        console.error('Keyboard navigation error:', error);
        // Don't throw error for keyboard navigation issues
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [focusedCell, selectionStart, selectedCells, cellContent, loadingCells, selectionPath, columns, handleBulkFetch])

  // Memoized grid cells for performance
  const gridCells = useMemo(() => {
    return Array.from({ length: 300 }, (_, i) => {
      const isSelected = selectedCells.has(i)
      const isFocused = focusedCell === i
      const isLoading = loadingCells.has(i)
      const hasContent = cellContent[i]

      return (
        <div
          key={i}
          className={`
            min-h-[64px] aspect-[2.5/1] max-w-[200px]
            border-2 rounded-lg md:rounded-xl flex items-center justify-center font-medium
            transition-all duration-200 cursor-pointer hover:shadow-md hover:border-slate-300
            ${isFocused && !isSelected
              ? "ring-2 ring-blue-500 bg-blue-50 border-blue-300 shadow-md"
              : ""
            }
            ${isSelected
              ? "bg-blue-500 text-white border-blue-500 shadow-lg ring-2 ring-blue-300"
              : "bg-white border-slate-200"
            }
          `}
        >
          {isLoading ? (
            <span className={`text-xs animate-pulse px-2 text-center font-normal ${
              isSelected ? "text-blue-100" : "text-slate-500"
            }`}>
              {loadingMessages[i] || "Loading..."}
            </span>
          ) : hasContent ? (
            <span className={`italic text-xs px-2 text-center font-normal leading-tight ${
              isSelected ? "text-white" : "text-slate-700"
            }`}>
              {truncateQuote(hasContent)}
            </span>
          ) : (
            <span className={`text-xs font-normal ${
              isSelected ? "text-blue-100" : "text-slate-400"
            }`}>
              Empty
            </span>
          )}
        </div>
      )
    });
  }, [selectedCells, focusedCell, loadingCells, cellContent, loadingMessages, truncateQuote]);

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
                        // Hide broken image gracefully
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  </div>
                  <h1 className="text-2xl sm:text-4xl md:text-5xl font-bold bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 bg-clip-text text-transparent text-center sm:text-left">
                    Random Quote Fetcher
                  </h1>
                </div>

                <p className="text-base md:text-lg text-slate-600 mb-6 max-w-2xl mx-auto leading-relaxed px-4">
                  Discover inspiring quotes with an interactive grid interface
                </p>

                {/* Performance stats */}
                {(performanceMetrics.totalRequests > 0 || performanceMetrics.concurrentRequests > 0) && (
                  <div className="inline-flex items-center gap-4 bg-white/80 backdrop-blur-sm border border-slate-200/50 rounded-2xl px-4 py-2 text-xs text-slate-600 mb-6">
                    <span>Requests: {performanceMetrics.totalRequests}</span>
                    <span>Success: {Math.round((performanceMetrics.successfulRequests / Math.max(performanceMetrics.totalRequests, 1)) * 100)}%</span>
                    <span>Concurrent: {performanceMetrics.concurrentRequests}</span>
                    <span>Max: {performanceMetrics.maxConcurrentReached}</span>
                  </div>
                )}

                {/* Controls */}
                <div className="hidden sm:inline-flex items-center gap-4 bg-white/80 backdrop-blur-sm border border-slate-200/50 rounded-2xl px-6 py-3 shadow-sm">
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
                    <span className="text-sm text-slate-600">Select</span>
                  </div>

                  <div className="w-px h-4 bg-slate-300"></div>

                  <div className="flex items-center gap-2">
                    <div className="px-2 h-6 bg-slate-100 border border-slate-300 rounded text-xs flex items-center justify-center font-medium text-slate-600">Space</div>
                    <span className="text-sm text-slate-600">Fetch</span>
                  </div>
                </div>

                <div className="sm:hidden text-xs text-slate-500 bg-white/60 backdrop-blur-sm border border-slate-200/50 rounded-xl px-4 py-2 max-w-xs mx-auto">
                  Best experienced with a keyboard on desktop
                </div>
              </div>
            </div>
          </div>

          {/* Error display with better styling */}
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
            {/* Left section - Actions */}
            <div className="hidden md:block w-full lg:w-72 bg-white border border-slate-200 rounded-xl p-4 md:p-6 shadow-sm order-2 lg:order-1">
              <h2 className="text-base md:text-lg font-semibold mb-4 md:mb-5 text-slate-900">Keyboard Controls</h2>
              <div className="space-y-2 md:space-y-3 text-xs md:text-sm">
                <div className="flex justify-between items-center">
                  <span className="font-medium text-slate-700">Arrow Keys</span>
                  <span className="text-slate-500">Navigate cells</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-medium text-slate-700">X</span>
                  <span className="text-slate-500">Toggle selection</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-medium text-slate-700">Shift + Arrows</span>
                  <span className="text-slate-500">Multi-select</span>
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
                        <span>{Math.round((performanceMetrics.successfulRequests / Math.max(performanceMetrics.totalRequests, 1)) * 100)}%</span>
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
            <div className="order-1 lg:order-2 flex-1 flex justify-center overflow-hidden">
              <GridErrorBoundary>
                <div className="max-h-[60vh] md:max-h-[70vh] lg:max-h-[75vh] overflow-y-auto w-full">
                  <div className="p-2 sm:p-4 max-w-none">
                    <div className={`grid gap-2 sm:gap-3 mx-auto w-fit max-w-full ${
                      columns === 2 ? 'grid-cols-2' : 'grid-cols-3'
                    }`} style={{
                      gridTemplateColumns: columns === 2
                        ? 'repeat(2, minmax(120px, 1fr))'
                        : 'repeat(3, minmax(140px, 1fr))'
                    }}>
                      {gridCells}
                    </div>
                  </div>
                </div>
              </GridErrorBoundary>
            </div>

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
                          <span className="hidden sm:inline">Press Space to fetch a quote</span>
                          <span className="sm:hidden">Tap to select, then use keyboard</span>
                        </p>
                      </>
                    ) : (
                      <>
                        <div className="mb-2">⌨️</div>
                        <p className="hidden sm:block">Use arrow keys to navigate</p>
                        <p className="sm:hidden">Tap cells to view quotes</p>
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
                  💡 This app works best with keyboard navigation on desktop or tablet devices
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
  )
}