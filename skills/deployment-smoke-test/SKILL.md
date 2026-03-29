---
name: deployment-smoke-test
description: Run basic functionality tests on deployed agents to verify A2A communication and basic operations.
---

# Deployment Smoke Test

Runs basic functionality tests on the deployment.

## Usage

```bash
node skills/deployment-smoke-test/test.js
```

## Tests
1. Send ping to each agent
2. Test A2A message between steward and alpha
3. Test triad deliberation trigger
4. Test user context resolution
5. Verify memory persistence

## Output
Returns JSON with test results and pass/fail status.

## Exit Codes
- 0: All tests passed
- 1: One or more tests failed

## Example Output

```json
{
  "timestamp": "2024-01-15T10:30:00Z",
  "overall": "passed",
  "tests": {
    "agent_ping": {
      "status": "passed",
      "details": {
        "steward": "responded",
        "alpha": "responded",
        ...
      }
    },
    "a2a_message": {
      "status": "passed",
      "details": "Message delivered from steward to alpha"
    },
    ...
  },
  "summary": {
    "total": 5,
    "passed": 5,
    "failed": 0
  }
}
```

## Prerequisites
- All agents must be running (ports 8001-8011)
- LiteLLM gateway must be operational (port 4000)
- Redis must be available for memory persistence tests
