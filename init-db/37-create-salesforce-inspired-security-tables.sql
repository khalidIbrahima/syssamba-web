-- =====================================================
-- Salesforce-Inspired Security System
-- Multi-layered security: OLS (Object-Level) and FLS (Field-Level)
-- =====================================================

-- 1. OBJECT-LEVEL SECURITY (OLS)
-- Stores permissions for each object type per role/plan
CREATE TABLE IF NOT EXISTS object_permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    plan_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'accountant', 'agent', 'viewer')),
    object_type TEXT NOT NULL, -- Property, Unit, Tenant, Lease, Payment, Task, Message, JournalEntry, User, Organization, Report, Activity
    access_level TEXT CHECK (access_level IN ('None', 'Read', 'ReadWrite', 'All')) NOT NULL,
    can_create BOOLEAN DEFAULT FALSE,
    can_read BOOLEAN DEFAULT FALSE,
    can_edit BOOLEAN DEFAULT FALSE,
    can_delete BOOLEAN DEFAULT FALSE,
    can_view_all BOOLEAN DEFAULT FALSE, -- Can view all records vs only own
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(plan_name, role, object_type)
);

-- 2. FIELD-LEVEL SECURITY (FLS)
-- Controls access to specific fields within objects
CREATE TABLE IF NOT EXISTS field_permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    plan_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'accountant', 'agent', 'viewer')),
    object_type TEXT NOT NULL,
    field_name TEXT NOT NULL,
    access_level TEXT CHECK (access_level IN ('None', 'Read', 'ReadWrite')) NOT NULL,
    can_read BOOLEAN DEFAULT FALSE,
    can_edit BOOLEAN DEFAULT FALSE,
    is_sensitive BOOLEAN DEFAULT FALSE, -- Mark sensitive fields (financial, personal data)
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(plan_name, role, object_type, field_name)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_object_permissions_plan_role ON object_permissions(plan_name, role);
CREATE INDEX IF NOT EXISTS idx_object_permissions_object_type ON object_permissions(object_type);
CREATE INDEX IF NOT EXISTS idx_field_permissions_plan_role ON field_permissions(plan_name, role, object_type);
CREATE INDEX IF NOT EXISTS idx_field_permissions_object_field ON field_permissions(object_type, field_name);

-- Add to Supabase Realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE object_permissions;
ALTER PUBLICATION supabase_realtime ADD TABLE field_permissions;

-- Helper function to check object-level access
CREATE OR REPLACE FUNCTION check_object_access(
    p_user_id UUID,
    p_organization_id UUID,
    p_object_type TEXT,
    p_action TEXT -- 'read', 'edit', 'delete', 'create'
)
RETURNS BOOLEAN AS $$
DECLARE
    v_user_role TEXT;
    v_user_plan TEXT;
    v_object_permission RECORD;
BEGIN
    -- Get user's role and organization plan
    SELECT u.role, o.plan INTO v_user_role, v_user_plan
    FROM users u
    JOIN organizations o ON u.organization_id = o.id
    WHERE u.id = p_user_id AND u.organization_id = p_organization_id;
    
    IF v_user_role IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- Get object-level permission
    SELECT * INTO v_object_permission
    FROM object_permissions
    WHERE plan_name = v_user_plan 
      AND role = v_user_role 
      AND object_type = p_object_type;
    
    IF v_object_permission IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- Check action permission
    CASE p_action
        WHEN 'create' THEN
            RETURN v_object_permission.can_create;
        WHEN 'read' THEN
            RETURN v_object_permission.can_read;
        WHEN 'edit' THEN
            RETURN v_object_permission.can_edit;
        WHEN 'delete' THEN
            RETURN v_object_permission.can_delete;
        ELSE
            RETURN FALSE;
    END CASE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to check field-level access
CREATE OR REPLACE FUNCTION check_field_access(
    p_user_id UUID,
    p_organization_id UUID,
    p_object_type TEXT,
    p_field_name TEXT,
    p_action TEXT -- 'read', 'edit'
)
RETURNS BOOLEAN AS $$
DECLARE
    v_user_role TEXT;
    v_user_plan TEXT;
    v_field_permission RECORD;
BEGIN
    -- Get user's role and organization plan
    SELECT u.role, o.plan INTO v_user_role, v_user_plan
    FROM users u
    JOIN organizations o ON u.organization_id = o.id
    WHERE u.id = p_user_id AND u.organization_id = p_organization_id;
    
    IF v_user_role IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- Get field-level permission
    SELECT * INTO v_field_permission
    FROM field_permissions
    WHERE plan_name = v_user_plan 
      AND role = v_user_role 
      AND object_type = p_object_type
      AND field_name = p_field_name;
    
    -- If no specific permission, default based on role
    -- Owner and admin have full access by default
    IF v_field_permission IS NULL THEN
        IF v_user_role IN ('owner', 'admin') THEN
            RETURN TRUE;
        ELSIF p_action = 'read' THEN
            -- Most roles can read non-sensitive fields
            RETURN TRUE;
        ELSE
            -- Only owner/admin can edit by default
            RETURN FALSE;
        END IF;
    END IF;
    
    -- Check action permission
    CASE p_action
        WHEN 'read' THEN
            RETURN v_field_permission.can_read;
        WHEN 'edit' THEN
            RETURN v_field_permission.can_edit;
        ELSE
            RETURN FALSE;
    END CASE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comments
COMMENT ON TABLE object_permissions IS 'Object-Level Security: Controls access to object types (tables)';
COMMENT ON TABLE field_permissions IS 'Field-Level Security: Controls access to specific fields within objects';
COMMENT ON FUNCTION check_object_access IS 'Check if a user can perform an action on an object type';
COMMENT ON FUNCTION check_field_access IS 'Check if a user can read/edit a specific field';

