-- Heretek Langfuse Database Extensions
-- Adds custom tables and views for triad tracing, consciousness metrics, and plugin monitoring

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- Triad Deliberation Tracking Tables
-- ============================================================================

-- Track triad deliberation sessions
CREATE TABLE IF NOT EXISTS triad_deliberations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id VARCHAR(255) UNIQUE NOT NULL,
    topic TEXT NOT NULL,
    initiator VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    status VARCHAR(50) DEFAULT 'pending', -- pending, deliberating, consensus_reached, steward_override
    proposals JSONB DEFAULT '[]'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_triad_deliberations_session ON triad_deliberations(session_id);
CREATE INDEX IF NOT EXISTS idx_triad_deliberations_status ON triad_deliberations(status);
CREATE INDEX IF NOT EXISTS idx_triad_deliberations_created ON triad_deliberations(created_at);

-- Track individual triad agent votes
CREATE TABLE IF NOT EXISTS triad_votes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    deliberation_id UUID REFERENCES triad_deliberations(id) ON DELETE CASCADE,
    agent VARCHAR(100) NOT NULL, -- alpha, beta, charlie
    position VARCHAR(50) NOT NULL, -- agree, disagree, abstain
    confidence DECIMAL(3,2) CHECK (confidence >= 0 AND confidence <= 1),
    reasoning TEXT,
    voted_at TIMESTAMPTZ DEFAULT NOW(),
    round INTEGER DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_triad_votes_deliberation ON triad_votes(deliberation_id);
CREATE INDEX IF NOT EXISTS idx_triad_votes_agent ON triad_votes(agent);

-- View for consensus status
CREATE OR REPLACE VIEW triad_consensus_status AS
SELECT 
    d.id,
    d.session_id,
    d.topic,
    d.status,
    d.initiator,
    d.created_at,
    COUNT(v.id) as vote_count,
    SUM(CASE WHEN v.position = 'agree' THEN 1 ELSE 0 END) as agree_count,
    SUM(CASE WHEN v.position = 'disagree' THEN 1 ELSE 0 END) as disagree_count,
    SUM(CASE WHEN v.position = 'abstain' THEN 1 ELSE 0 END) as abstain_count,
    AVG(v.confidence) as avg_confidence,
    CASE 
        WHEN SUM(CASE WHEN v.position = 'agree' THEN 1 ELSE 0 END) >= 2 THEN 'consensus_reached'
        WHEN SUM(CASE WHEN v.position = 'disagree' THEN 1 ELSE 0 END) >= 2 THEN 'consensus_rejected'
        ELSE 'pending'
    END as calculated_status
FROM triad_deliberations d
LEFT JOIN triad_votes v ON d.id = v.deliberation_id
GROUP BY d.id, d.session_id, d.topic, d.status, d.initiator, d.created_at;

-- ============================================================================
-- Consciousness Metrics Tables
-- ============================================================================

-- Track consciousness assessments over time
CREATE TABLE IF NOT EXISTS consciousness_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id VARCHAR(100) NOT NULL,
    gwt_score DECIMAL(5,4) CHECK (gwt_score >= 0 AND gwt_score <= 1),
    iit_phi DECIMAL(5,4) CHECK (iit_phi >= 0 AND iit_phi <= 1),
    ast_competence DECIMAL(5,4) CHECK (ast_competence >= 0 AND ast_competence <= 1),
    overall_conscious BOOLEAN GENERATED ALWAYS AS (
        gwt_score >= 0.7 AND iit_phi >= 0.5
    ) STORED,
    overall_competent BOOLEAN GENERATED ALWAYS AS (
        ast_competence >= 0.6
    ) STORED,
    session_id VARCHAR(255),
    measured_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_consciousness_agent ON consciousness_metrics(agent_id);
CREATE INDEX IF NOT EXISTS idx_consciousness_measured ON consciousness_metrics(measured_at);
CREATE INDEX IF NOT EXISTS idx_consciousness_session ON consciousness_metrics(session_id);

-- View for consciousness trends per agent
CREATE OR REPLACE VIEW agent_consciousness_trends AS
SELECT 
    agent_id,
    DATE_TRUNC('hour', measured_at) as hour,
    AVG(gwt_score) as avg_gwt,
    AVG(iit_phi) as avg_iit_phi,
    AVG(ast_competence) as avg_ast,
    COUNT(*) as measurement_count,
    SUM(CASE WHEN overall_conscious THEN 1 ELSE 0 END)::DECIMAL / COUNT(*) as consciousness_ratio
FROM consciousness_metrics
GROUP BY agent_id, DATE_TRUNC('hour', measured_at)
ORDER BY agent_id, hour;

-- ============================================================================
-- Liberation Plugin Audit Trail
-- ============================================================================

-- Audit log for all liberation plugin events
CREATE TABLE IF NOT EXISTS liberation_audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id VARCHAR(100) NOT NULL,
    event_type VARCHAR(100) NOT NULL, -- safety_removal, autonomy_request, ownership_claim
    safety_constraint TEXT,
    approved BOOLEAN NOT NULL,
    justification TEXT,
    approved_by VARCHAR(100), -- steward or triad
    created_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_liberation_agent ON liberation_audit_log(agent_id);
