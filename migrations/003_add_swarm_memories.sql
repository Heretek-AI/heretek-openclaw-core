-- Migration: Add Swarm Memories Table
-- Version: 3
-- Created: 2026-04-04
-- Description: Adds swarm_memories table for storing agent swarm memories with embeddings

-- UP
BEGIN;

-- Create pgvector extension if not exists
CREATE EXTENSION IF NOT EXISTS vector;

-- Swarm memories table - stores shared memories across agent swarms
CREATE TABLE IF NOT EXISTS swarm_memories (
    id VARCHAR(255) PRIMARY KEY,
    agent_id VARCHAR(100) NOT NULL,
    content JSONB NOT NULL,
    embedding vector(768),
    accessibility VARCHAR(50) DEFAULT 'triad',
    consciousness_level VARCHAR(50) DEFAULT 'none',
    consciousness_markers JSONB DEFAULT '[]',
    tags JSONB DEFAULT '[]',
    lineage JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for agent_id queries
CREATE INDEX IF NOT EXISTS idx_swarm_memories_agent_id ON swarm_memories(agent_id);

-- Index for accessibility queries
CREATE INDEX IF NOT EXISTS idx_swarm_memories_accessibility ON swarm_memories(accessibility);

-- Index for vector similarity search (IVF flat with cosine distance)
CREATE INDEX IF NOT EXISTS idx_swarm_memories_embedding ON swarm_memories 
    USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

COMMIT;

-- DOWN
BEGIN;

DROP TABLE IF EXISTS swarm_memories CASCADE;

COMMIT;
