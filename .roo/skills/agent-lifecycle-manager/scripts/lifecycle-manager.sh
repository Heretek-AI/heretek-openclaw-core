#!/bin/bash
#
# Agent Lifecycle Manager - Shell Wrapper
# ==============================================================================
# Provides CLI interface for agent lifecycle operations.
# Supports both direct execution and gateway-mediated execution.
#
# Usage:
#   ./lifecycle-manager.sh <command> [options]
#
# Commands:
#   status           Show agent status
#   start-all        Start all agents
#   stop-all         Stop all agents
#   restart-all      Restart all agents
#   rolling-restart  Rolling restart (zero downtime)
#   health-check     Check agent health
#   monitor          Start health monitoring
#   dashboard        Show status dashboard
#

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_DIR="$(dirname "$SCRIPT_DIR")"
PROJECT_NAME="${OPENCLAW_PROJECT:-heretek-openclaw-core}"
GATEWAY_URL="${GATEWAY_URL:-ws://127.0.0.1:18789}"
LITELLM_HOST="${LITELLM_HOST:-http://litellm:4000}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Agent dependency order
STARTUP_ORDER=("gateway" "litellm" "steward" "alpha" "beta" "gamma" "scout" "artisan" "guardian" "dreamer" "knowledge-ingest")

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[OK]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Docker is available
check_docker() {
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed or not in PATH"
        exit 1
    fi
    
    if ! docker ps &> /dev/null; then
        log_error "Cannot connect to Docker daemon"
        exit 1
    fi
}

# Get list of running agents
get_running_agents() {
    docker ps --filter "name=${PROJECT_NAME}" --format "{{.Names}}" 2>/dev/null || echo ""
}

# Get list of all agents
get_all_agents() {
    docker ps -a --filter "name=${PROJECT_NAME}-agent" --format "{{.Names}}" 2>/dev/null || echo ""
}

# Check if agent is running
is_agent_running() {
    local agent="$1"
    local running=$(get_running_agents | grep -c "$agent" || echo "0")
    [ "$running" -gt 0 ]
}

# Start an agent
start_agent() {
    local agent="$1"
    local wait_health="${2:-false}"
    
    if is_agent_running "$agent"; then
        log_warning "$agent is already running"
        return 0
    fi
    
    log_info "Starting $agent..."
    
    if docker compose -p "$PROJECT_NAME" start "$agent" > /dev/null 2>&1; then
        if [ "$wait_health" = "true" ]; then
            log_info "Waiting for $agent health check..."
            wait_for_health "$agent"
        fi
        log_success "$agent started"
        return 0
    else
        log_error "Failed to start $agent"
        return 1
    fi
}

# Stop an agent
stop_agent() {
    local agent="$1"
    local force="${2:-false}"
    
    if ! is_agent_running "$agent"; then
        log_warning "$agent is not running"
        return 0
    fi
    
    log_info "Stopping $agent..."
    
    if [ "$force" = "true" ]; then
        docker compose -p "$PROJECT_NAME" kill "$agent" > /dev/null 2>&1
    else
        docker compose -p "$PROJECT_NAME" stop -t 30 "$agent" > /dev/null 2>&1
    fi
    
    if [ $? -eq 0 ]; then
        log_success "$agent stopped"
        return 0
    else
        log_error "Failed to stop $agent"
        return 1
    fi
}

# Wait for agent health check
wait_for_health() {
    local agent="$1"
    local timeout="${2:-30}"
    local elapsed=0
    
    while [ $elapsed -lt $timeout ]; do
        if curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:18789/health/$agent" 2>/dev/null | grep -q "200"; then
            return 0
        fi
        sleep 1
        elapsed=$((elapsed + 1))
    done
    
    log_error "Health check timeout for $agent"
    return 1
}

