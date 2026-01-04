-- =====================================================
-- System Logs Table
-- Tracks all issues, errors, warnings, and info events
-- =====================================================

CREATE TABLE IF NOT EXISTS system_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Log level
    level TEXT NOT NULL CHECK (level IN ('error', 'warn', 'info', 'debug', 'critical')),
    
    -- Log message
    message TEXT NOT NULL,
    
    -- Additional context (stored as JSONB for flexibility)
    context JSONB DEFAULT '{}'::jsonb,
    
    -- Error details (for errors)
    error_details JSONB,
    
    -- User and organization context
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
    
    -- Request context (for API routes)
    request_path TEXT,
    request_method TEXT,
    request_id TEXT, -- Unique request identifier for tracing
    
    -- Stack trace (for errors)
    stack_trace TEXT,
    
    -- Source location
    source_file TEXT,
    source_function TEXT,
    source_line INTEGER,
    
    -- Environment
    environment TEXT, -- 'development', 'staging', 'production'
    
    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ, -- When issue was resolved
    resolved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    
    -- Status
    status TEXT DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'resolved', 'ignored')),
    
    -- Severity (for prioritization)
    severity TEXT DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    
    -- Tags for filtering
    tags TEXT[] DEFAULT '{}',
    
    -- Related logs (for grouping related issues)
    related_log_ids UUID[] DEFAULT '{}'
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_system_logs_level ON system_logs(level);
CREATE INDEX IF NOT EXISTS idx_system_logs_created_at ON system_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_logs_user_id ON system_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_system_logs_organization_id ON system_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_system_logs_status ON system_logs(status);
CREATE INDEX IF NOT EXISTS idx_system_logs_severity ON system_logs(severity);
CREATE INDEX IF NOT EXISTS idx_system_logs_request_id ON system_logs(request_id);
CREATE INDEX IF NOT EXISTS idx_system_logs_tags ON system_logs USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_system_logs_context ON system_logs USING GIN(context);
CREATE INDEX IF NOT EXISTS idx_system_logs_environment ON system_logs(environment);

-- Index for searching by message (full text search)
CREATE INDEX IF NOT EXISTS idx_system_logs_message_search ON system_logs USING GIN(to_tsvector('french', message));

-- Function to automatically set environment
CREATE OR REPLACE FUNCTION set_log_environment()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.environment IS NULL THEN
        NEW.environment := COALESCE(
            current_setting('app.environment', true),
            CASE 
                WHEN current_setting('server_version_num')::int >= 140000 THEN 'production'
                ELSE 'development'
            END
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_log_environment
    BEFORE INSERT ON system_logs
    FOR EACH ROW
    EXECUTE FUNCTION set_log_environment();

-- Function to clean old logs (optional, can be run periodically)
CREATE OR REPLACE FUNCTION cleanup_old_logs(days_to_keep INTEGER DEFAULT 90)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM system_logs
    WHERE created_at < NOW() - (days_to_keep || ' days')::INTERVAL
    AND status = 'resolved'
    AND level IN ('info', 'debug');
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Comments
COMMENT ON TABLE system_logs IS 'System-wide logging table for tracking errors, warnings, and informational events';
COMMENT ON COLUMN system_logs.level IS 'Log level: error, warn, info, debug, critical';
COMMENT ON COLUMN system_logs.context IS 'Additional context data stored as JSONB';
COMMENT ON COLUMN system_logs.error_details IS 'Detailed error information for error-level logs';
COMMENT ON COLUMN system_logs.request_id IS 'Unique request identifier for tracing requests across services';
COMMENT ON COLUMN system_logs.status IS 'Status of the log entry: open, investigating, resolved, ignored';
COMMENT ON COLUMN system_logs.severity IS 'Severity level for prioritization: low, medium, high, critical';
COMMENT ON COLUMN system_logs.tags IS 'Tags for filtering and grouping related logs';
COMMENT ON COLUMN system_logs.related_log_ids IS 'Array of related log IDs for grouping related issues';

