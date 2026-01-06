import { NextResponse } from 'next/server';
import { checkAuth, getCurrentUser } from '@/lib/auth-helpers';
import { isSuperAdmin } from '@/lib/super-admin';
import { db } from '@/lib/db';
import { sendBulkEmail, generateSubscriptionExpiredEmail } from '@/lib/email';

/**
 * POST /api/admin/subscriptions/update-expired
 * Batch endpoint to update expired subscriptions
 * Only accessible by super admins
 */
export async function POST() {
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

    // Check if user is super admin
    const userIsSuperAdmin = await isSuperAdmin(user.id);

    if (!userIsSuperAdmin) {
      return NextResponse.json(
        { error: 'Forbidden: Super-admin access required' },
        { status: 403 }
      );
    }

    // Get all subscriptions that are active, trialing, or past_due
    const subscriptions = await db.select<{
      id: string;
      organization_id: string;
      plan_id: string;
      status: string;
      current_period_end: Date | string;
      end_date: Date | string | null;
      cancel_at_period_end: boolean;
      canceled_at: Date | string | null;
    }>('subscriptions', {
      in: { status: ['active', 'trialing', 'past_due'] },
    });

    const updatedIds: string[] = [];
    const now = new Date();
    const fiveDaysAgo = new Date(now);
    fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);

    // Structure to store subscription updates for email notifications
    interface SubscriptionUpdate {
      subscriptionId: string;
      organizationId: string;
      organizationName: string;
      planName: string;
      expirationDate: Date;
      newStatus: 'expired' | 'canceled';
    }

    const subscriptionsToNotify: SubscriptionUpdate[] = [];

    for (const sub of subscriptions) {
      // Determine effective expiration date
      let expirationDate: Date | null = null;

      if (sub.cancel_at_period_end) {
        expirationDate = sub.current_period_end instanceof Date 
          ? sub.current_period_end 
          : new Date(sub.current_period_end);
      } else if (sub.end_date) {
        expirationDate = sub.end_date instanceof Date 
          ? sub.end_date 
          : new Date(sub.end_date);
      } else {
        expirationDate = sub.current_period_end instanceof Date 
          ? sub.current_period_end 
          : new Date(sub.current_period_end);
      }

      // Check if expiration date is more than 5 days ago
      if (expirationDate < fiveDaysAgo) {
        // Determine new status
        const newStatus = (sub.cancel_at_period_end || sub.canceled_at) 
          ? 'canceled' 
          : 'expired';

        // Get organization info
        const organization = await db.selectOne<{
          id: string;
          name: string | null;
        }>('organizations', {
          eq: { id: sub.organization_id },
        });

        // Get plan info
        const plan = await db.selectOne<{
          id: string;
          name: string;
          display_name: string | null;
        }>('plans', {
          eq: { id: sub.plan_id },
        });

        // Update subscription
        await db.updateOne('subscriptions', {
          status: newStatus,
          end_date: sub.end_date || expirationDate.toISOString().split('T')[0],
          updated_at: now,
        }, { id: sub.id });

        updatedIds.push(sub.id);

        // Store info for email notification
        if (organization && plan) {
          subscriptionsToNotify.push({
            subscriptionId: sub.id,
            organizationId: sub.organization_id,
            organizationName: organization.name || 'Votre organisation',
            planName: plan.display_name || plan.name,
            expirationDate,
            newStatus,
          });
        }
      }
    }

    // Send emails to admins
    let emailsSent = 0;
    const emailErrors: string[] = [];

    if (subscriptionsToNotify.length > 0) {
      for (const subUpdate of subscriptionsToNotify) {
        try {
          // Get organization admins (owner and admin roles)
          const admins = await db.select<{
            id: string;
            email: string | null;
            role: string;
          }>('users', {
            eq: { organization_id: subUpdate.organizationId },
            in: { role: ['owner', 'admin'] },
          });

          // Filter admins with valid email
          const adminEmails = admins
            .filter(admin => admin.email && admin.email.trim() !== '')
            .map(admin => admin.email!);

          if (adminEmails.length > 0) {
            // Generate email content
            const emailContent = generateSubscriptionExpiredEmail({
              organizationName: subUpdate.organizationName,
              planName: subUpdate.planName,
              expirationDate: subUpdate.expirationDate.toLocaleDateString('fr-FR', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              }),
              status: subUpdate.newStatus,
            });

            // Send email to all admins
            const emailResults = await sendBulkEmail(
              adminEmails,
              emailContent.subject,
              emailContent.html,
              emailContent.text
            );

            const successCount = emailResults.filter(r => r.success).length;
            emailsSent += successCount;

            if (successCount < adminEmails.length) {
              const failed = emailResults.filter(r => !r.success);
              emailErrors.push(`Failed to send ${failed.length} email(s) for ${subUpdate.organizationName}`);
            }
          }
        } catch (error: any) {
          emailErrors.push(`Error sending email for ${subUpdate.organizationName}: ${error.message}`);
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `Updated ${updatedIds.length} expired subscription(s)`,
      updatedCount: updatedIds.length,
      subscriptionIds: updatedIds,
      emailsSent,
      emailErrors: emailErrors.length > 0 ? emailErrors : undefined,
      executedAt: now.toISOString(),
    });

  } catch (error: any) {
    console.error('Error updating expired subscriptions:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

