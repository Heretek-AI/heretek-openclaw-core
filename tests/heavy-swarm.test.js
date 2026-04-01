/**
 * HeavySwarm Deliberation Workflow Tests
 * 
 * Tests for the 5-phase deliberation pattern implementation.
 */

const { HeavySwarm } = require('../modules/heavy-swarm');

describe('HeavySwarm', () => {
  let heavySwarm;
  let mockTask;

  beforeEach(() => {
    heavySwarm = new HeavySwarm();
    mockTask = {
      id: 'task-123',
      description: 'Test deliberation task',
      context: { priority: 'high' }
    };
  });

  describe('Constructor', () => {
    test('should initialize with default options', () => {
      const swarm = new HeavySwarm();
      expect(swarm.phases).toEqual(['research', 'analysis', 'alternatives', 'verification', 'decision']);
      expect(swarm.options).toEqual({});
    });

    test('should initialize with custom options', () => {
      const options = { timeout: 5000, maxPhases: 3 };
      const swarm = new HeavySwarm(options);
      expect(swarm.options).toEqual(options);
    });
  });

  describe('Phase Methods', () => {
    describe('research', () => {
      test('should return approved result with gathered information', async () => {
        // Mock gatherInformation
        heavySwarm.gatherInformation = jest.fn().mockResolvedValue({
          sources: ['source1', 'source2'],
          facts: ['fact1'],
          gaps: ['gap1']
        });

        const result = await heavySwarm.research(mockTask, {});

        expect(result.approved).toBe(true);
        expect(result.data.sources).toHaveLength(2);
        expect(result.data.facts).toHaveLength(1);
        expect(result.data.gaps).toHaveLength(1);
      });

      test('should return failed result on error', async () => {
        heavySwarm.gatherInformation = jest.fn().mockRejectedValue(new Error('Network error'));

        const result = await heavySwarm.research(mockTask, {});

        expect(result.approved).toBe(false);
        expect(result.reason).toContain('Research failed');
        expect(result.data).toBeNull();
      });

      test('should handle empty results gracefully', async () => {
        heavySwarm.gatherInformation = jest.fn().mockResolvedValue({});

        const result = await heavySwarm.research(mockTask, {});

        expect(result.approved).toBe(true);
        expect(result.data.sources).toEqual([]);
        expect(result.data.facts).toEqual([]);
        expect(result.data.gaps).toEqual([]);
      });
    });

    describe('analysis', () => {
      test('should analyze research data successfully', async () => {
        heavySwarm.analyzeFindings = jest.fn().mockResolvedValue({
          patterns: ['pattern1'],
          insights: ['insight1'],
          risks: ['risk1'],
          opportunities: ['opp1']
        });

        const context = {
          phases: [{ data: { sources: ['src1'], facts: ['fact1'] } }]
        };

        const result = await heavySwarm.analysis(mockTask, context);

        expect(result.approved).toBe(true);
        expect(result.data.patterns).toHaveLength(1);
        expect(heavySwarm.analyzeFindings).toHaveBeenCalled();
      });

      test('should fail when no research data available', async () => {
        const result = await heavySwarm.analysis(mockTask, { phases: [] });

        expect(result.approved).toBe(false);
        expect(result.reason).toContain('No research data available');
      });

      test('should handle analysis errors', async () => {
        heavySwarm.analyzeFindings = jest.fn().mockRejectedValue(new Error('Analysis failed'));

        const context = {
          phases: [{ data: { sources: ['src1'] } }]
        };

        const result = await heavySwarm.analysis(mockTask, context);

        expect(result.approved).toBe(false);
        expect(result.reason).toContain('Analysis failed');
      });
    });

    describe('alternatives', () => {
      test('should generate alternatives from analysis', async () => {
        heavySwarm.generateAlternatives = jest.fn().mockResolvedValue({
          options: ['opt1', 'opt2', 'opt3'],
          criteria: ['cost', 'time'],
          tradeoffs: ['tradeoff1']
        });

        const context = {
          phases: [null, { data: { patterns: ['p1'], insights: ['i1'] } }]
        };

        const result = await heavySwarm.alternatives(mockTask, context);

        expect(result.approved).toBe(true);
        expect(result.data.options).toHaveLength(3);
        expect(heavySwarm.generateAlternatives).toHaveBeenCalled();
      });

      test('should fail when no analysis data available', async () => {
        const result = await heavySwarm.alternatives(mockTask, { phases: [] });

        expect(result.approved).toBe(false);
        expect(result.reason).toContain('No analysis data available');
      });
    });

    describe('verification', () => {
      test('should verify all alternatives', async () => {
        heavySwarm.validateOption = jest.fn()
          .mockResolvedValueOnce(true)
          .mockResolvedValueOnce(false)
          .mockResolvedValueOnce(true);

        const context = {
          phases: [null, null, { data: { options: ['opt1', 'opt2', 'opt3'] } }]
        };

        const result = await heavySwarm.verification(mockTask, context);

        expect(result.approved).toBe(true);
        expect(result.data.verifiedOptions).toHaveLength(2);
        expect(result.data.rejectedCount).toBe(1);
      });

      test('should fail when no alternatives pass verification', async () => {
        heavySwarm.validateOption = jest.fn().mockResolvedValue(false);

        const context = {
          phases: [null, null, { data: { options: ['opt1', 'opt2'] } }]
        };

        const result = await heavySwarm.verification(mockTask, context);

        expect(result.approved).toBe(false);
        expect(result.reason).toContain('No alternatives passed verification');
      });

      test('should fail when no alternatives exist', async () => {
        const context = {
          phases: [null, null, { data: {} }]
        };

        const result = await heavySwarm.verification(mockTask, context);

        expect(result.approved).toBe(false);
        expect(result.reason).toContain('No alternatives to verify');
      });
    });

    describe('decision', () => {
      test('should select best option from verified alternatives', async () => {
        heavySwarm.selectBest = jest.fn().mockResolvedValue({
          option: 'opt1',
          rationale: 'Best overall',
          confidence: 0.95
        });

        const context = {
          phases: [null, null, null, { 
            data: { 
              verifiedOptions: [
                { option: 'opt1', score: 95 },
                { option: 'opt2', score: 80 }
              ] 
            } 
          }]
        };

        const result = await heavySwarm.decision(mockTask, context);

        expect(result.approved).toBe(true);
        expect(result.data.selected.option).toBe('opt1');
        expect(result.data.confidence).toBe(0.95);
      });

      test('should fail when no verified options available', async () => {
        const context = {
          phases: [null, null, null, { data: {} }]
        };

        const result = await heavySwarm.decision(mockTask, context);

        expect(result.approved).toBe(false);
        expect(result.reason).toContain('No verified options to decide from');
      });
    });
  });

  describe('deliberate (Full Workflow)', () => {
    test('should complete all phases successfully', async () => {
      // Mock all phase methods
      heavySwarm.gatherInformation = jest.fn().mockResolvedValue({ sources: ['s1'], facts: ['f1'], gaps: [] });
      heavySwarm.analyzeFindings = jest.fn().mockResolvedValue({ patterns: [], insights: [], risks: [], opportunities: [] });
      heavySwarm.generateAlternatives = jest.fn().mockResolvedValue({ options: ['opt1'], criteria: [], tradeoffs: [] });
      heavySwarm.validateOption = jest.fn().mockResolvedValue(true);
      heavySwarm.selectBest = jest.fn().mockResolvedValue({ option: 'opt1', rationale: 'Best', confidence: 0.9 });

      const result = await heavySwarm.deliberate(mockTask);

      expect(result.approved).toBe(true);
      expect(result.phases).toHaveLength(5);
      expect(result.phases.map(p => p.name)).toEqual([
        'research', 'analysis', 'alternatives', 'verification', 'decision'
      ]);
      expect(result.decision).toBeDefined();
      expect(result.duration).toBeGreaterThanOrEqual(0);
      expect(result.taskId).toBe('task-123');
    });

    test('should terminate early on phase failure', async () => {
      heavySwarm.gatherInformation = jest.fn().mockRejectedValue(new Error('Research failed'));

      const result = await heavySwarm.deliberate(mockTask);

      expect(result.approved).toBe(false);
      expect(result.phases).toHaveLength(1);
      expect(result.phases[0].name).toBe('research');
      expect(result.phases[0].approved).toBe(false);
    });

    test('should pass data between phases', async () => {
      const researchData = { sources: ['s1'], facts: ['f1'], gaps: [] };
      const analysisData = { patterns: ['p1'], insights: [], risks: [], opportunities: [] };
      
      heavySwarm.gatherInformation = jest.fn().mockResolvedValue(researchData);
      heavySwarm.analyzeFindings = jest.fn().mockResolvedValue(analysisData);
      heavySwarm.generateAlternatives = jest.fn().mockResolvedValue({ options: [], criteria: [], tradeoffs: [] });
      heavySwarm.validateOption = jest.fn().mockResolvedValue(true);
      heavySwarm.selectBest = jest.fn().mockResolvedValue({});

      await heavySwarm.deliberate(mockTask);

      expect(heavySwarm.analyzeFindings).toHaveBeenCalledWith(expect.objectContaining(researchData));
    });

    test('should track timing information', async () => {
      heavySwarm.gatherInformation = jest.fn().mockResolvedValue({ sources: [], facts: [], gaps: [] });
      heavySwarm.analyzeFindings = jest.fn().mockResolvedValue({ patterns: [], insights: [], risks: [], opportunities: [] });
      heavySwarm.generateAlternatives = jest.fn().mockResolvedValue({ options: [], criteria: [], tradeoffs: [] });
      heavySwarm.validateOption = jest.fn().mockResolvedValue(true);
      heavySwarm.selectBest = jest.fn().mockResolvedValue({});

      const startTime = Date.now();
      const result = await heavySwarm.deliberate(mockTask);

      expect(result.startedAt).toBeGreaterThanOrEqual(startTime);
      expect(result.endedAt).toBeGreaterThanOrEqual(result.startedAt);
      expect(result.duration).toBe(result.endedAt - result.startedAt);
    });

    test('should handle task without ID', async () => {
      const taskWithoutId = { description: 'No ID task' };
      
      heavySwarm.gatherInformation = jest.fn().mockResolvedValue({ sources: [], facts: [], gaps: [] });
      heavySwarm.analyzeFindings = jest.fn().mockResolvedValue({ patterns: [], insights: [], risks: [], opportunities: [] });
      heavySwarm.generateAlternatives = jest.fn().mockResolvedValue({ options: [], criteria: [], tradeoffs: [] });
      heavySwarm.validateOption = jest.fn().mockResolvedValue(true);
      heavySwarm.selectBest = jest.fn().mockResolvedValue({});

      const result = await heavySwarm.deliberate(taskWithoutId);

      expect(result.taskId).toBeDefined();
      expect(typeof result.taskId).toBe('number'); // Falls back to Date.now()
    });
  });

  describe('Helper Methods (Default Implementations)', () => {
    test('gatherInformation should return empty structure', async () => {
      const result = await heavySwarm.gatherInformation(mockTask);
      expect(result).toEqual({ sources: [], facts: [], gaps: [] });
    });

    test('analyzeFindings should return empty structure', async () => {
      const result = await heavySwarm.analyzeFindings({});
      expect(result).toEqual({ patterns: [], insights: [], risks: [], opportunities: [] });
    });

    test('generateAlternatives should return empty structure', async () => {
      const result = await heavySwarm.generateAlternatives({});
      expect(result).toEqual({ options: [], criteria: [], tradeoffs: [] });
    });

    test('validateOption should return true by default', async () => {
      const result = await heavySwarm.validateOption({});
      expect(result).toBe(true);
    });

    test('selectBest should return first option or empty object', async () => {
      expect(await heavySwarm.selectBest([{ opt: 1 }])).toEqual({ opt: 1 });
      expect(await heavySwarm.selectBest([])).toEqual({});
    });
  });
});
