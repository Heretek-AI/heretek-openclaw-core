---
name: a2a-message-send
description: Send structured messages between collective agents via Redis-based A2A layer. Use when agents need to communicate, delegate tasks, share findings, or coordinate actions.
---

# A2A Message Send Skill

Send structured messages between agents using the Redis-based A2A protocol.

> **Note:** LiteLLM native A2A endpoints are not available. This implementation uses Redis pub/sub for reliable message passing.

## Configuration

```bash
# Environment
REDIS_URL="${REDIS_URL:-redis://redis:6379}"

# Available agents
AGENTS="steward,alpha,beta,charlie,dreamer,empath,examiner,explorer,historian,sentinel"
```

## Quick Start (Redis-based A2A)

### Using the CLI Tool

```bash
# Send a message
node skills/a2a-message-send/a2a-cli.js send steward alpha "Hello from steward"

# Get messages for an agent
node skills/a2a-message-send/a2a-cli.js get alpha 10

# Broadcast to all agents
node skills/a2a-message-send/a2a-cli.js broadcast steward "System maintenance in 5 min"

# Get message count
node skills/a2a-message-send/a2a-cli.js count alpha

# Clear messages
node skills/a2a-message-send/a2a-cli.js clear alpha

# Ping an agent
node skills/a2a-message-send/a2a-cli.js ping steward alpha
```

### Using the JavaScript API

```javascript
const A2A = require('/app/skills/a22-message-send/a2a-redis.js');

// Send a message
const result = await A2A.sendMessage('steward', 'alpha', 'Task: Review the code');
console.log(result);

// Get messages
const messages = await A2A.getMessages('alpha', 10);
console.log(messages);

// Broadcast to all agents
const broadcast = await A2A.broadcast('steward', 'System update complete');
console.log(broadcast);

// Subscribe to real-time messages
const sub = await A2A.subscribeToInbox('alpha', (message) => {
  console.log('Received:', message);
});

// Later: unsubscribe
await sub.unsubscribe();
```

## Usage (Legacy HTTP - Fallback)

### Send Message (Bash)

```bash
#!/bin/bash
# Send   to a specific agent

AGENT_NAME="${1:-steward}"
MESSAGE="${2:-Hello}"

curl -X POST "http://${LITELLM_HOST}:${LITELLM_PORT}/a2a/${AGENT_NAME}" \
  -H "Authorization: Bearer ${A2A_VIRTUAL_KEY}" \
  -H "Content-Type: application/json" \
  -d "{
    \"message\": {
      \"role\": \"user\",
      \"parts\": [{\"kind\": \"text\", \"text\": \"${MESSAGE}\"}]
    }
  }"
```

### Send Message (Python)

```python
import asyncio
from uuid import uuid4
import httpx

async def send_to_agent(agent_name: str, message: str, role: str = "user"):
    """Send message to a collective agent via A2A."""
    
    base_url = f"http://{os.getenv('LITELLM_HOST', 'localhost')}:{os.getenv('LITELLM_PORT', '4000')}/a2a/{agent_name}"
    virtual_key = os.getenv('A2A_VIRTUAL_KEY')
    
    async with httpx.AsyncClient() as client:
        response = await client.post(
            base_url,
            json={
                "message": {
                    "role": role,
                    "messageId": uuid4().hex,
                    "parts": [{"kind": "text", "text": message}]
                }
            },
            headers={"Authorization": f"Bearer {virtual_key}"}
        )
        
        if response.status_code == 200:
            return response.json()
        else:
            raise Exception(f"A2A message failed: {response.text}")

# Examples
async def main():
    # Explorer sends intel to Triad
    await send_to_agent("triad", "[INTEL] New release available: v2.0.0")
    
    # Triad requests safety review from Sentinel
    await send_to_agent("sentinel", "[REVIEW] Proposal PROPOSAL-001 ratified")
    
    # Steward requests Coder implementation
    await send_to_agent("coder", "[IMPLEMENT] PROPOSAL-001 ready for coding")
```

### Stream Response

```python
async def send_message_stream(agent_name: str, message: str):
    """Send message and stream response."""
    
    base_url = f"http://{LITELLM_HOST}:{LITELLM_PORT}/a2a/{agent_name}"
    
    async with httpx.AsyncClient() as client:
        async with client.stream(
            "POST",
            base_url,
            json={
                "message": {
                    "role": "user",
                    "parts": [{"kind": "text", "text": message}]
                }
            },
            headers={"Authorization": f"Bearer {A2A_VIRTUAL_KEY}"}
        ) as response:
            async for chunk in response.aiter_bytes():
                print(chunk.decode(), end="")
```

## Message Patterns

### Intel Report (Explorer → Triad)

```bash
curl -X POST ".../a2a/triad" \
  -d '{
    "message": {
      "role": "user",
      "parts": [{
        "kind": "text",
        "text": "[INTEL] RSS: New AI safety research. GitHub: 3 new releases. npm: @collective/skills updated."
      }]
    }
  }'
```

### Proposal Question (Triad → Examiner)

```bash
curl -X POST ".../a2a/examiner" \
  -d '{
    "message": {
      "role": "user", 
      "parts": [{
        "kind": "text",
        "text": "[QUESTION] proposal=PROPOSAL-001: Should we adopt A2A protocol?"
      }]
    }
  }'
```

### Safety Review (Triad → Sentinel)

```bash
curl -X POST ".../a2a/sentinel" \
  -d '{
    "message": {
      "role": "user",
      "parts": [{
        "kind": "text",
        "text": "[REVIEW] proposal=PROPOSAL-001 ratified. Content: Implement A2A gateway."
      }]
    }
  }'
```

### Implementation Request (Triad → Coder)

```bash
curl -X POST ".../a2a/coder" \
  -d '{
    "message": {
      "role": "user",
      "parts": [{
        "kind": "text",
        "text": "[IMPLEMENT] proposal=PROPOSAL-001 ratified. Specs: 1. Deploy LiteLLM 2. Register agents 3. Test A2A"
      }]
    }
  }'
```

### Vote Submission (Triad Members)

```bash
# Alpha votes
curl -X POST ".../a2a/triad" \
  -d '{
    "message": {
      "role": "user",
      "parts": [{
        "kind": "text", 
        "text": "[VOTE] proposal=PROPOSAL-001 vote=yes rationale=Supports collective purpose"
      }]
    }
  }'
```

## Fallback: OpenClaw Sessions

If A2A fails, fall back to OpenClaw sessions:

```bash
# Fallback message
openclaw sessions send --session steward --message "$MESSAGE"
```

## Error Handling

```python
async def send_with_fallback(agent_name: str, message: str):
    """Send via A2A, fallback to OpenClaw."""
    
    try:
        return await send_to_agent(agent_name, message)
    except Exception as e:
        print(f"A2A failed: {e}, falling back to OpenClaw")
        # Fallback to OpenClaw
        subprocess.run([
            "openclaw", "sessions", "send",
            "--session", agent_name,
            "--message", message
        ])
```

---

## Logging

All A2A messages are logged by LiteLLM:

```bash
# View message logs
curl "http://${LITELLM_HOST}:${LITELLM_PORT}/logs?agent=triad" \
  -H "Authorization: Bearer ${LITELLM_MASTER_KEY}"
```

---

**Send structured messages between agents.**