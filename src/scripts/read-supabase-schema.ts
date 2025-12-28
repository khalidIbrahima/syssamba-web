/**
 * Script to read Supabase schema directly using credentials from .env.local
 * Run with: npx tsx src/scripts/read-supabase-schema.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from .env.local
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || (!supabaseAnonKey && !supabaseServiceKey)) {
  console.error('❌ Missing Supabase credentials in .env.local');
  console.error('Required: NEXT_PUBLIC_SUPABASE_URL');
  console.error('Required: NEXT_PUBLIC_SUPABASE_ANON_KEY or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// Use service role key if available (bypasses RLS), otherwise use anon key
const supabaseKey = supabaseServiceKey || supabaseAnonKey!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function readPlansSchema() {
  console.log('📊 Reading plans table schema from Supabase...\n');
  console.log(`📍 URL: ${supabaseUrl}`);
  console.log(`🔑 Key: ${supabaseServiceKey ? 'Service Role Key' : 'Anon Key'}\n`);

  try {
    // Read sample data to understand structure
    const { data: plans, error } = await supabase
      .from('plans')
      .select('*')
      .limit(5);

    if (error) {
      console.error('❌ Error reading plans:', error);
      return;
    }

    if (!plans || plans.length === 0) {
      console.log('⚠️  No plans found in database');
      return;
    }

    console.log(`✅ Found ${plans.length} plan(s)\n`);

    // Display schema from first plan
    console.log('📋 Plans Table Schema (from first record):');
    console.log('=' .repeat(60));
    
    const firstPlan = plans[0];
    const schema: Record<string, { type: string; value: any }> = {};

    Object.keys(firstPlan).forEach((key) => {
      const value = firstPlan[key];
      let type = typeof value;
      
      if (value === null) {
        type = 'object';
      } else if (Array.isArray(value)) {
        type = 'array';
      } else if (typeof value === 'object' && value !== null) {
        type = 'object';
      }

      schema[key] = { type, value };
    });

    // Display in a structured way
    Object.entries(schema).forEach(([key, { type, value }]) => {
      const displayValue = 
        value === null ? 'null' :
        Array.isArray(value) ? `[${value.length} items]` :
        typeof value === 'object' ? JSON.stringify(value).substring(0, 50) + '...' :
        String(value).substring(0, 50);
      
      console.log(`  ${key.padEnd(30)} : ${type.padEnd(10)} = ${displayValue}`);
    });

    console.log('\n' + '='.repeat(60));
    console.log('\n📝 All Plans Data:');
    console.log(JSON.stringify(plans, null, 2));

    // Try to get table information from information_schema (if accessible)
    console.log('\n\n🔍 Attempting to read column information...');
    try {
      const { data: columns, error: colError } = await supabase.rpc('get_table_columns', {
        table_name: 'plans'
      }).catch(() => ({ data: null, error: { message: 'Function not available' } }));

      if (columns) {
        console.log('Column details:', columns);
      } else {
        console.log('ℹ️  Column metadata function not available (this is normal)');
      }
    } catch (err) {
      console.log('ℹ️  Column metadata not accessible (this is normal)');
    }

  } catch (error: any) {
    console.error('❌ Unexpected error:', error);
  }
}

// Run the script
readPlansSchema()
  .then(() => {
    console.log('\n✅ Schema reading completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });

