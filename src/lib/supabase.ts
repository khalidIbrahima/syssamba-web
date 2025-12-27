/**
 * Supabase client for real-time features
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Get Supabase URL and anon key from environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('⚠️  Supabase environment variables not set. Real-time features will be disabled.');
  console.warn('   Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY');
}

// Create Supabase client (singleton)
export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey, {
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
      auth: {
        storage: typeof window !== 'undefined' ? window.localStorage : undefined,
        autoRefreshToken: false, // Disable auto refresh since we use Clerk
        persistSession: false, // Don't persist session since we use Clerk
      },
    })
  : null;

// Cache for authenticated clients (keyed by token)
const authenticatedClientsCache = new Map<string, SupabaseClient>();

/**
 * Get authenticated Supabase client with user token
 * Uses a cache to avoid creating multiple instances with the same token
 */
export async function getAuthenticatedSupabase(token: string): Promise<SupabaseClient | null> {
  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  // Check cache first
  if (authenticatedClientsCache.has(token)) {
    return authenticatedClientsCache.get(token)!;
  }

  // Create new client with unique storage key to avoid conflicts
  const client = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
    auth: {
      storage: typeof window !== 'undefined' ? window.localStorage : undefined,
      autoRefreshToken: false, // Disable auto refresh since we use Clerk
      persistSession: false, // Don't persist session since we use Clerk
      storageKey: `supabase-auth-token-${token.substring(0, 10)}`, // Unique storage key per token
    },
  });

  // Cache the client (limit cache size to prevent memory leaks)
  if (authenticatedClientsCache.size > 10) {
    // Remove oldest entry (simple FIFO)
    const firstKey = authenticatedClientsCache.keys().next().value;
    authenticatedClientsCache.delete(firstKey);
  }
  authenticatedClientsCache.set(token, client);

  return client;
}

