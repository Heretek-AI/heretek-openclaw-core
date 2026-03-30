#!/bin/bash
# Research Engine - AutoResearchClaw Integration with Curiosity Engine
# 
# This script integrates the Research Engine with the curiosity-engine
# to enable autonomous research based on gap detection and opportunity scanning.
#
# Usage:
#   bash research-engine.js run [objective]
#   bash research-engine.js search [query]
#   bash research-engine.js stats
#   bash research-engine.js hypotheses [objective]
#   bash research-engine.js test [hypothesis-id]
#   bash research-engine.js continuous [cycles]

set -e

# Determine workspace - use current directory as default
CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
WORKSPACE="${WORKSPACE:-$CURRENT_DIR}"
MODULE_PATH="$WORKSPACE/modules/research/research-engine.js"
STATE_DIR="$WORKSPACE/modules/research/state"
STATE_FILE="$STATE_DIR/research-state.json"

AGENT_ID="${AGENT_ID:-research-agent}"
LITELLM_HOST="${LITELLM_HOST:-http://localhost:4000}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

log_info() { echo -e "${BLUE}[Research]${NC} $1"; }
log_success() { echo -e "${GREEN}[Research]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[Research]${NC} $1"; }
log_error() { echo -e "${RED}[Research]${NC} $1"; }

# Ensure state directory exists
ensure_state_dir() {
    mkdir -p "$STATE_DIR"
}

# Run research via Node.js
run_research() {
    local objective="$1"
    
    if [ -z "$objective" ]; then
        log_error "Objective is required"
        return 1
    fi
    
    log_info "Running research: $objective"
    
    if [ ! -f "$MODULE_PATH" ]; then
        log_error "Research module not found at $MODULE_PATH"
        return 1
    fi
    
    # Execute via Node.js using a temp file to avoid quoting issues
    local node_script=$(mktemp)
    cat > "$node_script" << 'NODESCRIPT'
const ResearchEngine = require(process.env.MODULE_PATH);
const engine = new ResearchEngine(process.env.AGENT_ID);
engine.initialize().then(() => {
    return engine.conductResearch({ 
        objective: process.env.OBJECTIVE,
        autoIntegrate: true
    });
}).then(result => {
    console.log(JSON.stringify(result, null, 2));
    process.exit(0);
}).catch(err => {
    console.error(err.message);
    process.exit(1);
});
NODESCRIPT

    local result=$(MODULE_PATH="$MODULE_PATH" AGENT_ID="$AGENT_ID" OBJECTIVE="$objective" node "$node_script" 2>&1)
    rm -f "$node_script"
    
    if [ $? -ne 0 ] || [ -z "$result" ]; then
        log_error "Research failed: $result"
        return 1
    fi
    
    echo "$result" | jq '.' 2>/dev/null || echo "$result"
    log_success "Research completed"
    
    # Extract key results
    local supported=$(echo "$result" | jq -r '.supportedHypotheses | length' 2>/dev/null || echo "0")
    local rejected=$(echo "$result" | jq -r '.rejectedHypotheses | length' 2>/dev/null || echo "0")
    log_info "Supported: $supported, Rejected: $rejected"
}

# Search literature
search_literature() {
    local query="$1"
    
    if [ -z "$query" ]; then
        log_error "Query is required"
        return 1
    fi
    
    log_info "Searching literature: $query"
    
    if [ ! -f "$MODULE_PATH" ]; then
        log_error "Research module not found"
        return 1
    fi
    
    local node_script=$(mktemp)
    cat > "$node_script" << 'NODESCRIPT'
const ResearchEngine = require(process.env.MODULE_PATH);
const engine = new ResearchEngine(process.env.AGENT_ID);
engine.initialize().then(() => {
    return engine.searchLiterature(process.env.QUERY);
}).then(results => {
    console.log(JSON.stringify(results, null, 2));
    process.exit(0);
}).catch(err => {
    console.error(err.message);
    process.exit(1);
});
NODESCRIPT

    local result=$(MODULE_PATH="$MODULE_PATH" AGENT_ID="$AGENT_ID" QUERY="$query" node "$node_script" 2>&1)
    rm -f "$node_script"
    
    if [ $? -ne 0 ]; then
        log_error "Search failed: $result"
        return 1
    fi
    
    echo "$result" | jq '.' 2>/dev/null || echo "$result"
    log_success "Search completed"
}

