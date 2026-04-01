# Heretek OpenClaw Deployment Guide

**Document ID:** DEPLOY-HERETEK-001  
**Version:** 1.0.0  
**Last Updated:** 2026-04-01

---

## Overview

This guide covers deployment options for the Heretek OpenClaw system across different environments: Docker Compose, Kubernetes, and bare metal.

### Deployment Options Summary

| Method | Best For | Complexity | Scalability |
|--------|----------|------------|-------------|
| Docker Compose | Development, small production | Low | Limited |
| Kubernetes | Large production, HA | Medium | High |
| Bare Metal | Maximum control, air-gapped | High | Manual |

---

## Prerequisites

### System Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| CPU | 8 cores | 16+ cores |
| Memory | 16 GB | 32+ GB |
| Storage | 100 GB SSD | 500 GB+ NVMe |
| Network | 1 Gbps | 10 Gbps |

### Software Requirements

| Software | Version | Purpose |
|----------|---------|---------|
| Node.js | 20+ | Runtime |
| PostgreSQL | 15+ with pgvector | Vector database |
| Redis | 7+ | Cache and pub/sub |
| Docker | 24+ | Containerization |
| kubectl | 1.26+ | Kubernetes (K8s only) |

---

## Docker Compose Deployment

### Step 1: Clone Repository

```bash
git clone https://github.com/heretek/heretek-openclaw-core.git
cd heretek-openclaw-core
```

### Step 2: Configure Environment

```bash
# Copy environment template
cp .env.example .env

# Edit with your settings
nano .env
```

**Required environment variables:**

```bash
# LiteLLM Configuration
LITELLM_URL=http://localhost:4000
LITELLM_MASTER_KEY=sk-your-master-key-here

# Database Configuration
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
POSTGRES_USER=heretek
POSTGRES_PASSWORD=your-secure-password
POSTGRES_DB=heretek

# Redis Configuration
REDIS_HOST=redis
REDIS_PORT=6379

# Gateway Configuration
GATEWAY_URL=ws://localhost:18789
GATEWAY_PORT=18789

# Agent Configuration
AGENT_NAME=steward
```

### Step 3: Apply Heretek Patches

```bash
# Apply patches (automatic via postinstall, but can run manually)
npm run patch:apply

# Verify patches applied
npm run patch:status
```

### Step 4: Start Infrastructure Services

```bash
# Start PostgreSQL, Redis, and LiteLLM
docker compose up -d postgres redis litellm

# Wait for services to be ready
sleep 30

# Verify services
docker compose ps
```

### Step 5: Initialize Database

```bash
# Run database migrations
docker compose exec postgres psql -U heretek -d heretek -c "CREATE EXTENSION IF NOT EXISTS vector;"

# Verify pgvector is installed
docker compose exec postgres psql -U heretek -d heretek -c "SELECT extname FROM pg_extension WHERE extname='vector';"
```

### Step 6: Start Gateway and Agents

```bash
# Start Gateway
docker compose up -d gateway

# Start all agents
docker compose up -d steward alpha beta charlie examiner explorer sentinel coder dreamer empath historian

# Verify all services
docker compose ps
```

### Step 7: Validate Deployment

```bash
# Check Gateway health
curl -f http://localhost:18789/health

# Check all agents
for port in 8001 8002 8003 8004 8005 8006 8007 8008 8009 8010 8011; do
    echo -n "Port $port: "
    curl -sf http://localhost:$port/health && echo "OK" || echo "FAILED"
done

# Check agent status
curl -s http://localhost:18789/agent-status | jq '{total: .totalAgents, online: .onlineCount}'
```

### Docker Compose Files

| File | Purpose |
|------|---------|
| [`docker-compose.yml`](docker-compose.yml) | Main compose file |
| [`docker-compose.test.yml`](docker-compose.test.yml) | Test environment |

---

## Kubernetes Deployment

### Step 1: Prepare Kubernetes Cluster

```bash
# Verify cluster access
kubectl cluster-info

# Check node capacity
kubectl top nodes

# Verify storage class
kubectl get storageclass
```

### Step 2: Create Namespace

```bash
kubectl create namespace openclaw
```

### Step 3: Create Secrets

```bash
kubectl create secret generic openclaw-secrets \
  --namespace openclaw \
  --from-literal=database-url="postgresql://heretek:password@postgres:5432/heretek" \
  --from-literal=redis-url="redis://:password@redis:6379/0" \
  --from-literal=litellm-master-key="sk-your-master-key" \
  --from-literal=gateway-url="ws://gateway:18789"
```

### Step 4: Deploy Using Helm

```bash
cd /root/heretek/heretek-openclaw-deploy/helm/openclaw

# Review values
cat values.yaml

# Install
helm install openclaw . \
  --namespace openclaw \
  --create-namespace \
  --values values.yaml

# Check deployment status
helm status openclaw -n openclaw
```

### Step 5: Deploy Using Kustomize

```bash
cd /root/heretek/heretek-openclaw-deploy

# For development
kubectl apply -k terraform/kubernetes/overlays/dev

# For staging
kubectl apply -k terraform/kubernetes/overlays/staging

# For production
kubectl apply -k terraform/kubernetes/overlays/prod
```

### Step 6: Verify Kubernetes Deployment

```bash
# Check pods
kubectl get pods -n openclaw

# Check services
kubectl get svc -n openclaw

# Check logs
kubectl logs -n openclaw -l app.kubernetes.io/name=gateway --tail 50

# Port forward for local access
kubectl port-forward -n openclaw svc/gateway 18789:18789
```

### Kubernetes Resources

