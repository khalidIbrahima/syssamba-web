-- =====================================================
-- 22-create-supabase-schema.sql
-- Complete schema for SAMBA ONE in Supabase
-- Run this script in your Supabase SQL editor
-- =====================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- PLANS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    price DECIMAL(10, 2),
    price_type TEXT DEFAULT 'fixed' CHECK (price_type IN ('fixed', 'custom')),
    lots_limit INTEGER,
    users_limit INTEGER,
    extranet_tenants_limit INTEGER,
    features JSONB NOT NULL DEFAULT '{}',
    support_level TEXT DEFAULT 'community' CHECK (support_level IN ('community', 'email', 'priority_email', 'phone_24_7', 'dedicated_manager')),
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_plans_name ON plans(name);

-- =====================================================
-- ORGANIZATIONS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT,
    slug TEXT UNIQUE,
    type TEXT DEFAULT 'individual' CHECK (type IN ('agency', 'sci', 'syndic', 'individual')),
    country TEXT NOT NULL DEFAULT 'SN',
    extranet_tenants_count INTEGER DEFAULT 0,
    custom_extranet_domain TEXT,
    stripe_customer_id TEXT,
    is_configured BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- SUBSCRIPTIONS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
    plan_id UUID REFERENCES plans(id) ON DELETE SET NULL NOT NULL,
    billing_period TEXT NOT NULL DEFAULT 'monthly' CHECK (billing_period IN ('monthly', 'yearly')),
    price DECIMAL(10, 2) NOT NULL,
    currency TEXT DEFAULT 'XOF',
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'canceled', 'past_due', 'trialing', 'expired')),
    start_date DATE NOT NULL,
    end_date DATE,
    current_period_start DATE NOT NULL,
    current_period_end DATE NOT NULL,
    cancel_at_period_end BOOLEAN DEFAULT false,
    canceled_at TIMESTAMPTZ,
    stripe_subscription_id TEXT,
    stripe_customer_id TEXT,
    payment_method_id TEXT,
    trial_start DATE,
    trial_end DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sub_org ON subscriptions(organization_id);
CREATE INDEX IF NOT EXISTS idx_sub_status ON subscriptions(status);

-- =====================================================
-- USERS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    clerk_id TEXT UNIQUE NOT NULL,
    email TEXT,
    phone TEXT,
    first_name TEXT,
    last_name TEXT,
    role TEXT DEFAULT 'viewer' CHECK (role IN ('owner', 'admin', 'accountant', 'agent', 'viewer')),
    avatar_url TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_org ON users(organization_id);
CREATE INDEX IF NOT EXISTS idx_users_clerk ON users(clerk_id);

-- =====================================================
-- USER INVITATIONS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS user_invitations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
    email TEXT,
    phone TEXT,
    first_name TEXT,
    last_name TEXT,
    role TEXT DEFAULT 'viewer' CHECK (role IN ('owner', 'admin', 'accountant', 'agent', 'viewer')),
    token TEXT UNIQUE NOT NULL,
    invitation_method TEXT DEFAULT 'email' CHECK (invitation_method IN ('email', 'sms', 'both')),
    invited_by UUID REFERENCES users(id) ON DELETE SET NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'cancelled')),
    expires_at TIMESTAMPTZ NOT NULL,
    accepted_at TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invitations_org ON user_invitations(organization_id);
CREATE INDEX IF NOT EXISTS idx_invitations_token ON user_invitations(token);
CREATE INDEX IF NOT EXISTS idx_invitations_email ON user_invitations(email);
CREATE INDEX IF NOT EXISTS idx_invitations_phone ON user_invitations(phone);
CREATE INDEX IF NOT EXISTS idx_invitations_status ON user_invitations(status);

