"use client"

import { useCallback, useEffect, useState } from "react";

interface Quote {
  text: string;
  author: string;
  tags: string[];
  sourceUrl?: string;
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

  const truncateQuote = (quote: Quote) => {
    const words = quote.text.split(" ")
    const firstWords = words.slice(0, Math.min(5, Math.max(3, words.length)))
    return `"${firstWords.join(" ")}..."`
  }

  const startScrapingWithSSE = useCallback(async (cellIndex: number) => {
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

      while (true) {
        const { done, value } = await reader.read()

        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))

              if (data.cellId === cellIndex) {
                if (data.stage === 'complete') {
                  // Set the final quote
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
                  console.error('Scraping error:', data.error)
                  setError(`Failed to fetch quote for cell ${cellIndex}: ${data.error}`)

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
    } catch (fetchError) {
      console.error('Fetch error:', fetchError)
      setError(`Network error for cell ${cellIndex}: ${fetchError instanceof Error ? fetchError.message : 'Unknown error'}`)

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
    }
  }, [])

  const startScrapingFallback = useCallback(async (cellIndex: number) => {
    // Fallback method using regular API calls if SSE fails
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
      // Simulate loading stages
      for (let i = 0; i < messages.length; i++) {
        setLoadingMessages((prev) => ({ ...prev, [cellIndex]: messages[i] }))
        const randomDelay = Math.floor(Math.random() * (2400 - 1200 + 1)) + 1200
        await new Promise((resolve) => setTimeout(resolve, randomDelay))
      }

      // Fetch the actual quote using simple scraper
      const response = await fetch('/api/scrape-quote', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ cellId: cellIndex, useSimple: true })
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result = await response.json()

      if (result.success) {
        setCellContent((prev) => ({
          ...prev,
          [cellIndex]: result.quote,
        }))
      } else {
        throw new Error(result.error || 'Unknown error')
      }

    } catch (error) {
      console.error('Scraping error:', error)
      setError(`Failed to fetch quote for cell ${cellIndex}: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
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
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (focusedCell === null) {
        e.preventDefault()
        setFocusedCell(0)
        return
      }

      const currentRow = Math.floor(focusedCell / 3)
      const currentCol = focusedCell % 3

      switch (e.key) {
        case "ArrowUp":
          e.preventDefault()
          if (currentRow > 0) {
            const newFocus = focusedCell - 3
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
          if (currentRow < 99) { // 100 rows total (0-99)
            const newFocus = focusedCell + 3
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
          if (currentCol < 2) {
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
            selectedCells.forEach((cellIndex) => {
              if (!cellContent[cellIndex] && !loadingCells.has(cellIndex)) {
                startScrapingWithSSE(cellIndex)
              }
            })
          } else if (focusedCell !== null) {
            if (!cellContent[focusedCell] && !loadingCells.has(focusedCell)) {
              startScrapingWithSSE(focusedCell)
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
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [focusedCell, selectionStart, selectedCells, cellContent, loadingCells, selectionPath, startScrapingWithSSE, startScrapingFallback])

  return (
    <main className="min-h-screen p-4 sm:p-6 lg:p-8 bg-slate-50">
      <div className="mx-auto max-w-7xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-2">
            Random Quote Fetcher
          </h1>
          <p className="text-slate-600 text-sm sm:text-base">
            Navigate with arrow keys, select with X, fetch quotes with Space
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-800 text-sm">
            <div className="flex items-center justify-between">
              <div>
                <strong className="font-semibold">Error:</strong> {error}
              </div>
              <button
                onClick={() => setError(null)}
                className="text-red-600 hover:text-red-800 transition-colors"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        <div className="flex flex-col xl:flex-row gap-6 lg:gap-8">
          {/* Left section - Actions */}
          <div className="w-full xl:w-72 bg-white border border-slate-200 rounded-xl p-6 shadow-sm order-2 xl:order-1">
            <h2 className="text-lg font-semibold mb-5 text-slate-900">Keyboard Controls</h2>
            <div className="space-y-3 text-sm">
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
              <div className="mt-4 pt-4 border-t border-slate-200">
                <p className="text-xs text-slate-500 leading-relaxed">
                  <span className="font-medium text-slate-700">Live scraping</span> from quotes.toscrape.com.
                  Each fetch retrieves a unique quote with real-time progress updates.
                </p>
              </div>
            </div>
          </div>

          {/* Center section - Grid - FIXED TO 3 COLUMNS */}
          <div className="order-1 xl:order-2 flex-1 flex justify-center overflow-hidden">
            <div className="max-h-[75vh] overflow-y-auto">
              <div className="grid grid-cols-3 gap-3 p-4 w-fit mx-auto">
                {Array.from({ length: 300 }, (_, i) => {
                  const isSelected = selectedCells.has(i)
                  const isFocused = focusedCell === i
                  const isLoading = loadingCells.has(i)
                  const hasContent = cellContent[i]

                  return (
                    <div
                      key={i}
                      className={`w-48 h-20 border-2 rounded-xl flex items-center justify-center font-medium transition-all duration-200 cursor-pointer hover:shadow-md hover:border-slate-300 ${
                        isFocused && !isSelected
                          ? "ring-2 ring-blue-500 bg-blue-50 border-blue-300 shadow-md"
                          : ""
                      } ${
                        isSelected
                          ? "bg-blue-500 text-white border-blue-500 shadow-lg ring-2 ring-blue-300"
                          : "bg-white border-slate-200"
                      }`}
                    >
                      {isLoading ? (
                        <span className={`text-xs animate-pulse px-3 text-center font-normal ${
                          isSelected ? "text-blue-100" : "text-slate-500"
                        }`}>
                          {loadingMessages[i] || "Loading..."}
                        </span>
                      ) : hasContent ? (
                        <span className={`italic text-xs px-3 text-center font-normal leading-tight ${
                          isSelected ? "text-white" : "text-slate-700"
                        }`}>
                          {truncateQuote(hasContent)}
                        </span>
                      ) : (
                        <span className={`text-sm font-normal ${
                          isSelected ? "text-blue-100" : "text-slate-400"
                        }`}>
                          Empty
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Right section - Details */}
          <div className="w-full xl:w-72 bg-white border border-slate-200 rounded-xl p-6 shadow-sm order-3">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-900">Quote Details</h2>
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
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-slate-800 mb-2">Quote</h3>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    &ldquo;{cellContent[focusedCell].text}&rdquo;
                  </p>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-800 mb-1">Author</h3>
                  <p className="text-sm text-slate-600 font-medium">
                    {cellContent[focusedCell].author}
                  </p>
                </div>
                {cellContent[focusedCell].tags.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-slate-800 mb-2">Tags</h3>
                    <div className="flex flex-wrap gap-1.5">
                      {cellContent[focusedCell].tags.map((tag: string, index: number) => (
                        <span
                          key={index}
                          className="px-2.5 py-1 bg-slate-100 text-slate-600 text-xs rounded-full font-medium"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="text-slate-400 text-sm">
                  {focusedCell !== null ? (
                    <>
                      <div className="mb-2">📝</div>
                      <p>This cell is empty</p>
                      <p className="text-xs mt-1">Press Space to fetch a quote</p>
                    </>
                  ) : (
                    <>
                      <div className="mb-2">⌨️</div>
                      <p>Use arrow keys to navigate</p>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Selection info */}
            {selectedCells.size > 0 && (
              <div className="mt-4 pt-4 border-t border-slate-200">
                <p className="text-xs text-slate-500">
                  <span className="font-medium text-slate-700">{selectedCells.size}</span> cells selected
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}