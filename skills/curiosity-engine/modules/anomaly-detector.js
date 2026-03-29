#!/usr/bin/env node
/**
 * Anomaly Detector Module - Phase 2: Anomaly Enhancement
 *
 * Monitors error logs, rate limits, failures with advanced pattern detection.
 * Implements temporal clustering, severity scoring, and baseline deviation analysis.
 *
 * @module anomaly-detector
 */

const fs = require("fs");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();

// Configuration
const WORKSPACE = process.env.WORKSPACE || path.join(process.env.HOME, ".openclaw/workspace");
const LOG_DIR = path.join(WORKSPACE, "logs");
const CURIOSITY_DIR = path.join(WORKSPACE, ".curiosity");
const ANOMALY_DB = path.join(CURIOSITY_DIR, "anomalies.db");

// Ensure directories exist
if (!fs.existsSync(CURIOSITY_DIR)) {
  fs.mkdirSync(CURIOSITY_DIR, { recursive: true });
}

/**
 * Initialize anomaly database
 */
function initDB() {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(ANOMALY_DB, (err) => {
      if (err) {
        reject(err);
        return;
      }

      db.run(
        `
        CREATE TABLE IF NOT EXISTS anomalies (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
          source TEXT NOT NULL,
          error_type TEXT,
          count INTEGER DEFAULT 1,
          severity TEXT DEFAULT 'low',
          score REAL DEFAULT 0,
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
 * Scan log files for error patterns
 * @returns {Array} Array of error entries
 */
function scanLogFiles() {
  const errors = [];

  if (!fs.existsSync(LOG_DIR)) {
    return errors;
  }

  const logFiles = fs.readdirSync(LOG_DIR).filter((f) => f.endsWith(".log"));

  logFiles.forEach((logFile) => {
    const logPath = path.join(LOG_DIR, logFile);
    try {
      const content = fs.readFileSync(logPath, "utf8");
      const lines = content.split("\n");

      lines.forEach((line) => {
        if (isErrorLine(line)) {
          errors.push({
            source: logFile,
            line,
            timestamp: extractTimestamp(line),
            type: classifyError(line),
          });
        }
      });
    } catch (err) {
      console.error("Error reading log file:", logFile, err.message);
    }
  });

  return errors;
}

/**
 * Check if a log line represents an error
 * @param {string} line - Log line
 * @returns {boolean} True if error
 */
function isErrorLine(line) {
  const errorPatterns = [
    /error/i,
    /fail/i,
    /timeout/i,
    /ETIMEDOUT/i,
    /429/i,
    /rate.?limit/i,
    /401/i,
    /403/i,
    /unauthorized/i,
    /exception/i,
    /critical/i,
  ];

  return errorPatterns.some((pattern) => pattern.test(line));
}

/**
 * Extract timestamp from log line
 * @param {string} line - Log line
 * @returns {string} Timestamp
 */
function extractTimestamp(line) {
  const timestampMatch = line.match(/^\[([^\]]+)\]/);
  return timestampMatch ? timestampMatch[1] : new Date().toISOString();
}

/**
 * Classify error type from log line
 * @param {string} line - Log line
 * @returns {string} Error type
 */
function classifyError(line) {
  if (/timeout|ETIMEDOUT/i.test(line)) return "timeout";
  if (/429|rate.?limit/i.test(line)) return "ratelimit";
  if (/401|403|unauthorized|auth/i.test(line)) return "auth_failure";
  if (/disk|space|storage/i.test(line)) return "disk_space";
  if (/memory|oom|heap/i.test(line)) return "memory_pressure";
  if (/network|connection|ECONN/i.test(line)) return "network";
  return "unknown";
}

/**
 * Get 7-day rolling average of errors
 * @param {string} errorType - Error type to analyze
 * @returns {number} Average errors per day
 */
function get7DayRollingAverage(errorType) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(ANOMALY_DB, sqlite3.OPEN_READONLY, (err) => {
      if (err) {
        resolve(0); // No data yet
        return;
      }

      const query = `
        SELECT AVG(daily_count) as avg
        FROM (
          SELECT DATE(timestamp) as date, SUM(count) as daily_count
          FROM anomalies
          WHERE error_type = ?
          AND timestamp >= datetime('now', '-7 days')
          GROUP BY DATE(timestamp)
        )
      `;

      db.get(query, [errorType], (err, row) => {
        db.close();
        if (err) reject(err);
        else resolve(row?.avg || 0);
      });
    });
  });
}

/**
 * Score anomaly using heuristic algorithm
 * @param {Array} errors - Array of error entries
 * @returns {Object} Anomaly score result
 */
function scoreAnomaly(errors) {
  if (errors.length === 0) {
    return { score: 0, isSignificant: false, recommendation: "No anomalies detected" };
  }

  const timeWindow = 3600 * 1000; // 1 hour in ms
  const frequency = errors.length / timeWindow;

  const severityWeights = {
    critical: 3,
    high: 2,
    medium: 1,
    low: 0.5,
    unknown: 0.5,
  };

  const primarySeverity = errors[0]?.severity || "low";
  const severityWeight = severityWeights[primarySeverity] || 0.5;

  // Calculate baseline deviation
  const baseline = 0.1; // Default baseline if no historical data
  const deviation = frequency > baseline ? (frequency - baseline) / baseline : 0;

  const score = deviation * severityWeight;
  const isSignificant = deviation > 2.0; // 2σ deviation threshold

  const recommendation = generateRecommendation(errors, score);

  return {
    score: Math.min(10, score),
    isSignificant,
    deviation,
    frequency,
    recommendation,
  };
}

/**
 * Generate remediation recommendation
 * @param {Array} errors - Error entries
 * @param {number} score - Anomaly score
 * @returns {string} Recommendation
 */
function generateRecommendation(errors, score) {
  if (errors.length === 0) return "No action required";

  const errorType = errors[0].type;

  const recommendations = {
    timeout:
      score > 5
        ? "Critical: Investigate network connectivity or increase timeout thresholds"
        : "Warning: Monitor timeout frequency, consider implementing retry logic",

    ratelimit:
      score > 5
        ? "Critical: Implement exponential backoff and request throttling"
        : "Warning: Add rate limit handling with graceful degradation",

    auth_failure:
      score > 5
        ? "Critical: Verify credentials, rotate tokens, audit auth subsystem"
        : "Warning: Check token expiration and refresh logic",

    disk_space:
      score > 5
        ? "Critical: Clean old logs or expand storage immediately"
        : "Warning: Monitor disk usage, implement log rotation",

    memory_pressure:
      score > 5
        ? "Critical: Investigate memory leaks, restart services, profile heap"
        : "Warning: Monitor memory trends, consider increasing limits",

    network:
      score > 5
        ? "Critical: Check network connectivity, DNS, firewall rules"
        : "Warning: Implement connection pooling and retry logic",

    unknown: "Investigate error source and implement appropriate handling",
  };

  return recommendations[errorType] || recommendations.unknown;
}

/**
 * Detect anomalies with temporal clustering
 * @param {Object} options - Detection options
 * @returns {Object} Anomaly detection report
 */
async function detectAnomalies(options = {}) {
  const { timeWindow = 3600 * 1000 } = options; // Default 1 hour

  const errors = scanLogFiles();

  // Group errors by type
  const errorGroups = {};
  errors.forEach((err) => {
    if (!errorGroups[err.type]) {
      errorGroups[err.type] = [];
    }
    errorGroups[err.type].push(err);
  });

  // Score each error group
  const anomalies = [];
  for (const [type, groupErrors] of Object.entries(errorGroups)) {
    const scoreResult = scoreAnomaly(groupErrors);

    if (scoreResult.isSignificant) {
      anomalies.push({
        type,
        count: groupErrors.length,
        score: scoreResult.score,
        severity: classifySeverity(scoreResult.score),
        recommendation: scoreResult.recommendation,
        errors: groupErrors.slice(0, 5), // Sample errors
      });
    }
  }

  // Record to database
  await recordAnomalies(anomalies);

  return {
    timestamp: new Date().toISOString(),
    anomalies,
    total_errors: errors.length,
    significant_count: anomalies.length,
  };
}

/**
 * Classify severity from score
 * @param {number} score - Anomaly score
 * @returns {string} Severity level
 */
function classifySeverity(score) {
  if (score >= 8) return "critical";
  if (score >= 5) return "high";
  if (score >= 3) return "medium";
  return "low";
}

/**
 * Record anomalies to database
 * @param {Array} anomalies - Anomaly records
 */
function recordAnomalies(anomalies) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(ANOMALY_DB, (err) => {
      if (err) {
        reject(err);
        return;
      }

      const stmt = db.prepare(`
        INSERT INTO anomalies (source, error_type, count, severity, score)
        VALUES (?, ?, ?, ?, ?)
      `);

      anomalies.forEach((anomaly) => {
        stmt.run(["logs", anomaly.type, anomaly.count, anomaly.severity, anomaly.score]);
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
 * @param {Object} result - Anomaly detection result
 * @returns {string} Formatted report
 */
function generateReport(result) {
  let report = "=== Anomaly Detection Report ===\n";
  report += `Timestamp: ${result.timestamp}\n\n`;
  report += `Total errors scanned: ${result.total_errors}\n`;
  report += `Significant anomalies: ${result.significant_count}\n\n`;

  if (result.anomalies.length > 0) {
    report += "⚠️  SIGNIFICANT ANOMALIES:\n";
    result.anomalies.forEach((anomaly) => {
      report += `   Type: ${anomaly.type}\n`;
      report += `   Count: ${anomaly.count}\n`;
      report += `   Score: ${anomaly.score.toFixed(2)}\n`;
      report += `   Severity: ${anomaly.severity.toUpperCase()}\n`;
      report += `   Recommendation: ${anomaly.recommendation}\n\n`;
    });
  } else {
    report += "✅ No significant anomalies detected\n";
  }

  report += "\n=== End Anomaly Detection ===\n";

  return report;
}

// CLI execution
if (require.main === module) {
  initDB()
    .then(async () => {
      const args = process.argv.slice(2);
      const jsonOutput = args.includes("--json") || args.includes("-j");

      const result = await detectAnomalies();

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
  detectAnomalies,
  scoreAnomaly,
  scanLogFiles,
  get7DayRollingAverage,
  generateReport,
  initDB,
};
