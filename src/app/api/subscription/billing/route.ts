import { NextResponse } from 'next/server';
import { checkAuth } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { organizations, users, units, tenants, plans, subscriptions } from '@/db/schema';
import { eq, count, and, desc } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth-helpers';

/**
 * GET /api/subscription/billing
 * Get billing and subscription information
 */
export async function GET() {
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

    // Get organization
    const orgRecords = await db
      .select({
        id: organizations.id,
        name: organizations.name,
        extranetTenantsCount: organizations.extranetTenantsCount,
        stripeCustomerId: organizations.stripeCustomerId,
      })
      .from(organizations)
      .where(eq(organizations.id, user.organizationId))
      .limit(1);

    const organization = orgRecords[0];
    if (!organization) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    // Get active subscription with plan details
    // First try to get active subscription, if not found, get the most recent one
    let subscriptionRecords = await db
      .select({
        id: subscriptions.id,
        planId: subscriptions.planId,
        billingPeriod: subscriptions.billingPeriod,
        price: subscriptions.price,
        currency: subscriptions.currency,
        status: subscriptions.status,
        currentPeriodStart: subscriptions.currentPeriodStart,
        currentPeriodEnd: subscriptions.currentPeriodEnd,
        startDate: subscriptions.startDate,
        endDate: subscriptions.endDate,
        cancelAtPeriodEnd: subscriptions.cancelAtPeriodEnd,
        trialStart: subscriptions.trialStart,
        trialEnd: subscriptions.trialEnd,
        createdAt: subscriptions.createdAt,
        planName: plans.name,
        planDisplayName: plans.displayName,
        planPrice: plans.price,
        lotsLimit: plans.lotsLimit,
        usersLimit: plans.usersLimit,
        extranetTenantsLimit: plans.extranetTenantsLimit,
      })
      .from(subscriptions)
      .leftJoin(plans, eq(subscriptions.planId, plans.id))
      .where(
        and(
          eq(subscriptions.organizationId, user.organizationId),
          eq(subscriptions.status, 'active')
        )
      )
      .orderBy(desc(subscriptions.createdAt))
      .limit(1);

    let subscription = subscriptionRecords[0];

    // If no active subscription, get the most recent one (could be trialing, expired, etc.)
    if (!subscription) {
      subscriptionRecords = await db
        .select({
          id: subscriptions.id,
          planId: subscriptions.planId,
          billingPeriod: subscriptions.billingPeriod,
          price: subscriptions.price,
          currency: subscriptions.currency,
          status: subscriptions.status,
          currentPeriodStart: subscriptions.currentPeriodStart,
          currentPeriodEnd: subscriptions.currentPeriodEnd,
          startDate: subscriptions.startDate,
          endDate: subscriptions.endDate,
          cancelAtPeriodEnd: subscriptions.cancelAtPeriodEnd,
          trialStart: subscriptions.trialStart,
          trialEnd: subscriptions.trialEnd,
          createdAt: subscriptions.createdAt,
          planName: plans.name,
          planDisplayName: plans.displayName,
          planPrice: plans.price,
          lotsLimit: plans.lotsLimit,
          usersLimit: plans.usersLimit,
          extranetTenantsLimit: plans.extranetTenantsLimit,
        })
        .from(subscriptions)
        .leftJoin(plans, eq(subscriptions.planId, plans.id))
        .where(eq(subscriptions.organizationId, user.organizationId))
        .orderBy(desc(subscriptions.createdAt))
        .limit(1);

      subscription = subscriptionRecords[0];
    }

    // If still no subscription, try to get default freemium plan
    if (!subscription) {
      const freemiumPlan = await db
        .select()
        .from(plans)
        .where(eq(plans.name, 'freemium'))
        .limit(1);

      if (freemiumPlan[0]) {
        subscription = {
          id: null,
          planId: freemiumPlan[0].id,
          billingPeriod: 'monthly' as const,
          price: '0',
          currency: 'XOF',
          status: 'active' as const,
          currentPeriodStart: new Date().toISOString().split('T')[0],
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          startDate: new Date().toISOString().split('T')[0],
          endDate: null,
          cancelAtPeriodEnd: false,
          trialStart: null,
          trialEnd: null,
          createdAt: new Date(),
          planName: freemiumPlan[0].name,
          planDisplayName: freemiumPlan[0].displayName,
          planPrice: freemiumPlan[0].price,
          lotsLimit: freemiumPlan[0].lotsLimit,
          usersLimit: freemiumPlan[0].usersLimit,
          extranetTenantsLimit: freemiumPlan[0].extranetTenantsLimit,
        };
      }
    }

    // Get current usage
    const [lotsCount] = await db
      .select({ count: count() })
      .from(units)
      .where(eq(units.organizationId, user.organizationId));

    const [usersCount] = await db
      .select({ count: count() })
      .from(users)
      .where(eq(users.organizationId, user.organizationId));

    const extranetTenantsCount = organization.extranetTenantsCount || 0;

    // Get payment history (mock for now - in production, this would come from Stripe or payment records)
    const paymentHistory = [
      {
        id: '1',
        date: '2024-12-15',
        description: `${subscription?.planDisplayName || 'Plan'} - Décembre 2024`,
        amount: parseFloat(subscription?.price?.toString() || '0'),
        status: 'paid',
        invoiceUrl: '#',
      },
      {
        id: '2',
        date: '2024-11-15',
        description: `${subscription?.planDisplayName || 'Plan'} - Novembre 2024`,
        amount: parseFloat(subscription?.price?.toString() || '0'),
        status: 'paid',
        invoiceUrl: '#',
      },
      {
        id: '3',
        date: '2024-10-15',
        description: `${subscription?.planDisplayName || 'Plan'} - Octobre 2024`,
        amount: parseFloat(subscription?.price?.toString() || '0'),
        status: 'paid',
        invoiceUrl: '#',
      },
    ];

    return NextResponse.json({
      subscription: subscription ? {
        id: subscription.id,
        planId: subscription.planId,
        planName: subscription.planName,
        planDisplayName: subscription.planDisplayName,
        billingPeriod: subscription.billingPeriod,
        price: parseFloat(subscription.price?.toString() || '0'),
        currency: subscription.currency || 'XOF',
        status: subscription.status,
        currentPeriodStart: subscription.currentPeriodStart,
        currentPeriodEnd: subscription.currentPeriodEnd,
        startDate: subscription.startDate,
        endDate: subscription.endDate,
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd || false,
        trialStart: subscription.trialStart,
        trialEnd: subscription.trialEnd,
        limits: {
          lots: subscription.lotsLimit,
          users: subscription.usersLimit,
          extranetTenants: subscription.extranetTenantsLimit,
        },
      } : null,
      organization: {
        id: organization.id,
        name: organization.name,
        extranetTenantsCount: organization.extranetTenantsCount || 0,
      },
      usage: {
        lots: lotsCount?.count || 0,
        users: usersCount?.count || 0,
        extranetTenants: extranetTenantsCount,
      },
      paymentHistory,
      paymentMethod: {
        type: 'card',
        last4: '4532',
        expiryMonth: 12,
        expiryYear: 2027,
        brand: 'visa',
      },
    });
  } catch (error) {
    console.error('Error fetching billing information:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

