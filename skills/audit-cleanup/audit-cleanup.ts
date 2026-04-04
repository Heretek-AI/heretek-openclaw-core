/**
 * ==============================================================================
 * Audit Log Cleanup Skill
 * ==============================================================================
 * 
 * Provides automated cleanup of old audit log entries based on
 * configurable retention policies per event type.
 * 
 * @module audit-cleanup
 */

/**
 * Audit cleanup configuration
 */
export interface AuditCleanupConfig {
  /** Schedule for cleanup (cron expression) */
  schedule: string;
  /** Dry run mode (don't actually delete) */
  dryRun: boolean;
  /** Batch size for deletions */
  batchSize: number;
  /** Maximum age in days for any event type */
  maxRetentionDays: number;
}

/**
 * Cleanup result
 */
export interface AuditCleanupResult {
  /** Number of audit entries deleted */
  deletedCount: number;
  /** Number of audit entries that would be deleted (dry run) */
  wouldDeleteCount: number;
  /** Event types affected */
  eventTypes: string[];
  /** Execution time in milliseconds */
  executionTimeMs: number;
  /** Whether this was a dry run */
  dryRun: boolean;
}

/**
 * Retention policy for an event type
 */
export interface RetentionPolicy {
  event_type: string;
  retention_days: number;
}

/**
 * Default cleanup configuration
 */
export const DEFAULT_AUDIT_CLEANUP_CONFIG: AuditCleanupConfig = {
  schedule: '0 2 * * *', // Every 2 hours
  dryRun: false,
  batchSize: 1000,
  maxRetentionDays: 1825, // 5 years
};

/**
 * Get retention policies from database
 * 
 * @param executor - SQL executor function
 * @returns Array of retention policies
 */
export async function getRetentionPolicies(
  executor: (sql: string, params?: unknown[]) => Promise<{ rows: RetentionPolicy[] }>
): Promise<RetentionPolicy[]> {
  const query = `
    SELECT event_type, retention_days 
    FROM audit_retention_config 
    ORDER BY event_type
  `;
  
  const result = await executor(query);
  return result.rows;
}

/**
 * Calculate cleanup statistics
 * 
 * @param executor - SQL executor function
 * @param dryRun - Whether this is a dry run
 * @returns Cleanup statistics
 */
export async function calculateCleanupStats(
  executor: (sql: string, params?: unknown[]) => Promise<{ rows: any[] }>,
  dryRun: boolean
): Promise<{
  totalCount: number;
  wouldDeleteCount: number;
  eventTypes: string[];
}> {
  const query = `
    SELECT 
      event_type,
      COUNT(*) as count,
      SUM(CASE 
        WHEN created_at < (
          SELECT CURRENT_TIMESTAMP - (retention_days || ' days')::INTERVAL
          FROM audit_retention_config
          WHERE audit_log.event_type = audit_retention_config.event_type
        ) THEN 1 ELSE 0 
      END) as would_delete
    FROM audit_log
    GROUP BY event_type
    ORDER BY event_type
  `;
  
  const result = await executor(query);
  const rows = result.rows;
  
  let totalCount = 0;
  let wouldDeleteCount = 0;
  const eventTypes: string[] = [];
  
  for (const row of rows) {
    totalCount += parseInt(row.count, 10);
    wouldDeleteCount += parseInt(row.would_delete, 10);
    eventTypes.push(row.event_type);
  }
  
  return {
    totalCount,
    wouldDeleteCount,
    eventTypes,
  };
}

/**
 * Perform audit log cleanup
 * 
 * @param executor - SQL executor function
 * @param config - Cleanup configuration
 * @returns Cleanup result
 */
