# Heretek OpenClaw Operations Documentation

**Version:** 1.0.0  
**Last Updated:** 2026-04-01

---

## Overview

This directory contains operational documentation for the Heretek OpenClaw system, including runbooks, monitoring guides, and operational procedures specific to the Heretek fork.

---

## Quick Reference Table

| Scenario | Runbook | Severity | Expected Resolution |
|----------|---------|----------|---------------------|
| A2A communication failing | [A2A Debug](./RUNBOOK_A2A_DEBUG.md) | High | 10-15 minutes |
| Agent offline | [Agent Offline](./RUNBOOK_AGENT_OFFLINE.md) | Medium | 5-10 minutes |
| Gateway not responding | [Gateway Failure](./RUNBOOK_GATEWAY_FAILURE.md) | Critical | 5-15 minutes |
| Approval system stuck | [Approval Issues](./RUNBOOK_APPROVAL_ISSUES.md) | Medium | 10-20 minutes |
| High CPU/memory usage | [Troubleshooting](../../heretek-openclaw-docs/docs/operations/runbook-troubleshooting.md) | Variable | Variable |
| Database issues | [Database Corruption](../../heretek-openclaw-docs/docs/operations/runbook-database-corruption.md) | Critical | 30-60 minutes |
| Need to restore data | [Backup Restoration](../../heretek-openclaw-docs/docs/operations/runbook-backup-restoration.md) | High | 15-30 minutes |
| Emergency shutdown | [Emergency Shutdown](../../heretek-openclaw-docs/docs/operations/runbook-emergency-shutdown.md) | Critical | Immediate |

---

## Heretek-Specific Runbooks

### A2A Protocol Debugging

[`RUNBOOK_A2A_DEBUG.md`](./RUNBOOK_A2A_DEBUG.md)

**Purpose:** Diagnose and resolve Agent-to-Agent communication failures.

**Key Procedures:**
- Gateway status verification
- LiteLLM agent registry check
- WebSocket connectivity test
- Redis pub/sub verification
- A2A infrastructure restart

**Quick Command:**
```bash
curl -s http://localhost:18789/agent-status | jq '{online: .onlineCount, offline: .offlineCount}'
```

### Agent Offline Recovery

[`RUNBOOK_AGENT_OFFLINE.md`](./RUNBOOK_AGENT_OFFLINE.md)

**Purpose:** Detect, diagnose, and recover offline agents.

**Key Procedures:**
- Heartbeat troubleshooting
- Graceful agent restart
- Force restart with container removal
- Rolling restart for multiple agents

**Quick Command:**
```bash
docker restart heretek-steward && sleep 15 && curl -sf http://localhost:18789/agent-status/steward | jq '.status'
```

### Gateway Failure Recovery

[`RUNBOOK_GATEWAY_FAILURE.md`](./RUNBOOK_GATEWAY_FAILURE.md)

**Purpose:** Restore Gateway functionality after failure.

**Key Procedures:**
- Gateway health checks
- Graceful and force restart
- Full Gateway rebuild
- Failover options

**Quick Command:**
```bash
curl -f http://localhost:18789/health || docker restart heretek-gateway
```

### Approval System Issues

[`RUNBOOK_APPROVAL_ISSUES.md`](./RUNBOOK_APPROVAL_ISSUES.md)

**Purpose:** Troubleshoot Liberation plugin and approval bypass issues.

**Key Procedures:**
- Liberation plugin verification
- Approval bypass testing
- Safety section patch status
- Manual override procedures

**Quick Command:**
```bash
docker logs heretek-gateway --tail 100 | grep -i "liberation\|bypass"
```

---

## Additional Operational Guides

### Agent Monitoring

[`AGENT-MONITORING.md`](./AGENT-MONITORING.md)

Covers:
- Langfuse integration
- Gateway monitoring
- Plugin monitoring
- System metrics

### Matrix Setup and Routing

- [`MATRIX-SETUP.md`](./MATRIX-SETUP.md) - Matrix protocol setup
- [`MATRIX-ROUTING-GUIDE.md`](./MATRIX-ROUTING-GUIDE.md) - Message routing configuration

### Multi-Session Mode

