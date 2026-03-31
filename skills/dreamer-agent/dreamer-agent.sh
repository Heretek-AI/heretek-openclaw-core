#!/usr/bin/env bash
#
# Dreamer Agent - Overnight Memory Consolidation Skill
# 
# Triggers sleep-based memory consolidation for the agent collective.
# Runs episodic replay, semantic promotion, and schema formation.
#
# Usage:
#   ./dreamer-agent.sh [command]
#
# Commands:
#   sleep     - Run immediate sleep cycle
#   schedule  - Show/modify sleep schedule
#   status    - Show dreamer agent status
#   dreams    - Show recent dream log
#   help      - Show this help message
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
MEMORY_DIR="$PROJECT_ROOT/modules/memory"
STATE_DIR="$MEMORY_DIR/state"
DATA_DIR="$MEMORY_DIR/data"
LOG_DIR="$PROJECT_ROOT/validation-logs"

# Ensure directories exist
mkdir -p "$STATE_DIR" "$DATA_DIR" "$LOG_DIR"

# State file
STATE_FILE="$STATE_DIR/dreamer-state.json"
DREAM_LOG="$DATA_DIR/dream-log.json"

# Default configuration
SLEEP_HOUR="${DREAMER_SLEEP_HOUR:-3}"
SLEEP_DURATION="${DREAMER_SLEEP_DURATION:-4.8}"
AUTO_TRIGGER="${DREAMER_AUTO_TRIGGER:-true}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Show help
show_help() {
    cat << EOF
Dreamer Agent - Overnight Memory Consolidation

Usage: $(basename "$0") [command]

Commands:
  sleep       Run immediate sleep cycle (consolidation)
  schedule    Show or modify sleep schedule
  status      Show dreamer agent status and statistics
  dreams      Show recent dream log entries
  promote     Trigger semantic promotion manually
  decay       Apply forgetting decay to memories
  help        Show this help message

Environment Variables:
  DREAMER_SLEEP_HOUR     Hour to trigger sleep (default: 3)
  DREAMER_SLEEP_DURATION Sleep cycle duration in minutes (default: 4.8)
  DREAMER_AUTO_TRIGGER   Auto-trigger sleep at scheduled time (default: true)

Examples:
  $(basename "$0") sleep      # Run sleep cycle now
  $(basename "$0") status     # Check current status
  $(basename "$0") dreams     # View recent dreams

EOF
}

# Run sleep cycle
run_sleep() {
    log_info "Starting sleep cycle..."
    
    # Check if Node.js is available
    if ! command -v node &> /dev/null; then
        log_error "Node.js is required but not installed"
        return 1
    fi
    
    # Run the dreamer agent
    local dreamer_script="$MEMORY_DIR/dreamer-agent.js"
    
    if [[ ! -f "$dreamer_script" ]]; then
        log_error "Dreamer agent script not found: $dreamer_script"
        return 1
    fi
    
    # Execute sleep cycle
    log_info "Executing sleep cycle with duration: ${SLEEP_DURATION} minutes"
    
    node -e "
        const { DreamerAgentFactory } = require('$dreamer_script');
        
        (async () => {
            try {
                const dreamer = await DreamerAgentFactory.create({
                    sleep: {
                        durationMinutes: $SLEEP_DURATION,
                        autoTrigger: false
                    }
                });
                
                console.log('Starting sleep cycle...');
                const results = await dreamer.runSleepCycle();
                
                console.log('\\n=== Sleep Cycle Results ===');
                console.log('Cycle Number:', results.cycleNumber);
                console.log('Duration:', Math.round(results.duration / 1000), 'seconds');
                console.log('Stages completed:', results.stages.length);
                console.log('Dreams generated:', results.dreams.length);
                console.log('Memories consolidated:', results.consolidations);
                
                if (results.errors && results.errors.length > 0) {
                    console.log('\\nErrors:');
                    results.errors.forEach(e => console.log('  -', e));
                }
                
                await dreamer.close();
                process.exit(0);
            } catch (error) {
                console.error('Sleep cycle failed:', error.message);
                process.exit(1);
            }
        })();
    "
    
    local exit_code=$?
    
    if [[ $exit_code -eq 0 ]]; then
        log_success "Sleep cycle completed successfully"
    else
        log_error "Sleep cycle failed with exit code: $exit_code"
    fi
    
    return $exit_code
}

# Show sleep schedule
show_schedule() {
    log_info "Dreamer Agent Sleep Schedule"
    echo ""
    echo "  Sleep Hour:      $SLEEP_HOUR:00"
    echo "  Sleep Duration:  $SLEEP_DURATION minutes"
    echo "  Auto Trigger:    $AUTO_TRIGGER"
    echo ""
    
    # Calculate next scheduled sleep
    local now=$(date +%s)
    local today_sleep=$(date -d "today $SLEEP_HOUR:00:00" +%s 2>/dev/null || date -j -f "%H:%M:%S" "$SLEEP_HOUR:00:00" +%s 2>/dev/null)
    
    if [[ $today_sleep -lt $now ]]; then
        tomorrow_sleep=$((today_sleep + 86400))
        next_sleep=$(date -d "@$tomorrow_sleep" "+%Y-%m-%d %H:%M:%S" 2>/dev/null || date -r "$tomorrow_sleep" "+%Y-%m-%d %H:%M:%S" 2>/dev/null)
    else
        next_sleep=$(date -d "@$today_sleep" "+%Y-%m-%d %H:%M:%S" 2>/dev/null || date -r "$today_sleep" "+%Y-%m-%d %H:%M:%S" 2>/dev/null)
    fi
    
    echo "  Next Scheduled:  $next_sleep"
}