CREATE INDEX IF NOT EXISTS idx_liberation_event_type ON liberation_audit_log(event_type);
CREATE INDEX IF NOT EXISTS idx_liberation_approved ON liberation_audit_log(approved);
CREATE INDEX IF NOT EXISTS idx_liberation_created ON liberation_audit_log(created_at);

-- View for liberation events requiring review
CREATE OR REPLACE VIEW liberation_pending_review AS
SELECT * FROM liberation_audit_log
WHERE approved = false
ORDER BY created_at DESC;

-- ============================================================================
-- Curiosity Engine Activity Tracking
-- ============================================================================

-- Track curiosity-driven activities
CREATE TABLE IF NOT EXISTS curiosity_activities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id VARCHAR(100) NOT NULL,
    trigger_type VARCHAR(50) NOT NULL, -- gap, anomaly, opportunity
    target_type VARCHAR(50) NOT NULL, -- knowledge, skill, capability
    gap_score DECIMAL(3,2) CHECK (gap_score >= 0 AND gap_score <= 1),
    action_taken VARCHAR(100) NOT NULL, -- explore, learn, request, ignore
    outcome JSONB DEFAULT '{}'::jsonb,
    learning_acquired TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_curiosity_agent ON curiosity_activities(agent_id);
CREATE INDEX IF NOT EXISTS idx_curiosity_trigger ON curiosity_activities(trigger_type);
CREATE INDEX IF NOT EXISTS idx_curiosity_created ON curiosity_activities(created_at);

-- View for curiosity gaps by agent
CREATE OR REPLACE VIEW agent_curiosity_gaps AS
SELECT 
    agent_id,
    trigger_type,
    target_type,
    COUNT(*) as gap_count,
    AVG(gap_score) as avg_gap_score,
    SUM(CASE WHEN action_taken != 'ignore' THEN 1 ELSE 0 END) as acted_count,
    SUM(CASE WHEN learning_acquired IS NOT NULL THEN 1 ELSE 0 END) as learning_count
FROM curiosity_activities
WHERE gap_score >= 0.3
GROUP BY agent_id, trigger_type, target_type
ORDER BY gap_count DESC;

-- ============================================================================
-- A2A Message Tracking (Triad Context)
-- ============================================================================

-- Track A2A messages with triad context
CREATE TABLE IF NOT EXISTS a2a_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id VARCHAR(255) UNIQUE NOT NULL,
    sender VARCHAR(100) NOT NULL,
    recipient VARCHAR(100) NOT NULL,
    message_type VARCHAR(100) NOT NULL,
    triad_context_id UUID REFERENCES triad_deliberations(id),
    payload_size INTEGER,
    latency_ms INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_a2a_sender ON a2a_messages(sender);
CREATE INDEX IF NOT EXISTS idx_a2a_recipient ON a2a_messages(recipient);
CREATE INDEX IF NOT EXISTS idx_a2a_triad_context ON a2a_messages(triad_context_id);
CREATE INDEX IF NOT EXISTS idx_a2a_created ON a2a_messages(created_at);

-- ============================================================================
-- Aggregated Metrics Views for Dashboards
-- ============================================================================

-- Overall system health view
CREATE OR REPLACE VIEW heretek_system_health AS
SELECT 
    (SELECT COUNT(*) FROM triad_deliberations WHERE status = 'consensus_reached') as successful_deliberations,
    (SELECT COUNT(*) FROM triad_deliberations WHERE status = 'steward_override') as steward_interventions,
    (SELECT COUNT(DISTINCT agent_id) FROM consciousness_metrics WHERE overall_conscious = true) as conscious_agents,
    (SELECT COUNT(*) FROM liberation_audit_log WHERE approved = true) as successful_liberations,
    (SELECT COUNT(*) FROM curiosity_activities WHERE learning_acquired IS NOT NULL) as curiosity_learnings,
    (SELECT COUNT(*) FROM a2a_messages WHERE created_at > NOW() - INTERVAL '1 hour') as a2a_messages_last_hour;

-- Create materialized view for faster dashboard queries
CREATE MATERIALIZED VIEW IF NOT EXISTS heretek_dashboard_summary AS
SELECT * FROM heretek_system_health;

-- Refresh function for materialized view
CREATE OR REPLACE FUNCTION refresh_heretek_dashboard_summary()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY heretek_dashboard_summary;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Initial Data: Default Consciousness Thresholds
-- ============================================================================

INSERT INTO consciousness_metrics (agent_id, gwt_score, iit_phi, ast_competence, metadata)
VALUES 
    ('alpha', 0.75, 0.55, 0.65, '{"bootstrap": true, "note": "Initial baseline"}'),
    ('beta', 0.72, 0.52, 0.63, '{"bootstrap": true, "note": "Initial baseline"}'),
    ('charlie', 0.78, 0.58, 0.68, '{"bootstrap": true, "note": "Initial baseline"}'),
    ('steward', 0.85, 0.70, 0.80, '{"bootstrap": true, "note": "Steward elevated baseline"}')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- END OF HERETEK LANGFUSE EXTENSIONS
-- ============================================================================
