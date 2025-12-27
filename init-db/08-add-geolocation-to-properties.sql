-- =====================================================
-- 08-add-geolocation-to-properties.sql
-- Migration: Add geolocation fields (latitude, longitude) to properties table
-- =====================================================

-- Add latitude column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'properties' 
        AND column_name = 'latitude'
    ) THEN
        ALTER TABLE properties 
        ADD COLUMN latitude DECIMAL(10, 8);
        
        RAISE NOTICE 'Column latitude added to properties table';
    ELSE
        RAISE NOTICE 'Column latitude already exists in properties table';
    END IF;
END $$;

-- Add longitude column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'properties' 
        AND column_name = 'longitude'
    ) THEN
        ALTER TABLE properties 
        ADD COLUMN longitude DECIMAL(11, 8);
        
        RAISE NOTICE 'Column longitude added to properties table';
    ELSE
        RAISE NOTICE 'Column longitude already exists in properties table';
    END IF;
END $$;

-- Create index for geospatial queries (useful for distance calculations)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_indexes 
        WHERE tablename = 'properties' 
        AND indexname = 'idx_properties_location'
    ) THEN
        CREATE INDEX idx_properties_location 
        ON properties (latitude, longitude) 
        WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
        
        RAISE NOTICE 'Index idx_properties_location created';
    ELSE
        RAISE NOTICE 'Index idx_properties_location already exists';
    END IF;
END $$;

-- Verify the changes
DO $$
BEGIN
    -- Check if latitude exists
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'properties' 
        AND column_name = 'latitude'
    ) THEN
        RAISE NOTICE '✓ Latitude column exists';
    ELSE
        RAISE WARNING '✗ Latitude column does not exist';
    END IF;
    
    -- Check if longitude exists
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'properties' 
        AND column_name = 'longitude'
    ) THEN
        RAISE NOTICE '✓ Longitude column exists';
    ELSE
        RAISE WARNING '✗ Longitude column does not exist';
    END IF;

    -- Check if index exists
    IF EXISTS (
        SELECT 1 
        FROM pg_indexes 
        WHERE tablename = 'properties' 
        AND indexname = 'idx_properties_location'
    ) THEN
        RAISE NOTICE '✓ Index idx_properties_location exists';
    ELSE
        RAISE WARNING '✗ Index idx_properties_location does not exist';
    END IF;
END $$;