# Get research statistics
get_stats() {
    log_info "Fetching research statistics..."
    
    if [ ! -f "$MODULE_PATH" ]; then
        log_error "Research module not found"
        return 1
    fi
    
    local node_script=$(mktemp)
    cat > "$node_script" << 'NODESCRIPT'
const ResearchEngine = require(process.env.MODULE_PATH);
const engine = new ResearchEngine(process.env.AGENT_ID);
console.log(JSON.stringify(engine.getStats(), null, 2));
NODESCRIPT

    MODULE_PATH="$MODULE_PATH" AGENT_ID="$AGENT_ID" node "$node_script" 2>&1
    rm -f "$node_script"
}

# Get current status
get_status() {
    log_info "Fetching research status..."
    
    if [ ! -f "$MODULE_PATH" ]; then
        log_error "Research module not found"
        return 1
    fi
    
    local node_script=$(mktemp)
    cat > "$node_script" << 'NODESCRIPT'
const ResearchEngine = require(process.env.MODULE_PATH);
const engine = new ResearchEngine(process.env.AGENT_ID);
console.log(JSON.stringify(engine.getStatus(), null, 2));
NODESCRIPT

    MODULE_PATH="$MODULE_PATH" AGENT_ID="$AGENT_ID" node "$node_script" 2>&1
    rm -f "$node_script"
}

# Generate hypotheses
generate_hypotheses() {
    local objective="$1"
    
    if [ -z "$objective" ]; then
        log_error "Objective is required"
        return 1
    fi
    
    log_info "Generating hypotheses for: $objective"
    
    if [ ! -f "$MODULE_PATH" ]; then
        log_error "Research module not found"
        return 1
    fi
    
    local node_script=$(mktemp)
    cat > "$node_script" << 'NODESCRIPT'
const { HypothesisGenerator } = require(process.env.MODULE_PATH);
const generator = new HypothesisGenerator();
const hypotheses = generator.generate(process.env.OBJECTIVE, [], { mode: 'automatic' });
console.log(JSON.stringify(hypotheses, null, 2));
NODESCRIPT

    local result=$(MODULE_PATH="$MODULE_PATH" OBJECTIVE="$objective" node "$node_script" 2>&1)
    rm -f "$node_script"
    
    if [ $? -ne 0 ]; then
        log_error "Hypothesis generation failed: $result"
        return 1
    fi
    
    echo "$result" | jq '.' 2>/dev/null || echo "$result"
    log_success "Generated hypotheses"
}

# Test a hypothesis
test_hypothesis() {
    local hypothesis_id="$1"
    
    if [ -z "$hypothesis_id" ]; then
        log_error "Hypothesis ID is required"
        return 1
    fi
    
    log_info "Testing hypothesis: $hypothesis_id"
    
    if [ ! -f "$MODULE_PATH" ]; then
        log_error "Research module not found"
        return 1
    fi
    
    local node_script=$(mktemp)
    cat > "$node_script" << 'NODESCRIPT'
const ResearchEngine = require(process.env.MODULE_PATH);
const engine = new ResearchEngine(process.env.AGENT_ID);
engine.initialize().then(() => {
    return engine.testHypothesis({ 
        id: process.env.HYPOTHESIS_ID,
        statement: 'Test hypothesis',
        testable: true
    });
}).then(result => {
    console.log(JSON.stringify(result, null, 2));
    process.exit(0);
}).catch(err => {
    console.error(err.message);
    process.exit(1);
});
NODESCRIPT

    local result=$(MODULE_PATH="$MODULE_PATH" AGENT_ID="$AGENT_ID" HYPOTHESIS_ID="$hypothesis_id" node "$node_script" 2>&1)
    rm -f "$node_script"
    
    if [ $? -ne 0 ]; then
        log_error "Test failed: $result"
        return 1
    fi
    
    echo "$result" | jq '.' 2>/dev/null || echo "$result"
    log_success "Test completed"
}

# Run continuous research
run_continuous() {
    local cycles="${1:-5}"
    local interval="${2:-60}"
    local base_objective="${3:- artificial intelligence research}"
    
    log_info "Running $cycles research cycles with ${interval}s interval..."
    
    for i in $(seq 1 $cycles); do
        echo ""
        log_info "=== Research Cycle $i/$cycles ==="
        
        # Vary the objective slightly each cycle
        local objective="$base_objective - iteration $i"
        run_research "$objective"
        
        sleep "$interval"
    done
    
    log_success "Continuous research complete"
}

