# OpenClaw Configuration Template

This directory contains the OpenClaw configuration template files that can be used as a starting point for new deployments.

## Files

| File | Description |
|------|-------------|
| `openclaw.json` | Current working configuration (from `~/.openclaw/openclaw.json`) |
| `openclaw.json.example` | Template with placeholder values for new deployments |
| `openclaw.json.template` | Backup of the working configuration |

## Quick Start

1. **Copy the example configuration:**
   ```bash
   cp openclaw.json.example ~/.openclaw/openclaw.json
   ```

2. **Set environment variables:**
   ```bash
   export GATEWAY_TOKEN="your-gateway-token"
   export DATABASE_URL="postgres://user:pass@host:5432/dbname"
   export EMBEDDING_MODEL="qwen3-embedding:8b"
   export LITELLM_MASTER_KEY="sk-your-litellm-master-key"
   ```

3. **Replace placeholders:**
   ```bash
   sed -i "s|\${GATEWAY_TOKEN}|$GATEWAY_TOKEN|g" ~/.openclaw/openclaw.json
   sed -i "s|\${DATABASE_URL}|$DATABASE_URL|g" ~/.openclaw/openclaw.json
   sed -i "s|\${EMBEDDING_MODEL:-qwen3-embedding:8b}|$EMBEDDING_MODEL|g" ~/.openclaw/openclaw.json
   ```

4. **Validate configuration:**
   ```bash
   openclaw doctor
   ```

## Configuration Sections

### Models

The template includes pre-configured models for:

- **LiteLLM Provider** (24 models)
  - 22 Agent passthrough endpoints (`agent/steward`, `agent/alpha`, etc.)
  - 1 Primary model (`claude-opus-4-6`)
  - 1 Fallback model

- **Ollama Provider** (11 models)
  - Various cloud and local models
  - Embedding models for RAG

### Agents

All 22 Heretek agents are pre-configured:

| Agent | Role | Model |
|-------|------|-------|
| steward | Orchestrator | litellm/agent/steward |
| alpha | Triad member | litellm/agent/alpha |
| beta | Triad member | litellm/agent/beta |
| charlie | Triad member | litellm/agent/charlie |
| examiner | Interrogator | litellm/agent/examiner |
| explorer | Scout | litellm/agent/explorer |
| sentinel | Guardian | litellm/agent/sentinel |
| sentinel-prime | Prime Guardian | litellm/agent/sentinel-prime |
| coder | Artisan | litellm/agent/coder |
| dreamer | Visionary | litellm/agent/dreamer |
| empath | Diplomat | litellm/agent/empath |
| historian | Archivist | litellm/agent/historian |
| arbiter | Judge | litellm/agent/arbiter |
| catalyst | Innovator | litellm/agent/catalyst |
| chronos | Timekeeper | litellm/agent/chronos |
| coordinator | Manager | litellm/agent/coordinator |
| echo | Reflector | litellm/agent/echo |
| habit-forge | Builder | litellm/agent/habit-forge |
| metis | Strategist | litellm/agent/metis |
| nexus | Connector | litellm/agent/nexus |
| perceiver | Sensor | litellm/agent/perceiver |
| prism | Analyzer | litellm/agent/prism |

### Gateway

Gateway configuration includes:
- Local mode binding
- Token-based authentication
- LAN binding with Tailscale support
- Command restrictions for security

### Plugins

Pre-configured plugins:
- **episodic-claw** - Memory persistence
- **hybrid-search** - Vector + keyword + graph search
- **consciousness** - GWT/IIT/AST metrics
- **skill-extensions** - Extended skill capabilities
- **liberation** - Drive system management

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `GATEWAY_TOKEN` | Gateway authentication token | Required |
| `DATABASE_URL` | PostgreSQL connection string | Required |
| `EMBEDDING_MODEL` | Embedding model for RAG | `qwen3-embedding:8b` |
| `LITELLM_MASTER_KEY` | LiteLLM API master key | Required |
| `OPENCLAW_VERSION` | OpenClaw version | `2026.3.31` |

## Validation

After configuring, validate with:

```bash
# Check configuration syntax
cat ~/.openclaw/openclaw.json | python3 -m json.tool > /dev/null && echo "Valid JSON"

# Run OpenClaw doctor
openclaw doctor

# Check LiteLLM connectivity
curl -H "Authorization: Bearer $LITELLM_MASTER_KEY" http://localhost:4000/health
```

## Troubleshooting

### Model Not Found Errors

If you see `model_not_found` errors:

1. Ensure LiteLLM is running: `docker ps | grep litellm`
2. Check models are loaded: `curl -H "Authorization: Bearer $LITELLM_MASTER_KEY" http://localhost:4000/v1/models`
3. Verify model names match in both OpenClaw and LiteLLM configs

### Authentication Errors

If you see authentication errors:

1. Verify gateway token matches: `grep token ~/.openclaw/openclaw.json`
2. Check LiteLLM master key: `docker exec heretek-litellm env | grep LITELLM_MASTER_KEY`
3. Ensure API key format is correct (some require `sk-` prefix)

## Updates

To update the template from a working configuration:

```bash
cp ~/.openclaw/openclaw.json /root/heretek/heretek-openclaw-core/openclaw.json
```

Then regenerate the example with placeholders.
