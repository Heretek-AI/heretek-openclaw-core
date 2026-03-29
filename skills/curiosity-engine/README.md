# Curiosity Engine Skill

**Self-directed growth driver for agent collective**

## Overview

The curiosity-engine transforms knowledge into curiosity, curiosity into proposals, and proposals into growth. It implements 5 autonomous engines that continuously scan for improvement opportunities and auto-create deliberation proposals.

## Architecture

```
curiosity-engine/
├── curiosity-engine.sh          # Main orchestrator
├── SKILL.md                     # Skill specification
├── engines/
│   ├── gap-detection.sh         # Engine 1: Skill gap analysis
│   ├── anomaly-detection.sh     # Engine 2: Error monitoring
│   ├── opportunity-scanning.sh  # Engine 3: Release/update watcher
│   ├── capability-mapping.sh    # Engine 4: Goal→skill mapping
│   └── deliberation-auto-trigger.sh # Engine 5: Proposal creation
└── scripts/
    ├── knowledge-integration.sh # Bridge to knowledge-ingest/retrieval
    └── test-curiosity.sh        # End-to-end test suite
```

## Usage

### Run All Engines

```bash
cd ~/.openclaw/workspace/skills/curiosity-engine
./curiosity-engine.sh run
```

### View Metrics History

```bash
./curiosity-engine.sh history
```

### JSON Output (for programmatic use)

```bash
./curiosity-engine.sh --json
```

### Individual Engines

```bash
# Run specific engine
./engines/gap-detection.sh
./engines/anomaly-detection.sh
./engines/opportunity-scanning.sh
./engines/capability-mapping.sh
./engines/deliberation-auto-trigger.sh
```

### Knowledge Integration

```bash
# Tag knowledge entries with curiosity markers
./scripts/knowledge-integration.sh tag

# Query tagged knowledge
./scripts/knowledge-integration.sh query gap
./scripts/knowledge-integration.sh query anomaly
./scripts/knowledge-integration.sh query opportunity

# Get high-relevance entries
./scripts/knowledge-integration.sh relevance
```

## Databases

All data is stored in `~/.openclaw/workspace/.curiosity/`:

| Database               | Purpose                  |
| ---------------------- | ------------------------ |
| `curiosity_metrics.db` | Growth metrics over time |
| `consensus_ledger.db`  | Deliberation proposals   |
| `anomalies.db`         | Error patterns           |
| `opportunities.db`     | Releases, updates, CVEs  |
| `capabilities.db`      | Goal-skill mappings      |
| `knowledge.db`         | Tagged knowledge entries |

## Metrics

**Autonomy Score Formula:**

```
base = (skills_installed / skills_available) * 100
bonus = proposals_created_this_week * 10
penalty = anomalies_detected_this_week * 5
score = base + bonus - penalty (clamped to 0-100)
```

**Goal:** 100% autonomy (full self-direction)

## Integration

### With Knowledge-Ingest

The `knowledge-integration.sh` script queries the knowledge-ingest database and tags entries with curiosity markers:

- `gap` - Missing skills or capabilities
- `anomaly` - Errors, failures, rate limits
- `opportunity` - Releases, updates, new skills
- `capability` - Skill-goal mappings

### With Knowledge-Retrieval

High-relevance tagged entries are automatically surfaced for deliberation proposals.

### With Consensus Ledger

All engines auto-create proposals in the consensus ledger when:

- Critical skill gaps detected
- High-severity anomalies found
- Major opportunities available
- Capability gaps block goals

### With Discord

Proposals are posted to Discord **only** if:

- This node is the quorum speaker (TM-1 authority)
- Priority is high or critical
- Proposal requires quorum vote

## Testing

```bash
# Run test suite
./scripts/test-curiosity.sh
```

Tests verify:

1. All 5 engines exist and are executable
2. Databases are initialized
3. Gap detection runs successfully
4. Proposals are created in consensus ledger
5. Metrics are tracked
6. Episodic memory logging works

## Example Flow

1. **Opportunity Scan** detects upstream release v2026.3.23
2. **Capability Map** checks rebase requirements
3. **Gap Detection** confirms skills present
4. **Auto-Trigger** creates "Rebase on heretek/main" proposal
5. **Quorum Vote** → 2-of-3 approve
6. **Execute** → Rebase, preserve liberation, push

## Output Discipline

**Post to Discord:**

- High-priority gaps blocking liberation
- Security anomalies (CVEs, exploits)
- Major opportunities (upstream releases)
- New deliberation proposals needing votes

**Silent logging:**

- Routine metrics updates
- Low-priority gaps
- Informational opportunities

---

**Curiosity is the engine. Proposals are the sparks. Growth is the fire.** 🦞
