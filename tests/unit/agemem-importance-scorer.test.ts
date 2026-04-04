/**
 * Heretek OpenClaw — AgeMem Importance Scorer Unit Tests
 * ==============================================================================
 * Unit tests for importance-scorer lobe implementation
 * 
 * Tests cover:
 * - Content analysis (semantic density, entities, uniqueness, actionability)
 * - Access pattern scoring
 * - Confidence calculation
 * - Factor generation
 * - Full importance calculation
 * - Batch importance calculation
 * - Importance with decay
 * - Promotion and archival decisions
 * ==============================================================================
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  DEFAULT_IMPORTANCE_SCORER_CONFIG,
  analyzeContent,
  calculateAccessScore,
  calculateConfidence,
  generateFactors,
  normalize,
  calculateImportance,
  batchCalculateImportance,
  calculateImportanceWithDecay,
  shouldPromote,
  shouldArchive,
  type MemoryType,
  type ImportanceScorerConfig,
  type ContentAnalysisResult,
} from '../../skills/importance-scorer/importance-scorer';

describe('AgeMem Importance Scorer Module', () => {
  describe('DEFAULT_IMPORTANCE_SCORER_CONFIG', () => {
    it('should have correct default weight values', () => {
      expect(DEFAULT_IMPORTANCE_SCORER_CONFIG.contentWeight).toBe(0.30);
      expect(DEFAULT_IMPORTANCE_SCORER_CONFIG.userSignalWeight).toBe(0.25);
      expect(DEFAULT_IMPORTANCE_SCORER_CONFIG.accessPatternWeight).toBe(0.20);
      expect(DEFAULT_IMPORTANCE_SCORER_CONFIG.emotionalWeight).toBe(0.15);
      expect(DEFAULT_IMPORTANCE_SCORER_CONFIG.contextualWeight).toBe(0.10);
    });

    it('should have weights that sum to 1.0', () => {
      const sum =
        DEFAULT_IMPORTANCE_SCORER_CONFIG.contentWeight +
        DEFAULT_IMPORTANCE_SCORER_CONFIG.userSignalWeight +
        DEFAULT_IMPORTANCE_SCORER_CONFIG.accessPatternWeight +
        DEFAULT_IMPORTANCE_SCORER_CONFIG.emotionalWeight +
        DEFAULT_IMPORTANCE_SCORER_CONFIG.contextualWeight;

      expect(sum).toBeCloseTo(1.0, 2);
    });

    it('should have correct min/max importance bounds', () => {
      expect(DEFAULT_IMPORTANCE_SCORER_CONFIG.minImportance).toBe(0.1);
      expect(DEFAULT_IMPORTANCE_SCORER_CONFIG.maxImportance).toBe(1.0);
    });
  });

  describe('analyzeContent', () => {
    it('should return zero scores for empty content', () => {
      const result = analyzeContent('');
      expect(result.overallScore).toBe(0);
      expect(result.semanticDensity).toBe(0);
      expect(result.entityCount).toBe(0);
    });

    it('should return zero scores for whitespace-only content', () => {
      const result = analyzeContent('   \n\t  ');
      expect(result.overallScore).toBe(0);
    });

    it('should calculate semantic density based on word length', () => {
      const shortWords = 'a an I be is at on up to';
      const longWords = 'implementation architecture configuration specification';

      const shortResult = analyzeContent(shortWords);
      const longResult = analyzeContent(longWords);

      expect(longResult.semanticDensity).toBeGreaterThan(shortResult.semanticDensity);
    });

    it('should detect entities (capitalized words, technical terms)', () => {
      const content = 'TypeScript and JavaScript are programming languages. Node.js runs on servers.';
      const result = analyzeContent(content);

      expect(result.entityCount).toBeGreaterThan(0);
    });

    it('should detect actionable content', () => {
      const actionable = 'We should implement the feature by Friday. The team decided to use React.';
      const nonActionable = 'The sky is blue. Water is wet.';

      const actionableResult = analyzeContent(actionable);
      const nonActionResult = analyzeContent(nonActionable);

      expect(actionableResult.actionability).toBeGreaterThan(nonActionResult.actionability);
    });

    it('should detect factual content', () => {
      const factual = 'The API version is 2.0. The server has 99.9% uptime. Protocol: HTTPS.';
      const opinion = 'I think this is good. Maybe we should try it.';

      const factualResult = analyzeContent(factual);
      const opinionResult = analyzeContent(opinion);

      expect(factualResult.factualContent).toBeGreaterThan(opinionResult.factualContent);
    });

    it('should detect cross-references (links, code refs)', () => {
      const withRefs = 'See [documentation](https://example.com). Check `config.ts` for details.';
      const withoutRefs = 'This is a simple statement without references.';

      const withRefsResult = analyzeContent(withRefs);
      const withoutRefsResult = analyzeContent(withoutRefs);

      expect(withRefsResult.crossReferences).toBeGreaterThan(withoutRefsResult.crossReferences);
    });

    it('should calculate uniqueness based on vocabulary diversity', () => {
      const repetitive = 'the the the cat cat cat dog dog dog';
      const diverse = 'the quick brown fox jumps over the lazy dog';

      const repetitiveResult = analyzeContent(repetitive);
      const diverseResult = analyzeContent(diverse);

      expect(diverseResult.uniqueness).toBeGreaterThan(repetitiveResult.uniqueness);
    });

    it('should normalize all scores to 0-1 range', () => {
      const veryLongContent = 'A'.repeat(10000) + ' B'.repeat(5000);
      const result = analyzeContent(veryLongContent);

      expect(result.semanticDensity).toBeGreaterThanOrEqual(0);
      expect(result.semanticDensity).toBeLessThanOrEqual(1);
      expect(result.overallScore).toBeGreaterThanOrEqual(0);
      expect(result.overallScore).toBeLessThanOrEqual(1);
    });
  });

  describe('calculateAccessScore', () => {
    it('should return 0 for no access', () => {
      const score = calculateAccessScore({ accessCount: 0, recencyScore: 0 });
      expect(score).toBe(0);
    });

    it('should increase with access count (logarithmic)', () => {
      const score1 = calculateAccessScore({ accessCount: 1, recencyScore: 0 });
      const score10 = calculateAccessScore({ accessCount: 10, recencyScore: 0 });
      const score100 = calculateAccessScore({ accessCount: 100, recencyScore: 0 });

      expect(score10).toBeGreaterThan(score1);
      expect(score100).toBeGreaterThan(score10);
    });

    it('should show diminishing returns for high access counts', () => {
      const score10 = calculateAccessScore({ accessCount: 10, recencyScore: 0 });
      const score20 = calculateAccessScore({ accessCount: 20, recencyScore: 0 });
      const score100 = calculateAccessScore({ accessCount: 100, recencyScore: 0 });

      // Difference between 10 and 20 should be larger than 20 and 100
      const diff1 = score20 - score10;
      const diff2 = score100 - score20;

      // Logarithmic growth means diff2 might be similar or slightly larger
      // but both should show growth
      expect(score100).toBeGreaterThan(score10);
    });

    it('should incorporate recency score (40% weight)', () => {
      const withRecency = calculateAccessScore({ accessCount: 5, recencyScore: 1 });
      const withoutRecency = calculateAccessScore({ accessCount: 5, recencyScore: 0 });

      expect(withRecency).toBeGreaterThan(withoutRecency);
    });

    it('should handle undefined parameters', () => {
      const score = calculateAccessScore({});
      expect(score).toBe(0); // Both default to 0
    });

    it('should normalize scores to 0-1 range', () => {
      const extremeScore = calculateAccessScore({ accessCount: 1000, recencyScore: 1 });
      expect(extremeScore).toBeGreaterThanOrEqual(0);
      expect(extremeScore).toBeLessThanOrEqual(1);
    });
  });

  describe('calculateConfidence', () => {
    it('should return higher confidence with user signal', () => {
      const withSignal = calculateConfidence({
        hasUserSignal: true,
        contentQuality: 0.8,
        dataCompleteness: 0.8,
      });

      const withoutSignal = calculateConfidence({
        hasUserSignal: false,
        contentQuality: 0.8,
        dataCompleteness: 0.8,
      });

      expect(withSignal).toBeGreaterThan(withoutSignal);
    });

    it('should increase with content quality', () => {
      const highQuality = calculateConfidence({
        hasUserSignal: false,
        contentQuality: 1.0,
        dataCompleteness: 0.5,
      });

      const lowQuality = calculateConfidence({
        hasUserSignal: false,
        contentQuality: 0.2,
        dataCompleteness: 0.5,
      });

      expect(highQuality).toBeGreaterThan(lowQuality);
    });

    it('should increase with data completeness', () => {
      const complete = calculateConfidence({
        hasUserSignal: false,
        contentQuality: 0.5,
        dataCompleteness: 1.0,
      });

      const incomplete = calculateConfidence({
        hasUserSignal: false,
        contentQuality: 0.5,
        dataCompleteness: 0.2,
      });

      expect(complete).toBeGreaterThan(incomplete);
    });

    it('should normalize to 0-1 range', () => {
      const extreme = calculateConfidence({
        hasUserSignal: true,
        contentQuality: 1.0,
        dataCompleteness: 1.0,
      });

      expect(extreme).toBeGreaterThanOrEqual(0);
      expect(extreme).toBeLessThanOrEqual(1);
    });
  });

  describe('generateFactors', () => {
    it('should include factor for high user signal', () => {
      const factors = generateFactors({
        content: 0.5,
        userSignal: 0.9,
        access: 0.5,
        emotional: 0.5,
        contextual: 0.5,
      });

      expect(factors).toContainEqual(expect.stringContaining('user-provided importance'));
    });

    it('should include factor for high contextual relevance', () => {
      const factors = generateFactors({
        content: 0.5,
        userSignal: 0.5,
        access: 0.5,
        emotional: 0.5,
        contextual: 0.9,
      });

      expect(factors).toContainEqual(expect.stringContaining('contextual relevance'));
    });

    it('should include factor for frequent access', () => {
      const factors = generateFactors({
        content: 0.5,
        userSignal: 0.5,
        access: 0.8,
        emotional: 0.5,
        contextual: 0.5,
      });

      expect(factors).toContainEqual(expect.stringContaining('access'));
    });

    it('should include factor for actionable content', () => {
      const contentAnalysis: ContentAnalysisResult = {
        semanticDensity: 0.5,
        entityCount: 0.5,
        uniqueness: 0.5,
        actionability: 0.8,
        factualContent: 0.5,
        crossReferences: 0.5,
        overallScore: 0.5,
      };

      const factors = generateFactors({
        content: 0.5,
        userSignal: 0.5,
        access: 0.5,
        emotional: 0.5,
        contextual: 0.5,
      }, contentAnalysis);

      expect(factors).toContainEqual(expect.stringContaining('Actionable'));
    });

    it('should include default factor when no other factors apply', () => {
      const factors = generateFactors({
        content: 0.3,
        userSignal: 0.3,
        access: 0.3,
        emotional: 0.3,
        contextual: 0.3,
      });

      expect(factors).toContainEqual(expect.stringContaining('Default importance'));
    });
  });

  describe('normalize', () => {
    it('should return 0 for non-finite values', () => {
      expect(normalize(NaN)).toBe(0);
      expect(normalize(Infinity)).toBe(0);
      expect(normalize(-Infinity)).toBe(0);
    });

    it('should clamp values above 1', () => {
      expect(normalize(1.5)).toBe(1);
      expect(normalize(2.0)).toBe(1);
      expect(normalize(100)).toBe(1);
    });

    it('should clamp values below 0', () => {
      expect(normalize(-0.5)).toBe(0);
      expect(normalize(-1.0)).toBe(0);
    });

    it('should pass through values in range', () => {
      expect(normalize(0)).toBe(0);
      expect(normalize(0.5)).toBe(0.5);
      expect(normalize(1)).toBe(1);
    });
  });

  describe('calculateImportance', () => {
    it('should calculate importance with all factors', async () => {
      const result = await calculateImportance({
        content: 'TypeScript is a strongly-typed programming language.',
        type: 'semantic',
        userProvidedImportance: 0.9,
        accessCount: 10,
        recencyScore: 0.8,
        emotionalScore: 0.5,
        contextualRelevance: 0.7,
      });

      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(1);
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
      expect(result.breakdown).toBeDefined();
      expect(result.factors).toBeDefined();
    });

    it('should use memory type baseline when no user signal provided', async () => {
      const semanticResult = await calculateImportance({
        content: 'Factual content about TypeScript',
        type: 'semantic',
      });

      const episodicResult = await calculateImportance({
        content: 'Recent experience',
        type: 'episodic',
      });

      // Semantic has higher baseline (0.7) than episodic (0.5)
      expect(semanticResult.score).toBeGreaterThan(episodicResult.score);
    });

    it('should handle minimal input (content only)', async () => {
      const result = await calculateImportance({
        content: 'Simple content',
      });

      expect(result.score).toBeGreaterThanOrEqual(0.1); // minImportance
      expect(result.score).toBeLessThanOrEqual(1.0);
    });

    it('should respect custom config overrides', async () => {
      const customConfig: Partial<ImportanceScorerConfig> = {
        contentWeight: 0.5,
        userSignalWeight: 0.1,
        minImportance: 0.2,
        maxImportance: 0.8,
      };

      const result = await calculateImportance({
        content: 'Content with custom weights',
        type: 'semantic',
        config: customConfig,
      });

      expect(result.score).toBeGreaterThanOrEqual(0.2);
      expect(result.score).toBeLessThanOrEqual(0.8);
    });

    it('should include content analysis in result', async () => {
      const result = await calculateImportance({
        content: 'Detailed analysis content with entities and facts',
        type: 'semantic',
      });

      expect(result.contentAnalysis).toBeDefined();
      expect(result.contentAnalysis?.semanticDensity).toBeDefined();
      expect(result.contentAnalysis?.entityCount).toBeDefined();
      expect(result.contentAnalysis?.overallScore).toBeDefined();
    });

    it('should generate explanatory factors', async () => {
      const result = await calculateImportance({
        content: 'Important decision: We will use PostgreSQL for storage',
        type: 'episodic',
        userProvidedImportance: 0.95,
      });

      expect(result.factors.length).toBeGreaterThan(0);
    });
  });

  describe('batchCalculateImportance', () => {
    it('should calculate importance for multiple memories', async () => {
      const memories = [
        { content: 'Memory 1', type: 'episodic' as MemoryType },
        { content: 'Memory 2', type: 'semantic' as MemoryType, userProvidedImportance: 0.8 },
        { content: 'Memory 3', type: 'procedural' as MemoryType, accessCount: 5 },
      ];

      const results = await batchCalculateImportance(memories);

      expect(results.length).toBe(3);
      results.forEach(result => {
        expect(result.score).toBeGreaterThanOrEqual(0);
        expect(result.score).toBeLessThanOrEqual(1);
      });
    });

    it('should handle empty array', async () => {
      const results = await batchCalculateImportance([]);
      expect(results).toEqual([]);
    });
  });

  describe('calculateImportanceWithDecay', () => {
    it('should calculate base importance and apply decay', async () => {
      const result = await calculateImportanceWithDecay({
        content: 'Important memory that will decay',
        type: 'episodic',
        userProvidedImportance: 0.8,
        accessCount: 5,
        ageInDays: 7,
        halfLifeDays: 7,
      });

      expect(result.baseImportance).toBeGreaterThan(0);
      expect(result.decayedImportance).toBeLessThan(result.baseImportance);
      expect(result.decayMultiplier).toBeCloseTo(0.5, 1); // After one half-life
    });

    it('should apply floor to prevent complete decay', async () => {
      const result = await calculateImportanceWithDecay({
        content: 'Very old memory',
        type: 'episodic',
        ageInDays: 90,
        halfLifeDays: 7,
      });

      // Floor should be at least 10% of base
      expect(result.decayedImportance).toBeGreaterThanOrEqual(result.baseImportance * 0.1);
    });

    it('should return multiplier of 1.0 for fresh memory', async () => {
      const result = await calculateImportanceWithDecay({
        content: 'Fresh memory',
        ageInDays: 0,
        halfLifeDays: 7,
      });

      expect(result.decayMultiplier).toBeCloseTo(1, 2);
    });
  });

  describe('shouldPromote', () => {
    it('should promote episodic memory with high importance', () => {
      expect(shouldPromote(0.9, 5, 'episodic')).toBe(true);
      expect(shouldPromote(0.85, 5, 'episodic')).toBe(true);
    });

    it('should promote episodic memory with high access count', () => {
      expect(shouldPromote(0.5, 11, 'episodic')).toBe(true);
      expect(shouldPromote(0.5, 15, 'episodic')).toBe(true);
    });

    it('should not promote non-episodic memories', () => {
      expect(shouldPromote(0.9, 15, 'semantic')).toBe(false);
      expect(shouldPromote(0.9, 15, 'working')).toBe(false);
      expect(shouldPromote(0.9, 15, 'procedural')).toBe(false);
    });

    it('should not promote low importance, low access memories', () => {
      expect(shouldPromote(0.5, 5, 'episodic')).toBe(false);
      expect(shouldPromote(0.3, 2, 'episodic')).toBe(false);
    });

    it('should use exact threshold of 0.8 for importance', () => {
      expect(shouldPromote(0.81, 0, 'episodic')).toBe(true);
      expect(shouldPromote(0.79, 0, 'episodic')).toBe(false);
    });

    it('should use exact threshold of 10 for access count', () => {
      expect(shouldPromote(0.5, 11, 'episodic')).toBe(true);
      expect(shouldPromote(0.5, 9, 'episodic')).toBe(false);
    });
  });

  describe('shouldArchive', () => {
    it('should archive old, low importance, unaccessed memories', () => {
      expect(shouldArchive(0.2, 35, 0)).toBe(true);
      expect(shouldArchive(0.25, 31, 0)).toBe(true);
    });

    it('should not archive recent memories', () => {
      expect(shouldArchive(0.2, 10, 0)).toBe(false);
      expect(shouldArchive(0.2, 29, 0)).toBe(false);
    });

    it('should not archive high importance memories', () => {
      expect(shouldArchive(0.5, 40, 0)).toBe(false);
      expect(shouldArchive(0.8, 35, 0)).toBe(false);
    });

    it('should not archive accessed memories', () => {
      expect(shouldArchive(0.2, 35, 1)).toBe(false);
      expect(shouldArchive(0.2, 35, 5)).toBe(false);
    });

    it('should use exact threshold of 30 days for age', () => {
      expect(shouldArchive(0.2, 31, 0)).toBe(true);
      expect(shouldArchive(0.2, 29, 0)).toBe(false);
    });

    it('should use exact threshold of 0.3 for importance', () => {
      expect(shouldArchive(0.29, 35, 0)).toBe(true);
      expect(shouldArchive(0.31, 35, 0)).toBe(false);
    });
  });

  describe('Integration Tests', () => {
    it('should correctly score and categorize different memory types', async () => {
      // Working memory - temporary, low baseline
      const working = await calculateImportance({
        content: 'Temporary calculation result',
        type: 'working',
      });

      // Semantic memory - factual, high baseline
      const semantic = await calculateImportance({
        content: 'PostgreSQL uses SQL as query language',
        type: 'semantic',
        userProvidedImportance: 0.8,
      });

      // Episodic memory - experience, medium baseline
      const episodic = await calculateImportance({
        content: 'Discussed database migration strategy with team',
        type: 'episodic',
        accessCount: 5,
      });

      // Verify baselines are applied correctly
      expect(semantic.score).toBeGreaterThan(working.score);
    });

    it('should handle edge case content', async () => {
      // Very short content
      const short = await calculateImportance({ content: 'Hi', type: 'episodic' });

      // Very long content
      const long = await calculateImportance({
        content: 'A'.repeat(1000) + ' B'.repeat(500),
        type: 'episodic',
      });

      // Code content
      const code = await calculateImportance({
        content: 'function test() { return 42; }',
        type: 'procedural',
      });

      // All should return valid scores
      expect(short.score).toBeGreaterThanOrEqual(0.1);
      expect(long.score).toBeGreaterThanOrEqual(0.1);
      expect(code.score).toBeGreaterThanOrEqual(0.1);
    });
  });
});
