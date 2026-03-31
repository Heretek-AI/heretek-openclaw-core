# Dreamer Agent Skill

## Overview

The Dreamer Agent skill provides sleep-based memory consolidation for the agent collective. Inspired by human neuroscience research on hippocampal replay and systems consolidation, this skill enables agents to:

- Run simulated sleep cycles for memory processing
- Replay experiences during rest periods
- Promote episodic memories to semantic knowledge
- Generate abstract schemas from related memories
- Apply forgetting curves for natural memory decay

## Installation

The skill is located at `skills/dreamer-agent/` and requires:

- Node.js runtime
- Memory modules in `modules/memory/`
- Optional: Neo4j for GraphRAG integration
- Optional: jq for enhanced output formatting

## Usage

```bash
# Run immediate sleep cycle
./skills/dreamer-agent/dreamer-agent.sh sleep

# Check dreamer status
./skills/dreamer-agent/dreamer-agent.sh status

# View recent dreams
./skills/dreamer-agent/dreamer-agent.sh dreams

# Trigger semantic promotion manually
./skills/dreamer-agent/dreamer-agent.sh promote

# Apply forgetting decay
./skills/dreamer-agent/dreamer-agent.sh decay

# Show help
./skills/dreamer-agent/dreamer-agent.sh help
```

## Commands

| Command | Description |
|---------|-------------|
| `sleep` | Run immediate sleep cycle with all consolidation stages |
| `schedule` | Show or modify sleep schedule |
| `status` | Display dreamer agent status and statistics |
| `dreams` | Show recent dream log entries |
| `promote` | Manually trigger semantic promotion |
| `decay` | Apply forgetting decay to memories |
| `help` | Show help message |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DREAMER_SLEEP_HOUR` | 3 | Hour to trigger automatic sleep (24h format) |
| `DREAMER_SLEEP_DURATION` | 4.8 | Sleep cycle duration in minutes |
| `DREAMER_AUTO_TRIGGER` | true | Automatically trigger sleep at scheduled time |

## Sleep Stages

The dreamer agent simulates four sleep stages:

1. **NREM1 (10%)**: Transition stage, light replay
2. **NREM2 (15%)**: Light consolidation, abstraction depth 1
3. **NREM3 (20%)**: Deep consolidation, abstraction depth 1
4. **REM (25%)**: Schema formation, dream generation, abstraction depth 2

## Output Examples

### Status Command
```
[INFO] Dreamer Agent Status

[INFO] State file: /root/heretek/heretek-openclaw/modules/memory/state/dreamer-state.json

  Sleep Cycles:     5
  Total Dreams:     42
  Last Sleep:       1774849179092
  Last Saved:       2026-03-31 03:00:00

[INFO] Dream log: /root/heretek/heretek-openclaw/modules/memory/data/dream-log.json
```

### Sleep Command
```
[INFO] Starting sleep cycle...
[INFO] Executing sleep cycle with duration: 4.8 minutes
Starting sleep cycle...
Entering stage: nrem1
Entering stage: nrem2
Entering stage: nrem3
Entering stage: rem
[DreamerAgent] Generated dream: dream-1774849179092-0

=== Sleep Cycle Results ===
Cycle Number: 6
Duration: 288 seconds
Stages completed: 4
Dreams generated: 3
Memories consolidated: 7
[SUCCESS] Sleep cycle completed successfully
```

## Integration with Other Systems

### Episodic-Claw Plugin

The dreamer agent works with the episodic-claw plugin to:
- Access stored episodic memories for replay
- Trigger D0→D1 consolidation during sleep
- Generate dreams from episode content

### GraphRAG

During sleep, the dreamer agent can:
- Strengthen entity relationships through replay
- Form new schemas from related concepts
- Update graph embeddings for promoted memories

### Memory Consolidation Module

The dreamer agent coordinates with the consolidation module to:
- Apply Ebbinghaus forgetting curves
- Track promotion scores
- Manage memory tier transitions

## State Files

| File | Purpose |
|------|---------|
| `modules/memory/state/dreamer-state.json` | Dreamer agent state and statistics |
| `modules/memory/data/dream-log.json` | Dream generation log |
| `modules/memory/state/consolidation-state.json` | Shared consolidation state |

## Troubleshooting

### Node.js Not Found
```
Error: Node.js is required but not installed
```
Install Node.js: `apt-get install nodejs` or use nvm.

### State File Missing
```
[WARN] No state file found - dreamer agent may not have run yet
```
This is normal for first run. Execute `sleep` command to create state.

### Memory Module Errors
```
[WARN] Could not load consolidation module
```
Ensure memory modules exist in `modules/memory/` directory.

## Research Foundation

This skill implements concepts from:

- **Hippocampal Replay**: Wilson & McNaughton (1994) - Reactivation of memories during sleep
- **Systems Consolidation**: McClelland et al. (1995) - Complementary Learning Systems theory
- **Ebbinghaus Forgetting**: Mathematical model of memory decay over time
- **Schema Formation**: Lewis & Durrant (2011) - Overlapping replay builds cognitive schema

## License

MPL-2.0 (same as parent project)
