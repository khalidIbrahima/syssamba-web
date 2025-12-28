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
  });
}

