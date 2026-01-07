-- =================================================================
-- Add English translation fields to plans table
-- This migration adds display_name_en and description_en columns
-- =================================================================

DO $$
BEGIN
    -- Add display_name_en column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'plans' 
        AND column_name = 'display_name_en'
    ) THEN
        ALTER TABLE plans ADD COLUMN display_name_en TEXT;
        RAISE NOTICE 'Column display_name_en added to plans table';
    ELSE
        RAISE NOTICE 'Column display_name_en already exists in plans table';
    END IF;

    -- Add description_en column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'plans' 
        AND column_name = 'description_en'
    ) THEN
        ALTER TABLE plans ADD COLUMN description_en TEXT;
        RAISE NOTICE 'Column description_en added to plans table';
    ELSE
        RAISE NOTICE 'Column description_en already exists in plans table';
    END IF;
END $$;

-- Add comments for documentation
COMMENT ON COLUMN plans.display_name_en IS 'English display name for the plan';
COMMENT ON COLUMN plans.description_en IS 'English description for the plan';

