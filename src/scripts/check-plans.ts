import dotenv from 'dotenv';
import { db } from '../lib/db';

// Load environment variables
dotenv.config({ path: '.env.local' });

async function checkPlans() {
  console.log('\n=== Checking Plans Table ===\n');

  try {
    // Get all plans
    const plans = await db.select<{
      id: string;
      name: string;
      display_name: string;
      description: string | null;
      created_at: string;
    }>('plans', {
      orderBy: { column: 'created_at', ascending: false },
    });

    console.log(`Found ${plans?.length || 0} plans:\n`);
    plans?.forEach((plan, index) => {
      console.log(`${index + 1}. Plan ID: ${plan.id}`);
      console.log(`   Name: ${plan.name}`);
      console.log(`   Display Name: ${plan.display_name}`);
      console.log(`   Description: ${plan.description}`);
      console.log(`   Created: ${plan.created_at}`);
      console.log('');
    });

    console.log('\n=== Checking Plan Features Table ===\n');

    // Get all plan_features with distinct plan_ids
    const planFeatures = await db.select<{
      id: string;
      plan_id: string;
      feature_id: string;
      is_enabled: boolean;
      created_at: string;
    }>('plan_features', {
      orderBy: { column: 'created_at', ascending: false },
    });

    const uniquePlanIds = [...new Set(planFeatures?.map(pf => pf.plan_id) || [])];
    console.log(`Found ${planFeatures?.length || 0} plan_features records`);
    console.log(`Unique plan IDs: ${uniquePlanIds.length}\n`);
    
    uniquePlanIds.forEach((planId, index) => {
      const count = planFeatures?.filter(pf => pf.plan_id === planId).length || 0;
      console.log(`${index + 1}. Plan ID: ${planId}`);
      console.log(`   Features count: ${count}`);
      console.log('');
    });

    console.log('\n=== Cross-Reference Check ===\n');

    // Check if plan_features plan_ids exist in plans table
    if (plans && planFeatures) {
      const planIds = new Set(plans.map(p => p.id));
      const pfPlanIds = [...new Set(planFeatures.map(pf => pf.plan_id))];
      
      console.log('Plan IDs in plans table:', planIds.size);
      console.log('Plan IDs in plan_features table:', pfPlanIds.length);
      console.log('');
      
      pfPlanIds.forEach(pfPlanId => {
        if (planIds.has(pfPlanId)) {
          const plan = plans.find(p => p.id === pfPlanId);
          console.log(`✅ ${pfPlanId.substring(0, 8)}... exists in plans as "${plan?.name}"`);
        } else {
          console.log(`❌ ${pfPlanId.substring(0, 8)}... NOT FOUND in plans table`);
        }
      });
    }
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}

checkPlans()
  .then(() => {
    console.log('\n✅ Check complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });

