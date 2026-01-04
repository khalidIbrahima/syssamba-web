/**
 * System Logger
 * Centralized logging system that stores logs in Supabase
 * Can be enabled/disabled via environment variable
 */

import { db } from './db';
import { getCurrentUser } from './auth-helpers';

export type LogLevel = 'error' | 'warn' | 'info' | 'debug' | 'critical';

export interface LogContext {
  [key: string]: any;
}

export interface LogOptions {
  level?: LogLevel;
  context?: LogContext;
  error?: Error;
  requestPath?: string;
  requestMethod?: string;
  requestId?: string;
  sourceFile?: string;
  sourceFunction?: string;
  sourceLine?: number;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  tags?: string[];
  organizationId?: string;
  userId?: string;
  metadata?: LogContext;
}

class Logger {
  private isEnabled: boolean;
  private environment: string;

  constructor() {
    // Check if logging is enabled via environment variable
    this.isEnabled = process.env.ENABLE_SYSTEM_LOGGING === 'true';
    this.environment = process.env.NODE_ENV || 'development';
  }

  /**
   * Check if logging is enabled
   */
  isLoggingEnabled(): boolean {
    return this.isEnabled;
  }

  /**
   * Generate a unique request ID
   */
  generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Extract error details from Error object
   */
  private extractErrorDetails(error: Error): {
    name: string;
    message: string;
    stack?: string;
    cause?: any;
  } {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      cause: (error as any).cause,
    };
  }

  /**
   * Get current user ID (async)
   */
  private async getCurrentUserId(): Promise<string | null> {
    try {
      const user = await getCurrentUser();
      return user?.id || null;
    } catch {
      return null;
    }
  }

  /**
   * Log an event to Supabase
   */
  async log(message: string, options: LogOptions = {}): Promise<void> {
    // If logging is disabled, only log to console in development
    if (!this.isEnabled) {
      if (this.environment === 'development') {
        const level = options.level || 'info';
        const consoleMethod = level === 'error' || level === 'critical' ? 'error' :
                             level === 'warn' ? 'warn' : 'log';
        console[consoleMethod](`[${level.toUpperCase()}] ${message}`, options.context || {});
      }
      return;
    }

    try {
      const level = options.level || 'info';
      const userId = options.userId || (await this.getCurrentUserId());

      // Extract error details if error is provided
      let errorDetails = null;
      let stackTrace = null;
      if (options.error) {
        const errorInfo = this.extractErrorDetails(options.error);
        errorDetails = {
          name: errorInfo.name,
          message: errorInfo.message,
          cause: errorInfo.cause,
        };
        stackTrace = errorInfo.stack || null;
      }

      // Build log entry
      const logEntry: any = {
        level,
        message,
        context: options.context || {},
        error_details: errorDetails,
        stack_trace: stackTrace,
        user_id: userId || null,
        organization_id: options.organizationId || null,
        request_path: options.requestPath || null,
        request_method: options.requestMethod || null,
        request_id: options.requestId || null,
        source_file: options.sourceFile || null,
        source_function: options.sourceFunction || null,
        source_line: options.sourceLine || null,
        environment: this.environment,
        severity: options.severity || this.getDefaultSeverity(level),
        tags: options.tags || [],
        metadata: options.metadata || {},
        status: 'open',
      };

      // Insert into database
      await db.insertOne('system_logs', logEntry);

      // Also log to console in development
      if (this.environment === 'development') {
        const consoleMethod = level === 'error' || level === 'critical' ? 'error' :
                             level === 'warn' ? 'warn' : 'log';
        console[consoleMethod](`[${level.toUpperCase()}] ${message}`, {
          ...options.context,
          error: options.error?.message,
        });
      }
    } catch (error) {
      // Fallback to console if database logging fails
      console.error('Failed to log to database:', error);
      console.error(`[${options.level?.toUpperCase() || 'ERROR'}] ${message}`, options.context || {});
    }
  }

  /**
   * Get default severity based on log level
   */
  private getDefaultSeverity(level: LogLevel): 'low' | 'medium' | 'high' | 'critical' {
    switch (level) {
      case 'critical':
        return 'critical';
      case 'error':
        return 'high';
      case 'warn':
        return 'medium';
      case 'info':
      case 'debug':
      default:
        return 'low';
    }
  }

  /**
   * Log an error
   */
  async error(message: string, error?: Error, options: Omit<LogOptions, 'level' | 'error'> = {}): Promise<void> {
    await this.log(message, {
      ...options,
      level: 'error',
      error,
    });
  }

  /**
   * Log a warning
   */
  async warn(message: string, options: Omit<LogOptions, 'level'> = {}): Promise<void> {
    await this.log(message, {
      ...options,
      level: 'warn',
    });
  }

  /**
   * Log an info message
   */
  async info(message: string, options: Omit<LogOptions, 'level'> = {}): Promise<void> {
    await this.log(message, {
      ...options,
      level: 'info',
    });
  }

  /**
   * Log a debug message
   */
  async debug(message: string, options: Omit<LogOptions, 'level'> = {}): Promise<void> {
    await this.log(message, {
      ...options,
      level: 'debug',
    });
  }

  /**
   * Log a critical error
   */
  async critical(message: string, error?: Error, options: Omit<LogOptions, 'level' | 'error'> = {}): Promise<void> {
    await this.log(message, {
      ...options,
      level: 'critical',
      error,
      severity: 'critical',
    });
  }

  /**
   * Log API request
   */
  async logRequest(
    method: string,
    path: string,
    statusCode: number,
    duration: number,
    options: Omit<LogOptions, 'requestPath' | 'requestMethod'> = {}
  ): Promise<void> {
    const level = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';
    await this.log(`API ${method} ${path} - ${statusCode} (${duration}ms)`, {
      ...options,
      level,
      requestPath: path,
      requestMethod: method,
      context: {
        ...options.context,
        statusCode,
        duration,
      },
    });
  }

  /**
   * Log database operation
   */
  async logDatabase(
    operation: string,
    table: string,
    success: boolean,
    options: Omit<LogOptions, 'level'> = {}
  ): Promise<void> {
    const level = success ? 'debug' : 'error';
    await this.log(`Database ${operation} on ${table}`, {
      ...options,
      level,
      context: {
        ...options.context,
        operation,
        table,
        success,
      },
      tags: [...(options.tags || []), 'database'],
    });
  }
}

// Export singleton instance
export const logger = new Logger();

// Export convenience functions
export const logError = (message: string, error?: Error, options?: Omit<LogOptions, 'level' | 'error'>) =>
  logger.error(message, error, options);

export const logWarn = (message: string, options?: Omit<LogOptions, 'level'>) =>
  logger.warn(message, options);

export const logInfo = (message: string, options?: Omit<LogOptions, 'level'>) =>
  logger.info(message, options);

export const logDebug = (message: string, options?: Omit<LogOptions, 'level'>) =>
  logger.debug(message, options);

export const logCritical = (message: string, error?: Error, options?: Omit<LogOptions, 'level' | 'error'>) =>
  logger.critical(message, error, options);

