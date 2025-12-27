/**
 * Real-time client using Socket.io
 * Connects to the real-time server and manages subscriptions
 */

import { io, Socket } from 'socket.io-client';

interface RealtimeEvent {
  event: 'INSERT' | 'UPDATE' | 'DELETE';
  table: string;
  id: string;
  organization_id: string;
  data: any;
  timestamp: number;
}

type RealtimeCallback = (event: RealtimeEvent) => void;

class RealtimeClient {
  private socket: Socket | null = null;
  private isConnected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private listeners = new Map<string, Set<RealtimeCallback>>();
  private isEnabled = true; // Can be disabled if server is not available

  /**
   * Initialize the real-time client
   */
  async connect(token?: string): Promise<void> {
    // Check if real-time is disabled via environment variable
    if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_REALTIME_DISABLED === 'true') {
      this.isEnabled = false;
      return;
    }

    if (!this.isEnabled) {
      return; // Silently return if disabled
    }

    if (this.socket?.connected) {
      return;
    }

    // Use separate real-time server port if available, otherwise use main app URL
    const realtimePort = process.env.NEXT_PUBLIC_REALTIME_PORT || '3001';
    const realtimeUrl = process.env.NEXT_PUBLIC_REALTIME_URL || 
      (typeof window !== 'undefined' 
        ? `${window.location.protocol}//${window.location.hostname}:${realtimePort}`
        : `http://localhost:${realtimePort}`);
    
    const socketPath = '/socket.io';
    const serverUrl = realtimeUrl;

    this.socket = io(serverUrl, {
      path: socketPath,
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 10000,
      reconnectionAttempts: this.maxReconnectAttempts,
      timeout: 5000,
      auth: token ? { token } : undefined,
      autoConnect: true,
    });

    this.setupEventHandlers();
  }

  /**
   * Setup Socket.io event handlers
   */
  private setupEventHandlers() {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('✓ Real-time client connected');
      this.isConnected = true;
      this.reconnectAttempts = 0;
    });

    this.socket.on('disconnect', (reason) => {
      console.log('Real-time client disconnected:', reason);
      this.isConnected = false;

      if (reason === 'io server disconnect') {
        // Server disconnected, reconnect manually
        this.socket?.connect();
      }
    });

    this.socket.on('connect_error', (error) => {
      if (!this.isEnabled) {
        return; // Don't process errors if already disabled
      }

      this.reconnectAttempts++;

      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.warn('⚠️  Real-time server is not available. Features will work without real-time updates.');
        console.warn('   To enable real-time: npm run dev:realtime');
        // Disable further reconnection attempts
        this.isEnabled = false;
        if (this.socket) {
          this.socket.removeAllListeners();
          this.socket.disconnect();
          this.socket = null;
        }
      } else {
        // Only log first error to avoid spam
        if (this.reconnectAttempts === 1) {
          console.log('Connecting to real-time server...');
        }
      }
    });

    this.socket.on('realtime:update', (event: RealtimeEvent) => {
      // Notify all listeners for this table
      const tableListeners = this.listeners.get(event.table);
      if (tableListeners) {
        tableListeners.forEach((callback) => {
          try {
            callback(event);
          } catch (error) {
            console.error('Error in real-time callback:', error);
          }
        });
      }

      // Also notify listeners for specific channels
      const channelListeners = this.listeners.get(event.table + '_' + event.organization_id);
      if (channelListeners) {
        channelListeners.forEach((callback) => {
          try {
            callback(event);
          } catch (error) {
            console.error('Error in real-time callback:', error);
          }
        });
      }
    });
  }

  /**
   * Subscribe to a table/channel
   */
  subscribe(table: string, callback: RealtimeCallback): () => void {
    if (!this.isEnabled) {
      // Return a no-op unsubscribe function if real-time is disabled
      return () => {};
    }

    if (!this.listeners.has(table)) {
      this.listeners.set(table, new Set());
    }

    this.listeners.get(table)!.add(callback);

    // Request subscription from server
    if (this.socket?.connected) {
      this.socket.emit('subscribe', [table]);
    }

    // Return unsubscribe function
    return () => {
      const listeners = this.listeners.get(table);
      if (listeners) {
        listeners.delete(callback);
        if (listeners.size === 0) {
          this.listeners.delete(table);
          if (this.socket?.connected) {
            this.socket.emit('unsubscribe', [table]);
          }
        }
      }
    };
  }

  /**
   * Subscribe to organization-specific channel
   */
  subscribeToOrganization(
    organizationId: string,
    table: string,
    callback: RealtimeCallback
  ): () => void {
    const channel = `${table}_${organizationId}`;
    return this.subscribe(channel, callback);
  }

  /**
   * Subscribe to user-specific channel
   */
  subscribeToUser(userId: string, table: string, callback: RealtimeCallback): () => void {
    const channel = `user_${userId}_${table}`;
    return this.subscribe(channel, callback);
  }

  /**
   * Subscribe to tenant-specific channel
   */
  subscribeToTenant(tenantId: string, table: string, callback: RealtimeCallback): () => void {
    const channel = `tenant_${tenantId}_${table}`;
    return this.subscribe(channel, callback);
  }

  /**
   * Disconnect the client
   */
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.isConnected = false;
    this.listeners.clear();
  }

  /**
   * Check if client is connected
   */
  get connected(): boolean {
    return this.isConnected && this.socket?.connected === true;
  }
}

// Singleton instance
let realtimeClientInstance: RealtimeClient | null = null;

export function getRealtimeClient(): RealtimeClient {
  if (!realtimeClientInstance) {
    realtimeClientInstance = new RealtimeClient();
  }
  return realtimeClientInstance;
}

export type { RealtimeEvent, RealtimeCallback };
export default RealtimeClient;

