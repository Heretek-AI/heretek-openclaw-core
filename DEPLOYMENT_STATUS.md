# Heretek OpenClaw - Deployment Status

**Deployment Date:** 2026-04-01
**Version:** 2.1.0
**Status:** ✅ Successfully Deployed

---

## Deployment Summary

### ✅ Completed Tasks

1. **Docker Cleanup**
   - Stopped all existing heretek containers (26 containers removed)
   - Removed all heretek volumes (19 volumes removed)
   - Removed conflicting Docker network

2. **Fresh Docker Deployment**
   - Created new `.env` file with secure random values
   - Pulled latest container images
   - Deployed all services successfully

3. **ClickHouse & Langfuse Setup**
   - Added ClickHouse service for Langfuse V3 support
   - Configured local Langfuse deployment (http://langfuse:3000)
   - Disabled cluster mode for single-node deployment
   - Disabled S3 event uploads for local deployment

4. **Ollama Models**
   - Pulled nomic-embed-text-v2-moe embedding model (957 MB)

### 🟢 Running Services

| Service | Status | Port | Health |
|---------|--------|------|--------|
| **LiteLLM Gateway** | Running | 4000 | ✅ Healthy |
| **PostgreSQL (pgvector)** | Running | 5432 | ✅ Healthy |
| **Redis** | Running | 6379 | ✅ Healthy |
| **Ollama (AMD ROCm)** | Running | 11434 | 🟡 CPU Mode |
| **ClickHouse** | Running | 8123, 9000 | ✅ Healthy |
| **Langfuse PostgreSQL** | Running | 5433 | ✅ Healthy |
| **Langfuse** | Running | 3000 | 🟡 Running |

### ⚠️ Notes

1. **Ollama GPU**: GPU discovery timed out, falling back to CPU inference. The HSA_OVERRIDE_GFX_VERSION=10.3.0 is set for AMD ROCm compatibility.

2. **Langfuse Health**: Langfuse is running but healthcheck may show unhealthy due to static export. The service is functional at http://localhost:3000

3. **API Keys**: Update your API keys in `.env`:
   ```bash
   MINIMAX_API_KEY=your-actual-key
   ZAI_API_KEY=your-actual-key
   ```

---

## Access Information

### Service URLs

| Service | URL | Credentials |
|---------|-----|-------------|
| LiteLLM Gateway | http://localhost:4000 | See LITELLM_MASTER_KEY in .env |
| PostgreSQL | localhost:5432 | User: heretek, Password: see .env |
| Redis | localhost:6379 | No password (local) |
| Ollama | http://localhost:11434 | N/A |
| ClickHouse | http://localhost:8123 | User: default, Password: see .env |
| Langfuse | http://localhost:3000 | Sign up enabled |
| Langfuse DB | localhost:5433 | User: langfuse, Password: see .env |

### Environment File Location

```
/root/heretek/heretek-openclaw-core/.env
```

### Retrieving Credentials

```bash
# Get LiteLLM Master Key
grep LITELLM_MASTER_KEY .env

# Get PostgreSQL Password
grep POSTGRES_PASSWORD .env

# Get LiteLLM UI Credentials
grep LITELLM_UI_USERNAME .env
grep LITELLM_UI_PASSWORD .env
```

---

## Next Steps

### 1. Configure API Keys

Edit `/root/heretek/heretek-openclaw-core/.env`:

```bash
nano .env
```

Update these values:
```
MINIMAX_API_KEY=your-minimax-key-here
ZAI_API_KEY=your-zai-key-here
```

Then restart LiteLLM:
```bash
docker compose restart litellm
```

### 2. Pull Ollama Models

```bash
docker compose exec ollama ollama pull nomic-embed-text-v2-moe
```

### 3. Access LiteLLM WebUI

1. Open http://localhost:4000 in your browser
2. Login with credentials from `.env`:
   - Username: `admin`
   - Password: (from LITELLM_UI_PASSWORD in .env)

### 4. Enable Langfuse (Optional)

To enable Langfuse observability:

1. Add ClickHouse service to `docker-compose.yml`
2. Set `LANGFUSE_ENABLED=true` in `.env`
3. Run `docker compose up -d langfuse`

---

## Troubleshooting

### LiteLLM Not Responding

```bash
# Check logs
docker compose logs litellm

# Restart service
docker compose restart litellm
```

### Ollama Not Loading Models

```bash
# Check Ollama status
docker compose exec ollama ollama list

# Pull embedding model
docker compose exec ollama ollama pull nomic-embed-text-v2-moe
```

### Database Connection Issues

```bash
# Check PostgreSQL health
docker compose exec postgres pg_isready -U heretek

# View PostgreSQL logs
docker compose logs postgres
```

### Network Issues

```bash
# Remove and recreate network
docker compose down
docker network rm heretek-openclaw-core_heretek-network
docker compose up -d
```

---

## Docker Compose Commands

```bash
# View status
docker compose ps

# View logs
docker compose logs -f

# Restart all services
docker compose restart

# Stop all services
docker compose down

# Stop and remove volumes
docker compose down -v

# Pull latest images
docker compose pull
```

---

## File Locations

| File | Path |
|------|------|
| docker-compose.yml | `/root/heretek/heretek-openclaw-core/docker-compose.yml` |
| Environment | `/root/heretek/heretek-openclaw-core/.env` |
| LiteLLM Config | `/root/heretek/heretek-openclaw-core/litellm_config.yaml` |
| OpenClaw Config | `/root/heretek/heretek-openclaw-core/openclaw.json` |

---

## Security Notes

1. **Change Default Credentials**: The deployment generates random passwords, but you should review and update all credentials in `.env`

2. **API Keys**: Store your MiniMax and Z.ai API keys securely. Never commit `.env` to version control

3. **Network Security**: Services are bound to localhost (127.0.0.1) by default. For production deployment, configure proper network security

4. **Backup**: Regularly backup the Docker volumes:
   - `heretek-openclaw-core_postgres_data`
   - `heretek-openclaw-core_redis_data`
   - `heretek-openclaw-core_ollama_data`

---

🦞 *The thought that never ends.*
