-- =====================================================
-- 26-add-recipient-user-id-to-messages.sql
-- Add recipient_user_id column to messages table for user-to-user messaging
-- Run this in your Supabase SQL editor
-- =====================================================

-- Add recipient_user_id column to messages table
ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS recipient_user_id UUID REFERENCES users(id) ON DELETE SET NULL;

-- Add index for recipient_user_id to improve query performance
CREATE INDEX IF NOT EXISTS idx_messages_recipient_user_id ON messages(recipient_user_id) 
WHERE recipient_user_id IS NOT NULL;

-- Add comment to document the column
COMMENT ON COLUMN messages.recipient_user_id IS 'ID of the user who should receive this message (for user-to-user messages). NULL for tenant messages.';

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✓ recipient_user_id Column Added';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE 'Column added: recipient_user_id';
    RAISE NOTICE 'Index created: idx_messages_recipient_user_id';
    RAISE NOTICE '';
    RAISE NOTICE 'This column is used for:';
    RAISE NOTICE '  - User-to-user messages (tenant_id IS NULL)';
    RAISE NOTICE '  - Determining who should receive notifications';
    RAISE NOTICE '  - Filtering messages for specific conversations';
    RAISE NOTICE '';
END $$;

