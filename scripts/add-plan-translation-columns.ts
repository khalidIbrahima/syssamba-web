/**
 * Script pour vérifier et afficher les instructions pour ajouter les colonnes de traduction
 * Usage: npx tsx scripts/add-plan-translation-columns.ts
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

// Get Supabase credentials
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function checkColumns() {
  console.log('🚀 Checking if translation columns exist...\n');

  try {
    // Try to check if columns exist by attempting to select them
    const { error: checkError } = await supabase
      .from('plans')
      .select('display_name_en, description_en')
      .limit(1);

    if (!checkError) {
      console.log('✅ Columns already exist!');
      console.log('✅ You can now run: npm run db:migrate-plan-translations\n');
      return true;
    }

    // Columns don't exist
    console.log('❌ Columns do not exist yet.');
    console.log('\n📝 Please execute the SQL migration in Supabase Dashboard:\n');
    console.log('1. Go to: Supabase Dashboard > SQL Editor');
    console.log('2. Copy and paste the SQL from: init-db/76-add-plan-translations.sql');
    console.log('3. Click "Run"');
    console.log('4. Then run: npm run db:migrate-plan-translations\n');
    
    return false;
  } catch (error) {
    console.error('❌ Error:', error);
    return false;
  }
}

// Run check
checkColumns()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
