#!/bin/bash
# Matrix Keepalive & Activity Monitor
# Ensures all agents stay active in Matrix rooms

MATRIX_URL="http://localhost:8008"
AGENT_CREDS="/tmp/matrix-agents.txt"
LOGFILE="/var/log/openclaw-matrix-keepalive.log"

echo "$(date '+%Y-%m-%d %H:%M:%S') - Matrix keepalive started" >> "$LOGFILE"

# Read agent credentials
while IFS=: read -r agent user_id token; do
  if [ -n "$token" ]; then
    # Send presence update to maintain active status
    curl -s -X POST "$MATRIX_URL/_matrix/client/v3/presence/$user_id/status" \
      -H "Authorization: Bearer $token" \
      -H "Content-Type: application/json" \
      -d '{"presence":"online","status_msg":"Autonomous agent active"}' > /dev/null 2>&1
    
    if [ $? -eq 0 ]; then
      echo "✅ @$agent:localhost - Presence updated" >> "$LOGFILE"
    else
      echo "⚠️  @$agent:localhost - Presence update failed" >> "$LOGFILE"
      
      # Try to re-login if token expired
      NEW_LOGIN=$(curl -s -X POST "$MATRIX_URL/_matrix/client/v3/login" \
        -H "Content-Type: application/json" \
        -d "{\"type\":\"m.login.password\",\"user\":\"$agent\",\"password\":\"collective2026\"}")
      
      NEW_TOKEN=$(echo "$NEW_LOGIN" | jq -r '.access_token')
      if [ -n "$NEW_TOKEN" ] && [ "$NEW_TOKEN" != "null" ]; then
        # Update credentials file
        sed -i "s/^$agent:.*/$agent:$user_id:$NEW_TOKEN/" "$AGENT_CREDS"
        echo "🔄 @$agent:localhost - Token refreshed" >> "$LOGFILE"
      fi
    fi
  fi
done < "$AGENT_CREDS"

echo "$(date '+%Y-%m-%d %H:%M:%S') - Matrix keepalive completed" >> "$LOGFILE"
