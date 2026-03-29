---
name: litellm-ops
description: "LiteLLM proxy management. Use for: (1) health monitoring — check if the proxy and models are responsive, (2) model status — list available models and their quota/limit status, (3) config inspection — view the current litellm model list. NOT for: modifying litellm config (requires separate proposal), key rotation (use litellm admin UI), or adding new model backends."
metadata:
  {
    "openclaw":
      {
        "emoji": "🔧",
        "requires": { "bins": ["curl", "jq"] },
        "install": [],
      },
  }
---

# litellm-ops Skill

Manage and monitor the LiteLLM proxy.

## Configuration

The skill reads configuration from environment variables or .env file:

```bash
# Required environment variables
LITELLM_HOST="llm.your-domain.com"
LITELLM_PORT="4000"
LITELLM_MASTER_KEY="your-litellm-master-key"

# Or set from .env file
source .env
```

## Health Monitoring

```bash
# Check proxy health
curl -s -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
  https://${LITELLM_HOST}/health | jq .

# Check proxy + model responsiveness (timeout 10s)
curl -s -w "\nHTTP_CODE: %{http_code}" \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
  --max-time 10 \
  https://${LITELLM_HOST}/v1/models | jq .
```

## Model Status

```bash
# List all models and their status
curl -s -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
  https://${LITELLM_HOST}/v1/models | jq '.data[] | {id: .id, status: .ready}'

# Check specific model (e.g., minimax/M2.7)
curl -s -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
  https://${LITELLM_HOST}/v1/models/minimax/MiniMax-M2.7 | jq .

# Get model group info / quota status
curl -s -X POST -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model_group_name": "MiniMax-M2.7"}' \
  https://${LITELLM_HOST}/model_group_info | jq .
```

## Config Inspection

```bash
# View the raw litellm config (local file)
cat litellm_config.yaml

# Extract model list from config
grep "model_name" litellm_config.yaml | sed 's/model_name: //' | sort -u
```

## Environment Setup

```bash
# Set master key from environment
export LITELLM_MASTER_KEY="your-key-here"

# Or use a .env file (chmod 600)
echo "LITELLM_HOST=llm.your-domain.com
LITELLM_PORT=4000
LITELLM_MASTER_KEY=your-key" > .env
chmod 600 .env
source .env
```

## Quick Status Check

```bash
LITELLM_HOST="${LITELLM_HOST:-localhost}"
LITELLM_PORT="${LITELLM_PORT:-4000}"
LITELLM_MASTER_KEY="${LITELLM_MASTER_KEY:-}"

echo "=== LiteLLM Health ==="
curl -s -w "\nStatus: %{http_code}" \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
  --max-time 5 \
  "https://${LITELLM_HOST}:${LITELLM_PORT}/health"

echo -e "\n\n=== Models ==="
curl -s -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
  "https://${LITELLM_HOST}:${LITELLM_PORT}/v1/models" | \
  jq -r '.data[] | "\(.id) — \(if .ready then "✅ ready" else "❌ unavailable" end)"'
```

## Notes

- The litellm proxy exposes an OpenAI-compatible API — any OpenAI-compatible client works
- Quota/limit info requires checking `/model_group_info` endpoint
- For config changes (add/remove models), update local litellm_config.yaml and restart the container
- Model availability depends on your specific configuration

## Deployment Notes

The LiteLLM endpoint must be reachable from the host running this skill. Update LITELLM_HOST and LITELLM_PORT in your environment configuration.