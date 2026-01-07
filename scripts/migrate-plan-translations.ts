/**
 * Script de migration pour ajouter les traductions anglaises aux plans
 * Usage: npx tsx scripts/migrate-plan-translations.ts
 * 
 * Ce script lit les variables d'environnement depuis .env.local
 * et met à jour les champs display_name_en et description_en dans Supabase
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

// Plan translations mapping
const planTranslations: Record<string, { displayNameEn: string; descriptionEn: string }> = {
  freemium: {
    displayNameEn: 'Freemium',
    descriptionEn: 'Perfect for getting started. Basic features to manage a small property portfolio.',
  },
  starter: {
    displayNameEn: 'Starter',
    descriptionEn: 'Ideal for small property owners. Enhanced features for better management.',
  },
  pro: {
    displayNameEn: 'Professional',
    descriptionEn: 'For property management professionals. Complete accounting and advanced features.',
  },
  professional: {
    displayNameEn: 'Professional',
    descriptionEn: 'For property management professionals. Complete accounting and advanced features.',
  },
  agency: {
    displayNameEn: 'Agency / Property Manager',
    descriptionEn: 'For real estate agencies and property managers. Unlimited properties, white label, and dedicated support.',
  },
  agence_syndic: {
    displayNameEn: 'Agency / Property Manager',
    descriptionEn: 'For real estate agencies and property managers. Unlimited properties, white label, and dedicated support.',
  },
  enterprise: {
    displayNameEn: 'Enterprise',
    descriptionEn: 'Custom solution for large organizations. Full white label, API access, dedicated manager, and on-premise option.',
  },
};

async function migratePlanTranslations() {
  console.log('🚀 Starting plan translations migration...\n');

  try {
    // Fetch all plans
    const { data: plans, error: fetchError } = await supabase
      .from('plans')
      .select('id, name, display_name, description');

    if (fetchError) {
      console.error('❌ Error fetching plans:', fetchError);
      process.exit(1);
    }

    if (!plans || plans.length === 0) {
      console.warn('⚠️  No plans found in database');
      return;
    }

    console.log(`📋 Found ${plans.length} plans to update\n`);

    // Update each plan with English translations
    for (const plan of plans) {
      const translation = planTranslations[plan.name];

      if (!translation) {
        console.warn(`⚠️  No translation found for plan: ${plan.name}`);
        continue;
      }

      const { error: updateError } = await supabase
        .from('plans')
        .update({
          display_name_en: translation.displayNameEn,
          description_en: translation.descriptionEn,
          updated_at: new Date().toISOString(),
        })
        .eq('id', plan.id);

      if (updateError) {
        console.error(`❌ Error updating plan ${plan.name}:`, updateError);
        continue;
      }

      console.log(`✅ Updated ${plan.name}:`);
      console.log(`   Display Name (EN): ${translation.displayNameEn}`);
      console.log(`   Description (EN): ${translation.descriptionEn}\n`);
    }

    console.log('✨ Migration completed successfully!');
  } catch (error) {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
  }
}

// Run migration
migratePlanTranslations()
  .then(() => {
    console.log('\n✅ Script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });

