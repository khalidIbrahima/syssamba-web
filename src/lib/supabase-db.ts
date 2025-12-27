/**
 * Supabase database helper utility
 * Provides a clean interface for database operations using Supabase client
 */

import { createClient } from '@supabase/supabase-js';

// Get Supabase URL and service role key from environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL environment variable is not set');
}

if (!supabaseServiceKey) {
  console.warn('⚠️  SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY not set. Using anon key (may have RLS restrictions).');
}

// Create Supabase client with service role key for server-side operations
// This bypasses RLS (Row Level Security) for server-side operations
// If service role key is not available, falls back to anon key (may have RLS restrictions)
export const supabaseAdmin = createClient(
  supabaseUrl,
  supabaseServiceKey || '',
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

/**
 * Generic query helpers
 */
export class SupabaseDB {
  /**
   * Select records from a table
   */
  static async select<T = any>(
    table: string,
    options: {
      columns?: string;
      filter?: Record<string, any>;
      eq?: Record<string, any>;
      in?: Record<string, any[]>;
      orderBy?: { column: string; ascending?: boolean };
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<T[]> {
    if (!table || table.trim() === '') {
      throw new Error('Table name must be a non-empty string');
    }

    let query = supabaseAdmin.from(table).select(options.columns || '*');

    // Apply filters
    if (options.eq) {
      Object.entries(options.eq).forEach(([key, value]) => {
        query = query.eq(key, value);
      });
    }

    if (options.in) {
      Object.entries(options.in).forEach(([key, values]) => {
        query = query.in(key, values);
      });
    }

    if (options.filter) {
      Object.entries(options.filter).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          query = query.eq(key, value);
        }
      });
    }

    // Apply ordering
    if (options.orderBy) {
      query = query.order(options.orderBy.column, {
        ascending: options.orderBy.ascending !== false,
      });
    }

    // Apply limit and offset
    if (options.limit) {
      query = query.limit(options.limit);
    }

    if (options.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 10) - 1);
    }

    const { data, error } = await query;

    if (error) {
      console.error(`Error selecting from ${table}:`, {
        message: error.message || 'Unknown error',
        details: error.details || 'No details',
        hint: error.hint || 'No hint',
        code: error.code || 'No code',
        fullError: error
      });
      throw error;
    }

    return (data || []) as T[];
  }

  /**
   * Select a single record
   */
  static async selectOne<T = any>(
    table: string,
    options: {
      columns?: string;
      filter?: Record<string, any>;
      eq?: Record<string, any>;
    } = {}
  ): Promise<T | null> {
    const results = await this.select<T>(table, { ...options, limit: 1 });
    return results[0] || null;
  }

  /**
   * Insert a record
   */
  static async insert<T = any>(
    table: string,
    values: Record<string, any> | Record<string, any>[]
  ): Promise<T[]> {
    if (!table || table.trim() === '') {
      throw new Error('Table name must be a non-empty string');
    }

    const { data, error } = await supabaseAdmin
      .from(table)
      .insert(Array.isArray(values) ? values : [values])
      .select();

    if (error) {
      console.error(`Error inserting into ${table}:`, error);
      throw error;
    }

    return (data || []) as T[];
  }

  /**
   * Insert a single record and return it
   */
  static async insertOne<T = any>(
    table: string,
    values: Record<string, any>
  ): Promise<T | null> {
    const results = await this.insert<T>(table, values);
    return results[0] || null;
  }

  /**
   * Update records
   */
  static async update<T = any>(
    table: string,
    values: Record<string, any>,
    filter: Record<string, any>
  ): Promise<T[]> {
    if (!table || table.trim() === '') {
      throw new Error('Table name must be a non-empty string');
    }

    if (!values || Object.keys(values).length === 0) {
      throw new Error('Update values cannot be empty');
    }

    if (!filter || Object.keys(filter).length === 0) {
      throw new Error('Filter cannot be empty for update operations');
    }

    let query = supabaseAdmin.from(table).update(values);

    // Apply filters
    Object.entries(filter).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        query = query.eq(key, value);
      }
    });

    const { data, error, count } = await query.select();

    if (error) {
      console.error(`Error updating ${table}:`, error);
      console.error('Update values:', JSON.stringify(values, null, 2));
      console.error('Filter:', JSON.stringify(filter, null, 2));
      throw error;
    }

    // If no rows were updated, return empty array
    if (!data || data.length === 0) {
      console.warn(`No rows updated in ${table} with filter:`, filter);
      return [] as T[];
    }

    return data as T[];
  }

  /**
   * Update a single record
   */
  static async updateOne<T = any>(
    table: string,
    values: Record<string, any>,
    filter: Record<string, any>
  ): Promise<T | null> {
    const results = await this.update<T>(table, values, filter);
    return results[0] || null;
  }

  /**
   * Delete records
   */
  static async delete(
    table: string,
    filter: Record<string, any>
  ): Promise<void> {
    if (!table || table.trim() === '') {
      throw new Error('Table name must be a non-empty string');
    }

    let query = supabaseAdmin.from(table).delete();

    // Apply filters
    Object.entries(filter).forEach(([key, value]) => {
      query = query.eq(key, value);
    });

    const { error } = await query;

    if (error) {
      console.error(`Error deleting from ${table}:`, error);
      throw error;
    }
  }

  /**
   * Delete a single record (alias for delete)
   */
  static async deleteOne(
    table: string,
    filter: Record<string, any>
  ): Promise<void> {
    return this.delete(table, filter);
  }

  /**
   * Count records
   */
  static async count(
    table: string,
    filter?: Record<string, any>
  ): Promise<number> {
    let query = supabaseAdmin.from(table).select('*', { count: 'exact', head: true });

    // Apply filters
    if (filter) {
      Object.entries(filter).forEach(([key, value]) => {
        query = query.eq(key, value);
      });
    }

    const { count, error } = await query;

    if (error) {
      console.error(`Error counting ${table}:`, error);
      throw error;
    }

    return count || 0;
  }

  /**
   * Execute a raw SQL query (for complex queries)
   * Note: This requires RPC functions or direct SQL access
   */
  static async rpc(functionName: string, params?: Record<string, any>): Promise<any> {
    const { data, error } = await supabaseAdmin.rpc(functionName, params || {});

    if (error) {
      console.error(`Error calling RPC ${functionName}:`, error);
      throw error;
    }

    return data;
  }

  /**
   * Select with joins using Supabase PostgREST syntax
   * Example: selectWithJoin('payments', 'tenant_id,tenant:tenants(*),unit:units(*,property:properties(*))')
   */
  static async selectWithJoin<T = any>(
    table: string,
    selectQuery: string, // PostgREST select syntax
    options: {
      filter?: Record<string, any>;
      eq?: Record<string, any>;
      orderBy?: { column: string; ascending?: boolean };
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<T[]> {
    let query = supabaseAdmin.from(table).select(selectQuery);

    // Apply filters
    if (options.eq) {
      Object.entries(options.eq).forEach(([key, value]) => {
        query = query.eq(key, value);
      });
    }

    if (options.filter) {
      Object.entries(options.filter).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          query = query.eq(key, value);
        }
      });
    }

    // Apply ordering
    if (options.orderBy) {
      query = query.order(options.orderBy.column, {
        ascending: options.orderBy.ascending !== false,
      });
    }

    // Apply limit and offset
    if (options.limit) {
      query = query.limit(options.limit);
    }

    if (options.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 10) - 1);
    }

    const { data, error } = await query;

    if (error) {
      console.error(`Error selecting with join from ${table}:`, error);
      throw error;
    }

    return (data || []) as T[];
  }
}

