---
name: corruption-recovery
description: Automated corruption detection and recovery for OpenClaw. Provides integrity scanning, automatic backup selection, staged recovery procedures, post-recovery validation, and rollback capability. Use when recovering from data corruption, restoring from backups, or performing disaster recovery operations.
---

# Corruption Recovery

## When to use this skill

Use this skill when you need to:
- Detect and recover from data corruption
- Restore agent memory from backups
- Recover consensus ledger from backup
- Perform disaster recovery operations
- Validate data integrity after recovery
- Rollback failed recovery attempts
- Select appropriate backup for restoration
- Verify recovery success

## When NOT to use this skill

Do NOT use this skill when:
- You need to inspect state without recovery (use `state-inspector` skill)
- You need to analyze logs for corruption cause (use `log-analyzer` skill)
- You need to run system diagnostics (use `system-diagnostics` skill)
- You need to create new backups (use backup management skill)
- You need to manage agent lifecycle (use `agent-lifecycle-manager` skill)

## Inputs required

Before executing, determine:
1. **Scope**: What to recover (memory, ledger, workspace, all)
2. **Source**: Backup source (auto-select, specific backup, timestamp)
3. **Mode**: Dry-run or actual recovery
4. **Validation**: Whether to validate after recovery

## Workflow

### 1. Scan for corruption

```bash
# Full integrity scan
./scripts/recover.sh scan --full

# Scan specific component
./scripts/recover.sh scan --component memory

# Scan with detailed report
./scripts/recover.sh scan --detailed --output scan.json
```

### 2. List available backups

```bash
# List all backups
./scripts/recover.sh list

# List backups for specific component
./scripts/recover.sh list --component ledger

# List recent backups
./scripts/recover.sh list --recent --count 10
```

### 3. Select backup

```bash
# Auto-select best backup
./scripts/recover.sh select --auto

# Select specific backup
./scripts/recover.sh select --backup <backup-id>

# Select by timestamp
./scripts/recover.sh select --timestamp "2024-01-01T00:00:00Z"
```

### 4. Preview recovery

```bash
# Dry-run recovery
./scripts/recover.sh preview --backup <backup-id>

# Preview with diff
./scripts/recover.sh preview --backup <backup-id> --diff
```

### 5. Execute recovery

```bash
# Recover all components
./scripts/recover.sh recover --all

# Recover specific component
./scripts/recover.sh recover --component memory --backup <backup-id>

# Recover with validation
./scripts/recover.sh recover --component ledger --validate
```

### 6. Validate recovery

```bash
# Post-recovery validation
./scripts/recover.sh validate

# Validate specific component
./scripts/recover.sh validate --component memory

# Full validation with report
./scripts/recover.sh validate --full --output validation.json
```

### 7. Rollback if needed

```bash
# Rollback last recovery
./scripts/recover.sh rollback

# Rollback to specific point
./scripts/recover.sh rollback --to <recovery-id>
```

## Recovery Stages

### Stage 1: Pre-Recovery
- Backup current state (for rollback)
- Stop affected services
- Verify backup integrity

### Stage 2: Recovery
- Extract backup data
- Restore files/data
- Update metadata

### Stage 3: Post-Recovery
- Validate restored data
- Restart services
- Verify system health

### Stage 4: Verification
- Integrity checks
- Functional tests
- Consistency verification

## Backup Selection Criteria

The auto-select algorithm considers:

| Criterion | Weight | Description |
|-----------|--------|-------------|
| Recency | 30% | Prefer recent backups |
| Completeness | 25% | All components present |
| Integrity | 25% | Checksum verified |
| Size | 10% | Reasonable size (not truncated) |
| Age | 10% | Not too old |

## Files

- [`src/index.js`](src/index.js) - Main recovery orchestration
- [`src/integrity-scanner.js`](src/integrity-scanner.js) - Corruption detection
- [`src/backup-selector.js`](src/backup-selector.js) - Backup selection logic
- [`src/recovery-manager.js`](src/recovery-manager.js) - Recovery orchestration
- [`scripts/recover.sh`](scripts/recover.sh) - CLI wrapper
- [`package.json`](package.json) - Node.js dependencies

## Examples

### Example 1: Quick recovery

```bash
# Auto-recover from corruption
./scripts/recover.sh recover --auto --validate
```

### Example 2: Selective recovery

```bash
# Recover only ledger from specific backup
./scripts/recover.sh recover --component ledger --backup backup-20240101
```

### Example 3: Dry-run first

```bash
# Preview recovery before executing
./scripts/recover.sh preview --backup latest --diff
./scripts/recover.sh recover --backup latest --validate
```

## Troubleshooting

### Recovery fails

1. Check backup integrity: `./scripts/recover.sh validate-backup --backup <id>`
2. Try different backup: `./scripts/recover.sh list --valid-only`
3. Check disk space: `df -h`

### Rollback fails

1. Check rollback state: `./scripts/recover.sh status`
2. Manual rollback: Restore from pre-recovery backup
3. Contact support if data is critical

### Validation fails after recovery

1. Review validation report: `./scripts/recover.sh validate --detailed`
2. Try different backup: `./scripts/recover.sh select --auto`
3. Consider partial recovery of specific components

## Gateway Integration

This skill integrates with the OpenClaw Gateway WebSocket RPC on port 18789:

- Recovery status published via Gateway
- Service restart coordinated through Gateway
- Recovery notifications sent to agents

## LiteLLM Integration

Recovery includes LiteLLM state:

- Model cache restoration
- Token usage state
- Conversation history

## Common Debugging Scenarios

### Agent offline detection and recovery

```bash
# Scan agent memory for corruption
./scripts/recover.sh scan --component memory --agent <agent-id>

# Recover agent memory
./scripts/recover.sh recover --component memory --agent <agent-id> --auto
```

### LiteLLM gateway failure

```bash
# Check LiteLLM state corruption
./scripts/recover.sh scan --component litellm

# Recover from backup
./scripts/recover.sh recover --component litellm --validate
```

### Triad deliberation deadlock

```bash
# Scan ledger for corruption
./scripts/recover.sh scan --component ledger

# Recover ledger state
./scripts/recover.sh recover --component ledger --auto --validate
```

### Database corruption

```bash
# Full database scan
./scripts/recover.sh scan --component database --full

# Recover database with rollback capability
./scripts/recover.sh recover --component database --auto --rollback-enabled
```
