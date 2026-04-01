#!/bin/bash
# Heretek OpenClaw — Corruption Recovery CLI Wrapper
# ==============================================================================
# Usage:
#   ./recover.sh scan [--component <name>] [--full] [--detailed]
#   ./recover.sh list [--component <name>] [--recent] [--valid-only]
#   ./recover.sh select --auto|--backup <id>|--timestamp <time>
#   ./recover.sh preview --backup <id> [--diff]
#   ./recover.sh recover [--backup <id>] [--component <name>] [--auto] [--validate]
#   ./recover.sh validate [--component <name>] [--full]
#   ./recover.sh rollback

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_DIR="$(dirname "$SCRIPT_DIR")"
SRC_DIR="$SKILL_DIR/src"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
COMPONENT=""
FULL=false
DETAILED=false
OUTPUT_FILE=""
RECENT=false
COUNT=20
VALID_ONLY=false
AUTO=false
BACKUP_ID=""
TIMESTAMP=""
DIFF=false
VALIDATE=true
NO_ROLLBACK=false

# Parse arguments
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --component)
                COMPONENT="$2"
                shift 2
                ;;
            --full)
                FULL=true
                shift
                ;;
            --detailed)
                DETAILED=true
                shift
                ;;
            --output)
                OUTPUT_FILE="$2"
                shift 2
                ;;
            --recent)
                RECENT=true
                shift
                ;;
            --count)
                COUNT="$2"
                shift 2
                ;;
            --valid-only)
                VALID_ONLY=true
                shift
                ;;
            --auto)
                AUTO=true
                shift
                ;;
            --backup)
                BACKUP_ID="$2"
                shift 2
                ;;
            --timestamp)
                TIMESTAMP="$2"
                shift 2
                ;;
            --diff)
                DIFF=true
                shift
                ;;
            --validate)
                VALIDATE=true
                shift
                ;;
            --no-rollback)
                NO_ROLLBACK=true
                shift
                ;;
            -v|--verbose)
                VERBOSE=true
                shift
                ;;
            -h|--help)
                show_help
                exit 0
                ;;
            *)
                POSITIONAL_ARGS+=("$1")
                shift
                ;;
        esac
    done
}

# Print colored output
print_status() {
    local status=$1
    local message=$2
    
    case $status in
        "ok")
            echo -e "${GREEN}✓${NC} $message"
            ;;
        "warn")
            echo -e "${YELLOW}⚠${NC} $message"
            ;;
        "error")
            echo -e "${RED}✗${NC} $message"
            ;;
        "info")
            echo -e "${BLUE}ℹ${NC} $message"
            ;;
    esac
}

# Check Node.js availability
check_node() {
    if ! command -v node &> /dev/null; then
        print_status "error" "Node.js is required but not installed"
        exit 1
    fi
}

# Run recovery
run_recovery() {
    local command="${POSITIONAL_ARGS[0]:-status}"
    
    case $command in
        scan)
            print_status "info" "Scanning for corruption..."
            local args=""
            [[ -n "$COMPONENT" ]] && args="$args --component $COMPONENT"
            [[ "$FULL" == true ]] && args="$args --full"
            [[ "$DETAILED" == true ]] && args="$args --detailed"
            [[ -n "$OUTPUT_FILE" ]] && args="$args --output $OUTPUT_FILE"
            node "$SRC_DIR/index.js" scan $args
            ;;
        list)
            print_status "info" "Listing backups..."
            local args=""
            [[ -n "$COMPONENT" ]] && args="$args --component $COMPONENT"
            [[ "$RECENT" == true ]] && args="$args --recent --count $COUNT"
            [[ "$VALID_ONLY" == true ]] && args="$args --valid-only"
            node "$SRC_DIR/index.js" list $args
            ;;
        select)
            print_status "info" "Selecting backup..."
            local args=""
            [[ "$AUTO" == true ]] && args="$args --auto"
            [[ -n "$BACKUP_ID" ]] && args="$args --backup $BACKUP_ID"
            [[ -n "$TIMESTAMP" ]] && args="$args --timestamp $TIMESTAMP"
            node "$SRC_DIR/index.js" select $args
            ;;
        preview)
            print_status "info" "Previewing recovery..."
            local args=""
            [[ -n "$BACKUP_ID" ]] && args="$args --backup $BACKUP_ID"
            [[ "$DIFF" == true ]] && args="$args --diff"
            node "$SRC_DIR/index.js" preview $args
            ;;
        recover)
            print_status "info" "Executing recovery..."
            local args=""
            [[ -n "$BACKUP_ID" ]] && args="$args --backup $BACKUP_ID"
            [[ -n "$COMPONENT" ]] && args="$args --component $COMPONENT"
            [[ "$AUTO" == true ]] && args="$args --auto"
            [[ "$VALIDATE" == true ]] && args="$args --validate"
            [[ "$NO_ROLLBACK" == true ]] && args="$args --no-rollback"
            node "$SRC_DIR/index.js" recover $args
            ;;
        validate)
            print_status "info" "Validating recovery..."
            local args=""
            [[ -n "$COMPONENT" ]] && args="$args --component $COMPONENT"
            [[ "$FULL" == true ]] && args="$args --full"
            node "$SRC_DIR/index.js" validate $args
            ;;
        rollback)
            print_status "info" "Rolling back..."
            node "$SRC_DIR/index.js" rollback
            ;;
        status)
            print_status "info" "Getting recovery status..."
            node "$SRC_DIR/index.js" status
            ;;
        *)
            echo "Unknown command: $command"
            show_help
            exit 1
            ;;
    esac
}

# Show help
show_help() {
    cat << EOF
Heretek OpenClaw — Corruption Recovery

Usage: ./recover.sh <command> [options]

Commands:
  scan        Scan for corruption
  list        List available backups
  select      Select backup for recovery
  preview     Preview recovery
  recover     Execute recovery
  validate    Validate recovery
  rollback    Rollback last recovery
  status      Get recovery status

Options:
  --component <name>  Component (memory|ledger|workspace|all)
  --full              Full scan/validation
  --detailed          Detailed report
  --output <file>     Output file
  --recent            Show recent backups
  --count <n>         Number of backups
  --valid-only        Show only valid backups
  --auto              Auto-select best backup
  --backup <id>       Specific backup ID
  --timestamp <time>  Select by timestamp
  --diff              Show diff in preview
  --validate          Validate after recovery
  --no-rollback       Disable rollback
  -v, --verbose       Verbose output
  -h, --help          Show this help message

Examples:
  ./recover.sh scan --full
  ./recover.sh list --recent --count 10
  ./recover.sh select --auto
  ./recover.sh preview --backup backup-20240101
  ./recover.sh recover --auto --validate
  ./recover.sh validate --full
  ./recover.sh rollback

EOF
}

# Main execution
main() {
    parse_args "$@"
    check_node
    run_recovery
}

main "$@"