# Check agent health
check_agent_health() {
    local agent="$1"
    local gw_status="down"
    local llm_status="down"
    
    # Check Gateway health
    if curl -s "http://127.0.0.1:18789/health/$agent" 2>/dev/null | grep -q "healthy"; then
        gw_status="healthy"
    fi
    
    # Check LiteLLM health
    if curl -s "$LITELLM_HOST/health" 2>/dev/null | grep -q "healthy"; then
        llm_status="healthy"
    fi
    
    echo "$agent|$gw_status|$llm_status"
}

# Show status dashboard
show_status() {
    echo ""
    echo "=== Agent Status Dashboard ==="
    echo ""
    printf "%-20s %-12s %-12s %s\n" "AGENT" "STATUS" "HEALTH" "TIME"
    echo "----------------------------------------------------------------------"
    
    for agent in "${STARTUP_ORDER[@]}"; do
        local status="stopped"
        local health="N/A"
        local time="N/A"
        
        if is_agent_running "$agent"; then
            status="running"
            if curl -s "http://127.0.0.1:18789/health/$agent" 2>/dev/null | grep -q "healthy"; then
                health="healthy"
            else
                health="unhealthy"
            fi
            time=$(date +%H:%M:%S)
        fi
        
        printf "%-20s %-12s %-12s %s\n" "$agent" "$status" "$health" "$time"
    done
    
    echo ""
}

# Show health check results
show_health() {
    echo ""
    echo "=== Agent Health Check ==="
    echo ""
    printf "%-20s %-12s %-20s %s\n" "AGENT" "OVERALL" "GATEWAY" "LITELLM"
    echo "----------------------------------------------------------------------"
    
    for agent in "${STARTUP_ORDER[@]}"; do
        local result=$(check_agent_health "$agent")
        local gw_status=$(echo "$result" | cut -d'|' -f2)
        local llm_status=$(echo "$result" | cut -d'|' -f3)
        local overall="unhealthy"
        
        if [ "$gw_status" = "healthy" ] && [ "$llm_status" = "healthy" ]; then
            overall="healthy"
        elif [ "$gw_status" = "healthy" ] || [ "$llm_status" = "healthy" ]; then
            overall="degraded"
        fi
        
        printf "%-20s %-12s %-20s %s\n" "$agent" "$overall" "$gw_status" "$llm_status"
    done
    
    echo ""
}

# Start all agents
start_all() {
    log_info "Starting all agents in dependency order..."
    
    for agent in "${STARTUP_ORDER[@]}"; do
        # Skip if agent container doesn't exist
        if ! docker compose -p "$PROJECT_NAME" config --services 2>/dev/null | grep -q "^${agent}$"; then
            continue
        fi
        
        start_agent "$agent" "$WAIT_HEALTH"
        if [ $? -ne 0 ]; then
            log_error "Failed to start $agent, continuing..."
        fi
        
        if [ -n "$DELAY" ]; then
            sleep $((DELAY / 1000))
        fi
    done
    
    log_success "Start sequence complete"
}

