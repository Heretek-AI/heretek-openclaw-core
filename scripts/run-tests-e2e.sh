#!/bin/bash
# ==============================================================================
# Heretek OpenClaw - E2E Test Runner Script
# ==============================================================================
# This script runs end-to-end tests with proper service orchestration.
# It starts required services, runs tests, and cleans up afterwards.
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
TEST_RESULTS_DIR="$PROJECT_DIR/test-results"
PLAYWRIGHT_RESULTS_DIR="$TEST_RESULTS_DIR/playwright"

# Service configuration
REDIS_PORT=${REDIS_PORT:-6379}
GATEWAY_PORT=${GATEWAY_PORT:-8787}
APP_PORT=${APP_PORT:-3000}

# Test configuration
HEADLESS=${HEADLESS:-true}
BROWSERS=${BROWSERS:-"chromium"}
MAX_RETRIES=${MAX_RETRIES:-2}

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

Run E2E tests for Heretek OpenClaw with service orchestration.

Options:
    -h, --help          Show this help message
    --no-headless       Run browsers with UI (not headless)
    --browser NAME      Run specific browser (chromium, firefox, webkit)
    --no-cleanup        Don't clean up services after tests
    --skip-services     Skip service startup (services already running)
    --report            Generate detailed test report

Examples:
    $(basename "$0")                          # Run all E2E tests headless
    $(basename "$0") --no-headless            # Run with browser UI visible
    $(basename "$0") --browser firefox        # Run only Firefox tests
    $(basename "$0") --skip-services          # Skip service startup

EOF
}

cleanup() {
    print_info "Cleaning up..."
    
    # Stop Docker services if started
    if [ "$STARTED_DOCKER" = true ] && [ "$SKIP_CLEANUP" != true ]; then
        print_info "Stopping Docker services..."
        docker-compose -f "$PROJECT_DIR/docker-compose.test.yml" down 2>/dev/null || true
    fi
    
    # Kill any remaining background processes
    if [ -n "$REDIS_PID" ] && [ "$SKIP_CLEANUP" != true ]; then
        kill $REDIS_PID 2>/dev/null || true
    fi
    
    if [ -n "$GATEWAY_PID" ] && [ "$SKIP_CLEANUP" != true ]; then
        kill $GATEWAY_PID 2>/dev/null || true
    fi
}

trap cleanup EXIT

# ==============================================================================
# Parse Arguments
# ==============================================================================

SKIP_CLEANUP=false
SKIP_SERVICES=false
GENERATE_REPORT=false

while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_usage
            exit 0
            ;;
        --no-headless)
            HEADLESS=false
            shift
            ;;
        --browser)
            BROWSERS="$2"
            shift 2
            ;;
        --no-cleanup)
            SKIP_CLEANUP=true
            shift
            ;;
        --skip-services)
            SKIP_SERVICES=true
            shift
            ;;
        --report)
            GENERATE_REPORT=true
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

print_header "Heretek OpenClaw - E2E Test Runner"

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

# Check for Playwright
if ! npx playwright --version &> /dev/null; then
    print_info "Installing Playwright..."
    cd "$PROJECT_DIR" && npx playwright install --with-deps
fi

# Create output directories
mkdir -p "$PLAYWRIGHT_RESULTS_DIR"

# ==============================================================================
# Start Services
# ==============================================================================

cd "$PROJECT_DIR"

if [ "$SKIP_SERVICES" != true ]; then
    print_header "Starting Test Services"
    
    # Check if Docker Compose is available
    if command -v docker-compose &> /dev/null || command -v docker &> /dev/null; then
        print_info "Starting services with Docker Compose..."
        
        if [ -f "$PROJECT_DIR/docker-compose.test.yml" ]; then
            docker-compose -f "$PROJECT_DIR/docker-compose.test.yml" up -d
            STARTED_DOCKER=true
            
            # Wait for services to be ready
            print_info "Waiting for services to be ready..."
            sleep 10
            
            # Health check for Redis
            if docker-compose -f "$PROJECT_DIR/docker-compose.test.yml" exec -T redis redis-cli ping &> /dev/null; then
                print_success "Redis is ready"
            else
                print_warning "Redis health check failed"
            fi
        else
            print_warning "docker-compose.test.yml not found"
        fi
    else
        print_warning "Docker not available. Services must be running externally."
        
        # Set environment variables for external services
        export REDIS_URL="redis://localhost:$REDIS_PORT"
        export GATEWAY_URL="http://localhost:$GATEWAY_PORT"
    fi
else
    print_info "Skipping service startup (--skip-services)"
fi

# ==============================================================================
# Run E2E Tests
# ==============================================================================

print_header "Running E2E Tests"

# Set Playwright environment variables
export PLAYWRIGHT_TEST_BASE_URL="${PLAYWRIGHT_TEST_BASE_URL:-http://localhost:$APP_PORT}"
export PLAYWRIGHT_HEADLESS="$HEADLESS"
export PLAYWRIGHT_BROWSERS="$BROWSERS"
export PLAYWRIGHT_MAX_RETRIES="$MAX_RETRIES"

# Build Playwright command
PLAYWRIGHT_CMD="npx playwright test"
PLAYWRIGHT_ARGS=""

if [ "$HEADLESS" = true ]; then
    PLAYWRIGHT_ARGS="$PLAYWRIGHT_ARGS --headed"
fi

# Run specific browser
if [ "$BROWSERS" != "all" ]; then
    PLAYWRIGHT_ARGS="$PLAYWRIGHT_ARGS --project=$BROWSERS"
fi

# Add reporter options
PLAYWRIGHT_ARGS="$PLAYWRIGHT_ARGS --reporter=list,html"
PLAYWRIGHT_ARGS="$PLAYWRIGHT_ARGS --output=$PLAYWRIGHT_RESULTS_DIR"

print_info "Running: $PLAYWRIGHT_CMD $PLAYWRIGHT_ARGS"
echo ""

# Run the tests
if eval "$PLAYWRIGHT_CMD $PLAYWRIGHT_ARGS"; then
    print_success "E2E tests passed!"
else
    print_error "Some E2E tests failed"
    exit 1
fi

# ==============================================================================
# Generate Report
# ==============================================================================

if [ "$GENERATE_REPORT" = true ]; then
    print_header "Generating Test Report"
    
    # Open HTML report
    if [ -f "$PLAYWRIGHT_RESULTS_DIR/index.html" ]; then
        print_info "HTML Report: $PLAYWRIGHT_RESULTS_DIR/index.html"
    fi
    
    # Generate JUnit XML for CI
    PLAYWRIGHT_ARGS="$PLAYWRIGHT_ARGS --reporter=junit"
    eval "$PLAYWRIGHT_CMD $PLAYWRIGHT_ARGS" 2>/dev/null || true
    
    if [ -f "$PLAYWRIGHT_RESULTS_DIR/junit.xml" ]; then
        print_success "JUnit XML report generated"
    fi
fi

# ==============================================================================
# Summary
# ==============================================================================

print_header "E2E Test Summary"

echo "Test Results: $PLAYWRIGHT_RESULTS_DIR"
echo ""

if [ -d "$PLAYWRIGHT_RESULTS_DIR/html" ]; then
    echo "To view HTML report, run:"
    echo "  npx playwright show-report $PLAYWRIGHT_RESULTS_DIR"
fi

echo ""
print_success "E2E test run complete!"
echo ""

exit 0
