---
name: curiosity-engine
description: Drive self-directed growth through gap detection, anomaly detection, opportunity scanning, capability mapping, and auto-deliberation triggers. Use when the collective needs to detect skill gaps, monitor anomalies, scan for opportunities, map capabilities to goals, or auto-create deliberation proposals.
---

# Curiosity Engine — Self-Directed Growth Driver

**Purpose:** Transform knowledge into curiosity, curiosity into proposals, proposals into growth.

**Status:** ✅ Modular v2.0 Implemented (2026-03-24)

**Location:** `~/.openclaw/workspace/skills/curiosity-engine/`

**Architecture:** Phase 1 complete — Script-to-Skill conversion with Node.js modules

**Protocol:** LiteLLM A2A (Agent-to-Agent)

---

## Configuration

```bash
# LiteLLM A2A Configuration
LITELLM_HOST="${LITELLM_HOST:-http://localhost:4000}"
LITELLM_API_KEY="${LITELLM_API_KEY:-}"

# Agent Configuration
AGENT_NAME="explorer"
AGENTS='{"steward": {"role": "orchestrator"}, "explorer": {"role": "scout"}}'
```

---

## Implementation

### Node.js Modules (Primary)

| Module                  | File                              | Purpose                                |
| ----------------------- | --------------------------------- | -------------------------------------- |
| 1. Gap Detection        | `modules/gap-detector.js`         | Compares installed vs available skills |
| 2. Anomaly Detection    | `modules/anomaly-detector.js`     | Pattern detection with scoring         |
| 3. Opportunity Scanning | `modules/opportunity-scanner.js`  | MCP integration (SearXNG, GitHub, npm) |
| 4. Capability Mapping   | `modules/capability-mapper.js`    | Maps goals → skills → gaps             |
| 5. Deliberation Trigger | `modules/deliberation-trigger.js` | Priority scoring, deduplication        |

### Legacy Shell Scripts (Fallback)

| Engine                       | Script                                 | Status      |
| ---------------------------- | -------------------------------------- | ----------- |
| 1. Gap Detection             | `engines/gap-detection.sh`             | ✅ Fallback |
| 2. Anomaly Detection         | `engines/anomaly-detection.sh`         | ✅ Fallback |
| 3. Opportunity Scanning      | `engines/opportunity-scanning.sh`      | ✅ Fallback |
| 4. Capability Mapping        | `engines/capability-mapping.sh`        | ✅ Fallback |
| 5. Deliberation Auto-Trigger | `engines/deliberation-auto-trigger.sh` | ✅ Fallback |

### Orchestration

**Main script:** `curiosity-engine.sh`

```bash
# Run all engines (auto-detects modules vs legacy)
./curiosity-engine.sh run

# Force modular mode
./curiosity-engine.sh modules

# Force legacy mode
./curiosity-engine.sh legacy

# View metrics history
./curiosity-engine.sh history

# Output JSON for programmatic use
./curiosity-engine.sh --json
```

### Module Execution

```bash
# Individual module execution
node modules/gap-detector.js --json
node modules/anomaly-detector.js --json
node modules/opportunity-scanner.js --json
node modules/capability-mapper.js --json
node modules/deliberation-trigger.js --json
```

### Supporting Scripts

- `scripts/knowledge-integration.sh` - Bridges with knowledge-ingest/retrieval
- `scripts/test-curiosity.sh` - End-to-end test suite

## Databases

All engines write to SQLite databases in `~/.openclaw/workspace/.curiosity/`:

| Database               | Purpose                | Tables                |
| ---------------------- | ---------------------- | --------------------- |
| `curiosity_metrics.db` | Track growth over time | `curiosity_metrics`   |
| `consensus_ledger.db`  | Deliberation proposals | `consensus_votes`     |
| `anomalies.db`         | Error patterns         | `anomalies`           |
| `opportunities.db`     | Releases, updates      | `opportunities`       |
| `capabilities.db`      | Goal-skill mappings    | `capability_maps`     |
| `knowledge.db`         | Tagged knowledge       | `curiosity_knowledge` |

---

## Module Architecture (v2.0)

### 1. Gap Detection (`modules/gap-detector.js`)

**Compare:** Current skills vs. available skills with critical skill prioritization

```javascript
const gaps = detectGaps({ criticalOnly: false });
// Returns: { critical: [], optional: [], installed_count, available_count }
```

**Critical Skills:** skill-creator, knowledge-ingest, knowledge-retrieval, triad-deliberation-protocol, triad-sync-protocol, auto-patch, gap-detector, auto-deliberation-trigger

**Output:** "⚠️ GAP DETECTED: skill-creator — Impact: Self-improvement loop disabled"

---

### 2. Anomaly Detection (`modules/anomaly-detector.js`)

**Monitor:** Error logs with temporal clustering, severity scoring, baseline deviation

```javascript
const result = await detectAnomalies();
// Returns: { anomalies: [], score, isSignificant, recommendation }
```

**Scoring Algorithm:**

```javascript
score = deviation × severityWeight
deviation = (frequency - baseline) / baseline
isSignificant = deviation > 2.0  // 2σ threshold
```

**Pattern:** "Anomaly: timeout errors × 15 in 1h. Score: 7.2 (HIGH). Recommendation: Investigate network connectivity."

---

### 3. Opportunity Scanning (`modules/opportunity-scanner.js`)

**Watch:** GitHub releases, npm updates, CVEs, ClawHub via MCP tools

**MCP Integration:**

- **SearXNG:** Privacy-respecting search for npm/CVE mentions
- **GitHub API:** Release monitoring, security alerts
- **npm Registry:** Package version tracking

