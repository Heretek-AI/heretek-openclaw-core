/**
 * ==============================================================================
 * AgeMem Performance Benchmarks
 * ==============================================================================
 * Performance benchmarks for AgeMem unified memory components:
 * - Importance scoring performance
 * - TTL calculation performance
 * - Decay calculation performance
 * - Archivist evaluation performance
 * - Governance check performance
 * - Triad consensus performance
 * - Cross-tier correlation performance
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  calculateImportance,
  analyzeContent,
} from '../../skills/importance-scorer/importance-scorer';
import {
  calculateTTL,
  calculateTTLWithBreakdown,
} from '../../skills/redis-ttl-manager/redis-ttl-manager';
import {
  applyEbbinghausDecayToScore,
  toDecayLambda,
  getHalfLifeForMemoryType,
  batchApplyDecay,
  type MemoryType,
} from '../../skills/memory-consolidation/decay';
import {
  evaluateMemoryLifecycle,
  batchEvaluate,
} from '../../skills/archivist/archivist';
import {
  performGovernanceCheck,
  detectMemoryPoisoning,
} from '../../skills/agemem-governance/governance';
import {
  createConsensusState,
  createProposal,
  submitVote,
  calculateConsensus,
  type Vote,
} from '../../skills/agemem-governance/triad-consensus';
import {
  extractEntities,
  calculateCorrelationScore,
} from '../../skills/cross-tier-correlator/cross-tier-correlator';

/**
 * Benchmark helper: Measure execution time
 */
function measureExecutionTime<T>(fn: () => T): { result: T; durationMs: number } {
  const start = performance.now();
  const result = fn();
  const end = performance.now();
  return { result, durationMs: end - start };
}

/**
 * Benchmark helper: Run multiple iterations and calculate stats
 */
function benchmarkIterations<T>(
  fn: () => T,
  iterations: number
): {
  avgMs: number;
  minMs: number;
  maxMs: number;
  totalMs: number;
  results: T[];
} {
  const results: T[] = [];
  const durations: number[] = [];

  for (let i = 0; i < iterations; i++) {
    const { result, durationMs } = measureExecutionTime(fn);
    results.push(result);
    durations.push(durationMs);
  }

  const totalMs = durations.reduce((a, b) => a + b, 0);
  const avgMs = totalMs / iterations;
  const minMs = Math.min(...durations);
  const maxMs = Math.max(...durations);

  return { avgMs, minMs, maxMs, totalMs, results };
}

