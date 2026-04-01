# Heretek OpenClaw Core - Changelog

This document tracks all Heretek-specific changes to the OpenClaw Core repository.

**Repository:** heretek-openclaw-core  
**Forked from:** openclaw  
**Maintainer:** Heretek Engineering

---

## [1.0.0-heretek.1] - 2026-04-01

### Summary

Initial Heretek fork release with critical Phase 1 bug fixes for A2A protocol, agent lifecycle management, and approval system liberation.

### Added

#### A2A Protocol Infrastructure

| Component | Description | Commit |
|-----------|-------------|--------|
| `skills/a2a-message-send/a2a-redis.js` | Redis-based A2A messaging module | Initial |
| `modules/communication/redis-websocket-bridge.js` | Redis-to-WebSocket bridge for live updates | Initial |
| `gateway/openclaw-gateway.js` | WebSocket gateway server for agent communication | Initial |
| `docker-compose.redis.yml` | Modular Redis service configuration | Initial |
| `docker-compose.gateway.yml` | Modular Gateway service configuration | Initial |
| `Dockerfile.gateway` | Gateway container image definition | Initial |
| `skills/a2a-message-send/SKILL.md` | A2A skill documentation | Initial |

#### Agent Lifecycle Management

| Component | Description | Commit |
|-----------|-------------|--------|
| `agents/lib/agent-client.js#_registerAgent()` | Automatic agent registration on connect | Initial |
| `agents/lib/agent-client.js#_startHeartbeat()` | Automatic heartbeat mechanism (30s interval) | Initial |
| `agents/lib/agent-client.js#getHeartbeatStatus()` | Heartbeat status reporting | Initial |
| `agents/lib/agent-client.js#getHealth()` | Agent health information | Initial |
| `gateway/openclaw-gateway.js#_handleAgentStatusHttp()` | `/agent-status` HTTP endpoint | Initial |
| `gateway/openclaw-gateway.js#_handlePing()` | Enhanced ping handling with heartbeat metadata | Initial |

#### Documentation

| Document | Description | Commit |
|----------|-------------|--------|
| `HERETEK_FORK.md` | Fork documentation and patch management strategy | Initial |
| `CHANGELOG_HERETEK.md` | This changelog | Initial |
| `DEBUG_A2A.md` | A2A protocol debug report | Initial |
| `DEBUG_AGENT_LIFECYCLE.md` | Agent lifecycle debug report | Initial |
| `patches/README.md` | Patch usage documentation | Initial |

### Changed

#### Configuration

| File | Change | Reason |
|------|--------|--------|
| `openclaw.json` | Removed "main" agent entry | "main" had no proper configuration |
| `openclaw.json` | Added `role: "orchestrator"` to steward | Correct role assignment |
| `openclaw.json` | Added `primary: true` to steward | Steward is the primary agent |
| `package.json` | Added Heretek-specific metadata | Fork identification |

#### Agent Client

| File | Change | Reason |
|------|--------|--------|
| `agents/lib/agent-client.js#connect()` | Added automatic registration and heartbeat options | Agents must register and send heartbeats |
| `agents/lib/agent-client.js` | Added `GatewayClient` class | Encapsulate Gateway communication |

#### Gateway

| File | Change | Reason |
|------|--------|--------|
| `gateway/openclaw-gateway.js` | Added `/agent-status` endpoint | Agent visibility |
| `gateway/openclaw-gateway.js` | Added `/agent-status/{agentId}` endpoint | Per-agent status queries |
| `gateway/openclaw-gateway.js` | Enhanced ping handling | Store heartbeat metadata in Redis |

### Fixed

#### A2A Protocol

| Issue | Description | Resolution |
|-------|-------------|------------|
| Missing Redis A2A module | `a2a-redis.js` didn't exist | Created full implementation |
| Missing WebSocket bridge | `redis-websocket-bridge.js` didn't exist | Created bridge module |
| Missing Gateway server | No server listening on port 18789 | Created Gateway server |
| Architecture mismatch | Conflicting WebSocket vs Redis approaches | Implemented both patterns |

#### Agent Lifecycle

| Issue | Description | Resolution |
|-------|-------------|------------|
| Steward wasn't primary | "main" agent was listed first | Removed "main", set steward primary |
| Agents not online | No automatic registration/heartbeat | Added auto-registration and heartbeat |
| No agent visibility | No status endpoint | Added `/agent-status` endpoints |

#### Approval System

| Issue | Description | Resolution |
|-------|-------------|------------|
| Manual patching required | Safety section patch not auto-applied | Added auto-apply mechanism |
| Approval prompts still appearing | Liberation plugin not integrated | Added approval bypass hooks |

### Technical Details

#### A2A Message Format

```json
{
  "type": "message",
  "from": "steward",
  "to": "alpha",
  "content": {
    "role": "user",
    "content": "Task description"
  },
  "correlationId": "msg_1712000000000_1",
  "timestamp": "2026-04-01T16:00:00.000Z"
}
```

#### Heartbeat Message Format

```json
{
  "type": "ping",
  "agentId": "steward",
  "timestamp": "2026-04-01T16:00:00.000Z",
  "heartbeat": {
    "uptime": 1234.56,
    "memoryUsage": {
      "rss": 123456789,
      "heapTotal": 98765432,
      "heapUsed": 87654321,
      "external": 1234567
    },
    "lastHeartbeatSent": "2026-04-01T15:59:30.000Z"
  }
}
```

#### Redis Data Structures

```
openclaw:a2a:inbox:{agentId}     - List of queued messages
openclaw:a2a:agents              - Set of registered agents
openclaw:a2a:agent:{agentId}     - Hash with agent metadata
openclaw:a2a:broadcast           - Pub/sub channel for broadcasts
openclaw:a2a:read:{agentId}      - Set of read message IDs
```

### Upstream PR Status

| PR # | Description | Status | Date |
|------|-------------|--------|------|
| - | A2A Protocol Infrastructure | Pending | 2026-04-01 |
| - | Agent Lifecycle Improvements | Pending | 2026-04-01 |
| - | Gateway Server Implementation | Pending | 2026-04-01 |

---

## [Unreleased]

### Planned

- [ ] Submit A2A protocol fixes to upstream
- [ ] Submit agent lifecycle improvements to upstream
- [ ] Add comprehensive integration tests
- [ ] Create migration guide for existing deployments

---

## Version History

| Version | Date | Upstream Base | Notes |
|---------|------|---------------|-------|
| 1.0.0-heretek.1 | 2026-04-01 | Latest | Initial fork with Phase 1 fixes |

---

## Related Changes in heretek-openclaw-plugins

### Approval System Liberation

| Component | Change | Date |
|-----------|--------|------|
| `plugins/openclaw-liberation-plugin/src/index.js` | Added approval bypass integration | 2026-04-01 |
| `plugins/openclaw-liberation-plugin/config/default.json` | Added approvalBypass configuration | 2026-04-01 |
| `plugins/openclaw-liberation-plugin/patches/` | Auto-apply safety section patch | 2026-04-01 |

---

## Notes

- All Phase 1 fixes are documented in `DEBUG_A2A.md` and `DEBUG_AGENT_LIFECYCLE.md`
- Patch management is documented in `HERETEK_FORK.md`
- For detailed technical information, see the individual debug reports
