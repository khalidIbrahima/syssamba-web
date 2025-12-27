/**
 * Real-time server using PostgreSQL LISTEN/NOTIFY
 * Listens to database notifications and broadcasts via Socket.io
 */

import { Client } from 'pg';
import { Server as SocketIOServer } from 'socket.io';
import type { Server as HTTPServer } from 'http';

interface RealtimePayload {
  event: 'INSERT' | 'UPDATE' | 'DELETE';
  table: string;
  id: string;
  organization_id: string;
  data: any;
  timestamp: number;
}

interface AuthenticatedSocket {
  userId?: string;
  organizationId?: string;
  tenantId?: string;
}

class RealtimeServer {
  private pgClient: Client | null = null;
  private io: SocketIOServer | null = null;
  private isListening = false;
  private subscribedChannels = new Set<string>();

  /**
   * Initialize the real-time server
   */
  async initialize(server: HTTPServer) {
    // Initialize Socket.io
    const { Server } = await import('socket.io');
    this.io = new Server(server, {
      cors: {
        origin: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
        methods: ['GET', 'POST'],
        credentials: true,
      },
      path: '/api/realtime/socket.io',
    });

    // Initialize PostgreSQL client for LISTEN
    await this.initializePostgreSQL();

    // Setup Socket.io connection handling
    this.setupSocketHandlers();

    console.log('✓ Real-time server initialized');
  }

