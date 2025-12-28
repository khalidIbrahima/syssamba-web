/**
 * Supabase Client Client
 * For use in Client Components
 * Uses localStorage for session persistence
 */

'use client';

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export function createClientClient() {
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      storage: typeof window !== 'undefined' ? window.localStorage : undefined,
      autoRefreshToken: true,
      persistSession: true,
      // Add flow type to reduce unnecessary calls
      flowType: 'pkce',
    },
    global: {
      headers: {
        'x-client-info': 'samba-one-web@1.0.0',
      },
    },
    // Configure fetch options with rate limiting protection
    fetch: (url: RequestInfo | URL, options: RequestInit = {}) => {
      return fetch(url, {
        ...options,
        // Add timeout to prevent hanging requests
        signal: AbortSignal.timeout(15000), // 15 second timeout (reduced)
      }).catch((error) => {
        // Handle network errors gracefully
        if (error.name === 'AbortError') {
          console.warn('[Supabase] Request timed out');
        } else if (error.code === 'ECONNRESET') {
          console.warn('[Supabase] Connection reset');
        } else if (error.message?.includes('rate limit')) {
          console.warn('[Supabase] Rate limit reached, slowing down...');
          // Add delay before retry
          return new Promise((resolve, reject) => {
            setTimeout(() => {
              fetch(url, options).then(resolve).catch(reject);
            }, 2000); // 2 second delay
          });
        }
        throw error;
      });
    },
  });
}

