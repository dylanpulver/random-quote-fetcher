import { Quote } from "@/lib/types";
import { useMemo } from "react";

interface QuoteGridCellsProps {
  focusedCell: number | null;
  selectedCells: Set<number>;
  loadingCells: Set<number>;
  cellContent: { [key: number]: Quote };
  loadingMessages: { [key: number]: string };
  columns: number;
  onCellClick: (cellIndex: number) => void;
  truncateQuote: (quote: Quote) => string;
}

export function QuoteGridCells({
  focusedCell,
  selectedCells,
  loadingCells,
  cellContent,
  loadingMessages,
  columns,
  onCellClick,
  truncateQuote,
}: QuoteGridCellsProps) {
  // Memoized grid cells for performance
  const gridCells = useMemo(() => {
    return Array.from({ length: 300 }, (_, i) => {
      const isSelected = selectedCells.has(i);
      const isFocused = focusedCell === i;
      const isLoading = loadingCells.has(i);
      const hasContent = cellContent[i];

      const cellClasses = [
        "grid-cell",
        "min-h-[64px] aspect-[2.5/1] max-w-[200px]",
        "border-2 rounded-lg md:rounded-xl flex items-center justify-center font-medium",
        "cursor-pointer",
        isFocused && !isSelected
          ? "focused ring-2 ring-blue-500 bg-blue-50 border-blue-300 shadow-md"
          : "",
        isSelected
          ? "selected bg-blue-500 text-white border-blue-500 shadow-lg ring-2 ring-blue-300"
          : "bg-white border-slate-200"
      ].filter(Boolean).join(" ");

      return (
        <div
          key={i}
          onClick={() => onCellClick(i)}
          className={cellClasses}
          tabIndex={isFocused ? 0 : -1}
        >
          {isLoading ? (
            <span className={`text-xs loading-shimmer px-2 text-center font-normal ${
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
      );
    });
  }, [
    selectedCells,
    focusedCell,
    loadingCells,
    cellContent,
    loadingMessages,
    truncateQuote,
    onCellClick
  ]);

  return (
    <div className="order-1 lg:order-2 flex-1 flex justify-center overflow-hidden">
      <div className="grid-container max-h-[60vh] md:max-h-[70vh] lg:max-h-[75vh] overflow-y-auto w-full">
        <div className="p-2 sm:p-4 max-w-none">
          <div
            className={`grid gap-2 sm:gap-3 mx-auto w-fit max-w-full ${
              columns === 2 ? 'grid-cols-2' : 'grid-cols-3'
            }`}
            style={{
              gridTemplateColumns: columns === 2
                ? 'repeat(2, minmax(120px, 1fr))'
                : 'repeat(3, minmax(140px, 1fr))'
            }}
          >
            {gridCells}
          </div>
        </div>
      </div>
    </div>
  );
}