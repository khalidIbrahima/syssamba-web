# System Logging Documentation

## Overview

The system includes a comprehensive logging system that tracks all issues, errors, warnings, and informational events in Supabase. Logging can be enabled or disabled via environment variables depending on the environment.

## Features

- **Centralized Logging**: All logs are stored in Supabase `system_logs` table
- **Environment-based Control**: Enable/disable logging via environment variable
- **Multiple Log Levels**: error, warn, info, debug, critical
- **Request Tracing**: Unique request IDs for tracing requests across services
- **Error Details**: Automatic capture of stack traces and error context
- **User Context**: Automatic association with users and organizations
- **Tagging System**: Tag logs for easy filtering and grouping
- **Severity Levels**: Prioritize issues with severity levels (low, medium, high, critical)
- **Status Tracking**: Track log status (open, investigating, resolved, ignored)

## Setup

### 1. Database Schema

Run the SQL migration to create the `system_logs` table:

```sql
-- Run this in your Supabase SQL Editor
\i init-db/62-create-system-logs-table.sql
```

Or execute the SQL file directly in Supabase.

### 2. Environment Variables

Add the following to your `.env.local` file:

```env
# Enable/disable system logging
# Set to 'true' to enable logging to Supabase
# Set to 'false' or leave unset to disable (logs only to console in development)
ENABLE_SYSTEM_LOGGING=true
```

**Environment-specific recommendations:**
- **Development**: `ENABLE_SYSTEM_LOGGING=false` (or unset) - logs only to console
- **Staging**: `ENABLE_SYSTEM_LOGGING=true` - logs to Supabase for testing
- **Production**: `ENABLE_SYSTEM_LOGGING=true` - logs to Supabase for monitoring

## Usage

### Basic Logging

```typescript
import { logger, logError, logWarn, logInfo, logDebug, logCritical } from '@/lib/logger';

// Log an error
await logger.error('Failed to process payment', error, {
  context: { paymentId: 'pay_123' },
  tags: ['payment', 'billing'],
  severity: 'high',
});

// Or use convenience functions
await logError('User authentication failed', error, {
  requestPath: '/api/auth/login',
  tags: ['auth', 'security'],
});

// Log a warning
await logWarn('Rate limit approaching', {
  context: { currentUsage: 90, limit: 100 },
  tags: ['rate-limit'],
});

// Log info
await logInfo('User logged in successfully', {
  userId: user.id,
  tags: ['auth', 'user'],
});

// Log debug (only in development)
await logDebug('Processing request', {
  requestId: 'req_123',
  tags: ['debug'],
});

// Log critical error
await logCritical('Database connection lost', error, {
  severity: 'critical',
  tags: ['database', 'critical'],
});
```

### API Route Logging

Wrap your API route handlers with the logger middleware:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { withApiLogger } from '@/lib/api-logger';
import { logger } from '@/lib/logger';

async function handler(request: NextRequest) {
  // Your API logic here
  const data = await fetchData();
  
  return NextResponse.json({ data });
}

// Export with logging middleware
export const GET = withApiLogger(handler);
export const POST = withApiLogger(handler);
```

### Manual Error Logging in API Routes

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { logApiError } from '@/lib/api-logger';

export async function POST(request: NextRequest) {
  try {
    // Your logic
    return NextResponse.json({ success: true });
  } catch (error) {
    // Log the error
    await logApiError(error as Error, request, {
      context: { additionalInfo: 'value' },
    });
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

### Logging Database Operations

```typescript
import { logger } from '@/lib/logger';

try {
  const result = await db.select('users', { id: userId });
  await logger.logDatabase('select', 'users', true, {
    context: { userId },
    tags: ['database', 'users'],
  });
} catch (error) {
  await logger.logDatabase('select', 'users', false, {
    error: error as Error,
    context: { userId },
    tags: ['database', 'users', 'error'],
  });
}
```

## Log Levels

- **critical**: Critical system errors that require immediate attention
- **error**: Errors that need investigation but don't stop the system
- **warn**: Warnings about potential issues
- **info**: Informational messages about normal operations
- **debug**: Debug information (only logged in development)

## Log Structure

Each log entry contains:

- `level`: Log level (error, warn, info, debug, critical)
- `message`: Human-readable message
- `context`: Additional context data (JSONB)
- `error_details`: Error information for error-level logs (JSONB)
- `stack_trace`: Stack trace for errors
- `user_id`: Associated user (if available)
- `organization_id`: Associated organization (if available)
- `request_path`: API path (for API requests)
- `request_method`: HTTP method (for API requests)
- `request_id`: Unique request identifier for tracing
- `source_file`: Source file where log was created
- `source_function`: Function name where log was created
- `source_line`: Line number where log was created
- `environment`: Environment (development, staging, production)
- `severity`: Severity level (low, medium, high, critical)
- `tags`: Array of tags for filtering
- `metadata`: Additional metadata (JSONB)
- `status`: Status (open, investigating, resolved, ignored)
- `created_at`: Timestamp

## Querying Logs

### Get all errors

```sql
SELECT * FROM system_logs 
WHERE level = 'error' 
ORDER BY created_at DESC 
LIMIT 100;
```

### Get critical issues

```sql
SELECT * FROM system_logs 
WHERE severity = 'critical' 
AND status = 'open'
ORDER BY created_at DESC;
```

### Get logs by tag

```sql
SELECT * FROM system_logs 
WHERE 'payment' = ANY(tags)
ORDER BY created_at DESC;
```

### Get logs for a specific user

```sql
SELECT * FROM system_logs 
WHERE user_id = 'user-uuid-here'
ORDER BY created_at DESC;
```

### Get logs for a specific request

```sql
SELECT * FROM system_logs 
WHERE request_id = 'req_1234567890_abc123'
ORDER BY created_at ASC;
```

### Search logs by message

```sql
SELECT * FROM system_logs 
WHERE to_tsvector('french', message) @@ to_tsquery('french', 'payment')
ORDER BY created_at DESC;
```

## Log Management

### Resolve a log entry

```sql
UPDATE system_logs 
SET status = 'resolved',
    resolved_at = NOW(),
    resolved_by = 'user-uuid-here'
WHERE id = 'log-uuid-here';
```

### Clean up old logs

The system includes a function to clean up old resolved logs:

```sql
-- Delete resolved info/debug logs older than 90 days
SELECT cleanup_old_logs(90);
```

## Best Practices

1. **Use appropriate log levels**: Use error for actual errors, warn for warnings, info for normal operations
2. **Add context**: Include relevant context data to help with debugging
3. **Use tags**: Tag logs for easy filtering and grouping
4. **Set severity**: Set appropriate severity levels for prioritization
5. **Don't log sensitive data**: Never log passwords, tokens, or other sensitive information
6. **Use request IDs**: Include request IDs for tracing requests across services
7. **Resolve logs**: Mark logs as resolved when issues are fixed

## Monitoring

Set up alerts in Supabase or use external monitoring tools to track:
- Error rates
- Critical issues
- Unresolved logs
- Log volume

## Disabling Logging

To disable logging, set `ENABLE_SYSTEM_LOGGING=false` in your `.env.local` file or leave it unset. When disabled:
- Logs are only written to console in development
- No database writes occur
- Performance impact is minimal

