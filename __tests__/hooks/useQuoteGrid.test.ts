// __tests__/hooks/useQuoteGrid.test.ts - Minimal working version
import { useQuoteGrid } from '@/hooks/useQuoteGrid';
import { act, renderHook } from '@testing-library/react';

// Mock the ErrorBoundary hook
jest.mock('@/components/ErrorBoundary', () => ({
  useErrorHandler: () => jest.fn(),
}));

describe('useQuoteGrid', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockClear();

    // Mock window dimensions
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1024,
    });
  });

  describe('initialization', () => {
    it('should initialize with default state', () => {
      const { result } = renderHook(() => useQuoteGrid());

      expect(result.current.focusedCell).toBeNull();
      expect(result.current.selectedCells.size).toBe(0);
      expect(result.current.cellContent).toEqual({});
      expect(result.current.loadingCells.size).toBe(0);
      expect(result.current.error).toBeNull();
      expect(result.current.performanceMetrics.totalRequests).toBe(0);
      expect(result.current.columns).toBe(3);
    });
  });

  describe('cell selection', () => {
    it('should handle cell click and selection', () => {
      const { result } = renderHook(() => useQuoteGrid());

      act(() => {
        result.current.handleCellClick(5);
      });

      expect(result.current.focusedCell).toBe(5);
      expect(result.current.selectedCells.has(5)).toBe(true);
    });
  });

  describe('quote truncation', () => {
    it('should truncate long quotes correctly', () => {
      const { result } = renderHook(() => useQuoteGrid());

      const longQuote = {
        text: 'This is a very long quote that should be truncated to show only the first few words',
        author: 'Test Author',
        tags: ['test'],
      };

      const truncated = result.current.truncateQuote(longQuote);

      // Just check it starts with quote and ends with ...
      expect(truncated.startsWith('"This is a very long')).toBe(true);
      expect(truncated.endsWith('..."')).toBe(true);
    });
  });

  describe('performance metrics', () => {
    it('should calculate success rate correctly', () => {
      const { result } = renderHook(() => useQuoteGrid());

      expect(result.current.getSuccessRateClass(95)).toBe('metric-success');
      expect(result.current.getSuccessRateClass(85)).toBe('metric-warning');
      expect(result.current.getSuccessRateClass(75)).toBe('metric-error');
    });
  });

  describe('error handling', () => {
    it('should set and clear error state', () => {
      const { result } = renderHook(() => useQuoteGrid());

      act(() => {
        result.current.setError('Test error');
      });
      expect(result.current.error).toBe('Test error');

      act(() => {
        result.current.setError(null);
      });
      expect(result.current.error).toBeNull();
    });
  });
});