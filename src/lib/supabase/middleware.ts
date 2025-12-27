/**
 * Supabase Middleware Client
 * For use in Next.js Middleware
 * Read-only: cannot modify cookies
 */

import { createClient } from '@supabase/supabase-js';
import { NextRequest } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export function createMiddlewareClient(req: NextRequest) {
  // Create a map of cookies for fast lookup
  const cookieMap = new Map<string, string>();
  req.cookies.getAll().forEach((cookie) => {
    cookieMap.set(cookie.name, cookie.value);
  });

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      storage: {
        getItem: (key: string) => {
          return cookieMap.get(key) ?? null;
        },
        setItem: () => {
          // Cannot set cookies in middleware
        },
        removeItem: () => {
          // Cannot remove cookies in middleware
        },
      },
    },
  });
}

