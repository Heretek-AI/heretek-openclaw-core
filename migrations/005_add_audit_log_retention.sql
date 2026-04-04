-- Migration: Add Audit Log Retention
-- Version: 5
-- Created: 2026-04-04
-- Description: Add audit log retention policy and cleanup function

-- UP
BEGIN;

-- Add retention configuration table
CREATE TABLE IF NOT EXISTS audit_retention_config (
    id SERIAL PRIMARY KEY,
    event_type VARCHAR(100) UNIQUE NOT NULL,
    retention_days INTEGER NOT NULL DEFAULT 90,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT valid_retention_days CHECK (retention_days > 0)
);

-- Insert default retention policies
INSERT INTO audit_retention_config (event_type, retention_days) VALUES
    ('debug', 7),
    ('info', 30),
    ('warning', 90),
    ('error', 365),
    ('critical', 1825)  -- 5 years
ON CONFLICT (event_type) 
DO UPDATE SET 
    retention_days = EXCLUDED.retention_days,
    updated_at = CURRENT_TIMESTAMP;

-- Function to clean up old audit logs
CREATE OR REPLACE FUNCTION cleanup_audit_logs()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM audit_log
    WHERE created_at < (
        SELECT CURRENT_TIMESTAMP - (retention_days || ' days')::INTERVAL
        FROM audit_retention_config
        WHERE audit_log.event_type = audit_retention_config.event_type
    );
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Add index for cleanup performance
CREATE INDEX IF NOT EXISTS idx_audit_log_event_type_created 
ON audit_log(event_type, created_at);

-- Add comment to audit_log table for retention policy
COMMENT ON TABLE audit_log IS 'Audit log with configurable retention policies per event type';

-- Add comment to retention config table
COMMENT ON TABLE audit_retention_config IS 'Configurable retention policies for audit log events by type';

COMMIT;

-- DOWN
BEGIN;

DROP INDEX IF EXISTS idx_audit_log_event_type_created;

DROP FUNCTION IF EXISTS cleanup_audit_logs() CASCADE;

DROP TABLE IF EXISTS audit_retention_config CASCADE;

COMMIT;
