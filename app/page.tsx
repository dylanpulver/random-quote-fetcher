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

      const selectPath = (start: number, end: number) => {
        const newSet = new Set(selectedCells)
        newSet.add(end)
        setSelectedCells(newSet)
      }

      switch (e.key) {
        case "ArrowUp":
          e.preventDefault()
          if (currentRow > 0) {
            const newFocus = focusedCell - 3
            setFocusedCell(newFocus)
            if (e.shiftKey) {
              if (selectionStart === null) {
                setSelectionStart(focusedCell)
                setSelectedCells(new Set([focusedCell]))
              }
              selectPath(selectionStart!, newFocus)
            } else {
              setSelectionStart(null)
            }
          }
          break
        case "ArrowDown":
          e.preventDefault()
          if (currentRow < 99) {
            const newFocus = focusedCell + 3
            setFocusedCell(newFocus)
            if (e.shiftKey) {
              if (selectionStart === null) {
                setSelectionStart(focusedCell)
                setSelectedCells(new Set([focusedCell]))
              }
              selectPath(selectionStart!, newFocus)
            } else {
              setSelectionStart(null)
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
                setSelectedCells(new Set([focusedCell]))
              }
              selectPath(selectionStart!, newFocus)
            } else {
              setSelectionStart(null)
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
                setSelectedCells(new Set([focusedCell]))
              }
              selectPath(selectionStart!, newFocus)
            } else {
              setSelectionStart(null)
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
          setError(null)
          break
        case "a":
        case "A":
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault()
            const allCells = new Set(Array.from({ length: 300 }, (_, i) => i))
            setSelectedCells(allCells)
            setSelectionStart(null)
          }
          break
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [focusedCell, selectionStart, selectedCells, cellContent, loadingCells, startScrapingWithSSE, startScrapingFallback])

  return (
    <main className="min-h-screen p-4 sm:p-8 bg-background">
      <div className="mx-auto w-fit max-w-7xl">
        <h1 className="text-2xl sm:text-3xl font-bold text-center mb-6 sm:mb-8 text-foreground">
          Random Quote Fetcher
        </h1>

        {error && (
          <div className="mb-4 p-4 bg-red-100 border border-red-300 rounded-lg text-red-700 text-sm">
            <strong>Error:</strong> {error}
            <button
              onClick={() => setError(null)}
              className="ml-2 text-red-500 hover:text-red-700"
            >
              ✕
            </button>
          </div>
        )}

        <div className="flex flex-col lg:flex-row gap-6 lg:gap-8 items-start">
          {/* Left section - Actions */}
          <div className="w-full lg:w-64 bg-card border border-border rounded-lg p-4 order-2 lg:order-1">
            <h2 className="text-lg font-semibold mb-4 text-card-foreground">Actions</h2>
            <div className="space-y-2 text-sm text-muted-foreground">
              <div>
                <span className="font-medium text-card-foreground">Arrow Keys:</span> focus cells
              </div>
              <div>
                <span className="font-medium text-card-foreground">X Key:</span> select cells
              </div>
              <div>
                <span className="font-medium text-card-foreground">Shift + Arrow Keys:</span> Bulk select cells
              </div>
              <div>
                <span className="font-medium text-card-foreground">Space:</span> fetch quote on focused or selected
                cells
              </div>
              <div>
                <span className="font-medium text-card-foreground">Esc:</span> clear selected cells
              </div>
              <div>
                <span className="font-medium text-card-foreground">Ctrl + A:</span> select all cells
              </div>
              <div className="mt-3 pt-2 border-t border-border">
                <p className="text-xs">
                  <span className="font-medium text-card-foreground">Note:</span> Real-time scraping from quotes.toscrape.com.
                  Each fetch gets a unique quote. Loading shows actual scraping progress.
                </p>
              </div>
            </div>
          </div>

          {/* Center section - Grid */}
          <div className="order-1 lg:order-2 flex-shrink-0">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-[70vh] overflow-y-auto">
              {Array.from({ length: 300 }, (_, i) => (
                <div
                  key={i}
                  className={`w-full sm:w-48 lg:w-52 h-16 bg-card border border-border rounded-lg flex items-center justify-center text-card-foreground font-medium transition-colors ${
                    focusedCell === i ? "ring-2 ring-primary bg-accent text-accent-foreground" : ""
                  } ${selectedCells.has(i) ? "bg-primary text-primary-foreground" : ""}`}
                >
                  {loadingCells.has(i) ? (
                    <span className="text-sm text-muted-foreground animate-pulse px-2 text-center">
                      {loadingMessages[i] || "Loading..."}
                    </span>
                  ) : cellContent[i] ? (
                    <span className="italic text-sm px-2 text-center">{truncateQuote(cellContent[i])}</span>
                  ) : (
                    "Empty"
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Right section - Details */}
          <div className="w-full lg:w-64 bg-white border border-border rounded-lg p-4 flex-shrink-0 order-3">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-foreground">Details</h2>
              {focusedCell !== null && cellContent[focusedCell]?.sourceUrl && (
                <a
                  href={cellContent[focusedCell].sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-foreground transition-colors"
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
              <div className="space-y-3">
                <div>
                  <h3 className="text-sm font-medium text-foreground mb-2">Full Quote:</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{cellContent[focusedCell].text}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-foreground mb-1">Author:</h3>
                  <p className="text-sm text-muted-foreground">{cellContent[focusedCell].author}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-foreground mb-1">Tags:</h3>
                  <div className="flex flex-wrap gap-1">
                    {cellContent[focusedCell].tags.map((tag: string, index: number) => (
                      <span key={index} className="px-2 py-1 bg-muted text-muted-foreground text-xs rounded-md">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">
                {focusedCell !== null ? "Cell is empty" : "Press arrow keys to start navigating"}
              </p>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}