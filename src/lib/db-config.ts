/**
 * Supabase database configuration
 * This application uses Supabase exclusively for all database operations
 */

/**
 * Get the Supabase database connection string
 */
export function getDatabaseUrl(): string {
  // Priority 1: SUPABASE_DB_URL (explicit Supabase connection)
  const supabaseDbUrl = process.env.SUPABASE_DB_URL;
  if (supabaseDbUrl) {
    return supabaseDbUrl;
  }

  // Priority 2: DATABASE_URL (should contain Supabase connection string)
  const rawDatabaseUrl = process.env.DATABASE_URL || '';
  
  // Clean the connection string if it contains the variable name
  const connectionString = rawDatabaseUrl.includes('DATABASE_URL=')
    ? rawDatabaseUrl.split('DATABASE_URL=')[1]?.trim() || rawDatabaseUrl
    : rawDatabaseUrl;
  
  if (connectionString) {
    return connectionString;
  }
  
  // If nothing is set, throw an error
  throw new Error(
    'DATABASE_URL or SUPABASE_DB_URL environment variable is not set.\n' +
    'Please set one of these to your Supabase connection string:\n' +
    '  - DATABASE_URL=postgresql://postgres:[PASSWORD]@db.xxxxx.supabase.co:5432/postgres\n' +
    '  - SUPABASE_DB_URL=postgresql://postgres:[PASSWORD]@db.xxxxx.supabase.co:5432/postgres\n\n' +
    'You can find your connection string in Supabase: Settings > Database > Connection string > URI'
  );
}

/**
 * Get database configuration info for logging
 */
export function getDatabaseInfo() {
  const url = getDatabaseUrl();
  
  // Mask password in URL for logging
  const maskedUrl = url.replace(/:([^:@]+)@/, ':****@');
  
  return {
    provider: 'supabase' as const,
    url: maskedUrl,
    isSupabase: true,
  };
}
