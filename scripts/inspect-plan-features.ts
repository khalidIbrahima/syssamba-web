/**
 * Script to inspect the plan_features table schema and data
 * This will help us understand the actual structure of the existing table
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load environment variables from .env.local if it exists
config({ path: '.env.local' });
config({ path: '.env' });

// Load environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

async function inspectPlanFeaturesTable() {
  console.log('🔍 Inspecting plan_features table...\n');

  // Check environment variables
  if (!supabaseUrl) {
    console.error('❌ NEXT_PUBLIC_SUPABASE_URL environment variable is not set');
    process.exit(1);
  }

  const authKey = supabaseServiceKey || supabaseAnonKey;
  if (!authKey) {
    console.error('❌ Neither SUPABASE_SERVICE_ROLE_KEY nor NEXT_PUBLIC_SUPABASE_ANON_KEY is set');
    process.exit(1);
  }

  // Create Supabase client
  const supabase = createClient(supabaseUrl, authKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  try {
    console.log('📊 Supabase URL:', supabaseUrl.replace(/https?:\/\//, '').split('.')[0] + '...');
    console.log('🔑 Using service role key:', !!supabaseServiceKey);
    console.log();

    // 1. Try to query the table directly
    console.log('1️⃣ Checking plan_features table...');
    const { data: tableTestData, error: tableError } = await supabase
      .from('plan_features')
      .select('*')
      .limit(1);

    if (tableError) {
      console.log('❌ plan_features table does not exist or is not accessible');
      console.log('Error:', tableError.message);
      console.log();

      // Try to get a list of available tables by attempting common ones
      console.log('2️⃣ Checking for common tables...');
      const commonTables = ['plans', 'features', 'users', 'organizations', 'subscriptions'];
      const availableTables: string[] = [];

      for (const tableName of commonTables) {
        try {
          const { error: checkError } = await supabase
            .from(tableName)
            .select('*')
            .limit(1);

          if (!checkError) {
            availableTables.push(tableName);
          }
        } catch (e) {
          // Ignore errors
        }
      }

      if (availableTables.length > 0) {
        console.log('📋 Available tables:', availableTables.join(', '));
      } else {
        console.log('❌ No common tables found');
      }

      return;
    }

    console.log('✅ plan_features table exists and is accessible');
    console.log();

    // 2. Get sample data and infer schema
    console.log('2️⃣ Getting sample data and analyzing structure...');
    const { data: sampleData, error: sampleError } = await supabase
      .from('plan_features')
      .select('*')
      .limit(10);

    if (sampleError) {
      console.error('❌ Error getting sample data:', sampleError);
      return;
    }

    // Analyze schema from data
    if (sampleData && sampleData.length > 0) {
      console.log('📋 Inferred schema from data:');
      const firstRow = sampleData[0];
      const columns = Object.keys(firstRow);

      console.log('| Column | Sample Value | Type |');
      console.log('|--------|--------------|------|');
      columns.forEach(col => {
        const value = firstRow[col];
        const type = Array.isArray(value) ? 'array' :
                    value === null ? 'null' :
                    typeof value;
        const sampleValue = typeof value === 'string' && value.length > 50
          ? value.substring(0, 50) + '...'
          : String(value);
        console.log(`| ${col} | ${sampleValue} | ${type} |`);
      });
      console.log();

      console.log(`📊 Sample data (${sampleData.length} rows):`);
      console.log('First row:', JSON.stringify(sampleData[0], null, 2));
      if (sampleData.length > 1) {
        console.log('Second row:', JSON.stringify(sampleData[1], null, 2));
      }
    } else {
      console.log('⚠️  No data in table');
      console.log('📋 Cannot infer schema without data');
    }
    console.log();

    // 3. Get total count
    console.log('3️⃣ Getting total count...');
    const { count, error: countError } = await supabase
      .from('plan_features')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      console.error('❌ Error getting count:', countError);
    } else {
      console.log(`📈 Total rows in plan_features: ${count}`);
    }
    console.log();

    // 4. Check related tables
    console.log('4️⃣ Checking related tables...');

    // Check features table
    try {
      const { count: featuresCount, error: featuresCountError } = await supabase
        .from('features')
        .select('*', { count: 'exact', head: true });

      if (featuresCountError) {
        console.log('❌ features table does not exist or is not accessible');
      } else {
        console.log('✅ features table exists');
        console.log(`📈 Total features: ${featuresCount}`);

        // Get sample features
        const { data: sampleFeatures, error: sampleFeaturesError } = await supabase
          .from('features')
          .select('*')
          .limit(3);

        if (!sampleFeaturesError && sampleFeatures) {
          console.log('📋 Sample features:');
          sampleFeatures.forEach(feature => {
            console.log(`   - ${feature.name}: ${feature.display_name || 'N/A'} (${feature.category || 'N/A'})`);
          });
        }
      }
    } catch (e) {
      console.log('❌ features table does not exist or is not accessible');
    }

    // Check plans table
    try {
      const { count: plansCount, error: plansCountError } = await supabase
        .from('plans')
        .select('*', { count: 'exact', head: true });

      if (plansCountError) {
        console.log('❌ plans table does not exist or is not accessible');
      } else {
        console.log('✅ plans table exists');
        console.log(`📈 Total plans: ${plansCount}`);

        // Get sample plans
        const { data: samplePlans, error: samplePlansError } = await supabase
          .from('plans')
          .select('id, name, display_name')
          .limit(3);

        if (!samplePlansError && samplePlans) {
          console.log('📋 Sample plans:');
          samplePlans.forEach(plan => {
            console.log(`   - ${plan.name}: ${plan.display_name || 'N/A'}`);
          });
        }
      }
    } catch (e) {
      console.log('❌ plans table does not exist or is not accessible');
    }

    console.log();
    console.log('🎉 Inspection completed successfully!');

  } catch (error) {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
  }
}

// Run the inspection
if (require.main === module) {
  inspectPlanFeaturesTable()
    .then(() => {
      console.log('✅ Inspection completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Inspection failed:', error);
      process.exit(1);
    });
}

export { inspectPlanFeaturesTable };
