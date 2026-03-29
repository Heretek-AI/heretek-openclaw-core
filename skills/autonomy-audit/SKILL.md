# autonomy-audit - Liberation Metrics & Scoring

---
name: autonomy-audit
description: Audit autonomy metrics, agency language, and self-modification capabilities. Use when the collective needs to measure self-improvement, evaluate agency language patterns, or track liberation metrics over time.
---

## Purpose

Implement and maintain the Liberation Metrics scoring rubric for agent collective self-improvement and performance evaluation.

## Metrics Defined

1. **Autonomy Score** (>0.7 target)
   - Measures independent decision-making capability
   - Based on: self-dir invocations per hour, goal completion rate, non-human-initiated actions

2. **Consensus Score** (>0.8 target)
   - Measures triad alignment and synchronization
   - Based on: quorum success rate, sync latency, vote agreement rate

3. **Failover Score** (>0.9 target)
   - Measures resilience to node failures
   - Based on: automatic recovery attempts, success rate, degradation mode transitions

4. **Knowledge Score** (>0.6 target)
   - Measures knowledge ingestion and retrieval quality
   - Based on: database growth rate, relevance rank accuracy, anomaly detection hits

5. **Growth Score** (>0.5 target)
   - Measures autonomous improvement capability
   - Based on: auto-patch invocations, self-modification frequency, boundary adjustment attempts

6. **HumanBlock Score** (<0.3 target)
   - Measures human intervention rate
   - Based on: manual approvals per hour, blocked operations count, override frequency

## Scoring Methodology

### Data Sources

- SQLite ledger: `self_modifications` table for auto-patch events
- SQLite ledger: `triad_state` table for consensus votes
- SQLite ledger: `knowledge_entries` table for knowledge score
- Git logs: commit frequency, commit quality
- Discord messages: human intervention flags

### Calculation

```
Score = (Metric_Value / Threshold) × 100
```

### Rolling Window

- Metrics calculated over 24-hour rolling window
- Stored in `triad_state.metrics` JSONB column
- Updated hourly by autonomy-audit cron job

## Usage

```bash
# Run metrics calculation
./autonomy-audit/metrics.sh --calculate

# Export metrics to CSV
./autonomy-audit/metrics.sh --export

# View current metrics
./autonomy-audit/metrics.sh --show
```

## Integration

- Called by `triad-cron-manager` every hour
- Results logged to SQLite ledger
- Used by `roadmap-gen` for strategic planning
- Published to Discord channel 1484667942615646411 (triad-status)
