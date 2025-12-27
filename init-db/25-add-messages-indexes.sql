-- =====================================================
-- 25-add-messages-indexes.sql
-- Add indexes for messages table to improve performance
-- Run this in your Supabase SQL editor
-- =====================================================

-- Index for unread message queries (read_at IS NULL)
CREATE INDEX IF NOT EXISTS idx_messages_read_at ON messages(read_at) WHERE read_at IS NULL;

-- Index for recipient_user_id (for user-to-user messages)
CREATE INDEX IF NOT EXISTS idx_messages_recipient_user ON messages(recipient_user_id) WHERE recipient_user_id IS NOT NULL;

-- Composite index for organization + recipient_user_id + read_at (common query pattern)
CREATE INDEX IF NOT EXISTS idx_messages_org_recipient_read ON messages(organization_id, recipient_user_id, read_at) 
WHERE recipient_user_id IS NOT NULL;

-- Composite index for organization + tenant_id + sender_type + read_at (tenant messages)
CREATE INDEX IF NOT EXISTS idx_messages_org_tenant_read ON messages(organization_id, tenant_id, sender_type, read_at) 
WHERE tenant_id IS NOT NULL;

-- Index for organization_id (if not already exists)
CREATE INDEX IF NOT EXISTS idx_messages_org ON messages(organization_id);

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✓ Messages Indexes Created';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE 'Indexes created:';
    RAISE NOTICE '  - idx_messages_read_at (for unread messages)';
    RAISE NOTICE '  - idx_messages_recipient_user (for user-to-user messages)';
    RAISE NOTICE '  - idx_messages_org_recipient_read (composite for user messages)';
    RAISE NOTICE '  - idx_messages_org_tenant_read (composite for tenant messages)';
    RAISE NOTICE '  - idx_messages_org (organization filter)';
    RAISE NOTICE '';
END $$;

