import { NextResponse } from 'next/server';
import { checkAuth } from '@/lib/auth-helpers';
import { supabaseAdmin } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth-helpers';
import { z } from 'zod';

const createPaymentNotificationSchema = z.object({
  paymentId: z.string().uuid(),
  organizationId: z.string().uuid(),
});

/**
 * POST /api/notifications/create-payment
 * Create notifications for all users in the organization when a payment is created
 * Body: { paymentId: string, organizationId: string }
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

    const user = await getCurrentUser();
    if (!user || !user.organizationId) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    const body = await req.json();
    const validatedData = createPaymentNotificationSchema.parse(body);

    // Verify the payment belongs to the organization
    const { data: payment, error: paymentError } = await supabaseAdmin
      .from('payments')
      .select('id, tenant_id, amount, status')
      .eq('id', validatedData.paymentId)
      .eq('organization_id', validatedData.organizationId)
      .single();

    if (paymentError || !payment) {
      return NextResponse.json(
        { error: 'Payment not found' },
        { status: 404 }
      );
    }

    // Get tenant name for notification content
    let tenantName = 'Un locataire';
    if (payment.tenant_id) {
      const { data: tenant } = await supabaseAdmin
        .from('tenants')
        .select('first_name, last_name')
        .eq('id', payment.tenant_id)
        .maybeSingle();

      if (tenant) {
        const firstName = tenant.first_name || '';
        const lastName = tenant.last_name || '';
        tenantName = `${firstName} ${lastName}`.trim();
        if (!tenantName) {
          tenantName = 'Un locataire';
        }
      }
    }

    // Format amount
    const amount = typeof payment.amount === 'string' 
      ? parseFloat(payment.amount) 
      : payment.amount;
    const formattedAmount = new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'XOF',
    }).format(amount);

    // Get all users in the organization
    const { data: users, error: usersError } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('organization_id', validatedData.organizationId)
      .eq('is_active', true);

    if (usersError || !users || users.length === 0) {
      return NextResponse.json(
        { error: 'No users found in organization' },
        { status: 404 }
      );
    }

    // Create notifications for all users
    const notifications = users.map((u) => ({
      organization_id: validatedData.organizationId,
      user_id: u.id,
      payment_id: validatedData.paymentId,
      type: 'payment_created',
      content: `Nouveau paiement de ${formattedAmount} de ${tenantName}`,
      status: 'sent',
      sent_at: new Date().toISOString(),
    }));

    const { error: insertError } = await supabaseAdmin
      .from('notifications')
      .insert(notifications);

    if (insertError) {
      console.error('Error creating notifications:', insertError);
      return NextResponse.json(
        { error: 'Failed to create notifications' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, count: notifications.length });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      );
    }

    console.error('Error creating payment notifications:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

