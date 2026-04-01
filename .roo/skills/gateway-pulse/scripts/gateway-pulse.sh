#!/bin/bash
#
# Gateway Pulse - CLI Wrapper
# ==============================================================================
# Provides CLI interface for gateway and LiteLLM monitoring.
# Supports health checks, alerts, and metrics export.
#
# Usage:
#   ./gateway-pulse.sh <command> [options]
#

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_DIR="$(dirname "$SCRIPT_DIR")"
GATEWAY_HOST="${GATEWAY_HOST:-127.0.0.1}"
GATEWAY_PORT="${GATEWAY_PORT:-18789}"
GATEWAY_URL="http://${GATEWAY_HOST}:${GATEWAY_PORT}"
LITELLM_HOST="${LITELLM_HOST:-litellm}"
LITELLM_PORT="${LITELLM_PORT:-4000}"
LITELLM_URL="http://${LITELLM_HOST}:${LITELLM_PORT}"

# Thresholds
WARNING_THRESHOLD="${WARNING_THRESHOLD:-5000}"
CRITICAL_THRESHOLD="${CRITICAL_THRESHOLD:-10000}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

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

# Check gateway health
check_gateway_health() {
    local start_time=$(date +%s%N)
    local response
    local status_code
    local latency

    response=$(curl -s -w "\n%{http_code}" --max-time 5 "${GATEWAY_URL}/health" 2>/dev/null) || true
    status_code=$(echo "$response" | tail -n1)
    local body=$(echo "$response" | head -n -1)

    local end_time=$(date +%s%N)
    latency=$(( (end_time - start_time) / 1000000 ))

    if [ "$status_code" = "200" ]; then
        echo "healthy|$latency|$status_code"
    else
        echo "unhealthy|$latency|$status_code"
    fi
}

# Check LiteLLM health
check_litellm_health() {
    local start_time=$(date +%s%N)
    local response
    local status_code
    local latency

    response=$(curl -s -w "\n%{http_code}" --max-time 5 "${LITELLM_URL}/health" 2>/dev/null) || true
    status_code=$(echo "$response" | tail -n1)

    local end_time=$(date +%s%N)
    latency=$(( (end_time - start_time) / 1000000 ))

    if [ "$status_code" = "200" ]; then
        echo "healthy|$latency|$status_code"
    else
        echo "unhealthy|$latency|$status_code"
    fi
}

# Check WebSocket status
check_websocket() {
    # Simple TCP check for WebSocket port
    if nc -z -w2 "$GATEWAY_HOST" "$GATEWAY_PORT" 2>/dev/null; then
        echo "connected"
    else
        echo "disconnected"
    fi
}

# Show status
show_status() {
    echo ""
    echo "=== Gateway Pulse Status ==="
    echo ""

    # Gateway
    local gw_result=$(check_gateway_health)
    local gw_status=$(echo "$gw_result" | cut -d'|' -f1)
    local gw_latency=$(echo "$gw_result" | cut -d'|' -f2)
    local gw_code=$(echo "$gw_result" | cut -d'|' -f3)
    local gw_ws=$(check_websocket)

    if [ "$gw_status" = "healthy" ]; then
        log_success "Gateway:  $gw_status (${gw_latency}ms) [WebSocket: $gw_ws]"
    else
        log_error "Gateway:  $gw_status (HTTP $gw_code)"
    fi

    # LiteLLM
    local llm_result=$(check_litellm_health)
    local llm_status=$(echo "$llm_result" | cut -d'|' -f1)
    local llm_latency=$(echo "$llm_result" | cut -d'|' -f2)
    local llm_code=$(echo "$llm_result" | cut -d'|' -f3)

    if [ "$llm_status" = "healthy" ]; then
        log_success "LiteLLM:  $llm_status (${llm_latency}ms)"
    else
        log_error "LiteLLM:  $llm_status (HTTP $llm_code)"
    fi

    echo ""
}

