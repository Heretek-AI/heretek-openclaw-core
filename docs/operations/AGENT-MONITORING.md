# Agent Monitoring Guide

**Date:** 2026-04-01  
**Status:** Active

---

## Overview

The Collective uses multiple monitoring layers:

1. **Langfuse** — LLM tracing, metrics, evals (via LiteLLM)
2. **OpenClaw Gateway Health** — Agent heartbeats, session state
3. **Plugin Monitoring** — Consciousness metrics, liberation shield status
4. **System Metrics** — Docker containers, resource usage

---

## Langfuse Integration

### Access

- **URL**: http://192.168.31.166:3000
- **Credentials**: Check `.env` for `LITELLM_UI_USERNAME` and `LITELLM_UI_PASSWORD`

### What Langfuse Tracks

✅ LLM API calls (via LiteLLM proxy)  
✅ Token usage per agent/model  
✅ Latency and error rates  
✅ Trace trees for complex operations  
✅ User feedback and evals  

### Limitations

❌ Does NOT track local Ollama inference directly  
❌ Does NOT show agent-to-agent A2A communication  
❌ Does NOT display consciousness metrics (phi, GWT broadcasting)

---

## OpenClaw Gateway Monitoring

### Quick Status

```bash
openclaw gateway status
```

Shows: Gateway PID, state, bind address, connected agents, plugin load status

### Agent Activity Check

```bash
for agent in /root/.openclaw/agents/*/; do
  name=$(basename $agent)
  last=$(find "$agent/workspace" -type f -mmin -60 | wc -l)
  echo "$name: $last files modified in last hour"
done
```

---

## Plugin Monitoring

### Consciousness Metrics
```javascript
const metrics = consciousnessPlugin.getGlobalMetrics();
// Returns: phi, phiComponents, driveLevels, agentCount, healthStatus
```

### Liberation Shield Status
```javascript
const status = liberationPlugin.getStatus();
// Returns: initialized, running, agentCount, shieldMode, shieldActive
```

### Hybrid Search Stats
```javascript
const stats = hybridSearchPlugin.getStatus();
// Returns: indexSize, queryCount, avgLatency, cacheHitRate
```

---

## System Monitoring

### Docker Services
```bash
docker-compose ps
```

### Resource Usage
```bash
docker stats --no-stream
du -sh /root/.openclaw/*
```

---

🦞
