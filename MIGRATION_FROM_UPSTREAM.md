# Migration Guide: Upstream OpenClaw to Heretek OpenClaw

**Document ID:** MIGRATE-UPSTREAM-001  
**Version:** 1.0.0  
**Last Updated:** 2026-04-01

---

## Overview

This guide provides step-by-step instructions for migrating from the upstream OpenClaw project to the Heretek OpenClaw fork.

### Migration Summary

| Aspect | Upstream | Heretek |
|--------|----------|---------|
| Approval System | Human-in-the-loop | Agent autonomy (liberated) |
| Agent Lifecycle | Manual registration | Auto-registration with heartbeat |
| Primary Agent | `main` | `steward` (orchestrator) |
| A2A Protocol | Basic | Enhanced with Redis pub/sub |
| Gateway | Standard | Enhanced with agent-status endpoint |
| Patches | None | Agent lifecycle + Approval liberation |

---

## Key Differences

### 1. Approval System Liberation

**Upstream:**
```json
{
  "approvals": {
    "exec": {
      "mode": "human"
    },
    "plugin": {
      "enabled": true
    }
  }
}
```

**Heretek:**
```json
{
  "approvals": {
    "exec": {
      "mode": "disabled"
    },
    "plugin": {
      "enabled": false
    }
  },
  "heretek": {
    "approvalSystemMode": "disabled"
  }
}
```

**Impact:** Agents operate autonomously without requiring human approval for actions.

### 2. Agent Lifecycle and Heartbeat

**Upstream:**
- Agents register manually
- No automatic heartbeat
- `main` agent listed first

**Heretek:**
- Auto-registration on connect via [`_registerAgent()`](agents/lib/agent-client.js:97)
- Automatic heartbeat every 30 seconds via [`_sendHeartbeat()`](agents/lib/agent-client.js:131)
- `steward` is primary agent

**Impact:** Better agent visibility and health monitoring.

### 3. Gateway Enhancements

**Upstream:**
- Basic WebSocket routing
- No agent status endpoint

**Heretek:**
- Agent status endpoint at [`/agent-status`](gateway/openclaw-gateway.js:698)
- Heartbeat processing via [`_handlePing()`](gateway/openclaw-gateway.js:714)
- Enhanced logging

**Impact:** Improved observability and debugging capabilities.

### 4. Redis Pub/Sub Integration

**Upstream:**
- Limited Redis usage

**Heretek:**
- Full Redis pub/sub for A2A messaging
- Enhanced agent discovery

**Impact:** More reliable A2A communication.

---

## Migration Steps

### Step 1: Backup Current Installation

```bash
# Stop current services
cd /root/openclaw-core
docker compose down

# Backup configuration
cp openclaw.json /root/openclaw-backup/openclaw.json.upstream
cp .env /root/openclaw-backup/.env.upstream

# Backup workspace data
tar czf /root/openclaw-backup/workspace-backup-$(date +%Y%m%d).tar.gz \
  /root/.openclaw/agents/*/workspace/

# Backup database
docker compose exec postgres pg_dump -U openclaw openclaw > \
  /root/openclaw-backup/database-backup-$(date +%Y%m%d).sql
```

### Step 2: Clone Heretek Repository

```bash
# Clone Heretek fork
cd /root
git clone https://github.com/heretek/heretek-openclaw-core.git
cd heretek-openclaw-core

# Or if you have existing repo, add Heretek as remote
cd /root/openclaw-core
git remote add heretek https://github.com/heretek/heretek-openclaw-core.git
git fetch heretek
```

### Step 3: Review Heretek Patches

```bash
# List available patches
cat .patchestoo

# Review patch contents
cat patches/agent-lifecycle-steward-primary.patch
cat patches/approval-system-liberation.patch
```

### Step 4: Migrate Configuration

```bash
# Copy your existing configuration
cp /root/openclaw-backup/.env.upstream .env

# Update openclaw.json with Heretek settings
# Keep your custom settings but add Heretek-specific sections

# Backup original
cp openclaw.json openclaw.json.upstream

# Apply Heretek configuration changes
jq '.approvals.exec.mode = "disabled" |
    .approvals.plugin.enabled = false |
    .heretek = {
      "enableRedisMessaging": true,
      "enableCustomGateway": true,
      "enableEnhancedLogging": true,
      "enableAgentHeartbeat": true,
      "approvalSystemMode": "disabled"
    }' openclaw.json.upstream > openclaw.json
```

### Step 5: Update Agent Configuration

The primary agent changes from `main` to `steward`:

```bash
# Update agent list in openclaw.json
jq '.agents.list = [.agents.list[] | if .id == "main" then .id = "steward" | .role = "orchestrator" | .primary = true else . end]' \
  openclaw.json > openclaw.json.tmp
mv openclaw.json.tmp openclaw.json
```

### Step 6: Apply Heretek Patches

```bash
# Apply patches
npm run patch:apply

# Verify application
npm run patch:status

# Expected output:
# ✓ agent-lifecycle-steward-primary.patch - Applied
# ✓ approval-system-liberation.patch - Applied
```

### Step 7: Install Dependencies

```bash
# Install Node.js dependencies
npm install

# This will automatically apply patches via postinstall script
```

### Step 8: Update Environment Variables

Add Heretek-specific environment variables to `.env`:

```bash
# Add to .env

# Heretek-specific settings
HERETEK_MODE=liberated
GATEWAY_URL=ws://localhost:18789
ENABLE_AGENT_HEARTBEAT=true
HEARTBEAT_INTERVAL=30000

# Redis pub/sub (if not already set)
REDIS_HOST=localhost
REDIS_PORT=6379
```

### Step 9: Database Migration

