---
name: triad-orchestrator
description: Manage triad deliberation workflows for OpenClaw governance. Provides proposal lifecycle tracking, vote collection and tabulation, deadlock detection and resolution, consensus ledger synchronization, and triad state visualization. Use when coordinating triad decisions, managing proposals, or resolving governance deadlocks.
---

# Triad Orchestrator

## When to use this skill

Use this skill when you need to:
- Create and track proposals through the deliberation lifecycle
- Collect and tabulate votes from triad members
- Detect and resolve deadlocks in triad decisions
- Synchronize consensus ledger state
- Visualize triad deliberation state
- Manage quorum requirements and voting rules

## When NOT to use this skill

Do NOT use this skill when:
- You need to manage agent lifecycle (use `agent-lifecycle-manager` skill)
- You need to monitor gateway health (use `gateway-pulse` skill)
- You need to perform individual agent operations
- You need to backup triad state (use `backup-ledger` skill)

## Inputs required

Before executing, determine:
1. **Operation type**: proposal, vote, status, or ledger
2. **Proposal ID**: for tracking specific proposals
3. **Triad members**: which agents participate in the vote
4. **Quorum requirements**: minimum votes needed for decision

## Workflow

### 1. Create a proposal

```bash
# Create new proposal
./scripts/triad-status.sh propose --title "Update agent configuration" --type config

# View pending proposals
./scripts/triad-status.sh proposals --status pending
```

### 2. Track proposal lifecycle

```bash
# View proposal status
./scripts/triad-status.sh proposal --id <proposal-id>

# View all proposals
./scripts/triad-status.sh proposals

# View proposal history
./scripts/triad-status.sh history --proposal <proposal-id>
```

**Proposal states**:
- `draft` - Proposal being prepared
- `pending` - Awaiting votes
- `voting` - Vote collection in progress
- `approved` - Quorum reached, approved
- `rejected` - Quorum reached, rejected
- `deadlocked` - Deadlock detected
- `executed` - Proposal executed

### 3. Collect votes

```bash
# Submit vote
./scripts/triad-status.sh vote --proposal <id> --vote approve|reject|abstain

# View vote status
./scripts/triad-status.sh votes --proposal <id>

# Tabulate results
./scripts/triad-status.sh tabulate --proposal <id>
```

### 4. Detect and resolve deadlocks

```bash
# Check for deadlocks
./scripts/triad-status.sh check-deadlock

# Resolve deadlock (tie-breaker)
./scripts/triad-status.sh resolve-deadlock --proposal <id> --method steward-tiebreak
```

**Deadlock resolution methods**:
- `steward-tiebreak` - Steward casts tie-breaking vote
- `timeout-expire` - Proposal expires after timeout
- `revote` - Trigger new vote round
- `escalate` - Escalate to higher authority

### 5. Synchronize consensus ledger

```bash
# Sync ledger state
./scripts/triad-status.sh sync-ledger

# View ledger entries
./scripts/triad-status.sh ledger --limit 50

# Verify ledger integrity
./scripts/triad-status.sh verify-ledger
```

### 6. View triad state dashboard

```bash
# Full triad dashboard
./scripts/triad-status.sh dashboard

# JSON output
./scripts/triad-status.sh status --json

# Watch mode
./scripts/triad-status.sh watch
```

## Files

- [`src/index.js`](src/index.js) - Main orchestration logic
- [`src/proposal-tracker.js`](src/proposal-tracker.js) - Proposal state machine
- [`src/vote-collector.js`](src/vote-collector.js) - Vote aggregation
- [`src/deadlock-detector.js`](src/deadlock-detector.js) - Deadlock resolution
- [`scripts/triad-status.sh`](scripts/triad-status.sh) - CLI wrapper

## Examples

### Example 1: Complete proposal workflow

```bash
# Create proposal
./scripts/triad-status.sh propose --title "Deploy new agent" --type deployment

# Collect votes from triad members
./scripts/triad-status.sh vote --proposal <id> --vote approve --voter alpha
./scripts/triad-status.sh vote --proposal <id> --vote approve --voter beta
./scripts/triad-status.sh vote --proposal <id> --vote reject --voter gamma

# Tabulate and execute
./scripts/triad-status.sh tabulate --proposal <id>
```

### Example 2: Deadlock resolution

```bash
# Check for deadlocks
./scripts/triad-status.sh check-deadlock

# Resolve with steward tie-breaker
./scripts/triad-status.sh resolve-deadlock --proposal <id> --method steward-tiebreak
```

### Example 3: Triad dashboard

```bash
# View current triad state
./scripts/triad-status.sh dashboard
```

## Troubleshooting

### Proposal stuck in pending state

1. Check vote collection: `./scripts/triad-status.sh votes --proposal <id>`
2. Verify triad member connectivity: `./scripts/triad-status.sh status`
3. Force vote timeout: `./scripts/triad-status.sh force-timeout --proposal <id>`

### Deadlock not detected

1. Check vote counts: `./scripts/triad-status.sh tabulate --proposal <id>`
2. Verify quorum rules: `./scripts/triad-status.sh quorum-rules`
3. Manual deadlock check: `./scripts/triad-status.sh check-deadlock --force`

### Ledger sync failed

1. Check Gateway connection: `curl http://127.0.0.1:18789/health`
2. Verify ledger file permissions
3. Re-sync from backup: `./scripts/triad-status.sh sync-ledger --force`

## Gateway Integration

This skill integrates with the OpenClaw Gateway WebSocket RPC on port 18789:

- Proposal state changes are broadcast via Gateway
- Votes are collected through Gateway-mediated messages
- Consensus ledger is synchronized through Gateway

## Triad Structure

The triad consists of:
- **Steward** - Orchestrator and tie-breaker
- **Alpha** - Primary decision maker
- **Beta** - Secondary decision maker
- **Gamma** - Tertiary decision maker (when needed)

Quorum requires 2/3 members for most decisions.
