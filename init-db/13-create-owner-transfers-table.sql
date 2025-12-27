-- =====================================================
-- 13-create-owner-transfers-table.sql
-- Création de la table pour les virements aux propriétaires
-- =====================================================

-- Table des propriétaires (owners)
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
    commission_rate DECIMAL(5,2) DEFAULT 20.00, -- Pourcentage de commission (20% par défaut)
    is_active BOOLEAN DEFAULT TRUE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_owners_org ON owners(organization_id);
CREATE INDEX IF NOT EXISTS idx_owners_property ON owners(property_id);

-- Table des virements aux propriétaires
CREATE TABLE IF NOT EXISTS owner_transfers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    owner_id UUID REFERENCES owners(id) ON DELETE SET NULL,
    unit_id UUID REFERENCES units(id) ON DELETE SET NULL,
    property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
    payment_id UUID REFERENCES payments(id) ON DELETE SET NULL, -- Lien vers le paiement locataire source
    amount DECIMAL(12,2) NOT NULL, -- Montant à virer (loyer - commission)
    commission_amount DECIMAL(12,2) DEFAULT 0, -- Montant de la commission
    due_date DATE NOT NULL, -- Date prévue du virement
    status TEXT CHECK (status IN ('scheduled', 'pending', 'completed', 'cancelled')) DEFAULT 'scheduled',
    transfer_method TEXT, -- 'bank_transfer', 'wave', 'orange_money', 'cash'
    transfer_reference TEXT, -- Référence du virement
    transferred_at TIMESTAMPTZ, -- Date effective du virement
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_owner_transfers_org ON owner_transfers(organization_id);
CREATE INDEX IF NOT EXISTS idx_owner_transfers_owner ON owner_transfers(owner_id);
CREATE INDEX IF NOT EXISTS idx_owner_transfers_status ON owner_transfers(status);
CREATE INDEX IF NOT EXISTS idx_owner_transfers_due_date ON owner_transfers(due_date);

-- Commentaires
COMMENT ON TABLE owners IS 'Propriétaires des biens immobiliers';
COMMENT ON TABLE owner_transfers IS 'Virements effectués ou programmés aux propriétaires';
COMMENT ON COLUMN owners.commission_rate IS 'Taux de commission en pourcentage (ex: 20.00 = 20%)';
COMMENT ON COLUMN owner_transfers.amount IS 'Montant net à virer au propriétaire (après commission)';
COMMENT ON COLUMN owner_transfers.commission_amount IS 'Montant de la commission retenue';

