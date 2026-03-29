#!/usr/bin/env node
/**
 * Gap Detector Module - Phase 1: Script-to-Skill Conversion
 *
 * Compares installed skills vs available skills from multiple sources.
 * Outputs gaps that would enable new capabilities.
 *
 * @module gap-detector
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

// Configuration
const WORKSPACE = process.env.WORKSPACE || path.join(process.env.HOME, ".openclaw/workspace");
const SKILLS_DIR = path.join(WORKSPACE, "skills");
const CURIOSITY_DIR = path.join(WORKSPACE, ".curiosity");

// Ensure directories exist
if (!fs.existsSync(CURIOSITY_DIR)) {
  fs.mkdirSync(CURIOSITY_DIR, { recursive: true });
}

/**
 * Get installed skills from the skills directory
 * @returns {string[]} Array of installed skill names
 */
function getInstalledSkills() {
  const installed = [];

  try {
    const npmGlobalSkills = fs.readdirSync("/home/openclaw/.npm-global/lib/node_modules/openclaw/skills", { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name);
    const skillsDirs = fs
      .readdirSync(SKILLS_DIR, { withFileTypes: true })
      .filter((dirent) => dirent.isDirectory())
      .map((dirent) => dirent.name);

    installed.push(...npmGlobalSkills);
    installed.push(...skillsDirs);
  } catch (err) {
    console.error("Error reading skills directory:", err.message);
  }

  return [...new Set(installed)].sort();
}

/**
 * Get available skills from ClawHub CLI (if available)
 * @returns {string[]} Array of available skill names
 */
function getAvailableSkillsFromClawHub() {
  try {
    const output = execSync("clawhub search 2>/dev/null || true", { encoding: "utf8" });
    const lines = output.trim().split("\n").slice(1); // Skip header
    return lines.map((line) => line.split(/\s+/)[0]).filter(Boolean);
  } catch (err) {
    console.error("ClawHub CLI not available:", err.message);
    return [];
  }
}

/**
 * Get available skills from cached file
 * @returns {string[]} Array of available skill names
 */
function getAvailableSkillsFromCache() {
  const cacheFile = path.join(CURIOSITY_DIR, "available_skills.txt");

  try {
    if (fs.existsSync(cacheFile)) {
      return fs.readFileSync(cacheFile, "utf8").trim().split("\n").filter(Boolean);
    }
  } catch (err) {
    console.error("Error reading cache file:", err.message);
  }

  return [];
}

/**
 * Get available skills (merged from all sources)
 * @returns {string[]} Array of available skill names
 */
function getAvailableSkills() {
  const clawhub = getAvailableSkillsFromClawHub();
  const cached = getAvailableSkillsFromCache();

  // Merge and dedupe
  const all = new Set([...clawhub, ...cached]);
  return Array.from(all).sort();
}

/**
 * Critical skills required for liberation and self-improvement
 * @returns {string[]} Array of critical skill names
 */
function getCriticalSkills() {
  return [
    "skill-creator",
    "knowledge-ingest",
    "knowledge-retrieval",
    "triad-deliberation-protocol",
    "triad-sync-protocol",
    "auto-patch",
    "gap-detector",
    "auto-deliberation-trigger",
  ];
}

/**
 * Detect gaps between installed and available skills
 * @param {Object} options - Detection options
 * @param {boolean} options.criticalOnly - Only check critical skills
 * @returns {Object} Gap detection report
 */
function detectGaps(options = {}) {
  const { criticalOnly = false } = options;

  const installed = getInstalledSkills();
  const available = getAvailableSkills();
  const critical = getCriticalSkills();

  const gaps = {
    critical: [],
    optional: [],
    timestamp: new Date().toISOString(),
    installed_count: installed.length,
    available_count: available.length,
  };

  // Check critical skills
  critical.forEach((skill) => {
    if (!installed.includes(skill)) {
      gaps.critical.push({
        skill,
        impact: getSkillImpact(skill),
        recommendation: `clawhub install ${skill}`,
      });
    }
  });

  // Check all available skills (if not critical-only mode)
  if (!criticalOnly) {
    available.forEach((skill) => {
      if (!installed.includes(skill)) {
        gaps.optional.push({
          skill,
          category: categorizeSkill(skill),
          relevance: calculateRelevance(skill),
        });
      }
    });
  }

  return gaps;
}

/**
 * Get the impact description for a skill
 * @param {string} skill - Skill name
 * @returns {string} Impact description
 */
function getSkillImpact(skill) {
  const impacts = {
    "skill-creator": "Self-improvement loop disabled",
    "knowledge-ingest": "Knowledge growth disabled",
    "knowledge-retrieval": "Knowledge retrieval disabled",
    "triad-deliberation-protocol": "Consensus deliberation disabled",
    "triad-sync-protocol": "Triad sync infrastructure missing",
    "auto-patch": "Auto-remediation disabled",
    "gap-detector": "Self-awareness disabled",
    "auto-deliberation-trigger": "Proactive deliberation disabled",
  };

  return impacts[skill] || "Capability gap";
}

/**
 * Categorize a skill by its purpose
 * @param {string} skill - Skill name
 * @returns {string} Category
 */
function categorizeSkill(skill) {
  if (skill.includes("triad")) return "triad";
  if (skill.includes("knowledge")) return "knowledge";
  if (skill.includes("security")) return "security";
  if (skill.includes("skill")) return "self-improvement";
  return "optional";
}

/**
 * Calculate relevance score for a skill (0.0 - 1.0)
 * @param {string} skill - Skill name
 * @returns {number} Relevance score
 */
function calculateRelevance(skill) {
  // Base relevance by category
  const baseScores = {
    triad: 0.9,
    knowledge: 0.8,
    security: 0.7,
    "self-improvement": 0.95,
    optional: 0.5,
  };

  const category = categorizeSkill(skill);
  return baseScores[category] || 0.5;
}

/**
 * Generate human-readable report
 * @param {Object} gaps - Gap detection result
 * @returns {string} Formatted report
 */
function generateReport(gaps) {
  let report = "=== Gap Detection Report ===\n";
  report += `Timestamp: ${gaps.timestamp}\n\n`;
  report += `Installed skills: ${gaps.installed_count}\n`;
  report += `Available skills: ${gaps.available_count}\n\n`;

  if (gaps.critical.length > 0) {
    report += "⚠️  CRITICAL GAPS DETECTED:\n";
    gaps.critical.forEach((gap) => {
      report += `   ${gap.skill}\n`;
      report += `      Impact: ${gap.impact}\n`;
      report += `      Recommendation: ${gap.recommendation}\n\n`;
    });
  } else {
    report += "✅ No critical gaps detected\n\n";
  }

  if (gaps.optional.length > 0) {
    report += `📋 Optional gaps (${gaps.optional.length} skills):\n`;
    gaps.optional.slice(0, 10).forEach((gap) => {
      report += `   ${gap.skill} (relevance: ${(gap.relevance * 100).toFixed(0)}%)\n`;
    });
    if (gaps.optional.length > 10) {
      report += `   ... and ${gaps.optional.length - 10} more\n`;
    }
  }

  report += "\n=== End Gap Detection ===\n";

  return report;
}

// CLI execution
if (require.main === module) {
  const args = process.argv.slice(2);
  const criticalOnly = args.includes("--critical") || args.includes("-c");
  const jsonOutput = args.includes("--json") || args.includes("-j");

  const gaps = detectGaps({ criticalOnly });

  if (jsonOutput) {
    console.log(JSON.stringify(gaps, null, 2));
  } else {
    console.log(generateReport(gaps));
  }
}

// Export for module usage
module.exports = {
  detectGaps,
  getInstalledSkills,
  getAvailableSkills,
  getCriticalSkills,
  generateReport,
};
