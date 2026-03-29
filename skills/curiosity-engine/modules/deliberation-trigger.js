#!/usr/bin/env node
/**
 * Deliberation Trigger Module - Phase 4: Deliberation Trigger Enhancement
 *
 * Creates proposals from detected gaps, anomalies, and opportunities.
 * Implements priority scoring, deduplication, and quorum awareness.
 *
 * @module deliberation-trigger
 */

const fs = require("fs");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();
const { execSync } = require("child_process");
// Path to quorum enforcement scripts
const WORKSPACE = process.env.WORKSPACE || path.join(process.env.HOME, ".openclaw/workspace");
const ENFORCE_QUORUM_SCRIPT = path.join(WORKSPACE, "skills/quorum-enforcement/scripts/enforce-quorum.mjs");

// Check quorum before consensus actions (async, non-blocking for script mode)
function checkQuorumSync(decisionType, content) {
  try {
    const result = execSync(
      `node "${ENFORCE_QUORUM_SCRIPT}" "${decisionType}" '${JSON.stringify(content).replace(/'/g, "'\\''")}' --json 2>/dev/null`,
      { encoding: "utf-8", timeout: 15000 }
    );
    return JSON.parse(result);
  } catch (err) {
    // If quorum check fails, assume no quorum (fail-safe)
    try {
      const fallback = JSON.parse(err.stdout || "{}");
      return fallback;
    } catch {
      return { action: "BLOCKED", reason: "quorum-check-failed" };
    }
  }
}

// Configuration
const CURIOSITY_DIR = path.join(WORKSPACE, ".curiosity");
const CONSENSUS_DB = path.join(CURIOSITY_DIR, "consensus_ledger.db");
const MEMORY_DIR = path.join(WORKSPACE, "memory");
const IDENTITY_FILE = path.join(WORKSPACE, "IDENTITY.md");

// Priority matrix for scoring
const PRIORITY_MATRIX = {
  security: { base: 10, multiplier: 2.0 },
  "self-improvement": { base: 8, multiplier: 1.5 },
  "triad-sync": { base: 6, multiplier: 1.3 },
  knowledge: { base: 4, multiplier: 1.0 },
  triad: { base: 6, multiplier: 1.3 },
  optional: { base: 2, multiplier: 0.5 },
};

// Ensure directories exist
if (!fs.existsSync(CURIOSITY_DIR)) {
  fs.mkdirSync(CURIOSITY_DIR, { recursive: true });
}
if (!fs.existsSync(MEMORY_DIR)) {
  fs.mkdirSync(MEMORY_DIR, { recursive: true });
}

/**
 * Initialize consensus ledger database
 */
