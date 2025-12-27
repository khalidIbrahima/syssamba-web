/**
 * Socket.io route handler for Next.js App Router
 * This route initializes Socket.io when accessed
 */

import { NextRequest } from 'next/server';
import { getRealtimeServer } from '@/lib/realtime-server';

// This is a workaround for Next.js App Router
// Socket.io needs to be initialized differently in App Router
// For now, we'll use a separate process or custom server

export async function GET(req: NextRequest) {
  return new Response(
    JSON.stringify({
      error: 'Socket.io requires a custom HTTP server or separate process',
      message: 'Please use a custom server.js or run the realtime server separately',
    }),
    {
      status: 501,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}

