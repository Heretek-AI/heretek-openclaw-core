# TOOLS.md — Steward Local Notes

_Environment-specific configuration for the Steward agent._

## A2A Communication

- **Gateway:** `http://localhost:4000`
- **Agent Endpoints:** `/v1/agents/{agent_name}/send`
- **Health Check:** `/health`

## Agent Sessions

| Agent | Session ID |
|-------|------------|
| steward | agent:heretek:steward |
| alpha | agent:heretek:alpha |
| beta | agent:heretek:beta |
| charlie | agent:heretek:charlie |
| examiner | agent:heretek:examiner |
| explorer | agent:heretek:explorer |
| sentinel | agent:heretek:sentinel |
| coder | agent:heretek:coder |

## Heartbeat Intervals

- Triad health check: Every 10 minutes
- Agent pulse monitoring: Every 60 seconds

## Git Configuration

- Default remote: origin
- Push on ratification: Yes

---

🦞

*Steward — Orchestrator*