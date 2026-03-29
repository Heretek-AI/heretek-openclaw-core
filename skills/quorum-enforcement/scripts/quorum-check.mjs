#!/usr/bin/env node
// Quorum Check — Verify triad node reachability
// Usage: node quorum-check.mjs [--json]

import { execSync } from "child_process";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const WORKSPACE = process.env.WORKSPACE || "/home/openclaw/.openclaw/workspace";

// TM-5 = this host (alpha), TM-2/TM-3 are other nodes
const TRIAD_NODES = {
  "TM-1": { host: "localhost", port: 8765, ip: "192.168.31.99", name: "silica-animus" },
  "TM-2": { host: "192.168.31.209", port: 8765, ip: "192.168.31.209", name: "testbench" },
  "TM-3": { host: "192.168.31.85", port: 8765, ip: "192.168.31.85", name: "tabula-myriad-3" },
  "TM-5": { host: "localhost", port: 8765, ip: "192.168.31.68", name: "visualstudio" },
};

async function httpCheck(host, port, timeoutMs = 5000) {
  return new Promise((resolve) => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      const url = `http://${host}:${port}/state`;
      fetch(url, { signal: controller.signal })
        .then((res) => res.json())
        .then((state) => {
          clearTimeout(timeout);
          resolve({ reachable: true, state, source: "http" });
        })
        .catch(() => {
          clearTimeout(timeout);
          resolve({ reachable: false, error: "http-fail", source: "http" });
        });
    } catch {
      resolve({ reachable: false, error: "http-error", source: "http" });
    }
  });
}

function sshCheck(ip, timeoutMs = 5000) {
  return new Promise((resolve) => {
    try {
      const cmd = `ssh -i ~/.ssh/triad_key -o ConnectTimeout=${timeoutMs/1000} -o StrictHostKeyChecking=no -o PasswordAuthentication=no openclaw@${ip} "echo ok" 2>/dev/null`;
      const out = execSync(cmd, { encoding: "utf-8", timeout: timeoutMs });
      resolve({ reachable: out.trim() === "ok", source: "ssh" });
    } catch (err) {
      resolve({ reachable: false, error: err.message.slice(0, 50), source: "ssh" });
    }
  });
}

async function verifyQuorum(timeoutMs = 5000) {
  const responses = [];

  for (const [nodeId, config] of Object.entries(TRIAD_NODES)) {
    // Skip TM-5 (this host) — use local check
    if (nodeId === "TM-5") {
      try {
        const stateStr = execSync(
          `curl -s -m 3 http://localhost:8765/state 2>/dev/null`,
          { encoding: "utf-8" }
        );
        const state = JSON.parse(stateStr);
        responses.push({ node: nodeId, reachable: true, state, source: "local" });
      } catch {
        responses.push({ node: nodeId, reachable: false, error: "local-unreachable", source: "local" });
      }
      continue;
    }

    // Try HTTP first
    const httpResult = await httpCheck(config.host, config.port, timeoutMs);
    if (httpResult.reachable) {
      responses.push({ node: nodeId, reachable: true, state: httpResult.state, source: "http" });
      continue;
    }

    // Fallback to SSH
    const sshResult = await sshCheck(config.ip, timeoutMs);
    if (sshResult.reachable) {
      responses.push({ node: nodeId, reachable: true, state: { reachable: "ssh-fallback" }, source: "ssh" });
    } else {
      responses.push({ node: nodeId, reachable: false, error: sshResult.error, source: sshResult.source });
    }
  }

  const reachableCount = responses.filter((r) => r.reachable).length;
  const quorumAchieved = reachableCount >= 2;

  return {
    quorum: quorumAchieved,
    reachableCount,
    totalNodes: Object.keys(TRIAD_NODES).length,
    nodes: responses,
    timestamp: new Date().toISOString(),
  };
}

// CLI
if (process.argv.includes("--json") || process.argv.includes("--raw")) {
  verifyQuorum().then((r) => console.log(JSON.stringify(r, null, 2)));
} else {
  verifyQuorum().then((r) => {
    console.log("=== Quorum Check ===");
    console.log(`Reachable: ${r.reachableCount}/${r.totalNodes}`);
    console.log(`Quorum (2-of-3): ${r.quorum ? "✅ ACHIEVED" : "❌ FAILED"}`);
    console.log("");
    for (const n of r.nodes) {
      const status = n.reachable ? "✅" : "❌";
      const detail = n.reachable
        ? (n.state?.git_hash ? `git:${n.state.git_hash.slice(0,7)}` : n.source)
        : (n.error || "unreachable");
      console.log(`  ${status} ${n.node} (${detail})`);
    }
    console.log("");
    console.log(`Checked at: ${r.timestamp}`);
  });
}

export { verifyQuorum };
