#!/bin/bash
# Heretek OpenClaw — State Inspector CLI Wrapper
# ==============================================================================
# Usage:
#   ./inspect-state.sh memory --agent <id> [--all] [--detailed]
#   ./inspect-state.sh session [--history] [--output <file>]
#   ./inspect-state.sh ledger [--verify] [--search <pattern>]
#   ./inspect-state.sh workspace [--detailed] [--report <file>]
#   ./inspect-state.sh scan [--component <name>] [--full]
#   ./inspect-state.sh summary

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
AGENT_ID=""
ALL=false
DETAILED=false
OUTPUT_FILE=""
HISTORY=false
VERIFY=false
SEARCH_PATTERN=""
COMPONENT="all"
FULL=false
REPORT_FILE=""

# Parse arguments
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --agent)
                AGENT_ID="$2"
                shift 2
                ;;
            --all)
                ALL=true
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
            --history)
                HISTORY=true
                shift
                ;;
            --verify)
                VERIFY=true
                shift
                ;;
            --search)
                SEARCH_PATTERN="$2"
                shift 2
                ;;
            --component)
                COMPONENT="$2"
                shift 2
                ;;
            --full)
                FULL=true
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

# Run inspector
run_inspector() {
    local command="${POSITIONAL_ARGS[0]:-summary}"
    
    case $command in
        memory)
            print_status "info" "Inspecting memory..."
            local args=""
            [[ -n "$AGENT_ID" ]] && args="$args --agent $AGENT_ID"
            [[ "$ALL" == true ]] && args="$args --all"
            [[ "$DETAILED" == true ]] && args="$args --detailed"
            [[ -n "$OUTPUT_FILE" ]] && args="$args --export $OUTPUT_FILE"
            node "$SRC_DIR/index.js" memory $args
            ;;
        session)
            print_status "info" "Viewing session state..."
            local args=""
            [[ "$HISTORY" == true ]] && args="$args --history"
            [[ -n "$OUTPUT_FILE" ]] && args="$args --output $OUTPUT_FILE"
            node "$SRC_DIR/index.js" session $args
            ;;
        ledger)
            print_status "info" "Auditing ledger..."
            local args=""
            [[ "$VERIFY" == true ]] && args="$args --verify"
            [[ -n "$SEARCH_PATTERN" ]] && args="$args --search $SEARCH_PATTERN"
            node "$SRC_DIR/index.js" ledger $args
            ;;
        workspace)
            print_status "info" "Checking workspace..."
            local args=""
            [[ "$DETAILED" == true ]] && args="$args --detailed"
            [[ -n "$REPORT_FILE" ]] && args="$args --report $REPORT_FILE"
            node "$SRC_DIR/index.js" workspace $args
            ;;
        scan)
            print_status "info" "Scanning for corruption..."
            local args=""
            [[ -n "$COMPONENT" ]] && args="$args --component $COMPONENT"
            [[ "$FULL" == true ]] && args="$args --full"
            node "$SRC_DIR/index.js" scan $args
            ;;
        summary)
            print_status "info" "Getting state summary..."
            node "$SRC_DIR/index.js" summary
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
Heretek OpenClaw — State Inspector

Usage: ./inspect-state.sh <command> [options]

Commands:
  memory      Inspect agent memory state
  session     View session state
  ledger      Audit consensus ledger
  workspace   Check workspace integrity
  scan        Scan for corruption
  summary     Get state summary

Options:
  --agent <id>        Specific agent ID
  --all               All agents
  --detailed          Detailed inspection
  --output <file>     Output file
  --history           Include history
  --verify            Verify integrity
  --search <pattern>  Search pattern
  --component <name>  Component (memory|ledger|workspace|all)
  --full              Full scan
  --report <file>     Export report
  -v, --verbose       Verbose output
  -h, --help          Show this help message

Examples:
  ./inspect-state.sh memory --agent steward --detailed
  ./inspect-state.sh memory --all
  ./inspect-state.sh session --history
  ./inspect-state.sh ledger --verify
  ./inspect-state.sh workspace --detailed --report workspace.json
  ./inspect-state.sh scan --full
  ./inspect-state.sh summary

EOF
}

# Main execution
main() {
    parse_args "$@"
    check_node
    run_inspector
}

main "$@"