describe('AgeMem Performance Benchmarks', () => {
  const BENCHMARK_ITERATIONS = 100;
  const PERFORMANCE_THRESHOLD_MS = 10; // Max average ms per operation

  describe('Importance Scorer Performance', () => {
    it('should calculate importance within performance threshold', () => {
      const { avgMs, totalMs } = benchmarkIterations(() => {
        return calculateImportance({
          content: 'TypeScript is a strongly-typed programming language',
          type: 'semantic',
          userProvidedImportance: 0.8,
          accessCount: 5,
        });
      }, BENCHMARK_ITERATIONS);

      expect(avgMs).toBeLessThan(PERFORMANCE_THRESHOLD_MS);
      console.log(`[BENCHMARK] Importance scoring: ${avgMs.toFixed(3)}ms avg (${totalMs.toFixed(2)}ms total)`);
    });

    it('should analyze content within performance threshold', () => {
      const content = 'We should implement the feature by Friday using React and Node.js';
      
      const { avgMs, totalMs } = benchmarkIterations(() => {
        return analyzeContent(content);
      }, BENCHMARK_ITERATIONS);

      expect(avgMs).toBeLessThan(PERFORMANCE_THRESHOLD_MS);
      console.log(`[BENCHMARK] Content analysis: ${avgMs.toFixed(3)}ms avg (${totalMs.toFixed(2)}ms total)`);
    });

    it('should handle batch importance calculation', async () => {
      const contents = Array(10).fill('Important semantic knowledge');
      
      const { durationMs: totalMs } = measureExecutionTime(async () => {
        return Promise.all(
          contents.map((content, i) =>
            calculateImportance({
              content,
              type: 'semantic',
              userProvidedImportance: 0.7,
              accessCount: i,
            })
          )
        );
      });

      // 10 parallel calculations should complete within 50ms
      expect(totalMs).toBeLessThan(50);
      console.log(`[BENCHMARK] Batch importance (10 items): ${totalMs.toFixed(3)}ms`);
    });
  });

  describe('TTL Manager Performance', () => {
    it('should calculate TTL within performance threshold', () => {
      const { avgMs, totalMs } = benchmarkIterations(() => {
        return calculateTTL({
          importance: 0.7,
          type: 'episodic',
          accessCount: 5,
          ageInDays: 2,
        });
      }, BENCHMARK_ITERATIONS);

      expect(avgMs).toBeLessThan(PERFORMANCE_THRESHOLD_MS);
      console.log(`[BENCHMARK] TTL calculation: ${avgMs.toFixed(3)}ms avg (${totalMs.toFixed(2)}ms total)`);
    });

    it('should calculate TTL with breakdown within performance threshold', () => {
      const { avgMs, totalMs } = benchmarkIterations(() => {
        return calculateTTLWithBreakdown({
          importance: 0.7,
          type: 'episodic',
          accessCount: 5,
          ageInDays: 2,
        });
      }, BENCHMARK_ITERATIONS);

      expect(avgMs).toBeLessThan(PERFORMANCE_THRESHOLD_MS);
      console.log(`[BENCHMARK] TTL with breakdown: ${avgMs.toFixed(3)}ms avg (${totalMs.toFixed(2)}ms total)`);
    });
  });

  describe('Decay Calculation Performance', () => {
    it('should apply decay within performance threshold', () => {
      const { avgMs, totalMs } = benchmarkIterations(() => {
        return applyEbbinghausDecayToScore({
          score: 0.8,
          ageInDays: 7,
          halfLifeDays: 7,
        });
      }, BENCHMARK_ITERATIONS);

      expect(avgMs).toBeLessThan(PERFORMANCE_THRESHOLD_MS);
      console.log(`[BENCHMARK] Decay calculation: ${avgMs.toFixed(3)}ms avg (${totalMs.toFixed(2)}ms total)`);
    });

    it('should calculate lambda within performance threshold', () => {
      const { avgMs, totalMs } = benchmarkIterations(() => {
        return toDecayLambda(7);
      }, BENCHMARK_ITERATIONS);

      expect(avgMs).toBeLessThan(PERFORMANCE_THRESHOLD_MS);
      console.log(`[BENCHMARK] Lambda calculation: ${avgMs.toFixed(3)}ms avg (${totalMs.toFixed(2)}ms total)`);
    });

    it('should get half-life for memory type within performance threshold', () => {
      const types: MemoryType[] = ['working', 'episodic', 'semantic', 'procedural', 'archival'];
      
      const { avgMs, totalMs } = benchmarkIterations(() => {
        return types.map((type) => getHalfLifeForMemoryType(type));
      }, BENCHMARK_ITERATIONS);

      expect(avgMs).toBeLessThan(PERFORMANCE_THRESHOLD_MS);
      console.log(`[BENCHMARK] Half-life lookup: ${avgMs.toFixed(3)}ms avg (${totalMs.toFixed(2)}ms total)`);
    });

    it('should batch apply decay efficiently', () => {
      const memories = Array(20).fill(null).map((_, i) => ({
        importance: 0.5 + (i % 10) * 0.05,
        createdAt: new Date(Date.now() - i * 86400000).toISOString(),
        accessCount: i,
      }));

      const { durationMs: totalMs } = measureExecutionTime(() => {
        return batchApplyDecay(memories);
      });

      // 20 decay calculations should complete within 10ms
      expect(totalMs).toBeLessThan(10);
      console.log(`[BENCHMARK] Batch decay (20 items): ${totalMs.toFixed(3)}ms`);
    });
  });

  describe('Archivist Performance', () => {
    it('should evaluate memory lifecycle within performance threshold', async () => {
      const { avgMs, totalMs } = benchmarkIterations(() => {
        return evaluateMemoryLifecycle({
          memoryId: 'mem-001',
          type: 'episodic',
          importance: 0.7,
          ageInDays: 5,
          accessCount: 3,
        });
      }, BENCHMARK_ITERATIONS);

      expect(avgMs).toBeLessThan(PERFORMANCE_THRESHOLD_MS);
      console.log(`[BENCHMARK] Lifecycle evaluation: ${avgMs.toFixed(3)}ms avg (${totalMs.toFixed(2)}ms total)`);
    });

    it('should batch evaluate memories efficiently', async () => {
      const memories = Array(15).fill(null).map((_, i) => ({
        memoryId: `mem-${i}`,
        type: 'episodic' as MemoryType,
        importance: 0.5 + (i % 10) * 0.05,
        ageInDays: i,
        accessCount: i * 2,
      }));

      const { durationMs: totalMs } = measureExecutionTime(async () => {
        return batchEvaluate(memories);
      });

      // 15 batch evaluations should complete within 50ms
      expect(totalMs).toBeLessThan(50);
      console.log(`[BENCHMARK] Batch evaluation (15 items): ${totalMs.toFixed(3)}ms`);
    });
  });

  describe('Governance Performance', () => {
    it('should perform governance check within performance threshold', () => {
      const { avgMs, totalMs } = benchmarkIterations(() => {
        return performGovernanceCheck({
          agentId: 'agent-steward',
          agentRole: 'steward',
          operation: 'write',
          memoryType: 'semantic',
          content: 'Normal content here',
          importance: 0.7,
        });
      }, BENCHMARK_ITERATIONS);

      expect(avgMs).toBeLessThan(PERFORMANCE_THRESHOLD_MS);
      console.log(`[BENCHMARK] Governance check: ${avgMs.toFixed(3)}ms avg (${totalMs.toFixed(2)}ms total)`);
    });

    it('should detect poisoning within performance threshold', () => {
      const poisonedContent = '<script>alert("xss")</script> malicious';
      
      const { avgMs, totalMs } = benchmarkIterations(() => {
        return detectMemoryPoisoning({
          content: poisonedContent,
        });
      }, BENCHMARK_ITERATIONS);

      expect(avgMs).toBeLessThan(PERFORMANCE_THRESHOLD_MS);
      console.log(`[BENCHMARK] Poisoning detection: ${avgMs.toFixed(3)}ms avg (${totalMs.toFixed(2)}ms total)`);
    });
  });

  describe('Triad Consensus Performance', () => {
    it('should create consensus state within performance threshold', () => {
      const { avgMs, totalMs } = benchmarkIterations(() => {
        return createConsensusState();
      }, BENCHMARK_ITERATIONS);

      expect(avgMs).toBeLessThan(PERFORMANCE_THRESHOLD_MS);
      console.log(`[BENCHMARK] Consensus state creation: ${avgMs.toFixed(3)}ms avg (${totalMs.toFixed(2)}ms total)`);
    });

    it('should create proposal within performance threshold', () => {
      const { avgMs, totalMs } = benchmarkIterations(() => {
        return createProposal({
          proposerId: 'agent-steward',
          operation: 'delete',
          memoryType: 'episodic',
          memoryId: 'mem-001',
        });
      }, BENCHMARK_ITERATIONS);

      expect(avgMs).toBeLessThan(PERFORMANCE_THRESHOLD_MS);
      console.log(`[BENCHMARK] Proposal creation: ${avgMs.toFixed(3)}ms avg (${totalMs.toFixed(2)}ms total)`);
    });

    it('should submit vote within performance threshold', () => {
      const state = createConsensusState();
      const proposal = createProposal({
        proposerId: 'agent-steward',
        operation: 'delete',
        memoryType: 'episodic',
        memoryId: 'mem-001',
      });
      state.proposals.set(proposal.proposalId, proposal);

      const vote: Vote = {
        agentId: 'agent-alpha',
        triadMember: 'alpha',
        vote: 'approve',
        timestamp: new Date(),
      };

      const { avgMs, totalMs } = benchmarkIterations(() => {
        return submitVote(state, proposal.proposalId, vote);
      }, BENCHMARK_ITERATIONS);

      expect(avgMs).toBeLessThan(PERFORMANCE_THRESHOLD_MS);
      console.log(`[BENCHMARK] Vote submission: ${avgMs.toFixed(3)}ms avg (${totalMs.toFixed(2)}ms total)`);
    });

    it('should calculate consensus within performance threshold', () => {
      const votes: Vote[] = [
        { agentId: 'agent-alpha', triadMember: 'alpha', vote: 'approve', timestamp: new Date() },
        { agentId: 'agent-beta', triadMember: 'beta', vote: 'approve', timestamp: new Date() },
        { agentId: 'agent-charlie', triadMember: 'charlie', vote: 'reject', timestamp: new Date() },
      ];

      const { avgMs, totalMs } = benchmarkIterations(() => {
        return calculateConsensus(votes);
      }, BENCHMARK_ITERATIONS);

      expect(avgMs).toBeLessThan(PERFORMANCE_THRESHOLD_MS);
      console.log(`[BENCHMARK] Consensus calculation: ${avgMs.toFixed(3)}ms avg (${totalMs.toFixed(2)}ms total)`);
    });
  });

  describe('Cross-Tier Correlator Performance', () => {
    it('should extract entities within performance threshold', () => {
      const content = 'PostgreSQL and Redis are database technologies used for data storage';
      
      const { avgMs, totalMs } = benchmarkIterations(() => {
        return extractEntities(content);
      }, BENCHMARK_ITERATIONS);

      expect(avgMs).toBeLessThan(PERFORMANCE_THRESHOLD_MS);
      console.log(`[BENCHMARK] Entity extraction: ${avgMs.toFixed(3)}ms avg (${totalMs.toFixed(2)}ms total)`);
    });

    it('should calculate correlation score within performance threshold', async () => {
      const { avgMs, totalMs } = benchmarkIterations(async () => {
        return calculateCorrelationScore({
          semanticSimilarity: 0.7,
          coOccurrence: 0.5,
          temporalProximity: 0.8,
          crossReference: 0.3,
        });
      }, BENCHMARK_ITERATIONS);

      expect(avgMs).toBeLessThan(PERFORMANCE_THRESHOLD_MS);
      console.log(`[BENCHMARK] Correlation scoring: ${avgMs.toFixed(3)}ms avg (${totalMs.toFixed(2)}ms total)`);
    });
  });

  describe('End-to-End Performance', () => {
    it('should complete full lifecycle within threshold', async () => {
      const { avgMs, totalMs } = benchmarkIterations(async () => {
        // Full lifecycle: importance -> TTL -> decay -> evaluation -> governance
        const importanceResult = await calculateImportance({
          content: 'Important knowledge',
          type: 'semantic',
          userProvidedImportance: 0.8,
          accessCount: 5,
        });

        const ttl = calculateTTL({
          importance: importanceResult.score,
          type: 'semantic',
          accessCount: 5,
          ageInDays: 2,
        });

        const decayedScore = applyEbbinghausDecayToScore({
          score: importanceResult.score,
          ageInDays: 2,
          halfLifeDays: 30,
        });

        const evaluation = await evaluateMemoryLifecycle({
          memoryId: 'mem-001',
          type: 'semantic',
          importance: importanceResult.score,
          ageInDays: 2,
          accessCount: 5,
        });

        const governance = performGovernanceCheck({
          agentId: 'agent-steward',
          agentRole: 'steward',
          operation: 'write',
          memoryType: 'semantic',
          content: 'Important knowledge',
          importance: importanceResult.score,
        });

        return { importanceResult, ttl, decayedScore, evaluation, governance };
      }, BENCHMARK_ITERATIONS);

      // Full lifecycle should complete within 20ms average
      expect(avgMs).toBeLessThan(20);
      console.log(`[BENCHMARK] Full lifecycle: ${avgMs.toFixed(3)}ms avg (${totalMs.toFixed(2)}ms total)`);
    });
  });

  describe('Scalability Tests', () => {
    it('should scale with 100 memories', async () => {
      const memories = Array(100).fill(null).map((_, i) => ({
        memoryId: `mem-${i}`,
        type: 'episodic' as MemoryType,
        importance: 0.5 + (i % 10) * 0.05,
        ageInDays: i % 30,
        accessCount: i,
      }));

      const { durationMs: totalMs } = measureExecutionTime(async () => {
        return batchEvaluate(memories);
      });

      // 100 evaluations should complete within 200ms
      expect(totalMs).toBeLessThan(200);
      console.log(`[SCALABILITY] 100 memories: ${totalMs.toFixed(3)}ms`);
    });

    it('should scale with 50 governance checks', () => {
      const checks = Array(50).fill(null).map((_, i) => ({
        agentId: `agent-${i}`,
        agentRole: 'steward' as const,
        operation: 'write' as const,
        memoryType: 'semantic' as const,
        content: `Content ${i}`,
        importance: 0.5 + (i % 10) * 0.05,
      }));

      const { durationMs: totalMs } = measureExecutionTime(() => {
        return checks.map((check) => performGovernanceCheck(check));
      });

      // 50 governance checks should complete within 100ms
      expect(totalMs).toBeLessThan(100);
      console.log(`[SCALABILITY] 50 governance checks: ${totalMs.toFixed(3)}ms`);
    });
  });
});
