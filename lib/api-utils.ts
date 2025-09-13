import { NextRequest, NextResponse } from 'next/server';

/**
 * API utility functions shared across route handlers
 */

// ========================================
// Request parsing utilities
// ========================================

/**
 * Safely parse JSON from request body
 */
export async function parseRequestBody(request: NextRequest): Promise<Record<string, unknown>> {
  try {
    return await request.json();
  } catch {
    throw new Error('Invalid JSON in request body');
  }
}

// ========================================
// Validation utilities
// ========================================

/**
 * Validate that cellId is a valid grid cell number (0-299)
 */
export function isValidCellId(cellId: unknown): cellId is number {
  return typeof cellId === 'number' &&
         Number.isInteger(cellId) &&
         cellId >= 0 &&
         cellId < 300;
}

/**
 * Validate request has required fields
 */
export function validateRequiredFields(
  data: Record<string, unknown>,
  requiredFields: string[]
): string[] {
  return requiredFields.filter(field => !(field in data) || data[field] === undefined);
}

// ========================================
// Response utilities
// ========================================

/**
 * Create standardized error response
 */
export function createErrorResponse(
  message: string,
  status: number,
  additionalData?: Record<string, unknown>
): NextResponse {
  return NextResponse.json(
    {
      error: message,
      timestamp: new Date().toISOString(),
      status,
      ...additionalData
    },
    { status }
  );
}

/**
 * Create standardized success response
 */
export function createSuccessResponse(
  data: Record<string, unknown>,
  additionalData?: Record<string, unknown>
): NextResponse {
  return NextResponse.json({
    success: true,
    timestamp: new Date().toISOString(),
    ...data,
    ...additionalData
  });
}

/**
 * Create plain text error response (for SSE endpoints)
 */
export function createPlainErrorResponse(message: string, status: number): Response {
  return new Response(message, {
    status,
    headers: {
      'Content-Type': 'text/plain',
    }
  });
}

// ========================================
// SSE utilities
// ========================================

/**
 * Create SSE response headers
 */
export function createSSEHeaders(): Headers {
  return new Headers({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control'
  });
}

/**
 * Format data for SSE transmission
 */
export function formatSSEMessage(data: Record<string, unknown>): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

// ========================================
// Logging utilities
// ========================================

/**
 * Standardized API logging
 */
export class APILogger {
  private prefix: string;

  constructor(prefix: string) {
    this.prefix = prefix;
  }

  info(message: string, ...args: unknown[]): void {
    console.log(`[${this.prefix}] ${message}`, ...args);
  }

  error(message: string, error?: unknown, ...args: unknown[]): void {
    console.error(`[${this.prefix}] ${message}`, error, ...args);
  }

  warn(message: string, ...args: unknown[]): void {
    console.warn(`[${this.prefix}] ${message}`, ...args);
  }

  debug(message: string, ...args: unknown[]): void {
    if (process.env.NODE_ENV === 'development') {
      console.debug(`[${this.prefix}] ${message}`, ...args);
    }
  }
}

// ========================================
// Performance utilities
// ========================================

/**
 * Performance timer for tracking request duration
 */
export class PerformanceTimer {
  private startTime: number;
  private label: string;

  constructor(label: string) {
    this.startTime = Date.now();
    this.label = label;
  }

  /**
   * Get elapsed time in milliseconds
   */
  elapsed(): number {
    return Date.now() - this.startTime;
  }

  /**
   * Log completion time
   */
  complete(logger?: APILogger): number {
    const duration = this.elapsed();
    const message = `${this.label} completed in ${duration}ms`;

    if (logger) {
      logger.info(message);
    } else {
      console.log(message);
    }

    return duration;
  }
}

// ========================================
// Constants
// ========================================

export const API_CONSTANTS = {
  MAX_CELL_ID: 299,
  MIN_CELL_ID: 0,
  REQUEST_TIMEOUT: 30000, // 30 seconds
  SSE_KEEP_ALIVE_INTERVAL: 30000, // 30 seconds
} as const;