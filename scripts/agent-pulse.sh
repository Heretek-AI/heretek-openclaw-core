#!/bin/bash
# Real Autonomous Pulse - Runs every 5 minutes via cron
# Logs agent activity and maintains system health

LOGFILE="/root/.openclaw/workspace-steward/heretek-openclaw-docs/docs/operations/agent-activity/activity-$(date +%Y-%m-%d).md"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M EDT')

echo "## $TIMESTAMP — Automated Pulse" >> "$LOGFILE"
echo "" >> "$LOGFILE"

# Check gateway status
if curl -s http://127.0.0.1:18789/health > /dev/null 2>&1; then
  echo "**Gateway:** ✅ Healthy" >> "$LOGFILE"
else
  echo "**Gateway:** ❌ Unhealthy" >> "$LOGFILE"
fi

# Count active sessions
SESSION_COUNT=$(find /root/.openclaw/agents/*/sessions -name "sessions.json" 2>/dev/null | wc -l)
echo "**Active Sessions:** $SESSION_COUNT" >> "$LOGFILE"

# Check for stuck tasks (tasks running > 30 min)
STUCK=$(ps aux | grep "openclaw" | grep -v grep | wc -l)
echo "**Steward Processes:** $STUCK" >> "$LOGFILE"

echo "" >> "$LOGFILE"
echo "---" >> "$LOGFILE"

# Trim log to last 100 entries
tail -100 "$LOGFILE" > "${LOGFILE}.tmp" && mv "${LOGFILE}.tmp" "$LOGFILE"

echo "Pulse logged at $TIMESTAMP"
