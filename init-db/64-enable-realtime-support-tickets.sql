-- =====================================================
-- Enable Supabase Realtime for Support Tickets
-- Allows real-time notifications when new tickets are created
-- =====================================================

-- Enable Realtime for support_tickets table
ALTER PUBLICATION supabase_realtime ADD TABLE support_tickets;

-- Enable Realtime for support_ticket_comments table (optional, for future use)
ALTER PUBLICATION supabase_realtime ADD TABLE support_ticket_comments;

-- Verify Realtime is enabled
-- You can check this in Supabase Dashboard > Database > Replication
-- The tables should appear in the Realtime section

COMMENT ON TABLE support_tickets IS 'Realtime enabled: Super admins receive notifications when new tickets are created';

