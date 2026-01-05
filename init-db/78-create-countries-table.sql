 -- =====================================================
-- Migration: Create countries table and link to organizations
-- =====================================================

-- 1. Create countries table
CREATE TABLE IF NOT EXISTS countries (
    code TEXT PRIMARY KEY, -- ISO 3166-1 alpha-2 (e.g., 'SN', 'CI')
    name TEXT NOT NULL, -- Nom du pays en français
    name_en TEXT, -- Nom du pays en anglais (optionnel)
    currency TEXT NOT NULL, -- Code devise ISO 4217 (e.g., 'XOF', 'XAF')
    currency_symbol TEXT NOT NULL, -- Symbole de la devise (e.g., 'FCFA', 'KMF')
    is_active BOOLEAN DEFAULT TRUE, -- Pays actif dans le système
    is_ohada BOOLEAN DEFAULT FALSE, -- Membre de l'OHADA
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create index on currency for faster lookups
CREATE INDEX IF NOT EXISTS idx_countries_currency ON countries(currency);
CREATE INDEX IF NOT EXISTS idx_countries_is_active ON countries(is_active);

-- 3. Add comments for documentation
COMMENT ON TABLE countries IS 'Table des pays avec leurs devises et informations';
COMMENT ON COLUMN countries.code IS 'Code pays ISO 3166-1 alpha-2 (ex: SN, CI, BF)';
COMMENT ON COLUMN countries.name IS 'Nom du pays en français';
COMMENT ON COLUMN countries.currency IS 'Code devise ISO 4217 (ex: XOF, XAF, KMF)';
COMMENT ON COLUMN countries.currency_symbol IS 'Symbole de la devise (ex: FCFA, KMF)';
COMMENT ON COLUMN countries.is_ohada IS 'Indique si le pays est membre de l''OHADA';

-- 4. Seed countries data (pays OHADA et autres pays d'Afrique)
INSERT INTO countries (code, name, currency, currency_symbol, is_ohada) VALUES
    -- Pays OHADA
    ('SN', 'Sénégal', 'XOF', 'FCFA', TRUE),
    ('CI', 'Côte d''Ivoire', 'XOF', 'FCFA', TRUE),
    ('BF', 'Burkina Faso', 'XOF', 'FCFA', TRUE),
    ('BJ', 'Bénin', 'XOF', 'FCFA', TRUE),
    ('CM', 'Cameroun', 'XAF', 'FCFA', TRUE),
    ('CF', 'Centrafrique', 'XAF', 'FCFA', TRUE),
    ('KM', 'Comores', 'KMF', 'KMF', TRUE),
    ('CG', 'Congo', 'XAF', 'FCFA', TRUE),
    ('CD', 'République démocratique du Congo', 'CDF', 'CDF', TRUE),
    ('GA', 'Gabon', 'XAF', 'FCFA', TRUE),
    ('GN', 'Guinée', 'GNF', 'GNF', TRUE),
    ('GW', 'Guinée-Bissau', 'XOF', 'FCFA', TRUE),
    ('GQ', 'Guinée équatoriale', 'XAF', 'FCFA', TRUE),
    ('ML', 'Mali', 'XOF', 'FCFA', TRUE),
    ('NE', 'Niger', 'XOF', 'FCFA', TRUE),
    ('TD', 'Tchad', 'XAF', 'FCFA', TRUE),
    ('TG', 'Togo', 'XOF', 'FCFA', TRUE),
    -- Autres pays d'Afrique de l'Ouest
    ('MR', 'Mauritanie', 'MRU', 'MRU', FALSE),
    ('GH', 'Ghana', 'GHS', 'GHS', FALSE),
    ('NG', 'Nigeria', 'NGN', 'NGN', FALSE)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    currency = EXCLUDED.currency,
    currency_symbol = EXCLUDED.currency_symbol,
    is_ohada = EXCLUDED.is_ohada,
    updated_at = NOW();

-- 5. Update organizations table to reference countries
-- First, ensure all existing organizations have a valid country code
DO $$
BEGIN
    -- Set default country for organizations without a valid country code
    UPDATE organizations 
    SET country = 'SN' 
    WHERE country IS NULL OR country NOT IN (SELECT code FROM countries);
END $$;

-- 6. Add foreign key constraint to organizations.country
-- First, check if the column exists and is the right type
DO $$
BEGIN
    -- Ensure country column exists and is TEXT
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'organizations' AND column_name = 'country'
    ) THEN
        ALTER TABLE organizations ADD COLUMN country TEXT NOT NULL DEFAULT 'SN';
    END IF;
    
    -- Add foreign key constraint if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'organizations_country_fkey'
        AND table_name = 'organizations'
    ) THEN
        ALTER TABLE organizations 
        ADD CONSTRAINT organizations_country_fkey 
        FOREIGN KEY (country) REFERENCES countries(code) ON DELETE RESTRICT;
    END IF;
    
    -- Create index on country for faster joins
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'idx_organizations_country'
    ) THEN
        CREATE INDEX idx_organizations_country ON organizations(country);
    END IF;
END $$;

-- 7. Add comments
COMMENT ON COLUMN organizations.country IS 'Code pays ISO 3166-1 alpha-2, référence à countries.code';

