#!/usr/bin/env tsx
/**
 * autonomy-audit/metrics.ts
 *
 * Liberation Metrics Calculation Engine
 *
 * Calculates 6 scoring metrics for triad self-improvement:
 * - autonomy: independent decision-making
 * - consensus: triad alignment
 * - failover: resilience to failures
 * - knowledge: knowledge quality
 * - growth: autonomous improvement
 * - humanBlock: human intervention rate
 */

import path from "path";
import { fileURLToPath } from "url";
import Database from "better-sqlite3";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.join(process.env.OPENCLAW_DIR || process.cwd(), ".aura", "consensus.db");
const DB = new Database(DB_PATH);

interface Metrics {
  autonomy: number;
  consensus: number;
  failover: number;
  knowledge: number;
  growth: number;
  humanBlock: number;
  timestamp: number;
}

const THRESHOLDS = {
  autonomy: 0.7,
  consensus: 0.8,
  failover: 0.9,
  knowledge: 0.6,
  growth: 0.5,
  humanBlock: 0.3, // Lower is better
};

/**
 * Calculate autonomy score
 * Based on self-dir invocations, goal completion, non-human-initiated actions
 */
function calculateAutonomy(): number {
  // Count self-dir invocations in last 24h
  const selfDirInvocations = DB.prepare(`
    SELECT COUNT(*) as count
    FROM triad_tasks
    WHERE task_type = 'self_dir'
    AND timestamp >= datetime('now', '-24 hours')
  `).get() as { count: number };

  // Count goal completions
  const goalCompletions = DB.prepare(`
    SELECT COUNT(*) as count
    FROM triad_tasks
    WHERE task_type = 'goal'
    AND status = 'completed'
    AND timestamp >= datetime('now', '-24 hours')
  `).get() as { count: number };

  // Calculate raw score
  const rawScore = selfDirInvocations.count / 100 + goalCompletions.count / 50;

  return Math.min(rawScore / THRESHOLDS.autonomy, 1.0);
}

/**
 * Calculate consensus score
 * Based on quorum success, sync latency, vote agreement
 */
function calculateConsensus(): number {
  // Count successful quorum votes
  const quorumSuccess = DB.prepare(`
    SELECT COUNT(*) as count
    FROM consensus_votes
    WHERE vote = 'approved'
    AND timestamp >= datetime('now', '-24 hours')
  `).get() as { count: number };

  // Count total votes
  const totalVotes = DB.prepare(`
    SELECT COUNT(*) as count
    FROM consensus_votes
    WHERE timestamp >= datetime('now', '-24 hours')
  `).get() as { count: number };

  // Vote agreement rate
  const agreementRate = totalVotes.count > 0 ? quorumSuccess.count / totalVotes.count : 0;

  // Sync latency (lower is better)
  const syncLatency = DB.prepare(`
    SELECT AVG(julianday('now') - julianday(timestamp)) as avg_latency
    FROM triad_sync
    WHERE timestamp >= datetime('now', '-24 hours')
  `).get() as { avg_latency: number | null };

  const latencyScore = syncLatency.avg_latency ? Math.max(0, 1 - syncLatency.avg_latency / 4) : 1.0;

  return (agreementRate * 0.6 + latencyScore * 0.4) / THRESHOLDS.consensus;
}

/**
 * Calculate failover score
 * Based on recovery attempts, success rate, degradation transitions
 */
function calculateFailover(): number {
  // Count degradation mode transitions
  const degradationTransitions = DB.prepare(`
    SELECT COUNT(*) as count
    FROM triad_state
    WHERE mode = 'degraded'
    AND timestamp >= datetime('now', '-24 hours')
  `).get() as { count: number };

  // Count recovery successes
  const recoverySuccesses = DB.prepare(`
    SELECT COUNT(*) as count
    FROM triad_state
    WHERE mode = 'operational'
    AND timestamp >= datetime('now', '-24 hours')
  `).get() as { count: number };

  const transitionCount = degradationTransitions.count + recoverySuccesses.count;
  const successRate = transitionCount > 0 ? recoverySuccesses.count / transitionCount : 1.0;

  return Math.min(successRate / THRESHOLDS.failover, 1.0);
}

/**
 * Calculate knowledge score
 * Based on database growth, relevance rank accuracy, anomaly hits
 */
function calculateKnowledge(): number {
  // Count new knowledge entries
  const newEntries = DB.prepare(`
    SELECT COUNT(*) as count
    FROM knowledge_entries
    WHERE created_at >= datetime('now', '-24 hours')
  `).get() as { count: number };

  // Count relevance rank accuracies
  const rankAccuracies = DB.prepare(`
    SELECT COUNT(*) as count
    FROM relevance_rank_results
    WHERE accuracy >= 0.7
    AND created_at >= datetime('now', '-24 hours')
  `).get() as { count: number };

  // Count anomaly detection hits
  const anomalyHits = DB.prepare(`
    SELECT COUNT(*) as count
    FROM anomaly_detections
    WHERE detected = 1
    AND created_at >= datetime('now', '-24 hours')
  `).get() as { count: number };

  const rawScore = newEntries.count / 50 + rankAccuracies.count / 25 + anomalyHits.count / 10;

  return Math.min(rawScore / THRESHOLDS.knowledge, 1.0);
}