  /**
   * Initialize PostgreSQL client for LISTEN/NOTIFY
   */
  private async initializePostgreSQL() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL is required for real-time features');
    }

    this.pgClient = new Client({
      connectionString,
    });

    await this.pgClient.connect();
    console.log('✓ PostgreSQL client connected for LISTEN/NOTIFY');

    // Set up notification handler
    this.pgClient.on('notification', (msg) => {
      this.handleNotification(msg);
    });

    // Handle connection errors
    this.pgClient.on('error', (err) => {
      console.error('PostgreSQL LISTEN client error:', err);
      // Attempt to reconnect after delay
      setTimeout(() => this.initializePostgreSQL(), 5000);
    });
  }

  /**
   * Handle PostgreSQL NOTIFY messages
   */
  private handleNotification(msg: { channel: string; payload: string | null }) {
    if (!msg.payload || !this.io) return;

    try {
      const payload: RealtimePayload = JSON.parse(msg.payload);
      const channel = msg.channel;

      // Broadcast to all clients subscribed to this channel
      this.io.to(channel).emit('realtime:update', {
        channel,
        ...payload,
      });

      // Also broadcast to organization-specific room
      if (payload.organization_id) {
        const orgChannel = `${payload.table}_${payload.organization_id}`;
        this.io.to(orgChannel).emit('realtime:update', {
          channel: orgChannel,
          ...payload,
        });
      }

      // Broadcast to user-specific channels for tasks
      if (payload.table === 'tasks' && payload.data) {
        if (payload.data.assigned_to) {
          const userChannel = `user_${payload.data.assigned_to}_tasks`;
          this.io.to(userChannel).emit('realtime:update', {
            channel: userChannel,
            ...payload,
          });
        }
        if (payload.data.created_by) {
          const creatorChannel = `user_${payload.data.created_by}_tasks`;
          this.io.to(creatorChannel).emit('realtime:update', {
            channel: creatorChannel,
            ...payload,
          });
        }
      }

      // Broadcast to tenant-specific channels for messages
      if (payload.table === 'messages' && payload.data?.tenant_id) {
        const tenantChannel = `tenant_${payload.data.tenant_id}_messages`;
        this.io.to(tenantChannel).emit('realtime:update', {
          channel: tenantChannel,
          ...payload,
        });
      }
    } catch (error) {
      console.error('Error parsing notification payload:', error);
    }
  }

  /**
   * Setup Socket.io connection handlers
   */
  private setupSocketHandlers() {
    if (!this.io) return;

    this.io.use(async (socket, next) => {
      try {
        // Extract auth token from handshake
        const token = socket.handshake.auth?.token;

        if (!token) {
          return next(new Error('Authentication required'));
        }

        // Verify token with Supabase
        const { createClient } = await import('@supabase/supabase-js');
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        
        if (!supabaseUrl || !supabaseAnonKey) {
          return next(new Error('Supabase not configured'));
        }

        const supabase = createClient(supabaseUrl, supabaseAnonKey);
        const { data: { user }, error } = await supabase.auth.getUser(token);

        if (error || !user) {
          return next(new Error('Invalid authentication'));
        }

        // Get user and organization info from database
        const { db } = await import('@/lib/db');
        const { users } = await import('@/db/schema');
        const { eq } = await import('drizzle-orm');
        
        const userRecords = await db
          .select()
          .from(users)
          .where(eq(users.id, user.id))
          .limit(1);

        const user = userRecords[0];

        if (!user || !user.organizationId) {
          return next(new Error('User organization not found'));
        }

        // Attach user info to socket
        (socket as any).userId = user.id;
        (socket as any).organizationId = user.organizationId;
        (socket as any).tenantId = user.tenantId || null;

        next();
      } catch (error) {
        console.error('Socket authentication error:', error);
        next(new Error('Authentication failed'));
      }
    });

    this.io.on('connection', (socket) => {
      const authenticatedSocket = socket as any as AuthenticatedSocket;
      const userId = authenticatedSocket.userId;
      const organizationId = authenticatedSocket.organizationId;
      const tenantId = authenticatedSocket.tenantId;

      console.log(`Client connected: ${userId} (org: ${organizationId})`);

      // Subscribe to organization channels
      if (organizationId) {
        const orgChannels = [
          `messages_${organizationId}`,
          `tasks_${organizationId}`,
          `payments_${organizationId}`,
        ];

        orgChannels.forEach((channel) => {
          socket.join(channel);
          this.subscribeToChannel(channel);
        });
      }

      // Subscribe to user-specific channels
      if (userId) {
        const userChannel = `user_${userId}_tasks`;
        socket.join(userChannel);
        this.subscribeToChannel(userChannel);
      }

      // Subscribe to tenant-specific channels
      if (tenantId) {
        const tenantChannel = `tenant_${tenantId}_messages`;
        socket.join(tenantChannel);
        this.subscribeToChannel(tenantChannel);
      }

      // Handle subscription requests
      socket.on('subscribe', (channels: string[]) => {
        channels.forEach((channel) => {
          socket.join(channel);
          this.subscribeToChannel(channel);
        });
      });

      // Handle unsubscription requests
      socket.on('unsubscribe', (channels: string[]) => {
        channels.forEach((channel) => {
          socket.leave(channel);
        });
      });

      // Handle disconnect
      socket.on('disconnect', () => {
        console.log(`Client disconnected: ${userId}`);
      });
    });
  }

  /**
   * Subscribe to a PostgreSQL channel
   */
  private async subscribeToChannel(channel: string) {
    if (!this.pgClient || this.subscribedChannels.has(channel)) {
      return;
    }

    try {
      await this.pgClient.query(`LISTEN "${channel}"`);
      this.subscribedChannels.add(channel);
      console.log(`✓ Subscribed to channel: ${channel}`);
    } catch (error) {
      console.error(`Error subscribing to channel ${channel}:`, error);
    }
  }

  /**
   * Unsubscribe from a PostgreSQL channel
   */
  private async unsubscribeFromChannel(channel: string) {
    if (!this.pgClient || !this.subscribedChannels.has(channel)) {
      return;
    }

    try {
      await this.pgClient.query(`UNLISTEN "${channel}"`);
      this.subscribedChannels.delete(channel);
      console.log(`✓ Unsubscribed from channel: ${channel}`);
    } catch (error) {
      console.error(`Error unsubscribing from channel ${channel}:`, error);
    }
  }

  /**
   * Get Socket.io instance
   */
  getIO(): SocketIOServer | null {
    return this.io;
  }

  /**
   * Cleanup and close connections
   */
  async close() {
    if (this.pgClient) {
      await this.pgClient.end();
      this.pgClient = null;
    }
    if (this.io) {
      this.io.close();
      this.io = null;
    }
    this.subscribedChannels.clear();
    this.isListening = false;
  }
}

// Singleton instance
let realtimeServerInstance: RealtimeServer | null = null;

export function getRealtimeServer(): RealtimeServer {
  if (!realtimeServerInstance) {
    realtimeServerInstance = new RealtimeServer();
  }
  return realtimeServerInstance;
}

export default RealtimeServer;

