-- =================================================================
-- Add English translation fields to features table
-- This migration adds name_en and description_en columns
-- =================================================================

DO $$
BEGIN
    -- Add name_en column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'features' 
        AND column_name = 'name_en'
    ) THEN
        ALTER TABLE features ADD COLUMN name_en TEXT;
        RAISE NOTICE 'Column name_en added to features table';
    ELSE
        RAISE NOTICE 'Column name_en already exists in features table';
    END IF;

    -- Add description_en column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'features' 
        AND column_name = 'description_en'
    ) THEN
        ALTER TABLE features ADD COLUMN description_en TEXT;
        RAISE NOTICE 'Column description_en added to features table';
    ELSE
        RAISE NOTICE 'Column description_en already exists in features table';
    END IF;
END $$;

-- Add comments for documentation
COMMENT ON COLUMN features.name_en IS 'English name for the feature';
COMMENT ON COLUMN features.description_en IS 'English description for the feature';

