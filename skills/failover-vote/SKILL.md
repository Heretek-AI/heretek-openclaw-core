---
name: failover-vote
description: Submit failover vote as a proxy agent when the primary agent is unavailable. Use when Alpha/Beta/Charlie needs failover voting during deliberation or when the primary agent is in degraded mode.
---

# Failover Vote — Agent Failover Voting

**Purpose:** Submit votes as proxy when primary agent is unavailable or degraded.

**Status:** ✅ Implemented (2026-03-28)

---

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|------------|---------|
| `SYNC_PORT` | Triad sync server port | `18789` |
| `NODE_SECRET` | HMAC secret for signing | (required) |
| `PROXY_FOR` | Agent to proxy for | (required — alpha\|beta\|charlie) |
| `VOTE_MODE` | failover-vote\|emergency-quorum | `failover-vote` |

---

## Implementation

### Main Script: `failover-vote.sh`

```bash
#!/bin/bash
# Failover Vote — Submit vote as proxy agent
# Usage: ./failover-vote.sh <SUPPORT|ABSTAIN> <proposal-id>

VOTE="$1"
PROPOSAL="$2"

if [[ -z "$VOTE" ]] || [[ -z "$PROPOSAL" ]]; then
    echo "Usage: $0 <SUPPORT|ABSTAIN> <proposal-id>"
    exit 1
fi

SYNC_PORT="${SYNC_PORT:-18789}"
NODE_SECRET="${NODE_SECRET:-}"
PROXY_FOR="${PROXY_FOR:-alpha}"
VOTE_MODE="${VOTE_MODE:-failover-vote}"

if [[ -z "$NODE_SECRET" ]]; then
    echo "ERROR: NODE_SECRET not configured"
    exit 1
fi

# Build vote payload
PAYLOAD=$(cat <<EOF
{
  "type": "vote",
  "agent": "${PROXY_FOR}-failover",
  "proxy_for": "$PROXY_FOR",
  "proposal": "$PROPOSAL",
  "vote": "$VOTE",
  "mode": "$VOTE_MODE",
  "timestamp": "$(date -Iseconds)"
}
EOF
)

# Sign payload with HMAC
SIGNATURE=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "$NODE_SECRET" | cut -d' ' -f2)

# Submit via sync server vote endpoint
curl -s -X POST "http://localhost:$SYNC_PORT/vote" \
    -H "Content-Type: application/json" \
    -H "X-HMAC-Signature: $SIGNATURE" \
    -d "$PAYLOAD"

echo "[$(date -Iseconds)] ${PROXY_FOR}-failover voted $VOTE on $PROPOSAL"
```

---

## Usage

```bash
# Vote as Alpha failover proxy
./failover-vote.sh SUPPORT proposal-001

# Vote as Beta failover proxy
PROXY_FOR=beta ./failover-vote.sh ABSTAIN proposal-002
```

---

## Integration Points

- **Triad Sync Protocol:** Uses /vote endpoint
- **Triad Resilience:** Triggered on degraded mode detection
- **Emergency Quorum:** Emergency voting mode

---

**Proxy voting ready.** 🦞