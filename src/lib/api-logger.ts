/**
 * API Request Logger Middleware
 * Automatically logs API requests and responses
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from './logger';

/**
 * Middleware to log API requests
 * Wrap your API route handlers with this function
 */
export function withApiLogger(
  handler: (request: NextRequest, context?: any) => Promise<NextResponse>
) {
  return async (request: NextRequest, context?: any): Promise<NextResponse> => {
    const startTime = Date.now();
    const requestId = logger.generateRequestId();
    const method = request.method;
    const path = request.nextUrl.pathname;
    const searchParams = request.nextUrl.searchParams.toString();
    const fullPath = searchParams ? `${path}?${searchParams}` : path;

    // Log request start
    await logger.debug(`API Request started: ${method} ${fullPath}`, {
      requestId,
      requestPath: fullPath,
      requestMethod: method,
      tags: ['api', 'request'],
      context: {
        headers: Object.fromEntries(request.headers.entries()),
        url: request.url,
      },
    });

    let response: NextResponse;
    let statusCode = 500;
    let error: Error | null = null;

    try {
      // Execute the handler
      response = await handler(request, context);
      statusCode = response.status;

      // Log successful response
      const duration = Date.now() - startTime;
      await logger.logRequest(method, fullPath, statusCode, duration, {
        requestId,
        tags: ['api', 'response'],
        context: {
          duration,
          statusCode,
        },
      });

      // Add request ID to response headers for tracing
      response.headers.set('X-Request-ID', requestId);

      return response;
    } catch (err) {
      error = err instanceof Error ? err : new Error(String(err));
      statusCode = 500;
      const duration = Date.now() - startTime;

      // Log error
      await logger.error(
        `API Request failed: ${method} ${fullPath}`,
        error,
        {
          requestId,
          requestPath: fullPath,
          requestMethod: method,
          severity: 'high',
          tags: ['api', 'error'],
          context: {
            duration,
            statusCode,
          },
        }
      );

      // Return error response
      return NextResponse.json(
        {
          error: 'Internal server error',
          requestId,
        },
        { status: 500 }
      );
    }
  };
}

/**
 * Log API error with context
 */
export async function logApiError(
  error: Error,
  request: NextRequest,
  context?: any
): Promise<void> {
  const path = request.nextUrl.pathname;
  const method = request.method;

  await logger.error(
    `API Error in ${method} ${path}`,
    error,
    {
      requestPath: path,
      requestMethod: method,
      severity: 'high',
      tags: ['api', 'error'],
      context: {
        ...context,
        url: request.url,
      },
    }
  );
}

