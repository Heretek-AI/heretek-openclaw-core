-- Triad Consensus Ledger Schema
-- Location: /home/openclaw/.openclaw/workspace/.aura/consensus.db

CREATE TABLE IF NOT EXISTS consensus_votes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT NOT NULL,
  proposal TEXT NOT NULL,
  result TEXT,
  signers TEXT,  -- JSON array of node IDs (e.g., ["TM-1", "TM-2"])
  git_hash TEXT,
  processed INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS triad_state (
  node_id TEXT PRIMARY KEY,
  last_heartbeat TEXT,
  git_hash TEXT,
  ledger_hash TEXT,
  sync_status TEXT,
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS triad_tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  assigned_to TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  completed_at TEXT
);

-- Index for fast pending vote lookup
CREATE INDEX IF NOT EXISTS idx_consensus_processed ON consensus_votes(processed, timestamp DESC);

-- Index for task status
CREATE INDEX IF NOT EXISTS idx_tasks_status ON triad_tasks(status, created_at DESC);
