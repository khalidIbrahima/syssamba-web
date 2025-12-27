/**
 * Supabase database connection
 * All database operations use Supabase exclusively
 */

import { supabaseAdmin, SupabaseDB } from './supabase-db';

// Log Supabase configuration (only in development)
if (process.env.NODE_ENV === 'development') {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'Not configured';
  console.log(`📊 Database: SUPABASE (${supabaseUrl})`);
}

// Create a proxy to use SupabaseDB static methods as instance methods
// This allows using db.selectOne() instead of SupabaseDB.selectOne()
const db = new Proxy({} as typeof SupabaseDB, {
  get(_target, prop: string | symbol) {
    if (typeof prop === 'string' && prop in SupabaseDB) {
      const method = (SupabaseDB as any)[prop];
      if (typeof method === 'function') {
        return method.bind(SupabaseDB);
      }
      return method;
    }
    return undefined;
  },
});

// Export Supabase client and DB helper
export { supabaseAdmin, db };