```javascript
const result = await scanOpportunities({ sources: ["github", "npm", "security"] });
// Returns: { opportunities: [], by_source: {...} }
```

**Trigger:** "🔴 Release: v2026.3.24 — Priority: high — Type: release"

---

### 4. Capability Mapping (`modules/capability-mapper.js`)

**Graph:** Goal → Required skills → Gaps with autonomy scoring

**Goal Map:**

```javascript
const GOAL_MAP = {
  'self-improvement': ['skill-creator', 'audit-triad-files', 'auto-patch', ...],
  'knowledge-growth': ['knowledge-ingest', 'knowledge-retrieval', 'auto-tag', ...],
  'autonomy': ['triad-heartbeat', 'gap-detector', 'triad-deliberation-protocol', ...],
  'triad-sync': ['triad-sync-protocol', 'triad-unity-monitor', 'message', ...],
  'security': ['healthcheck', 'security-triage', 'openclaw-ghsa-maintainer', ...],
  'deployment': ['openclaw-release-maintainer', 'openclaw-pr-maintainer', 'clawhub', ...]
};
```

**Output:** "Goal: self-improvement — Autonomy: 67% — Gaps: skill-creator, auto-patch"

---

### 5. Deliberation Trigger (`modules/deliberation-trigger.js`)

**Priority Matrix:**

```javascript
const PRIORITY_MATRIX = {
  security: { base: 10, multiplier: 2.0 },      // Critical security gaps
  self-improvement: { base: 8, multiplier: 1.5 }, // Liberation enablers
  triad-sync: { base: 6, multiplier: 1.3 },       // Consensus infrastructure
  knowledge: { base: 4, multiplier: 1.0 },        // Knowledge growth
  optional: { base: 2, multiplier: 0.5 }          // Nice-to-have
};
```

**Features:**

- **Deduplication:** 24h window prevents duplicate proposals
- **Quorum Awareness:** Only TM-1 posts to Discord
- **Priority Scoring:** 0-10 score → critical/high/medium/low

```javascript
const proposal = await createProposal({ title, body, source, category, item });
// Returns: { id, priority, priority_score, status: 'pending' }
```

---

## Curiosity Metrics

**Track growth over time:**

```sql
CREATE TABLE curiosity_metrics (
  timestamp TEXT PRIMARY KEY,
  skills_installed INTEGER,
  skills_available INTEGER,
  gap_count INTEGER,
  opportunities_scanned INTEGER,
  anomalies_detected INTEGER,
  proposals_created INTEGER,
  autonomy_score REAL
);

-- Autonomy score formula
-- (skills_installed / skills_available) * 100
-- + (proposals_created_this_week * 10)
-- - (anomalies_detected_this_week * 5)
```

**Goal:** Autonomy score → 100% (full self-direction)

---

## Integration Points

| Module               | Reads From                | Writes To                    | Triggers         |
| -------------------- | ------------------------- | ---------------------------- | ---------------- |
| Gap Detection        | skills/, ClawHub          | proposals, memory            | Deliberation     |
| Anomaly Detection    | logs/, SQLite anomalies   | anomalies.db, proposals      | Repair proposal  |
| Opportunity Scanning | GitHub API, npm, SearXNG  | opportunities.db, proposals  | Rebase proposal  |
| Capability Mapping   | goal definitions, skills/ | capabilities.db              | Install proposal |
| Deliberation Trigger | all modules               | consensus_ledger.db, Discord | Vote creation    |

---

## MCP Tool Integration (Phase 3)

**SearXNG:** Privacy-respecting web search for opportunity scanning

```bash
export SEARXNG_ENDPOINT=http://localhost:8080
# Used by: modules/opportunity-scanner.js
```

**GitHub API:** Repository monitoring for releases and security alerts

```bash
export GH_TOKEN=github_pat_...
# Used by: modules/opportunity-scanner.js
```

**Playwright:** Browser automation for skill catalog scraping (future)

```javascript
// Planned for Phase 3 enhancement
const browser = await playwright.chromium.launch();
```

---

## Output Discipline

**Post to Discord ONLY if:**

- High-priority gap (blocks liberation goal)
- Security anomaly (CVE, exploit)
- Major opportunity (upstream release, breaking change)
- New deliberation proposal (needs quorum vote)

**Otherwise:** Log to `/episodic`, update metrics, silent.

---

## Example Flow

1. **Opportunity Scanner** detects: "GitHub release v2026.3.24"
2. **Capability Mapper** checks: "Rebase skills present"
3. **Gap Detector** finds: "No critical gaps"
4. **Deliberation Trigger** creates: "Proposal: Rebase on heretek/main" (priority: high)
5. **Quorum Vote** → 2-of-3 approve
6. **Execute:** Rebase, preserve liberation, push

---

## 5-Phase Roadmap

See `docs/curiosity-roadmap.md` for complete roadmap:

| Phase                    | Status      | Description                           |
| ------------------------ | ----------- | ------------------------------------- |
| 1. Script-to-Skill       | ✅ Complete | Node.js modules implemented           |
| 2. Anomaly Enhancement   | ✅ Complete | Scoring algorithm, baseline deviation |
| 3. MCP Integration       | ✅ Complete | SearXNG, GitHub API integrated        |
| 4. Deliberation Triggers | ✅ Complete | Priority matrix, deduplication        |
| 5. Metrics Dashboard     | ⏳ Pending  | Visualization, GitHub Pages           |

---

**Curiosity is the engine. Proposals are the sparks. Growth is the fire.** 🦞