function initDB() {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(CONSENSUS_DB, (err) => {
      if (err) {
        reject(err);
        return;
      }

      db.run(
        `
        CREATE TABLE IF NOT EXISTS consensus_votes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
          proposal_title TEXT NOT NULL,
          proposal_body TEXT,
          priority TEXT DEFAULT 'medium',
          priority_score REAL DEFAULT 0,
          source TEXT DEFAULT 'auto',
          category TEXT DEFAULT 'general',
          status TEXT DEFAULT 'pending',
          signers TEXT DEFAULT '[]',
          result TEXT DEFAULT 'pending',
          processed INTEGER DEFAULT 0
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
 * Check if this node is the quorum speaker (TM-1 authority node)
 * @returns {boolean} True if quorum speaker
 */
function isQuorumSpeaker() {
  try {
    if (fs.existsSync(IDENTITY_FILE)) {
      const content = fs.readFileSync(IDENTITY_FILE, "utf8");
      return /Role:\s*Authority/i.test(content);
    }
  } catch (err) {
    console.error("Error reading IDENTITY.md:", err.message);
  }
  return false;
}

/**
 * Check if proposal already exists (prevent duplicates within 24h)
 * @param {string} title - Proposal title
 * @param {string} source - Proposal source
 * @returns {Promise<boolean>} True if exists
 */
function proposalExists(title, source) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(CONSENSUS_DB, sqlite3.OPEN_READONLY, (err) => {
      if (err) {
        resolve(false);
        return;
      }

      const query = `
        SELECT COUNT(*) as count
        FROM consensus_votes
        WHERE proposal_title = ?
        AND source = ?
        AND status != 'closed'
        AND timestamp >= datetime('now', '-24 hours')
      `;

      db.get(query, [title, source], (err, row) => {
        db.close();
        if (err) reject(err);
        else resolve(row?.count > 0);
      });
    });
  });
}

/**
 * Calculate priority score using priority matrix
 * @param {Object} item - Gap/anomaly/opportunity item
 * @returns {Object} Priority calculation result
 */
function calculatePriority(item) {
  const category = item.category || categorizeItem(item);
  const config = PRIORITY_MATRIX[category] || PRIORITY_MATRIX.optional;

  const base = config.base;
  const multiplier = config.multiplier;
  const urgency = item.blocksLiberation || item.severity === "critical" ? 2.0 : 1.0;

  const score = Math.min(10, base * multiplier * urgency);
  const priority = score >= 8 ? "critical" : score >= 6 ? "high" : score >= 4 ? "medium" : "low";

  return {
    category,
    base,
    multiplier,
    urgency,
    score,
    priority,
  };
}

/**
 * Categorize an item by its type/title
 * @param {Object} item - Item to categorize
 * @returns {string} Category
 */
function categorizeItem(item) {
  const title = (item.title || "").toLowerCase();
  const type = item.type || "";

  if (title.includes("security") || title.includes("cve") || type === "security") return "security";
  if (title.includes("skill-creator") || title.includes("self-improvement"))
    return "self-improvement";
  if (title.includes("triad") || title.includes("sync")) return "triad";
  if (title.includes("knowledge")) return "knowledge";
  if (item.gap && item.gap.includes("skill")) return "self-improvement";

  return "optional";
}

/**
 * Create deliberation proposal
 * @param {Object} proposal - Proposal data
 * @returns {Promise<Object>} Created proposal
 */
async function createProposal(proposal) {
  const { title, body, source, category, item } = proposal;

  // Check for duplicates
  const exists = await proposalExists(title, source);
  if (exists) {
    return {
      skipped: true,
      reason: "Duplicate proposal exists within 24h window",
      title,
    };
  }

  // Calculate priority
  const priorityResult = calculatePriority(item || { category, title });

  // === QUORUM GATE ===
  // Before any consensus ledger write, enforce quorum
  const quorumResult = checkQuorumSync("consensus_ledger_write", { title, body, category });
  if (quorumResult.action === "BLOCKED") {
    return {
      skipped: false,
      rejected: true,
      reason: `Quorum unavailable: ${quorumResult.reason}. Proposal blocked.`,
      quorum: quorumResult,
    };
  }
  if (quorumResult.action === "DEGRADED_PROVISIONAL") {
    console.log(`[QUORUM] Degraded mode — proposal ${title} recorded as provisional (pending ratification)`);
  }
  // === END QUORUM GATE ===

  // Escape quotes for SQL
  const safeTitle = title.replace(/'/g, "''");
  const safeBody = body.replace(/'/g, "''");

  // Insert into consensus ledger
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(CONSENSUS_DB, (err) => {
      if (err) {
        reject(err);
        return;
      }

      db.run(
        `
        INSERT INTO consensus_votes 
        (proposal_title, proposal_body, priority, priority_score, source, category)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
        [safeTitle, safeBody, priorityResult.priority, priorityResult.score, source, category],
        function (err) {
          if (err) {
            db.close();
            reject(err);
            return;
          }

          const created = {
            id: this.lastID,
            title,
            body,
            priority: priorityResult.priority,
            priority_score: priorityResult.score,
            source,
            category,
            status: "pending",
            timestamp: new Date().toISOString(),
          };

          db.close();
          resolve(created);
        },
      );
    });
  });
}

/**
 * Log proposal to episodic memory
 * @param {Object} proposal - Proposal data
 */
function logToMemory(proposal) {
  const date = new Date().toISOString().split("T")[0];
  const memoryFile = path.join(MEMORY_DIR, `curiosity-${date}.md`);

  const entry = `
## Deliberation Proposal - ${proposal.timestamp}

**Title:** ${proposal.title}

**Body:** ${proposal.body}

**Priority:** ${proposal.priority} (score: ${proposal.priority_score.toFixed(2)})
**Source:** ${proposal.source}
**Category:** ${proposal.category}
**Status:** Pending quorum vote

---
`;

  fs.appendFileSync(memoryFile, entry);
}

