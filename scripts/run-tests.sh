#!/bin/bash
# ==============================================================================
# Heretek OpenClaw - Test Runner Script
# ==============================================================================
# This script runs all tests with coverage reporting.
# It supports multiple test types and provides detailed output.
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
TEST_RESULTS_DIR="$PROJECT_DIR/test-results"

# Default values
RUN_UNIT=true
RUN_INTEGRATION=true
RUN_E2E=false
RUN_SKILLS=true
GENERATE_COVERAGE=true
COVERAGE_THRESHOLD=80
VERBOSE=false

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

Run all tests with coverage reporting for Heretek OpenClaw.

Options:
    -h, --help              Show this help message
    -u, --unit-only         Run only unit tests
    -i, --integration-only  Run only integration tests
    -e, --e2e               Include E2E tests (requires additional setup)
    -s, --skills-only       Run only skills tests
    -n, --no-coverage       Skip coverage report generation
    -t, --threshold NUM     Set coverage threshold percentage (default: 80)
    -v, --verbose           Enable verbose output
    --watch                 Run tests in watch mode

Examples:
    $(basename "$0")                    # Run all tests
    $(basename "$0") --unit-only        # Run only unit tests
    $(basename "$0") --no-coverage      # Run tests without coverage
    $(basename "$0") --threshold 90     # Set coverage threshold to 90%

EOF
}

# ==============================================================================
# Parse Arguments
# ==============================================================================

while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_usage
            exit 0
            ;;
        -u|--unit-only)
            RUN_UNIT=true
            RUN_INTEGRATION=false
            RUN_E2E=false
            RUN_SKILLS=false
            shift
            ;;
        -i|--integration-only)
            RUN_UNIT=false
            RUN_INTEGRATION=true
            RUN_E2E=false
            RUN_SKILLS=false
            shift
            ;;
        -e|--e2e)
            RUN_E2E=true
            shift
            ;;
        -s|--skills-only)
            RUN_UNIT=false
            RUN_INTEGRATION=false
            RUN_E2E=false
            RUN_SKILLS=true
            shift
            ;;
        -n|--no-coverage)
            GENERATE_COVERAGE=false
            shift
            ;;
        -t|--threshold)
            COVERAGE_THRESHOLD="$2"
            shift 2
            ;;
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        --watch)
            WATCH_MODE=true
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

print_header "Heretek OpenClaw - Test Runner"

# Check if we're in the right directory
if [ ! -f "$PROJECT_DIR/package.json" ]; then
    print_error "package.json not found. Are you in the right directory?"
    exit 1
fi

# Check for Node.js
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
    print_warning "Node.js version 20+ is recommended (current: $(node -v))"
fi

# Check for npm dependencies
if [ ! -d "$PROJECT_DIR/node_modules" ]; then
    print_info "Installing dependencies..."
    cd "$PROJECT_DIR" && npm ci --ignore-scripts
fi

# Check for Redis (required for integration tests)
if [ "$RUN_INTEGRATION" = true ]; then
    if command -v redis-cli &> /dev/null; then
        if ! redis-cli ping &> /dev/null; then
            print_warning "Redis is not running. Integration tests may fail."
            print_info "Start Redis with: redis-server"
        else
            print_success "Redis is running"
        fi
    else
        print_warning "redis-cli not found. Integration tests may fail."
    fi
fi

# Create output directories
mkdir -p "$COVERAGE_DIR"
mkdir -p "$TEST_RESULTS_DIR"

# ==============================================================================
# Run Tests
# ==============================================================================

cd "$PROJECT_DIR"

TEST_CMD="npm run test"
TEST_ARGS=""

if [ "$GENERATE_COVERAGE" = true ]; then
    TEST_ARGS="$TEST_ARGS --coverage"
fi

if [ "$VERBOSE" = true ]; then
    TEST_ARGS="$TEST_ARGS --reporter=verbose"
fi

# Build test command based on options
if [ "$WATCH_MODE" = true ]; then
    TEST_CMD="npm run test:watch"
elif [ "$RUN_UNIT" = true ] && [ "$RUN_INTEGRATION" = false ] && [ "$RUN_E2E" = false ] && [ "$RUN_SKILLS" = false ]; then
    TEST_CMD="npm run test:unit"
elif [ "$RUN_INTEGRATION" = true ] && [ "$RUN_UNIT" = false ] && [ "$RUN_E2E" = false ] && [ "$RUN_SKILLS" = false ]; then
    TEST_CMD="npm run test:integration"
elif [ "$RUN_SKILLS" = true ] && [ "$RUN_UNIT" = false ] && [ "$RUN_INTEGRATION" = false ] && [ "$RUN_E2E" = false ]; then
    TEST_CMD="npm run test:skills"
elif [ "$RUN_E2E" = true ]; then
    TEST_CMD="npm run test:e2e"
fi

print_info "Running tests..."
print_info "Command: $TEST_CMD $TEST_ARGS"
echo ""

# Run the tests
if eval "$TEST_CMD $TEST_ARGS"; then
    print_success "All tests passed!"
else
    print_error "Some tests failed"
    exit 1
fi

# ==============================================================================
# Coverage Report
# ==============================================================================

if [ "$GENERATE_COVERAGE" = true ]; then
    print_header "Coverage Report"
    
    if [ -f "$COVERAGE_DIR/coverage-summary.json" ]; then
        # Extract coverage percentages
        TOTAL_COVERAGE=$(cat "$COVERAGE_DIR/coverage-summary.json" | grep -o '"pct":[0-9.]*' | head -1 | cut -d':' -f2)
        
        echo ""
        echo "Total Coverage: ${TOTAL_COVERAGE}%"
        echo ""
        
        # Check against threshold
        if (( $(echo "$TOTAL_COVERAGE < $COVERAGE_THRESHOLD" | bc -l 2>/dev/null || echo "0") )); then
            print_error "Coverage ($TOTAL_COVERAGE%) is below threshold ($COVERAGE_THRESHOLD%)"
            exit 1
        else
            print_success "Coverage meets threshold ($COVERAGE_THRESHOLD%)"
        fi
    fi
    
    # Generate HTML report
    if [ -d "$COVERAGE_DIR/html" ]; then
        print_info "HTML coverage report: $COVERAGE_DIR/html/index.html"
    fi
fi

# ==============================================================================
# Summary
# ==============================================================================

print_header "Test Summary"

echo "Test Results: $TEST_RESULTS_DIR"
echo "Coverage:     $COVERAGE_DIR"
echo ""

if [ "$GENERATE_COVERAGE" = true ]; then
    echo "Coverage Files:"
    ls -la "$COVERAGE_DIR"/*.json 2>/dev/null | while read line; do
        echo "  $line"
    done
fi

echo ""
print_success "Test run complete!"
echo ""

exit 0
