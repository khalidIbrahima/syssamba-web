/**
 * Script de migration des données vers Supabase
 * 
 * Usage:
 *   npm run migrate:to-supabase
 * 
 * Ou avec tsx:
 *   tsx scripts/migrate-to-supabase.ts
 */

import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from '../src/db/schema';

// Tables à migrer dans l'ordre des dépendances
const TABLES_TO_MIGRATE = [
  'plans',
  'organizations',
  'users',
  'subscriptions',
  'properties',
  'units',
  'tenants',
  'leases',
  'tasks',
  'messages',
  'payments',
  'journal_entries',
  'journal_lines',
  'accounts',
  'payment_methods',
  'owners',
  'owner_transfers',
  'user_invitations',
  'activities',
  'notifications',
] as const;

async function migrateTable(
  sourceDb: ReturnType<typeof drizzle>,
  targetDb: ReturnType<typeof drizzle>,
  tableName: string
) {
  try {
    console.log(`📦 Migrating table: ${tableName}...`);

    // Get table schema
    const table = (schema as any)[tableName];
    if (!table) {
      console.warn(`⚠️  Table ${tableName} not found in schema, skipping...`);
      return;
    }

    // Fetch all data from source
    const data = await sourceDb.select().from(table);
    
    if (data.length === 0) {
      console.log(`   ✓ Table ${tableName} is empty, skipping...`);
      return;
    }

    console.log(`   📊 Found ${data.length} records`);

    // Insert into target (with conflict handling)
    // Note: This is a simplified version. For production, you might want
    // to handle conflicts more carefully or use ON CONFLICT DO UPDATE
    try {
      await targetDb.insert(table).values(data as any);
      console.log(`   ✅ Successfully migrated ${data.length} records`);
    } catch (error: any) {
      if (error.message?.includes('duplicate key') || error.message?.includes('unique constraint')) {
        console.warn(`   ⚠️  Some records already exist, skipping duplicates...`);
        // Try inserting one by one to skip duplicates
        let successCount = 0;
        for (const record of data) {
          try {
            await targetDb.insert(table).values(record as any);
            successCount++;
          } catch (err: any) {
            if (!err.message?.includes('duplicate key') && !err.message?.includes('unique constraint')) {
              throw err;
            }
          }
        }
        console.log(`   ✅ Migrated ${successCount}/${data.length} new records`);
      } else {
        throw error;
      }
    }
  } catch (error) {
    console.error(`   ❌ Error migrating table ${tableName}:`, error);
    throw error;
  }
}

