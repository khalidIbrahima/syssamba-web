/**
 * Seed script for plan features
 * Populates the features table and plan_features junction table with initial data
 */

import { db } from '../lib/db';

async function seedPlanFeatures() {
  console.log('🌱 Seeding plan features...');

  try {
    // First, get existing plans
    const plans = await db.select<{
      id: string;
      name: string;
    }>('plans', {
      filter: { is_active: true },
    });

    if (plans.length === 0) {
      console.log('❌ No active plans found. Please create plans first.');
      return;
    }

    console.log(`📋 Found ${plans.length} active plans:`, plans.map(p => p.name));

    // Define features by category
    const featuresData = [
      // Core Features
      {
        name: 'properties_management',
        display_name: 'Gestion des biens',
        description: 'Créer, modifier et supprimer des biens immobiliers',
        category: 'Core Features',
        is_premium: false,
        sort_order: 1,
      },
      {
        name: 'tasks_management',
        display_name: 'Gestion des tâches',
        description: 'Créer et assigner des tâches',
        category: 'Core Features',
        is_premium: false,
        sort_order: 2,
      },

      // Property Management
      {
        name: 'units_management',
        display_name: 'Gestion des lots',
        description: 'Gérer les lots et unités dans les biens',
        category: 'Property Management',
        is_premium: false,
        sort_order: 1,
      },
      {
        name: 'tenants_management',
        display_name: 'Gestion des locataires',
        description: 'Gérer les informations des locataires',
        category: 'Property Management',
        is_premium: false,
        sort_order: 2,
      },
      {
        name: 'leases_management',
        display_name: 'Gestion des baux',
        description: 'Créer et gérer les contrats de location',
        category: 'Property Management',
        is_premium: true,
        sort_order: 3,
      },

      // Financial
      {
        name: 'payments_tracking',
        display_name: 'Suivi des paiements',
        description: 'Enregistrer et suivre les paiements',
        category: 'Financial',
        is_premium: false,
        sort_order: 1,
      },
      {
        name: 'accounting_basic',
        display_name: 'Comptabilité de base',
        description: 'Fonctionnalités comptables de base',
        category: 'Financial',
        is_premium: true,
        sort_order: 2,
      },

      // Communication
      {
        name: 'messaging_system',
        display_name: 'Système de messagerie',
        description: 'Communication interne et externe',
        category: 'Communication',
        is_premium: false,
        sort_order: 1,
      },

      // Reporting
      {
        name: 'reports_basic',
        display_name: 'Rapports de base',
        description: 'Générer des rapports simples',
        category: 'Reporting',
        is_premium: false,
        sort_order: 1,
      },

      // Administration
      {
        name: 'user_management',
        display_name: 'Gestion des utilisateurs',
        description: 'Gérer les comptes utilisateur',
        category: 'Administration',
        is_premium: true,
        sort_order: 1,
      },
    ];

    // Insert features
    console.log('📝 Inserting features...');
    for (const featureData of featuresData) {
      // Check if feature already exists
      const existing = await db.selectOne<{ id: string }>('features', {
        eq: { name: featureData.name },
      });

      if (existing) {
        console.log(`⏭️  Feature ${featureData.name} already exists, skipping`);
        continue;
      }

      const newFeature = await db.insertOne('features', {
        name: featureData.name,
        display_name: featureData.display_name,
        description: featureData.description,
        category: featureData.category,
        is_premium: featureData.is_premium,
        is_active: true,
        sort_order: featureData.sort_order,
      });

      if (newFeature) {
        console.log(`✅ Created feature: ${featureData.display_name}`);
      }
    }

    // Define feature availability by plan
    const planFeatureMapping: Record<string, Record<string, boolean>> = {
      freemium: {
        properties_management: true,
        tasks_management: true,
        messaging_system: true,
        reports_basic: false,
        units_management: false,
        tenants_management: false,
        leases_management: false,
        payments_tracking: false,
        accounting_basic: false,
        user_management: false,
      },
      starter: {
        properties_management: true,
        tasks_management: true,
        messaging_system: true,
        reports_basic: true,
        units_management: true,
        tenants_management: true,
        leases_management: false,
        payments_tracking: true,
        accounting_basic: false,
        user_management: false,
      },
      professional: {
        properties_management: true,
        tasks_management: true,
        messaging_system: true,
        reports_basic: true,
        units_management: true,
        tenants_management: true,
        leases_management: true,
        payments_tracking: true,
        accounting_basic: true,
        user_management: true,
      },
      enterprise: {
        properties_management: true,
        tasks_management: true,
        messaging_system: true,
        reports_basic: true,
        units_management: true,
        tenants_management: true,
        leases_management: true,
        payments_tracking: true,
        accounting_basic: true,
        user_management: true,
      },
    };

    // Insert plan-feature relationships
    console.log('🔗 Creating plan-feature relationships...');
    for (const plan of plans) {
      const planFeatures = planFeatureMapping[plan.name];
      if (!planFeatures) {
        console.log(`⚠️  No feature mapping found for plan: ${plan.name}`);
        continue;
      }

      console.log(`📋 Setting up features for plan: ${plan.name}`);

      for (const [featureName, isEnabled] of Object.entries(planFeatures)) {
        // Get the feature ID by name
        const feature = await db.selectOne<{ id: string }>('features', {
          eq: { name: featureName },
        });

        if (!feature) {
          console.log(`⚠️  Feature ${featureName} not found, skipping`);
          continue;
        }

        // Check if relationship already exists
        const existing = await db.selectOne<{ id: string }>('plan_features', {
          eq: {
            plan_id: plan.id,
            feature_id: feature.id,
          },
        });

        if (existing) {
          // Update existing relationship
          await db.updateOne(
            'plan_features',
            {
              is_enabled: isEnabled,
            },
            { id: existing.id }
          );
          console.log(`🔄 Updated ${featureName} for ${plan.name}: ${isEnabled}`);
        } else {
          // Create new relationship
          const newRelation = await db.insertOne('plan_features', {
            plan_id: plan.id,
            feature_id: feature.id,
            is_enabled: isEnabled,
          });

          if (newRelation) {
            console.log(`✅ Created ${featureName} for ${plan.name}: ${isEnabled}`);
          }
        }
      }
    }

    console.log('🎉 Plan features seeding completed successfully!');

    // Verify the data
    const featuresCount = await db.count('features');
    const planFeaturesCount = await db.count('plan_features');

    console.log(`📊 Summary:`);
    console.log(`   - Features created: ${featuresCount}`);
    console.log(`   - Plan-feature relationships: ${planFeaturesCount}`);

  } catch (error) {
    console.error('❌ Error seeding plan features:', error);
    throw error;
  }
}

// Run the seed function
if (require.main === module) {
  seedPlanFeatures()
    .then(() => {
      console.log('✅ Seeding completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Seeding failed:', error);
      process.exit(1);
    });
}

export { seedPlanFeatures };
