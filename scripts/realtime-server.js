/**
 * Standalone real-time server for development
 * Run this in a separate process: node scripts/realtime-server.js
 */

const { Client } = require('pg');
const { Server } = require('socket.io');
const http = require('http');
const { createClient } = require('@clerk/backend');

const PORT = process.env.REALTIME_PORT || 3001;
const DATABASE_URL = process.env.DATABASE_URL;
const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY;

if (!DATABASE_URL) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}

// Create HTTP server
const server = http.createServer();
const io = new Server(server, {
  cors: {
    origin: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true,
  },
  path: '/socket.io',
});

// PostgreSQL client for LISTEN
const pgClient = new Client({
  connectionString: DATABASE_URL,
});

const subscribedChannels = new Set();

// Initialize PostgreSQL connection
async function initializePostgreSQL() {
  try {
    await pgClient.connect();
    console.log('✓ PostgreSQL client connected for LISTEN/NOTIFY');

    // Handle notifications
    pgClient.on('notification', (msg) => {
      try {
        const payload = JSON.parse(msg.payload);
        const channel = msg.channel;

        // Broadcast to all clients in the channel
        io.to(channel).emit('realtime:update', {
          channel,
          ...payload,
        });

        // Also broadcast to organization-specific room
        if (payload.organization_id) {
          const orgChannel = `${payload.table}_${payload.organization_id}`;
          io.to(orgChannel).emit('realtime:update', {
            channel: orgChannel,
            ...payload,
          });
        }

        // User-specific channels for tasks
        if (payload.table === 'tasks' && payload.data) {
          if (payload.data.assigned_to) {
            const userChannel = `user_${payload.data.assigned_to}_tasks`;
            io.to(userChannel).emit('realtime:update', {
              channel: userChannel,
              ...payload,
            });
          }
          if (payload.data.created_by) {
            const creatorChannel = `user_${payload.data.created_by}_tasks`;
            io.to(creatorChannel).emit('realtime:update', {
              channel: creatorChannel,
              ...payload,
            });
          }
        }

        // Tenant-specific channels for messages
        if (payload.table === 'messages' && payload.data?.tenant_id) {
          const tenantChannel = `tenant_${payload.data.tenant_id}_messages`;
          io.to(tenantChannel).emit('realtime:update', {
            channel: tenantChannel,
            ...payload,
          });
        }
      } catch (error) {
        console.error('Error parsing notification payload:', error);
      }
    });

    // Handle connection errors
    pgClient.on('error', (err) => {
      console.error('PostgreSQL LISTEN client error:', err);
      setTimeout(() => initializePostgreSQL(), 5000);
    });
  } catch (error) {
    console.error('Error initializing PostgreSQL:', error);
    setTimeout(() => initializePostgreSQL(), 5000);
  }
}

// Socket.io authentication middleware
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token;

    if (!token) {
      return next(new Error('Authentication required'));
    }

    // Verify token with Clerk
    if (CLERK_SECRET_KEY && createClient) {
      try {
        const clerkClient = createClient({ secretKey: CLERK_SECRET_KEY });
        const session = await clerkClient.verifyToken(token);

        if (!session || !session.sub) {
          return next(new Error('Invalid authentication'));
        }

        // Get user from database
        const userQuery = await pgClient.query(
          'SELECT id, organization_id, tenant_id FROM users WHERE id = $1 OR sb_user_id = $1 LIMIT 1',
          [session.sub]
        );

        const user = userQuery.rows[0];

        if (!user || !user.organization_id) {
          return next(new Error('User organization not found'));
        }

        socket.userId = user.id;
        socket.organizationId = user.organization_id;
        socket.tenantId = user.tenant_id || null;
      } catch (error) {
        console.error('Clerk authentication error:', error);
        return next(new Error('Authentication failed'));
      }
    } else {
      // Development mode: accept any token
      console.warn('⚠️  Running in development mode without Clerk authentication');
      socket.userId = 'dev-user';
      socket.organizationId = 'dev-org';
    }

    next();
  } catch (error) {
    console.error('Socket authentication error:', error);
    next(new Error('Authentication failed'));
  }
});

// Socket.io connection handler
io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.userId} (org: ${socket.organizationId})`);

  // Subscribe to organization channels
  if (socket.organizationId) {
    const orgChannels = [
      `messages_${socket.organizationId}`,
      `tasks_${socket.organizationId}`,
      `payments_${socket.organizationId}`,
    ];

    orgChannels.forEach((channel) => {
      socket.join(channel);
      subscribeToChannel(channel);
    });
  }

  // Subscribe to user-specific channels
  if (socket.userId) {
    const userChannel = `user_${socket.userId}_tasks`;
    socket.join(userChannel);
    subscribeToChannel(userChannel);
  }

  // Subscribe to tenant-specific channels
  if (socket.tenantId) {
    const tenantChannel = `tenant_${socket.tenantId}_messages`;
    socket.join(tenantChannel);
    subscribeToChannel(tenantChannel);
  }

  // Handle subscription requests
  socket.on('subscribe', (channels) => {
    channels.forEach((channel) => {
      socket.join(channel);
      subscribeToChannel(channel);
    });
  });

  // Handle unsubscription requests
  socket.on('unsubscribe', (channels) => {
    channels.forEach((channel) => {
      socket.leave(channel);
    });
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.userId}`);
  });
});

// Subscribe to PostgreSQL channel
async function subscribeToChannel(channel) {
  if (subscribedChannels.has(channel)) {
    return;
  }

  try {
    await pgClient.query(`LISTEN "${channel}"`);
    subscribedChannels.add(channel);
    console.log(`✓ Subscribed to channel: ${channel}`);
  } catch (error) {
    console.error(`Error subscribing to channel ${channel}:`, error);
  }
}

// Start server
async function start() {
  await initializePostgreSQL();
  
  server.listen(PORT, () => {
    console.log(`✓ Real-time server running on port ${PORT}`);
    console.log(`  Socket.io path: /socket.io`);
    console.log(`  Connect from: ${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}`);
  });
}

// Handle shutdown
process.on('SIGTERM', async () => {
  console.log('Shutting down real-time server...');
  await pgClient.end();
  io.close();
  server.close();
  process.exit(0);
});

start().catch((error) => {
  console.error('Failed to start real-time server:', error);
  process.exit(1);
});

