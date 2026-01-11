import { NextRequest, NextResponse } from 'next/server';
import { checkAuth, getCurrentUser } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { z } from 'zod';
import { notifySuperAdmins } from '@/lib/admin-notifications';

// Validation schema for setup data
const setupSchema = z.object({
  organizationName: z.string().min(1, 'Le nom de l\'organisation est requis'),
  organizationType: z.enum(['individual', 'agency', 'sci', 'syndic']),
  country: z.string().min(1, 'Le pays est requis'),
  planName: z.string().min(1, 'Le nom du plan est requis'),
  billingPeriod: z.enum(['monthly', 'yearly']),
  // Contact information (optional)
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional().or(z.literal('')),
  phone2: z.string().optional().or(z.literal('')),
  address: z.string().optional().or(z.literal('')),
  city: z.string().optional().or(z.literal('')),
  postalCode: z.string().optional().or(z.literal('')),
  state: z.string().optional().or(z.literal('')),
});

/**
 * POST /api/organization/setup
 * Complete organization setup for a new user
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await checkAuth();

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Validate request body
    const body = await request.json();
    const validatedData = setupSchema.parse(body);

    // Check if user already has an organization
    let organization = null;
    if (user.organizationId) {
      // Get existing organization to check if it's configured
      organization = await db.selectOne<{
        id: string;
        is_configured: boolean;
      }>('organizations', {
        eq: { id: user.organizationId },
      });

      // If organization is already configured, don't allow setup
      if (organization && organization.is_configured) {
        return NextResponse.json(
          { error: 'Organization is already configured' },
          { status: 400 }
        );
      }
    }

    // If organization exists but is not configured, update it
    if (organization && !organization.is_configured) {
      // Generate a unique slug and subdomain for the organization
      const baseSlug = validatedData.organizationName
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');

      let slug = baseSlug;
      let subdomain = baseSlug;
      let counter = 1;

      // Ensure both slug and subdomain uniqueness (excluding current org)
      while (true) {
        const existingBySlug = await db.selectOne<{ id: string }>('organizations', {
          eq: { slug },
        });
        
        const existingBySubdomain = await db.selectOne<{ id: string }>('organizations', {
          eq: { subdomain },
        });

        // If slug/subdomain is taken by a different organization, try next
        if ((!existingBySlug || existingBySlug.id === organization.id) && 
            (!existingBySubdomain || existingBySubdomain.id === organization.id)) {
          break;
        }

        slug = `${baseSlug}-${counter}`;
        subdomain = `${baseSlug}-${counter}`;
        counter++;
      }

      // Update the existing organization
      const updateData: any = {
        name: validatedData.organizationName,
        slug,
        subdomain,
        type: validatedData.organizationType,
        country: validatedData.country,
        is_configured: true,
        updated_at: new Date().toISOString(),
      };

      // Add contact information if provided
      if (validatedData.email) updateData.contact_email = validatedData.email;
      if (validatedData.phone) updateData.phone = validatedData.phone;
      if (validatedData.phone2) updateData.phone2 = validatedData.phone2;
      if (validatedData.address) updateData.address = validatedData.address;
      if (validatedData.city) updateData.city = validatedData.city;
      if (validatedData.postalCode) updateData.postal_code = validatedData.postalCode;
      if (validatedData.state) updateData.state = validatedData.state;

      const updatedOrg = await db.updateOne<{
        id: string;
        name: string;
        slug: string;
        subdomain: string;
        type: string;
        country: string;
        is_configured: boolean;
        updated_at: string;
      }>('organizations', updateData, {
        id: organization.id,
      });

      if (!updatedOrg) {
        return NextResponse.json(
          { error: 'Failed to update organization' },
          { status: 500 }
        );
      }

      organization = updatedOrg;
    } else {
      // Create new organization
      // Generate a unique slug and subdomain for the organization
      const baseSlug = validatedData.organizationName
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');

      let slug = baseSlug;
      let subdomain = baseSlug; // Use same value for subdomain
      let counter = 1;

      // Ensure both slug and subdomain uniqueness
      while (true) {
        // Check if slug exists
        const existingBySlug = await db.selectOne<{ id: string }>('organizations', {
          eq: { slug },
        });
        
        // Check if subdomain exists
        const existingBySubdomain = await db.selectOne<{ id: string }>('organizations', {
          eq: { subdomain },
        });

        if (!existingBySlug && !existingBySubdomain) break;

        slug = `${baseSlug}-${counter}`;
        subdomain = `${baseSlug}-${counter}`;
        counter++;
      }

      // Create the organization
      const insertData: any = {
        name: validatedData.organizationName,
        slug,
        subdomain,
        type: validatedData.organizationType,
        country: validatedData.country,
        is_configured: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Add contact information if provided
      if (validatedData.email) insertData.contact_email = validatedData.email;
      if (validatedData.phone) insertData.phone = validatedData.phone;
      if (validatedData.phone2) insertData.phone2 = validatedData.phone2;
      if (validatedData.address) insertData.address = validatedData.address;
      if (validatedData.city) insertData.city = validatedData.city;
      if (validatedData.postalCode) insertData.postal_code = validatedData.postalCode;
      if (validatedData.state) insertData.state = validatedData.state;

      organization = await db.insertOne<{
        id: string;
        name: string;
        slug: string;
        subdomain: string;
        type: string;
        country: string;
        is_configured: boolean;
        created_at: string;
        updated_at: string;
      }>('organizations', insertData);

      if (!organization) {
        return NextResponse.json(
          { error: 'Failed to create organization' },
          { status: 500 }
        );
      }

      // Update user with organization ID if they don't have one
      if (!user.organizationId) {
        const updatedUser = await db.update('users', {
          organization_id: organization.id,
          updated_at: new Date().toISOString(),
        }, {
          eq: { id: user.id },
        });

        if (!updatedUser) {
          return NextResponse.json(
            { error: 'Failed to update user organization' },
            { status: 500 }
          );
        }
      }

      // Notify super admins that a new organization was created
      await notifySuperAdmins('organization_created', {
        organizationId: organization.id,
        organizationName: organization.name,
      });
    }

    // Create subscription for the organization
    try {
      // Get plan details by name
      const plan = await db.selectOne<{
        id: string;
        name: string;
        price_monthly: number | null;
        price_yearly: number | null;
      }>('plans', {
        eq: { name: validatedData.planName },
      });

      if (!plan || !plan.id) {
        console.error(`[Setup] Plan not found: ${validatedData.planName}`);
        // Continue without subscription - user can set it up later
      } else {
        // Calculate price based on billing period
        const price = validatedData.billingPeriod === 'yearly' 
          ? (plan.price_yearly || (plan.price_monthly ? plan.price_monthly * 12 * 0.8 : 0))
          : (plan.price_monthly || 0);

        // Calculate period dates
        const now = new Date();
        const startDate = now.toISOString().split('T')[0]; // YYYY-MM-DD format
        
        let periodEnd: Date;
        if (validatedData.billingPeriod === 'yearly') {
          periodEnd = new Date(now);
          periodEnd.setFullYear(periodEnd.getFullYear() + 1);
        } else {
          periodEnd = new Date(now);
          periodEnd.setMonth(periodEnd.getMonth() + 1);
        }
        const periodEndDate = periodEnd.toISOString().split('T')[0];

        // Check if subscription already exists
        const existingSubscriptions = await db.select<{
          id: string;
        }>('subscriptions', {
          eq: { organization_id: organization.id },
          limit: 1,
        });

        if (existingSubscriptions.length === 0) {
          // Create new subscription
          const subscription = await db.insertOne<{
            id: string;
            organization_id: string;
            plan_id: string;
            billing_period: string;
            price: number;
            currency: string;
            status: string;
            start_date: string;
            current_period_start: string;
            current_period_end: string;
            created_at: string;
            updated_at: string;
          }>('subscriptions', {
            organization_id: organization.id,
            plan_id: plan.id,
            billing_period: validatedData.billingPeriod,
            price: price,
            currency: 'XOF', // West African CFA franc
            status: validatedData.planName === 'freemium' ? 'active' : 'trialing', // Start with trialing for paid plans
            start_date: startDate,
            current_period_start: startDate,
            current_period_end: periodEndDate,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });

          if (subscription) {
            console.log(`[Setup] Created subscription for organization ${organization.id} with plan ${validatedData.planName}`);
            
            // Notify super admins that a new subscription was created
            await notifySuperAdmins('subscription_created', {
              organizationId: organization.id,
              organizationName: organization.name,
              subscriptionId: subscription.id,
              planName: validatedData.planName,
            });
          } else {
            console.error(`[Setup] Failed to create subscription for organization ${organization.id}`);
          }
        } else {
          // Update existing subscription
          await db.update('subscriptions', {
            plan_id: plan.id,
            billing_period: validatedData.billingPeriod,
            price: price,
            status: validatedData.planName === 'freemium' ? 'active' : 'trialing',
            current_period_start: startDate,
            current_period_end: periodEndDate,
            updated_at: new Date().toISOString(),
          }, {
            eq: { id: existingSubscriptions[0].id },
          });
          console.log(`[Setup] Updated subscription for organization ${organization.id} with plan ${validatedData.planName}`);
        }
      }
    } catch (error) {
      console.error('[Setup] Error creating subscription:', error);
      // Don't fail setup if subscription creation fails - user can set it up later
    }

    const MAIN_DOMAIN = process.env.NEXT_PUBLIC_MAIN_DOMAIN || 'syssamba.com';
    const IS_DEVELOPMENT = process.env.NODE_ENV === 'development';
    
    return NextResponse.json({
      success: true,
      organization: {
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        subdomain: organization.subdomain,
        type: organization.type,
        country: organization.country,
      },
      // Don't return subdomainUrl in development mode
      subdomainUrl: IS_DEVELOPMENT ? null : `https://${organization.subdomain}.${MAIN_DOMAIN}`,
      message: 'Organisation configurée avec succès',
      redirectTo: '/dashboard', // Explicit redirect path
    });

  } catch (error) {
    console.error('Organization setup error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Données invalides', details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Erreur interne du serveur' },
      { status: 500 }
    );
  }
}
