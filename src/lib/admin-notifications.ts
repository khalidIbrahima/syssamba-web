/**
 * Admin Notification Utilities
 * Functions to create notifications for super admins
 */

import { db } from './db';
import { getAllSuperAdmins } from './super-admin';

/**
 * Create notifications for all super admins
 */
export async function notifySuperAdmins(
  type: 'organization_created' | 'subscription_created',
  data: {
    organizationId?: string;
    organizationName?: string;
    subscriptionId?: string;
    planName?: string;
  }
) {
  try {
    // Get all super admins
    const superAdmins = await getAllSuperAdmins();

    if (superAdmins.length === 0) {
      console.log('[AdminNotifications] No super admins found, skipping notification');
      return;
    }

    // Create notification content based on type
    let content = '';
    if (type === 'organization_created') {
      content = `Nouvelle organisation créée: ${data.organizationName || 'Unknown'}`;
    } else if (type === 'subscription_created') {
      content = `Nouvel abonnement créé: ${data.planName || 'Unknown'} pour l'organisation ${data.organizationName || 'Unknown'}`;
    }

    // Create notifications for each super admin
    const notificationPromises = superAdmins.map(superAdmin =>
      db.insertOne('notifications', {
        user_id: superAdmin.id,
        organization_id: data.organizationId || null,
        type: type,
        content: content,
        created_at: new Date().toISOString(),
      })
    );

    await Promise.all(notificationPromises);
    console.log(`[AdminNotifications] Created ${superAdmins.length} notification(s) for type: ${type}`);
  } catch (error) {
    console.error('[AdminNotifications] Error creating notifications:', error);
    // Don't throw - notifications are non-critical
  }
}

