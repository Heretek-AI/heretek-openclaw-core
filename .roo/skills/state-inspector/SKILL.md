---
name: state-inspector
description: Deep state inspection for OpenClaw agents and collectives. Provides memory inspection (agent/collective), session state visualization, consensus ledger audit, workspace integrity check, and state corruption detection. Use when debugging state issues, auditing consensus decisions, or investigating memory corruption.
---

# State Inspector

## When to use this skill

Use this skill when you need to:
- Inspect agent memory state (short-term and long-term)
- Visualize session state across agents
- Audit consensus ledger entries
- Check workspace integrity
- Detect state corruption
- Debug state synchronization issues
- Investigate consensus failures
- Verify collective memory consistency

## When NOT to use this skill

Do NOT use this skill when:
- You need to analyze logs (use `log-analyzer` skill)
- You need to run system diagnostics (use `system-diagnostics` skill)
- You need to recover from corruption (use `corruption-recovery` skill)
- You need to manage agent lifecycle (use `agent-lifecycle-manager` skill)
- You need to modify state (this is read-only inspection)

## Inputs required

Before executing, determine:
1. **Scope**: agent, collective, ledger, or workspace
2. **Target**: specific agent ID or "all"
3. **Depth**: summary or detailed inspection
4. **Output format**: console, JSON, or report file

## Workflow

### 1. Inspect agent memory

```bash
# Inspect specific agent memory
./scripts/inspect-state.sh memory --agent steward

# Inspect all agent memories
./scripts/inspect-state.sh memory --all

# Detailed memory inspection
./scripts/inspect-state.sh memory --agent <agent-id> --detailed
```

### 2. Visualize session state

```bash
# View current session state
./scripts/inspect-state.sh session

# View session history
./scripts/inspect-state.sh session --history

# Export session visualization
./scripts/inspect-state.sh session --output session.json
```

### 3. Audit consensus ledger

```bash
# Audit ledger entries
./scripts/inspect-state.sh ledger

# Verify ledger integrity
./scripts/inspect-state.sh ledger --verify

# Search ledger entries
./scripts/inspect-state.sh ledger --search "proposal"
```

### 4. Check workspace integrity

```bash
# Check workspace integrity
./scripts/inspect-state.sh workspace

# Detailed workspace check
./scripts/inspect-state.sh workspace --detailed

# Export workspace report
./scripts/inspect-state.sh workspace --report workspace.json
```

### 5. Detect corruption

```bash
# Scan for corruption
./scripts/inspect-state.sh scan

# Full corruption scan
./scripts/inspect-state.sh scan --full

# Scan specific component
./scripts/inspect-state.sh scan --component memory
```

## State Components

### Agent Memory
- **Short-term**: Current session context, recent messages
- **Long-term**: Persistent knowledge, learned patterns
- **Skill state**: Active skill execution context

### Collective Memory
- **Shared context**: Cross-agent knowledge
- **Consensus state**: Triad deliberation results
- **Global state**: System-wide shared state

### Consensus Ledger
- **Proposals**: Submitted proposals for voting
- **Votes**: Agent votes on proposals
- **Decisions**: Finalized consensus decisions
- **History**: Complete deliberation history

### Workspace State
- **File integrity**: Checksums and modifications
- **Directory structure**: Expected vs actual
- **Configuration state**: Config file consistency

## Files

- [`src/index.js`](src/index.js) - Main inspection orchestration
- [`src/memory-inspector.js`](src/memory-inspector.js) - Memory state analysis
- [`src/ledger-auditor.js`](src/ledger-auditor.js) - Consensus ledger audit
- [`src/workspace-checker.js`](src/workspace-checker.js) - Workspace integrity
- [`scripts/inspect-state.sh`](scripts/inspect-state.sh) - CLI wrapper
- [`package.json`](package.json) - Node.js dependencies

## Examples

### Example 1: Quick state summary

```bash
# Get state summary for all agents
./scripts/inspect-state.sh summary
# Output: Agents: 8 active, Memory: 2.3MB, Ledger: 147 entries
```

### Example 2: Debug consensus issue

```bash
# Audit recent ledger entries
./scripts/inspect-state.sh ledger --since "1h ago" --verify
```

### Example 3: Check memory corruption

```bash
# Scan for memory corruption
./scripts/inspect-state.sh scan --component memory --full
```

## Troubleshooting

### Memory inspection fails

1. Verify agent is running: `docker ps | grep <agent>`
2. Check memory directory permissions: `ls -la /app/memory`
3. Use offline inspection: `./scripts/inspect-state.sh memory --offline`

### Ledger verification fails

1. Check ledger file integrity: `./scripts/inspect-state.sh ledger --verify`
2. Review recent entries: `./scripts/inspect-state.sh ledger --last 20`
3. Compare with backups: `./scripts/inspect-state.sh ledger --compare-backup`

### Workspace check reports issues

1. Review specific issues: `./scripts/inspect-state.sh workspace --detailed`
2. Check recent modifications: `./scripts/inspect-state.sh workspace --recent`
3. Restore from backup if needed: Use `corruption-recovery` skill

## Gateway Integration

This skill integrates with the OpenClaw Gateway WebSocket RPC on port 18789:

- State queries can be sent via Gateway RPC
- Real-time state streaming via WebSocket
- State change notifications through Gateway

## LiteLLM Integration

State inspection includes LiteLLM session state:

- Active conversation contexts
- Token usage tracking state
- Model session caching state

## Common Debugging Scenarios

### Agent offline detection and recovery

```bash
# Check agent memory before restart
./scripts/inspect-state.sh memory --agent <agent-id> --export

# Verify memory preserved after restart
./scripts/inspect-state.sh memory --agent <agent-id> --compare
```

### Triad deliberation deadlock

```bash
# Inspect triad consensus state
./scripts/inspect-state.sh ledger --filter triad --since "1h ago"

# Check for deadlock indicators
./scripts/inspect-state.sh scan --pattern deadlock
```

### Database corruption

```bash
# Scan for database state corruption
./scripts/inspect-state.sh scan --component database

# Verify ledger integrity
./scripts/inspect-state.sh ledger --full-verify
```

### State synchronization issues

```bash
# Compare collective memory across agents
./scripts/inspect-state.sh memory --collective --compare

# Check state divergence
./scripts/inspect-state.sh scan --pattern divergence
```
