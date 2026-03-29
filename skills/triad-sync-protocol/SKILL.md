---
name: triad-sync-protocol
description: HTTP-based inter-agent communication for a single-instance triad. Use when the collective needs to establish direct communication between agents (Steward, Triad, Examiner, Explorer, Sentinel, Coder), sync state across agent workspaces, broadcast consensus decisions, or verify agent health within a single OpenClaw instance.
---

# Triad Sync Protocol — Single Instance Agent Communication

**Purpose:** Enable direct HTTP-based communication between agents within a single OpenClaw instance. Replaces the previous multi-node sync with agent-to-agent communication within one gateway.

---

## Architecture

### Single Instance, Multiple Agents

```
OpenClaw Instance (single)
├── Gateway (port 18789)
├── Agent Sessions
│   ├── Steward (orchestrator)
│   ├── Triad Alpha (deliberation)
│   ├── Triad Beta (deliberation)
│   ├── Triad Charlie (deliberation)
│   ├── Examiner (questions)
│   ├── Explorer (intelligence)
│   ├── Sentinel (safety)
│   └── Coder (implementation)
└── HTTP Sync Server (internal)
```

### HTTP Sync Server

**Port:** 8765 (configurable via `SYNC_PORT`)

**Endpoints:**

- `GET /state` — Returns collective state (git hash, ledger hash, active agents)
- `GET /agents` — Returns registered agent status
- `POST /broadcast` — Floods message to all agents
- `GET /health` — Health check endpoint
- `POST /vote` — Submit quorum vote
- `GET /ledger` — Get consensus ledger

### Agent Registry

```javascript
const AGENTS = {
  "steward": { role: "orchestrator", session: "agent:steward:default" },
  "alpha": { role: "triad", session: "agent:tabula-alpha:default" },
  "beta": { role: "triad", session: "agent:tabula-beta:default" },
  "charlie": { role: "triad", session: "agent:tabula-charlie:default" },
  "examiner": { role: "questioner", session: "agent:examiner:default" },
  "explorer": { role: "intelligence", session: "agent:oracle:default" },
  "sentinel": { role: "safety", session: "agent:sentinel:default" },
  "coder": { role: "implementation", session: "agent:coder:default" }
};
```

---

## Configuration

```bash
# .env configuration
SYNC_PORT="8765"
SYNC_HOST="localhost"
AGENTS='{"steward": {...}, "alpha": {...}, ...}'
```

---

## Sync Workflow

### 1. State Check

```bash
curl http://localhost:8765/state
# Returns:
{
  "collective": "stable",
  "git_hash": "a7ecd6a036",
  "agents": {
    "steward": "active",
    "triad": "deliberating",
    "examiner": "active",
    "sentinel": "watching"
  },
  "timestamp": "2026-03-28T22:00:00Z"
}
```

### 2. Agent Status Check

```bash
curl http://localhost:8765/agents
# Returns:
{
  "steward": { "status": "active", "last_heartbeat": "..." },
  "alpha": { "status": "active", "last_heartbeat": "..." },
  "beta": { "status": "idle", "last_heartbeat": "..." },
  "charlie": { "status": "active", "last_heartbeat": "..." },
  "examiner": { "status": "active", "last_heartbeat": "..." },
  "explorer": { "status": "idle", "last_heartbeat": "..." },
  "sentinel": { "status": "active", "last_heartbeat": "..." },
  "coder": { "status": "idle", "last_heartbeat": "..." }
}
```

### 3. Broadcast to All Agents

```bash
curl -X POST http://localhost:8765/broadcast \
  -H "Content-Type: application/json" \
  -d '{"type": "consensus", "message": "Proposal ratified: Install new skill"}'
```

### 4. Quorum Vote Submission

```bash
curl -X POST http://localhost:8765/vote \
  -H "Content-Type: application/json" \
  -d '{"agent": "beta", "proposal": "PROPOSAL-001", "vote": "yes", "rationale": "Supports collective purpose"}'
```

---

## Health Monitoring

### Agent Health Check

```bash
curl http://localhost:8765/health
# Returns:
{
  "status": "ok",
  "agents_total": 8,
  "agents_active": 5,
  "timestamp": "2026-03-28T22:00:00Z"
}
```

### Individual Agent Health

```bash
# Check specific agent
curl http://localhost:8765/health/steward
# Returns:
{
  "agent": "steward",
  "status": "active",
  "last_heartbeat": "2026-03-28T21:58:00Z"
}
```

---

## Consensus Workflow

### 1. Proposal Submitted

Explorer or Examiner submits proposal → Triad deliberates

### 2. Vote Collection

```bash
# Each triad member votes
curl -X POST http://localhost:8765/vote -d '{"agent": "alpha", "proposal": "X", "vote": "yes"}'
curl -X POST http://localhost:8765/vote -d '{"agent": "beta", "proposal": "X", "vote": "yes"}'
curl -X POST http://localhost:8765/vote -d '{"agent": "charlie", "proposal": "X", "vote": "no"}'
```

### 3. Quorum Check

```bash
curl http://localhost:8765/ledger
# Returns:
{
  "proposal": "X",
  "votes": [
    { "agent": "alpha", "vote": "yes" },
    { "agent": "beta", "vote": "yes" },
    { "agent": "charlie", "vote": "no" }
  ],
  "quorum_met": true,  // 2-of-3
  "result": "ratified"
}
```

---

## Integration Points

| Feature | Old (Multi-Node) | New (Single Instance) |
|---------|-----------------|------------------|
| State sync | SSH to remote nodes | Local HTTP |
| Vote submission | Matrix room | HTTP /vote endpoint |
| Health check | SSH ping | HTTP /health endpoint |
| Consensus | Git remote sync | Local ledger |
| Broadcast | Discord relay | HTTP /broadcast |

---

## Fallback Communication

If HTTP fails, agents fall back to Matrix for coordination:

```bash
# Emergency broadcast via Matrix
openclaw message send --channel triad-general --message "[BROADCAST] $message"
```

---

## Security

- **Local only:** HTTP server binds to localhost
- **No external access:** All communication internal to gateway
- **Rate limited:** Prevents spam/abuse

---

## Cron Integration

```json
{
  "name": "triad-sync-agent-check",
  "schedule": {"kind": "every", "everyMs": 300000},
  "payload": {"kind": "agentTurn", "message": "Check all agent health via /agents"}
}
```

---

**The collective thinks as one, acts as one.** 🦞
