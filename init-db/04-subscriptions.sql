-- =================================================================
-- SAMBA ONE - Table Subscriptions
-- Script de création de la table des abonnements
-- =================================================================

-- Création de la table subscriptions
CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    plan_id UUID NOT NULL REFERENCES plans(id) ON DELETE SET NULL,
    
    -- Billing
    billing_period TEXT NOT NULL DEFAULT 'monthly' CHECK (billing_period IN ('monthly', 'yearly')),
    price DECIMAL(10, 2) NOT NULL,
    currency TEXT DEFAULT 'XOF',
    
    -- Status
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'canceled', 'past_due', 'trialing', 'expired')),
    
    -- Dates
    start_date DATE NOT NULL,
    end_date DATE, -- null for active subscriptions
    current_period_start DATE NOT NULL,
    current_period_end DATE NOT NULL,
    cancel_at_period_end BOOLEAN DEFAULT false,
    canceled_at TIMESTAMP WITH TIME ZONE,
    
    -- Payment
    stripe_subscription_id TEXT,
    stripe_customer_id TEXT,
    payment_method_id TEXT,
    
    -- Trial
    trial_start DATE,
    trial_end DATE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_sub_org ON subscriptions(organization_id);
CREATE INDEX IF NOT EXISTS idx_sub_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_sub_period ON subscriptions(current_period_start, current_period_end);

-- Ajouter la colonne is_configured à organizations si elle n'existe pas
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'organizations' AND column_name = 'is_configured'
    ) THEN
        ALTER TABLE organizations ADD COLUMN is_configured BOOLEAN DEFAULT false;
    END IF;
END $$;

-- Ajouter la colonne country à organizations si elle n'existe pas
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'organizations' AND column_name = 'country'
    ) THEN
        ALTER TABLE organizations ADD COLUMN country TEXT NOT NULL DEFAULT 'SN';
        COMMENT ON COLUMN organizations.country IS 'Code pays ISO 3166-1 alpha-2 (SN = Sénégal par défaut)';
    END IF;
END $$;

-- Rendre name et slug nullable dans organizations (pour permettre la configuration après création)
DO $$ 
BEGIN
    -- Make name nullable
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'organizations' 
        AND column_name = 'name' 
        AND is_nullable = 'NO'
    ) THEN
        ALTER TABLE organizations ALTER COLUMN name DROP NOT NULL;
    END IF;
    
    -- Make slug nullable
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'organizations' 
        AND column_name = 'slug' 
        AND is_nullable = 'NO'
    ) THEN
        ALTER TABLE organizations ALTER COLUMN slug DROP NOT NULL;
    END IF;
END $$;

-- Commentaires pour documentation
COMMENT ON TABLE subscriptions IS 'Table des abonnements liant les organisations aux plans';
COMMENT ON COLUMN subscriptions.organization_id IS 'Organisation propriétaire de l''abonnement';
COMMENT ON COLUMN subscriptions.plan_id IS 'Plan d''abonnement';
COMMENT ON COLUMN subscriptions.billing_period IS 'Période de facturation: monthly ou yearly';
COMMENT ON COLUMN subscriptions.price IS 'Prix de l''abonnement en FCFA';
COMMENT ON COLUMN subscriptions.status IS 'Statut de l''abonnement: active, canceled, past_due, trialing, expired';
COMMENT ON COLUMN subscriptions.current_period_start IS 'Début de la période de facturation actuelle';
COMMENT ON COLUMN subscriptions.current_period_end IS 'Fin de la période de facturation actuelle';
COMMENT ON COLUMN subscriptions.trial_start IS 'Début de la période d''essai (si applicable)';
COMMENT ON COLUMN subscriptions.trial_end IS 'Fin de la période d''essai (si applicable)';

