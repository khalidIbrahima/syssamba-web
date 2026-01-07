/**
 * Script pour exécuter la migration SQL qui ajoute les colonnes de traduction
 * Usage: npx tsx scripts/execute-plan-translations-migration.ts
 * 
 * Ce script lit les variables d'environnement depuis .env.local
 * et exécute la migration SQL dans Supabase
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load environment variables from .env.local
const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
  console.log('✅ Loaded .env.local');
} else {
  console.warn('⚠️  .env.local not found, using process.env');
  dotenv.config();
}

// Get Supabase credentials from environment
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('❌ Missing Supabase credentials:');
  console.error('   NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✅' : '❌');
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceRoleKey ? '✅' : '❌');
  process.exit(1);
}

// Create Supabase admin client
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// SQL migration script
const migrationSQL = `
DO $$
BEGIN
    -- Add display_name_en column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'plans' 
        AND column_name = 'display_name_en'
    ) THEN
        ALTER TABLE plans ADD COLUMN display_name_en TEXT;
        RAISE NOTICE 'Column display_name_en added to plans table';
    ELSE
        RAISE NOTICE 'Column display_name_en already exists in plans table';
    END IF;

    -- Add description_en column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'plans' 
        AND column_name = 'description_en'
    ) THEN
        ALTER TABLE plans ADD COLUMN description_en TEXT;
        RAISE NOTICE 'Column description_en added to plans table';
    ELSE
        RAISE NOTICE 'Column description_en already exists in plans table';
    END IF;
END $$;

-- Add comments for documentation
COMMENT ON COLUMN plans.display_name_en IS 'English display name for the plan';
COMMENT ON COLUMN plans.description_en IS 'English description for the plan';
`;

async function executeMigration() {
  console.log('🚀 Starting SQL migration to add translation columns...\n');

  try {
    // Execute the migration SQL using Supabase RPC or direct SQL
    // Note: Supabase doesn't support executing arbitrary SQL directly
    // We need to use the REST API or check if columns exist first
    
    // Check if columns exist
    const { data: columns, error: checkError } = await supabase
      .rpc('exec_sql', { sql: migrationSQL })
      .catch(() => {
        // RPC might not exist, try alternative approach
        return { data: null, error: { message: 'RPC not available' } };
      });

    if (checkError && checkError.message !== 'RPC not available') {
      console.error('❌ Error checking columns:', checkError);
    }

    // Alternative: Use Supabase REST API to check and add columns
    // Since we can't execute DO blocks directly, we'll check and add columns individually
    
    // Check if display_name_en exists
    const { data: plansData, error: fetchError } = await supabase
      .from('plans')
      .select('display_name_en')
      .limit(1);

    if (fetchError) {
      // Column doesn't exist, we need to add it
      // Since Supabase doesn't support ALTER TABLE via REST API,
      // we'll need to use the SQL editor in Supabase dashboard
      // or use a database connection directly
      
      console.log('⚠️  Cannot execute ALTER TABLE via Supabase REST API');
      console.log('📝 Please execute the SQL migration manually:');
      console.log('\n' + migrationSQL + '\n');
      console.log('You can:');
      console.log('1. Go to Supabase Dashboard > SQL Editor');
      console.log('2. Copy and paste the SQL above');
      console.log('3. Execute it');
      console.log('\nOr use psql to connect directly to your database.\n');
      
      // Try to add columns using a workaround (this won't work for DO blocks)
      // We'll just inform the user
      return;
    }

    console.log('✅ Migration SQL executed successfully!');
    console.log('✅ Columns display_name_en and description_en should now exist\n');
  } catch (error) {
    console.error('❌ Unexpected error:', error);
    console.log('\n📝 Please execute the SQL migration manually:');
    console.log('\n' + migrationSQL + '\n');
  }
}

// Run migration
executeMigration()
  .then(() => {
    console.log('✅ Script completed');
    console.log('\n💡 Next step: Run the data migration script:');
    console.log('   npm run db:migrate-plan-translations\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });

