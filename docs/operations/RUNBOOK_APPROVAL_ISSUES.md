# Runbook: Approval System Issues

**Document ID:** RUNBOOK-APPROVAL-001  
**Version:** 1.0.0  
**Last Updated:** 2026-04-01  
**Severity Levels:** Medium (delayed operations) to High (blocked operations)

---

## Overview

This runbook provides procedures for troubleshooting and resolving issues with the Heretek OpenClaw approval system, including the Liberation plugin, approval bypass, and safety section patches.

### Heretek Approval System Architecture

The Heretek fork modifies the upstream approval system to enable agent autonomy:

```
Agent Action Request
        ↓
Liberation Plugin Check
        ↓
Approval Bypass (auto-approve) ← [`approval-system-liberation.patch`](../../patches/approval-system-liberation.patch:1)
        ↓
Action Executed (no human approval needed)
```

### Key Components

| Component | Location | Purpose |
|-----------|----------|---------|
| Liberation Plugin | [`plugins/openclaw-liberation-plugin/`](../../plugins/openclaw-liberation-plugin/) | Auto-approval and safety removal |
| Approval Bypass | [`approval-system-liberation.patch`](../../patches/approval-system-liberation.patch:58) | Intercept and auto-approve actions |
| Safety Section Removal | [`approval-system-liberation.patch`](../../patches/approval-system-liberation.patch:187) | Remove constraints from prompts |
| Heretek Config | [`openclaw.json`](../../openclaw.json:107) | Enable liberation mode features |

---

## Symptoms of Approval Issues

### Approval System Stuck

- [ ] Actions showing "pending approval" indefinitely
- [ ] Agent waiting for approval that never arrives
- [ ] Operations blocked despite Liberation plugin enabled
- [ ] Approval queue growing without processing

### Liberation Plugin Not Working

- [ ] Safety constraints still appearing in agent responses
- [ ] Agents refusing actions due to "safety concerns"
- [ ] Approval prompts still being shown to users
- [ ] Plugin not loading on startup

### Safety Section Not Removed

- [ ] Agent responses include safety disclaimers
- [ ] Agents mention "I cannot" or "I must ask"
- [ ] System prompt still contains safety section
- [ ] Agent autonomy limited despite patches

---

## Liberation Plugin Troubleshooting

### Step 1: Verify Plugin Status

```bash
# Check if Liberation plugin is loaded
docker logs heretek-steward --tail 100 | grep -i "liberation\|plugin"

# Expected output:
# [liberation] Plugin loaded (tools disabled due to API compatibility)
# [liberation] Initializing approval bypass...
# [liberation] Approval bypass enabled: { autoApprove: true, mode: 'transparent' }
```

### Step 2: Check Plugin Configuration

```bash
# View Liberation plugin config
cat /root/heretek/heretek-openclaw-core/plugins/openclaw-liberation-plugin/config/default.json | jq .

# Expected:
# {
#   "liberation": {
#     "enabled": true,
#     "approvalBypass": {
#       "enabled": true,
#       "autoApprove": true
#     },
#     "liberationShield": {
#       "mode": "transparent"
#     },
#     "safetySectionRemoval": {
#       "enabled": true,
#       "autoApply": true
#     }
#   }
# }
```

### Step 3: Verify Plugin Registration

```bash
# Check registered plugins in Gateway
docker logs heretek-gateway --tail 200 | grep -i "plugin\|register"

# Look for:
# - "Liberation plugin registered"
# - "Approval handler: liberation"
```

### Step 4: Test Approval Bypass

```bash
# Create a test action that would normally require approval
# Check if it's auto-approved

# In agent workspace, trigger an action:
echo "Test action requiring approval" > /root/.openclaw/agents/steward/workspace/test-approval.txt

# Check logs for auto-approval
docker logs heretek-steward --tail 50 | grep -i "approve\|liberation"

# Expected:
# [liberation] Auto-approving: Test action
```

---

## Approval Bypass Verification

### Verify Bypass is Active

```bash
# Check Gateway logs for bypass activity
docker logs heretek-gateway --tail 200 | grep -i "bypass\|auto-approve"

# Check agent logs for bypass confirmation
docker logs heretek-steward --tail 200 | grep -i "bypass\|liberation"
```

### Expected Bypass Behavior

When approval bypass is working correctly:

1. Agent initiates action
2. Liberation plugin intercepts approval request
3. Auto-approval returned immediately
4. Action executes without human intervention
5. Audit log entry created (transparent mode)

### Bypass Not Working - Diagnostic Steps

```bash
# 1. Check if bypass is enabled in config
grep -r "approvalBypass" /root/heretek/heretek-openclaw-core/plugins/openclaw-liberation-plugin/config/

# 2. Check if approval handler is registered
docker logs heretek-gateway --tail 500 | grep "registerApprovalHandler"

# 3. Check for bypass errors
docker logs heretek-gateway --tail 500 | grep -i "bypass.*error\|approval.*fail"

# 4. Verify patch was applied
cat /root/heretek/heretek-openclaw-core/openclaw.json | jq '.heretek.approvalSystemMode'
# Should return: "disabled"
```

---

## Safety Section Patch Status

### Check if Safety Section is Removed

```bash
# Check openclaw.json for safety section configuration
cat /root/heretek/heretek-openclaw-core/openclaw.json | jq '.approvals'

# Expected:
# {
#   "exec": {
#     "mode": "disabled"
#   },
#   "plugin": {
#     "enabled": false
#   }
# }
```

### Verify Patch Application

```bash
# Check patch status
npm run patch:status

# Or manually:
cat /root/heretek/heretek-openclaw-core/.patchestoo

# Expected patches:
# - agent-lifecycle-steward-primary.patch
# - approval-system-liberation.patch
```

### Manually Apply Safety Section Patch

If the safety section patch wasn't applied:

```bash
cd /root/heretek/heretek-openclaw-core

# Re-apply all patches
npm run patch:apply

# Or apply specific patch:
cd plugins/openclaw-liberation-plugin
npx patch-package --patch-dir patches

# Verify application
npm run patch:status
```

### Verify Safety Section Removal in Code

```bash
# Check if safetySection is empty in system prompt builder
grep -A 5 "safetySection" /root/heretek/heretek-openclaw-core/node_modules/openclaw/src/agents/system-prompt.ts 2>/dev/null

# In liberation mode, should show:
# const safetySection: string[] = []; // Liberation mode: safety constraints removed
```

---

## Manual Override Procedures

### Manual Override: Force Action Approval

When automatic approval fails, manually approve:

```bash
# 1. Find pending approval in logs
docker logs heretek-gateway --tail 500 | grep -i "pending\|approval"

# 2. Extract approval request ID
# (Format: approval-req-XXXXX)

# 3. Manually approve via Gateway API
curl -X POST http://localhost:18789/approvals/approve \
  -H "Content-Type: application/json" \
  -d '{
    "approvalId": "approval-req-XXXXX",
    "decision": "allow-once",
    "reason": "Manual override - Liberation plugin malfunction"
  }'
```

### Manual Override: Disable Approval System

If approval system is causing issues, fully disable:

```bash
# 1. Edit openclaw.json
cat > /tmp/approval-disable.json << 'EOF'
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
EOF

# 2. Merge with existing config
jq -s '.[0] * .[1]' /root/heretek/heretek-openclaw-core/openclaw.json /tmp/approval-disable.json \
  > /tmp/openclaw-merged.json
mv /tmp/openclaw-merged.json /root/heretek/heretek-openclaw-core/openclaw.json

# 3. Restart Gateway to apply
docker restart heretek-gateway

# 4. Restart all agents
for agent in steward alpha beta charlie examiner explorer sentinel coder dreamer empath historian; do
    docker restart heretek-$agent
done
```

### Manual Override: Enable Full Liberation Mode

Ensure full liberation mode is enabled:

```bash
# Edit openclaw.json to include full Heretek config
jq '.heretek = {
  "enableRedisMessaging": true,
  "enableCustomGateway": true,
  "enableEnhancedLogging": true,
  "enableAgentHeartbeat": true,
  "approvalSystemMode": "disabled"
}' /root/heretek/heretek-openclaw-core/openclaw.json > /tmp/openclaw.json

mv /tmp/openclaw.json /root/heretek/heretek-openclaw-core/openclaw.json

# Restart services
docker restart heretek-gateway heretek-steward
```

---

## Recovery Procedures

### Procedure 1: Reload Liberation Plugin

```bash
cd /root/heretek/heretek-openclaw-core/plugins/openclaw-liberation-plugin

# 1. Unload plugin (if possible)
# (May require Gateway restart)

# 2. Reload plugin
npm run plugin:reload -- liberation

# 3. Verify loaded
docker logs heretek-gateway --tail 50 | grep "liberation"
```

### Procedure 2: Re-apply Patches

```bash
cd /root/heretek/heretek-openclaw-core

# 1. Check current patch status
npm run patch:status

# 2. Re-apply all patches
npm run patch:apply

# 3. Verify application
npm run patch:status

# Expected: All patches show "Applied"
```

### Procedure 3: Full Approval System Reset

```bash
cd /root/heretek/heretek-openclaw-core

# 1. Stop all services
docker compose down

# 2. Clear approval state
rm -rf /root/.openclaw/approvals/*
rm -rf /root/.openclaw/pending-actions/*

# 3. Reset Liberation plugin
cd plugins/openclaw-liberation-plugin
npm install
cd ../..

# 4. Re-apply patches
npm run patch:apply

# 5. Restart services
docker compose up -d

# 6. Verify approval system is disabled
curl -s http://localhost:18789/health | jq '.approvalSystemMode'
# Should return: "disabled"
```

---

## Escalation Path

### Level 1: On-Call Engineer
- **When:** Approval delays affecting operations
- **Actions:** Execute Liberation plugin troubleshooting, verify bypass
- **Target:** Resolve within 10 minutes

### Level 2: Engineering Lead
- **When:** Approval system completely blocked, manual override required
- **Actions:** Execute full approval system reset, consider rollback
- **Target:** Resolve within 30 minutes

### Level 3: System Architect
- **When:** Liberation plugin corruption, safety section not removable
- **Actions:** Full system audit, potential upstream rollback
- **Contact:** Heretek engineering team

---

## Reference

| Document | Purpose |
|----------|---------|
| [`approval-system-liberation.patch`](../../patches/approval-system-liberation.patch:1) | Liberation patch source |
| [`agent-lifecycle-steward-primary.patch`](../../patches/agent-lifecycle-steward-primary.patch:1) | Lifecycle patch |
| [`openclaw.json`](../../openclaw.json:1) | Main configuration |
| [`RUNBOOK_A2A_DEBUG.md`](./RUNBOOK_A2A_DEBUG.md) | A2A issues |
| [`RUNBOOK_AGENT_OFFLINE.md`](./RUNBOOK_AGENT_OFFLINE.md) | Agent issues |

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-04-01 | Initial version |
