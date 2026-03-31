# Heretek OpenClaw Helm Chart

This Helm chart deploys the Heretek OpenClaw autonomous AI agent collective on Kubernetes.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    Heretek OpenClaw on Kubernetes                        │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                     Core Services                                │    │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │    │
│  │  │   LiteLLM   │  │ PostgreSQL  │  │    Redis    │              │    │
│  │  │   Gateway   │  │  +pgvector  │  │   Cache     │              │    │
│  │  └─────────────┘  └─────────────┘  └─────────────┘              │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │              OpenClaw Gateway (Port 18789)                       │    │
│  │  All 11 agents run as workspaces within Gateway process          │    │
│  │  Agents: steward, alpha, beta, charlie, examiner, explorer,      │    │
│  │          sentinel, coder, dreamer, empath, historian             │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │              Observability & Supporting Services                 │    │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │    │
│  │  │  Langfuse   │  │    Neo4j    │  │   Ollama    │              │    │
│  │  │   (Optional)│  │  GraphRAG   │  │  (Optional) │              │    │
│  │  └─────────────┘  └─────────────┘  └─────────────┘              │    │
│  └─────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────┘
```

## Prerequisites

- Kubernetes 1.25+
- Helm 3.10+
- PV provisioner support in the underlying infrastructure
- (Optional) NVIDIA GPU or AMD ROCm for Ollama GPU acceleration

## Installation

### Add the Helm Chart Repository

```bash
helm repo add heretek https://heretek.ai/helm-charts
helm repo update
```

### Install the Chart

```bash
# Install with default values
helm install openclaw ./charts/openclaw --namespace openclaw --create-namespace

# Install with custom values file
helm install openclaw ./charts/openclaw --namespace openclaw --create-namespace -f values.yaml

# Install with production settings
helm install openclaw ./charts/openclaw --namespace openclaw --create-namespace \
  --set global.environment=production \
  --set gateway.autoscaling.enabled=true \
  --set gateway.replicaCount=3
```

## Configuration

The following table lists the configurable parameters of the OpenClaw chart and their default values.

### Global Parameters

| Parameter | Description | Default |
|-----------|-------------|---------|
| `global.environment` | Deployment environment | `development` |
| `global.labels` | Common labels applied to all resources | `{}` |

### Gateway Parameters

| Parameter | Description | Default |
|-----------|-------------|---------|
| `gateway.replicaCount` | Number of gateway replicas | `1` |
| `gateway.image.repository` | Gateway image repository | `heretek/openclaw-gateway` |
| `gateway.image.tag` | Gateway image tag | `2026.3.28` |
| `gateway.resources.limits.cpu` | CPU limit | `4000m` |
| `gateway.resources.limits.memory` | Memory limit | `8Gi` |
| `gateway.autoscaling.enabled` | Enable autoscaling | `false` |
| `gateway.autoscaling.minReplicas` | Minimum replicas | `1` |
| `gateway.autoscaling.maxReplicas` | Maximum replicas | `5` |
| `gateway.service.type` | Service type | `ClusterIP` |
| `gateway.service.port` | Service port | `18789` |

### LiteLLM Parameters

| Parameter | Description | Default |
|-----------|-------------|---------|
| `litellm.enabled` | Enable LiteLLM Gateway | `true` |
| `litellm.replicaCount` | Number of LiteLLM replicas | `1` |
| `litellm.image.repository` | LiteLLM image repository | `ghcr.io/berriai/litellm` |
| `litellm.image.tag` | LiteLLM image tag | `main-latest` |

### PostgreSQL Parameters

| Parameter | Description | Default |
|-----------|-------------|---------|
| `postgresql.enabled` | Enable PostgreSQL | `true` |
| `postgresql.replicaCount` | Number of PostgreSQL replicas | `1` |
| `postgresql.persistence.enabled` | Enable persistence | `true` |
| `postgresql.persistence.size` | PVC size | `50Gi` |

### Redis Parameters

| Parameter | Description | Default |
|-----------|-------------|---------|
| `redis.enabled` | Enable Redis | `true` |
| `redis.replicaCount` | Number of Redis replicas | `1` |
| `redis.persistence.enabled` | Enable persistence | `true` |
| `redis.persistence.size` | PVC size | `10Gi` |

### Neo4j Parameters

| Parameter | Description | Default |
|-----------|-------------|---------|
| `neo4j.enabled` | Enable Neo4j | `true` |
| `neo4j.persistence.enabled` | Enable persistence | `true` |
| `neo4j.persistence.size` | PVC size | `20Gi` |

### Langfuse Parameters

| Parameter | Description | Default |
|-----------|-------------|---------|
| `langfuse.enabled` | Enable Langfuse | `true` |
| `langfuse.replicaCount` | Number of Langfuse replicas | `1` |
| `langfuse.ingress.enabled` | Enable ingress for Langfuse | `false` |

### Ollama Parameters

| Parameter | Description | Default |
|-----------|-------------|---------|
| `ollama.enabled` | Enable Ollama | `false` |
| `ollama.gpu.enabled` | Enable GPU acceleration | `false` |
| `ollama.gpu.type` | GPU type (nvidia/amd) | `amd` |

### Network Policy Parameters

| Parameter | Description | Default |
|-----------|-------------|---------|
| `networkPolicy.enabled` | Enable network policies | `true` |
| `networkPolicy.defaultPolicy` | Default policy (Allow/Deny) | `Deny` |

## Deployment Modes

### Development

```bash
helm install openclaw ./charts/openclaw --namespace openclaw --create-namespace \
  --set global.environment=development \
  --set gateway.resources.requests.cpu=500m \
  --set gateway.resources.requests.memory=1Gi
