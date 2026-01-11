import { NextResponse } from 'next/server';
import { checkAuth, getCurrentUser, getCurrentOrganization } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { supabaseAdmin } from '@/lib/db';
import { getPlanLimits } from '@/lib/permissions';
import { z } from 'zod';
import Stripe from 'stripe';

// Initialize Stripe (only if STRIPE_SECRET_KEY is set)
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripe = stripeSecretKey ? new Stripe(stripeSecretKey, {
  apiVersion: '2025-11-17.clover',
}) : null;

// Schema for upgrade request
const upgradeSchema = z.object({
  planId: z.string().uuid('Invalid plan ID'),
  billingPeriod: z.enum(['monthly', 'yearly']).optional().default('monthly'),
});

/**
 * POST /api/subscription/upgrade
 * Upgrade or change organization subscription plan
 */
export async function POST(request: Request) {
  try {
    const { userId } = await checkAuth();
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const user = await getCurrentUser();
    if (!user || !user.organizationId) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    // Check if user has permission to manage subscription
    // User must be able to edit organization
    const organization = await getCurrentOrganization();
    if (!organization) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const validatedData = upgradeSchema.parse(body);

    // Get target plan
    const { data: targetPlan, error: planError } = await supabaseAdmin
      .from('plans')
      .select('id, name, display_name, price_monthly, price_yearly, yearly_discount_rate, max_units, max_users, extranet_tenants_limit, is_active')
      .eq('id', validatedData.planId)
      .single();

    if (planError || !targetPlan) {
      return NextResponse.json(
        { error: 'Plan not found' },
        { status: 404 }
      );
    }

    if (!targetPlan.is_active) {
      return NextResponse.json(
        { error: 'Plan is not available' },
        { status: 400 }
      );
    }

    // Get current subscription
    const subscriptions = await db.select<{
      id: string;
      plan_id: string;
      status: string;
      billing_period: string;
      price: number;
      current_period_start: string;
      current_period_end: string;
    }>('subscriptions', {
      eq: { organization_id: user.organizationId },
      limit: 1,
    });

    const currentSubscription = subscriptions[0];

    // Get current plan
    let currentPlan: any = null;
    if (currentSubscription && currentSubscription.plan_id) {
      const { data } = await supabaseAdmin
        .from('plans')
        .select('id, name, max_units, max_users, extranet_tenants_limit')
        .eq('id', currentSubscription.plan_id)
        .single();
      currentPlan = data;
    }

    // Check subscription status - only allow upgrades for active or trialing subscriptions
    if (currentSubscription && currentSubscription.status !== 'active' && currentSubscription.status !== 'trialing') {
      return NextResponse.json(
        { 
          error: 'Cannot upgrade: subscription is not active',
          details: `Current status: ${currentSubscription.status}. Please activate your subscription first.`
        },
        { status: 400 }
      );
    }

    // Get current usage
    const lotsCount = await db.count('units', {
      organization_id: user.organizationId,
    });

    const usersCount = await db.count('users', {
      organization_id: user.organizationId,
    });

    const extranetTenants = await db.select<{ id: string }>('tenants', {
      eq: { organization_id: user.organizationId, has_extranet_access: true },
    });
    const extranetTenantsCount = extranetTenants.length;

    // Determine if this is an upgrade or downgrade based on sort_order or limits
    // For simplicity, compare by limits (higher limits = upgrade)
    const isDowngrade = currentPlan && (
      (targetPlan.max_units !== -1 && targetPlan.max_units < (currentPlan.max_units || 0)) ||
      (targetPlan.max_users !== -1 && targetPlan.max_users < (currentPlan.max_users || 0)) ||
      (targetPlan.extranet_tenants_limit !== -1 && targetPlan.extranet_tenants_limit < (currentPlan.extranet_tenants_limit || 0))
    );

    // Validate usage fits new plan limits (critical for downgrades)
    const errors: string[] = [];
    
    if (targetPlan.max_units !== -1 && targetPlan.max_units !== null) {
      if (lotsCount > targetPlan.max_units) {
        errors.push(`Vous avez ${lotsCount} lots, mais le plan ${targetPlan.display_name} autorise seulement ${targetPlan.max_units} lots. Veuillez supprimer des lots avant de changer de plan.`);
      }
    }

    if (targetPlan.max_users !== -1 && targetPlan.max_users !== null) {
      if (usersCount > targetPlan.max_users) {
        errors.push(`Vous avez ${usersCount} utilisateurs, mais le plan ${targetPlan.display_name} autorise seulement ${targetPlan.max_users} utilisateurs. Veuillez supprimer des utilisateurs avant de changer de plan.`);
      }
    }

    if (targetPlan.extranet_tenants_limit !== -1 && targetPlan.extranet_tenants_limit !== null) {
      if (extranetTenantsCount > targetPlan.extranet_tenants_limit) {
        errors.push(`Vous avez ${extranetTenantsCount} locataires avec extranet activé, mais le plan ${targetPlan.display_name} autorise seulement ${targetPlan.extranet_tenants_limit}. Veuillez désactiver l'extranet pour certains locataires avant de changer de plan.`);
      }
    }

    if (errors.length > 0) {
      return NextResponse.json(
        { 
          error: 'Cannot change plan: usage exceeds new plan limits',
          details: errors,
          isDowngrade,
          currentUsage: {
            lots: lotsCount,
            users: usersCount,
            extranetTenants: extranetTenantsCount,
          },
          targetLimits: {
            lots: targetPlan.max_units,
            users: targetPlan.max_users,
            extranetTenants: targetPlan.extranet_tenants_limit,
          }
        },
        { status: 403 }
      );
    }

    // Calculate price based on billing period
    let price = targetPlan.price_monthly || 0;
    if (validatedData.billingPeriod === 'yearly') {
      if (targetPlan.price_yearly) {
        price = targetPlan.price_yearly;
      } else if (targetPlan.yearly_discount_rate) {
        const discountMultiplier = 1 - (targetPlan.yearly_discount_rate / 100);
        price = (targetPlan.price_monthly || 0) * 12 * discountMultiplier;
      } else {
        price = (targetPlan.price_monthly || 0) * 12;
      }
    }

    // For free plans (freemium), price is 0
    if (targetPlan.price_monthly === 0 || targetPlan.price_monthly === null) {
      price = 0;
    }

    // For paid plans, create Stripe checkout session instead of direct upgrade
    if (price > 0) {
      if (!stripe) {
        return NextResponse.json(
          { error: 'Stripe is not configured. Please set STRIPE_SECRET_KEY environment variable.' },
          { status: 500 }
        );
      }

      // Get or create Stripe customer
      let customerId = currentSubscription?.stripe_customer_id || organization.stripeCustomerId;
      
      if (!customerId) {
        // Create Stripe customer
        const customer = await stripe.customers.create({
          email: user.email || organization.contactEmail || undefined,
          name: organization.name || undefined,
          metadata: {
            organizationId: user.organizationId,
            userId: user.id,
          },
        });

        customerId = customer.id;

        // Save customer ID to organization
        await db.update('organizations', {
          stripe_customer_id: customerId,
          updated_at: new Date().toISOString(),
        }, { id: user.organizationId });
      }

      // Get base URL
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

      // Create Stripe Checkout session
      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ['card'],
        mode: 'subscription',
        line_items: [
          {
            price_data: {
              currency: 'xof', // FCFA
              product_data: {
                name: `${targetPlan.display_name} - ${validatedData.billingPeriod === 'yearly' ? 'Annuel' : 'Mensuel'}`,
                description: `Plan ${targetPlan.display_name}`,
              },
              unit_amount: Math.round(price * 100), // Convert to cents (XOF doesn't use decimals, but Stripe expects smallest unit)
              recurring: {
                interval: validatedData.billingPeriod === 'yearly' ? 'year' : 'month',
              },
            },
            quantity: 1,
          },
        ],
        success_url: `${baseUrl}/settings/subscription?success=true&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${baseUrl}/settings/subscription?canceled=true`,
        metadata: {
          organizationId: user.organizationId,
          planId: validatedData.planId,
          billingPeriod: validatedData.billingPeriod,
          upgrade: 'true',
        },
        subscription_data: {
          metadata: {
            organizationId: user.organizationId,
            planId: validatedData.planId,
            upgrade: 'true',
          },
        },
      });

      return NextResponse.json({
        requiresPayment: true,
        checkoutUrl: session.url,
        sessionId: session.id,
        message: 'Redirecting to payment...',
      });
    }

    // Update or create subscription
    if (currentSubscription) {
      // Update existing subscription
      const updateData: any = {
        plan_id: validatedData.planId,
        billing_period: validatedData.billingPeriod,
        price: price,
        updated_at: new Date().toISOString(),
        // Reset cancellation if upgrading
        cancel_at_period_end: false,
        canceled_at: null,
      };

      // If upgrading (not freemium), ensure status is active
      if (price > 0 && currentSubscription.status !== 'active') {
        updateData.status = 'active';
      }

      await db.update('subscriptions', updateData, { id: currentSubscription.id });
    } else {
      // Create new subscription
      const now = new Date();
      const periodEnd = new Date(now);
      if (validatedData.billingPeriod === 'yearly') {
        periodEnd.setFullYear(periodEnd.getFullYear() + 1);
      } else {
        periodEnd.setMonth(periodEnd.getMonth() + 1);
      }

      await db.insertOne('subscriptions', {
        organization_id: user.organizationId,
        plan_id: validatedData.planId,
        billing_period: validatedData.billingPeriod,
        price: price,
        status: price > 0 ? 'active' : 'active', // Freemium is also active
        start_date: now.toISOString().split('T')[0],
        current_period_start: now.toISOString().split('T')[0],
        current_period_end: periodEnd.toISOString().split('T')[0],
        currency: 'XOF',
      });
    }

    // Get updated subscription
    const updatedSubscriptions = await db.select<{
      id: string;
      plan_id: string;
      status: string;
      billing_period: string;
      price: number;
      created_at: string;
    }>('subscriptions', {
      eq: { organization_id: user.organizationId },
      limit: 1,
    });

    const updatedSubscription = updatedSubscriptions[0];

    return NextResponse.json({
      success: true,
      message: isDowngrade 
        ? `Plan changé vers ${targetPlan.display_name}. Veuillez noter que certaines fonctionnalités peuvent ne plus être disponibles.`
        : `Plan mis à niveau vers ${targetPlan.display_name} avec succès!`,
      subscription: {
        id: updatedSubscription.id,
        planId: updatedSubscription.plan_id,
        planName: targetPlan.name,
        planDisplayName: targetPlan.display_name,
        status: updatedSubscription.status,
        billingPeriod: updatedSubscription.billing_period,
        price: updatedSubscription.price,
        isDowngrade,
      },
    });

  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      );
    }

    console.error('Error upgrading subscription:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to upgrade subscription' },
      { status: 500 }
    );
  }
}