export async function cleanupAuditLogs(
  executor: (sql: string, params?: unknown[]) => Promise<{ rows: any[] }>,
  config: Partial<AuditCleanupConfig> = {}
): Promise<AuditCleanupResult> {
  const startTime = Date.now();
  const finalConfig = { ...DEFAULT_AUDIT_CLEANUP_CONFIG, ...config };
  
  // Calculate cleanup statistics
  const stats = await calculateCleanupStats(executor, finalConfig.dryRun);
  
  let deletedCount = 0;
  
  if (!finalConfig.dryRun) {
    // Delete old audit logs in batches
    const batchSize = finalConfig.batchSize;
    let offset = 0;
    
    while (true) {
      const query = `
        DELETE FROM audit_log
        WHERE created_at < (
          SELECT CURRENT_TIMESTAMP - (retention_days || ' days')::INTERVAL
          FROM audit_retention_config
          WHERE audit_log.event_type = audit_retention_config.event_type
        )
        ORDER BY created_at
        LIMIT $1 OFFSET $2
      `;
      
      const result = await executor(query, [batchSize, offset]);
      const deleted = result.rows.length > 0 ? result.rows[0].rowCount : 0;
      
      deletedCount += deleted;
      offset += deleted;
      
      if (deleted < batchSize) {
        break;
      }
      
      // Small delay between batches to avoid overwhelming database
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  const executionTimeMs = Date.now() - startTime;
  
  return {
    deletedCount: finalConfig.dryRun ? 0 : deletedCount,
    wouldDeleteCount: stats.wouldDeleteCount,
    eventTypes: stats.eventTypes,
    executionTimeMs,
    dryRun: finalConfig.dryRun,
  };
}

/**
 * Get cleanup report
 * 
 * @param executor - SQL executor function
 * @returns Cleanup report
 */
export async function getCleanupReport(
  executor: (sql: string, params?: unknown[]) => Promise<{ rows: any[] }>
): Promise<{
  retentionPolicies: RetentionPolicy[];
  stats: {
    totalCount: number;
    wouldDeleteCount: number;
    eventTypes: string[];
  };
  recommendations: string[];
}> {
  const retentionPolicies = await getRetentionPolicies(executor);
  const stats = await calculateCleanupStats(executor, false);
  
  const recommendations: string[] = [];
  
  // Generate recommendations
  for (const policy of retentionPolicies) {
    if (policy.retention_days > 365) {
      recommendations.push(
        `Event type '${policy.event_type}' has ${policy.retention_days} days retention. Consider reducing to 365 days (1 year) for better performance.`
      );
    }
  }
  
  if (stats.wouldDeleteCount > 100000) {
    recommendations.push(
      `Large number of entries (${stats.wouldDeleteCount}) would be deleted. Consider running cleanup more frequently.`
    );
  }
  
  return {
    retentionPolicies,
    stats,
    recommendations,
  };
}

/**
 * Validate retention days value
 * 
 * @param days - Retention days to validate
 * @throws Error if invalid
 */
export function validateRetentionDays(days: number): void {
  if (typeof days !== 'number' || isNaN(days)) {
    throw new Error(`Retention days must be a number, got: ${days}`);
  }
  
  if (days < 1) {
    throw new Error(`Retention days must be at least 1, got: ${days}`);
  }
  
  if (days > 3650) { // 10 years
    throw new Error(`Retention days cannot exceed 3650 (10 years), got: ${days}`);
  }
}

/**
 * Update retention policy for an event type
 * 
 * @param executor - SQL executor function
 * @param eventType - Event type to update
 * @param retentionDays - New retention days
 */
export async function updateRetentionPolicy(
  executor: (sql: string, params?: unknown[]) => Promise<{ rows: any[] }>,
  eventType: string,
  retentionDays: number
): Promise<void> {
  validateRetentionDays(retentionDays);
  
  const query = `
    INSERT INTO audit_retention_config (event_type, retention_days, created_at, updated_at)
    VALUES ($1, $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT (event_type) 
    DO UPDATE SET 
      retention_days = EXCLUDED.retention_days,
      updated_at = CURRENT_TIMESTAMP
  `;
  
  await executor(query, [eventType, retentionDays]);
}

/**
 * Delete retention policy for an event type
 * 
 * @param executor - SQL executor function
 * @param eventType - Event type to remove
 */
export async function deleteRetentionPolicy(
  executor: (sql: string, params?: unknown[]) => Promise<{ rows: any[] }>,
  eventType: string
): Promise<void> {
  const query = `
    DELETE FROM audit_retention_config 
    WHERE event_type = $1
  `;
  
  await executor(query, [eventType]);
}

/**
 * Get audit log statistics
 * 
 * @param executor - SQL executor function
 * @returns Audit log statistics
 */
export async function getAuditLogStats(
  executor: (sql: string, params?: unknown[]) => Promise<{ rows: any[] }>
): Promise<{
  totalEntries: number;
  entriesByType: { [key: string]: number };
  oldestEntry: Date | null;
  newestEntry: Date | null;
  storageSizeBytes: number;
}> {
  const query = `
    SELECT 
      COUNT(*) as total_entries,
      MIN(created_at) as oldest_entry,
      MAX(created_at) as newest_entry
    FROM audit_log
  `;
  
  const result = await executor(query);
  const totalEntries = parseInt(result.rows[0].total_entries, 10);
  const oldestEntry = result.rows[0].oldest_entry ? new Date(result.rows[0].oldest_entry) : null;
  const newestEntry = result.rows[0].newest_entry ? new Date(result.rows[0].newest_entry) : null;
  
  // Get entries by type
  const typeQuery = `
    SELECT event_type, COUNT(*) as count
    FROM audit_log
    GROUP BY event_type
    ORDER BY count DESC
  `;
  
  const typeResult = await executor(typeQuery);
  const entriesByType: { [key: string]: number } = {};
  
  for (const row of typeResult.rows) {
    entriesByType[row.event_type] = parseInt(row.count, 10);
  }
  
  // Estimate storage size (rough estimate: 1KB per entry)
  const storageSizeBytes = totalEntries * 1024;
  
  return {
    totalEntries,
    entriesByType,
    oldestEntry,
    newestEntry,
    storageSizeBytes,
  };
}

/**
 * Format bytes to human readable size
 * 
 * @param bytes - Number of bytes
 * @returns Human readable size string
 */
export function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(2)} ${units[unitIndex]}`;
}

/**
 * Generate cleanup summary report
 * 
 * @param result - Cleanup result
 * @returns Formatted summary
 */
export function generateCleanupSummary(result: AuditCleanupResult): string {
  const lines: string[] = [];
  
  lines.push('=== Audit Log Cleanup Summary ===');
  lines.push('');
  lines.push(`Mode: ${result.dryRun ? 'DRY RUN' : 'LIVE'}`);
  lines.push(`Execution Time: ${result.executionTimeMs}ms`);
  lines.push('');
  
  if (result.dryRun) {
    lines.push(`Would delete: ${result.wouldDeleteCount} entries`);
  } else {
    lines.push(`Deleted: ${result.deletedCount} entries`);
  }
  
  lines.push('');
  lines.push('Event Types Affected:');
  for (const eventType of result.eventTypes) {
    lines.push(`  - ${eventType}`);
  }
  
  lines.push('');
  lines.push(`Performance: ${result.executionTimeMs > 0 ? `${result.executionTimeMs}ms` : 'N/A'}`);
  
  return lines.join('\n');
}