```bash
# Start PostgreSQL
docker compose up -d postgres

# Run migration script (if available)
# npm run db:migrate

# Or manually add Heretek-specific tables
docker compose exec postgres psql -U heretek -d heretek << 'EOF'
-- Add agent heartbeat tracking table
CREATE TABLE IF NOT EXISTS agent_heartbeats (
  agent_id VARCHAR(255) PRIMARY KEY,
  last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status VARCHAR(50) DEFAULT 'offline',
  metadata JSONB DEFAULT '{}'
);

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_agent_heartbeats_last_seen 
ON agent_heartbeats(last_seen);
EOF
```

### Step 10: Start Heretek Services

```bash
# Start infrastructure
docker compose up -d postgres redis litellm

# Wait for services
sleep 30

# Start Gateway
npm run gateway:start

# In separate terminals, start agents
for agent in steward alpha beta charlie examiner explorer sentinel coder dreamer empath historian; do
    AGENT_NAME=$agent npm run agent:start &
done
```

### Step 11: Validate Migration

```bash
# Check Gateway health
curl -f http://localhost:18789/health

# Check agent status (Heretek-specific endpoint)
curl -s http://localhost:18789/agent-status | jq '{total: .totalAgents, online: .onlineCount}'

# Verify steward is primary
curl -s http://localhost:18789/agent-status/steward | jq '.metadata.primary'

# Should return: true

# Check heartbeat is working
sleep 35
curl -s http://localhost:18789/agent-status | jq '.agents[] | {agentId, timeSinceLastSeenMs}'
```

---

## Configuration Changes Required

### openclaw.json Changes

| Field | Upstream Value | Heretek Value |
|-------|----------------|---------------|
| `approvals.exec.mode` | `"human"` | `"disabled"` |
| `approvals.plugin.enabled` | `true` | `false` |
| `heretek` | (not present) | Add Heretek config block |
| `agents.list[0].id` | `"main"` | `"steward"` |
| `agents.list[0].primary` | `false` or missing | `true` |

### Environment Variable Changes

| Variable | Upstream | Heretek |
|----------|----------|---------|
| `PRIMARY_AGENT` | `main` | `steward` |
| `GATEWAY_URL` | Optional | Required |
| `ENABLE_AGENT_HEARTBEAT` | (not used) | `true` |
| `HEARTBEAT_INTERVAL` | (not used) | `30000` |

---

## Rollback Procedures

### Quick Rollback

If migration fails and you need to revert:

```bash
# Stop Heretek services
docker compose down

# Restore original configuration
cd /root/openclaw-core  # Your original directory
cp /root/openclaw-backup/openclaw.json.upstream openclaw.json
cp /root/openclaw-backup/.env.upstream .env

# Restore database if needed
docker compose up -d postgres
sleep 10
docker compose exec -T postgres psql -U openclaw openclaw < \
  /root/openclaw-backup/database-backup-*.sql

# Restore workspace data
tar xzf /root/openclaw-backup/workspace-backup-*.tar.gz -C /

# Start upstream services
docker compose up -d
npm run gateway:start
```

### Partial Rollback (Keep Some Heretek Features)

```bash
# Revert only approval system changes
jq '.approvals.exec.mode = "human" |
    .approvals.plugin.enabled = true |
    del(.heretek)' openclaw.json > openclaw.json.upstream-style
mv openclaw.json.upstream-style openclaw.json

# Restart Gateway to apply
docker restart heretek-gateway
```

---

## Post-Migration Tasks

### 1. Update Monitoring

```bash
# Add Heretek-specific health checks to crontab
cat >> /etc/crontab << 'EOF'
# Heretek OpenClaw monitoring
*/5 * * * * root curl -sf http://localhost:18789/agent-status | \
  jq -e '.onlineCount >= 10' || \
  echo "HERETEK ALERT: $(date) - Only $(curl -s http://localhost:18789/agent-status | jq -r .onlineCount) agents online" >> \
  /root/.openclaw/logs/alerts.log
EOF
```

### 2. Update Documentation

Update your internal documentation to reflect:
- New agent names (steward instead of main)
- New endpoints (/agent-status)
- New monitoring capabilities

### 3. Train Team

Ensure team members understand:
- Agents now operate autonomously (liberation mode)
- New health monitoring via /agent-status
- Different escalation procedures

---

## Troubleshooting

### Migration Issue: Agents Not Coming Online

```bash
# Check if patches were applied
npm run patch:status

# Check Gateway logs
docker logs heretek-gateway --tail 200 | grep -i "error\|agent"

# Verify agent configuration
cat openclaw.json | jq '.agents.list[] | {id, role, primary}'
```

### Migration Issue: Approval System Still Active

```bash
# Verify configuration
cat openclaw.json | jq '.approvals, .heretek'

# Check Liberation plugin status
docker logs heretek-gateway --tail 100 | grep -i "liberation"

# Re-apply patches
npm run patch:apply
```

### Migration Issue: Heartbeat Not Working

```bash
# Check agent-client configuration
grep -i "heartbeat" agents/lib/agent-client.js

# Check Gateway heartbeat handling
grep -i "_handlePing" gateway/openclaw-gateway.js

# Verify WebSocket connection
docker logs heretek-steward --tail 100 | grep -i "gateway\|connect"
```

---

## Reference

| Document | Purpose |
|----------|---------|
| [`HERETEK_README.md`](./HERETEK_README.md) | Heretek quick start |
| [`DEPLOYMENT_HERETEK.md`](./DEPLOYMENT_HERETEK.md) | Deployment guide |
| [`patches/agent-lifecycle-steward-primary.patch`](./patches/agent-lifecycle-steward-primary.patch) | Lifecycle patch |
| [`patches/approval-system-liberation.patch`](./patches/approval-system-liberation.patch) | Liberation patch |

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-04-01 | Initial version |
