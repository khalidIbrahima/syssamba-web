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
          
          // Create user in database
          const newUser = await db.insertOne<{
            id: string;
            sb_user_id: string | null;
            email: string | null;
            phone: string | null;
            first_name: string | null;
            last_name: string | null;
            role: string;
            is_active: boolean;
            organization_id: string | null;
          }>('users', {
            id: authUser.id, // Use Supabase auth user ID as primary key
            sb_user_id: authUser.id,
            email: authUser.email || null,
            phone: authUser.phone || null,
            first_name: authUser.raw_user_meta_data?.first_name || authUser.user_metadata?.first_name || null,
            last_name: authUser.raw_user_meta_data?.last_name || authUser.user_metadata?.last_name || null,
            role: authUser.raw_user_meta_data?.role || authUser.user_metadata?.role || 'viewer',
            is_active: authUser.email_confirmed_at ? true : false, // Active if email confirmed
            organization_id: authUser.raw_user_meta_data?.organization_id || authUser.user_metadata?.organization_id || null,
          });

          console.log(`[Supabase Webhook] User created in database: ${authUser.id}`);
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