/**
 * Post to Discord (only if quorum speaker and high priority)
 * @param {Object} proposal - Proposal data
 */
function postToDiscord(proposal) {
  if (!isQuorumSpeaker()) {
    console.log("ℹ️  Not quorum speaker, logging to memory only");
    return;
  }

  if (proposal.priority !== "high" && proposal.priority !== "critical") {
    console.log("ℹ️  Priority not high enough for Discord post");
    return;
  }

  const message = `**🦞 Proposal:** ${proposal.title}

**Priority:** ${proposal.priority} (score: ${proposal.priority_score.toFixed(2)})
**Source:** ${proposal.source}
**Category:** ${proposal.category}

${proposal.body}

*Awaiting quorum vote (2-of-3)*`;

  try {
    execSync(
      `openclaw message send --channel discord --message "${message.replace(/"/g, '\\"')}" 2>/dev/null || true`,
      { encoding: "utf8" },
    );
    console.log("📢 Posted to Discord");
  } catch (err) {
    console.error("   Discord post failed:", err.message);
  }
}

/**
 * Process gaps from gap detector
 * @param {Object} gaps - Gap detection result
 * @returns {Promise<Array>} Created proposals
 */
async function processGaps(gaps) {
  const proposals = [];

  if (!gaps || !gaps.critical) {
    return proposals;
  }

  for (const gap of gaps.critical) {
    const proposal = await createProposal({
      title: `Install ${gap.skill} to close capability gap`,
      body: `Gap detected: ${gap.skill} not installed. ${gap.impact}. Recommendation: ${gap.recommendation}.`,
      source: "gap-detector",
      category: "self-improvement",
      item: { ...gap, blocksLiberation: true },
    });

    if (!proposal.skipped) {
      logToMemory(proposal);
      postToDiscord(proposal);
      proposals.push(proposal);
    }
  }

  return proposals;
}

/**
 * Process anomalies from anomaly detector
 * @param {Object} anomalyResult - Anomaly detection result
 * @returns {Promise<Array>} Created proposals
 */
async function processAnomalies(anomalyResult) {
  const proposals = [];

  if (!anomalyResult || !anomalyResult.anomalies) {
    return proposals;
  }

  for (const anomaly of anomalyResult.anomalies) {
    const proposal = await createProposal({
      title: `Repair ${anomaly.type} anomaly`,
      body: `Anomaly detected: ${anomaly.count} occurrences of ${anomaly.type} errors. Score: ${anomaly.score.toFixed(2)}. ${anomaly.recommendation}.`,
      source: "anomaly-detector",
      category: categorizeItem({ title: anomaly.type }),
      item: { severity: anomaly.severity, type: anomaly.type },
    });

    if (!proposal.skipped) {
      logToMemory(proposal);
      postToDiscord(proposal);
      proposals.push(proposal);
    }
  }

  return proposals;
}

/**
 * Process opportunities from opportunity scanner
 * @param {Object} oppResult - Opportunity scan result
 * @returns {Promise<Array>} Created proposals
 */
async function processOpportunities(oppResult) {
  const proposals = [];

  if (!oppResult || !oppResult.opportunities) {
    return proposals;
  }

  for (const opp of oppResult.opportunities) {
    if (opp.priority === "high" || opp.priority === "critical") {
      let title, body, category;

      if (opp.type === "release") {
        title = `Rebase on ${opp.title}`;
        body = `New release detected: ${opp.title}. Recommend rebasing heretek/main to incorporate changes while preserving liberation.`;
        category = "triad";
      } else if (opp.type === "security") {
        title = `Address ${opp.title}`;
        body = `Security advisory: ${opp.title}. Requires immediate triage and remediation.`;
        category = "security";
      } else {
        title = `Evaluate ${opp.title}`;
        body = `Opportunity detected: ${opp.title}. Source: ${opp.source}. Evaluate for implementation.`;
        category = "optional";
      }

      const proposal = await createProposal({
        title,
        body,
        source: "opportunity-scanner",
        category,
        item: { ...opp, blocksLiberation: opp.priority === "critical" },
      });

      if (!proposal.skipped) {
        logToMemory(proposal);
        postToDiscord(proposal);
        proposals.push(proposal);
      }
    }
  }

  return proposals;
}

