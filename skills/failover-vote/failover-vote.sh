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