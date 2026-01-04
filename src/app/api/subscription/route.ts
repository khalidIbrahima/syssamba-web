//get the subscription for the current user & the associated plan of the org
import { NextResponse } from 'next/server';
import { checkAuth, getCurrentUser } from '@/lib/auth-helpers';
import { db } from '@/lib/db';

/**
 * GET /api/subscription
 * Get the subscription for the current user & the associated plan of the org
 */
export async function GET() {
  try {
    const { userId } = await checkAuth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    const subscription = await db.selectOne('subscriptions', {
      eq: { organization_id: user.organizationId },
    });
    if (!subscription) {
      return NextResponse.json({ error: 'No subscription found' }, { status: 404 });
    }
    return NextResponse.json(subscription);
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}