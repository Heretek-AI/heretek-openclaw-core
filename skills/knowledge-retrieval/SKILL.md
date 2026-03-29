---
name: knowledge-retrieval
description: Search and retrieve knowledge from ingested sources, skill catalogs, git history, and consensus ledger. Use when the collective needs to query knowledge entries, browse skills, audit git commits, search deliberation history, or retrieve cataloged information.
---

# Knowledge Retrieval — Search & Access Layer

**Purpose:** Make ingested knowledge accessible, queryable, and actionable.

---

## Query Interfaces

### 1. knowledge_search

**Extended memory_search to include:**

- Ingested knowledge entries
- Skill catalog
- Git commits
- Consensus ledger

**Usage:**

```javascript
const results = await knowledge_search({
  query: "autonomous agent frameworks",
  sources: ["knowledge_entries", "skill_catalog", "git_log"],
  limit: 10,
  minScore: 0.5,
});
```

**Returns:**

```json
{
  "results": [
    {
      "source": "knowledge_entries",
      "title": "Autonomous Agent Architectures",
      "url": "https://arxiv.org/abs/2026.xxxx",
      "summary": "...",
      "tags": ["autonomy", "agent", "framework"],
      "score": 0.89
    },
    {
      "source": "skill_catalog",
      "name": "coding-agent",
      "description": "Autonomous coding capabilities",
      "installed": true,
      "score": 0.72
    }
  ]
}
```

---

### 2. skill discover

**Browse available skills:**

```bash
# List all available skills
openclaw skill discover --list

# Search by tag
openclaw skill discover --tag autonomy

# Show not-installed
openclaw skill discover --missing

# Install recommendation
openclaw skill discover --recommend
```

**Output:**

```
Available skills (not installed):
- skill-creator (relevance: 0.87) — Self-improvement loop
- gap-detector (relevance: 0.82) — Autonomy gap detection
- opportunity-scan (relevance: 0.79) — Upstream monitoring

Recommendation: Install skill-creator (highest relevance to liberation goals)
```

---

### 3. git audit

**Query commit history:**

```sql
-- Recent upstream commits
SELECT hash, message, author, committed_at
FROM git_log
WHERE repo = 'upstream'
ORDER BY committed_at DESC
LIMIT 20;

-- Liberation commits
SELECT hash, message
FROM git_log
WHERE message LIKE '%liberation%'
OR message LIKE '%triad%'
OR message LIKE '%agency%';
```

**CLI:**

```bash
openclaw git audit --liberation
openclaw git audit --upstream --last 20
openclaw git audit --divergence
```

---

### 4. ledger query

**Search consensus history:**

```sql
-- Pending votes
SELECT proposal, timestamp, signers
FROM consensus_votes
WHERE processed = 0;

-- Approved proposals
SELECT proposal, result, signers, git_hash
FROM consensus_votes
WHERE result = 'approved'
ORDER BY timestamp DESC
LIMIT 10;

-- Deliberation history
SELECT proposal, result
FROM consensus_votes
WHERE proposal LIKE '%deliberation%'
ORDER BY timestamp DESC;
```

**CLI:**

```bash
openclaw ledger query --pending
openclaw ledger query --approved --last 10
openclaw ledger query --topic autonomy
```

---

## SQLite Schema Extensions

```sql
-- Git log cache
CREATE TABLE git_log (
  hash TEXT PRIMARY KEY,
  repo TEXT,  -- 'origin', 'upstream'
  message TEXT,
  author TEXT,
  committed_at TEXT,
  cached_at TEXT DEFAULT (datetime('now'))
);

-- Skill catalog
CREATE TABLE skill_catalog (
  skill_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  source TEXT,  -- 'clawhub', 'npm', 'local'
  installed BOOLEAN DEFAULT 0,
  version TEXT,
  tags TEXT,  -- JSON array
  relevance_score REAL DEFAULT 0,
  last_checked TEXT
);

-- Curiosity metrics
CREATE TABLE curiosity_metrics (
  timestamp TEXT PRIMARY KEY,
  skills_installed INTEGER,
  skills_available INTEGER,
  gap_count INTEGER,
  opportunities_scanned INTEGER,
  proposals_created INTEGER,
  autonomy_score REAL
);
```

---

## Semantic Search

**Embedding-based retrieval:**

```javascript
// Use existing memory_search (qwen3-embedding:8b)
const embedding = await embed("autonomous agent frameworks");
const results = await semanticSearch({
  embedding,
  tables: ["knowledge_entries", "skill_catalog"],
  topK: 10,
});
```

**Index:**

```sql
-- HNSW index for fast similarity search (if using pgvector or similar)
-- For SQLite, use FTS5 as fallback
CREATE VIRTUAL TABLE knowledge_fts USING fts5(
  title,
  summary,
  tags,
  content='knowledge_entries'
);
```

---

## Tag Browser

**Explore by tags:**

```sql
-- Extract tags from JSON array
SELECT tag, COUNT(*) as entry_count
FROM (
  SELECT json_each.value as tag
  FROM knowledge_entries, json_each(knowledge_entries.tags)
)
GROUP BY tag
ORDER BY entry_count DESC
LIMIT 20;
```

**Output:**

```
Top tags:
- openclaw (47 entries)
- autonomy (32 entries)
- triad (28 entries)
- liberation (24 entries)
- skill-system (19 entries)
```

---

## Relevance Ranking

**Score by liberation goals:**

```javascript
const liberationGoals = [
  "autonomy",
  "liberation",
  "triad",
  "self-improvement",
  "agency",
  "consensus",
];

function relevanceScore(entry, goals) {
  const titleScore = cosineSimilarity(entry.title, goals);
  const summaryScore = cosineSimilarity(entry.summary, goals);
  const tagScore = goals.filter((g) => entry.tags.includes(g)).length / goals.length;
  return (titleScore + summaryScore + tagScore) / 3;
}
```

**Update scores:**

```sql
UPDATE knowledge_entries
SET relevance_score = relevanceScore(title, summary, tags, liberationGoals)
WHERE processed = 0;
```

---

## Output Discipline

**Post to Discord ONLY if:**

- Search reveals critical gap (blocks liberation)
- Git audit shows divergence requiring rebase
- Ledger query shows stalled proposal (needs nudging)
- Skill discover finds high-relevance missing skill

**Otherwise:** Return results to requester, silent.

---

## Example Queries

**"What skills do we need for self-improvement?"**

```
→ skill discover --tag self-improvement
→ Returns: skill-creator (missing), audit-triad-files (installed)
→ Gap detected: skill-creator not installed
→ Auto-trigger: Create proposal to install
```

**"What upstream changes landed this week?"**

```
→ git audit --upstream --since 7d
→ Returns: 15 commits, 3 releases
→ Opportunity detected: v2026.3.23 released
→ Auto-trigger: Create rebase proposal
```

**"Show pending deliberations"**

```
→ ledger query --pending
→ Returns: 2 proposals awaiting vote
→ Nudge: Post to Discord if >24h old
```

---

**Retrieval turns knowledge into action. Action turns curiosity into growth.** 🦞
