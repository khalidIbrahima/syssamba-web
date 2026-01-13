-- =====================================================
-- Migration: Add TVA column to countries table
-- =====================================================

-- Add TVA column to countries table
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'countries' AND column_name = 'tva'
    ) THEN
        ALTER TABLE countries 
        ADD COLUMN tva DECIMAL(5, 2) DEFAULT 0.00;
        
        COMMENT ON COLUMN countries.tva IS 'Taux de TVA en pourcentage (ex: 18.00 pour 18%)';
    END IF;
END $$;