-- =====================================================
-- PROPERTIES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS properties (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    address TEXT NOT NULL,
    city TEXT,
    property_type TEXT,
    total_units INTEGER,
    photo_urls TEXT[],
    notes TEXT,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_properties_org ON properties(organization_id);

-- =====================================================
-- UNITS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS units (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
    unit_number TEXT NOT NULL,
    floor TEXT,
    surface INTEGER,
    rent_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
    charges_amount DECIMAL(12, 2) DEFAULT 0,
    deposit_amount DECIMAL(12, 2) DEFAULT 0,
    sale_price DECIMAL(12, 2) DEFAULT 0,
    photo_urls TEXT[],
    status TEXT DEFAULT 'vacant' CHECK (status IN ('vacant', 'occupied', 'maintenance', 'reserved', 'for_sale')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_units_org ON units(organization_id);
CREATE INDEX IF NOT EXISTS idx_units_property ON units(property_id);

-- =====================================================
-- TENANTS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    unit_id UUID REFERENCES units(id) ON DELETE SET NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    id_number TEXT,
    has_extranet_access BOOLEAN DEFAULT false,
    extranet_token UUID DEFAULT uuid_generate_v4(),
    language TEXT DEFAULT 'fr',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tenants_org ON tenants(organization_id);
CREATE INDEX IF NOT EXISTS idx_tenants_unit ON tenants(unit_id);
CREATE INDEX IF NOT EXISTS idx_tenants_extranet_token ON tenants(extranet_token);

-- =====================================================
-- LEASES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS leases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    unit_id UUID REFERENCES units(id),
    tenant_id UUID REFERENCES tenants(id),
    start_date DATE NOT NULL,
    end_date DATE,
    rent_amount DECIMAL(12, 2),
    deposit_paid BOOLEAN DEFAULT false,
    signed BOOLEAN DEFAULT false,
    signature_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lease_dates ON leases(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_lease_org ON leases(organization_id);
CREATE INDEX IF NOT EXISTS idx_lease_tenant ON leases(tenant_id);

-- =====================================================
-- PAYMENT METHODS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS payment_methods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    provider TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    is_default BOOLEAN DEFAULT false,
    visible_to_tenants BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    fee_type TEXT DEFAULT 'none' CHECK (fee_type IN ('percent', 'fixed', 'none')),
    fee_value DECIMAL(8, 4) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(organization_id, slug)
);

-- =====================================================
-- PAYMENTS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    tenant_id UUID REFERENCES tenants(id),
    unit_id UUID REFERENCES units(id),
    payment_method_id UUID REFERENCES payment_methods(id),
    amount DECIMAL(12, 2) NOT NULL,
    fee_amount DECIMAL(12, 2) DEFAULT 0,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
    transaction_id TEXT,
    gateway_response JSONB,
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_org ON payments(organization_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);

-- =====================================================
-- SALES TABLE (Ventes de biens immobiliers)
-- =====================================================
CREATE TABLE IF NOT EXISTS sales (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    unit_id UUID REFERENCES units(id) ON DELETE SET NULL,
    property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
    buyer_first_name TEXT NOT NULL,
    buyer_last_name TEXT NOT NULL,
    buyer_email TEXT,
    buyer_phone TEXT,
    buyer_id_number TEXT,
    sale_price DECIMAL(12, 2) NOT NULL,
    commission_rate DECIMAL(5, 2) DEFAULT 0,
    commission_amount DECIMAL(12, 2) DEFAULT 0,
    deposit_amount DECIMAL(12, 2) DEFAULT 0,
    sale_date DATE NOT NULL,
    closing_date DATE,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
    payment_method_id UUID REFERENCES payment_methods(id),
    notes TEXT,
    documents TEXT[],
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sales_org ON sales(organization_id);
CREATE INDEX IF NOT EXISTS idx_sales_unit ON sales(unit_id);
CREATE INDEX IF NOT EXISTS idx_sales_status ON sales(status);
CREATE INDEX IF NOT EXISTS idx_payments_tenant ON payments(tenant_id);

-- =====================================================
-- ACCOUNTS TABLE (SYSCOHADA)
-- =====================================================
CREATE TABLE IF NOT EXISTS accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_number TEXT UNIQUE NOT NULL,
    label TEXT NOT NULL,
    category TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true
);

-- =====================================================
-- JOURNAL ENTRIES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS journal_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    entry_date DATE NOT NULL,
    description TEXT,
    reference TEXT,
    validated BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_journal_org ON journal_entries(organization_id);

-- =====================================================
-- JOURNAL LINES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS journal_lines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entry_id UUID REFERENCES journal_entries(id) ON DELETE CASCADE,
    account_id UUID REFERENCES accounts(id),
    debit DECIMAL(12, 2) DEFAULT 0,
    credit DECIMAL(12, 2) DEFAULT 0,
    description TEXT
);

CREATE INDEX IF NOT EXISTS idx_journal_lines_entry ON journal_lines(entry_id);

-- =====================================================
-- TASKS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
    assigned_tenant_id UUID REFERENCES tenants(id),
    due_date TIMESTAMPTZ,
    priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    status TEXT DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'waiting', 'done')),
    category TEXT DEFAULT 'maintenance' CHECK (category IN ('maintenance', 'inspection', 'payment', 'lease', 'other')),
    attachments TEXT[],
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_tasks_org ON tasks(organization_id);
CREATE INDEX IF NOT EXISTS idx_tasks_created_by ON tasks(created_by);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);

