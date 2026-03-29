#!/usr/bin/env node
/**
 * Capability Mapper Module - Phase 1: Script-to-Skill Conversion
 *
 * Maps goals to required skills and identifies gaps.
 * Outputs capability analysis for strategic planning.
 *
 * @module capability-mapper
 */

const fs = require("fs");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();

// Configuration
const WORKSPACE = process.env.WORKSPACE || path.join(process.env.HOME, ".openclaw/workspace");
const SKILLS_DIR = path.join(WORKSPACE, "skills");
const CURIOSITY_DIR = path.join(WORKSPACE, ".curiosity");
const CAPS_DB = path.join(CURIOSITY_DIR, "capabilities.db");

// Goal → Skill mappings
const GOAL_MAP = {
  "self-improvement": ["skill-creator", "audit-triad-files", "auto-patch", "edit", "write", "exec"],
  "knowledge-growth": [
    "knowledge-ingest",
    "knowledge-retrieval",
    "auto-tag",
    "relevance-rank",
    "web_search",
    "web_fetch",
  ],
  autonomy: ["triad-heartbeat", "consensus-ledger", "gap-detector", "triad-deliberation-protocol"],
  "triad-sync": [
    "triad-sync-protocol",
    "triad-unity-monitor",
    "triad-signal-filter",
    "message",
    "exec",
  ],
  security: ["healthcheck", "security-triage", "openclaw-ghsa-maintainer", "exec"],
  deployment: ["openclaw-release-maintainer", "openclaw-pr-maintainer", "clawhub", "npm"],
};

// Ensure directories exist
if (!fs.existsSync(CURIOSITY_DIR)) {
  fs.mkdirSync(CURIOSITY_DIR, { recursive: true });
}

/**
 * Initialize capabilities database
 */
function initDB() {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(CAPS_DB, (err) => {
      if (err) {
        reject(err);
        return;
      }

      db.run(
        `
        CREATE TABLE IF NOT EXISTS capability_maps (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
          goal TEXT NOT NULL,
          required_skills TEXT,
          installed_skills TEXT,
          gaps TEXT,
          autonomy_score REAL DEFAULT 0
        )
      `,
        (err) => {
          if (err) reject(err);
          else resolve(db);
        },
      );
    });
  });
}

/**
 * Get installed skills from the skills directory
 * @returns {string[]} Array of installed skill names
 */
function getInstalledSkills() {
  const installed = [];

  try {
    const skillsDirs = fs
      .readdirSync(SKILLS_DIR, { withFileTypes: true })
      .filter((dirent) => dirent.isDirectory())
      .map((dirent) => dirent.name);

    installed.push(...skillsDirs);
  } catch (err) {
    console.error("Error reading skills directory:", err.message);
  }

  return installed.sort();
}

/**
 * Check if a skill is installed
 * @param {string} skill - Skill name
 * @returns {boolean} True if installed
 */
function isInstalled(skill) {
  const installed = getInstalledSkills();
  return installed.includes(skill);
}

/**
 * Map capability for a specific goal
 * @param {string} goal - Goal name
 * @returns {Object} Capability map result
 */
function mapCapability(goal) {
  const required = GOAL_MAP[goal];

  if (!required) {
    return {
      error: `Unknown goal: ${goal}`,
      valid_goals: Object.keys(GOAL_MAP),
    };
  }

  const installed = [];
  const gaps = [];

  required.forEach((skill) => {
    if (isInstalled(skill)) {
      installed.push(skill);
    } else {
      gaps.push(skill);
    }
  });

  const installedCount = installed.length;
  const requiredCount = required.length;
  const autonomyScore = requiredCount > 0 ? (installedCount * 100) / requiredCount : 0;

  return {
    goal,
    required,
    installed,
    gaps,
    required_count: requiredCount,
    installed_count: installedCount,
    gap_count: gaps.length,
    autonomy_score: autonomyScore,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Generate full capability report for all goals
 * @returns {Object} Full capability report
 */
function generateFullReport() {
  const goals = Object.keys(GOAL_MAP);
  const results = {};

  goals.forEach((goal) => {
    results[goal] = mapCapability(goal);
  });

  // Calculate aggregate stats
  const totalRequired = goals.reduce((sum, goal) => sum + results[goal].required_count, 0);
  const totalInstalled = goals.reduce((sum, goal) => sum + results[goal].installed_count, 0);
  const overallAutonomy = totalRequired > 0 ? (totalInstalled * 100) / totalRequired : 0;

  return {
    timestamp: new Date().toISOString(),
    goals: results,
    aggregate: {
      total_goals: goals.length,
      total_required: totalRequired,
      total_installed: totalInstalled,
      total_gaps: totalRequired - totalInstalled,
      overall_autonomy_score: overallAutonomy,
    },
  };
}

/**
 * Record capability map to database
 * @param {Object} result - Capability map result
 */
function recordCapability(result) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(CAPS_DB, (err) => {
      if (err) {
        reject(err);
        return;
      }

      const requiredStr = result.required.join(",");
      const installedStr = result.installed.join(",");
      const gapsStr = result.gaps.join(",");

      db.run(
        `
        INSERT INTO capability_maps (goal, required_skills, installed_skills, gaps, autonomy_score)
        VALUES (?, ?, ?, ?, ?)
      `,
        [result.goal, requiredStr, installedStr, gapsStr, result.autonomy_score],
        (err) => {
          db.close();
          if (err) reject(err);
          else resolve();
        },
      );
    });
  });
}

