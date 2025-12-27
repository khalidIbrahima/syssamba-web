import { NextResponse } from 'next/server';
import { checkAuth } from '@/lib/auth-helpers';
import { getCurrentUser } from '@/lib/auth-helpers';
import { isSuperAdmin } from '@/lib/super-admin';
import { isGlobalAdmin } from '@/lib/global-admin';

export async function GET() {
  try {
    const { userId } = await checkAuth();
    
    if (!userId) {
      return NextResponse.json(
        { isSuperAdmin: false, isGlobalAdmin: false },
        { status: 200 }
      );
    }

    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { isSuperAdmin: false, isGlobalAdmin: false },
        { status: 200 }
      );
    }

    const userIsSuperAdmin = await isSuperAdmin(user.id);
    const userIsGlobalAdmin = await isGlobalAdmin(user.id);

    return NextResponse.json({
      isSuperAdmin: userIsSuperAdmin,
      isGlobalAdmin: userIsGlobalAdmin,
    });
  } catch (error: any) {
    console.error('Error checking admin status:', error);
    return NextResponse.json(
      { isSuperAdmin: false, isGlobalAdmin: false },
      { status: 200 }
    );
  }
}


