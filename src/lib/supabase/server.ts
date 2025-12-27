/**
 * Supabase Server Client
 * For use in Server Components and Server Actions
 * Read-only: cannot modify cookies
 */

import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export async function createServerClient() {
  const cookieStore = await cookies();

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      storage: {
        getItem: (key: string) => {
          return cookieStore.get(key)?.value ?? null;
        },
        setItem: () => {
          // Cannot set cookies in Server Components
        },
        removeItem: () => {
          // Cannot remove cookies in Server Components
        },
      },
    },
  });
}

