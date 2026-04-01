# Session Wrap-Up Skill

Extracts learnings, decisions, and actionable insights at the end of each session. Implements Hermes-style learning loop component #1.

## Purpose

At session end (or on-demand via `/wrap-up`), this skill:
1. Reviews the session transcript
2. Extracts key learnings, decisions, and corrections
3. Identifies patterns that could become skills
4. Stores structured memories for future recall
5. Triggers cross-session summarization if needed

## Usage

```bash
# Automatic: runs at session end
# Manual: trigger anytime
/wrap-up [--force] [--summarize]
```

## Implementation

See `session-wrap-up.js` for the main logic.

## Integration Points

- Called automatically when session ends (via agent lifecycle)
- Can be triggered manually with `/wrap-up`
- Writes to `memory/YYYY-MM-DD.md` and long-term memory
- Feeds into auto-skill creation pipeline
- Populates FTS5 index for search

## Output Format

```json
{
  "sessionId": "agent:main:xyz",
  "timestamp": "2026-04-01T18:00:00Z",
  "learnings": [
    {
      "type": "correction|insight|decision|pattern",
      "content": "What was learned",
      "confidence": 0.95,
      "tags": ["topic", "context"]
    }
  ],
  "skillCandidates": [
    {
      "name": "potential-skill-name",
      "triggerPattern": "when user asks about X",
      "description": "What the skill would do"
    }
  ],
  "memoryUpdates": [
    {
      "file": "MEMORY.md",
      "action": "append|update",
      "content": "..."
    }
  ]
}
```

## Configuration

Add to agent config:
```yaml
sessionWrapUp:
  enabled: true
  autoRun: true
  minSessionLength: 5  # minimum messages before wrap-up
  llmModel: ollama/qwen3.5:cloud
```
