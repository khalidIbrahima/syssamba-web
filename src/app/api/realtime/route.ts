/**
 * API route for real-time WebSocket connections
 * This route initializes the Socket.io server
 */

import { NextRequest, NextResponse } from 'next/server';
import { getRealtimeServer } from '@/lib/realtime-server';

// This route is used to check if real-time server is available
export async function GET(req: NextRequest) {
  try {
    const server = getRealtimeServer();
    const io = server.getIO();

    if (!io) {
      return NextResponse.json(
        { error: 'Real-time server not initialized' },
        { status: 503 }
      );
    }

    return NextResponse.json({
      status: 'ok',
      message: 'Real-time server is running',
      socketPath: '/api/realtime/socket.io',
    });
  } catch (error: any) {
    console.error('Real-time server error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

