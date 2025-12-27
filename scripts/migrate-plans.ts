/**
 * Script de migration pour créer et peupler la table plans
 * Usage: npx tsx scripts/migrate-plans.ts
 */

import { db } from '../src/lib/db';
import { plans } from '../src/db/schema';
import { PLAN_DEFINITIONS } from '../src/lib/permissions';
import { eq } from 'drizzle-orm';

async function migratePlans() {
  console.log('🚀 Début de la migration des plans...');

  try {
    // Insérer ou mettre à jour chaque plan
    for (const [planName, planDef] of Object.entries(PLAN_DEFINITIONS)) {
      const price = planDef.price === 'custom' ? null : planDef.price;
      const priceType = planDef.price === 'custom' ? 'custom' : 'fixed';

      const planData = {
        name: planName,
        displayName: planDef.name,
        price: price?.toString() || null,
        priceType: priceType as 'fixed' | 'custom',
        lotsLimit: planDef.lots_limit,
        usersLimit: planDef.users_limit,
        extranetTenantsLimit: planDef.extranet_tenants_limit,
        features: planDef.features,
        supportLevel: planDef.features.support,
        isActive: true,
        sortOrder: 
          planName === 'freemium' ? 1 :
          planName === 'starter' ? 2 :
          planName === 'pro' ? 3 :
          planName === 'agency' ? 4 : 5,
      };

      // Vérifier si le plan existe déjà
      const existing = await db
        .select()
        .from(plans)
        .where(eq(plans.name, planName))
        .limit(1);

      if (existing.length > 0) {
        // Mettre à jour
        await db
          .update(plans)
          .set({
            ...planData,
            updatedAt: new Date(),
          })
          .where(eq(plans.name, planName));
        console.log(`✅ Plan ${planName} mis à jour`);
      } else {
        // Créer
        await db.insert(plans).values(planData);
        console.log(`✅ Plan ${planName} créé`);
      }
    }

    console.log('✨ Migration terminée avec succès!');
  } catch (error) {
    console.error('❌ Erreur lors de la migration:', error);
    process.exit(1);
  }
}

// Exécuter la migration
migratePlans()
  .then(() => {
    console.log('Migration complète');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Erreur fatale:', error);
    process.exit(1);
  });

