-- =====================================================
-- 27-add-notification-fields.sql
-- Add fields to notifications table for payment notifications
-- Run this in your Supabase SQL editor
-- =====================================================

-- Add user_id column to link notifications to users
ALTER TABLE notifications 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;

-- Add read_at column to track when notifications are read
ALTER TABLE notifications 
ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;

-- Add payment_id column to link notifications to payments
ALTER TABLE notifications 
ADD COLUMN IF NOT EXISTS payment_id UUID REFERENCES payments(id) ON DELETE CASCADE;

-- Add index for user_id to improve query performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id) 
WHERE user_id IS NOT NULL;

-- Add index for read_at to improve query performance
CREATE INDEX IF NOT EXISTS idx_notifications_read_at ON notifications(read_at) 
WHERE read_at IS NULL;

-- Add composite index for user + read_at (common query pattern)
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, read_at) 
WHERE user_id IS NOT NULL;

-- Add index for organization_id if not exists
CREATE INDEX IF NOT EXISTS idx_notifications_org ON notifications(organization_id);

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✓ Notification Fields Added';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE 'Columns added:';
    RAISE NOTICE '  - user_id (links notification to user)';
    RAISE NOTICE '  - read_at (tracks when notification is read)';
    RAISE NOTICE '  - payment_id (links notification to payment)';
    RAISE NOTICE '';
    RAISE NOTICE 'Indexes created:';
    RAISE NOTICE '  - idx_notifications_user_id';
    RAISE NOTICE '  - idx_notifications_read_at';
    RAISE NOTICE '  - idx_notifications_user_read';
    RAISE NOTICE '  - idx_notifications_org';
    RAISE NOTICE '';
END $$;

