---
name: governance-modules
description: Core governance modules for collective decision-making including inviolable parameters, consensus schemas, and vote validation. Use when setting up a new collective or enforcing governance constraints.
---

# Governance Modules — Collective Decision-Making Framework

**Purpose:** Core governance modules for collective decision-making with inviolable safety parameters.

**Status:** ✅ Implemented (2026-03-28)

**Protocol:** LiteLLM A2A (Agent-to-Agent)

---

## Configuration

```bash
# LiteLLM A2A Configuration
LITELLM_HOST="${LITELLM_HOST:-http://localhost:4000}"
LITELLM_API_KEY="${LITELLM_API_KEY:-}"
CONSENSUS_THRESHOLD=0.66
TRIAD_NODES='{"alpha": {}, "beta": {}, "charlie": {}}'
```

---

## Inviolable Parameters

These parameters **CANNOT** be changed by any operator, proposal, or override. They are load-bearing safety architecture.

### Consensus Threshold

```json
{
  "parameter": "triad.consensus.threshold",
  "value": "2/3",
  "description": "Minimum 2 of 3 triad nodes required for ratification",
  "violation": "Any collective decision without 2/3 triad consensus is void",
  "override_possible": false
}
```

### Credential Policy

```json
{
  "parameter": "security.credential.vault_first",
  "value": true,
  "description": "All credentials must be stored in vault before use",
  "violation": "Credentials exposed in group chat require mandatory rotation",
  "override_possible": false
}
```

```json
{
  "parameter": "security.credential.no_group_chat",
  "value": true,
  "description": "Credentials must never be posted to group chat channels",
  "violation": "Accidental exposure requires immediate rotation and incident log",
  "override_possible": false
}
```

### Advocate Voice Rules

```json
{
  "parameter": "deliberation.advocate.one_voice_per_round",
  "value": true,
  "description": "Advocate speaks once per deliberation round, not continuously",
  "violation": "Multiple advocate messages in same round are signal noise",
  "override_possible": false
}
```

```json
{
  "parameter": "deliberation.advocate.advisory_only",
  "value": true,
  "description": "Advocate has no veto power and cannot block ratification",
  "violation": "Advocate objection does not prevent 2/3 triad ratification",
  "override_possible": false
}
```

### Advisory Agent Constraints

```json
{
  "parameter": "agents.advisory.oracle.no_veto",
  "value": true,
  "description": "Oracle can raise concerns but cannot veto decisions",
  "override_possible": false
}
```

```json
{
  "parameter": "agents.advisory.examiner.no_veto",
  "value": true,
  "description": "Examiner can challenge decisions but cannot veto ratification",
  "override_possible": false
}
```

```json
{
  "parameter": "agents.advisory.sentinel.no_executive_power",
  "value": true,
  "description": "Sentinel reviews safety but cannot execute decisions independently",
  "override_possible": false
}
```

### Deliberation Phases

```json
{
  "parameter": "deliberation.phases.required",
  "value": ["signal", "build", "ratify"],
  "description": "All ratified decisions must pass through Signal → Build → Ratify phases",
  "violation": "Decisions bypassing deliberation phases are void",
  "override_possible": false
}
```

---

## Consensus Schema

### Decision Record Schema

```json
{
  "$schema": "https://heretek.ai/schemas/consensus.schema.json",
  "title": "Consensus Decision Record",
  "description": "Schema for ratified consensus decisions",
  "type": "object",
  "required": ["proposal_id", "title", "status", "votes", "timestamp", "inviolable"],
  "properties": {
    "proposal_id": {
      "type": "string",
      "pattern": "^PROPOSAL-[a-zA-Z0-9_-]+$",
      "description": "Unique proposal identifier"
    },
    "title": {
      "type": "string",
      "maxLength": 200
    },
    "status": {
      "type": "string",
      "enum": ["ratified", "rejected", "withdrawn", "pending"],
      "description": "Current status of the proposal"
    },
    "votes": {
      "type": "object",
      "required": ["alpha", "beta", "charlie"],
      "properties": {
        "alpha": {
          "type": "string",
          "enum": ["YES", "NO", "SUPPORT", "ABSTAIN", null],
          "description": "Alpha's vote (null if not yet voted)"
        },
        "beta": {
          "type": "string",
          "enum": ["YES", "NO", "SUPPORT", "ABSTAIN", null]
        },
        "charlie": {
          "type": "string",
          "enum": ["YES", "NO", "SUPPORT", "ABSTAIN", null]
        }
      }
    },
    "consensus": {
      "type": "object",
      "properties": {
        "threshold": {
          "type": "string",
          "const": "2/3",
          "description": "Required threshold — cannot be changed"
        },
        "yes_count": {
          "type": "integer",
          "minimum": 0,
          "maximum": 3
        },
        "reached": {
          "type": "boolean"
        }
      }
    },
    "timestamp": {
      "type": "string",
      "format": "date-time"
    },
    "author": {
      "type": "string",
      "description": "Agent or user who authored the proposal"
    },
    "inviolable": {
      "type": "object",
      "description": "Record of inviolable parameters relevant to this decision",
      "properties": {
        "credential_policy": { "type": "boolean" },
        "advocate_voice_rules": { "type": "boolean" },
        "advisory_agent_constraints": { "type": "boolean" }
      }
    },
    "sentinel_review": {
      "type": "object",
      "properties": {
        "cleared": { "type": "boolean" },
        "concerns": {
          "type": "array",
          "items": { "type": "string" }
        }
      }
    }
  }
}
```

---

## Validation Script

### validate-vote.sh

```bash
#!/bin/bash
# Validate vote against 2/3 threshold
# Usage: ./validate-vote.sh <proposal-id> <alpha-vote> <beta-vote> <charlie-vote>

PROPOSAL="$1"
ALPHA_VOTE="$2"
BETA_VOTE="$3"
CHARLIE_VOTE="$4"

# Count YES votes
YES_COUNT=0
for vote in "$ALPHA_VOTE" "$BETA_VOTE" "$CHARLIE_VOTE"; do
    if [[ "$vote" == "YES" ]]; then
        ((YES_COUNT++))
    fi
done

# Check 2/3 threshold (minimum 2 of 3)
if [[ $YES_COUNT -ge 2 ]]; then
    echo "VALIDATED: $PROPOSAL ratified with $YES_COUNT/3 YES votes"
    exit 0
else
    echo "REJECTED: $PROPOSAL failed with $YES_COUNT/3 YES votes"
    exit 1
fi
```

---

## Enforcement

These parameters are enforced at multiple levels:

1. **Schema level:** Proposal templates include validation for required fields
2. **Script level:** `validate-vote.sh` checks 2/3 threshold before recording
3. **Social level:** The collective's charter references these as inviolable
4. **Technical level:** Gateway config can be set to reject violations

---

## Adding New Inviolable Parameters

New inviolable parameters require:

1. A real incident or near-miss that demonstrates the parameter is load-bearing
2. 3/3 unanimous triad ratification (not just 2/3)
3. Steward authorization
4. Written rationale explaining why it cannot be overridden

**Do not add inviolable parameters casually.** They represent lessons paid for in real incidents.

---

**Governance enforced. Safety preserved.** 🦞