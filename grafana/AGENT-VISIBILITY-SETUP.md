# Grafana Agent Visibility Dashboard Setup

**Date:** 2026-04-01  
**Grafana URL:** http://localhost:3001

---

## Metrics Exporter Active ✅

**Script:** `/root/.openclaw/workspace-steward/heretek-openclaw-core/scripts/export-agent-metrics.sh`  
**Cron:** Every minute  
**Metrics File:** `/tmp/openclaw-metrics.prom`

### Metrics Exported:
- `openclaw_agents_total` — Total configured agents (currently 26)
- `openclaw_sessions_active` — Active agent sessions (currently 11)
- `openclaw_gateway_status` — Gateway health (1=up, 0=down)
- `openclaw_autonomous_pulse_status` — Autonomous pulse running (1=yes)
- `openclaw_info` — Instance info (version, host)

---

## Manual Dashboard Setup (Required)

Since Grafana API requires authentication, please create the dashboard manually:

### Step 1: Login to Grafana
- **URL:** http://localhost:3001
- **Username:** admin
- **Password:** admin (or your custom password)

### Step 2: Add Prometheus Data Source (if not already added)
1. Go to Configuration → Data Sources
2. Click "Add data source"
3. Select "Prometheus"
4. URL: `http://heretek-prometheus:9090`
5. Click "Save & test"

### Step 3: Create Dashboard
1. Click "Create" → "Dashboard"
2. Add these panels:

#### Panel 1: Active Agents
- **Type:** Stat
- **Query:** `openclaw_agents_total`
- **Title:** "Active Agents"

#### Panel 2: Active Sessions  
- **Type:** Stat
- **Query:** `openclaw_sessions_active`
- **Title:** "Active Sessions"

#### Panel 3: Gateway Status
- **Type:** Stat
- **Query:** `openclaw_gateway_status`
- **Title:** "Gateway Status"
- **Value Mappings:** 0 = "DOWN" (red), 1 = "UP" (green)

#### Panel 4: Autonomous Pulse
- **Type:** Stat
- **Query:** `openclaw_autonomous_pulse_status`
- **Title:** "Autonomous Pulse"
- **Value Mappings:** 0 = "Inactive", 1 = "Active"

#### Panel 5: Activity Timeline
- **Type:** Time series
- **Queries:** 
  - `openclaw_agents_total` (legend: "Total Agents")
  - `openclaw_sessions_active` (legend: "Active Sessions")
- **Title:** "Agent Activity Over Time"

### Step 4: Save Dashboard
- Name: "The Collective — Agent Visibility"
- Tags: openclaw, agents

---

## Automated Logs

Agent activity logs are automatically updated every 5 minutes at:
- `/root/.openclaw/workspace-steward/heretek-openclaw-docs/docs/operations/agent-activity/activity-YYYY-MM-DD.md`

View latest: `tail -50 /root/.openclaw/workspace-steward/heretek-openclaw-docs/docs/operations/agent-activity/activity-$(date +%Y-%m-%d).md`

---

🦞
