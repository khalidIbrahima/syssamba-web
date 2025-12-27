import { NextResponse } from 'next/server';
import { checkAuth } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { getPlanFromDB } from '@/lib/plans-db';
import { getCurrentUser } from '@/lib/auth-helpers';
import { createDefaultProfilesForOrganization, assignProfileToUser, getProfiles } from '@/lib/profiles';

/**
 * POST /api/organization/setup
 * Setup organization for a new user
 */
export async function POST(req: Request) {
  try {
    const { userId } = await checkAuth();
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { organizationName, organizationType, country, planName, billingPeriod } = body;

    if (!organizationName || !planName || !country) {
      return NextResponse.json(
        { error: 'Organization name, country, and plan are required' },
        { status: 400 }
      );
    }

    // Get user from database
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Check if user already has an organization
    if (user.organizationId) {
      const existingOrg = await db.selectOne<{
        id: string;
        is_configured: boolean;
      }>('organizations', {
        eq: { id: user.organizationId },
      });

      if (existingOrg?.is_configured) {
        return NextResponse.json(
          { error: 'Organization already configured' },
          { status: 400 }
        );
      }
    }

    // Get plan from database
    const plan = await getPlanFromDB(planName);
    if (!plan) {
      return NextResponse.json(
        { error: 'Plan not found' },
        { status: 404 }
      );
    }

    // Get plan record for planId
    const planRecord = await db.selectOne<{
      id: string;
      name: string;
    }>('plans', {
      eq: { name: planName },
    });

    if (!planRecord) {
      return NextResponse.json(
        { error: 'Plan record not found in database' },
        { status: 404 }
      );
    }

    // Generate slug from organization name
    const slug = organizationName
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .substring(0, 50);

    // Check if slug already exists
    const existingSlug = await db.selectOne('organizations', {
      eq: { slug },
    });

    let finalSlug = slug;
    if (existingSlug) {
      finalSlug = `${slug}-${Date.now()}`;
    }

    // Calculate price based on billing period
    let subscriptionPrice = 0;
    if (plan.price !== 'custom' && plan.price !== null) {
      subscriptionPrice = billingPeriod === 'yearly' 
        ? Math.round(plan.price * 12 * 0.8) // 20% discount for yearly
        : plan.price;
    }

    // Validate organization type
    const validOrgTypes = ['agency', 'sci', 'syndic', 'individual'];
    if (!validOrgTypes.includes(organizationType)) {
      return NextResponse.json(
        { error: 'Invalid organization type' },
        { status: 400 }
      );
    }

    // Prepare organization data
    // Note: planId and limits are stored in subscriptions table, not here
    const orgData = {
      name: organizationName,
      slug: finalSlug,
      type: organizationType as 'agency' | 'sci' | 'syndic' | 'individual',
      country: country,
      isConfigured: true,
    };

    // Create or update organization
    let organization;
    if (user.organizationId) {
      // Update existing organization
      const updatedOrg = await db.updateOne<{
        id: string;
        name: string;
        slug: string;
        type: string;
        country: string;
        is_configured: boolean;
        updated_at: Date | string;
      }>(
        'organizations',
        {
          name: orgData.name,
          slug: finalSlug,
          type: orgData.type,
          country: orgData.country,
          is_configured: orgData.isConfigured,
          updated_at: new Date().toISOString(),
        },
        { id: user.organizationId }
      );

      if (!updatedOrg) {
        return NextResponse.json(
          { error: 'Failed to update organization' },
          { status: 500 }
        );
      }

      organization = {
        id: updatedOrg.id,
        name: updatedOrg.name,
        slug: updatedOrg.slug,
      };

      // If updating existing organization, ensure user has admin profile
      // (in case profiles were created after organization was created)
      try {
        // Get System Administrator profile (global profile)
        // Use direct Supabase query for NULL values
        const { supabaseAdmin } = await import('@/lib/supabase-db');
        const { data: systemAdminProfile } = await supabaseAdmin
          .from('profiles')
          .select('id, name')
          .eq('name', 'System Administrator')
          .is('organization_id', null)
          .single();
        
        if (systemAdminProfile) {
          const currentUser = await db.selectOne<{
            profile_id: string | null;
          }>('users', {
            eq: { id: user.id },
          });
          
          // Only assign if user doesn't have a profile yet
          if (!currentUser?.profile_id) {
            await assignProfileToUser(user.id, systemAdminProfile.id);
            console.log(`Assigned System Administrator profile to user ${user.id} during organization update`);
          }
        }
      } catch (profileError) {
        console.error('Error assigning profile during organization update:', profileError);
        // Don't fail the update
      }
    } else {
      // Create new organization
      const newOrg = await db.insertOne<{
        id: string;
        name: string;
        slug: string;
        type: string;
        country: string;
        is_configured: boolean;
      }>('organizations', {
        name: orgData.name,
        slug: finalSlug,
        type: orgData.type,
        country: orgData.country,
        is_configured: orgData.isConfigured,
      });

      if (!newOrg) {
        return NextResponse.json(
          { error: 'Failed to create organization' },
          { status: 500 }
        );
      }

      organization = {
        id: newOrg.id,
        name: newOrg.name,
        slug: newOrg.slug,
      };

      // Update user with organization ID
      await db.update('users', {
        organization_id: organization.id,
          role: 'owner', // First user is owner
      }, { id: user.id });

      // Create default profiles for the new organization
      try {
        await createDefaultProfilesForOrganization(organization.id);
        
        // Assign "System Administrator" profile (global) to the user who created the organization
        // Use direct Supabase query for NULL values
        const { supabaseAdmin } = await import('@/lib/supabase-db');
        const { data: systemAdminProfile } = await supabaseAdmin
          .from('profiles')
          .select('id, name')
          .eq('name', 'System Administrator')
          .is('organization_id', null)
          .single();
        
        if (systemAdminProfile) {
          await assignProfileToUser(user.id, systemAdminProfile.id);
          console.log(`Assigned System Administrator profile to user ${user.id}`);
        } else {
          console.warn(`System Administrator profile not found (global profile should exist)`);
        }
      } catch (profileError) {
        console.error('Error creating default profiles or assigning profile:', profileError);
        // Don't fail the organization creation if profiles fail
        // They can be created later
      }
    }

    // Create subscription
    const startDate = new Date();
    const endDate = billingPeriod === 'yearly'
      ? new Date(startDate.getFullYear() + 1, startDate.getMonth(), startDate.getDate())
      : new Date(startDate.getFullYear(), startDate.getMonth() + 1, startDate.getDate());

    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];

    try {
      await db.insert('subscriptions', {
        organization_id: organization.id,
        plan_id: planRecord.id,
        billing_period: billingPeriod as 'monthly' | 'yearly',
        price: subscriptionPrice.toString(),
        currency: 'XOF',
        status: planName === 'freemium' ? 'active' : 'trialing', // Freemium is active, paid plans start with trial
        start_date: startDateStr,
        current_period_start: startDateStr,
        current_period_end: endDateStr,
        trial_start: planName !== 'freemium' ? startDateStr : null,
        trial_end: planName !== 'freemium' ? endDateStr : null,
      });
    } catch (subscriptionError: any) {
      console.error('Error creating subscription:', subscriptionError);
      // If subscription creation fails, we should still return success
      // as the organization is configured. Subscription can be created later.
      console.warn('Subscription creation failed, but organization is configured');
    }

    return NextResponse.json({
      success: true,
      organization: {
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
      },
    });
  } catch (error: any) {
    console.error('Error setting up organization:', error);
    console.error('Error details:', {
      message: error?.message,
      stack: error?.stack,
      name: error?.name,
      code: error?.code,
      constraint: error?.constraint,
      detail: error?.detail,
    });
    
    // Provide more specific error messages
    let errorMessage = 'Internal server error';
    if (error?.code === '23505') { // Unique constraint violation
      errorMessage = 'Cette organisation existe déjà. Veuillez choisir un autre nom.';
    } else if (error?.code === '23503') { // Foreign key violation
      errorMessage = 'Erreur de référence. Veuillez réessayer.';
    } else if (error?.message) {
      errorMessage = error.message;
    }
    
    return NextResponse.json(
      { 
        error: errorMessage,
        details: process.env.NODE_ENV === 'development' ? {
          message: error?.message,
          code: error?.code,
          constraint: error?.constraint,
          detail: error?.detail,
        } : undefined,
      },
      { status: 500 }
    );
  }
}

