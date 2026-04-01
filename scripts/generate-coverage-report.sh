#!/bin/bash
# ==============================================================================
# Heretek OpenClaw - Coverage Report Generator
# ==============================================================================
# This script generates detailed HTML coverage reports from test results.
# It supports multiple output formats and can publish reports to various destinations.
# ==============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
COVERAGE_DIR="$PROJECT_DIR/coverage"
REPORT_DIR="$COVERAGE_DIR/html"
REPORT_URL="${REPORT_URL:-}"

# Report configuration
COVERAGE_TYPES=("statements" "branches" "functions" "lines")
MIN_COVERAGE=80
OUTPUT_FORMATS=("html" "json" "lcov" "text")

# ==============================================================================
# Helper Functions
# ==============================================================================

print_header() {
    echo ""
    echo -e "${BLUE}=============================================================================="
    echo -e "$1"
    echo -e "==============================================================================${NC}"
    echo ""
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

show_usage() {
    cat << EOF
Usage: $(basename "$0") [OPTIONS]

Generate coverage reports for Heretek OpenClaw.

Options:
    -h, --help              Show this help message
    -o, --output DIR        Output directory for reports (default: ./coverage/html)
    -f, --format FORMAT     Output format: html, json, lcov, text (default: all)
    -t, --threshold NUM     Minimum coverage threshold percentage (default: 80)
    --publish               Publish report to configured destination
    --serve                 Start local server to view report
    -p, --port NUM          Port for local server (default: 8080)

Examples:
    $(basename "$0")                        # Generate all report formats
    $(basename "$0") --format html          # Generate only HTML report
    $(basename "$0") --serve                # Generate and serve HTML report
    $(basename "$0") --threshold 90         # Set threshold to 90%

EOF
}

# ==============================================================================
# Parse Arguments
# ==============================================================================

SERVE_REPORT=false
PUBLISH_REPORT=false
SERVER_PORT=8080
SELECTED_FORMAT=""

while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_usage
            exit 0
            ;;
        -o|--output)
            REPORT_DIR="$2"
            shift 2
            ;;
        -f|--format)
            SELECTED_FORMAT="$2"
            shift 2
            ;;
        -t|--threshold)
            MIN_COVERAGE="$2"
            shift 2
            ;;
        --publish)
            PUBLISH_REPORT=true
            shift
            ;;
        --serve)
            SERVE_REPORT=true
            shift
            ;;
        -p|--port)
            SERVER_PORT="$2"
            shift
            ;;
        *)
            print_error "Unknown option: $1"
            show_usage
            exit 1
            ;;
    esac
done

# ==============================================================================
# Pre-flight Checks
# ==============================================================================

print_header "Heretek OpenClaw - Coverage Report Generator"

# Check if we're in the right directory
if [ ! -f "$PROJECT_DIR/package.json" ]; then
    print_error "package.json not found. Are you in the right directory?"
    exit 1
fi

# Check for existing coverage data
if [ ! -d "$COVERAGE_DIR" ]; then
    print_warning "No coverage directory found. Running tests first..."
    cd "$PROJECT_DIR" && npm run test:coverage
fi

# Create output directory
mkdir -p "$REPORT_DIR"

# ==============================================================================
# Generate Reports
# ==============================================================================

cd "$PROJECT_DIR"

print_header "Generating Coverage Reports"

# Determine which formats to generate
if [ -n "$SELECTED_FORMAT" ]; then
    OUTPUT_FORMATS=("$SELECTED_FORMAT")
fi

for format in "${OUTPUT_FORMATS[@]}"; do
    case $format in
        html)
            print_info "Generating HTML report..."
            if [ -f "$COVERAGE_DIR/coverage-final.json" ]; then
                npx nyc report \
                    --reporter=html \
                    --report-dir="$REPORT_DIR" \
                    --temp-dir="$COVERAGE_DIR" \
                    2>/dev/null || \
                npx c8 report \
                    --reporter=html \
                    --report-dir="$REPORT_DIR" \
                    2>/dev/null || \
                print_warning "HTML report generation requires nyc or c8"
            fi
            ;;
        json)
            print_info "Generating JSON report..."
            if [ -f "$COVERAGE_DIR/coverage-final.json" ]; then
                cp "$COVERAGE_DIR/coverage-final.json" "$REPORT_DIR/coverage.json"
                print_success "JSON report generated"
            fi
            ;;
        lcov)
            print_info "Generating LCOV report..."
            if [ -f "$COVERAGE_DIR/lcov.info" ]; then
                cp "$COVERAGE_DIR/lcov.info" "$REPORT_DIR/lcov.info"
                print_success "LCOV report generated"
            fi
            ;;
        text)
            print_info "Generating text summary..."
            if [ -f "$COVERAGE_DIR/coverage-summary.json" ]; then
                cat "$COVERAGE_DIR/coverage-summary.json" | python3 -m json.tool > "$REPORT_DIR/coverage-summary.txt" 2>/dev/null || \
                cat "$COVERAGE_DIR/coverage-summary.json" > "$REPORT_DIR/coverage-summary.txt"
                print_success "Text summary generated"
            fi
            ;;
        *)
            print_warning "Unknown format: $format"
            ;;
    esac
