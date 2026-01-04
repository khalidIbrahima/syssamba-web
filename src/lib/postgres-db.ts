/**
 * Direct PostgreSQL database connection
 * Uses credentials from .env.local to bypass PostgREST schema cache issues
 */

import { Pool, Client } from 'pg';

// Get database connection string from environment
const getDatabaseUrl = (): string => {
  // Priority 1: Direct DATABASE_URL
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }

  // Priority 2: Construct from individual components
  const host = process.env.DB_HOST || process.env.POSTGRES_HOST || 'localhost';
  const port = process.env.DB_PORT || process.env.POSTGRES_PORT || '5432';
  const database = process.env.DB_NAME || process.env.POSTGRES_DB || 'sambaone';
  const user = process.env.DB_USER || process.env.POSTGRES_USER || 'postgres';
  const password = process.env.DB_PASSWORD || process.env.POSTGRES_PASSWORD || '';

  if (!password) {
    throw new Error(
      'Database password not found. Please set DB_PASSWORD or POSTGRES_PASSWORD in .env.local'
    );
  }

  return `postgresql://${user}:${password}@${host}:${port}/${database}`;
};

// Create a connection pool for better performance
let pool: Pool | null = null;

const getPool = (): Pool => {
  if (!pool) {
    const connectionString = getDatabaseUrl();
    
    pool = new Pool({
      connectionString,
      max: 20, // Maximum number of clients in the pool
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000, // Increased timeout
    });

    // Handle pool errors
    pool.on('error', (err) => {
      console.error('Unexpected error on idle client', err);
    });
  }

  return pool;
};

// Check if database connection is available
export async function isDatabaseAvailable(): Promise<boolean> {
  try {
    const testPool = new Pool({
      connectionString: getDatabaseUrl(),
      max: 1,
      connectionTimeoutMillis: 3000,
    });
    const client = await testPool.connect();
    await client.query('SELECT 1');
    client.release();
    await testPool.end();
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Execute a query and return results
 */
export async function query<T = any>(
  text: string,
  params?: any[]
): Promise<T[]> {
  const client = getPool();
  const result = await client.query(text, params);
  return result.rows as T[];
}

/**
 * Execute a query and return a single row
 */
export async function queryOne<T = any>(
  text: string,
  params?: any[]
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] || null;
}

/**
 * Execute a query that doesn't return results (INSERT, UPDATE, DELETE)
 */
export async function execute(
  text: string,
  params?: any[]
): Promise<{ rowCount: number }> {
  const client = getPool();
  const result = await client.query(text, params);
  return { rowCount: result.rowCount || 0 };
}

/**
 * Get all plans from database
 */
export async function getPlans() {
  const sql = `
    SELECT 
      id,
      name,
      display_name,
      description,
      price_monthly,
      price_yearly,
      max_properties as lots_limit,
      max_users as users_limit,
      max_tenants,
      extranet_tenants_limit,
      features,
      is_active,
      is_default,
      sort_order,
      created_at,
      updated_at
    FROM plans
    ORDER BY sort_order ASC, name ASC
  `;

  return query(sql);
}

/**
 * Get a single plan by ID
 */
export async function getPlanById(id: string) {
  const sql = `
    SELECT 
      id,
      name,
      display_name,
      description,
      price_monthly,
      price_yearly,
      max_properties as lots_limit,
      max_users as users_limit,
      max_tenants,
      extranet_tenants_limit,
      features,
      is_active,
      is_default,
      sort_order,
      created_at,
      updated_at
    FROM plans
    WHERE id = $1
  `;

  return queryOne(sql, [id]);
}

/**
 * Update a plan
 */
export async function updatePlan(
  id: string,
  updates: {
    display_name?: string;
    description?: string | null;
    price_monthly?: number | null;
    price_yearly?: number | null;
    lots_limit?: number | null;
    users_limit?: number | null;
    extranet_tenants_limit?: number | null;
    features?: any;
    is_active?: boolean;
    sort_order?: number | null;
  }
): Promise<any> {
  // Build dynamic UPDATE query
  // Map expected fields to actual database columns
  const setClauses: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  if (updates.display_name !== undefined) {
    setClauses.push(`display_name = $${paramIndex++}`);
    values.push(updates.display_name);
  }
  if (updates.description !== undefined) {
    setClauses.push(`description = $${paramIndex++}`);
    values.push(updates.description);
  }
  if (updates.price_monthly !== undefined) {
    setClauses.push(`price_monthly = $${paramIndex++}`);
    values.push(updates.price_monthly);
  }
  if (updates.price_yearly !== undefined) {
    setClauses.push(`price_yearly = $${paramIndex++}`);
    values.push(updates.price_yearly);
  }
  // Map lots_limit to max_properties
  if (updates.lots_limit !== undefined) {
    setClauses.push(`max_properties = $${paramIndex++}`);
    values.push(updates.lots_limit);
  }
  // Map users_limit to max_users
  if (updates.users_limit !== undefined) {
    setClauses.push(`max_users = $${paramIndex++}`);
    values.push(updates.users_limit);
  }
  if (updates.extranet_tenants_limit !== undefined) {
    setClauses.push(`extranet_tenants_limit = $${paramIndex++}`);
    values.push(updates.extranet_tenants_limit);
  }
  if (updates.features !== undefined) {
    setClauses.push(`features = $${paramIndex++}`);
    values.push(JSON.stringify(updates.features));
  }
  if (updates.is_active !== undefined) {
    setClauses.push(`is_active = $${paramIndex++}`);
    values.push(updates.is_active);
  }
  if (updates.sort_order !== undefined) {
    setClauses.push(`sort_order = $${paramIndex++}`);
    values.push(updates.sort_order);
  }

  // Always update updated_at
  setClauses.push(`updated_at = NOW()`);

  if (setClauses.length === 0) {
    throw new Error('No updates provided');
  }

  // Add id to values for WHERE clause
  values.push(id);

  const sql = `
    UPDATE plans
    SET ${setClauses.join(', ')}
    WHERE id = $${paramIndex}
    RETURNING *
  `;

  return queryOne(sql, values);
}

/**
 * Close the connection pool (useful for cleanup)
 */
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

