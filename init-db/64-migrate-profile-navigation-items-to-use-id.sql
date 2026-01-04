-- =================================================================
-- SAMBA ONE - Migration: profile_navigation_items to use navigation_item_id
-- Convert profile_navigation_items from navigation_item_key to navigation_item_id
-- =================================================================

-- Step 1: Add new column navigation_item_id (UUID, nullable for now)
ALTER TABLE profile_navigation_items 
ADD COLUMN IF NOT EXISTS navigation_item_id UUID REFERENCES navigation_items(id) ON DELETE CASCADE;

-- Step 2: Migrate data: populate navigation_item_id from navigation_item_key
UPDATE profile_navigation_items pni
SET navigation_item_id = ni.id
FROM navigation_items ni
WHERE pni.navigation_item_key = ni.key
  AND pni.navigation_item_id IS NULL;

-- Step 3: Verify all rows have navigation_item_id (should be 0 rows)
DO $$
DECLARE
    missing_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO missing_count
    FROM profile_navigation_items
    WHERE navigation_item_id IS NULL;
    
    IF missing_count > 0 THEN
        RAISE EXCEPTION 'Migration failed: % rows still have NULL navigation_item_id', missing_count;
    END IF;
END $$;

-- Step 4: Make navigation_item_id NOT NULL
ALTER TABLE profile_navigation_items 
ALTER COLUMN navigation_item_id SET NOT NULL;

-- Step 5: Drop the old foreign key constraint on navigation_item_key (if exists)
DO $$
BEGIN
    -- Drop foreign key constraint if it exists
    IF EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE table_name = 'profile_navigation_items' 
        AND constraint_name LIKE '%navigation_item_key%'
        AND constraint_type = 'FOREIGN KEY'
    ) THEN
        ALTER TABLE profile_navigation_items 
        DROP CONSTRAINT IF EXISTS profile_navigation_items_navigation_item_key_fkey;
    END IF;
END $$;

-- Step 6: Drop the old primary key constraint
ALTER TABLE profile_navigation_items 
DROP CONSTRAINT IF EXISTS profile_navigation_items_pkey;

-- Step 7: Drop the old column navigation_item_key
ALTER TABLE profile_navigation_items 
DROP COLUMN IF EXISTS navigation_item_key;

-- Step 8: Create new composite primary key with navigation_item_id
ALTER TABLE profile_navigation_items 
ADD CONSTRAINT profile_navigation_items_pkey 
PRIMARY KEY (profile_id, navigation_item_id);

-- Step 9: Update indexes
DROP INDEX IF EXISTS idx_profile_nav_item;
CREATE INDEX IF NOT EXISTS idx_profile_nav_item ON profile_navigation_items(navigation_item_id);
CREATE INDEX IF NOT EXISTS idx_profile_nav_profile_item ON profile_navigation_items(profile_id, navigation_item_id);

-- Step 10: Verify the migration
DO $$
DECLARE
    total_rows INTEGER;
    migrated_rows INTEGER;
BEGIN
    SELECT COUNT(*) INTO total_rows FROM profile_navigation_items;
    SELECT COUNT(*) INTO migrated_rows 
    FROM profile_navigation_items pni
    INNER JOIN navigation_items ni ON pni.navigation_item_id = ni.id;
    
    IF total_rows != migrated_rows THEN
        RAISE EXCEPTION 'Migration verification failed: % total rows but % migrated rows', total_rows, migrated_rows;
    END IF;
    
    RAISE NOTICE 'Migration successful: % rows migrated', migrated_rows;
END $$;

-- Comment
COMMENT ON COLUMN profile_navigation_items.navigation_item_id IS 'References navigation_items(id) - part of composite PRIMARY KEY with profile_id';
COMMENT ON TABLE profile_navigation_items IS 'Junction table linking profiles to navigation items. Composite PRIMARY KEY: (profile_id, navigation_item_id)';


