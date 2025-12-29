/**
 * Script to inspect the plan_features table schema and data
 * This will help us understand the actual structure of the existing table
 */

import { createClient } from '@supabase/supabase-js';

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

    // 1. Check if table exists
    console.log('1️⃣ Checking if plan_features table exists...');
    const { data: tables, error: tablesError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .eq('table_name', 'plan_features');

    if (tablesError) {
      console.error('❌ Error checking tables:', tablesError);
      return;
    }

    if (!tables || tables.length === 0) {
      console.log('❌ plan_features table does not exist');
      console.log('📋 Available tables in public schema:');

      const { data: allTables, error: allTablesError } = await supabase
        .from('information_schema.tables')
        .select('table_name')
        .eq('table_schema', 'public')
        .order('table_name');

      if (!allTablesError && allTables) {
        allTables.forEach(table => {
          console.log(`   - ${table.table_name}`);
        });
      }

      return;
    }

    console.log('✅ plan_features table exists');
    console.log();

    // 2. Get table schema
    console.log('2️⃣ Getting table schema...');
    const { data: columns, error: columnsError } = await supabase
      .from('information_schema.columns')
      .select('column_name, data_type, is_nullable, column_default')
      .eq('table_schema', 'public')
      .eq('table_name', 'plan_features')
      .order('ordinal_position');

    if (columnsError) {
      console.error('❌ Error getting columns:', columnsError);
      return;
    }

    console.log('📋 Table schema:');
    console.log('| Column | Type | Nullable | Default |');
    console.log('|--------|------|----------|---------|');
    columns?.forEach(col => {
      console.log(`| ${col.column_name} | ${col.data_type} | ${col.is_nullable} | ${col.column_default || 'null'} |`);
    });
    console.log();

    // 3. Get sample data
    console.log('3️⃣ Getting sample data...');
    const { data: sampleData, error: sampleError } = await supabase
      .from('plan_features')
      .select('*')
      .limit(10);

    if (sampleError) {
      console.error('❌ Error getting sample data:', sampleError);
      return;
    }

    console.log(`📊 Sample data (${sampleData?.length || 0} rows):`);
    if (sampleData && sampleData.length > 0) {
      console.log('First row:', JSON.stringify(sampleData[0], null, 2));
      if (sampleData.length > 1) {
        console.log('Second row:', JSON.stringify(sampleData[1], null, 2));
      }
    } else {
      console.log('⚠️  No data in table');
    }
    console.log();

    // 4. Get total count
    console.log('4️⃣ Getting total count...');
    const { count, error: countError } = await supabase
      .from('plan_features')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      console.error('❌ Error getting count:', countError);
    } else {
      console.log(`📈 Total rows in plan_features: ${count}`);
    }
    console.log();

    // 5. Check related tables
    console.log('5️⃣ Checking related tables...');

    // Check if features table exists
    const { data: featuresTable, error: featuresTableError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .eq('table_name', 'features');

    if (featuresTableError) {
      console.error('❌ Error checking features table:', featuresTableError);
    } else if (featuresTable && featuresTable.length > 0) {
      console.log('✅ features table exists');

      // Get features count
      const { count: featuresCount, error: featuresCountError } = await supabase
        .from('features')
        .select('*', { count: 'exact', head: true });

      if (!featuresCountError) {
        console.log(`📈 Total features: ${featuresCount}`);
      }

      // Get sample features
      const { data: sampleFeatures, error: sampleFeaturesError } = await supabase
        .from('features')
        .select('*')
        .limit(5);

      if (!sampleFeaturesError && sampleFeatures) {
        console.log('📋 Sample features:');
        sampleFeatures.forEach(feature => {
          console.log(`   - ${feature.name}: ${feature.display_name} (${feature.category})`);
        });
      }
    } else {
      console.log('❌ features table does not exist');
    }

    // Check if plans table exists
    const { data: plansTable, error: plansTableError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .eq('table_name', 'plans');

    if (plansTableError) {
      console.error('❌ Error checking plans table:', plansTableError);
    } else if (plansTable && plansTable.length > 0) {
      console.log('✅ plans table exists');

      // Get plans count
      const { count: plansCount, error: plansCountError } = await supabase
        .from('plans')
        .select('*', { count: 'exact', head: true });

      if (!plansCountError) {
        console.log(`📈 Total plans: ${plansCount}`);
      }

      // Get sample plans
      const { data: samplePlans, error: samplePlansError } = await supabase
        .from('plans')
        .select('id, name, display_name')
        .limit(5);

      if (!samplePlansError && samplePlans) {
        console.log('📋 Sample plans:');
        samplePlans.forEach(plan => {
          console.log(`   - ${plan.name}: ${plan.display_name}`);
        });
      }
    } else {
      console.log('❌ plans table does not exist');
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