-- =====================================================
-- TASK ACTIVITIES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS task_activities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID REFERENCES tasks(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    field_name TEXT,
    old_value TEXT,
    new_value TEXT,
    description TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_task_activities_task ON task_activities(task_id);
CREATE INDEX IF NOT EXISTS idx_task_activities_user ON task_activities(user_id);
CREATE INDEX IF NOT EXISTS idx_task_activities_created ON task_activities(created_at);

-- =====================================================
-- ACTIVITIES TABLE (Generic)
-- =====================================================
CREATE TABLE IF NOT EXISTS activities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
    entity_type TEXT NOT NULL CHECK (entity_type IN ('property', 'unit', 'tenant', 'lease', 'payment', 'journal_entry', 'task', 'user', 'organization', 'subscription')),
    entity_id UUID NOT NULL,
    action TEXT NOT NULL CHECK (action IN ('created', 'updated', 'deleted', 'status_changed', 'assigned', 'commented', 'logged_in', 'logged_out', 'invited', 'accepted_invitation', 'plan_changed', 'payment_processed')),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    description TEXT NOT NULL,
    changes JSONB,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activities_org ON activities(organization_id);
CREATE INDEX IF NOT EXISTS idx_activities_entity ON activities(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_activities_user ON activities(user_id);
CREATE INDEX IF NOT EXISTS idx_activities_created ON activities(created_at);
CREATE INDEX IF NOT EXISTS idx_activities_action ON activities(action);
CREATE INDEX IF NOT EXISTS idx_activities_org_entity ON activities(organization_id, entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_activities_org_created ON activities(organization_id, created_at);

-- =====================================================
-- NOTIFICATIONS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id),
    tenant_id UUID REFERENCES tenants(id),
    type TEXT NOT NULL,
    channel TEXT CHECK (channel IN ('sms', 'email', 'push', 'whatsapp')),
    content TEXT,
    status TEXT CHECK (status IN ('sent', 'delivered', 'failed')),
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- MESSAGES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id),
    tenant_id UUID REFERENCES tenants(id),
    sender_type TEXT CHECK (sender_type IN ('tenant', 'staff')),
    sender_id UUID,
    content TEXT,
    attachments TEXT[],
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_tenant ON messages(tenant_id);
CREATE INDEX IF NOT EXISTS idx_messages_org ON messages(organization_id);

-- =====================================================
-- OWNERS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS owners (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    bank_account TEXT,
    bank_name TEXT,
    commission_rate DECIMAL(5, 2) DEFAULT 20.00,
    is_active BOOLEAN DEFAULT true,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_owners_org ON owners(organization_id);
CREATE INDEX IF NOT EXISTS idx_owners_property ON owners(property_id);

-- =====================================================
-- OWNER TRANSFERS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS owner_transfers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    owner_id UUID REFERENCES owners(id) ON DELETE SET NULL,
    unit_id UUID REFERENCES units(id) ON DELETE SET NULL,
    property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
    payment_id UUID REFERENCES payments(id) ON DELETE SET NULL,
    amount DECIMAL(12, 2) NOT NULL,
    commission_amount DECIMAL(12, 2) DEFAULT 0,
    due_date DATE NOT NULL,
    status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'pending', 'completed', 'cancelled')),
    transfer_method TEXT,
    transfer_reference TEXT,
    transferred_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_owner_transfers_org ON owner_transfers(organization_id);
CREATE INDEX IF NOT EXISTS idx_owner_transfers_owner ON owner_transfers(owner_id);
CREATE INDEX IF NOT EXISTS idx_owner_transfers_status ON owner_transfers(status);
CREATE INDEX IF NOT EXISTS idx_owner_transfers_due_date ON owner_transfers(due_date);

-- =====================================================
-- COMMENTS
-- =====================================================
COMMENT ON TABLE plans IS 'Available subscription plans';
COMMENT ON TABLE organizations IS 'Multi-tenant organizations';
COMMENT ON TABLE subscriptions IS 'Organization subscriptions to plans';
COMMENT ON TABLE users IS 'Application users (linked to Clerk)';
COMMENT ON TABLE user_invitations IS 'User invitation system';
COMMENT ON TABLE properties IS 'Real estate properties';
COMMENT ON TABLE units IS 'Units/lots within properties';
COMMENT ON TABLE tenants IS 'Tenants renting units';
COMMENT ON TABLE leases IS 'Lease agreements';
COMMENT ON TABLE payment_methods IS 'Payment methods configuration';
COMMENT ON TABLE payments IS 'Tenant payments';
COMMENT ON TABLE accounts IS 'SYSCOHADA chart of accounts';
COMMENT ON TABLE journal_entries IS 'Accounting journal entries';
COMMENT ON TABLE journal_lines IS 'Journal entry lines';
COMMENT ON TABLE tasks IS 'Task management';
COMMENT ON TABLE task_activities IS 'Task activity history';
COMMENT ON TABLE activities IS 'Generic activity tracking';
COMMENT ON TABLE notifications IS 'System notifications';
COMMENT ON TABLE messages IS 'Messages between tenants and staff';
COMMENT ON TABLE owners IS 'Property owners';
COMMENT ON TABLE owner_transfers IS 'Owner transfer payments';

DO $$
BEGIN
    RAISE NOTICE '✓ All tables created successfully';
    RAISE NOTICE '';
    RAISE NOTICE 'Next steps:';
    RAISE NOTICE '1. Run init-db/21-enable-supabase-realtime.sql to enable Realtime';
    RAISE NOTICE '2. Configure Row Level Security (RLS) policies';
    RAISE NOTICE '3. Seed initial data (plans, accounts, etc.)';
END $$;

