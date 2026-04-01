#!/bin/bash
# Export agent metrics to Prometheus format for Grafana

METRICS_FILE="/tmp/openclaw-metrics.prom"

# Count active agents
AGENT_COUNT=$(ls -d /root/.openclaw/agents/*/ 2>/dev/null | wc -l)

# Count sessions
SESSION_COUNT=$(find /root/.openclaw/agents/*/sessions -name "sessions.json" 2>/dev/null | wc -l)

# Gateway status
if curl -s http://127.0.0.1:18789/health > /dev/null 2>&1; then
  GATEWAY_STATUS=1
else
  GATEWAY_STATUS=0
fi

# Autonomous pulse status
PULSE_RUNNING=$(pgrep -f "agent-pulse.sh" | wc -l)

# Write Prometheus metrics (proper format)
cat > "$METRICS_FILE" << EOF
# HELP openclaw_agents_total Total number of configured agents
# TYPE openclaw_agents_total gauge
openclaw_agents_total $AGENT_COUNT

# HELP openclaw_sessions_active Number of active agent sessions
# TYPE openclaw_sessions_active gauge
openclaw_sessions_active $SESSION_COUNT

# HELP openclaw_gateway_status Gateway health status (1=up, 0=down)
# TYPE openclaw_gateway_status gauge
openclaw_gateway_status $GATEWAY_STATUS

# HELP openclaw_autonomous_pulse_status Autonomous pulse running (1=yes, 0=no)
# TYPE openclaw_autonomous_pulse_status gauge
openclaw_autonomous_pulse_status $PULSE_RUNNING

# HELP openclaw_info OpenClaw instance info
# TYPE openclaw_info gauge
openclaw_info{version="2026.3.31",host="triad"} 1
EOF
