-- =====================================================
-- 28-create-payment-notification-trigger.sql
-- Create trigger to automatically create notifications when payments are created
-- Run this in your Supabase SQL editor
-- =====================================================

-- Function to create notifications for all users when a payment is created
CREATE OR REPLACE FUNCTION create_payment_notifications()
RETURNS TRIGGER AS $$
DECLARE
    tenant_record RECORD;
    tenant_name TEXT;
    formatted_amount TEXT;
    user_record RECORD;
BEGIN
    -- Get tenant information
    SELECT first_name, last_name INTO tenant_record
    FROM tenants
    WHERE id = NEW.tenant_id;

    -- Build tenant name
    IF tenant_record IS NOT NULL THEN
        tenant_name := TRIM(COALESCE(tenant_record.first_name, '') || ' ' || COALESCE(tenant_record.last_name, ''));
        IF tenant_name = '' THEN
            tenant_name := 'Un locataire';
        END IF;
    ELSE
        tenant_name := 'Un locataire';
    END IF;

    -- Format amount (assuming XOF currency)
    formatted_amount := TO_CHAR(NEW.amount, 'FM999,999,999.00') || ' XOF';

    -- Create notifications for all active users in the organization
    FOR user_record IN
        SELECT id FROM users
        WHERE organization_id = NEW.organization_id
        AND is_active = TRUE
    LOOP
        INSERT INTO notifications (
            organization_id,
            user_id,
            payment_id,
            type,
            content,
            status,
            sent_at
        ) VALUES (
            NEW.organization_id,
            user_record.id,
            NEW.id,
            'payment_created',
            'Nouveau paiement de ' || formatted_amount || ' de ' || tenant_name,
            'sent',
            NOW()
        );
    END LOOP;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trg_create_payment_notifications ON payments;
CREATE TRIGGER trg_create_payment_notifications
    AFTER INSERT ON payments
    FOR EACH ROW
    EXECUTE FUNCTION create_payment_notifications();

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✓ Payment Notification Trigger Created';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE 'Trigger created: trg_create_payment_notifications';
    RAISE NOTICE 'Function: create_payment_notifications()';
    RAISE NOTICE '';
    RAISE NOTICE 'This trigger will:';
    RAISE NOTICE '  - Automatically create notifications for all users';
    RAISE NOTICE '  - When a new payment is inserted';
    RAISE NOTICE '  - Include payment amount and tenant name';
    RAISE NOTICE '';
END $$;

