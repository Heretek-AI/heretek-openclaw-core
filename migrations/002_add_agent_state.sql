-- Migration: Add Agent State
-- Version: 2
-- Created: 2026-03-31
-- Description: Adds agent state tracking tables for persistent agent memory and workflow state

-- UP
BEGIN;

-- Agent state table - stores persistent agent state data
CREATE TABLE IF NOT EXISTS agent_state (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id VARCHAR(100) REFERENCES agents(id) ON DELETE CASCADE,
    state_key VARCHAR(255) NOT NULL,
    state_value JSONB NOT NULL,
    version INTEGER DEFAULT 1,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(agent_id, state_key)
);

-- Index for agent state queries
CREATE INDEX IF NOT EXISTS idx_agent_state_agent_id ON agent_state(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_state_key ON agent_state(state_key);
CREATE INDEX IF NOT EXISTS idx_agent_state_expires ON agent_state(expires_at);

-- Agent workflow state table - tracks workflow execution state
CREATE TABLE IF NOT EXISTS agent_workflow_state (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id VARCHAR(100) REFERENCES agents(id) ON DELETE CASCADE,
    workflow_id VARCHAR(255) NOT NULL,
    workflow_name VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'running', 'paused', 'completed', 'failed', 'cancelled'
    current_step INTEGER DEFAULT 0,
    total_steps INTEGER DEFAULT 0,
    step_data JSONB DEFAULT '{}',
    context JSONB DEFAULT '{}',
    error_message TEXT,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for workflow state queries
CREATE INDEX IF NOT EXISTS idx_workflow_state_agent_id ON agent_workflow_state(agent_id);
CREATE INDEX IF NOT EXISTS idx_workflow_state_workflow_id ON agent_workflow_state(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_state_status ON agent_workflow_state(status);
CREATE INDEX IF NOT EXISTS idx_workflow_state_name ON agent_workflow_state(workflow_name);

-- Agent task queue table - manages async task execution
CREATE TABLE IF NOT EXISTS agent_task_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id VARCHAR(100) REFERENCES agents(id) ON DELETE SET NULL,
    task_type VARCHAR(100) NOT NULL,
    task_data JSONB NOT NULL,
    priority INTEGER DEFAULT 0,
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed', 'retry'
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    scheduled_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    result JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for task queue queries
CREATE INDEX IF NOT EXISTS idx_task_queue_agent_id ON agent_task_queue(agent_id);
CREATE INDEX IF NOT EXISTS idx_task_queue_status ON agent_task_queue(status);
CREATE INDEX IF NOT EXISTS idx_task_queue_priority ON agent_task_queue(priority DESC);
CREATE INDEX IF NOT EXISTS idx_task_queue_scheduled ON agent_task_queue(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_task_queue_type ON agent_task_queue(task_type);

-- Agent knowledge base table - stores agent-specific knowledge
CREATE TABLE IF NOT EXISTS agent_knowledge (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id VARCHAR(100) REFERENCES agents(id) ON DELETE CASCADE,
    knowledge_type VARCHAR(100) NOT NULL, -- 'fact', 'pattern', 'skill', 'memory'
    content TEXT NOT NULL,
    embedding vector(768),
    metadata JSONB DEFAULT '{}',
    confidence DECIMAL(5,4) DEFAULT 1.0000,
    source VARCHAR(255),
    verified BOOLEAN DEFAULT FALSE,
    verified_by VARCHAR(100),
    verified_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    accessed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    access_count INTEGER DEFAULT 0
);

-- Index for knowledge queries
CREATE INDEX IF NOT EXISTS idx_agent_knowledge_agent_id ON agent_knowledge(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_knowledge_type ON agent_knowledge(knowledge_type);
CREATE INDEX IF NOT EXISTS idx_agent_knowledge_embedding ON agent_knowledge USING ivfflat (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_agent_knowledge_confidence ON agent_knowledge(confidence DESC);

-- Agent relationships table - tracks inter-agent relationships and communication
CREATE TABLE IF NOT EXISTS agent_relationships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_agent_id VARCHAR(100) REFERENCES agents(id) ON DELETE CASCADE,
    target_agent_id VARCHAR(100) REFERENCES agents(id) ON DELETE CASCADE,
    relationship_type VARCHAR(100) NOT NULL, -- 'collaborator', 'supervisor', 'subordinate', 'peer'
    trust_score DECIMAL(5,4) DEFAULT 0.5000,
    communication_count INTEGER DEFAULT 0,
    last_communication_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(source_agent_id, target_agent_id, relationship_type)
);

-- Index for relationship queries
CREATE INDEX IF NOT EXISTS idx_agent_relationships_source ON agent_relationships(source_agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_relationships_target ON agent_relationships(target_agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_relationships_type ON agent_relationships(relationship_type);

-- Consensus ledger table - tracks consensus decisions
CREATE TABLE IF NOT EXISTS consensus_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    proposal_id UUID REFERENCES governance_proposals(id) ON DELETE CASCADE,
    agent_id VARCHAR(100) REFERENCES agents(id),
    vote VARCHAR(50) NOT NULL, -- 'approve', 'reject', 'abstain'
    vote_weight DECIMAL(5,4) DEFAULT 1.0000,
    reasoning TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for consensus queries
CREATE INDEX IF NOT EXISTS idx_consensus_ledger_proposal ON consensus_ledger(proposal_id);
CREATE INDEX IF NOT EXISTS idx_consensus_ledger_agent ON consensus_ledger(agent_id);
CREATE INDEX IF NOT EXISTS idx_consensus_ledger_vote ON consensus_ledger(vote);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at columns
CREATE TRIGGER update_agent_state_updated_at
    BEFORE UPDATE ON agent_state
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_agent_workflow_state_updated_at
    BEFORE UPDATE ON agent_workflow_state
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_agent_knowledge_accessed_at
    BEFORE UPDATE ON agent_knowledge
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_agent_relationships_updated_at
    BEFORE UPDATE ON agent_relationships
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMIT;

-- DOWN
BEGIN;

DROP TRIGGER IF EXISTS update_agent_relationships_updated_at ON agent_relationships;
DROP TRIGGER IF EXISTS update_agent_knowledge_accessed_at ON agent_knowledge;
DROP TRIGGER IF EXISTS update_agent_workflow_state_updated_at ON agent_workflow_state;
DROP TRIGGER IF EXISTS update_agent_state_updated_at ON agent_state;

DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;

DROP TABLE IF EXISTS consensus_ledger CASCADE;
DROP TABLE IF EXISTS agent_relationships CASCADE;
DROP TABLE IF EXISTS agent_knowledge CASCADE;
DROP TABLE IF EXISTS agent_task_queue CASCADE;
DROP TABLE IF EXISTS agent_workflow_state CASCADE;
DROP TABLE IF EXISTS agent_state CASCADE;

COMMIT;
