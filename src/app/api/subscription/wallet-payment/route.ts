import { NextResponse } from 'next/server';
import { checkAuth, getCurrentUser, getCurrentOrganization } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { supabaseAdmin } from '@/lib/db';
import { z } from 'zod';
import { stripe } from '@/lib/stripe-helpers';

// Schema for wallet payment request
const walletPaymentSchema = z.object({
  planId: z.string().uuid('Invalid plan ID'),
  billingPeriod: z.enum(['monthly', 'yearly']).optional().default('monthly'),
  paymentMethod: z.enum(['wave', 'orange_money']),
  phoneNumber: z.string().min(9, 'Numéro de téléphone invalide'),
});

/**
 * POST /api/subscription/wallet-payment
 * Process wallet payment (Wave, Orange Money) for subscription
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

    const organization = await getCurrentOrganization();
    if (!organization) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const validatedData = walletPaymentSchema.parse(body);

    // Get target plan
    const { data: targetPlan, error: planError } = await supabaseAdmin
      .from('plans')
      .select('id, name, display_name, price_monthly, price_yearly, yearly_discount_rate, is_active')
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

    // Get TVA rate from countries table
    let tvaRate = 0.00;
    const clientCountry = organization.country || 'SN';
    
    if (clientCountry === 'SN') {
      const { data: countryData, error: countryError } = await supabaseAdmin
        .from('countries')
        .select('tva')
        .eq('code', 'SN')
        .single();
      
      if (!countryError && countryData && countryData.tva !== null) {
        tvaRate = parseFloat(countryData.tva.toString());
      } else {
        tvaRate = 18.00;
      }
    }

    // TODO: Integrate with Wave/Orange Money API
    // For now, create a subscription record with status 'pending' or 'processing'
    // The actual payment processing should be handled by the wallet provider's API

    // Get or create subscription
    const subscriptions = await db.select<{
      id: string;
      plan_id: string;
      status: string;
    }>('subscriptions', {
      eq: { organization_id: user.organizationId },
      limit: 1,
    });

    const existingSubscription = subscriptions[0];

    if (existingSubscription) {
      // Update existing subscription
      await db.update('subscriptions', {
        plan_id: validatedData.planId,
        billing_period: validatedData.billingPeriod,
        price: price,
        status: 'pending', // Payment is pending wallet confirmation
        updated_at: new Date().toISOString(),
      }, { id: existingSubscription.id });
    } else {
      // Create new subscription
      await db.insertOne('subscriptions', {
        organization_id: user.organizationId,
        plan_id: validatedData.planId,
        billing_period: validatedData.billingPeriod,
        price: price,
        status: 'pending', // Payment is pending wallet confirmation
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }

    // TODO: Call Wave/Orange Money API to process payment
    // Example structure:
    // const walletResponse = await processWalletPayment({
    //   provider: validatedData.paymentMethod,
    //   phoneNumber: validatedData.phoneNumber,
    //   amount: price,
    //   currency: 'XOF',
    // });

    // For now, return success (actual integration needed)
    return NextResponse.json({
      success: true,
      message: `Paiement ${validatedData.paymentMethod === 'wave' ? 'Wave' : 'Orange Money'} initié avec succès`,
      payment: {
        method: validatedData.paymentMethod,
        phoneNumber: validatedData.phoneNumber,
        amount: price,
        status: 'processing',
      },
    });

  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      );
    }

    console.error('Error processing wallet payment:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process wallet payment' },
      { status: 500 }
    );
  }
}
