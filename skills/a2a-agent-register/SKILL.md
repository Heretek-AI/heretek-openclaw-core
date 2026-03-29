---
name: a2a-agent-register
description: Register agents with LiteLLM A2A Gateway. Use when setting up new agents, updating agent capabilities, or configuring agent permissions.
---

# A2A Agent Registration Skill

Register collective agents with the LiteLLM A2A gateway for standardized inter-agent communication.

## Prerequisites

- LiteLLM proxy running with A2A enabled
- Master key for admin operations

## Configuration

```bash
# Environment
LITELLM_HOST="${LITELLM_HOST:-localhost}"
LITELLM_PORT="${LITELLM_PORT:-4000}"
LITELLM_MASTER_KEY="${LITELLM_MASTER_KEY:-}"
```

## Agent Registry

| Agent | A2A Name | Role | Skills |
|-------|----------|------|--------|
| Steward | `steward` | Orchestrator | orchestrate, monitor-health |
| Triad | `triad` | Deliberation | deliberate, vote, ratify |
| Examiner | `examiner` | Questioner | question, probe-assumptions |
| Explorer | `explorer` | Intelligence | discover, scan, report |
| Sentinel | `sentinel` | Safety | review, flag-risks |
| Coder | `coder` | Implementation | implement, test, deploy |

## Usage

### Register Single Agent

```bash
# Register Steward
curl -X POST "http://${LITELLM_HOST}:${LITELLM_PORT}/key/generate" \
  -H "Authorization: Bearer ${LITELLM_MASTER_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "key_alias": "a2a-steward",
    "duration": "30d",
    "agent": "steward",
    "agent_permissions": ["a2a:send", "a2a:receive"]
  }'
```

### Register All Agents

```bash
#!/bin/bash
# Register all collective agents

AGENTS=("steward" "triad" "examiner" "explorer" "sentinel" "coder")

for agent in "${AGENTS[@]}"; do
  echo "Registering $agent..."
  curl -X POST "http://${LITELLM_HOST}:${LITELLM_PORT}/key/generate" \
    -H "Authorization: Bearer ${LITELLM_MASTER_KEY}" \
    -H "Content-Type: application/json" \
    -d "{
      \"key_alias\": \"a2a-${agent}\",
      \"duration\": \"30d\",
      \"agent\": \"${agent}\",
      \"agent_permissions\": [\"a2a:send\", \"a2a:receive\"]
    }"
done

echo "All agents registered"
```

### List Registered Agents

```bash
# List all registered agents
curl "http://${LITELLM_HOST}:${LITELLM_PORT}/agents" \
  -H "Authorization: Bearer ${LITELLM_MASTER_KEY}"
```

## Agent Card Schema

Each agent has an A2A Agent Card:

```json
{
  "name": "steward",
  "description": "Orchestrator of The Collective",
  "url": "http://localhost:4000/a2a/steward",
  "skills": [
    {"id": "orchestrate", "name": "Orchestrate Collective"},
    {"id": "monitor-health", "name": "Monitor Agent Health"}
  ],
  "capabilities": {
    "streaming": true,
    "pushNotifications": true
  }
}
```

## Python SDK Registration

```python
from litellm import a2a_register_agent

# Register agent with LiteLLM
response = a2a_register_agent(
    agent_name="steward",
    agent_url="http://localhost:8000/a2a/steward",
    metadata={
        "role": "orchestrator",
        "skills": ["orchestrate", "monitor-health"]
    }
)
print(response)
```

---

## Troubleshooting

### Agent Not Found

```bash
# Check if agent is registered
curl "http://${LITELLM_HOST}:${LITELLM_PORT}/agents" | jq '.[] | select(.name=="steward")'
```

### Authentication Failed

```bash
# Verify master key
curl "http://${LITELLM_HOST}:${LITELLM_PORT}/key/info" \
  -H "Authorization: Bearer ${LITELLM_MASTER_KEY}"
```

---

**Register agents to enable A2A communication.**