[`MULTI-SESSION-MODE.md`](./MULTI-SESSION-MODE.md)

Configuration for handling multiple concurrent agent sessions.

---

## Upstream Runbooks (Compatible)

These runbooks from the upstream documentation are fully compatible with Heretek:

| Runbook | Location |
|---------|----------|
| Agent Restart | [`../../heretek-openclaw-docs/docs/operations/runbook-agent-restart.md`](../../heretek-openclaw-docs/docs/operations/runbook-agent-restart.md) |
| Service Failure | [`../../heretek-openclaw-docs/docs/operations/runbook-service-failure.md`](../../heretek-openclaw-docs/docs/operations/runbook-service-failure.md) |
| Database Corruption | [`../../heretek-openclaw-docs/docs/operations/runbook-database-corruption.md`](../../heretek-openclaw-docs/docs/operations/runbook-database-corruption.md) |
| Backup Restoration | [`../../heretek-openclaw-docs/docs/operations/runbook-backup-restoration.md`](../../heretek-openclaw-docs/docs/operations/runbook-backup-restoration.md) |
| Emergency Shutdown | [`../../heretek-openclaw-docs/docs/operations/runbook-emergency-shutdown.md`](../../heretek-openclaw-docs/docs/operations/runbook-emergency-shutdown.md) |
| Troubleshooting | [`../../heretek-openclaw-docs/docs/operations/runbook-troubleshooting.md`](../../heretek-openclaw-docs/docs/operations/runbook-troubleshooting.md) |

---

## Heretek-Specific Endpoints

### Gateway Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/health` | GET | Gateway health check |
| `/agent-status` | GET | All agents with status |
| `/agent-status/{agentId}` | GET | Specific agent status |
| `ws://localhost:18789` | WS | A2A WebSocket communication |

### Agent Health Endpoints

| Agent | Port | Health URL |
|-------|------|------------|
| Steward | 8001 | `http://localhost:8001/health` |
| Alpha | 8002 | `http://localhost:8002/health` |
| Beta | 8003 | `http://localhost:8003/health` |
| Charlie | 8004 | `http://localhost:8004/health` |
| Examiner | 8005 | `http://localhost:8005/health` |
| Explorer | 8006 | `http://localhost:8006/health` |
| Sentinel | 8007 | `http://localhost:8007/health` |
| Coder | 8008 | `http://localhost:8008/health` |
| Dreamer | 8009 | `http://localhost:8009/health` |
| Empath | 8010 | `http://localhost:8010/health` |
| Historian | 8011 | `http://localhost:8011/health` |

---

## Scripts Reference

### Health Check

```bash
# Full system health check
./scripts/health-check.sh

# Check specific service
./scripts/health-check.sh gateway
./scripts/health-check.sh steward
```

### Agent Pulse

```bash
# Check all agent heartbeats
./scripts/agent-pulse.sh
```

### Export Metrics

```bash
# Export agent metrics for monitoring
./scripts/export-agent-metrics.sh
```

### Patch Management

```bash
# Apply patches
npm run patch:apply

# Check patch status
npm run patch:status

# Create new patch
npm run patch:create -- <patch-name>
```

---

## Log Locations

| Component | Location |
|-----------|----------|
| Gateway | `docker logs heretek-gateway` or `/root/.openclaw/logs/gateway.log` |
| Agents | `docker logs heretek-{agent}` or `/root/.openclaw/logs/agents/{agent}.log` |
| PostgreSQL | `docker logs heretek-postgres` or `/var/log/postgresql/` |
| Redis | `docker logs heretek-redis` or `/var/log/redis/` |
| LiteLLM | `docker logs heretek-litellm` |
| Alerts | `/root/.openclaw/logs/alerts.log` |

---

## Escalation Contacts

| Role | Contact | Availability |
|------|---------|--------------|
| On-Call Engineer | [Configure] | 24/7 |
| Engineering Lead | [Configure] | Business hours |
| System Architect | [Configure] | Business hours |
| Heretek Support | [Configure] | Business hours |

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-04-01 | Initial Heretek operations documentation |
| - | - | Added Heretek-specific runbooks |
| - | - | Added quick reference table |
| - | - | Linked upstream compatible runbooks |
