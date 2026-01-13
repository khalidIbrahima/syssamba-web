-- =====================================================
-- SAMBA ONE - Migration: Ajout des fonctionnalités de vente
-- =====================================================
-- Ce script ajoute le support des propriétés/lots destinés à la vente
-- Date: 2026
-- =====================================================

-- 1. Ajouter la colonne sale_price à la table units si elle n'existe pas
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'units' AND column_name = 'sale_price'
    ) THEN
        ALTER TABLE units ADD COLUMN sale_price DECIMAL(12,2) DEFAULT 0;
        COMMENT ON COLUMN units.sale_price IS 'Prix de vente pour les lots destinés à la vente';
    END IF;
END $$;

-- 2. Modifier la contrainte CHECK sur status pour inclure 'for_sale'
-- Supprimer l'ancienne contrainte si elle existe et ajouter la nouvelle
DO $$
DECLARE
    constraint_name TEXT;
    constraint_exists BOOLEAN;
BEGIN
    -- Trouver le nom de la contrainte CHECK sur status
    SELECT conname INTO constraint_name
    FROM pg_constraint
    WHERE conrelid = 'units'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%status%'
    AND pg_get_constraintdef(oid) LIKE '%vacant%'
    LIMIT 1;
    
    -- Supprimer l'ancienne contrainte si elle existe
    IF constraint_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE units DROP CONSTRAINT IF EXISTS %I', constraint_name);
    END IF;
    
    -- Vérifier si la nouvelle contrainte avec 'for_sale' existe déjà
    SELECT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'units'::regclass
        AND contype = 'c'
        AND pg_get_constraintdef(oid) LIKE '%for_sale%'
    ) INTO constraint_exists;
    
    -- Ajouter la nouvelle contrainte si elle n'existe pas
    IF NOT constraint_exists THEN
        ALTER TABLE units ADD CONSTRAINT units_status_check 
            CHECK (status IN ('vacant','occupied','maintenance','reserved','for_sale'));
    END IF;
END $$;

-- 3. Créer la table sales si elle n'existe pas
CREATE TABLE IF NOT EXISTS sales (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    unit_id UUID REFERENCES units(id) ON DELETE SET NULL,
    property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
    buyer_first_name TEXT NOT NULL,
    buyer_last_name TEXT NOT NULL,
    buyer_email TEXT,
    buyer_phone TEXT,
    buyer_id_number TEXT, -- Numéro de pièce d'identité de l'acheteur
    sale_price DECIMAL(12,2) NOT NULL,
    commission_rate DECIMAL(5,2) DEFAULT 0, -- Taux de commission en pourcentage
    commission_amount DECIMAL(12,2) DEFAULT 0, -- Montant de la commission
    deposit_amount DECIMAL(12,2) DEFAULT 0, -- Acompte versé
    sale_date DATE NOT NULL, -- Date de la vente
    closing_date DATE, -- Date de clôture/acte de vente
    status TEXT CHECK (status IN ('pending','in_progress','completed','cancelled')) DEFAULT 'pending',
    payment_method_id UUID REFERENCES payment_methods(id),
    notes TEXT,
    documents TEXT[], -- Tableau des URLs des documents (acte de vente, etc.)
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Créer les index pour la table sales si ils n'existent pas
CREATE INDEX IF NOT EXISTS idx_sales_org ON sales(organization_id);
CREATE INDEX IF NOT EXISTS idx_sales_unit ON sales(unit_id);
CREATE INDEX IF NOT EXISTS idx_sales_status ON sales(status);
CREATE INDEX IF NOT EXISTS idx_sales_property ON sales(property_id);

-- 5. Ajouter des commentaires
COMMENT ON TABLE sales IS 'Transactions de vente de biens immobiliers';
COMMENT ON COLUMN sales.buyer_id_number IS 'Numéro de pièce d''identité de l''acheteur';
COMMENT ON COLUMN sales.commission_rate IS 'Taux de commission en pourcentage';
COMMENT ON COLUMN sales.commission_amount IS 'Montant de la commission';
COMMENT ON COLUMN sales.deposit_amount IS 'Acompte versé';
COMMENT ON COLUMN sales.sale_date IS 'Date de la vente';
COMMENT ON COLUMN sales.closing_date IS 'Date de clôture/acte de vente';
COMMENT ON COLUMN sales.documents IS 'Tableau des URLs des documents (acte de vente, etc.)';

-- Fin de la migration
