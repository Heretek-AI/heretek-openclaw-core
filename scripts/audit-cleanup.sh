#!/bin/bash
# ==============================================================================
# Heretek OpenClaw — Audit Log Cleanup Cron Script
# ==============================================================================
# Runs audit log cleanup based on configured retention policies
#
# Usage:
#   ./audit-cleanup.sh [--dry-run] [--verbose]
#
# Cron Example (every 2 hours):
#   0 */2 * * * /path/to/audit-cleanup.sh >> /var/log/openclaw-audit-cleanup.log 2>&1
# ==============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CORE_DIR="$SCRIPT_DIR/.."
LOG_DIR="${LOG_DIR:-/var/log/openclaw}"
DRY_RUN=""
VERBOSE=""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $(date '+%Y-%m-%d %H:%M:%S') $*"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $(date '+%Y-%m-%d %H:%M:%S') $*"; }
log_error() { echo -e "${RED}[ERROR]${NC} $(date '+%Y-%m-%d %H:%M:%S') $*"; }

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --dry-run)
            DRY_RUN="--dry-run"
            shift
            ;;
        --verbose)
            VERBOSE="--verbose"
            shift
            ;;
        --help)
            echo "Usage: $0 [--dry-run] [--verbose]"
            echo ""
            echo "Options:"
            echo "  --dry-run   Show what would be deleted without actually deleting"
            echo "  --verbose   Show detailed output"
            echo "  --help      Show this help message"
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Ensure log directory exists
mkdir -p "$LOG_DIR" 2>/dev/null || true

log_info "Starting audit log cleanup..."

# Check if running in Docker container
if [ -f /.dockerenv ]; then
    log_info "Running in Docker container"
    # Inside container, run the cleanup directly using Node.js
    cd "$CORE_DIR"
    
    # Create a simple Node.js script to run the cleanup
    cat > /tmp/audit-cleanup-runner.js << 'EOF'
const { Client } = require('pg');

async function runCleanup() {
  const client = new Client({
    host: process.env.POSTGRES_HOST || 'localhost',
    port: process.env.POSTGRES_PORT || 5432,
    database: process.env.POSTGRES_DB || 'heretek',
    user: process.env.POSTGRES_USER || 'heretek',
    password: process.env.POSTGRES_PASSWORD,
  });

  try {
    await client.connect();
    
    // Call the cleanup function
    const result = await client.query('SELECT cleanup_audit_logs()');
    const deletedCount = result.rows[0].cleanup_audit_logs;
    
    console.log(`Audit log cleanup completed. Deleted ${deletedCount} entries.`);
    return deletedCount;
  } catch (error) {
    console.error('Error running audit cleanup:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runCleanup();
EOF

    node /tmp/audit-cleanup-runner.js
    rm -f /tmp/audit-cleanup-runner.js
else
    # Running on host system
    log_info "Running on host system"
    
    # Check if PostgreSQL client is available
    if command -v psql &> /dev/null; then
        log_info "Using psql to run cleanup"
        
        # Get database connection from environment or use defaults
        PGHOST="${POSTGRES_HOST:-localhost}"
        PGPORT="${POSTGRES_PORT:-5432}"
        PGDATABASE="${POSTGRES_DB:-heretek}"
        PGUSER="${POSTGRES_USER:-heretek}"
        PGPASSWORD="${POSTGRES_PASSWORD:-}"
        
        export PGPASSWORD
        
        if [ -n "$DRY_RUN" ]; then
            log_info "DRY RUN MODE - No data will be deleted"
            psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -c "
                SELECT 
                  event_type,
                  COUNT(*) as total_entries,
                  SUM(CASE 
                    WHEN created_at < (
                      SELECT CURRENT_TIMESTAMP - (retention_days || ' days')::INTERVAL
                      FROM audit_retention_config
                      WHERE audit_log.event_type = audit_retention_config.event_type
                    ) THEN 1 ELSE 0 
                  END) as would_delete
                FROM audit_log
                GROUP BY event_type
                ORDER BY event_type;
            "
        else
            # Run the cleanup function
            psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -c "SELECT cleanup_audit_logs();"
        fi
    else
        log_error "PostgreSQL client (psql) not found. Please install it or run inside Docker container."
        exit 1
    fi
fi

log_info "Audit log cleanup completed successfully"