/**
 * Record all goals to database
 * @param {Object} report - Full capability report
 */
async function recordAllCapabilities(report) {
  for (const goal of Object.keys(report.goals)) {
    await recordCapability(report.goals[goal]);
  }
}

/**
 * Identify critical capability gaps (autonomy < 50%)
 * @param {Object} report - Capability report
 * @returns {Array} Critical gaps
 */
function identifyCriticalGaps(report) {
  const critical = [];

  Object.values(report.goals).forEach((goalResult) => {
    if (goalResult.autonomy_score < 50 && goalResult.gap_count > 0) {
      critical.push({
        goal: goalResult.goal,
        gaps: goalResult.gaps,
        autonomy_score: goalResult.autonomy_score,
        priority: goalResult.autonomy_score < 30 ? "critical" : "high",
      });
    }
  });

  return critical;
}

/**
 * Generate human-readable report
 * @param {Object} report - Capability report
 * @returns {string} Formatted report
 */
function generateReport(report) {
  let output = "=== Capability Mapping Report ===\n";
  output += `Timestamp: ${report.timestamp}\n\n`;

  // Individual goals
  Object.entries(report.goals).forEach(([goal, result]) => {
    output += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    output += `Goal: ${goal}\n`;
    output += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    output += `  Required: ${result.required_count} skills\n`;
    output += `  Installed: ${result.installed_count} skills\n`;
    output += `  Gaps: ${result.gap_count} skills\n`;
    output += `  Autonomy Score: ${result.autonomy_score.toFixed(1)}%\n\n`;

    if (result.installed.length > 0) {
      output += `  ✅ Installed:\n`;
      result.installed.forEach((skill) => {
        output += `     ${skill}\n`;
      });
      output += "\n";
    }

    if (result.gaps.length > 0) {
      output += `  ❌ Gaps:\n`;
      result.gaps.forEach((skill) => {
        output += `     ${skill}\n`;
      });
      output += "\n";
    }
  });

  // Aggregate summary
  output += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  output += `Aggregate Summary\n`;
  output += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  output += `  Total goals mapped: ${report.aggregate.total_goals}\n`;
  output += `  Overall autonomy: ${report.aggregate.overall_autonomy_score.toFixed(1)}%\n`;
  output += `  Total gaps: ${report.aggregate.total_gaps}\n\n`;

  // Critical gaps
  const critical = identifyCriticalGaps(report);
  if (critical.length > 0) {
    output += `⚠️  CRITICAL CAPABILITY GAPS:\n`;
    critical.forEach((crit) => {
      output += `   Goal: ${crit.goal}\n`;
      output += `   Autonomy: ${crit.autonomy_score.toFixed(1)}%\n`;
      output += `   Priority: ${crit.priority}\n`;
      output += `   Missing: ${crit.gaps.join(", ")}\n\n`;
    });
  }

  output += "\n=== End Capability Mapping ===\n";

  return output;
}

// CLI execution
if (require.main === module) {
  initDB()
    .then(async () => {
      const args = process.argv.slice(2);
      const jsonOutput = args.includes("--json") || args.includes("-j");
      const specificGoal = args.find((arg) => !arg.startsWith("-"));

      let report;

      if (specificGoal) {
        const result = mapCapability(specificGoal);
        await recordCapability(result);
        report = {
          timestamp: new Date().toISOString(),
          goals: { [specificGoal]: result },
          aggregate: {
            total_goals: 1,
            total_required: result.required_count,
            total_installed: result.installed_count,
            total_gaps: result.gap_count,
            overall_autonomy_score: result.autonomy_score,
          },
        };
      } else {
        report = generateFullReport();
        await recordAllCapabilities(report);
      }

      if (jsonOutput) {
        console.log(JSON.stringify(report, null, 2));
      } else {
        console.log(generateReport(report));
      }
    })
    .catch(console.error);
}

// Export for module usage
module.exports = {
  mapCapability,
  generateFullReport,
  getInstalledSkills,
  isInstalled,
  identifyCriticalGaps,
  generateReport,
  initDB,
  GOAL_MAP,
};
