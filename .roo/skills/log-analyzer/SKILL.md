---
name: log-analyzer
description: Intelligent log analysis for OpenClaw with pattern detection, cross-log correlation, timeline reconstruction, root cause suggestions, and error categorization. Use when troubleshooting failures, investigating incidents, analyzing error patterns, or reconstructing event sequences across agents.
---

# Log Analyzer

## When to use this skill

Use this skill when you need to:
- Analyze logs from multiple OpenClaw components
- Detect error patterns and anomalies
- Correlate events across agent logs
- Reconstruct timelines of incidents
- Get root cause suggestions for failures
- Categorize and prioritize errors
- Search for specific log patterns
- Generate log summaries for reports

## When NOT to use this skill

Do NOT use this skill when:
- You need real-time log streaming (use `gateway-pulse` monitoring)
- You need to modify log configurations
- You need to rotate or archive logs
- You need system-wide diagnostics (use `system-diagnostics` skill)
- You need to inspect agent memory state (use `state-inspector` skill)

## Inputs required

Before executing, determine:
1. **Scope**: which components to analyze (all, gateway, litellm, specific agents)
2. **Time range**: how far back to analyze (default: 1 hour)
3. **Pattern type**: specific error patterns to search for
4. **Output format**: console, JSON, or report file

## Workflow

### 1. Analyze all logs

```bash
# Full log analysis
./scripts/analyze-logs.sh analyze --all

# Analyze with time range
./scripts/analyze-logs.sh analyze --all --since "2h ago"

# Analyze specific component
./scripts/analyze-logs.sh analyze --component gateway
```

### 2. Pattern detection

```bash
# Detect common error patterns
./scripts/analyze-logs.sh patterns

# Search for specific pattern
./scripts/analyze-logs.sh patterns --search "connection refused"

# Detect anomalies
./scripts/analyze-logs.sh patterns --anomaly-detection
```

### 3. Cross-log correlation

```bash
# Correlate events across all logs
./scripts/analyze-logs.sh correlate

# Correlate specific time window
./scripts/analyze-logs.sh correlate --window "10m"

# Find related events
./scripts/analyze-logs.sh correlate --event "agent-offline"
```

### 4. Timeline reconstruction

```bash
# Build event timeline
./scripts/analyze-logs.sh timeline

# Timeline with specific events
./scripts/analyze-logs.sh timeline --filter errors

# Export timeline
./scripts/analyze-logs.sh timeline --output timeline.json
```

### 5. Root cause analysis

```bash
# Get root cause suggestions
./scripts/analyze-logs.sh root-cause

# Analyze specific incident
./scripts/analyze-logs.sh root-cause --incident "gateway-failure"
```

### 6. Error categorization

```bash
# Categorize all errors
./scripts/analyze-logs.sh categorize

# Get error summary
./scripts/analyze-logs.sh categorize --summary

# Export error report
./scripts/analyze-logs.sh categorize --report errors.json
```

## Error Categories

| Category | Description | Examples |
|----------|-------------|----------|
| Connection | Network/connectivity issues | WebSocket failures, timeouts |
| Authentication | Auth/permission errors | Invalid API key, expired token |
| Resource | System resource issues | Out of memory, disk full |
| Configuration | Config-related errors | Invalid JSON, missing field |
| Application | Logic/runtime errors | Null pointer, exception |
| External | Third-party service errors | Provider API failures |

## Pattern Detection

The skill detects these common patterns:

### Gateway Patterns
- `WebSocket connection failed` - Connection issues
- `Agent .* offline` - Agent connectivity loss
- `RPC timeout` - Message timeout
- `Rate limit exceeded` - Throttling

### LiteLLM Patterns
- `API key invalid` - Authentication failure
- `Model not found` - Model configuration issue
- `Rate limit` - Provider throttling
- `Timeout exceeded` - Slow response

### Agent Patterns
- `Failed to connect to gateway` - Agent startup issue
- `Memory limit exceeded` - Resource constraint
- `Consensus failed` - Triad deliberation issue
- `Skill execution failed` - Plugin error

## Files

- [`src/index.js`](src/index.js) - Main analysis orchestration
- [`src/pattern-detector.js`](src/pattern-detector.js) - Error pattern recognition
- [`src/log-correlator.js`](src/log-correlator.js) - Cross-log correlation
- [`src/timeline-builder.js`](src/timeline-builder.js) - Event timeline reconstruction
- [`scripts/analyze-logs.sh`](scripts/analyze-logs.sh) - CLI wrapper
- [`package.json`](package.json) - Node.js dependencies

## Examples

### Example 1: Quick error analysis

```bash
# Get error summary
./scripts/analyze-logs.sh categorize --summary
# Output: Found 47 errors (23 connection, 15 application, 9 configuration)
```

### Example 2: Investigate incident

```bash
# Reconstruct timeline for incident
./scripts/analyze-logs.sh timeline --since "30m ago" --filter errors
```

### Example 3: Find root cause

```bash
# Get root cause suggestions
./scripts/analyze-logs.sh root-cause
# Output: Likely root cause: Gateway WebSocket exhaustion (confidence: 87%)
```

## Troubleshooting

### No logs found

1. Verify log directory: `ls -la /var/log/openclaw`
2. Check Docker logs: `docker ps`
3. Specify custom log path: `./scripts/analyze-logs.sh analyze --log-dir /custom/path`

### Pattern detection misses errors

1. Increase time range: `--since "24h ago"`
2. Use custom pattern: `--pattern "your-regex"`
3. Check log format compatibility

### Correlation produces too many results

1. Narrow time window: `--window "5m"`
2. Filter by severity: `--severity error`
3. Focus on specific component: `--component gateway`

## Gateway Integration

This skill integrates with the OpenClaw Gateway WebSocket RPC on port 18789:

- Log queries can be sent via Gateway RPC
- Analysis results published to Gateway for dashboard display
- Real-time log streaming via Gateway WebSocket

## LiteLLM Integration

LiteLLM log analysis includes:

- Request/response pattern analysis
- Token usage correlation with errors
- Model-specific error tracking
- Provider failure detection

## Common Debugging Scenarios

### Agent offline detection and recovery

```bash
# Find when agent went offline
./scripts/analyze-logs.sh patterns --search "offline" --component agents

# Correlate with gateway events
./scripts/analyze-logs.sh correlate --event "agent-offline"
```

### LiteLLM gateway failure

```bash
# Analyze LiteLLM errors
./scripts/analyze-logs.sh analyze --component litellm --filter errors

# Find timeout patterns
./scripts/analyze-logs.sh patterns --search "timeout"
```

### Triad deliberation deadlock

```bash
# Search for deliberation errors
./scripts/analyze-logs.sh patterns --search "deliberation\|consensus\|deadlock"

# Build triad event timeline
./scripts/analyze-logs.sh timeline --component triad
```

### Database corruption

```bash
# Find database errors
./scripts/analyze-logs.sh patterns --search "database\|postgresql\|corruption"

# Correlate with application errors
./scripts/analyze-logs.sh correlate --component database
```
