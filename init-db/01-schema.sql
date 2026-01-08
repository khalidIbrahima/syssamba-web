-- =====================================================
-- SAMBA ONE – Schéma PostgreSQL FINAL 2026
-- Multi-tenant + SYSCOHADA + Payment methods configurables
-- Prêt pour Supabase / Neon / Docker / AWS RDS
-- =====================================================

SET statement_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;

-- Extensions indispensables
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "btree_gist";

-- 1. Organisations (agences, SCI, syndics) – cœur du multi-tenant
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL, -- pour sous-domaine personnalisé
    type TEXT CHECK (type IN ('agency','sci','syndic','individual')) DEFAULT 'individual',
    plan TEXT CHECK (plan IN ('freemium','starter','pro','agency','enterprise')) DEFAULT 'freemium',

    -- Contact information
    email TEXT,
    phone TEXT,
    phone2 TEXT,                             -- Second phone number
    phone_verified BOOLEAN DEFAULT FALSE,    -- Phone verification status
    address TEXT,
    city TEXT,
    postal_code TEXT,                        -- Postal/ZIP code
    state TEXT,                              -- State/Region/Province

    -- Limites selon plan
    lots_limit INTEGER DEFAULT 5,
    users_limit INTEGER DEFAULT 1,
    extranet_tenants_limit INTEGER DEFAULT 5,        -- ← locataires avec accès extranet
    extranet_tenants_count INTEGER DEFAULT 0,        -- compteur réel (mis à jour par trigger)

    custom_extranet_domain TEXT,                     -- ex: locataires.terangaimmo.sn
    stripe_customer_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Utilisateurs (staff agence + propriétaires SCI)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    clerk_id TEXT UNIQUE NOT NULL,           -- Auth via Clerk
    email TEXT,
    phone TEXT,
    first_name TEXT,
    last_name TEXT,
    role TEXT CHECK (role IN ('owner','admin','accountant','agent','viewer')) DEFAULT 'viewer',
    avatar_url TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Propriétés / Biens immobiliers
CREATE TABLE properties (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    address TEXT NOT NULL,
    city TEXT,
    property_type TEXT,
    total_units INTEGER,
    photo_urls TEXT[],
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Lots / Unités locatives
CREATE TABLE units (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
    unit_number TEXT NOT NULL,
    floor TEXT,
    surface INTEGER,
    rent_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    charges_amount DECIMAL(12,2) DEFAULT 0,
    deposit_amount DECIMAL(12,2) DEFAULT 0,
    photo_urls TEXT[], -- Tableau des URLs des photos de l'unité
    status TEXT CHECK (status IN ('vacant','occupied','maintenance','reserved')) DEFAULT 'vacant',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Locataires
CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    unit_id UUID REFERENCES units(id) ON DELETE SET NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    id_number TEXT,
    has_extranet_access BOOLEAN DEFAULT FALSE,
    extranet_token UUID DEFAULT uuid_generate_v4(),
    language TEXT DEFAULT 'fr', -- fr, en, wo
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Baux
CREATE TABLE leases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    unit_id UUID REFERENCES units(id),
    tenant_id UUID REFERENCES tenants(id),
    start_date DATE NOT NULL,
    end_date DATE,
    rent_amount DECIMAL(12,2),
    deposit_paid BOOLEAN DEFAULT FALSE,
    signed BOOLEAN DEFAULT FALSE,
    signature_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Méthodes de paiement configurables par organisation
CREATE TABLE payment_methods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    provider TEXT NOT NULL, -- wave, orange_money, stripe, paypal, bank_transfer, cash, crypto
    is_active BOOLEAN DEFAULT TRUE,
    is_default BOOLEAN DEFAULT FALSE,
    visible_to_tenants BOOLEAN DEFAULT TRUE,
    config JSONB DEFAULT '{}',           -- clés API, wallet, etc.
    fee_type TEXT CHECK (fee_type IN ('percent','fixed','none')) DEFAULT 'none',
    fee_value DECIMAL(8,4) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(organization_id, slug)
);

-- 8. Paiements
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    tenant_id UUID REFERENCES tenants(id),
    unit_id UUID REFERENCES units(id),
    payment_method_id UUID REFERENCES payment_methods(id),
    amount DECIMAL(12,2) NOT NULL,
    fee_amount DECIMAL(12,2) DEFAULT 0,
    status TEXT CHECK (status IN ('pending','completed','failed','refunded')) DEFAULT 'pending',
    transaction_id TEXT,
    gateway_response JSONB,
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Plan comptable SYSCOHADA (pré-chargé)
CREATE TABLE accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_number TEXT UNIQUE NOT NULL,
    label TEXT NOT NULL,
    category CHAR(1) NOT NULL CHECK (category BETWEEN '1' AND '9'),
    is_active BOOLEAN DEFAULT TRUE
);

