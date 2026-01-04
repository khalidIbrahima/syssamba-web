-- =================================================================
-- Add missing columns to plans table if they don't exist
-- This migration ensures all required columns from the schema are present
-- =================================================================

DO $$
BEGIN
    -- Add price column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'plans' 
        AND column_name = 'price'
    ) THEN
        ALTER TABLE plans ADD COLUMN price DECIMAL(10, 2);
        RAISE NOTICE 'Column price added to plans table';
    ELSE
        RAISE NOTICE 'Column price already exists in plans table';
    END IF;

    -- Add price_type column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'plans' 
        AND column_name = 'price_type'
    ) THEN
        ALTER TABLE plans ADD COLUMN price_type TEXT NOT NULL DEFAULT 'fixed' 
            CHECK (price_type IN ('fixed', 'custom'));
        RAISE NOTICE 'Column price_type added to plans table';
    ELSE
        RAISE NOTICE 'Column price_type already exists in plans table';
    END IF;

    -- Add lots_limit column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'plans' 
        AND column_name = 'lots_limit'
    ) THEN
        ALTER TABLE plans ADD COLUMN lots_limit INTEGER;
        RAISE NOTICE 'Column lots_limit added to plans table';
    ELSE
        RAISE NOTICE 'Column lots_limit already exists in plans table';
    END IF;

    -- Add users_limit column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'plans' 
        AND column_name = 'users_limit'
    ) THEN
        ALTER TABLE plans ADD COLUMN users_limit INTEGER;
        RAISE NOTICE 'Column users_limit added to plans table';
    ELSE
        RAISE NOTICE 'Column users_limit already exists in plans table';
    END IF;

    -- Add extranet_tenants_limit column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'plans' 
        AND column_name = 'extranet_tenants_limit'
    ) THEN
        ALTER TABLE plans ADD COLUMN extranet_tenants_limit INTEGER;
        RAISE NOTICE 'Column extranet_tenants_limit added to plans table';
    ELSE
        RAISE NOTICE 'Column extranet_tenants_limit already exists in plans table';
    END IF;

    -- Add features column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'plans' 
        AND column_name = 'features'
    ) THEN
        ALTER TABLE plans ADD COLUMN features JSONB NOT NULL DEFAULT '{}';
        RAISE NOTICE 'Column features added to plans table';
    ELSE
        RAISE NOTICE 'Column features already exists in plans table';
    END IF;

    -- Add support_level column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'plans' 
        AND column_name = 'support_level'
    ) THEN
        ALTER TABLE plans ADD COLUMN support_level TEXT NOT NULL DEFAULT 'community' 
            CHECK (support_level IN ('community', 'email', 'priority_email', 'phone_24_7', 'dedicated_manager'));
        RAISE NOTICE 'Column support_level added to plans table';
    ELSE
        RAISE NOTICE 'Column support_level already exists in plans table';
    END IF;

    -- Add is_active column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'plans' 
        AND column_name = 'is_active'
    ) THEN
        ALTER TABLE plans ADD COLUMN is_active BOOLEAN DEFAULT true;
        RAISE NOTICE 'Column is_active added to plans table';
    ELSE
        RAISE NOTICE 'Column is_active already exists in plans table';
    END IF;

    -- Add sort_order column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'plans' 
        AND column_name = 'sort_order'
    ) THEN
        ALTER TABLE plans ADD COLUMN sort_order INTEGER DEFAULT 0;
        RAISE NOTICE 'Column sort_order added to plans table';
    ELSE
        RAISE NOTICE 'Column sort_order already exists in plans table';
    END IF;

    -- Add description column if it doesn't exist (optional field)
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'plans' 
        AND column_name = 'description'
    ) THEN
        ALTER TABLE plans ADD COLUMN description TEXT;
        RAISE NOTICE 'Column description added to plans table';
    ELSE
        RAISE NOTICE 'Column description already exists in plans table';
    END IF;
END $$;

-- Add comments for documentation
COMMENT ON COLUMN plans.price IS 'Prix mensuel en FCFA (NULL pour Enterprise = sur devis)';
COMMENT ON COLUMN plans.price_type IS 'Type de prix: fixed ou custom';
COMMENT ON COLUMN plans.lots_limit IS 'Limite de lots (NULL = illimité)';
COMMENT ON COLUMN plans.users_limit IS 'Limite d''utilisateurs (NULL = illimité)';
COMMENT ON COLUMN plans.extranet_tenants_limit IS 'Limite de locataires extranet (NULL = illimité)';
COMMENT ON COLUMN plans.features IS 'JSONB contenant toutes les fonctionnalités du plan';
COMMENT ON COLUMN plans.support_level IS 'Niveau de support inclus dans le plan';

