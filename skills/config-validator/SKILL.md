---
name: config-validator
description: Validate all configuration files for consistency and completeness.
---

# Config Validator

Validates configuration files across the deployment.

## Usage

```bash
node skills/config-validator/validate.js
```

## Validations
1. docker-compose.yml has all 11 agents
2. litellm_config.yaml has all agent endpoints
3. Agent identity files exist for all agents
4. Port assignments are unique
5. Environment variables are complete
6. User schema is valid JSON

## Output
Returns JSON with validation results and any errors found.

## Exit Codes
- 0: All validations passed
- 1: One or more validations failed

## Example Output

```json
{
  "timestamp": "2024-01-15T10:30:00Z",
  "overall": "passed",
  "validations": {
    "docker_compose_agents": {
      "status": "passed",
      "details": "All 11 agents configured"
    },
    "litellm_endpoints": {
      "status": "passed",
      "details": "All agent endpoints present"
    },
    ...
  },
  "summary": {
    "total": 6,
    "passed": 6,
    "failed": 0
  }
}
```

## Files Validated
- `docker-compose.yml` - Docker service definitions
- `litellm_config.yaml` - LiteLLM gateway configuration
- `agents/*/IDENTITY.md` - Agent identity files
- `.env.example` - Environment variable template
- `users/_schema.json` - User schema definition
