# Heretek OpenClaw - Helm Chart Troubleshooting Guide

This guide provides solutions for common issues when deploying and running Heretek OpenClaw on Kubernetes.

## Table of Contents

1. [Deployment Issues](#deployment-issues)
2. [Gateway Issues](#gateway-issues)
3. [LiteLLM Issues](#litellm-issues)
4. [Database Issues](#database-issues)
5. [Redis Issues](#redis-issues)
6. [Neo4j Issues](#neo4j-issues)
7. [Langfuse Issues](#langfuse-issues)
8. [Ollama/GPU Issues](#ollamagpu-issues)
9. [Network Policy Issues](#network-policy-issues)
10. [Performance Issues](#performance-issues)

---

## Deployment Issues

### Pod Stuck in Pending State

**Symptoms:**
```bash
kubectl get pods -n openclaw
# NAME                          READY   STATUS    RESTARTS   AGE
# openclaw-gateway-xxxxx        0/1     Pending   0          5m
```

**Causes:**
- Insufficient cluster resources (CPU/memory)
- No available nodes matching node selectors
- PVC not bound

**Solutions:**

1. Check cluster resources:
```bash
kubectl describe nodes | grep -A 5 "Allocated resources"
kubectl top nodes
```

2. Check for scheduling issues:
```bash
kubectl describe pod openclaw-gateway-xxxxx -n openclaw
# Look for "Events" section at the bottom
```

3. Check PVC status:
```bash
kubectl get pvc -n openclaw
kubectl describe pvc <pvc-name> -n openclaw
```

4. Reduce resource requests if needed:
```bash
helm upgrade openclaw ./charts/openclaw -n openclaw \
  --set gateway.resources.requests.cpu=500m \
  --set gateway.resources.requests.memory=1Gi
```

### ImagePullBackOff Error

**Symptoms:**
```bash
kubectl get pods -n openclaw
# NAME                          READY   STATUS             RESTARTS   AGE
# openclaw-gateway-xxxxx        0/1     ImagePullBackOff   0          2m
```

**Solutions:**

1. Check image name and tag:
```bash
kubectl describe pod openclaw-gateway-xxxxx -n openclaw
# Look for the image name in "Containers" section
```

2. Verify image exists:
```bash
docker pull heretek/openclaw-gateway:2026.3.28
```

3. Check image pull secrets:
```bash
kubectl get secrets -n openclaw
kubectl describe secret <secret-name> -n openclaw
```

4. Create image pull secret if needed:
```bash
kubectl create secret docker-registry regcred \
  --docker-server=<registry> \
  --docker-username=<user> \
  --docker-password=<password> \
  -n openclaw
```

### CrashLoopBackOff Error

**Symptoms:**
```bash
kubectl get pods -n openclaw
# NAME                          READY   STATUS             RESTARTS   AGE
# openclaw-gateway-xxxxx        0/1     CrashLoopBackOff   5          10m
```

**Solutions:**

1. Check logs for errors:
```bash
kubectl logs openclaw-gateway-xxxxx -n openclaw --previous
```

2. Check environment variables:
```bash
kubectl describe pod openclaw-gateway-xxxxx -n openclaw
# Look for "Environment" section
```

3. Verify secrets exist:
```bash
kubectl get secrets -n openclaw
```

4. Check liveness probe configuration:
```bash
kubectl describe pod openclaw-gateway-xxxxx -n openclaw
# Look for "Liveness" probe settings
```

---

## Gateway Issues

### Gateway Not Responding

**Symptoms:**
- Health check endpoint returns 503
- Cannot connect to port 18789

**Solutions:**

1. Check gateway pod status:
```bash
kubectl get pods -l app.kubernetes.io/component=gateway -n openclaw
```

2. Check gateway logs:
```bash
kubectl logs -l app.kubernetes.io/component=gateway -n openclaw
```

3. Test health endpoint:
```bash
kubectl port-forward svc/openclaw-gateway 18789:18789 -n openclaw
curl http://localhost:18789/health
```

4. Check service endpoints:
```bash
kubectl get endpoints openclaw-gateway -n openclaw
kubectl describe svc openclaw-gateway -n openclaw
```

5. Verify LiteLLM connection:
```bash
kubectl exec -it <gateway-pod> -n openclaw -- curl http://openclaw-litellm:4000/health
```

### Agent Workspaces Not Initializing

**Symptoms:**
- Agents not appearing in Gateway
- Workspace directories empty

**Solutions:**

1. Check workspace volume:
```bash
kubectl exec -it <gateway-pod> -n openclaw -- ls -la /root/.openclaw/agents/
```

2. Verify agent configurations exist:
```bash
kubectl exec -it <gateway-pod> -n openclaw -- cat /root/.openclaw/agents/steward/AGENTS.md
```

3. Check Gateway configuration:
```bash
kubectl exec -it <gateway-pod> -n openclaw -- cat /root/.openclaw/openclaw.json
```

---

## LiteLLM Issues

### LiteLLM Not Starting

**Symptoms:**
- LiteLLM pod in CrashLoopBackOff
- Connection refused on port 4000

**Solutions:**

1. Check LiteLLM logs:
```bash
kubectl logs -l app.kubernetes.io/component=litellm -n openclaw
```

2. Verify database connection:
```bash
kubectl exec -it <litellm-pod> -n openclaw -- \
  python3 -c "import psycopg2; psycopg2.connect('postgresql://heretek:password@openclaw-postgresql:5432/heretek')"
```

3. Check Redis connection:
```bash
kubectl exec -it <litellm-pod> -n openclaw -- redis-cli -h openclaw-redis ping
```

4. Verify ConfigMap:
```bash
kubectl get configmap openclaw-litellm-config -n openclaw -o yaml
```

5. Check master key configuration:
```bash
kubectl get secret openclaw-secrets -n openclaw -o jsonpath='{.data.litellm-master-key}' | base64 -d
```

### Model Routing Issues

**Symptoms:**
- Requests not routing to correct providers
- Fallback not working

**Solutions:**

1. Check model configuration:
```bash
kubectl exec -it <litellm-pod> -n openclaw -- cat /app/config.yaml
```

2. Verify provider API keys:
```bash
kubectl get secret openclaw-secrets -n openclaw -o jsonpath='{.data.minimax-api-key}' | base64 -d
kubectl get secret openclaw-secrets -n openclaw -o jsonpath='{.data.zai-api-key}' | base64 -d
```

3. Test model endpoint:
```bash
curl -X POST http://localhost:4000/chat/completions \
  -H "Authorization: Bearer <master-key>" \
  -H "Content-Type: application/json" \
  -d '{"model": "minimax-main", "messages": [{"role": "user", "content": "test"}]}'
```

---

## Database Issues

### PostgreSQL Not Starting

**Symptoms:**
- PostgreSQL pod in CrashLoopBackOff
- Connection refused on port 5432

**Solutions:**

1. Check PostgreSQL logs:
```bash
kubectl logs -l app.kubernetes.io/component=postgresql -n openclaw
```

2. Verify password secret:
```bash
kubectl get secret openclaw-secrets -n openclaw -o jsonpath='{.data.postgres-password}' | base64 -d
```

3. Check PVC status:
```bash
kubectl get pvc -l app.kubernetes.io/component=postgresql -n openclaw
kubectl describe pvc <pvc-name> -n openclaw
```

4. Test database connection:
```bash
kubectl exec -it <postgresql-pod> -n openclaw -- \
  psql -U heretek -d heretek -c "SELECT 1"
```

5. Check pgvector extension:
```bash
kubectl exec -it <postgresql-pod> -n openclaw -- \
  psql -U heretek -d heretek -c "SELECT * FROM pg_extension WHERE extname = 'vector'"
```

### Database Corruption

**Symptoms:**
- Connection errors
- Query failures
- Missing tables

**Solutions:**

1. Check database integrity:
```bash
kubectl exec -it <postgresql-pod> -n openclaw -- \
  psql -U heretek -d heretek -c "SELECT pg_catalog.pg_database_size('heretek')"
```

2. Restore from backup (if available):
```bash
# See docs/operations/runbook-backup-restoration.md
```

3. Reinitialize database (last resort):
```bash
kubectl delete pvc -l app.kubernetes.io/component=postgresql -n openclaw
helm upgrade openclaw ./charts/openclaw -n openclaw --force
```

---

## Redis Issues

### Redis Not Starting

**Symptoms:**
- Redis pod in CrashLoopBackOff
- Connection refused on port 6379

**Solutions:**

1. Check Redis logs:
```bash
kubectl logs -l app.kubernetes.io/component=redis -n openclaw
```

2. Test Redis connection:
```bash
kubectl exec -it <redis-pod> -n openclaw -- redis-cli ping
```

3. Check memory limits:
```bash
kubectl describe pod <redis-pod> -n openclaw
# Look for OOMKilled in "Last State"
```

4. Verify persistence:
```bash
kubectl exec -it <redis-pod> -n openclaw -- ls -la /data/
```

---

## Neo4j Issues

### Neo4j Not Starting

**Symptoms:**
- Neo4j pod in CrashLoopBackOff
- Cannot connect on port 7687

**Solutions:**

1. Check Neo4j logs:
```bash
kubectl logs -l app.kubernetes.io/component=neo4j -n openclaw
```

2. Verify password:
```bash
kubectl get secret openclaw-secrets -n openclaw -o jsonpath='{.data.neo4j-password}' | base64 -d
```

3. Check Neo4j health:
```bash
kubectl port-forward svc/openclaw-neo4j 7474:7474 -n openclaw
curl http://localhost:7474/health
```

4. Test Bolt connection:
```bash
kubectl exec -it <neo4j-pod> -n openclaw -- \
  cypher-shell -u neo4j -p <password> "RETURN 1"
```

5. Verify APOC plugin:
```bash
kubectl exec -it <neo4j-pod> -n openclaw -- \
  cypher-shell -u neo4j -p <password> "CALL apoc.help('')"
```

---

## Langfuse Issues

### Langfuse Not Starting

**Symptoms:**
- Langfuse pod in CrashLoopBackOff
- Dashboard not accessible

**Solutions:**

1. Check Langfuse logs:
```bash
kubectl logs -l app.kubernetes.io/component=langfuse -n openclaw
```

2. Verify Langfuse PostgreSQL:
```bash
kubectl logs -l app.kubernetes.io/component=langfuse-postgres -n openclaw
```

3. Check Langfuse secrets:
```bash
kubectl get secret openclaw-langfuse-secret -n openclaw
```

4. Test Langfuse health:
```bash
kubectl port-forward svc/openclaw-langfuse 3000:3000 -n openclaw
curl http://localhost:3000/api/health
```

5. Access dashboard:
```bash
# Default credentials are set on first run
# Check secrets for initial password
kubectl get secret openclaw-langfuse-secret -n openclaw -o jsonpath='{.data}'
```

---

## Ollama/GPU Issues

### Ollama Not Starting

**Symptoms:**
- Ollama pod in CrashLoopBackOff
- GPU not detected

**Solutions:**

1. Check Ollama logs:
```bash
kubectl logs -l app.kubernetes.io/component=ollama -n openclaw
```

2. Verify GPU resources:
```bash
kubectl describe node <node-name> | grep -A 5 "Allocatable"
```

3. Check NVIDIA runtime (for NVIDIA GPUs):
```bash
kubectl describe pod <ollama-pod> -n openclaw
# Look for runtimeClassName: nvidia
```

4. Check AMD ROCm devices (for AMD GPUs):
```bash
kubectl exec -it <ollama-pod> -n openclaw -- ls -la /dev/kfd /dev/dri
```

5. Test Ollama:
```bash
kubectl port-forward svc/openclaw-ollama 11434:11434 -n openclaw
curl http://localhost:11434/api/tags
```

6. Pull models manually if needed:
```bash
kubectl exec -it <ollama-pod> -n openclaw -- \
  ollama pull nomic-embed-text-v2-moe
```

---

## Network Policy Issues

### Components Cannot Communicate

**Symptoms:**
- Gateway cannot reach LiteLLM
- Connection timeouts between services

**Solutions:**

1. Check network policy status:
```bash
kubectl get networkpolicies -n openclaw
```

2. Verify network policy rules:
```bash
kubectl describe networkpolicy openclaw-gateway-policy -n openclaw
```

3. Test connectivity:
```bash
kubectl exec -it <gateway-pod> -n openclaw -- \
  curl -v http://openclaw-litellm:4000/health
```

4. Temporarily disable network policies for debugging:
```bash
helm upgrade openclaw ./charts/openclaw -n openclaw \
  --set networkPolicy.enabled=false
```

5. Check CNI plugin:
```bash
kubectl get pods -n kube-system -l k8s-app=calico-node
# or for other CNI plugins
```

---

## Performance Issues

### High Latency

**Symptoms:**
- Slow agent responses
- High request latency

**Solutions:**

1. Check resource utilization:
```bash
kubectl top pods -n openclaw
kubectl top nodes
```

2. Check HPA status:
```bash
kubectl get hpa -n openclaw
kubectl describe hpa openclaw-gateway -n openclaw
```

3. Scale up manually:
```bash
kubectl scale deployment openclaw-gateway --replicas=5 -n openclaw
kubectl scale deployment openclaw-litellm --replicas=3 -n openclaw
```

4. Check database performance:
```bash
kubectl exec -it <postgresql-pod> -n openclaw -- \
  psql -U heretek -d heretek -c "SELECT pg_stat_activity;"
```

5. Check Redis memory:
```bash
kubectl exec -it <redis-pod> -n openclaw -- redis-cli info memory
```

### OOMKilled Errors

**Symptoms:**
- Pods restarting due to memory limits
- OOMKilled in pod status

**Solutions:**

1. Increase memory limits:
```bash
helm upgrade openclaw ./charts/openclaw -n openclaw \
  --set gateway.resources.limits.memory=16Gi \
  --set gateway.resources.requests.memory=8Gi
```

2. Check memory usage patterns:
```bash
kubectl top pods -n openclaw
```

3. Enable memory profiling (if available):
```bash
kubectl exec -it <gateway-pod> -n openclaw -- \
  curl http://localhost:18789/debug/pprof/heap > heap.prof
```

---

## Emergency Procedures

### Full Cluster Restart

If all else fails:

```bash
# 1. Export current configuration
helm get values openclaw -n openclaw > backup-values.yaml

# 2. Uninstall chart
helm uninstall openclaw -n openclaw

# 3. Delete PVCs (WARNING: Data loss!)
kubectl delete pvc -n openclaw -l app.kubernetes.io/instance=openclaw

# 4. Reinstall
helm install openclaw ./charts/openclaw -n openclaw --create-namespace -f backup-values.yaml
```

### Backup and Restore

See [`docs/operations/runbook-backup-restoration.md`](../../docs/operations/runbook-backup-restoration.md) for detailed backup and restore procedures.

---

## Getting Help

If you cannot resolve the issue:

1. Check the [GitHub Issues](https://github.com/heretek-ai/heretek-openclaw/issues)
2. Review the [Architecture Documentation](../../docs/ARCHITECTURE.md)
3. Check the [Operations Guide](../../docs/OPERATIONS.md)
4. Contact support at support@heretek.ai
