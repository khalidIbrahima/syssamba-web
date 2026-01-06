import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { supabaseAdmin } from '@/lib/supabase-db';

/**
 * POST /api/webhooks/supabase
 * Webhook handler for Supabase Auth events
 * Handles user creation, updates, and deletion
 */
export async function POST(req: NextRequest) {
  try {
    // Verify webhook signature (if configured)
    // For now, we'll trust requests from Supabase
    // In production, you should verify the webhook signature
    
    const body = await req.json();
    const { type, record } = body;

    console.log('[Supabase Webhook] Received event:', type, record?.id);

    switch (type) {
      case 'INSERT': // New user created in auth.users
        if (record?.table === 'auth.users' || record?.schema === 'auth') {
          const authUser = record;
          
          // Generate organization name from user's name or email
          const firstName = authUser.raw_user_meta_data?.first_name || authUser.user_metadata?.first_name || '';
          const lastName = authUser.raw_user_meta_data?.last_name || authUser.user_metadata?.last_name || '';
          const orgName = `${firstName} ${lastName}`.trim() || authUser.email?.split('@')[0] || 'My Organization';
          
          // Generate a unique slug and subdomain for the organization
          const baseSlug = orgName
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '')
            .substring(0, 50); // Limit length

          let slug = baseSlug;
          let subdomain = baseSlug;
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
          const organization = await db.insertOne<{
            id: string;
            name: string;
            slug: string;
            subdomain: string;
            type: string;
            country: string;
            is_configured: boolean;
            created_at: string;
            updated_at: string;
          }>('organizations', {
            name: orgName,
            slug,
            subdomain,
            type: 'individual', // Default type
            country: 'SN', // Default country (Senegal)
            is_configured: false, // Not fully configured yet
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });

          if (!organization) {
            console.error(`[Supabase Webhook] Failed to create organization for user: ${authUser.id}`);
          }
          
          // Note: We use existing global system profiles instead of creating organization-specific profiles
          // Global profiles (is_global = TRUE, organization_id = NULL) are shared across all organizations
          
          // Get System Administrator profile ID (global profile)
          const systemAdminProfile = await db.selectOne<{
            id: string;
            name: string;
          }>('profiles', {
            eq: { name: 'System Administrator', is_global: true },
          });

          if (!systemAdminProfile || !systemAdminProfile.id) {
            console.error(`[Supabase Webhook] System Administrator profile not found! Cannot assign profile to user: ${authUser.id}`);
            // Don't fail the webhook, but log the error
          } else {
            console.log(`[Supabase Webhook] Found System Administrator profile: ${systemAdminProfile.id} for user: ${authUser.id}`);
          }

          // Create user in database with organization ID
          const newUser = await db.insertOne<{
            id: string;
            sb_user_id: string | null;
            email: string | null;
            phone: string | null;
            first_name: string | null;
            last_name: string | null;
            role: string;
            is_active: boolean;
            profile_id: string | null;
            organization_id: string | null;
          }>('users', {
            id: authUser.id, // Use Supabase auth user ID as primary key
            sb_user_id: authUser.id,
            email: authUser.email || null,
            phone: authUser.phone || null,
            first_name: firstName || null,
            last_name: lastName || null,
            role: authUser.raw_user_meta_data?.role || authUser.user_metadata?.role || 'owner', // New signups are owners
            is_active: authUser.email_confirmed_at ? true : false, // Active if email confirmed
            profile_id: systemAdminProfile?.id || null, // Assign System Administrator profile (null if not found)
            organization_id: organization?.id || null,
          });

          console.log(`[Supabase Webhook] User created in database: ${authUser.id}${organization ? ` with organization: ${organization.id}` : ' (organization creation failed)'}`);
        }
        break;

      case 'UPDATE': // User updated in auth.users
        if (record?.table === 'auth.users' || record?.schema === 'auth') {
          const authUser = record;
          
          // Update user in database
          await db.update('users', {
            eq: { sb_user_id: authUser.id },
          }, {
            email: authUser.email || null,
            phone: authUser.phone || null,
            first_name: authUser.raw_user_meta_data?.first_name || authUser.user_metadata?.first_name || null,
            last_name: authUser.raw_user_meta_data?.last_name || authUser.user_metadata?.last_name || null,
            is_active: authUser.email_confirmed_at ? true : false,
          });

          console.log(`[Supabase Webhook] User updated in database: ${authUser.id}`);
        }
        break;

      case 'DELETE': // User deleted from auth.users
        if (record?.table === 'auth.users' || record?.schema === 'auth') {
          const authUserId = record.id;
          
          // Delete user from database (or mark as inactive)
          await db.update('users', {
            eq: { sb_user_id: authUserId },
          }, {
            is_active: false,
          });

          // Or hard delete:
          // await db.delete('users', { eq: { sb_user_id: authUserId } });

          console.log(`[Supabase Webhook] User deactivated in database: ${authUserId}`);
        }
        break;

      default:
        console.log('[Supabase Webhook] Unhandled event type:', type);
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error('[Supabase Webhook] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