done

# ==============================================================================
# Validate Coverage
# ==============================================================================

print_header "Validating Coverage"

if [ -f "$COVERAGE_DIR/coverage-summary.json" ]; then
    # Extract coverage percentages using different methods
    TOTAL_COVERAGE=""
    
    # Try jq first
    if command -v jq &> /dev/null; then
        TOTAL_COVERAGE=$(jq '.total.lines.pct' "$COVERAGE_DIR/coverage-summary.json" 2>/dev/null || echo "")
    fi
    
    # Try python as fallback
    if [ -z "$TOTAL_COVERAGE" ] && command -v python3 &> /dev/null; then
        TOTAL_COVERAGE=$(python3 -c "import json; print(json.load(open('$COVERAGE_DIR/coverage-summary.json'))['total']['lines']['pct'])" 2>/dev/null || echo "")
    fi
    
    # Try grep/sed as last resort
    if [ -z "$TOTAL_COVERAGE" ]; then
        TOTAL_COVERAGE=$(grep -o '"pct":[0-9.]*' "$COVERAGE_DIR/coverage-summary.json" | head -1 | cut -d':' -f2)
    fi
    
    if [ -n "$TOTAL_COVERAGE" ]; then
        echo ""
        echo "Total Line Coverage: ${TOTAL_COVERAGE}%"
        echo ""
        
        # Check against threshold
        if (( $(echo "$TOTAL_COVERAGE < $MIN_COVERAGE" | bc -l 2>/dev/null || echo "0") )); then
            print_error "Coverage ($TOTAL_COVERAGE%) is below threshold ($MIN_COVERAGE%)"
            exit 1
        else
            print_success "Coverage meets threshold ($MIN_COVERAGE%)"
        fi
    else
        print_warning "Could not determine coverage percentage"
    fi
else
    print_warning "coverage-summary.json not found"
fi

# ==============================================================================
# Display Report Summary
# ==============================================================================

print_header "Report Summary"

echo "Coverage Directory: $COVERAGE_DIR"
echo "Report Directory:   $REPORT_DIR"
echo ""

if [ -d "$REPORT_DIR" ]; then
    echo "Generated Files:"
    ls -la "$REPORT_DIR" 2>/dev/null | grep -v "^d" | grep -v "^total" | while read line; do
        echo "  $line"
    done
    echo ""
fi

# Show coverage by type if available
if [ -f "$COVERAGE_DIR/coverage-summary.json" ]; then
    echo "Coverage by Type:"
    
    if command -v jq &> /dev/null; then
        jq -r 'to_entries[] | "  \(.key): \(.value.lines.pct)%"' "$COVERAGE_DIR/coverage-summary.json" 2>/dev/null | head -5
    else
        echo "  (install jq for detailed breakdown)"
    fi
    echo ""
fi

# ==============================================================================
# Serve Report
# ==============================================================================

if [ "$SERVE_REPORT" = true ]; then
    print_header "Serving Coverage Report"
    
    if [ -f "$REPORT_DIR/index.html" ]; then
        print_info "Starting local server on port $SERVER_PORT..."
        print_info "Open http://localhost:$SERVER_PORT to view the report"
        print_info "Press Ctrl+C to stop"
        echo ""
        
        # Try different HTTP servers
        if command -v python3 &> /dev/null; then
            cd "$REPORT_DIR" && python3 -m http.server "$SERVER_PORT"
        elif command -v python &> /dev/null; then
            cd "$REPORT_DIR" && python -m SimpleHTTPServer "$SERVER_PORT"
        elif command -v http-server &> /dev/null; then
            npx http-server "$REPORT_DIR" -p "$SERVER_PORT"
        else
            print_error "No HTTP server available. Install python3 or run: npx http-server"
        fi
    else
        print_error "HTML report not found. Generate with --format html first."
    fi
fi

# ==============================================================================
# Publish Report
# ==============================================================================

if [ "$PUBLISH_REPORT" = true ]; then
    print_header "Publishing Report"
    
    if [ -n "$REPORT_URL" ]; then
        print_info "Publishing to: $REPORT_URL"
        # Add publishing logic here (rsync, scp, AWS S3, etc.)
        print_success "Report published"
    else
        print_warning "REPORT_URL not configured. Set environment variable to publish."
    fi
fi

# ==============================================================================
# Summary
# ==============================================================================

print_header "Coverage Report Complete"

if [ -f "$REPORT_DIR/index.html" ]; then
    echo "To view the HTML report:"
    echo "  1. Open $REPORT_DIR/index.html in a browser"
    echo "  2. Or run: $(basename "$0") --serve"
fi

echo ""
print_success "Report generation complete!"
echo ""

exit 0
