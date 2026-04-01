#!/bin/bash
# Heretek OpenClaw — System Diagnostics CLI Wrapper
# ==============================================================================
# Usage:
#   ./diagnostics.sh full [--verbose] [--json] [--output <file>]
#   ./diagnostics.sh component --name <component>
#   ./diagnostics.sh config [--all] [--auto-fix]
#   ./diagnostics.sh deps [--system] [--docker] [--node] [--all]
#   ./diagnostics.sh logs [--aggregate] [--filter <errors|warnings>]
#   ./diagnostics.sh health-score [--breakdown]

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
VERBOSE=false
JSON_OUTPUT=false
OUTPUT_FILE=""
COMPONENT_NAME=""
FILTER_TYPE=""
AUTO_FIX=false

# Parse arguments
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            -v|--verbose)
                VERBOSE=true
                shift
                ;;
            -j|--json)
                JSON_OUTPUT=true
                shift
                ;;
            -o|--output)
                OUTPUT_FILE="$2"
                shift 2
                ;;
            --name)
                COMPONENT_NAME="$2"
                shift 2
                ;;
            --filter)
                FILTER_TYPE="$2"
                shift 2
                ;;
            --auto-fix)
                AUTO_FIX=true
                shift
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
    
    local node_version=$(node --version)
    print_status "info" "Using Node.js: $node_version"
}

# Run diagnostics
run_diagnostics() {
    local command="${POSITIONAL_ARGS[0]:-full}"
    
    case $command in
        full)
            print_status "info" "Running full system diagnostics..."
            node "$SRC_DIR/index.js" full \
                $( $VERBOSE && echo "--verbose" ) \
                $( $JSON_OUTPUT && echo "--json" ) \
                $( [[ -n "$OUTPUT_FILE" ]] && echo "--output $OUTPUT_FILE" )
            ;;
        component)
            print_status "info" "Checking component: $COMPONENT_NAME"
            node "$SRC_DIR/index.js" component --name "$COMPONENT_NAME"
            ;;
        config)
            print_status "info" "Validating configuration..."
            node "$SRC_DIR/index.js" config \
                $( [[ "$AUTO_FIX" == true ]] && echo "--auto-fix" )
            ;;
        deps)
            print_status "info" "Checking dependencies..."
            node "$SRC_DIR/index.js" deps --all
            ;;
        logs)
            print_status "info" "Aggregating logs..."
            node "$SRC_DIR/index.js" logs \
                --aggregate \
                $( [[ -n "$FILTER_TYPE" ]] && echo "--filter $FILTER_TYPE" )
            ;;
        health-score)
            print_status "info" "Calculating health score..."
            node "$SRC_DIR/index.js" health-score \
                $( $VERBOSE && echo "--breakdown" )
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
Heretek OpenClaw — System Diagnostics

Usage: ./diagnostics.sh <command> [options]

Commands:
  full              Run full system diagnostics
  component         Check specific component (--name required)
  config            Validate configuration files
  deps              Check system dependencies
  logs              Aggregate and analyze logs
  health-score      Calculate health score (0-100)

Options:
  -v, --verbose     Enable verbose output
  -j, --json        Output in JSON format
  -o, --output      Save output to file
  --auto-fix        Attempt automatic fixes
  --filter          Filter type (errors|warnings)
  -h, --help        Show this help message

Examples:
  ./diagnostics.sh full                    # Full system check
  ./diagnostics.sh full --json             # JSON output
  ./diagnostics.sh full --output report.json  # Save to file
  ./diagnostics.sh component --name gateway  # Check gateway only
  ./diagnostics.sh health-score --breakdown # Score with details
  ./diagnostics.sh logs --filter errors    # Show errors only

EOF
}

# Main execution
main() {
    parse_args "$@"
    
    # Show help if requested or no args
    if [[ "${POSITIONAL_ARGS[0]}" == "-h" ]] || [[ "${POSITIONAL_ARGS[0]}" == "--help" ]]; then
        show_help
        exit 0
    fi
    
    check_node
    run_diagnostics
}

main "$@"
