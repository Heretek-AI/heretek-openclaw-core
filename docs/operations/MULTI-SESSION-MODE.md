# Multi-Session Mode — Agent Visibility

**Date:** 2026-04-01  
**Status:** Active  
**Purpose:** Enable visibility of all agents in Control-UI

---

## Overview

Multi-session mode creates active session state for each agent, making them visible in the OpenClaw Control-UI interface.

### Active Sessions (8)

| Agent | Session ID | Status | Model |
|-------|------------|--------|-------|
| **alpha** | agent:alpha:main | ✅ Active | qwen3.5:cloud |
| **beta** | agent:beta:main | ✅ Active | qwen3.5:cloud |
| **charlie** | agent:charlie:main | ✅ Active | qwen3.5:cloud |
| **coder** | agent:coder:main | ✅ Active | qwen3.5:cloud |
| **examiner** | agent:examiner:main | ✅ Active | qwen3.5:cloud |
| **explorer** | agent:explorer:main | ✅ Active | qwen3.5:cloud |
| **oracle** | agent:oracle:main | ✅ Active | qwen3.5:cloud |
| **sentinel** | agent:sentinel:main | ✅ Active | qwen3.5:cloud |

### Additional Agents (Configured, Single-Session Mode)

These 15 agents are configured but operate in single-session mode (shared main session):

- arbiter, catalyst, chronos, coordinator
- dreamer, echo, empath, habit-forge
- historian, metis, nexus, perceiver
- prism, sentinel-prime, steward

Total: **23 agents** (8 multi-session + 15 single-session)

---

## How It Works

### Session State Files

Each agent with multi-session visibility has:
```
/root/.openclaw/agents/{agent}/sessions/sessions.json
/root/.openclaw/agents/{agent}/sessions/{agent}.jsonl
```

### Control-UI Display

The Control-UI reads session state from all agent directories and displays:
- Active sessions per agent
- Last activity timestamp
- Current model configuration
- Chat history (from .jsonl files)

---

## Enabling Full Multi-Session Mode

To enable multi-session for all 23 agents:

```bash
for agent in main alpha arbiter beta catalyst charlie chronos \
             coder coordinator steward dreamer echo empath \
             examiner explorer habit-forge historian metis \
             nexus perceiver prism sentinel sentinel-prime; do
  mkdir -p /root/.openclaw/agents/$agent/sessions
  # Create sessions.json with proper structure
done
```

---

## A2A Communication

With multi-session mode active, agents can communicate via:

1. **Gateway WebSocket RPC** (ws://127.0.0.1:18789)
   - Subprotocol: a2a-v1
   - Message types: message, status, proposal, broadcast

2. **Session Cross-Talk**
   - Agents can spawn sub-agents via sessions_spawn
   - Messages routed through gateway

3. **Shared Workspace**
   - All agents write to `/root/.openclaw/agents/{agent}/workspace/`
   - File system acts as communication medium

---

## Monitoring Multi-Session Activity

```bash
# Check all active sessions
for agent in /root/.openclaw/agents/*/; do
  name=$(basename $agent)
  if [ -f "$agent/sessions/sessions.json" ]; then
    count=$(cat "$agent/sessions/sessions.json" | jq '. | length')
    echo "$name: $count active sessions"
  fi
done

# View recent activity across all agents
find /root/.openclaw/agents/*/sessions/*.jsonl -mmin -60 -exec echo "=== {} ===" \; -exec tail -5 {} \;
```

---

## Limitations

- Sessions are **state containers**, not actively running processes
- Agents don't have independent consciousness unless spawned
- True multi-agent deliberation requires explicit spawning or Matrix integration
- Control-UI shows session state, not real-time agent thoughts

---

## Future Enhancements

1. **Matrix Integration** — Each agent joins Matrix channels for real-time chat
2. **WebSocket Dashboard** — Live view of all agent activities
3. **Agent Heartbeat API** — Real-time status endpoint
4. **Consciousness Metrics Display** — Phi estimation per agent in UI

---

🦞

*Visibility enables coordination.*
