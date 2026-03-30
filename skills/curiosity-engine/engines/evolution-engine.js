#!/bin/bash
# Evolution Engine - EvoClaw Integration with Curiosity Engine
# 
# This script integrates the Evolution Engine with the curiosity-engine
# to enable evolutionary self-improvement based on gap detection.
#
# Usage:
#   bash evolution-engine.js run [options]
#   bash evolution-engine.js evolve
#   bash evolution-engine.js stats
#   bash evolution-engine.js gaps

set -e

# Determine workspace - use current directory as default
CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
WORKSPACE="${WORKSPACE:-$CURRENT_DIR}"
MODULE_PATH="$WORKSPACE/modules/evolution/evolution-engine.js"
STATE_DIR="$WORKSPACE/modules/evolution/state"
STATE_FILE="$STATE_DIR/evolution-state.json"

AGENT_ID="${AGENT_ID:-evolution-agent}"
LITELLM_HOST="${LITELLM_HOST:-http://localhost:4000}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() { echo -e "${BLUE}[Evolution]${NC} $1"; }
log_success() { echo -e "${GREEN}[Evolution]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[Evolution]${NC} $1"; }
log_error() { echo -e "${RED}[Evolution]${NC} $1"; }

# Ensure state directory exists
ensure_state_dir() {
    mkdir -p "$STATE_DIR"
}

# Run evolution via Node.js
run_evolution() {
    local target_caps="$1"
    local performance_data="$2"
    
    log_info "Running evolution cycle..."
    
    if [ ! -f "$MODULE_PATH" ]; then
        log_error "Evolution module not found at $MODULE_PATH"
        return 1
    fi
    
    # Execute via Node.js using a temp file to avoid quoting issues
    local node_script=$(mktemp)
    cat > "$node_script" << 'NODESCRIPT'
const mod = require(process.env.MODULE_PATH);
const engine = new mod.EvolutionEngine(process.env.AGENT_ID);
engine.controller.initialize();
(async () => {
    const result = await engine.evolve();
    console.log(JSON.stringify(result));
})();
NODESCRIPT

    local result=$(MODULE_PATH="$MODULE_PATH" AGENT_ID="$AGENT_ID" node "$node_script" 2>&1)
    rm -f "$node_script"
    
    if [ $? -ne 0 ] || [ -z "$result" ]; then
        log_error "Evolution failed: $result"
        return 1
    fi
    
    echo "$result" | jq '.' 2>/dev/null || echo "$result"
    log_success "Evolution cycle completed"
}

# Get evolution statistics
get_stats() {
    log_info "Fetching evolution statistics..."
    
    if [ ! -f "$MODULE_PATH" ]; then
        log_error "Evolution module not found"
        return 1
    fi
    
    local node_script=$(mktemp)
    cat > "$node_script" << 'NODESCRIPT'
const mod = require(process.env.MODULE_PATH);
const engine = new mod.EvolutionEngine(process.env.AGENT_ID);
console.log(JSON.stringify(engine.getStats(), null, 2));
NODESCRIPT

    MODULE_PATH="$MODULE_PATH" AGENT_ID="$AGENT_ID" node "$node_script" 2>&1
    rm -f "$node_script"
}

# Get top capabilities
get_top_capabilities() {
    log_info "Getting top evolved capabilities..."
    
    if [ ! -f "$MODULE_PATH" ]; then
        log_error "Evolution module not found"
        return 1
    fi
    
    local node_script=$(mktemp)
    cat > "$node_script" << 'NODESCRIPT'
const mod = require(process.env.MODULE_PATH);
const engine = new mod.EvolutionEngine(process.env.AGENT_ID);
console.log(JSON.stringify(engine.getEvolvedCapabilities(), null, 2));
NODESCRIPT

    MODULE_PATH="$MODULE_PATH" AGENT_ID="$AGENT_ID" node "$node_script" 2>&1
    rm -f "$node_script"
}

# Evolve for detected gaps
evolve_for_gaps() {
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
    
    log_info "Found gaps to evolve: $critical_gaps"
    
    # Build target capabilities from gaps
    local target_caps='[]'
    for gap in $critical_gaps; do
        target_caps=$(echo "$target_caps" | jq --arg gap "$gap" '. + [{
            type: $gap,
            parameters: { complexity: 0.7, adaptability: 0.8, reliability: 0.7, efficiency: 0.6 },
            weight: 1.2
        }]')
    done
    
    run_evolution "$target_caps" "{\"gaps_addressed\": $(echo "$gaps" | jq '.critical_gaps | length')}"
}

# Run continuous evolution
run_continuous() {
    local cycles="${1:-5}"
    local interval="${2:-60}"
    
    log_info "Running $cycles evolution cycles with ${interval}s interval..."
    
    for i in $(seq 1 $cycles); do
        echo ""
        log_info "=== Cycle $i/$cycles ==="
        run_evolution
        sleep "$interval"
    done
    
    log_success "Continuous evolution complete"
}

# Export population
export_population() {
    log_info "Exporting population data..."
    
    local node_script=$(mktemp)
    cat > "$node_script" << 'NODESCRIPT'
const mod = require(process.env.MODULE_PATH);
const engine = new mod.EvolutionEngine(process.env.AGENT_ID);
console.log(JSON.stringify(engine.controller.exportPopulation(), null, 2));
NODESCRIPT

    MODULE_PATH="$MODULE_PATH" AGENT_ID="$AGENT_ID" node "$node_script" 2>&1
    rm -f "$node_script"
}

# Initialize evolution state
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
                cycleCount: 0,
                generation: 0,
                population: { population: [], generation: 0 },
                history: [],
                lastUpdated: $ts
            }' > "$STATE_FILE"
        log_success "Initial state created"
    fi
}

# Main command handler
case "${1:-run}" in
    run)
        run_evolution
        ;;
    evolve)
        run_evolution
        ;;
    stats)
        get_stats
        ;;
    top)
        get_top_capabilities
        ;;
    gaps)
        evolve_for_gaps
        ;;
    continuous)
        run_continuous "${2:-5}" "${3:-60}"
        ;;
    init)
        init_state
        ;;
    export)
        export_population
        ;;
    help|--help|-h)
        echo "Evolution Engine - EvoClaw Self-Evolution Integration"
        echo ""
        echo "Usage: bash $0 <command> [options]"
        echo ""
        echo "Commands:"
        echo "  run              Run one evolution cycle"
        echo "  evolve           Alias for run"
        echo "  stats            Show evolution statistics"
        echo "  top              Get top evolved capabilities"
        echo "  gaps             Evolve for detected gaps"
        echo "  continuous N I   Run N cycles with I second interval"
        echo "  init             Initialize evolution state"
        echo "  export           Export population data"
        echo "  help             Show this help"
        echo ""
        echo "Examples:"
        echo "  bash $0 run"
        echo "  bash $0 gaps"
        echo "  bash $0 continuous 10 30"
        ;;
    *)
        log_error "Unknown command: $1"
        echo "Run 'bash $0 help' for usage"
        exit 1
        ;;
esac