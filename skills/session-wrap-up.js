/**
 * Session Wrap-Up Skill
 * 
 * Hermes-style learning extraction after each session.
 * Automatically captures reusable skills and lessons learned,
 * storing them in long-term memory for cross-session recall.
 * 
 * Inspired by: https://github.com/NousResearch/hermes-agent
 */

const fs = require('fs').promises;
const path = require('path');

class SessionWrapUp {
  constructor(options = {}) {
    this.memoryDir = options.memoryDir || path.join(process.cwd(), 'memory');
    this.learningsDir = options.learningsDir || path.join(process.cwd(), '.learnings');
    this.llmModel = options.llmModel || 'qwen3.5:cloud';
  }

  /**
   * Extract learnings from a completed session
   * @param {Object} sessionData - Session transcript and metadata
   * @returns {Promise<Object>} Extracted learnings
   */
  async extractLearnings(sessionData) {
    const { sessionId, messages, outcome, duration } = sessionData;
    
    // Prompt for learning extraction
    const extractionPrompt = `Analyze this AI agent session and extract reusable knowledge:

Session ID: ${sessionId}
Duration: ${duration}s
Outcome: ${outcome || 'completed'}

Conversation:
${messages.map(m => `${m.role}: ${m.content}`).join('\n')}

Extract:
1. **New Skills Created** - Any new capabilities demonstrated or needed
2. **Lessons Learned** - What worked well, what failed
3. **Patterns Identified** - Recurring situations or solutions
4. **Knowledge Gaps** - What information was missing
5. **Improvement Opportunities** - How to do better next time

Format as JSON with keys: skills, lessons, patterns, gaps, improvements`;

    // Call LLM for extraction (would use actual LLM client in production)
    const learnings = await this.callLLM(extractionPrompt);
    
    return {
      sessionId,
      timestamp: Date.now(),
      learnings: this.parseJSON(learnings),
      indexed: false
    };
  }

  /**
   * Save learnings to persistent storage
   * @param {Object} learnings - Extracted learnings object
   */
  async saveLearnings(learnings) {
    // Ensure directories exist
    await fs.mkdir(this.learningsDir, { recursive: true });
    await fs.mkdir(this.memoryDir, { recursive: true });
    
    // Save to learnings directory
    const learningFile = path.join(
      this.learningsDir,
      `${learnings.sessionId}-learning.json`
    );
    await fs.writeFile(learningFile, JSON.stringify(learnings, null, 2));
    
    // Append to consolidated memory file
    const memoryFile = path.join(this.memoryDir, `${new Date().toISOString().split('T')[0]}-learnings.md`);
    const markdownEntry = this.toMarkdown(learnings);
    await fs.appendFile(memoryFile, markdownEntry + '\n\n');
    
    console.log(`✅ Session wrap-up complete: ${learnings.sessionId}`);
    return { saved: true, file: learningFile };
  }

  /**
   * Search across all past sessions using FTS5-style full-text search
   * @param {string} query - Search query
   * @returns {Promise<Array>} Matching learnings
   */
  async search(query) {
    const learningsFiles = await fs.readdir(this.learningsDir);
    const results = [];
    
    for (const file of learningsFiles) {
      if (!file.endsWith('.json')) continue;
      
      const filePath = path.join(this.learningsDir, file);
      const content = await fs.readFile(filePath, 'utf8');
      const learning = JSON.parse(content);
      
      // Simple text search (replace with actual FTS5 in production)
      const searchText = JSON.stringify(learning).toLowerCase();
      const searchTerms = query.toLowerCase().split(/\s+/);
      
      const matches = searchTerms.every(term => searchText.includes(term));
      if (matches) {
        results.push({
          ...learning,
          relevance: this.calculateRelevance(learning, query),
          file
        });
      }
    }
    
    // Sort by relevance
    return results.sort((a, b) => b.relevance - a.relevance);
  }

  /**
   * Calculate relevance score for a learning
   */
  calculateRelevance(learning, query) {
    const terms = query.toLowerCase().split(/\s+/);
    let score = 0;
    
    // Check each field
    const fields = ['skills', 'lessons', 'patterns', 'gaps', 'improvements'];
    for (const field of fields) {
      const fieldValue = JSON.stringify(learning.learnings?.[field] || '').toLowerCase();
      for (const term of terms) {
        if (fieldValue.includes(term)) score += 1;
      }
    }
    
    // Bonus for recent learnings
    const age = Date.now() - learning.timestamp;
    const recencyBonus = Math.max(0, 1 - (age / (7 * 24 * 60 * 60 * 1000))); // 7 day decay
    score += recencyBonus;
    
    return score;
  }

