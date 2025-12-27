-- =================================================================
-- SAMBA ONE - Table Plans
-- Script de création et insertion des plans disponibles
-- =================================================================

-- Création de la table plans
CREATE TABLE IF NOT EXISTS plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    price DECIMAL(10, 2),
    price_type TEXT NOT NULL DEFAULT 'fixed' CHECK (price_type IN ('fixed', 'custom')),
    
    -- Limites
    lots_limit INTEGER,
    users_limit INTEGER,
    extranet_tenants_limit INTEGER,
    
    -- Features (JSONB pour stocker toutes les fonctionnalités)
    features JSONB NOT NULL DEFAULT '{}',
    
    -- Support
    support_level TEXT NOT NULL DEFAULT 'community' CHECK (support_level IN ('community', 'email', 'priority_email', 'phone_24_7', 'dedicated_manager')),
    
    -- Métadonnées
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_plans_name ON plans(name);
CREATE INDEX IF NOT EXISTS idx_plans_active ON plans(is_active) WHERE is_active = true;

-- Insertion des plans
INSERT INTO plans (name, display_name, price, price_type, lots_limit, users_limit, extranet_tenants_limit, features, support_level, sort_order) VALUES
(
    'freemium',
    'Freemium',
    0.00,
    'fixed',
    5,
    1,
    5,
    '{
        "dashboard": true,
        "properties_management": true,
        "units_management": true,
        "tenants_basic": true,
        "leases_basic": true,
        "payments_manual_entry": true,
        "receipt_generation": true,
        "basic_tasks": true,
        "email_notifications": true,
        "sms_notifications": false,
        "extranet_tenant": "limited",
        "custom_extranet_domain": false,
        "accounting_sycoda_basic": false,
        "dsf_export": false,
        "bank_sync": false,
        "electronic_signature": false,
        "mobile_offline_edl": false,
        "wave_orange_payment_link": false,
        "reports_basic": true,
        "support": "community"
    }'::jsonb,
    'community',
    1
),
(
    'starter',
    'Starter',
    9900.00,
    'fixed',
    30,
    2,
    50,
    '{
        "dashboard": true,
        "properties_management": true,
        "units_management": true,
        "tenants_full": true,
        "leases_full": true,
        "payments_all_methods": true,
        "receipt_generation": true,
        "tasks_full": true,
        "email_notifications": true,
        "sms_notifications": true,
        "extranet_tenant": "limited",
        "custom_extranet_domain": false,
        "accounting_sycoda_basic": true,
        "dsf_export": false,
        "bank_sync": false,
        "electronic_signature": false,
        "mobile_offline_edl": true,
        "wave_orange_payment_link": true,
        "reports_advanced": true,
        "support": "email"
    }'::jsonb,
    'email',
    2
),
(
    'pro',
    'Pro',
    29900.00,
    'fixed',
    150,
    5,
    300,
    '{
        "dashboard": true,
        "properties_management": true,
        "units_management": true,
        "tenants_full": true,
        "leases_full": true,
        "payments_all_methods": true,
        "receipt_generation": true,
        "tasks_full": true,
        "email_notifications": true,
        "sms_notifications": true,
        "extranet_tenant": "limited",
        "custom_extranet_domain": false,
        "accounting_sycoda_full": true,
        "dsf_export": true,
        "bank_sync": true,
        "electronic_signature": true,
        "mobile_offline_edl": true,
        "wave_orange_payment_link": true,
        "reports_advanced": true,
        "copropriete_module": false,
        "marketplace_services": false,
        "support": "priority_email"
    }'::jsonb,
    'priority_email',
    3
),
(
    'agency',
    'Agence / Syndic',
    79900.00,
    'fixed',
    NULL,
    15,
    NULL,
    '{
        "dashboard": true,
        "properties_management": true,
        "units_management": true,
        "tenants_full": true,
        "leases_full": true,
        "payments_all_methods": true,
        "receipt_generation": true,
        "tasks_full": true,
        "email_notifications": true,
        "sms_notifications": true,
        "extranet_tenant": "unlimited",
        "custom_extranet_domain": true,
        "accounting_sycoda_full": true,
        "dsf_export": true,
        "bank_sync": true,
        "electronic_signature": true,
        "mobile_offline_edl": true,
        "wave_orange_payment_link": true,
        "reports_advanced": true,
        "copropriete_module": true,
        "marketplace_services": true,
        "white_label_option": true,
        "support": "phone_24_7"
    }'::jsonb,
    'phone_24_7',
    4
),
(
    'enterprise',
    'Enterprise',
    NULL,
    'custom',
    NULL,
    NULL,
    NULL,
    '{
        "dashboard": true,
        "properties_management": true,
        "units_management": true,
        "tenants_full": true,
        "leases_full": true,
        "payments_all_methods": true,
        "receipt_generation": true,
        "tasks_full": true,
        "email_notifications": true,
        "sms_notifications": true,
        "extranet_tenant": "unlimited",
        "custom_extranet_domain": true,
        "full_white_label": true,
        "accounting_sycoda_full": true,
        "dsf_export": true,
        "bank_sync": true,
        "electronic_signature": true,
        "mobile_offline_edl": true,
        "wave_orange_payment_link": true,
        "reports_advanced": true,
        "copropriete_module": true,
        "marketplace_services": true,
        "api_access": true,
        "dedicated_support": true,
        "on_premise_option": true,
        "support": "dedicated_manager"
    }'::jsonb,
    'dedicated_manager',
    5
)
ON CONFLICT (name) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    price = EXCLUDED.price,
    price_type = EXCLUDED.price_type,
    lots_limit = EXCLUDED.lots_limit,
    users_limit = EXCLUDED.users_limit,
    extranet_tenants_limit = EXCLUDED.extranet_tenants_limit,
    features = EXCLUDED.features,
    support_level = EXCLUDED.support_level,
    sort_order = EXCLUDED.sort_order,
    updated_at = NOW();

-- Commentaires pour documentation
COMMENT ON TABLE plans IS 'Table des plans d''abonnement disponibles pour les organisations';
COMMENT ON COLUMN plans.name IS 'Identifiant unique du plan (freemium, starter, pro, agency, enterprise)';
COMMENT ON COLUMN plans.display_name IS 'Nom d''affichage du plan';
COMMENT ON COLUMN plans.price IS 'Prix mensuel en FCFA (NULL pour Enterprise = sur devis)';
COMMENT ON COLUMN plans.price_type IS 'Type de prix: fixed ou custom';
COMMENT ON COLUMN plans.lots_limit IS 'Limite de lots (NULL = illimité)';
COMMENT ON COLUMN plans.users_limit IS 'Limite d''utilisateurs (NULL = illimité)';
COMMENT ON COLUMN plans.extranet_tenants_limit IS 'Limite de locataires extranet (NULL = illimité)';
COMMENT ON COLUMN plans.features IS 'JSONB contenant toutes les fonctionnalités du plan';
COMMENT ON COLUMN plans.support_level IS 'Niveau de support inclus dans le plan';

