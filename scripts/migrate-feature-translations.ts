/**
 * Script de migration pour ajouter les traductions anglaises aux features
 * Usage: npx tsx scripts/migrate-feature-translations.ts
 * 
 * Ce script lit les variables d'environnement depuis .env.local
 * et met à jour les champs name_en et description_en dans Supabase
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

// Feature translations mapping - based on actual feature names in database
const featureTranslations: Record<string, { nameEn: string; descriptionEn: string }> = {
  // Administration
  bulk_operations: {
    nameEn: 'Bulk Operations',
    descriptionEn: 'Bulk import/export and updates',
  },
  document_storage: {
    nameEn: 'Document Storage',
    descriptionEn: 'Store and manage documents',
  },
  multi_user: {
    nameEn: 'Multi-User',
    descriptionEn: 'Multiple users and roles',
  },
  user_management: {
    nameEn: 'User Management',
    descriptionEn: 'Manage users and their permissions',
  },
  vendor_management: {
    nameEn: 'Vendor Management',
    descriptionEn: 'Manage vendors and contractors',
  },
  
  // Advanced
  api_access: {
    nameEn: 'API Access',
    descriptionEn: 'RESTful API for integrations',
  },
  custom_branding: {
    nameEn: 'Custom Branding',
    descriptionEn: 'White-label and custom branding',
  },
  electronic_signature: {
    nameEn: 'Electronic Signature',
    descriptionEn: 'Digital signature for contracts',
  },
  priority_support: {
    nameEn: 'Priority Support',
    descriptionEn: '24/7 priority customer support',
  },
  task_management: {
    nameEn: 'Task Management',
    descriptionEn: 'Manage tasks and assignments',
  },
  
  // Communication
  email_notifications: {
    nameEn: 'Email Notifications',
    descriptionEn: 'Automated email notifications',
  },
  messaging: {
    nameEn: 'Messaging',
    descriptionEn: 'Messaging system between users and tenants',
  },
  sms_notifications: {
    nameEn: 'SMS Notifications',
    descriptionEn: 'SMS alerts and notifications',
  },
  tenant_portal: {
    nameEn: 'Tenant Portal',
    descriptionEn: 'Online portal for tenants',
  },
  
  // Core Features
  property_management: {
    nameEn: 'Property Management',
    descriptionEn: 'Manage properties and buildings',
  },
  tenant_management: {
    nameEn: 'Tenant Management',
    descriptionEn: 'Manage tenants and leases',
  },
  
  // Financial
  accounting: {
    nameEn: 'Accounting',
    descriptionEn: 'Basic accounting and bookkeeping',
  },
  ecriture_comptable_automatique: {
    nameEn: 'Automatic Accounting Entries',
    descriptionEn: 'Automatic accounting entry generation',
  },
  financial_forecasting: {
    nameEn: 'Financial Forecasting',
    descriptionEn: 'Revenue forecasting and projections',
  },
  rent_collection: {
    nameEn: 'Rent Collection',
    descriptionEn: 'Track and collect rent payments',
  },
  
  // Payments
  online_payments: {
    nameEn: 'Online Payments',
    descriptionEn: 'Accept online rent payments',
  },
  
  // Property Management
  inspection_scheduling: {
    nameEn: 'Inspection Scheduling',
    descriptionEn: 'Schedule and track property inspections',
  },
  lease_management: {
    nameEn: 'Lease Management',
    descriptionEn: 'Create and manage lease contracts',
  },
  maintenance_requests: {
    nameEn: 'Maintenance Requests',
    descriptionEn: 'Handle maintenance and repair requests',
  },
  vacancy_management: {
    nameEn: 'Vacancy Management',
    descriptionEn: 'Track and manage vacant units',
  },
  
  // Reporting
  advanced_reporting: {
    nameEn: 'Advanced Reporting',
    descriptionEn: 'Advanced analytics and custom reports',
  },
  reporting: {
    nameEn: 'Reporting',
    descriptionEn: 'Generate basic reports',
  },
};

async function migrateFeatureTranslations() {
  console.log('🚀 Starting feature translations migration...\n');

  try {
    // Fetch all features
    // In Supabase, the table structure may differ - use 'name' as the unique identifier
    const { data: features, error: fetchError } = await supabase
      .from('features')
      .select('id, name, description');

    if (fetchError) {
      console.error('❌ Error fetching features:', fetchError);
      process.exit(1);
    }

    if (!features || features.length === 0) {
      console.warn('⚠️  No features found in database');
      return;
    }

    console.log(`📋 Found ${features.length} features to update\n`);

    // Update each feature with English translations
    let updatedCount = 0;
    let skippedCount = 0;

    for (const feature of features) {
      // Use 'name' as the unique identifier (it's the key in the actual database)
      const featureName = feature.name;
      
      // Direct match with feature name
      const translation = featureTranslations[featureName];

      if (!translation) {
        console.warn(`⚠️  No translation found for feature: ${featureName}`);
        skippedCount++;
        continue;
      }

      const { error: updateError } = await supabase
        .from('features')
        .update({
          name_en: translation.nameEn,
          description_en: translation.descriptionEn,
          updated_at: new Date().toISOString(),
        })
        .eq('id', feature.id);

      if (updateError) {
        console.error(`❌ Error updating feature ${featureName}:`, updateError);
        skippedCount++;
        continue;
      }

      console.log(`✅ Updated ${featureName}:`);
      console.log(`   Name (EN): ${translation.nameEn}`);
      console.log(`   Description (EN): ${translation.descriptionEn}\n`);
      updatedCount++;
    }

    console.log(`✨ Migration completed!`);
    console.log(`   ✅ Updated: ${updatedCount}`);
    console.log(`   ⚠️  Skipped: ${skippedCount}`);
  } catch (error) {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
  }
}

// Run migration
migrateFeatureTranslations()
  .then(() => {
    console.log('\n✅ Script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });

