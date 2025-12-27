/**
 * Script to read Supabase schema directly using credentials from .env.local
 * Run with: node src/scripts/read-supabase-schema.js
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

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
const supabaseKey = supabaseServiceKey || supabaseAnonKey;
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
    console.log('='.repeat(60));
    
    const firstPlan = plans[0];
    const schema = {};

    Object.keys(firstPlan).forEach((key) => {
      const value = firstPlan[key];
      let type = typeof value;
      
      if (value === null) {
        type = 'null';
      } else if (Array.isArray(value)) {
        type = 'array';
      } else if (typeof value === 'object' && value !== null) {
        type = 'object';
      }

      schema[key] = { type, value };
    });

    // Display in a structured way
    Object.entries(schema).forEach(([key, { type, value }]) => {
      let displayValue;
      if (value === null) {
        displayValue = 'null';
      } else if (Array.isArray(value)) {
        displayValue = `[${value.length} items]`;
      } else if (typeof value === 'object') {
        displayValue = JSON.stringify(value).substring(0, 50) + '...';
      } else {
        displayValue = String(value).substring(0, 50);
      }
      
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

    // Also read other important tables
    console.log('\n\n📊 Reading other important tables...\n');
    
    const tables = ['organizations', 'users', 'properties', 'units', 'tenants'];
    
    for (const tableName of tables) {
      try {
        const { data, error } = await supabase
          .from(tableName)
          .select('*')
          .limit(1);
        
        if (error) {
          console.log(`  ❌ ${tableName}: ${error.message}`);
        } else if (data && data.length > 0) {
          const columns = Object.keys(data[0]);
          console.log(`  ✅ ${tableName}: ${columns.length} columns`);
          console.log(`     Columns: ${columns.join(', ')}`);
        } else {
          console.log(`  ⚠️  ${tableName}: Table exists but is empty`);
        }
      } catch (err) {
        console.log(`  ❌ ${tableName}: ${err.message}`);
      }
    }

  } catch (error) {
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