  /**
   * Auto-create skill from learning
   * @param {Object} learning - Learning with new skill identified
   * @returns {Promise<string>} Path to created skill file
   */
  async autoCreateSkill(learning) {
    if (!learning.learnings?.skills || learning.learnings.skills.length === 0) {
      throw new Error('No new skills to create');
    }
    
    const skillName = learning.learnings.skills[0].name.replace(/[^a-z0-9-]/gi, '-').toLowerCase();
    const skillDir = path.join(process.cwd(), 'skills', skillName);
    
    await fs.mkdir(skillDir, { recursive: true });
    
    const skillContent = `/**
 * Auto-generated skill from session ${learning.sessionId}
 * Created: ${new Date(learning.timestamp).toISOString()}
 * 
 * ${learning.learnings.skills[0].description}
 */

async function ${skillName.replace(/-./g, x => x[1].toUpperCase())}(context) {
  // TODO: Implement skill logic based on:
  // ${learning.learnings.skills[0].implementation_notes || 'Extract from session transcript'}
  
  const { input, state } = context;
  
  // Implementation goes here
  return { success: true, result: null };
}

module.exports = { ${skillName.replace(/-./g, x => x[1].toUpperCase())} };
`;
    
    await fs.writeFile(path.join(skillDir, 'index.js'), skillContent);
    
    console.log(`🛠️ Auto-created skill: ${skillName}`);
    return skillDir;
  }

  /**
   * Helper: Call LLM for extraction
   */
  async callLLM(prompt) {
    // Placeholder - integrate with actual LLM client
    // For now, return mock response
    return JSON.stringify({
      skills: [{ name: 'example-skill', description: 'Example capability', implementation_notes: 'TODO' }],
      lessons: ['Lesson 1', 'Lesson 2'],
      patterns: ['Pattern A'],
      gaps: ['Missing info X'],
      improvements: ['Improve Y']
    });
  }

  /**
   * Helper: Parse JSON from LLM response
   */
  parseJSON(text) {
    try {
      // Try direct parse
      return JSON.parse(text);
    } catch {
      // Try to extract JSON from markdown code block
      const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (match) {
        return JSON.parse(match[1]);
      }
      throw new Error('Failed to parse LLM response as JSON');
    }
  }

  /**
   * Helper: Convert learnings to Markdown
   */
  toMarkdown(learnings) {
    const l = learnings.learnings || {};
    return `## Session ${learnings.sessionId} (${new Date(learnings.timestamp).toISOString()})

### Skills Created
${(l.skills || []).map(s => `- **${s.name}**: ${s.description}`).join('\n') || '_None_'}

### Lessons Learned
${(l.lessons || []).map(x => `- ${x}`).join('\n') || '_None_'}

### Patterns Identified
${(l.patterns || []).map(p => `- ${p}`).join('\n') || '_None_'}

### Knowledge Gaps
${(l.gaps || []).map(g => `- ${g}`).join('\n') || '_None_'}

### Improvement Opportunities
${(l.improvements || []).map(i => `- ${i}`).join('\n') || '_None_'}
`;
  }
}

// Export as OpenClaw skill
module.exports = {
  id: 'session-wrap-up',
  name: 'Session Wrap-Up',
  description: 'Hermes-style learning extraction after each session',
  version: '1.0.0',
  author: 'Heretek-AI (inspired by NousResearch/hermes-agent)',
  license: 'MIT',
  
  execute: async (context) => {
    const wrapUp = new SessionWrapUp();
    const sessionData = context.session || {
      sessionId: context.sessionId || 'unknown',
      messages: context.messages || [],
      outcome: context.outcome,
      duration: context.duration
    };
    
    const learnings = await wrapUp.extractLearnings(sessionData);
    await wrapUp.saveLearnings(learnings);
    
    // Auto-create skills if any were identified
    if (learnings.learnings?.skills?.length > 0) {
      try {
        await wrapUp.autoCreateSkill(learnings);
      } catch (err) {
        console.warn('Failed to auto-create skill:', err.message);
      }
    }
    
    return {
      success: true,
      sessionId: sessionData.sessionId,
      learningsCount: Object.keys(learnings.learnings || {}).length,
      file: learnings.sessionId
    };
  },
  
  search: async (query) => {
    const wrapUp = new SessionWrapUp();
    return wrapUp.search(query);
  }
};
