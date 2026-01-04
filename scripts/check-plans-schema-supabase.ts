/**
 * Check plans table schema using Supabase client
 * Uses credentials from .env.local
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables from .env.local
dotenv.config({ path: resolve(process.cwd(), '.env.local') });

async function checkPlansSchema() {
  console.log('🔍 Checking plans table schema via Supabase API...\n');

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL not found in .env.local');
  }

  if (!supabaseKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY not found in .env.local');
  }

  console.log(`📡 Connecting to Supabase: ${supabaseUrl}\n`);

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // Get all plans to see the structure
    const { data: plans, error: plansError } = await supabase
      .from('plans')
      .select('*')
      .limit(1);

    if (plansError) {
      if (plansError.code === 'PGRST116') {
        console.error('❌ Plans table does not exist!');
        return;
      }
      throw plansError;
    }

    if (!plans || plans.length === 0) {
      console.log('⚠️  Plans table exists but is empty\n');
      // Try to get schema info via RPC or information_schema
      const { data: schemaInfo, error: schemaError } = await supabase.rpc('get_table_columns', {
        table_name: 'plans'
      }).catch(() => ({ data: null, error: { message: 'RPC not available' } }));

      if (!schemaError && schemaInfo) {
        console.log('📋 Columns:', schemaInfo);
      }
      return;
    }

    console.log('✅ Plans table exists and has data\n');
    console.log('📋 Columns found in plans table:');
    console.log('─'.repeat(80));

    const samplePlan = plans[0];
    const columnNames = Object.keys(samplePlan);

    columnNames.forEach((col, index) => {
      const value = samplePlan[col];
      const type = value === null ? 'null' :
                   Array.isArray(value) ? 'array' :
                   typeof value;
      const preview = typeof value === 'string' && value.length > 30 
        ? value.substring(0, 30) + '...' 
        : String(value);

      console.log(
        `${(index + 1).toString().padStart(2)}. ${col.padEnd(30)} (${type.padEnd(10)}) ${preview.substring(0, 40)}`
      );
    });

    console.log('─'.repeat(80));
    console.log(`\nTotal columns: ${columnNames.length}\n`);

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

    // Get total count
    const { count } = await supabase
      .from('plans')
      .select('*', { count: 'exact', head: true });

    console.log(`📊 Total plans in database: ${count || 0}\n`);

    // Show full sample
    console.log('📄 Sample plan structure:');
    console.log(JSON.stringify(samplePlan, null, 2));

  } catch (error: any) {
    console.error('❌ Error checking schema:', error.message);
    if (error.code === 'PGRST116') {
      console.error('\n💡 Table not found. Check:');
      console.error('   - Table name is correct');
      console.error('   - Table exists in database');
    } else if (error.code === 'PGRST301') {
      console.error('\n💡 Permission denied. Check:');
      console.error('   - Using SUPABASE_SERVICE_ROLE_KEY (bypasses RLS)');
      console.error('   - Service role key is correct');
    }
    process.exit(1);
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