async function main() {
  // Load .env.local if dotenv is available
  try {
    // Use require for CommonJS compatibility with tsx
    const dotenv = require('dotenv');
    const path = require('path');
    const fs = require('fs');
    
    // Try .env.local first, then .env
    const envLocalPath = path.resolve(process.cwd(), '.env.local');
    const envPath = path.resolve(process.cwd(), '.env');
    
    if (fs.existsSync(envLocalPath)) {
      console.log('📄 Loading .env.local...');
      const result = dotenv.config({ path: envLocalPath });
      if (result.error) {
        console.warn('⚠️  Error loading .env.local:', result.error.message);
      } else {
        console.log('✅ .env.local loaded successfully');
      }
    } else if (fs.existsSync(envPath)) {
      console.log('📄 Loading .env...');
      const result = dotenv.config({ path: envPath });
      if (result.error) {
        console.warn('⚠️  Error loading .env:', result.error.message);
      } else {
        console.log('✅ .env loaded successfully');
      }
    } else {
      console.log('ℹ️  No .env.local or .env file found, using system environment variables');
    }
  } catch (e: any) {
    console.warn('⚠️  Could not load .env files:', e.message);
    console.warn('   Using environment variables only');
  }

  // Debug: Show what we found (mask passwords)
  console.log('\n🔍 Checking environment variables...');
  // Source: your old database (can be any PostgreSQL, including old Supabase)
  const sourceUrl = process.env.SOURCE_DATABASE_URL || process.env.DATABASE_URL;
  // Target: your new Supabase instance
  const targetUrl = process.env.TARGET_DATABASE_URL || process.env.SUPABASE_DB_URL;
  
  console.log(`   SOURCE_DATABASE_URL: ${process.env.SOURCE_DATABASE_URL ? '✅ Set' : '❌ Not set'}`);
  if (process.env.SOURCE_DATABASE_URL) {
    console.log(`      ${process.env.SOURCE_DATABASE_URL.replace(/:([^:@]+)@/, ':****@')}`);
  }
  console.log(`   DATABASE_URL: ${process.env.DATABASE_URL ? '✅ Set' : '❌ Not set'}`);
  if (process.env.DATABASE_URL && !process.env.SOURCE_DATABASE_URL) {
    console.log(`      ${process.env.DATABASE_URL.replace(/:([^:@]+)@/, ':****@')}`);
  }
  console.log(`   TARGET_DATABASE_URL: ${process.env.TARGET_DATABASE_URL ? '✅ Set' : '❌ Not set'}`);
  if (process.env.TARGET_DATABASE_URL) {
    console.log(`      ${process.env.TARGET_DATABASE_URL.replace(/:([^:@]+)@/, ':****@')}`);
  }
  console.log(`   SUPABASE_DB_URL: ${process.env.SUPABASE_DB_URL ? '✅ Set' : '❌ Not set'}`);
  if (process.env.SUPABASE_DB_URL && !process.env.TARGET_DATABASE_URL) {
    console.log(`      ${process.env.SUPABASE_DB_URL.replace(/:([^:@]+)@/, ':****@')}`);
  }
  console.log('');

  if (!sourceUrl) {
    console.error('❌ SOURCE_DATABASE_URL or DATABASE_URL is not set');
    console.error('');
    console.error('💡 Solution: Définissez les variables d\'environnement :');
    console.error('');
    console.error('   PowerShell:');
    console.error('   $env:SOURCE_DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/samba_one"');
    console.error('   $env:TARGET_DATABASE_URL = "postgresql://postgres:[PASSWORD]@db.xxxxx.supabase.co:5432/postgres"');
    console.error('');
    console.error('   Ou ajoutez-les dans .env.local :');
    console.error('   SOURCE_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/samba_one');
    console.error('   TARGET_DATABASE_URL=postgresql://postgres:[PASSWORD]@db.xxxxx.supabase.co:5432/postgres');
    process.exit(1);
  }

  if (!targetUrl) {
    console.error('❌ TARGET_DATABASE_URL or SUPABASE_DB_URL is not set');
    console.error('');
    console.error('💡 Solution: Définissez TARGET_DATABASE_URL avec votre connection string Supabase :');
    console.error('');
    console.error('   PowerShell:');
    console.error('   $env:TARGET_DATABASE_URL = "postgresql://postgres:[PASSWORD]@db.xxxxx.supabase.co:5432/postgres"');
    console.error('');
    console.error('   Ou ajoutez dans .env.local :');
    console.error('   TARGET_DATABASE_URL=postgresql://postgres:[PASSWORD]@db.xxxxx.supabase.co:5432/postgres');
    process.exit(1);
  }

  console.log('🚀 Starting migration to Supabase...\n');
  console.log(`📥 Source: ${sourceUrl.replace(/:([^:@]+)@/, ':****@')}`);
  console.log(`📤 Target: ${targetUrl.replace(/:([^:@]+)@/, ':****@')}\n`);

  // Create database connections
  const sourceClient = postgres(sourceUrl, { prepare: false, max: 1 });
  const targetClient = postgres(targetUrl, { prepare: false, max: 1 });

  const sourceDb = drizzle(sourceClient, { schema });
  const targetDb = drizzle(targetClient, { schema });

  try {
    // Migrate tables in order
    for (const tableName of TABLES_TO_MIGRATE) {
      await migrateTable(sourceDb, targetDb, tableName);
    }

    console.log('\n✅ Migration completed successfully!');
    console.log('\n📝 Next steps:');
    console.log('   1. Update .env.local with Supabase connection string');
    console.log('   2. Set DATABASE_PROVIDER=supabase');
    console.log('   3. Test your application');
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await sourceClient.end();
    await targetClient.end();
  }
}

// Run migration
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

