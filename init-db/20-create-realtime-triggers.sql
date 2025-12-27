-- =====================================================
-- 20-create-realtime-triggers.sql
-- PostgreSQL triggers for real-time notifications using LISTEN/NOTIFY
-- =====================================================

-- Note: pg_notify() is a built-in PostgreSQL function, no extension needed

-- =====================================================
-- Helper function to send NOTIFY with JSON payload
-- =====================================================
CREATE OR REPLACE FUNCTION notify_event()
RETURNS TRIGGER AS $$
DECLARE
  channel_name TEXT;
  payload JSONB;
BEGIN
  -- Determine channel name based on table and organization
  channel_name := TG_TABLE_NAME || '_' || COALESCE(NEW.organization_id::TEXT, OLD.organization_id::TEXT);
  
  -- Build payload with event type and data
  payload := jsonb_build_object(
    'event', TG_OP, -- INSERT, UPDATE, DELETE
    'table', TG_TABLE_NAME,
    'id', COALESCE(NEW.id, OLD.id),
    'organization_id', COALESCE(NEW.organization_id, OLD.organization_id),
    'data', CASE
      WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD)
      ELSE to_jsonb(NEW)
    END,
    'timestamp', EXTRACT(EPOCH FROM NOW())
  );
  
  -- Send notification
  PERFORM pg_notify(channel_name, payload::TEXT);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Messages table triggers
-- =====================================================
DROP TRIGGER IF EXISTS messages_notify_insert ON messages;
DROP TRIGGER IF EXISTS messages_notify_update ON messages;
DROP TRIGGER IF EXISTS messages_notify_delete ON messages;

CREATE TRIGGER messages_notify_insert
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION notify_event();

CREATE TRIGGER messages_notify_update
  AFTER UPDATE ON messages
  FOR EACH ROW
  EXECUTE FUNCTION notify_event();

CREATE TRIGGER messages_notify_delete
  AFTER DELETE ON messages
  FOR EACH ROW
  EXECUTE FUNCTION notify_event();

-- =====================================================
-- Tasks table triggers
-- =====================================================
DROP TRIGGER IF EXISTS tasks_notify_insert ON tasks;
DROP TRIGGER IF EXISTS tasks_notify_update ON tasks;
DROP TRIGGER IF EXISTS tasks_notify_delete ON tasks;

CREATE TRIGGER tasks_notify_insert
  AFTER INSERT ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION notify_event();

CREATE TRIGGER tasks_notify_update
  AFTER UPDATE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION notify_event();

CREATE TRIGGER tasks_notify_delete
  AFTER DELETE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION notify_event();

-- =====================================================
-- Payments table triggers
-- =====================================================
DROP TRIGGER IF EXISTS payments_notify_insert ON payments;
DROP TRIGGER IF EXISTS payments_notify_update ON payments;
DROP TRIGGER IF EXISTS payments_notify_delete ON payments;

CREATE TRIGGER payments_notify_insert
  AFTER INSERT ON payments
  FOR EACH ROW
  EXECUTE FUNCTION notify_event();

CREATE TRIGGER payments_notify_update
  AFTER UPDATE ON payments
  FOR EACH ROW
  EXECUTE FUNCTION notify_event();

CREATE TRIGGER payments_notify_delete
  AFTER DELETE ON payments
  FOR EACH ROW
  EXECUTE FUNCTION notify_event();

-- =====================================================
-- Additional triggers for tenant-specific channels
-- =====================================================

-- Function for tenant-specific notifications (messages)
CREATE OR REPLACE FUNCTION notify_tenant_message()
RETURNS TRIGGER AS $$
DECLARE
  tenant_channel TEXT;
  payload JSONB;
BEGIN
  -- Only notify if tenant_id exists
  IF NEW.tenant_id IS NOT NULL THEN
    tenant_channel := 'tenant_' || NEW.tenant_id::TEXT || '_messages';
    
    payload := jsonb_build_object(
      'event', TG_OP,
      'table', 'messages',
      'id', NEW.id,
      'tenant_id', NEW.tenant_id,
      'organization_id', NEW.organization_id,
      'data', to_jsonb(NEW),
      'timestamp', EXTRACT(EPOCH FROM NOW())
    );
    
    PERFORM pg_notify(tenant_channel, payload::TEXT);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS messages_notify_tenant ON messages;
CREATE TRIGGER messages_notify_tenant
  AFTER INSERT OR UPDATE ON messages
  FOR EACH ROW
  WHEN (NEW.tenant_id IS NOT NULL)
  EXECUTE FUNCTION notify_tenant_message();

-- =====================================================
-- Function for user-specific task notifications
-- =====================================================
CREATE OR REPLACE FUNCTION notify_user_task()
RETURNS TRIGGER AS $$
DECLARE
  user_channel TEXT;
  payload JSONB;
BEGIN
  -- Notify assigned user
  IF NEW.assigned_to IS NOT NULL THEN
    user_channel := 'user_' || NEW.assigned_to::TEXT || '_tasks';
    
    payload := jsonb_build_object(
      'event', TG_OP,
      'table', 'tasks',
      'id', NEW.id,
      'assigned_to', NEW.assigned_to,
      'organization_id', NEW.organization_id,
      'data', to_jsonb(NEW),
      'timestamp', EXTRACT(EPOCH FROM NOW())
    );
    
    PERFORM pg_notify(user_channel, payload::TEXT);
  END IF;
  
  -- Notify creator
  IF NEW.created_by IS NOT NULL AND NEW.created_by != NEW.assigned_to THEN
    user_channel := 'user_' || NEW.created_by::TEXT || '_tasks';
    
    payload := jsonb_build_object(
      'event', TG_OP,
      'table', 'tasks',
      'id', NEW.id,
      'created_by', NEW.created_by,
      'organization_id', NEW.organization_id,
      'data', to_jsonb(NEW),
      'timestamp', EXTRACT(EPOCH FROM NOW())
    );
    
    PERFORM pg_notify(user_channel, payload::TEXT);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tasks_notify_user ON tasks;
CREATE TRIGGER tasks_notify_user
  AFTER INSERT OR UPDATE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION notify_user_task();

-- =====================================================
-- Indexes for better performance
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_messages_org_tenant ON messages(organization_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_tasks_org_assigned ON tasks(organization_id, assigned_to);
CREATE INDEX IF NOT EXISTS idx_payments_org_status ON payments(organization_id, status);

-- =====================================================
-- Comments
-- =====================================================
COMMENT ON FUNCTION notify_event() IS 'Generic function to send NOTIFY events for table changes';
COMMENT ON FUNCTION notify_tenant_message() IS 'Send notifications to tenant-specific channels for messages';
COMMENT ON FUNCTION notify_user_task() IS 'Send notifications to user-specific channels for task assignments';

DO $$
BEGIN
    RAISE NOTICE '✓ Real-time triggers created successfully';
    RAISE NOTICE '  - Messages: messages_{org_id}';
    RAISE NOTICE '  - Tasks: tasks_{org_id}, user_{user_id}_tasks';
    RAISE NOTICE '  - Payments: payments_{org_id}';
    RAISE NOTICE '  - Tenant messages: tenant_{tenant_id}_messages';
END $$;

