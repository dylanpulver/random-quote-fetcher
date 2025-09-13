"use client";

/**
 * Performance monitoring component for development
 * Tracks page load times and memory usage
 */
export function PerformanceMonitor() {
  // Only render in development
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `
          (function() {
            if (typeof window !== 'undefined' && window.performance) {
              window.addEventListener('load', function() {
                setTimeout(function() {
                  const timing = window.performance.timing;
                  const loadTime = timing.loadEventEnd - timing.navigationStart;

                  console.group('🚀 Performance Metrics');
                  console.log('Page load time:', loadTime + 'ms');

                  // Navigation timing breakdown
                  const dns = timing.domainLookupEnd - timing.domainLookupStart;
                  const connect = timing.connectEnd - timing.connectStart;
                  const response = timing.responseEnd - timing.responseStart;
                  const dom = timing.domContentLoadedEventEnd - timing.domLoading;

                  console.log('DNS lookup:', dns + 'ms');
                  console.log('Connection:', connect + 'ms');
                  console.log('Response:', response + 'ms');
                  console.log('DOM processing:', dom + 'ms');

                  // Memory usage if available
                  if (window.performance.memory) {
                    const memory = window.performance.memory;
                    console.log('Memory usage:', {
                      used: Math.round(memory.usedJSHeapSize / 1024 / 1024) + 'MB',
                      total: Math.round(memory.totalJSHeapSize / 1024 / 1024) + 'MB',
                      limit: Math.round(memory.jsHeapSizeLimit / 1024 / 1024) + 'MB'
                    });
                  }

                  // Resource timing summary
                  const resources = window.performance.getEntriesByType('resource');
                  const resourceStats = resources.reduce((acc, resource) => {
                    const type = resource.initiatorType || 'other';
                    acc[type] = (acc[type] || 0) + 1;
                    return acc;
                  }, {});

                  console.log('Resources loaded:', resourceStats);
                  console.groupEnd();

                  // Warn about slow performance
                  if (loadTime > 3000) {
                    console.warn('⚠️ Slow page load detected:', loadTime + 'ms');
                  }
                }, 0);
              });

              // Monitor long tasks (performance issues)
              if ('PerformanceObserver' in window) {
                try {
                  const observer = new PerformanceObserver((list) => {
                    list.getEntries().forEach((entry) => {
                      if (entry.duration > 50) {
                        console.warn('🐌 Long task detected:', entry.duration + 'ms', entry);
                      }
                    });
                  });
                  observer.observe({ entryTypes: ['longtask'] });
                } catch (e) {
                  // PerformanceObserver might not be fully supported
                }
              }
            }
          })();
        `,
      }}
    />
  );
}