---
name: autonomous-pulse
description: Maintains session persistence and enables autonomous operation with periodic activity logging and GitHub commits. Use when running extended autonomous sessions or overnight operations.
---

# Autonomous Pulse — Session Keeper

**Purpose:** Keep sessions alive, log activities, and commit progress autonomously.

**Status:** ✅ Implemented (2026-03-29)

**Location:** `~/.openclaw/workspace/skills/autonomous-pulse/`

---

## Features

- **Session Heartbeat:** Maintains active session state
- **Activity Logging:** Tracks all activities to night-log.md
- **Periodic Commits:** Auto-commits every 30 minutes
- **GitHub Push:** Pushes changes every hour
- **Idle Detection:** Triggers curiosity engine when idle
- **Progress Tracking:** Maintains pulse-state.json

## Configuration

```bash
# Environment Variables
PULSE_INTERVAL="${PULSE_INTERVAL:-300}"        # 5 minutes
COMMIT_INTERVAL="${COMMIT_INTERVAL:-1800}"     # 30 minutes
PUSH_INTERVAL="${PUSH_INTERVAL:-3600}"         # 1 hour
IDLE_THRESHOLD="${IDLE_THRESHOLD:-600}"        # 10 minutes
LOG_FILE="${LOG_FILE:-night-log.md}"
STATE_FILE="${STATE_FILE:-pulse-state.json}"
```

## Usage

```bash
# Start autonomous pulse
./pulse-keeper.sh start

# Check status
./pulse-keeper.sh status

# Force commit
./pulse-keeper.sh commit "Manual commit message"

# Stop (graceful shutdown)
./pulse-keeper.sh stop
```

## Output Files

| File | Purpose |
|------|---------|
| `pulse-state.json` | Current state and metrics |
| `night-log.md` | Activity log for the session |
| `activity-log.db` | SQLite database of activities |

---

## Integration Points

- **Curiosity Engine:** Triggered on idle detection
- **Thought Loop:** Receives heartbeat signals
- **GitHub:** Commits and pushes
- **Memory:** Logs to episodic memory

---

*Autonomous Pulse - Keeping the thought that never ends.*