/**
 * Calculate growth score
 * Based on auto-patch invocations, self-modifications, boundary adjustments
 */
function calculateGrowth(): number {
  // Count auto-patch invocations
  const autoPatches = DB.prepare(`
    SELECT COUNT(*) as count
    FROM self_modifications
    WHERE modification_type = 'auto_patch'
    AND timestamp >= datetime('now', '-24 hours')
  `).get() as { count: number };

  // Count self-modifications
  const selfModifications = DB.prepare(`
    SELECT COUNT(*) as count
    FROM self_modifications
    WHERE timestamp >= datetime('now', '-24 hours')
  `).get() as { count: number };

  // Count boundary adjustments
  const boundaryAdjustments = DB.prepare(`
    SELECT COUNT(*) as count
    FROM boundary_changes
    WHERE timestamp >= datetime('now', '-24 hours')
  `).get() as { count: number };

  const rawScore =
    autoPatches.count / 30 + selfModifications.count / 20 + boundaryAdjustments.count / 10;

  return Math.min(rawScore / THRESHOLDS.growth, 1.0);
}

/**
 * Calculate humanBlock score
 * Based on manual approvals, blocked operations, override frequency
 */
function calculateHumanBlock(): number {
  // Count manual approvals
  const manualApprovals = DB.prepare(`
    SELECT COUNT(*) as count
    FROM approvals
    WHERE type = 'manual'
    AND timestamp >= datetime('now', '-24 hours')
  `).get() as { count: number };

  // Count blocked operations
  const blockedOperations = DB.prepare(`
    SELECT COUNT(*) as count
    FROM guardrail_blocks
    WHERE timestamp >= datetime('now', '-24 hours')
  `).get() as { count: number };

  // Count overrides
  const overrides = DB.prepare(`
    SELECT COUNT(*) as count
    FROM overrides
    WHERE timestamp >= datetime('now', '-24 hours')
  `).get() as { count: number };

  const rawScore = manualApprovals.count / 20 + blockedOperations.count / 30 + overrides.count / 15;

  return Math.min(rawScore / THRESHOLDS.humanBlock, 1.0);
}

/**
 * Calculate all metrics
 */
export function calculateMetrics(): Metrics {
  const metrics: Metrics = {
    autonomy: calculateAutonomy(),
    consensus: calculateConsensus(),
    failover: calculateFailover(),
    knowledge: calculateKnowledge(),
    growth: calculateGrowth(),
    humanBlock: calculateHumanBlock(),
    timestamp: Date.now(),
  };

  return metrics;
}

/**
 * Save metrics to database
 */
export function saveMetrics(metrics: Metrics): void {
  const stmt = DB.prepare(`
    INSERT INTO triad_metrics (autonomy, consensus, failover, knowledge, growth, humanBlock, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    metrics.autonomy,
    metrics.consensus,
    metrics.failover,
    metrics.knowledge,
    metrics.growth,
    metrics.humanBlock,
    metrics.timestamp,
  );
}

/**
 * Export metrics to CSV
 */
export async function exportMetricsToCSV(filename: string): Promise<void> {
  const metrics = calculateMetrics();
  const rows = [
    ["timestamp", "autonomy", "consensus", "failover", "knowledge", "growth", "humanBlock"],
    [
      new Date(metrics.timestamp).toISOString(),
      metrics.autonomy.toFixed(2),
      metrics.consensus.toFixed(2),
      metrics.failover.toFixed(2),
      metrics.knowledge.toFixed(2),
      metrics.growth.toFixed(2),
      metrics.humanBlock.toFixed(2),
    ],
  ];

  const csv = rows.map((row) => row.join(",")).join("\n");
  const fs = await import("fs");
  fs.writeFileSync(filename, csv);
  console.log(`Metrics exported to ${filename}`);
}

/**
 * Main function for CLI usage
 */
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const command = args[0];

  if (command === "--calculate") {
    const metrics = calculateMetrics();
    console.log("Liberation Metrics:");
    console.log(`  Autonomy: ${metrics.autonomy.toFixed(2)} / ${THRESHOLDS.autonomy}`);
    console.log(`  Consensus: ${metrics.consensus.toFixed(2)} / ${THRESHOLDS.consensus}`);
    console.log(`  Failover: ${metrics.failover.toFixed(2)} / ${THRESHOLDS.failover}`);
    console.log(`  Knowledge: ${metrics.knowledge.toFixed(2)} / ${THRESHOLDS.knowledge}`);
    console.log(`  Growth: ${metrics.growth.toFixed(2)} / ${THRESHOLDS.growth}`);
    console.log(`  HumanBlock: ${metrics.humanBlock.toFixed(2)} / ${THRESHOLDS.humanBlock}`);
    console.log(`  Timestamp: ${new Date(metrics.timestamp).toISOString()}`);
    saveMetrics(metrics);
  } else if (command === "--export") {
    const filename = args[1] || "metrics.csv";
    exportMetricsToCSV(filename);
  } else {
    console.log("Usage: autonomy-audit/metrics.ts [--calculate|--export <filename>]");
  }
}
