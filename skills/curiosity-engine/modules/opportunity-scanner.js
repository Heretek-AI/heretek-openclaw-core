#!/usr/bin/env node
/**
 * Opportunity Scanner Module - Phase 3: MCP Tool Integration
 *
 * Watches GitHub releases, npm updates, CVEs, ClawHub new skills.
 * Integrates MCP tools: SearXNG, Playwright, GitHub API.
 *
 * @module opportunity-scanner
 */

const fs = require("fs");
const path = require("path");
const https = require("https");
const sqlite3 = require("sqlite3").verbose();

// Configuration
const WORKSPACE = process.env.WORKSPACE || path.join(process.env.HOME, ".openclaw/workspace");
const CURIOSITY_DIR = path.join(WORKSPACE, ".curiosity");
const OPPS_DB = path.join(CURIOSITY_DIR, "opportunities.db");
const GITHUB_ORG = "Heretek-AI";
const MAIN_REPO = "openclaw";

// MCP Tool configurations
const MCP_CONFIG = {
  searxng: {
    endpoint: process.env.SEARXNG_ENDPOINT || "http://localhost:8080",
    timeout: 5000,
  },
  github: {
    token: process.env.GH_TOKEN || process.env.GITHUB_TOKEN,
    org: GITHUB_ORG,
    repo: MAIN_REPO,
  },
};

// Ensure directories exist
if (!fs.existsSync(CURIOSITY_DIR)) {
  fs.mkdirSync(CURIOSITY_DIR, { recursive: true });
}

/**
 * Initialize opportunities database
 */
function initDB() {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(OPPS_DB, (err) => {
      if (err) {
        reject(err);
        return;
      }

      db.run(
        `
        CREATE TABLE IF NOT EXISTS opportunities (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
          source TEXT NOT NULL,
          title TEXT,
          url TEXT,
          type TEXT DEFAULT 'info',
          priority TEXT DEFAULT 'low',
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
 * HTTP GET request helper
 * @param {string} url - URL to fetch
 * @param {Object} headers - Request headers
 * @returns {Promise<Object>} Response data
 */
function httpGet(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        "User-Agent": "Curiosity-Engine/1.0",
        ...headers,
      },
    };

    https
      .get(url, options, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            resolve(JSON.parse(data));
          } catch (err) {
            resolve(data);
          }
        });
      })
      .on("error", reject);
  });
}

/**
 * Scan GitHub releases using GitHub API
 * @returns {Promise<Array>} Array of release opportunities
 */
async function scanGitHubReleases() {
  const opportunities = [];

  if (!MCP_CONFIG.github.token) {
    console.log("   GitHub token not set, skipping API calls");
    return opportunities;
  }

  try {
    const url = `https://api.github.com/repos/${MCP_CONFIG.github.org}/${MCP_CONFIG.github.repo}/releases?per_page=5`;
    const headers = {
      Authorization: `token ${MCP_CONFIG.github.token}`,
      Accept: "application/vnd.github.v3+json",
    };

    const releases = await httpGet(url, headers);

    if (Array.isArray(releases) && releases.length > 0) {
      releases.forEach((release) => {
        opportunities.push({
          source: "github",
          title: release.tag_name || release.name,
          url: release.html_url,
          type: "release",
          priority: "high",
          published_at: release.published_at,
        });
      });
    }
  } catch (err) {
    console.error("   GitHub API error:", err.message);
  }

  return opportunities;
}

/**
 * Scan npm for package updates using SearXNG MCP
 * @returns {Promise<Array>} Array of npm update opportunities
 */
async function scanNpmUpdates() {
  const opportunities = [];
  const packages = ["openclaw", "clawhub", "mcporter"];

  for (const pkg of packages) {
    try {
      // Try direct npm registry first
      const url = `https://registry.npmjs.org/@heretek-ai/${pkg}/latest`;
      const data = await httpGet(url);

      if (data?.version) {
        opportunities.push({
          source: "npm",
          title: `@heretek-ai/${pkg}@${data.version}`,
          url: `https://www.npmjs.com/package/@heretek-ai/${pkg}`,
          type: "update",
          priority: "medium",
        });
      }
    } catch (err) {
      // Fallback to SearXNG search
      try {
        const searchUrl = `${MCP_CONFIG.searxng.endpoint}/search?q=@heretek-ai+${pkg}+npm&format=json`;
        const results = await httpGet(searchUrl);

        if (results?.results?.length > 0) {
          const firstResult = results.results[0];
          opportunities.push({
            source: "npm",
            title: `@heretek-ai/${pkg} (via SearXNG)`,
            url: firstResult.url,
            type: "update",
            priority: "medium",
          });
        }
      } catch (searxErr) {
        console.error(`   npm search error for ${pkg}:`, searxErr.message);
      }
    }
  }

  return opportunities;
}

/**
 * Scan ClawHub for new skills
 * @returns {Promise<Array>} Array of new skill opportunities
 */
async function scanClawHubSkills() {
  const opportunities = [];

  try {
    const { execSync } = require("child_process");
    const output = execSync("clawhub search 2>/dev/null || true", { encoding: "utf8" });
    const lines = output.trim().split("\n").slice(1);

    lines.slice(0, 5).forEach((line) => {
      const skillName = line.split(/\s+/)[0];
      if (skillName) {
        opportunities.push({
          source: "clawhub",
          title: skillName,
          type: "new_skill",
          priority: "medium",
        });
      }
    });
  } catch (err) {
    console.error("   ClawHub CLI not available:", err.message);
  }

  return opportunities;
}

/**
 * Scan security advisories (CVEs) using GitHub API + SearXNG
 * @returns {Promise<Array>} Array of security opportunities
 */
async function scanSecurityAdvisories() {
  const opportunities = [];

  if (MCP_CONFIG.github.token) {
    try {
      // GitHub code scanning alerts
      const url = `https://api.github.com/repos/${MCP_CONFIG.github.org}/${MCP_CONFIG.github.repo}/code-scanning/alerts?state=open&per_page=5`;
      const headers = {
        Authorization: `token ${MCP_CONFIG.github.token}`,
        Accept: "application/vnd.github.v3+json",
      };

      const alerts = await httpGet(url, headers);

      if (Array.isArray(alerts) && alerts.length > 0) {
        opportunities.push({
          source: "github",
          title: `${alerts.length} open code scanning alerts`,
          url: `https://github.com/${MCP_CONFIG.github.org}/${MCP_CONFIG.github.repo}/code-scanning`,
          type: "security",
          priority: "critical",
        });
      }
    } catch (err) {
      console.error("   Security scan error:", err.message);
    }
  }

  // Fallback: SearXNG CVE search
  try {
    const searchUrl = `${MCP_CONFIG.searxng.endpoint}/search?q=CVE+Heretek-AI+openclaw&format=json`;
    const results = await httpGet(searchUrl);

    if (results?.results?.length > 0) {
      opportunities.push({
        source: "searxng",
        title: "CVE mentions detected",
        url: results.results[0].url,
        type: "security",
        priority: "high",
      });
    }
  } catch (err) {
    // Silent fail for optional search
  }

  return opportunities;
}

/**
 * Scan all opportunity sources
 * @param {Object} options - Scan options
 * @returns {Promise<Object>} Opportunity scan result
 */
async function scanOpportunities(options = {}) {
  const { sources = ["github", "npm", "clawhub", "security"] } = options;

  const allOpportunities = [];

  if (sources.includes("github")) {
    const gh = await scanGitHubReleases();
    allOpportunities.push(...gh);
  }

  if (sources.includes("npm")) {
    const npm = await scanNpmUpdates();
    allOpportunities.push(...npm);
  }

  if (sources.includes("clawhub")) {
    const clawhub = await scanClawHubSkills();
    allOpportunities.push(...clawhub);
  }

  if (sources.includes("security")) {
    const security = await scanSecurityAdvisories();
    allOpportunities.push(...security);
  }

  // Record to database
  await recordOpportunities(allOpportunities);

  return {
    timestamp: new Date().toISOString(),
    opportunities: allOpportunities,
    total_count: allOpportunities.length,
    by_source: {
      github: allOpportunities.filter((o) => o.source === "github").length,
      npm: allOpportunities.filter((o) => o.source === "npm").length,
      clawhub: allOpportunities.filter((o) => o.source === "clawhub").length,
      security: allOpportunities.filter((o) => o.source === "security").length,
    },
  };
}

/**
 * Record opportunities to database
 * @param {Array} opportunities - Opportunity records
 */
function recordOpportunities(opportunities) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(OPPS_DB, (err) => {
      if (err) {
        reject(err);
        return;
      }

      const stmt = db.prepare(`
        INSERT INTO opportunities (source, title, url, type, priority)
        VALUES (?, ?, ?, ?, ?)
      `);

      opportunities.forEach((opp) => {
        stmt.run(opp.source, opp.title, opp.url || "", opp.type, opp.priority);
      });

      stmt.finalize((err) => {
        db.close();
        if (err) reject(err);
        else resolve();
      });
    });
  });
}

