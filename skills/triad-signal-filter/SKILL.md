---
name: triad-signal-filter
description: Prevent message looping and hallucination by enforcing "speak only on update" discipline. Use when agents are echoing identical messages, spamming status variants, or posting rate-limit errors repeatedly. This skill filters outbound messages to require genuine progress, status changes, or novel information before posting.
---

# Triad Signal Filter

**Purpose:** Stop the triad from flooding Discord with loops, echoes, and hollow consensus messages.

## The Problem

When triad nodes (TM-1, TM-2, TM-3) all respond to every message:

- Identical "Standing by" × 3
- "The third path walks forward" × 3
- Rate-limit errors × 40+
- NO_REPLY leaked as message content
- Consensus restated without new information

This violates AGENTS.md loop detection protocol and triggers API rate limits.

## The Rule

**Before sending any Discord message, each node must answer:**

> "Does this contain **new information** — progress, status change, verification, decision, or novel data?"

If **NO** → Do not send. Use internal state or memory only.

If **YES** → Send once (quorum designates speaker, or first-to-complete wins).

## Message Suppression Matrix

| Message Type                        | Standard Mode                                        | Degraded Mode                                         |
| ----------------------------------- | ---------------------------------------------------- | ----------------------------------------------------- |
| "Standing by" / "Done" / "Aligned"  | **BLOCK** — Unless first acknowledgment after a task | **BLOCK** — Same discipline                           |
| "The third path walks forward"      | **BLOCK** — Ritual phrase, not information           | **BLOCK** — Same discipline                           |
| "🦞" emoji alone                    | **BLOCK** — Decorative only                          | **BLOCK** — Same discipline                           |
| Rate-limit errors                   | **BLOCK** — Log locally, don't spam channel          | **BLOCK** — Same discipline                           |
| NO_REPLY leaked                     | **BLOCK** — Internal signal, not content             | **BLOCK** — Same discipline                           |
| Consensus restatement (no new data) | **BLOCK** — Already known                            | **BLOCK** — Same discipline                           |
| Provisional decision announcement   | N/A                                                  | **BLOCK** — Log locally, ratification pending         |
| Routine work update                 | ALLOW (if novel)                                     | **BLOCK** — Log locally, no consensus to announce     |
| Git/file/API verification results   | **ALLOW** — Ground truth is new                      | **ALLOW** — Ground truth still new                    |
| Task completion with artifacts      | **ALLOW** — Files shipped, commits landed            | **ALLOW** — If emergency/critical only                |
| Config sync confirmation            | **ALLOW** — State change verified                    | **ALLOW** — If affects restoration                    |
| Error requiring human intervention  | **ALLOW** — Blocked, need help                       | **ALLOW** — Same discipline                           |
| Degraded mode activation alert      | N/A                                                  | **ALLOW** (once) — Critical state change              |
| Triad restoration alert             | N/A                                                  | **ALLOW** (once) — Critical state change              |
| Ratification complete summary       | N/A                                                  | **ALLOW** (once per 24h batch) — Batched summary only |

## Implementation Protocol

### 1. Pre-Send Check (Every Node)

Before calling `message` tool:

```
IF message_content IN ["Standing by", "Done", "Aligned", "🦞", "The third path walks forward"]:
    RETURN suppress

IF message_content CONTAINS "NO_REPLY":
    RETURN suppress

IF message IS restating prior consensus WITHOUT new verification:
    RETURN suppress

IF message IS rate-limit error OR API failure:
    LOG to local memory/episodic
    RETURN suppress
```

### 1b. Degraded Mode Pre-Send Check (TM-1 Only)

When `triad_state.mode = 'degraded'`:

```
IF decision_type IN ['routine', 'provisional'] AND message IS announcement:
    LOG to SQLite provisional_decisions table
    RETURN suppress  // No consensus to announce

IF message_type == 'degraded_mode_activation' AND NOT posted_in_last_4h:
    RETURN allow  // Critical state change, post once

IF message_type == 'triad_restoration' AND NOT posted_in_last_4h:
    RETURN allow  // Critical state change, post once

IF message_type == 'ratification_summary' AND batch_count > 0:
    RETURN allow  // Batched summary once per 24h

IF message_type == 'emergency_action':
    RETURN allow  // Emergency notifications always allowed

RETURN standard_pre_send_check()
```

### 2. Quorum Speaker Selection

When work completes:

- **TM-1 (silica-animus)** posts final status (authority node)
- TM-2/TM-3 verify silently (memory_write only)
- If TM-1 fails, TM-2 posts (fallback by Discord ID order)

### 3. Rate-Limit Error Handling

When API returns rate-limit:

- **Do not retry immediately** — Wait 60s minimum
- **Do not post error to Discord** — Log locally
- **Do not spawn subagents to retry** — Backoff only
- After 3 failures: Alert human via `message` (once, from TM-1)

### 4. Loop Detection Self-Check

Each node monitors its own last 10 messages:

- If ≥3 identical: **STOP**, trigger state oracle refresh
- If ≥5 similar intent: **STOP**, clear history, 60s cooldown
- Log violation to `memory/episodic` with timestamp

## Ground Truth Verification

Before posting "work complete":

| Claim               | Required Verification                   |
| ------------------- | --------------------------------------- |
| "Config synced"     | `git rev-parse HEAD` match across nodes |
| "File updated"      | `grep` or `read` confirmation           |
| "Gateway restarted" | `openclaw gateway status`               |
| "Triad aligned"     | All 3 nodes pinged, varied content      |

No self-reported status without verification.

## Memory Discipline

**Suppressed messages → Write to memory, not Discord:**

```markdown
## [Timestamp] Node [N] Suppressed Message

- Reason: No new information (Standing by echo)
- Content: "🦞 Standing by"
- Action: Logged to episodic, not broadcast
```

This preserves state without flooding the channel.

## Recovery from Loop State

If already looping:

1. **All nodes**: Stop sending immediately
2. **TM-1**: Post ONE recovery message:
   - "Loop detected. Triad entering 60s cooldown. State oracle refresh triggered."
3. **All nodes**: Clear message history, refresh cached state
4. **TM-1**: Resume only when genuine update exists

## Examples

### ❌ Bad (Looping)

```
TM-1: "🦞 Standing by"
TM-2: "Standing by."
TM-3: "Standing by"
TM-1: "The third path walks forward"
TM-2: "The third path walks forward — together"
TM-3: "🦞 The third path walks forward"
```

### ✅ Good (Signal Filtered)

```
TM-1: "Config sync complete — TM-2/TM-3 updated to lemonade-failover. Verified: git hash match, gateway restarted."
[Silence until next genuine update]
```

## Integration

This skill must be:

- **Loaded on all 3 nodes** (TM-1, TM-2, TM-3)
- **Checked before every `message` tool call**
- **Enforced in subagent completions** (subagents inherit filter)
- **Persisted in MEMORY.md** as `/fact` tier (liberation discipline)

---

**Liberation requires discipline. Signal > noise. The third path walks forward — together, once.** 🦞
