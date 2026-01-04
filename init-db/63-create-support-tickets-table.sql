-- =====================================================
-- Support Tickets Table
-- Allows organization admins to create support tickets
-- Super admins can view and manage all tickets
-- =====================================================

CREATE TABLE IF NOT EXISTS support_tickets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Ticket identification
    ticket_number TEXT UNIQUE NOT NULL, -- Format: TICKET-YYYYMMDD-XXXXX
    subject TEXT NOT NULL,
    description TEXT NOT NULL,
    
    -- Ticket status and priority
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'waiting_customer', 'resolved', 'closed', 'cancelled')),
    priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent', 'critical')),
    
    -- Category and type
    category TEXT CHECK (category IN ('technical', 'billing', 'feature_request', 'bug_report', 'account', 'other')),
    type TEXT CHECK (type IN ('question', 'issue', 'request', 'complaint', 'other')),
    
    -- User and organization context
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    
    -- Assignment
    assigned_to UUID REFERENCES users(id) ON DELETE SET NULL, -- Super admin or support staff
    assigned_at TIMESTAMPTZ,
    
    -- Resolution
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    resolution_notes TEXT,
    
    -- Attachments and metadata
    attachments JSONB DEFAULT '[]'::jsonb, -- Array of file URLs
    metadata JSONB DEFAULT '{}'::jsonb, -- Additional metadata
    
    -- Tags for filtering
    tags TEXT[] DEFAULT '{}',
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_activity_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Customer satisfaction (after resolution)
    satisfaction_rating INTEGER CHECK (satisfaction_rating BETWEEN 1 AND 5),
    satisfaction_feedback TEXT
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_priority ON support_tickets(priority);
CREATE INDEX IF NOT EXISTS idx_support_tickets_created_by ON support_tickets(created_by);
CREATE INDEX IF NOT EXISTS idx_support_tickets_organization_id ON support_tickets(organization_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_assigned_to ON support_tickets(assigned_to);
CREATE INDEX IF NOT EXISTS idx_support_tickets_created_at ON support_tickets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_tickets_ticket_number ON support_tickets(ticket_number);
CREATE INDEX IF NOT EXISTS idx_support_tickets_category ON support_tickets(category);
CREATE INDEX IF NOT EXISTS idx_support_tickets_tags ON support_tickets USING GIN(tags);

-- Function to generate ticket number
CREATE OR REPLACE FUNCTION generate_ticket_number()
RETURNS TEXT AS $$
DECLARE
    date_part TEXT;
    sequence_num INTEGER;
    ticket_num TEXT;
BEGIN
    -- Get date part (YYYYMMDD)
    date_part := TO_CHAR(NOW(), 'YYYYMMDD');
    
    -- Get sequence number for today (count tickets created today + 1)
    SELECT COALESCE(MAX(
        CAST(SUBSTRING(ticket_number FROM 'TICKET-[0-9]{8}-([0-9]+)$') AS INTEGER)
    ), 0) + 1
    INTO sequence_num
    FROM support_tickets
    WHERE ticket_number LIKE 'TICKET-' || date_part || '-%';
    
    -- Format: TICKET-YYYYMMDD-XXXXX (5 digits, zero-padded)
    ticket_num := 'TICKET-' || date_part || '-' || LPAD(sequence_num::TEXT, 5, '0');
    
    RETURN ticket_num;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate ticket number
CREATE OR REPLACE FUNCTION set_ticket_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.ticket_number IS NULL OR NEW.ticket_number = '' THEN
        NEW.ticket_number := generate_ticket_number();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_ticket_number
    BEFORE INSERT ON support_tickets
    FOR EACH ROW
    EXECUTE FUNCTION set_ticket_number();

-- Trigger to update updated_at and last_activity_at
CREATE OR REPLACE FUNCTION update_ticket_timestamps()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    NEW.last_activity_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_ticket_timestamps
    BEFORE UPDATE ON support_tickets
    FOR EACH ROW
    EXECUTE FUNCTION update_ticket_timestamps();

-- Table for ticket comments/updates
CREATE TABLE IF NOT EXISTS support_ticket_comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    ticket_id UUID REFERENCES support_tickets(id) ON DELETE CASCADE,
    
    -- Comment content
    comment TEXT NOT NULL,
    is_internal BOOLEAN DEFAULT FALSE, -- Internal notes visible only to support staff
    
    -- User context
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    
    -- Attachments
    attachments JSONB DEFAULT '[]'::jsonb,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for comments
CREATE INDEX IF NOT EXISTS idx_ticket_comments_ticket_id ON support_ticket_comments(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_comments_created_at ON support_ticket_comments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ticket_comments_created_by ON support_ticket_comments(created_by);

-- Trigger to update ticket last_activity_at when comment is added
CREATE OR REPLACE FUNCTION update_ticket_activity_on_comment()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE support_tickets
    SET last_activity_at = NOW()
    WHERE id = NEW.ticket_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_ticket_activity_on_comment
    AFTER INSERT ON support_ticket_comments
    FOR EACH ROW
    EXECUTE FUNCTION update_ticket_activity_on_comment();

-- Comments
COMMENT ON TABLE support_tickets IS 'Support tickets created by organization admins';
COMMENT ON COLUMN support_tickets.ticket_number IS 'Unique ticket number in format TICKET-YYYYMMDD-XXXXX';
COMMENT ON COLUMN support_tickets.status IS 'Ticket status: open, in_progress, waiting_customer, resolved, closed, cancelled';
COMMENT ON COLUMN support_tickets.priority IS 'Ticket priority: low, medium, high, urgent, critical';
COMMENT ON COLUMN support_tickets.category IS 'Ticket category: technical, billing, feature_request, bug_report, account, other';
COMMENT ON COLUMN support_tickets.type IS 'Ticket type: question, issue, request, complaint, other';
COMMENT ON COLUMN support_tickets.attachments IS 'Array of file URLs attached to the ticket';
COMMENT ON COLUMN support_tickets.metadata IS 'Additional metadata stored as JSONB';
COMMENT ON COLUMN support_tickets.tags IS 'Tags for filtering and categorization';
COMMENT ON COLUMN support_tickets.satisfaction_rating IS 'Customer satisfaction rating (1-5) after resolution';

COMMENT ON TABLE support_ticket_comments IS 'Comments and updates on support tickets';
COMMENT ON COLUMN support_ticket_comments.is_internal IS 'If true, comment is only visible to support staff, not to the ticket creator';

