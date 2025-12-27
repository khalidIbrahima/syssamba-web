-- =====================================================
-- Tables pour gérer les fonctionnalités disponibles par plan
-- =====================================================

-- Table de référence pour toutes les fonctionnalités disponibles
CREATE TABLE IF NOT EXISTS features (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key TEXT NOT NULL UNIQUE, -- Clé unique de la fonctionnalité (ex: 'dashboard', 'properties_management')
    name TEXT NOT NULL, -- Nom d'affichage (ex: 'Tableau de bord', 'Gestion des propriétés')
    description TEXT, -- Description de la fonctionnalité
    category TEXT NOT NULL, -- Catégorie (ex: 'core', 'tenants', 'payments', 'accounting', 'advanced')
    icon TEXT, -- Nom de l'icône (ex: 'LayoutDashboard', 'Building2')
    is_active BOOLEAN DEFAULT true, -- Si la fonctionnalité est active dans le système
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_features_key ON features(key);
CREATE INDEX IF NOT EXISTS idx_features_category ON features(category);
CREATE INDEX IF NOT EXISTS idx_features_active ON features(is_active) WHERE is_active = true;

-- Table de liaison entre plans et fonctionnalités
CREATE TABLE IF NOT EXISTS plan_features (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    plan_id UUID NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
    feature_key TEXT NOT NULL REFERENCES features(key) ON DELETE CASCADE,
    is_enabled BOOLEAN NOT NULL DEFAULT true, -- Si la fonctionnalité est activée pour ce plan
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Contrainte d'unicité : une seule entrée par combinaison plan/fonctionnalité
    UNIQUE(plan_id, feature_key)
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_plan_features_plan_id ON plan_features(plan_id);
CREATE INDEX IF NOT EXISTS idx_plan_features_feature ON plan_features(feature_key);
CREATE INDEX IF NOT EXISTS idx_plan_features_enabled ON plan_features(is_enabled) WHERE is_enabled = true;
CREATE INDEX IF NOT EXISTS idx_plan_features_composite ON plan_features(plan_id, feature_key);

-- Ajouter les tables à la publication Supabase Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE features;
ALTER PUBLICATION supabase_realtime ADD TABLE plan_features;

-- Commentaires
COMMENT ON TABLE features IS 'Table de référence pour toutes les fonctionnalités disponibles dans le système';
COMMENT ON TABLE plan_features IS 'Table de liaison définissant quelles fonctionnalités sont disponibles pour chaque plan';
COMMENT ON COLUMN features.key IS 'Clé unique de la fonctionnalité utilisée dans le code';
COMMENT ON COLUMN features.category IS 'Catégorie de la fonctionnalité pour organisation (core, tenants, payments, accounting, advanced)';
COMMENT ON COLUMN plan_features.is_enabled IS 'Indique si la fonctionnalité est activée pour ce plan spécifique';

-- =====================================================
-- Insertion des fonctionnalités de référence
-- =====================================================

-- Core Features
INSERT INTO features (key, name, description, category, icon) VALUES
('dashboard', 'Tableau de bord', 'Accès au tableau de bord principal', 'core', 'LayoutDashboard'),
('properties_management', 'Gestion des propriétés', 'Gestion complète des propriétés immobilières', 'core', 'Building2'),
('units_management', 'Gestion des lots', 'Gestion complète des lots/unités', 'core', 'Home'),

-- Tenants Features
('tenants_basic', 'Gestion locataires (basique)', 'Gestion basique des locataires', 'tenants', 'Users'),
('tenants_full', 'Gestion locataires (complète)', 'Gestion complète des locataires avec historique', 'tenants', 'Users'),

-- Leases Features
('leases_basic', 'Gestion contrats (basique)', 'Gestion basique des contrats de location', 'leases', 'FileText'),
('leases_full', 'Gestion contrats (complète)', 'Gestion complète des contrats avec renouvellement automatique', 'leases', 'FileText'),

-- Payments Features
('payments_manual_entry', 'Saisie manuelle des paiements', 'Enregistrement manuel des paiements', 'payments', 'DollarSign'),
('payments_all_methods', 'Tous les moyens de paiement', 'Support de tous les moyens de paiement (Wave, Orange Money, etc.)', 'payments', 'CreditCard'),
('receipt_generation', 'Génération de reçus', 'Génération automatique de reçus de paiement', 'payments', 'Receipt'),
('wave_orange_payment_link', 'Liens de paiement Wave/Orange', 'Création de liens de paiement Wave et Orange Money', 'payments', 'Link'),

-- Tasks Features
('basic_tasks', 'Tâches basiques', 'Gestion basique des tâches', 'tasks', 'CheckSquare'),
('tasks_full', 'Gestion complète des tâches', 'Gestion complète avec Kanban, assignation, etc.', 'tasks', 'CheckSquare'),

-- Notifications Features
('email_notifications', 'Notifications email', 'Envoi de notifications par email', 'notifications', 'Mail'),
('sms_notifications', 'Notifications SMS', 'Envoi de notifications par SMS', 'notifications', 'MessageSquare'),
('messaging', 'Messagerie', 'Système de messagerie entre utilisateurs et locataires', 'notifications', 'MessageSquare'),

-- Extranet Features
('extranet_tenant', 'Extranet locataires', 'Accès extranet pour les locataires', 'extranet', 'Globe'),
('custom_extranet_domain', 'Domaine personnalisé extranet', 'Utilisation d''un domaine personnalisé pour l''extranet', 'extranet', 'Globe'),
('full_white_label', 'White label complet', 'Personnalisation complète de la marque', 'extranet', 'Palette'),
('white_label_option', 'Option white label', 'Personnalisation partielle de la marque', 'extranet', 'Palette'),

-- Accounting Features
('accounting_sycoda_basic', 'Intégration Sycoda (basique)', 'Intégration basique avec Sycoda', 'accounting', 'Calculator'),
('accounting_sycoda_full', 'Intégration Sycoda (complète)', 'Intégration complète avec Sycoda', 'accounting', 'Calculator'),
('dsf_export', 'Export DSF', 'Export des données pour la DSF', 'accounting', 'Download'),
('bank_sync', 'Synchronisation bancaire', 'Synchronisation automatique avec les comptes bancaires', 'accounting', 'RefreshCw'),

-- Advanced Features
('electronic_signature', 'Signature électronique', 'Signature électronique des contrats', 'advanced', 'PenTool'),
('mobile_offline_edl', 'EDL mobile hors ligne', 'État des lieux mobile fonctionnant hors ligne', 'advanced', 'Smartphone'),
('reports_basic', 'Rapports basiques', 'Génération de rapports basiques', 'reports', 'BarChart3'),
('reports_advanced', 'Rapports avancés', 'Génération de rapports avancés avec analyses', 'reports', 'TrendingUp'),
('copropriete_module', 'Module copropriété', 'Gestion de copropriétés', 'advanced', 'Building'),
('marketplace_services', 'Marketplace de services', 'Accès à la marketplace de services', 'advanced', 'Store'),
('api_access', 'Accès API', 'Accès à l''API REST pour intégrations', 'advanced', 'Code'),
('dedicated_support', 'Support dédié', 'Support client dédié', 'support', 'HeadphonesIcon'),
('on_premise_option', 'Option on-premise', 'Déploiement on-premise disponible', 'advanced', 'Server')
ON CONFLICT (key) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    category = EXCLUDED.category,
    icon = EXCLUDED.icon,
    updated_at = NOW();

-- =====================================================
-- Migration des données depuis le champ JSONB features
-- =====================================================

-- Fonction pour migrer les fonctionnalités depuis plans.features (JSONB) vers plan_features
DO $$
DECLARE
    plan_record RECORD;
    feature_key TEXT;
    feature_value JSONB;
    is_enabled_value BOOLEAN;
BEGIN
    -- Parcourir tous les plans
    FOR plan_record IN SELECT name, features FROM plans WHERE features IS NOT NULL AND features != '{}'::jsonb LOOP
        -- Parcourir toutes les fonctionnalités dans le JSONB
        FOR feature_key, feature_value IN SELECT * FROM jsonb_each(plan_record.features) LOOP
            -- Vérifier si la fonctionnalité existe dans la table features
            IF EXISTS (SELECT 1 FROM features WHERE key = feature_key) THEN
                -- Convertir la valeur JSONB en boolean
                -- Si c'est déjà un boolean, l'utiliser directement
                -- Si c'est un texte "true"/"false", le convertir
                -- Sinon, considérer comme false
                BEGIN
                    IF jsonb_typeof(feature_value) = 'boolean' THEN
                        is_enabled_value := feature_value::boolean;
                    ELSIF jsonb_typeof(feature_value) = 'string' THEN
                        -- Essayer de convertir "true"/"false" en boolean
                        IF lower(feature_value::text) = '"true"' OR lower(feature_value::text) = 'true' THEN
                            is_enabled_value := true;
                        ELSIF lower(feature_value::text) = '"false"' OR lower(feature_value::text) = 'false' THEN
                            is_enabled_value := false;
                        ELSE
                            -- Si ce n'est pas un boolean valide (ex: "limited", "community"), ignorer cette entrée
                            CONTINUE;
                        END IF;
                    ELSE
                        -- Pour les autres types (number, etc.), ignorer
                        CONTINUE;
                    END IF;
                    
                    -- Insérer ou mettre à jour dans plan_features
                    INSERT INTO plan_features (plan_id, feature_key, is_enabled)
                    VALUES (plan_record.id, feature_key, is_enabled_value)
                    ON CONFLICT (plan_id, feature_key) DO UPDATE SET
                        is_enabled = EXCLUDED.is_enabled,
                        updated_at = NOW();
                EXCEPTION
                    WHEN OTHERS THEN
                        -- Ignorer les erreurs de conversion et continuer
                        RAISE NOTICE 'Skipping feature % for plan %: %', feature_key, plan_record.name, SQLERRM;
                        CONTINUE;
                END;
            END IF;
        END LOOP;
    END LOOP;
END $$;

-- =====================================================
-- Vérification des données migrées
-- =====================================================

-- Vue pour vérifier les fonctionnalités par plan
CREATE OR REPLACE VIEW plan_features_view AS
SELECT 
    p.name AS plan_name,
    p.display_name AS plan_display_name,
    f.key AS feature_key,
    f.name AS feature_name,
    f.category AS feature_category,
    pf.is_enabled,
    f.icon AS feature_icon
FROM plans p
LEFT JOIN plan_features pf ON p.id = pf.plan_id
LEFT JOIN features f ON pf.feature_key = f.key
ORDER BY p.sort_order, f.category, f.name;

COMMENT ON VIEW plan_features_view IS 'Vue pour visualiser facilement les fonctionnalités disponibles par plan';