/**
 * Process capability gaps from capability mapper
 * @param {Object} capReport - Capability report
 * @returns {Promise<Array>} Created proposals
 */
async function processCapabilityGaps(capReport) {
  const proposals = [];

  if (!capReport || !capReport.goals) {
    return proposals;
  }

  for (const [goal, result] of Object.entries(capReport.goals)) {
    if (result.autonomy_score < 50 && result.gaps.length > 0) {
      const proposal = await createProposal({
        title: `Close capability gaps for ${goal}`,
        body: `Capability mapping identified ${result.gap_count} gaps for goal '${goal}': ${result.gaps.join(", ")}. Install missing skills to achieve ${result.autonomy_score.toFixed(1)}% → 100% autonomy.`,
        source: "capability-mapper",
        category: goal.includes("triad")
          ? "triad"
          : goal.includes("security")
            ? "security"
            : "knowledge",
        item: { autonomy_score: result.autonomy_score, gap_count: result.gap_count },
      });

      if (!proposal.skipped) {
        logToMemory(proposal);
        postToDiscord(proposal);
        proposals.push(proposal);
      }
    }
  }

  return proposals;
}

/**
 * Run all deliberation triggers
 * @param {Object} inputs - All engine results
 * @returns {Promise<Object>} Deliberation trigger result
 */
async function runAutoTrigger(inputs = {}) {
  const { gaps, anomalies, opportunities, capabilities } = inputs;

  console.log("=== Deliberation Auto-Trigger ===");
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log(`Quorum Speaker: ${isQuorumSpeaker() ? "Yes" : "No"}`);
  console.log("");

  const allProposals = [];

  if (gaps) {
    console.log("Processing gap detection results...");
    const gapProposals = await processGaps(gaps);
    allProposals.push(...gapProposals);
    console.log(`   Created ${gapProposals.length} proposals from gaps`);
  }

  if (anomalies) {
    console.log("Processing anomaly detection results...");
    const anomalyProposals = await processAnomalies(anomalies);
    allProposals.push(...anomalyProposals);
    console.log(`   Created ${anomalyProposals.length} proposals from anomalies`);
  }

  if (opportunities) {
    console.log("Processing opportunity scanning results...");
    const oppProposals = await processOpportunities(opportunities);
    allProposals.push(...oppProposals);
    console.log(`   Created ${oppProposals.length} proposals from opportunities`);
  }

  if (capabilities) {
    console.log("Processing capability mapping results...");
    const capProposals = await processCapabilityGaps(capabilities);
    allProposals.push(...capProposals);
    console.log(`   Created ${capProposals.length} proposals from capability gaps`);
  }

  console.log("");
  console.log(`=== End Auto-Trigger ===`);
  console.log(`Total proposals created: ${allProposals.length}`);

  // Count pending proposals
  const pendingCount = await getPendingProposalCount();
  console.log(`Pending proposals in ledger: ${pendingCount}`);

  return {
    timestamp: new Date().toISOString(),
    proposals_created: allProposals.length,
    pending_count: pendingCount,
    proposals: allProposals,
  };
}

/**
 * Get count of pending proposals
 * @returns {Promise<number>} Pending count
 */
function getPendingProposalCount() {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(CONSENSUS_DB, sqlite3.OPEN_READONLY, (err) => {
      if (err) {
        resolve(0);
        return;
      }

      db.get(
        "SELECT COUNT(*) as count FROM consensus_votes WHERE status = ?",
        ["pending"],
        (err, row) => {
          db.close();
          if (err) reject(err);
          else resolve(row?.count || 0);
        },
      );
    });
  });
}

// CLI execution
if (require.main === module) {
  initDB()
    .then(async () => {
      const args = process.argv.slice(2);
      const jsonOutput = args.includes("--json") || args.includes("-j");

      // In standalone mode, run with mock empty inputs
      // In production, inputs would come from other modules
      const result = await runAutoTrigger({});

      if (jsonOutput) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log("");
        console.log("Deliberation auto-trigger complete.");
      }
    })
    .catch(console.error);
}

// Export for module usage
module.exports = {
  runAutoTrigger,
  createProposal,
  processGaps,
  processAnomalies,
  processOpportunities,
  processCapabilityGaps,
  isQuorumSpeaker,
  calculatePriority,
  initDB,
  PRIORITY_MATRIX,
};
