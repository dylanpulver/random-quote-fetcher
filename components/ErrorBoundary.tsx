"use client"

import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  resetKeys?: Array<string | number>; // Reset when these change
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorId: string | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    // Generate unique error ID for tracking
    const errorId = `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    return {
      hasError: true,
      error,
      errorInfo: null,
      errorId
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Enhanced logging with error ID
    console.group(`🚨 ErrorBoundary [${this.state.errorId}]`);
    console.error('Error:', error);
    console.error('Component Stack:', errorInfo.componentStack);
    console.groupEnd();

    // Update state with error info
    this.setState({
      error,
      errorInfo
    });

    // Call optional error handler
    if (this.props.onError) {
      try {
        this.props.onError(error, errorInfo);
      } catch (handlerError) {
        console.error('Error in error handler:', handlerError);
      }
    }

    // Report to error service in production
    if (process.env.NODE_ENV === 'production') {
      this.reportError();
    }
  }

  componentDidUpdate(prevProps: Props) {
    const { resetKeys } = this.props;
    const { hasError } = this.state;

    // Reset error boundary if resetKeys changed
    if (hasError && resetKeys && prevProps.resetKeys) {
      const hasResetKeyChanged = resetKeys.some(
        (key, index) => prevProps.resetKeys![index] !== key
      );

      if (hasResetKeyChanged) {
        console.log(`🔄 Resetting ErrorBoundary due to resetKeys change [${this.state.errorId}]`);
        this.handleRetry();
      }
    }
  }

  private reportError = () => {
    // In production, send to error monitoring service
    // Example: Sentry.captureException(this.state.error, { contexts: { react: this.state.errorInfo } });
    console.info('Error reported to monitoring service:', this.state.errorId);
  };

  handleRetry = () => {
    console.log(`🔄 Manual retry triggered [${this.state.errorId}]`);
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null
    });
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI with improvements
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
          <div className="max-w-md w-full bg-white border border-red-200 rounded-xl p-6 shadow-lg">
            <div className="text-center">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>

              <h2 className="text-lg font-semibold text-slate-900 mb-2">
                Something went wrong
              </h2>

              <p className="text-sm text-slate-600 mb-4">
                The application encountered an unexpected error. This might be due to high load or a temporary issue.
              </p>

              <div className="space-y-3">
                <button
                  onClick={this.handleRetry}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                >
                  Try Again
                </button>

                <button
                  onClick={() => window.location.reload()}
                  className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium py-2 px-4 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2"
                >
                  Reload Page
                </button>
              </div>

              {/* Error ID for support */}
              {this.state.errorId && (
                <p className="text-xs text-slate-400 mt-4">
                  Error ID: {this.state.errorId}
                </p>
              )}

              {/* Development error details */}
              {process.env.NODE_ENV === 'development' && this.state.error && (
                <details className="mt-4 text-left">
                  <summary className="text-xs text-slate-500 cursor-pointer hover:text-slate-700">
                    Error Details (Development)
                  </summary>
                  <div className="mt-2 p-2 bg-slate-50 rounded text-xs text-slate-600 overflow-auto max-h-32">
                    <div className="font-medium mb-1">Error:</div>
                    <div className="mb-2 font-mono">{this.state.error.message}</div>
                    {this.state.error.stack && (
                      <>
                        <div className="font-medium mb-1">Stack Trace:</div>
                        <pre className="whitespace-pre-wrap text-xs mb-2 font-mono">
                          {this.state.error.stack}
                        </pre>
                      </>
                    )}
                    {this.state.errorInfo && (
                      <>
                        <div className="font-medium mb-1">Component Stack:</div>
                        <pre className="whitespace-pre-wrap text-xs font-mono">
                          {this.state.errorInfo.componentStack}
                        </pre>
                      </>
                    )}
                  </div>
                </details>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Enhanced hook for functional components to trigger error boundaries
export const useErrorHandler = () => {
  const [error, setError] = React.useState<Error | null>(null);

  const throwError = React.useCallback((error: Error) => {
    console.log('🎯 Programmatically throwing error:', error.message);
    setError(() => {
      throw error;
    });
  }, []);

  React.useEffect(() => {
    if (error) {
      throw error;
    }
  }, [error]);

  return throwError;
};

// Enhanced GridErrorBoundary with better fallback
export const GridErrorBoundary: React.FC<{ children: ReactNode }> = ({ children }) => {
  return (
    <ErrorBoundary
      fallback={
        <div className="flex-1 flex items-center justify-center p-8 bg-slate-50 rounded-xl border-2 border-dashed border-slate-300">
          <div className="text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Grid Unavailable</h3>
            <p className="text-sm text-slate-600 mb-4 max-w-sm">
              The quote grid encountered an error and couldn&apos;t load. This might happen during high-load operations with many concurrent requests.
            </p>
            <div className="space-y-2">
              <button
                onClick={() => window.location.reload()}
                className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                Reload Grid
              </button>
              <p className="text-xs text-slate-500">
                💡 Try reducing concurrent requests if this persists
              </p>
            </div>
          </div>
        </div>
      }
      onError={(error, errorInfo) => {
        console.error('📋 Grid error:', error, errorInfo);
        // Could send to error reporting service here
      }}
      resetKeys={[]} // Reset when grid data changes
    >
      {children}
    </ErrorBoundary>
  );
};

// Enhanced APIErrorBoundary
export const APIErrorBoundary: React.FC<{ children: ReactNode }> = ({ children }) => {
  return (
    <ErrorBoundary
      fallback={
        <div className="w-full p-4 bg-red-50 border border-red-200 rounded-xl mb-4">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01" />
              </svg>
            </div>
            <div className="ml-3 flex-1">
              <h3 className="text-sm font-medium text-red-800">Connection Issue</h3>
              <p className="mt-1 text-xs text-red-700">
                Failed to communicate with the server. Please check your connection and try refreshing the page.
              </p>
              <div className="mt-3">
                <button
                  onClick={() => window.location.reload()}
                  className="text-xs bg-red-100 hover:bg-red-200 text-red-800 px-3 py-1 rounded transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                >
                  Refresh Page
                </button>
              </div>
            </div>
          </div>
        </div>
      }
      onError={(error, errorInfo) => {
        console.error('🌐 API error:', error, errorInfo);
        // Could send to error reporting service here
      }}
    >
      {children}
    </ErrorBoundary>
  );
};

// Utility: Error boundary that auto-resets after timeout
export const AutoResetErrorBoundary: React.FC<{
  children: ReactNode;
  resetDelay?: number;
}> = ({ children, resetDelay = 5000 }) => {
  const [resetKey, setResetKey] = React.useState(0);

  const handleError = React.useCallback(() => {
    console.log(`⏰ Auto-reset scheduled in ${resetDelay}ms`);
    setTimeout(() => {
      setResetKey(prev => prev + 1);
    }, resetDelay);
  }, [resetDelay]);

  return (
    <ErrorBoundary
      key={resetKey}
      fallback={
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-center">
          <div className="text-yellow-600 mb-2">⚠️ Temporary Error</div>
          <div className="text-sm text-yellow-700">
            Automatically retrying in {resetDelay / 1000} seconds...
          </div>
        </div>
      }
      onError={handleError}
    >
      {children}
    </ErrorBoundary>
  );
};