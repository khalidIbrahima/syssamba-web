import { NextRequest, NextResponse } from 'next/server';
import { checkAuth } from '@/lib/auth-helpers';
import { supabaseAdmin } from '@/lib/db';

/**
 * GET /api/features
 * Get all features with their metadata for dynamic feature checking
 */
export async function GET() {
  try {
    // Check authentication
    const { userId } = await checkAuth();
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get all features from database
    const { data: features, error: featuresError } = await supabaseAdmin
      .from('features')
      .select('*')
      .eq('is_active', true)
      .order('category', { ascending: true })
      .order('display_name', { ascending: true });

    if (featuresError) {
      console.error('Error fetching features:', featuresError);
      return NextResponse.json(
        { error: 'Failed to fetch features' },
        { status: 500 }
      );
    }

    // Get feature-object mappings (if any exist in a mapping table)
    // For now, return the basic feature data
    const featureMappings = {
      // Object type to feature key mappings
      objectToFeature: {
        Property: 'properties_management',
        Unit: 'units_management',
        Tenant: 'tenants_full',
        Lease: 'leases_full',
        Payment: 'payments_all_methods',
        Task: 'tasks_full',
        Message: 'messaging_system',
        JournalEntry: 'accounting_sycoda_full',
        User: 'user_management',
        Organization: 'organization_management',
        Profile: 'user_management',
        Report: 'reports_basic',
        Activity: 'activity_tracking',
      },
      // Legacy feature name mappings
      legacyMappings: {
        properties: 'properties_management',
        properties_management: 'properties_management',
        units: 'units_management',
        units_management: 'units_management',
        tenants: 'tenants_full',
        tenants_basic: 'tenants_basic',
        tenants_full: 'tenants_full',
        leases: 'leases_full',
        leases_basic: 'leases_basic',
        leases_full: 'leases_full',
        payments: 'payments_all_methods',
        payments_manual_entry: 'payments_manual_entry',
        payments_all_methods: 'payments_all_methods',
        accounting: 'accounting_sycoda_full',
        accounting_basic: 'accounting_sycoda_basic',
        accounting_full: 'accounting_sycoda_full',
        tasks: 'tasks_full',
        basic_tasks: 'basic_tasks',
        tasks_full: 'tasks_full',
        notifications: 'email_notifications',
        email_notifications: 'email_notifications',
        sms_notifications: 'sms_notifications',
        extranet: 'extranet_tenant',
        custom_domain: 'custom_extranet_domain',
        white_label: 'white_label_option',
        full_white_label: 'full_white_label',
        dsf_export: 'dsf_export',
        bank_sync: 'bank_sync',
        electronic_signature: 'electronic_signature',
        mobile_offline_edl: 'mobile_offline_edl',
        wave_orange_payment_link: 'wave_orange_payment_link',
        reports_basic: 'reports_basic',
        reports_advanced: 'reports_advanced',
        copropriete_module: 'copropriete_module',
        marketplace_services: 'marketplace_services',
        api_access: 'api_access',
        priority_support: 'dedicated_support',
      }
    };

    return NextResponse.json({
      success: true,
      features: features || [],
      mappings: featureMappings,
    });

  } catch (error) {
    console.error('Error in features API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
