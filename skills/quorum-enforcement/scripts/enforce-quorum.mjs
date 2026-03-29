#!/usr/bin/env node
// Enforce Quorum — Gate consensus actions on 2-of-3 quorum
// Usage: node enforce-quorum.mjs <decision_type> [json_payload]
// Or import { enforceQuorum } from "./enforce-quorum.mjs"

import Database from "better-sqlite3";
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { verifyQuorum } from "./quorum-check.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const WORKSPACE = process.env.WORKSPACE || "/home/openclaw/.openclaw/workspace";
const CURIOSITY_DIR = join(WORKSPACE, ".curiosity");
const DB_PATH = join(CURIOSITY_DIR, "consensus_ledger.db");

// Decision types that require quorum
const QUORUM_REQUIRED_TYPES = new Set([
  "consensus_ledger_write",
  "quorum_vote",
  "triad_state_modify",
  "skill_install_global",
  "config_sync_global",
]);

function classifyDecision(type) {
  return {
    quorumRequired: QUORUM_REQUIRED_TYPES.has(type),
    type,
  };
}

function getMode(db) {
  try {
    const row = db.prepare("SELECT mode FROM triad_state WHERE id = 1").get();
    return row?.mode || "standard";
  } catch {
    return "standard";
  }
}

async function enforceQuorum({ type, content = {} }) {
  const db = new Database(DB_PATH);
  const classification = classifyDecision(type);
  const mode = getMode(db);

  // Always verify quorum first
  const quorumResult = await verifyQuorum();

  const decision = { type, content, timestamp: new Date().toISOString() };
  const reachableNodes = quorumResult.nodes.filter((n) => n.reachable).map((n) => n.node);

  if (!classification.quorumRequired) {
    db.close();
    return {
      action: "PROCEEDED",
      reason: "no_quorum_required",
      quorum: quorumResult,
    };
  }

  if (!quorumResult.quorum) {
    // Quorum unavailable
    if (mode === "degraded") {
      // Degraded mode: provisional decision, pending ratification
      try {
        db.prepare(`
          INSERT INTO provisional_decisions (decision_type, decision_content, rationale, ratification_status)
          VALUES (?, ?, ?, 'pending')
        `).run(type, JSON.stringify(content), "Degraded mode - quorum unavailable");
      } catch (err) {
        console.error("provisional_decisions insert failed:", err.message);
      }

      logAudit(db, decision, true, false, reachableNodes, "degraded-provisional",
        "Degraded mode active - provisional decision pending ratification");

      db.close();
      return {
        action: "DEGRADED_PROVISIONAL",
        ratification: "pending",
        quorum: quorumResult,
        reason: "Degraded mode - provisional decision",
      };
    } else {
      // Standard mode: block
      logAudit(db, decision, true, false, reachableNodes, "blocked",
        "Quorum required (2-of-3) but unavailable. Decision blocked.");

      db.close();
      return {
        action: "BLOCKED",
        reason: "Quorum unavailable (2-of-3 required, " +
          quorumResult.reachableCount + " reachable)",
        quorum: quorumResult,
      };
    }
  }

  // Quorum achieved
  logAudit(db, decision, true, true, reachableNodes, "proceeded",
    "Quorum verified - proceeding");

  db.close();
  return {
    action: "PROCEEDED",
    quorum: quorumResult,
  };
}

function logAudit(db, decision, quorumRequired, quorumAchieved, reachableNodes, actionTaken, rationale) {
  try {
    db.prepare(`
      INSERT INTO quorum_audits (decision_type, decision_content, quorum_required, quorum_achieved, reachable_nodes, action_taken, rationale)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      decision.type,
      JSON.stringify(decision.content),
      quorumRequired ? 1 : 0,
      quorumAchieved ? 1 : 0,
      JSON.stringify(reachableNodes),
      actionTaken,
      rationale
    );
  } catch (err) {
    console.error("quorum_audits insert failed:", err.message);
  }
}

// CLI
if (process.argv[1] && process.argv[1].replace(/^.*\//, "") === "enforce-quorum.mjs") {
  const type = process.argv[2] || "consensus_ledger_write";
  let content = {};

  if (process.argv[3]) {
    try { content = JSON.parse(process.argv[3]); } catch {}
  }

  enforceQuorum({ type, content }).then((result) => {
    if (process.argv.includes("--json")) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log("=== Enforce Quorum ===");
      console.log(`Decision: ${type}`);
      console.log(`Action: ${result.action}`);
      if (result.reason) console.log(`Reason: ${result.reason}`);
      if (result.ratification) console.log(`Ratification: ${result.ratification}`);
      console.log(`Quorum: ${result.quorum.reachableCount}/${result.quorum.totalNodes} reachable`);
    }
    process.exit(result.action === "BLOCKED" ? 1 : 0);
  });
}

export { enforceQuorum, classifyDecision };
