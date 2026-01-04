/**
 * Check plans table schema in Supabase database
 * Uses credentials from .env.local to connect directly
 */

import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables from .env.local
dotenv.config({ path: resolve(process.cwd(), '.env.local') });

// Get database connection string
function getDatabaseUrl(): string {
  // Priority 1: Direct DATABASE_URL
  if (process.env.DATABASE_URL) {
    // Check if URL is complete (has password)
    const url = process.env.DATABASE_URL;
    if (url.includes('://') && url.includes('@')) {
      return url;
    }
    console.warn('⚠️  DATABASE_URL appears incomplete, trying other methods...');
  }

  // Priority 2: Supabase DB URL
  if (process.env.SUPABASE_DB_URL) {
    return process.env.SUPABASE_DB_URL;
  }

  // Priority 3: Construct from individual components
  const host = process.env.DB_HOST || process.env.POSTGRES_HOST;
  const port = process.env.DB_PORT || process.env.POSTGRES_PORT || '5432';
  const database = process.env.DB_NAME || process.env.POSTGRES_DB || 'postgres';
  const user = process.env.DB_USER || process.env.POSTGRES_USER || 'postgres';
  const password = process.env.DB_PASSWORD || process.env.POSTGRES_PASSWORD;

  if (!host) {
    throw new Error(
      'Database connection not configured. Please set one of:\n' +
      '  - DATABASE_URL (complete: postgresql://user:password@host:port/db)\n' +
      '  - SUPABASE_DB_URL\n' +
      '  - DB_HOST + DB_PASSWORD (or POSTGRES_HOST + POSTGRES_PASSWORD)\n' +
      'in .env.local'
    );
  }

  if (!password) {
    throw new Error(
      'Database password not found. Please set:\n' +
      '  - DB_PASSWORD or POSTGRES_PASSWORD\n' +
      'in .env.local'
    );
  }

  // URL encode password to handle special characters
  const encodedPassword = encodeURIComponent(password);
  return `postgresql://${user}:${encodedPassword}@${host}:${port}/${database}`;
}

async function checkPlansSchema() {
  console.log('🔍 Checking plans table schema in Supabase...\n');

  const connectionString = getDatabaseUrl();
  
  // Mask password in connection string for logging
  const maskedUrl = connectionString.replace(/:([^:@]+)@/, ':***@');
  console.log(`📡 Connecting to: ${maskedUrl}\n`);

  const pool = new Pool({
    connectionString,
    max: 1, // Only need one connection for this check
  });

  try {
    // Check if plans table exists
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'plans'
      );
    `);

    if (!tableCheck.rows[0].exists) {
      console.error('❌ Plans table does not exist!');
      return;
    }

    console.log('✅ Plans table exists\n');

    // Get all columns in the plans table
    const columns = await pool.query(`
      SELECT 
        column_name,
        data_type,
        character_maximum_length,
        is_nullable,
        column_default,
        udt_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = 'plans'
      ORDER BY ordinal_position;
    `);

    console.log('📋 Columns in plans table:');
    console.log('─'.repeat(100));
    console.log(
      'Column Name'.padEnd(30) +
      'Type'.padEnd(25) +
      'Nullable'.padEnd(12) +
      'Default'.padEnd(20)
    );
    console.log('─'.repeat(100));

    const columnNames: string[] = [];
    for (const col of columns.rows) {
      const name = col.column_name;
      const type = col.udt_name === 'jsonb' ? 'jsonb' : 
                   col.udt_name === 'numeric' ? `decimal(${col.character_maximum_length || ''})` :
                   col.data_type;
      const nullable = col.is_nullable === 'YES' ? 'YES' : 'NO';
      const defaultValue = col.column_default || '';

      columnNames.push(name);
      console.log(
        name.padEnd(30) +
        type.padEnd(25) +
        nullable.padEnd(12) +
        defaultValue.substring(0, 20).padEnd(20)
      );
    }

    console.log('─'.repeat(100));
    console.log(`\nTotal columns: ${columns.rows.length}\n`);

    // Check for expected columns
    const expectedColumns = [
      'id',
      'name',
      'display_name',
      'price',
      'price_type',
      'lots_limit',
      'users_limit',
      'extranet_tenants_limit',
      'features',
      'support_level',
      'is_active',
      'sort_order',
      'created_at',
      'updated_at',
      'description',
    ];

    console.log('🔎 Checking for expected columns:\n');
    const missingColumns: string[] = [];
    const extraColumns: string[] = [];

    for (const expected of expectedColumns) {
      if (columnNames.includes(expected)) {
        console.log(`  ✅ ${expected}`);
      } else {
        console.log(`  ❌ ${expected} - MISSING`);
        missingColumns.push(expected);
      }
    }

    // Check for extra columns
    for (const actual of columnNames) {
      if (!expectedColumns.includes(actual)) {
        extraColumns.push(actual);
      }
    }

    if (extraColumns.length > 0) {
      console.log('\n📌 Extra columns found (not in expected list):');
      extraColumns.forEach(col => console.log(`  ℹ️  ${col}`));
    }

    if (missingColumns.length > 0) {
      console.log(`\n⚠️  Missing columns: ${missingColumns.join(', ')}`);
      console.log('\n💡 Run the migration script to add missing columns:');
      console.log('   init-db/75-add-extranet-tenants-limit-to-plans.sql\n');
    } else {
      console.log('\n✅ All expected columns are present!\n');
    }

    // Get sample data count
    const countResult = await pool.query('SELECT COUNT(*) as count FROM plans');
    console.log(`📊 Total plans in database: ${countResult.rows[0].count}\n`);

    // Get a sample plan to see actual structure
    const sampleResult = await pool.query(`
      SELECT * FROM plans LIMIT 1
    `);

    if (sampleResult.rows.length > 0) {
      console.log('📄 Sample plan structure:');
      console.log(JSON.stringify(sampleResult.rows[0], null, 2));
    }

  } catch (error: any) {
    console.error('❌ Error checking schema:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.error('\n💡 Connection refused. Check:');
      console.error('   - Database is running');
      console.error('   - Connection string is correct');
      console.error('   - Firewall/network settings');
    } else if (error.code === '28P01') {
      console.error('\n💡 Authentication failed. Check:');
      console.error('   - Database password is correct');
      console.error('   - User has proper permissions');
    }
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run the check
checkPlansSchema()
  .then(() => {
    console.log('\n✨ Schema check complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