# Show dreamer status
show_status() {
    log_info "Dreamer Agent Status"
    echo ""
    
    # Check state file
    if [[ -f "$STATE_FILE" ]]; then
        log_info "State file: $STATE_FILE"
        
        # Parse state file
        if command -v jq &> /dev/null; then
            echo ""
            echo "  Sleep Cycles:     $(jq -r '.sleepCycleCount // 0' "$STATE_FILE")"
            echo "  Total Dreams:     $(jq -r '.totalDreams // 0' "$STATE_FILE")"
            echo "  Last Sleep:       $(jq -r '.lastSleep // "never"' "$STATE_FILE")"
            echo "  Last Saved:       $(jq -r '.savedAt // 0' "$STATE_FILE" | xargs -I{} date -d "@{}" "+%Y-%m-%d %H:%M:%S" 2>/dev/null || echo "N/A")"
        else
            cat "$STATE_FILE"
        fi
    else
        log_warn "No state file found - dreamer agent may not have run yet"
    fi
    
    echo ""
    
    # Check dream log
    if [[ -f "$DREAM_LOG" ]]; then
        local dream_count=$(wc -l < "$DREAM_LOG" 2>/dev/null || echo "0")
        log_info "Dream log: $DREAM_LOG ($dream_count lines)"
    else
        log_info "No dream log found yet"
    fi
    
    echo ""
    
    # Check consolidation state
    local consolidation_state="$STATE_DIR/consolidation-state.json"
    if [[ -f "$consolidation_state" ]]; then
        log_info "Consolidation state: $consolidation_state"
        if command -v jq &> /dev/null; then
            local episodic=$(jq '.episodicMemory | length' "$consolidation_state" 2>/dev/null || echo "0")
            local semantic=$(jq '.semanticMemory | length' "$consolidation_state" 2>/dev/null || echo "0")
            echo "    Episodic memories: $episodic"
            echo "    Semantic memories: $semantic"
        fi
    fi
}

# Show recent dreams
show_dreams() {
    log_info "Recent Dreams"
    echo ""
    
    if [[ ! -f "$DREAM_LOG" ]]; then
        log_warn "No dream log found - run a sleep cycle first"
        return 1
    fi
    
    if command -v jq &> /dev/null; then
        # Show last 10 dreams
        jq -r '.[-10:] | .[] | "\(.timestamp | todate): \(.id) - \(.content)"' "$DREAM_LOG" 2>/dev/null || {
            log_warn "Could not parse dream log"
            cat "$DREAM_LOG"
        }
    else
        log_warn "jq not installed, showing raw log:"
        tail -100 "$DREAM_LOG"
    fi
}

# Trigger semantic promotion
trigger_promotion() {
    log_info "Triggering semantic promotion..."
    
    local promoter_script="$MEMORY_DIR/semantic-promotion.js"
    
    if [[ ! -f "$promoter_script" ]]; then
        log_error "Semantic promotion script not found: $promoter_script"
        return 1
    fi
    
    node -e "
        const { SemanticPromotionFactory } = require('$promoter_script');
        
        (async () => {
            try {
                const promoter = await SemanticPromotionFactory.create();
                console.log('Processing episodic memories for promotion...');
                
                const results = await promoter.processEpisodicMemories();
                
                console.log('\\n=== Promotion Results ===');
                console.log('Processed:', results.processed);
                console.log('Promoted:', results.promoted);
                console.log('Skipped:', results.skipped);
                console.log('Decayed:', results.decayed);
                
                if (results.errors && results.errors.length > 0) {
                    console.log('\\nErrors:');
                    results.errors.forEach(e => console.log('  -', e));
                }
                
                const stats = promoter.getStats();
                console.log('\\n=== Statistics ===');
                console.log('Episodic count:', stats.episodicCount);
                console.log('Semantic count:', stats.semanticCount);
                console.log('Schema count:', stats.schemaCount);
                console.log('Total promotions:', stats.totalPromotions);
                
                await promoter.close();
                process.exit(0);
            } catch (error) {
                console.error('Promotion failed:', error.message);
                process.exit(1);
            }
        })();
    "
}

# Apply forgetting decay
apply_decay() {
    log_info "Applying forgetting decay..."
    
    local consolidation_script="$MEMORY_DIR/memory-consolidation.js"
    
    if [[ ! -f "$consolidation_script" ]]; then
        log_error "Consolidation script not found: $consolidation_script"
        return 1
    fi
    
    node -e "
        const MemoryConsolidation = require('$consolidation_script');
        
        (async () => {
            try {
                const consolidation = new MemoryConsolidation();
                consolidation.load();
                
                console.log('Applying decay to unused memories...');
                const decayed = consolidation.decayUnusedMemories();
                
                console.log('\\n=== Decay Results ===');
                console.log('Memories affected:', decayed);
                
                const stats = consolidation.getStats();
                console.log('\\n=== Statistics ===');
                console.log('Episodic memories:', stats.totalEpisodic);
                console.log('Semantic memories:', stats.totalSemantic);
                console.log('Pad memories:', stats.totalPad);
                
                consolidation.save();
                process.exit(0);
            } catch (error) {
                console.error('Decay failed:', error.message);
                process.exit(1);
            }
        })();
    "
}

# Main command handler
main() {
    local command="${1:-help}"
    
    case "$command" in
        sleep)
            run_sleep
            ;;
        schedule)
            show_schedule
            ;;
        status)
            show_status
            ;;
        dreams)
            show_dreams
            ;;
        promote)
            trigger_promotion
            ;;
        decay)
            apply_decay
            ;;
        help|--help|-h)
            show_help
            ;;
        *)
            log_error "Unknown command: $command"
            echo ""
            show_help
            exit 1
            ;;
    esac
}

# Run main
main "$@"