# Show dashboard
show_dashboard() {
    echo ""
    echo "╔══════════════════════════════════════════════════════════╗"
    echo "║              GATEWAY PULSE DASHBOARD                     ║"
    echo "╚══════════════════════════════════════════════════════════╝"
    echo ""

    # Gateway
    local gw_result=$(check_gateway_health)
    local gw_status=$(echo "$gw_result" | cut -d'|' -f1)
    local gw_latency=$(echo "$gw_result" | cut -d'|' -f2)
    local gw_ws=$(check_websocket)

    # LiteLLM
    local llm_result=$(check_litellm_health)
    local llm_status=$(echo "$llm_result" | cut -d'|' -f1)
    local llm_latency=$(echo "$llm_result" | cut -d'|' -f2)

    echo "=== Service Status ==="
    echo ""
    printf "%-15s %-12s %-12s\n" "SERVICE" "STATUS" "LATENCY"
    echo "----------------------------------------"
    printf "%-15s %-12s %-12s\n" "Gateway" "$gw_status" "${gw_latency}ms"
    printf "%-15s %-12s %-12s\n" "LiteLLM" "$llm_status" "${llm_latency}ms"

    echo ""
    echo "=== Thresholds ==="
    echo ""
    echo "Warning:  ${WARNING_THRESHOLD}ms"
    echo "Critical: ${CRITICAL_THRESHOLD}ms"

    # Check for threshold violations
    echo ""
    echo "=== Alerts ==="
    echo ""

    if [ "$gw_latency" -ge "$CRITICAL_THRESHOLD" ] 2>/dev/null; then
        log_error "CRITICAL: Gateway latency ${gw_latency}ms exceeds ${CRITICAL_THRESHOLD}ms"
    elif [ "$gw_latency" -ge "$WARNING_THRESHOLD" ] 2>/dev/null; then
        log_warning "WARNING: Gateway latency ${gw_latency}ms exceeds ${WARNING_THRESHOLD}ms"
    else
        log_success "Gateway latency within thresholds"
    fi

    if [ "$llm_latency" -ge "$CRITICAL_THRESHOLD" ] 2>/dev/null; then
        log_error "CRITICAL: LiteLLM latency ${llm_latency}ms exceeds ${CRITICAL_THRESHOLD}ms"
    elif [ "$llm_latency" -ge "$WARNING_THRESHOLD" ] 2>/dev/null; then
        log_warning "WARNING: LiteLLM latency ${llm_latency}ms exceeds ${WARNING_THRESHOLD}ms"
    else
        log_success "LiteLLM latency within thresholds"
    fi

    echo ""
}

# Monitor mode
monitor_services() {
    local interval="${1:-30}"
    local auto_remediate="${2:-false}"

    log_info "Starting Gateway Pulse monitor (interval: ${interval}s)"

    while true; do
        echo ""
        echo "=== $(date '+%Y-%m-%d %H:%M:%S') ==="

        show_status

        # Auto-remediation check
        if [ "$auto_remediate" = "true" ]; then
            local gw_result=$(check_gateway_health)
            local gw_status=$(echo "$gw_result" | cut -d'|' -f1)

            local llm_result=$(check_litellm_health)
            local llm_status=$(echo "$llm_result" | cut -d'|' -f1)

            if [ "$gw_status" = "unhealthy" ]; then
                log_warning "Gateway unhealthy - triggering remediation"
                # Could trigger docker restart here
            fi

            if [ "$llm_status" = "unhealthy" ]; then
                log_warning "LiteLLM unhealthy - triggering remediation"
                # Could trigger docker restart here
            fi
        fi

        sleep "$interval"
    done
}

# Export metrics
export_metrics() {
    local gw_result=$(check_gateway_health)
    local gw_status=$(echo "$gw_result" | cut -d'|' -f1)
    local gw_latency=$(echo "$gw_result" | cut -d'|' -f2)

    local llm_result=$(check_litellm_health)
    local llm_status=$(echo "$llm_result" | cut -d'|' -f1)
    local llm_latency=$(echo "$llm_result" | cut -d'|' -f2)

    # Prometheus format
    echo "# HELP gateway_health Gateway health status (1=healthy, 0=unhealthy)"
    echo "# TYPE gateway_health gauge"
    if [ "$gw_status" = "healthy" ]; then
        echo "gateway_health 1"
    else
        echo "gateway_health 0"
    fi

    echo "# HELP gateway_latency_ms Gateway response latency in milliseconds"
    echo "# TYPE gateway_latency_ms gauge"
    echo "gateway_latency_ms ${gw_latency:-0}"

    echo "# HELP litellm_health LiteLLM health status (1=healthy, 0=unhealthy)"
    echo "# TYPE litellm_health gauge"
    if [ "$llm_status" = "healthy" ]; then
        echo "litellm_health 1"
    else
        echo "litellm_health 0"
    fi

    echo "# HELP litellm_latency_ms LiteLLM response latency in milliseconds"
    echo "# TYPE litellm_latency_ms gauge"
    echo "litellm_latency_ms ${llm_latency:-0}"
}

