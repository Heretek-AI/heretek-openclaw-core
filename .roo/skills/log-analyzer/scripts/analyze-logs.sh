#!/bin/bash
# Heretek OpenClaw — Log Analyzer CLI Wrapper
# ==============================================================================
# Usage:
#   ./analyze-logs.sh analyze --all [--since <time>] [--filter <type>]
#   ./analyze-logs.sh patterns [--search <pattern>] [--anomaly-detection]
#   ./analyze-logs.sh correlate [--window <duration>] [--event <type>]
#   ./analyze-logs.sh timeline [--filter <type>] [--output <file>]
#   ./analyze-logs.sh root-cause [--incident <name>]
#   ./analyze-logs.sh categorize [--summary] [--report <file>]

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
SINCE="1h"
FILTER=""
OUTPUT_FILE=""
SEARCH_PATTERN=""
ANOMALY_DETECTION=false
TIME_WINDOW="10m"
EVENT_TYPE=""
SUMMARY=false
REPORT_FILE=""

# Parse arguments
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --all)
                ALL=true
                shift
                ;;
            --component)
                COMPONENT="$2"
                shift 2
                ;;
            --since)
                SINCE="$2"
                shift 2
                ;;
            --filter)
                FILTER="$2"
                shift 2
                ;;
            --output)
                OUTPUT_FILE="$2"
                shift 2
                ;;
            --search)
                SEARCH_PATTERN="$2"
                shift 2
                ;;
            --anomaly-detection)
                ANOMALY_DETECTION=true
                shift
                ;;
            --window)
                TIME_WINDOW="$2"
                shift 2
                ;;
            --event)
                EVENT_TYPE="$2"
                shift 2
                ;;
            --summary)
                SUMMARY=true
                shift
                ;;
            --report)
                REPORT_FILE="$2"
                shift 2
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

# Run analyzer
run_analyzer() {
    local command="${POSITIONAL_ARGS[0]:-analyze}"
    
    case $command in
        analyze)
            print_status "info" "Analyzing logs..."
            local args=""
            [[ -n "$COMPONENT" ]] && args="$args --component $COMPONENT"
            [[ -n "$SINCE" ]] && args="$args --since $SINCE"
            [[ -n "$FILTER" ]] && args="$args --filter $FILTER"
            [[ "$ALL" == true ]] && args="$args --all"
            node "$SRC_DIR/index.js" analyze $args
            ;;
        patterns)
            print_status "info" "Detecting patterns..."
            local args=""
            [[ -n "$SEARCH_PATTERN" ]] && args="$args --search $SEARCH_PATTERN"
            [[ "$ANOMALY_DETECTION" == true ]] && args="$args --anomaly-detection"
            node "$SRC_DIR/index.js" patterns $args
            ;;
        correlate)
            print_status "info" "Correlating events..."
            local args=""
            [[ -n "$TIME_WINDOW" ]] && args="$args --window $TIME_WINDOW"
            [[ -n "$EVENT_TYPE" ]] && args="$args --event $EVENT_TYPE"
            node "$SRC_DIR/index.js" correlate $args
            ;;
        timeline)
            print_status "info" "Building timeline..."
            local args=""
            [[ -n "$FILTER" ]] && args="$args --filter $FILTER"
            [[ -n "$OUTPUT_FILE" ]] && args="$args --output $OUTPUT_FILE"
            node "$SRC_DIR/index.js" timeline $args
            ;;
        root-cause)
            print_status "info" "Analyzing root cause..."
            local args=""
            [[ -n "$SINCE" ]] && args="$args --since $SINCE"
            node "$SRC_DIR/index.js" root-cause $args
            ;;
        categorize)
            print_status "info" "Categorizing errors..."
            local args=""
            [[ "$SUMMARY" == true ]] && args="$args --summary"
            [[ -n "$REPORT_FILE" ]] && args="$args --report $REPORT_FILE"
            node "$SRC_DIR/index.js" categorize $args
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
Heretek OpenClaw — Log Analyzer

Usage: ./analyze-logs.sh <command> [options]

Commands:
  analyze       Analyze logs from components
  patterns      Detect error patterns and anomalies
  correlate     Correlate events across logs
  timeline      Build event timeline
  root-cause    Analyze root cause of issues
  categorize    Categorize errors by type

Options:
  --all                     Analyze all components
  --component <name>        Specific component to analyze
  --since <time>            Time range (e.g., "1h", "30m", "24h")
  --filter <type>           Filter (errors|warnings|info)
  --search <pattern>        Search pattern for pattern detection
  --anomaly-detection       Enable anomaly detection
  --window <duration>       Time window for correlation
  --event <type>            Event type to correlate
  --output <file>           Output file for timeline
  --summary                 Show summary only
  --report <file>           Export categorization report
  -v, --verbose             Verbose output
  -h, --help                Show this help message

Examples:
  ./analyze-logs.sh analyze --all --since "2h ago"
  ./analyze-logs.sh patterns --search "timeout"
  ./analyze-logs.sh correlate --window "5m"
  ./analyze-logs.sh timeline --filter errors --output timeline.json
  ./analyze-logs.sh root-cause
  ./analyze-logs.sh categorize --summary

EOF
}

# Main execution
main() {
    parse_args "$@"
    check_node
    run_analyzer
}

main "$@"