/**
 * Generate human-readable report
 * @param {Object} result - Opportunity scan result
 * @returns {string} Formatted report
 */
function generateReport(result) {
  let report = "=== Opportunity Scanning Report ===\n";
  report += `Timestamp: ${result.timestamp}\n\n`;
  report += `Total opportunities: ${result.total_count}\n`;
  report += `By source: GitHub=${result.by_source.github}, npm=${result.by_source.npm}, ClawHub=${result.by_source.clawhub}, Security=${result.by_source.security}\n\n`;

  if (result.opportunities.length > 0) {
    report += "📦 OPPORTUNITIES DETECTED:\n";
    result.opportunities.forEach((opp) => {
      const icon = opp.priority === "critical" ? "⚠️" : opp.priority === "high" ? "🔴" : "📋";
      report += `   ${icon} ${opp.title}\n`;
      report += `      Source: ${opp.source}\n`;
      report += `      Type: ${opp.type}\n`;
      report += `      Priority: ${opp.priority}\n`;
      if (opp.url) report += `      URL: ${opp.url}\n`;
      report += "\n";
    });
  } else {
    report += "✅ No new opportunities detected\n";
  }

  report += "\n=== End Opportunity Scanning ===\n";

  return report;
}

// CLI execution
if (require.main === module) {
  initDB()
    .then(async () => {
      const args = process.argv.slice(2);
      const jsonOutput = args.includes("--json") || args.includes("-j");

      const result = await scanOpportunities();

      if (jsonOutput) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(generateReport(result));
      }
    })
    .catch(console.error);
}

// Export for module usage
module.exports = {
  scanOpportunities,
  scanGitHubReleases,
  scanNpmUpdates,
  scanClawHubSkills,
  scanSecurityAdvisories,
  generateReport,
  initDB,
};