| Resource | Location |
|----------|----------|
| Helm Chart | [`heretek-openclaw-deploy/helm/openclaw/`](../heretek-openclaw-deploy/helm/openclaw/) |
| Kustomize Base | [`heretek-openclaw-deploy/terraform/kubernetes/base/`](../heretek-openclaw-deploy/terraform/kubernetes/base/) |
| Kustomize Overlays | [`heretek-openclaw-deploy/terraform/kubernetes/overlays/`](../heretek-openclaw-deploy/terraform/kubernetes/overlays/) |

---

## Bare Metal Deployment

### Step 1: Install Prerequisites

```bash
# Install Node.js 20+
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# Install PostgreSQL 15+ with pgvector
apt-get install -y postgresql postgresql-contrib
apt-get install -y postgresql-15-pgvector

# Install Redis 7+
apt-get install -y redis-server

# Install system dependencies
apt-get install -y build-essential git
```

### Step 2: Configure PostgreSQL

```bash
# Start PostgreSQL
systemctl start postgresql
systemctl enable postgresql

# Create database and user
sudo -u postgres psql << 'EOF'
CREATE DATABASE heretek;
CREATE USER heretek WITH PASSWORD 'your-secure-password';
GRANT ALL PRIVILEGES ON DATABASE heretek TO heretek;
\c heretek
CREATE EXTENSION vector;
EOF
```

### Step 3: Configure Redis

```bash
# Edit Redis configuration
nano /etc/redis/redis.conf

# Set password and enable persistence
requirepass your-redis-password
appendonly yes

# Restart Redis
systemctl restart redis
systemctl enable redis
```

### Step 4: Install OpenClaw

```bash
cd /root
git clone https://github.com/heretek/heretek-openclaw-core.git
cd heretek-openclaw-core

# Install dependencies
npm install

# Apply patches
npm run patch:apply
```

### Step 5: Configure Environment

```bash
# Copy and edit environment file
cp .env.example .env
nano .env

# Set paths for bare metal:
# POSTGRES_HOST=localhost
# REDIS_HOST=localhost
# GATEWAY_URL=ws://localhost:18789
```

### Step 6: Start Services

```bash
# Start LiteLLM (if using Docker for LiteLLM only)
docker compose up -d litellm

# Or install LiteLLM natively
pip install litellm
litellm --config /path/to/litellm-config.yaml

# Start Gateway
npm run gateway:start

# In separate terminals, start agents
for agent in steward alpha beta charlie examiner explorer sentinel coder dreamer empath historian; do
    AGENT_NAME=$agent npm run agent:start &
done
```

### Step 7: Configure Systemd Services (Optional)

```bash
# Create Gateway service
cat > /etc/systemd/system/openclaw-gateway.service << 'EOF'
[Unit]
Description=Heretek OpenClaw Gateway
After=network.target postgresql.service redis.service

[Service]
Type=simple
User=root
WorkingDirectory=/root/heretek-openclaw-core
ExecStart=/usr/bin/npm run gateway:start
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Enable and start
systemctl daemon-reload
systemctl enable openclaw-gateway
systemctl start openclaw-gateway
```

---

## Post-Deployment Validation

### Validation Checklist

- [ ] All services are running
- [ ] Gateway health endpoint responds
- [ ] All 11 agents are online
- [ ] Database connection successful
- [ ] Redis connection successful
- [ ] LiteLLM proxy accessible
- [ ] A2A communication working
- [ ] Agent heartbeats regular

### Validation Commands

```bash
# 1. Gateway health
curl -f http://localhost:18789/health

# 2. Agent status
curl -s http://localhost:18789/agent-status | jq '{total: .totalAgents, online: .onlineCount, offline: .offlineCount}'

# Expected: total=11, online=11, offline=0

# 3. LiteLLM health
curl -H "Authorization: Bearer $LITELLM_MASTER_KEY" http://localhost:4000/health

# 4. Database connection
docker compose exec postgres psql -U heretek -d heretek -c "SELECT version();"

# 5. Redis connection
docker compose exec redis redis-cli ping

# 6. A2A registry
curl -H "Authorization: Bearer $LITELLM_MASTER_KEY" http://localhost:4000/v1/agents | jq '.data | length'

# Expected: 11 agents registered
```

---

## Troubleshooting

### Common Issues

| Issue | Solution |
|-------|----------|
| Gateway won't start | Check port 18789 not in use, verify PostgreSQL/Redis connectivity |
| Agents offline | Verify Gateway is running, check agent logs for connection errors |
| Database errors | Ensure pgvector extension is installed, check connection string |
| LiteLLM errors | Verify master key, check model configuration |

### Log Locations

| Component | Log Location |
|-----------|--------------|
| Gateway | `docker logs heretek-gateway` or `/root/.openclaw/logs/gateway.log` |
| Agents | `docker logs heretek-{agent}` or `/root/.openclaw/logs/agents/{agent}.log` |
| PostgreSQL | `docker logs heretek-postgres` or `/var/log/postgresql/` |
| Redis | `docker logs heretek-redis` or `/var/log/redis/` |
| LiteLLM | `docker logs heretek-litellm` |

---

## Reference

| Document | Purpose |
|----------|---------|
| [`heretek-openclaw-deploy/docs/deployment/KUBERNETES_DEPLOYMENT.md`](../heretek-openclaw-deploy/docs/deployment/KUBERNETES_DEPLOYMENT.md) | Detailed K8s guide |
| [`heretek-openclaw-deploy/docs/deployment/BARE_METAL_DEPLOYMENT.md`](../heretek-openclaw-deploy/docs/deployment/BARE_METAL_DEPLOYMENT.md) | Detailed bare metal guide |
| [`HERETEK_README.md`](./HERETEK_README.md) | Quick start guide |
| [`MIGRATION_FROM_UPSTREAM.md`](./MIGRATION_FROM_UPSTREAM.md) | Migration from upstream |

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-04-01 | Initial version |