-- 10. Écritures comptables
CREATE TABLE journal_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    entry_date DATE NOT NULL,
    description TEXT,
    reference TEXT,
    validated BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE journal_lines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entry_id UUID REFERENCES journal_entries(id) ON DELETE CASCADE,
    account_id UUID REFERENCES accounts(id),
    debit DECIMAL(12,2) DEFAULT 0,
    credit DECIMAL(12,2) DEFAULT 0,
    description TEXT
);

-- 11. Tâches
CREATE TABLE tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    assigned_to UUID REFERENCES users(id),
    assigned_tenant_id UUID REFERENCES tenants(id),
    due_date TIMESTAMPTZ,
    priority TEXT CHECK (priority IN ('low','medium','high','urgent')) DEFAULT 'medium',
    status TEXT CHECK (status IN ('todo','in_progress','waiting','done')) DEFAULT 'todo',
    attachments TEXT[],
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. Notifications & Messages
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id),
    tenant_id UUID REFERENCES tenants(id),
    type TEXT NOT NULL,
    channel TEXT CHECK (channel IN ('sms','email','push','whatsapp')),
    content TEXT,
    status TEXT CHECK (status IN ('sent','delivered','failed')),
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 13. Messages (chat locataire ↔ agence)
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id),
    tenant_id UUID REFERENCES tenants(id),
    sender_type TEXT CHECK (sender_type IN ('tenant','staff')),
    sender_id UUID, -- user_id ou tenant_id selon sender_type
    content TEXT,
    attachments TEXT[],
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes critiques (performances même à 1 million de lignes)
CREATE INDEX idx_units_org ON units(organization_id);
CREATE INDEX idx_tenants_org ON tenants(organization_id);
CREATE INDEX idx_payments_org ON payments(organization_id);
CREATE INDEX idx_tasks_org ON tasks(organization_id);
CREATE INDEX idx_journal_org ON journal_entries(organization_id);
CREATE INDEX idx_messages_tenant ON messages(tenant_id);
CREATE INDEX idx_lease_dates ON leases(start_date, end_date);

-- RLS (Row Level Security) – à activer après
-- ALTER TABLE units ENABLE ROW LEVEL SECURITY;
-- etc.

-- Trigger exemple : mise à jour compteur extranet_tenants_count
CREATE OR REPLACE FUNCTION update_extranet_count()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.has_extranet_access = TRUE AND (OLD.has_extranet_access IS NULL OR OLD.has_extranet_access = FALSE) THEN
        UPDATE organizations 
        SET extranet_tenants_count = extranet_tenants_count + 1
        WHERE id = NEW.organization_id;
    ELSIF NEW.has_extranet_access = FALSE AND OLD.has_extranet_access = TRUE THEN
        UPDATE organizations 
        SET extranet_tenants_count = GREATEST(extranet_tenants_count - 1, 0)
        WHERE id = NEW.organization_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_extranet_count
    AFTER INSERT OR UPDATE OF has_extranet_access ON tenants
    FOR EACH ROW EXECUTE FUNCTION update_extranet_count();

-- Fin du schéma
COMMENT ON TABLE organizations IS 'Cœur du multi-tenant SAMBA ONE – toutes les limites monétisation sont ici';