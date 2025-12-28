/**
 * Supabase Route Handler Client
 * For use in API Routes (Route Handlers)
 * Can read and write cookies
 */

import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export async function createRouteHandlerClient(request?: NextRequest) {
  const cookieStore = await cookies();

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      storage: {
        getItem: (key: string) => {
          return cookieStore.get(key)?.value ?? null;
        },
        setItem: (key: string, value: string) => {
          cookieStore.set(key, value, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 60 * 60 * 24 * 7, // 7 days
            path: '/',
          });
        },
        removeItem: (key: string) => {
          cookieStore.delete(key);
        },
      },
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
        signal: AbortSignal.timeout(10000), // 10 second timeout (reduced)
      }).catch((error) => {
        // Handle network errors gracefully
        if (error.name === 'AbortError') {
          console.warn('[Supabase] Request timed out');
        } else if (error.code === 'ECONNRESET') {
          console.warn('[Supabase] Connection reset');
        }
        throw error;
      });
    },
  });
}