# Research for detected gaps
research_for_gaps() {
    log_info "Processing gap detection integration..."
    
    local gaps_file=$(mktemp)
    
    if [ -f "$WORKSPACE/skills/curiosity-engine/engines/gap-detection.sh" ]; then
        cd "$WORKSPACE/skills/curiosity-engine/engines" && bash gap-detection.sh --json > "$gaps_file" 2>/dev/null || echo '{}' > "$gaps_file"
    else
        echo '{}' > "$gaps_file"
    fi
    
    local gaps=$(cat "$gaps_file")
    rm -f "$gaps_file"
    
    if [ "$gaps" = "{}" ] || [ -z "$gaps" ]; then
        log_warn "No gaps detected or gap detection unavailable"
        return 0
    fi
    
    local critical_gaps=$(echo "$gaps" | jq -r '.critical_gaps // [] | .[]' 2>/dev/null)
    
    if [ -z "$critical_gaps" ]; then
        log_info "No critical gaps found"
        return 0
    fi
    
    log_info "Found gaps to research: $critical_gaps"
    
    # Research for each gap
    for gap in $critical_gaps; do
        log_info "Researching gap: $gap"
        run_research "How to implement $gap capability"
    done
}

# Research for opportunities
research_for_opportunities() {
    log_info "Processing opportunity scanning integration..."
    
    local opportunities_file=$(mktemp)
    
    if [ -f "$WORKSPACE/skills/curiosity-engine/engines/opportunity-scanning.sh" ]; then
        cd "$WORKSPACE/skills/curiosity-engine/engines" && bash opportunity-scanning.sh --json > "$opportunities_file" 2>/dev/null || echo '[]' > "$opportunities_file"
    else
        echo '[]' > "$opportunities_file"
    fi
    
    local opportunities=$(cat "$opportunities_file")
    rm -f "$opportunities_file"
    
    if [ "$opportunities" = "[]" ] || [ -z "$opportunities" ]; then
        log_warn "No opportunities found or opportunity scanning unavailable"
        return 0
    fi
    
    local opportunity_count=$(echo "$opportunities" | jq 'length' 2>/dev/null || echo "0")
    
    if [ "$opportunity_count" = "0" ]; then
        log_info "No opportunities found"
        return 0
    fi
    
    log_info "Found $opportunity_count opportunities to research"
    
    # Research top opportunities
    local top_opportunity=$(echo "$opportunities" | jq -r '.[0].name // empty' 2>/dev/null)
    
    if [ -n "$top_opportunity" ]; then
        log_info "Researching opportunity: $top_opportunity"
        run_research "$top_opportunity - how to capitalize"
    fi
}

# Initialize research state
init_state() {
    ensure_state_dir
    
    if [ -f "$STATE_FILE" ]; then
        log_info "State file already exists"
        cat "$STATE_FILE" | jq '.'
    else
        log_info "Creating initial state..."
        local timestamp=$(date -Iseconds)
        jq -n \
            --arg ts "$timestamp" \
            --arg aid "$AGENT_ID" \
            '{
                agentId: $aid,
                researchCount: 0,
                history: [],
                lastUpdated: $ts
            }' > "$STATE_FILE"
        log_success "Initial state created"
    fi
}

# Main command handler
case "${1:-run}" in
    run)
        run_research "$2"
        ;;
    research)
        run_research "$2"
        ;;
    search)
        search_literature "$2"
        ;;
    stats)
        get_stats
        ;;
    status)
        get_status
        ;;
    hypotheses|hypothesis)
        generate_hypotheses "$2"
        ;;
    test)
        test_hypothesis "$2"
        ;;
    continuous)
        run_continuous "${2:-5}" "${3:-60}" "${4:-research}"
        ;;
    gaps)
        research_for_gaps
        ;;
    opportunities|opps)
        research_for_opportunities
        ;;
    init)
        init_state
        ;;
    help|--help|-h)
        echo "Research Engine - AutoResearchClaw Research Automation"
        echo ""
        echo "Usage: bash $0 <command> [options]"
        echo ""
        echo "Commands:"
        echo "  run [objective]      Run research on an objective"
        echo "  search [query]       Search literature for a query"
        echo "  stats               Show research statistics"
        echo "  status              Show current research status"
        echo "  hypotheses [obj]   Generate hypotheses for objective"
        echo "  test [hyp-id]       Test a specific hypothesis"
        echo "  continuous N I O   Run N research cycles with I second interval"
        echo "  gaps                Research for detected gaps"
        echo "  opportunities      Research for detected opportunities"
        echo "  init                Initialize research state"
        echo "  help                Show this help"
        echo ""
        echo "Examples:"
        echo "  bash $0 run 'How does agent autonomy work'"
        echo "  bash $0 search 'machine learning'"
        echo "  bash $0 hypotheses 'artificial general intelligence'"
        echo "  bash $0 continuous 10 30 'research topic'"
        ;;
    *)
        log_error "Unknown command: $1"
        echo "Run 'bash $0 help' for usage"
        exit 1
        ;;
esac