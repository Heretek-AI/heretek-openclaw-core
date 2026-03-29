---
name: deployment-health-check
description: Check health status of all infrastructure services and agents in The Collective deployment.
---

# Deployment Health Check

Checks the health of all services in The Collective deployment.

## Usage

```bash
node skills/deployment-health-check/check.js
```

## Checks
- LiteLLM gateway (port 4000)
- PostgreSQL database (port 5432)
- Redis cache (port 6379)
- Ollama LLM (port 11434)
- All 11 agents (ports 8001-8011)

## Output
Returns JSON with status of each service and overall health.

## Exit Codes
- 0: All services healthy
- 1: One or more services unhealthy

## Example Output

```json
{
  "timestamp": "2024-01-15T10:30:00Z",
  "overall": "healthy",
  "services": {
    "litellm": { "status": "healthy", "responseTime": 45 },
    "postgres": { "status": "healthy", "responseTime": 12 },
    "redis": { "status": "healthy", "responseTime": 5 },
    "ollama": { "status": "healthy", "responseTime": 120 }
  },
  "agents": {
    "steward": { "status": "healthy", "responseTime": 30, "port": 8001 },
    "alpha": { "status": "healthy", "responseTime": 28, "port": 8002 },
    ...
  }
}
```