```

### Production

```bash
helm install openclaw ./charts/openclaw --namespace openclaw --create-namespace \
  --set global.environment=production \
  --set gateway.replicaCount=3 \
  --set gateway.autoscaling.enabled=true \
  --set gateway.autoscaling.minReplicas=3 \
  --set gateway.autoscaling.maxReplicas=10 \
  --set postgresql.persistence.size=100Gi
```

## Secrets Management

### Using Kubernetes Secrets (Default)

```bash
# Create secrets before installation
kubectl create secret generic openclaw-secrets \
  --namespace openclaw \
  --from-literal=litellm-master-key=your-master-key \
  --from-literal=postgres-password=your-postgres-password \
  --from-literal=minimax-api-key=your-minimax-key \
  --from-literal=zai-api-key=your-zai-key
```

### Using External Secrets (Vault, AWS Secrets Manager, etc.)

```bash
helm install openclaw ./charts/openclaw --namespace openclaw --create-namespace \
  --set externalSecrets.enabled=true \
  --set externalSecrets.store=vault
```

## Accessing the Services

### OpenClaw Gateway

```bash
# Port forward to access the gateway
kubectl port-forward svc/openclaw-gateway 18789:18789 -n openclaw

# Access at http://127.0.0.1:18789
```

### LiteLLM Gateway

```bash
# Port forward to access LiteLLM
kubectl port-forward svc/openclaw-litellm 4000:4000 -n openclaw

# Access at http://127.0.0.1:4000
```

### Langfuse Dashboard

```bash
# Port forward to access Langfuse
kubectl port-forward svc/openclaw-langfuse 3000:3000 -n openclaw

# Access at http://127.0.0.1:3000
```

## Monitoring

### Prometheus Metrics

Enable ServiceMonitor for Prometheus integration:

```bash
helm install openclaw ./charts/openclaw --namespace openclaw --create-namespace \
  --set monitoring.enabled=true \
  --set monitoring.serviceMonitor.enabled=true
```

### Health Checks

All services include liveness and readiness probes:

- Gateway: `/health` on port 18789
- LiteLLM: `/health/liveliness` and `/health/readiness` on port 4000
- PostgreSQL: `pg_isready` command
- Redis: `redis-cli ping`
- Neo4j: `/health` on port 7474
- Langfuse: `/api/health` on port 3000

## Scaling

### Manual Scaling

```bash
# Scale gateway replicas
kubectl scale deployment openclaw-gateway --replicas=5 -n openclaw

# Scale LiteLLM replicas
kubectl scale deployment openclaw-litellm --replicas=3 -n openclaw
```

### Automatic Scaling (HPA)

Enable autoscaling in values.yaml:

```yaml
gateway:
  autoscaling:
    enabled: true
    minReplicas: 2
    maxReplicas: 10
    targetCPUUtilizationPercentage: 80
    targetMemoryUtilizationPercentage: 80
```

## Security

### Network Policies

Network policies are enabled by default to isolate components:

```yaml
networkPolicy:
  enabled: true
  defaultPolicy: Deny
```

### Pod Security Context

All pods run as non-root with restricted capabilities:

```yaml
gateway:
  podSecurityContext:
    runAsNonRoot: true
    runAsUser: 1000
    fsGroup: 1000
  securityContext:
    allowPrivilegeEscalation: false
    readOnlyRootFilesystem: true
    capabilities:
      drop:
        - ALL
```

## Troubleshooting

### Check Pod Status

```bash
kubectl get pods -n openclaw
kubectl describe pod <pod-name> -n openclaw
```

### View Logs

```bash
# Gateway logs
kubectl logs -f deployment/openclaw-gateway -n openclaw

# LiteLLM logs
kubectl logs -f deployment/openclaw-litellm -n openclaw

# All component logs
kubectl logs -f -l app.kubernetes.io/instance=openclaw -n openclaw
```

### Common Issues

See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for detailed troubleshooting guides.

## Uninstall

```bash
# Uninstall the chart
helm uninstall openclaw -n openclaw

# Uninstall and remove PVCs
helm uninstall openclaw -n openclaw
kubectl delete pvc -n openclaw -l app.kubernetes.io/instance=openclaw
```

## Upgrade

```bash
# Upgrade with new values
helm upgrade openclaw ./charts/openclaw -n openclaw -f values.yaml

# Upgrade with specific values
helm upgrade openclaw ./charts/openclaw -n openclaw \
  --set gateway.replicaCount=5
```

## Rollback

```bash
# Rollback to previous revision
helm rollback openclaw -n openclaw

# Rollback to specific revision
helm rollback openclaw 1 -n openclaw
```

## License

MIT License - See [LICENSE](../../LICENSE) for details.