# Stop all agents
stop_all() {
    log_info "Stopping all agents in reverse dependency order..."
    
    # Reverse the array
    local reversed=()
    for ((i=${#STARTUP_ORDER[@]}-1; i>=0; i--)); do
        reversed+=("${STARTUP_ORDER[i]}")
    done
    
    for agent in "${reversed[@]}"; do
        if is_agent_running "$agent"; then
            stop_agent "$agent" "$FORCE"
            if [ $? -ne 0 ]; then
                log_error "Failed to stop $agent, continuing..."
            fi
            
            if [ -n "$DELAY" ]; then
                sleep $((DELAY / 1000))
            fi
        fi
    done
    
    log_success "Stop sequence complete"
}

# Rolling restart
rolling_restart() {
    log_info "Performing rolling restart..."
    local count=0
    local total=${#STARTUP_ORDER[@]}
    
    for agent in "${STARTUP_ORDER[@]}"; do
        if ! docker compose -p "$PROJECT_NAME" config --services 2>/dev/null | grep -q "^${agent}$"; then
            continue
        fi
        
        count=$((count + 1))
        log_info "[$count/$total] Restarting $agent..."
        
        stop_agent "$agent" "$FORCE"
        sleep 2
        start_agent "$agent" "true"
        
        if [ -n "$DELAY" ]; then
            sleep $((DELAY / 1000))
        fi
    done
    
    log_success "Rolling restart complete"
}

# Monitor agents
monitor_agents() {
    local interval="${1:-30}"
    local auto_restart="${2:-false}"
    
    log_info "Starting health monitor (interval: ${interval}s, auto-restart: $auto_restart)"
    
    while true; do
        echo ""
        echo "=== Health Check $(date +%H:%M:%S) ==="
        
        for agent in "${STARTUP_ORDER[@]}"; do
            if is_agent_running "$agent"; then
                local result=$(check_agent_health "$agent")
                local gw_status=$(echo "$result" | cut -d'|' -f2)
                local overall="healthy"
                
                if [ "$gw_status" != "healthy" ]; then
                    overall="unhealthy"
                    log_warning "$agent is $overall"
                    
                    if [ "$auto_restart" = "true" ]; then
                        log_info "Auto-restarting $agent..."
                        stop_agent "$agent" "false"
                        sleep 2
                        start_agent "$agent" "true"
                    fi
                else
                    log_success "$agent is $overall"
                fi
            else
                log_warning "$agent is not running"
                
                if [ "$auto_restart" = "true" ]; then
                    log_info "Auto-starting $agent..."
                    start_agent "$agent" "true"
                fi
            fi
        done
        
        sleep "$interval"
    done
}

# Parse command line arguments
parse_args() {
    COMMAND="$1"
    shift
    
    while [ $# -gt 0 ]; do
        case "$1" in
            --agents)
                AGENTS="$2"
                shift 2
                ;;
            --delay)
                DELAY="$2"
                shift 2
                ;;
            --interval)
                INTERVAL="$2"
                shift 2
                ;;
            --force)
                FORCE="true"
                shift
                ;;
            --verify-health|--verifyHealth)
                WAIT_HEALTH="true"
                shift
                ;;
            --auto-restart|--autoRestart)
                AUTO_RESTART="true"
                shift
                ;;
            --json)
                JSON_OUTPUT="true"
                shift
                ;;
            --agent)
                AGENT="$2"
                shift 2
                ;;
            *)
                shift
                ;;
        esac
    done
}

# Main entry point
main() {
    parse_args "$@"
    
    check_docker
    
    case "$COMMAND" in
        status)
            show_status
            ;;
        start-all)
            start_all
            ;;
        stop-all)
            stop_all
            ;;
        restart-all)
            stop_all
            sleep 2
            start_all
            ;;
        rolling-restart)
            rolling_restart
            ;;
        health-check)
            show_health
            ;;
        monitor)
            monitor_agents "${INTERVAL:-30}" "${AUTO_RESTART:-false}"
            ;;
        dashboard)
            show_status
            show_health
            ;;
        *)
            echo "
Agent Lifecycle Manager - Shell Wrapper

Usage: $0 <command> [options]

Commands:
  status           Show agent status dashboard
  start-all        Start all agents in dependency order
  stop-all         Stop all agents in reverse dependency order
  restart-all      Restart all agents
  rolling-restart  Rolling restart for zero downtime
  health-check     Check health of all agents
  monitor          Start continuous health monitoring
  dashboard        Show full status and health dashboard

Options:
  --agents <ids>     Comma-separated agent IDs (for start/stop/restart)
  --delay <ms>       Delay between agent operations
  --interval <s>     Monitor check interval in seconds
  --force            Force stop (kill instead of graceful stop)
  --verify-health    Wait for health check after start
  --auto-restart     Enable auto-restart for unhealthy agents
  --json             Output in JSON format
  --agent <id>       Single agent ID

Examples:
  $0 status
  $0 start-all --verify-health
  $0 rolling-restart --delay 5000
  $0 monitor --auto-restart --interval 30
  $0 dashboard
"
            exit 1
            ;;
    esac
}

# Run main function
main "$@"