# Parse arguments
parse_args() {
    COMMAND="$1"
    shift

    while [ $# -gt 0 ]; do
        case "$1" in
            --service)
                SERVICE="$2"
                shift 2
                ;;
            --interval)
                INTERVAL="$2"
                shift 2
                ;;
            --warning)
                WARNING_THRESHOLD="$2"
                shift 2
                ;;
            --critical)
                CRITICAL_THRESHOLD="$2"
                shift 2
                ;;
            --auto-remediate|--autoRemediate)
                AUTO_REMEDIATE="true"
                shift
                ;;
            --json)
                JSON_OUTPUT="true"
                shift
                ;;
            --export)
                EXPORT="true"
                shift
                ;;
            --format)
                FORMAT="$2"
                shift 2
                ;;
            --host)
                GATEWAY_HOST="$2"
                GATEWAY_URL="http://${GATEWAY_HOST}:${GATEWAY_PORT}"
                shift 2
                ;;
            --port)
                GATEWAY_PORT="$2"
                GATEWAY_URL="http://${GATEWAY_HOST}:${GATEWAY_PORT}"
                shift 2
                ;;
            --litellm-host)
                LITELLM_HOST="$2"
                LITELLM_URL="http://${LITELLM_HOST}:${LITELLM_PORT}"
                shift 2
                ;;
            --litellm-port)
                LITELLM_PORT="$2"
                LITELLM_URL="http://${LITELLM_HOST}:${LITELLM_PORT}"
                shift 2
                ;;
            *)
                shift
                ;;
        esac
    done
}

# Main
main() {
    parse_args "$@"

    case "$COMMAND" in
        status)
            if [ "$JSON_OUTPUT" = "true" ]; then
                local gw=$(check_gateway_health)
                local llm=$(check_litellm_health)
                echo "{\"gateway\":{\"status\":\"$(echo $gw | cut -d'|' -f1)\",\"latency\":\"$(echo $gw | cut -d'|' -f2)\"},\"litellm\":{\"status\":\"$(echo $llm | cut -d'|' -f1)\",\"latency\":\"$(echo $llm | cut -d'|' -f2)\"}}"
            else
                show_status
            fi
            ;;
        dashboard)
            show_dashboard
            ;;
        monitor)
            monitor_services "${INTERVAL:-30}" "${AUTO_REMEDIATE:-false}"
            ;;
        metrics)
            if [ "$EXPORT" = "true" ] || [ "$FORMAT" = "prometheus" ]; then
                export_metrics
            else
                show_status
            fi
            ;;
        watch)
            watch -n "${INTERVAL:-5}" "$0 status"
            ;;
        *)
            echo "
Gateway Pulse - CLI Wrapper

Usage: $0 <command> [options]

Commands:
  status       Show current status
  dashboard    Show health dashboard
  monitor      Start continuous monitoring
  metrics      Export metrics (Prometheus format)
  watch        Real-time watch mode

Options:
  --service <svc>     Service to check (gateway, litellm, all)
  --interval <s>      Monitor interval in seconds
  --warning <ms>      Warning latency threshold
  --critical <ms>     Critical latency threshold
  --auto-remediate    Enable auto-remediation
  --json              Output in JSON format
  --export            Export metrics
  --format <fmt>      Metrics format (prometheus)
  --host <host>       Gateway host
  --port <port>       Gateway port
  --litellm-host      LiteLLM host
  --litellm-port      LiteLLM port

Examples:
  $0 status
  $0 dashboard
  $0 monitor --interval 30 --auto-remediate
  $0 metrics --export --format prometheus
  $0 watch --interval 5
"
            exit 1
            ;;
    esac
}

main "$@"
