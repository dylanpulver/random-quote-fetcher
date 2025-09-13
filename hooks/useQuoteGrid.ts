import { useErrorHandler } from "@/components/ErrorBoundary";
import { PerformanceMetrics, Quote } from "@/lib/types";
import { useCallback, useEffect, useState } from "react";

export interface QuoteGridState {
  // Grid state
  focusedCell: number | null;
  selectedCells: Set<number>;
  selectionStart: number | null;
  selectionPath: number[];
  cellContent: { [key: number]: Quote };

  // Loading state
  loadingCells: Set<number>;
  loadingMessages: { [key: number]: string };
  error: string | null;

  // Performance tracking
  performanceMetrics: PerformanceMetrics;

  // Layout
  columns: number;

  // Actions
  handleCellClick: (cellIndex: number) => void;
  handleBulkFetch: (cellIndices: number[]) => Promise<void>;
  getSuccessRateClass: (rate: number) => string;
  truncateQuote: (quote: Quote) => string;
  setError: (error: string | null) => void;
}

export function useQuoteGrid(): QuoteGridState {
  // Core grid state
  const [focusedCell, setFocusedCell] = useState<number | null>(null);
  const [selectedCells, setSelectedCells] = useState<Set<number>>(new Set());
  const [selectionStart, setSelectionStart] = useState<number | null>(null);
  const [selectionPath, setSelectionPath] = useState<number[]>([]);
  const [cellContent, setCellContent] = useState<{ [key: number]: Quote }>({});

  // Loading state
  const [loadingCells, setLoadingCells] = useState<Set<number>>(new Set());
  const [loadingMessages, setLoadingMessages] = useState<{ [key: number]: string }>({});
  const [error, setError] = useState<string | null>(null);

  // Performance tracking
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetrics>({
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    averageResponseTime: 0,
    concurrentRequests: 0,
    maxConcurrentReached: 0
  });

  // Layout
  const [columns, setColumns] = useState(3);

  // Error handling
  const throwError = useErrorHandler();

  // Track active requests for performance monitoring
  const activeRequestsRef = useState(new Set<number>())[0];

  // Get current number of columns based on screen size
  const getColumns = useCallback(() => {
    if (typeof window !== 'undefined') {
      if (window.innerWidth >= 768) return 3; // md and up - 3 columns
      if (window.innerWidth >= 480) return 2; // sm to md - 2 columns
      return 2; // xs - 2 columns (but smaller cells)
    }
    return 3; // default for SSR
  }, []);

  // Update columns on resize
  useEffect(() => {
    const updateColumns = () => setColumns(getColumns());
    updateColumns();
    window.addEventListener('resize', updateColumns);
    return () => window.removeEventListener('resize', updateColumns);
  }, [getColumns]);

  // Truncate quote for display
  const truncateQuote = useCallback((quote: Quote) => {
    const words = quote.text.split(" ");
    const firstWords = words.slice(0, Math.min(5, Math.max(3, words.length)));
    return `"${firstWords.join(" ")}..."`;
  }, []);

  // Handle cell click
  const handleCellClick = useCallback((cellIndex: number) => {
    setFocusedCell(cellIndex);

    setSelectedCells((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(cellIndex)) {
        newSet.delete(cellIndex);
      } else {
        newSet.add(cellIndex);
      }
      return newSet;
    });

    setSelectionStart(null);
    setSelectionPath([]);
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

  // SSE scraping method
  const startScrapingWithSSE = useCallback(async (cellIndex: number) => {
    if (loadingCells.has(cellIndex)) {
      console.warn(`Cell ${cellIndex} is already loading, skipping`);
      return;
    }

    const startTime = Date.now();
    activeRequestsRef.add(cellIndex);

    setLoadingCells((prev) => new Set([...prev, cellIndex]));
    setError(null);

    try {
      const response = await fetch('/api/scrape-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ cellId: cellIndex })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('No response body');
      }

      let hasReceivedData = false;

      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        hasReceivedData = true;
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));

              if (data.cellId === cellIndex) {
                if (data.stage === 'complete') {
                  const responseTime = Date.now() - startTime;
                  updatePerformanceMetrics(true, responseTime);

                  setCellContent((prev) => ({
                    ...prev,
                    [cellIndex]: data.quote,
                  }));

                  setLoadingCells((prev) => {
                    const newSet = new Set(prev);
                    newSet.delete(cellIndex);
                    return newSet;
                  });
                  setLoadingMessages((prev) => {
                    const newMessages = { ...prev };
                    delete newMessages[cellIndex];
                    return newMessages;
                  });
                } else if (data.stage === 'error') {
                  const responseTime = Date.now() - startTime;
                  updatePerformanceMetrics(false, responseTime);

                  console.error('Scraping error:', data.error);
                  const errorMessage = `Failed to fetch quote for cell ${cellIndex}: ${data.error}`;
                  setError(errorMessage);

                  if (data.error.includes('Browser') || data.error.includes('Memory')) {
                    throwError(new Error(errorMessage));
                  }

                  setLoadingCells((prev) => {
                    const newSet = new Set(prev);
                    newSet.delete(cellIndex);
                    return newSet;
                  });
                  setLoadingMessages((prev) => {
                    const newMessages = { ...prev };
                    delete newMessages[cellIndex];
                    return newMessages;
                  });
                } else if (typeof data.stage === 'number') {
                  setLoadingMessages((prev) => ({
                    ...prev,
                    [cellIndex]: data.message
                  }));
                }
              }
            } catch (parseError) {
              console.error('Error parsing SSE data:', parseError);
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

      console.error('Fetch error:', fetchError);
      const errorMessage = `Network error for cell ${cellIndex}: ${fetchError instanceof Error ? fetchError.message : 'Unknown error'}`;
      setError(errorMessage);

      if (activeRequestsRef.size > 10 && fetchError instanceof Error &&
          (fetchError.message.includes('Failed to fetch') || fetchError.message.includes('NetworkError'))) {
        console.warn('Network error during bulk operation, continuing with other requests');
      }

      setLoadingCells((prev) => {
        const newSet = new Set(prev);
        newSet.delete(cellIndex);
        return newSet;
      });
      setLoadingMessages((prev) => {
        const newMessages = { ...prev };
        delete newMessages[cellIndex];
        return newMessages;
      });
    } finally {
      activeRequestsRef.delete(cellIndex);
    }
  }, [loadingCells, updatePerformanceMetrics, throwError, activeRequestsRef]);

  // Fallback scraping method
  const startScrapingFallback = useCallback(async (cellIndex: number) => {
    if (loadingCells.has(cellIndex)) {
      console.warn(`Cell ${cellIndex} is already loading (fallback), skipping`);
      return;
    }

    const startTime = Date.now();
    activeRequestsRef.add(cellIndex);

    setLoadingCells((prev) => new Set([...prev, cellIndex]));
    setError(null);

    const messages = [
      "Starting fetch...",
      "Connecting...",
      `Browsing to page ${Math.floor(Math.random() * 10) + 1}...`,
      "Loading quotes...",
      "Selecting random quote...",
      "Selected."
    ];

    try {
      for (let i = 0; i < messages.length; i++) {
        if (!loadingCells.has(cellIndex)) {
          console.log(`Cell ${cellIndex} loading cancelled`);
          return;
        }

        setLoadingMessages((prev) => ({ ...prev, [cellIndex]: messages[i] }));
        const randomDelay = Math.floor(Math.random() * (800 - 400 + 1)) + 400;
        await new Promise((resolve) => setTimeout(resolve, randomDelay));
      }

      const response = await fetch('/api/scrape-quote', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ cellId: cellIndex }),
        signal: AbortSignal.timeout(30000)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (result.success) {
        const responseTime = Date.now() - startTime;
        updatePerformanceMetrics(true, responseTime);

        setCellContent((prev) => ({
          ...prev,
          [cellIndex]: result.quote,
        }));
      } else {
        throw new Error(result.error || 'Unknown error');
      }

    } catch (error) {
      const responseTime = Date.now() - startTime;
      updatePerformanceMetrics(false, responseTime);

      console.error('Scraping error:', error);
      const errorMessage = `Failed to fetch quote for cell ${cellIndex}: ${error instanceof Error ? error.message : 'Unknown error'}`;
      setError(errorMessage);
    } finally {
      activeRequestsRef.delete(cellIndex);

      setLoadingCells((prev) => {
        const newSet = new Set(prev);
        newSet.delete(cellIndex);
        return newSet;
      });
      setLoadingMessages((prev) => {
        const newMessages = { ...prev };
        delete newMessages[cellIndex];
        return newMessages;
      });
    }
  }, [loadingCells, updatePerformanceMetrics, activeRequestsRef]);

  // Enhanced bulk fetch
  const handleBulkFetch = useCallback(async (cellIndices: number[]) => {
    const emptyCells = cellIndices.filter(cellIndex =>
      !cellContent[cellIndex] && !loadingCells.has(cellIndex)
    );

    if (emptyCells.length === 0) {
      console.log('No empty cells to fetch');
      return;
    }

    console.log(`Starting bulk fetch for ${emptyCells.length} cells`);

    setPerformanceMetrics(prev => ({
      ...prev,
      concurrentRequests: emptyCells.length,
      maxConcurrentReached: Math.max(prev.maxConcurrentReached, emptyCells.length)
    }));

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

    Promise.allSettled(promises).then((results) => {
      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;
      console.log(`Bulk fetch completed: ${successful} successful, ${failed} failed`);
    });

  }, [cellContent, loadingCells, startScrapingWithSSE, startScrapingFallback]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      try {
        if (focusedCell === null) {
          e.preventDefault();
          setFocusedCell(0);
          return;
        }

        const currentRow = Math.floor(focusedCell / columns);
        const currentCol = focusedCell % columns;

        switch (e.key) {
          case "ArrowUp":
            e.preventDefault();
            if (currentRow > 0) {
              const newFocus = focusedCell - columns;
              setFocusedCell(newFocus);
              if (e.shiftKey) {
                if (selectionStart === null) {
                  setSelectionStart(focusedCell);
                  setSelectionPath([focusedCell]);
                  setSelectedCells((prev) => new Set([...prev, focusedCell]));
                }
                setSelectionPath((prev) => [...prev, newFocus]);
                setSelectedCells((prev) => new Set([...prev, newFocus]));
              }
            }
            break;
          case "ArrowDown":
            e.preventDefault();
            const maxRow = Math.floor(299 / columns);
            if (currentRow < maxRow) {
              const newFocus = Math.min(focusedCell + columns, 299);
              setFocusedCell(newFocus);
              if (e.shiftKey) {
                if (selectionStart === null) {
                  setSelectionStart(focusedCell);
                  setSelectionPath([focusedCell]);
                  setSelectedCells((prev) => new Set([...prev, focusedCell]));
                }
                setSelectionPath((prev) => [...prev, newFocus]);
                setSelectedCells((prev) => new Set([...prev, newFocus]));
              }
            }
            break;
          case "ArrowLeft":
            e.preventDefault();
            if (currentCol > 0) {
              const newFocus = focusedCell - 1;
              setFocusedCell(newFocus);
              if (e.shiftKey) {
                if (selectionStart === null) {
                  setSelectionStart(focusedCell);
                  setSelectionPath([focusedCell]);
                  setSelectedCells((prev) => new Set([...prev, focusedCell]));
                }
                setSelectionPath((prev) => [...prev, newFocus]);
                setSelectedCells((prev) => new Set([...prev, newFocus]));
              }
            }
            break;
          case "ArrowRight":
            e.preventDefault();
            if (currentCol < columns - 1) {
              const newFocus = focusedCell + 1;
              setFocusedCell(newFocus);
              if (e.shiftKey) {
                if (selectionStart === null) {
                  setSelectionStart(focusedCell);
                  setSelectionPath([focusedCell]);
                  setSelectedCells((prev) => new Set([...prev, focusedCell]));
                }
                setSelectionPath((prev) => [...prev, newFocus]);
                setSelectedCells((prev) => new Set([...prev, newFocus]));
              }
            }
            break;
          case "x":
          case "X":
            e.preventDefault();
            setSelectedCells((prev) => {
              const newSet = new Set(prev);
              if (newSet.has(focusedCell)) {
                newSet.delete(focusedCell);
              } else {
                newSet.add(focusedCell);
              }
              return newSet;
            });
            setSelectionStart(null);
            setSelectionPath([]);
            break;
          case " ":
            e.preventDefault();
            if (selectedCells.size > 0) {
              handleBulkFetch(Array.from(selectedCells));
            } else if (focusedCell !== null) {
              if (!cellContent[focusedCell] && !loadingCells.has(focusedCell)) {
                handleBulkFetch([focusedCell]);
              }
            }
            break;
          case "Escape":
            e.preventDefault();
            setSelectedCells(new Set());
            setSelectionStart(null);
            setSelectionPath([]);
            setError(null);
            break;
          case "a":
          case "A":
            if (e.ctrlKey || e.metaKey) {
              e.preventDefault();
              const allCells = new Set(Array.from({ length: 300 }, (_, i) => i));
              setSelectedCells(allCells);
              setSelectionStart(null);
              setSelectionPath([]);
            }
            break;
        }
      } catch (error) {
        console.error('Keyboard navigation error:', error);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [focusedCell, selectionStart, selectedCells, cellContent, loadingCells, selectionPath, columns, handleBulkFetch]);

  // Get success rate for performance display
  const getSuccessRateClass = useCallback((rate: number) => {
    if (rate >= 95) return "metric-success";
    if (rate >= 85) return "metric-warning";
    return "metric-error";
  }, []);

  return {
    // State
    focusedCell,
    selectedCells,
    selectionStart,
    selectionPath,
    cellContent,
    loadingCells,
    loadingMessages,
    error,
    performanceMetrics,
    columns,

    // Actions
    handleCellClick,
    handleBulkFetch,
    getSuccessRateClass,
    truncateQuote,
    setError,
  };
}