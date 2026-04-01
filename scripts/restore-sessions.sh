#!/bin/bash
# Restore Multi-Session Mode on Boot
# Ensures all agent sessions persist across reboots

set -e

OPENCLAW_HOME="${OPENCLAW_HOME:-/root/.openclaw}"

echo "=== Restoring Agent Sessions ==="

# Define agents that should have multi-session visibility
AGENTS=(alpha beta charlie coder examiner explorer oracle sentinel)

for agent in "${AGENTS[@]}"; do
  agent_dir="$OPENCLAW_HOME/agents/$agent"
  sessions_dir="$agent_dir/sessions"
  
  # Ensure directory exists
  mkdir -p "$sessions_dir"
  
  # Create session state if it doesn't exist
  if [ ! -f "$sessions_dir/sessions.json" ]; then
    echo "Creating session for $agent..."
    cat > "$sessions_dir/sessions.json" << EOFINNER
{
  "agent:$agent:main": {
    "sessionId": "$agent-session-$(date +%s)",
    "updatedAt": $(date +%s)000,
    "providerOverride": "ollama",
    "modelOverride": "qwen3.5:cloud",
    "systemSent": true,
    "abortedLastRun": false,
    "chatType": "direct",
    "deliveryContext": {"channel": "webchat"},
    "origin": {"provider": "webchat", "surface": "webchat", "chatType": "direct"},
    "sessionFile": "$sessions_dir/$agent.jsonl",
    "skillsSnapshot": {"prompt": "", "skills": []}
  }
}
EOFINNER
    touch "$sessions_dir/$agent.jsonl"
  fi
  
  echo "✓ $agent session ready"
done

echo "=== Session Restoration Complete ==="
echo "Active sessions: ${#AGENTS[@]}"
