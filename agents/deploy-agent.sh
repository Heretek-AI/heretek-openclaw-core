#!/bin/bash
# ==============================================================================
# Agent Deployment Script
# ==============================================================================
# Generates agent workspaces from templates for deployment.
#
# Usage:
#   Single agent deployment:
#     ./deploy-agent.sh <agent-id> <agent-name> <agent-role> [options]
#     Example: ./deploy-agent.sh steward Steward orchestrator --target local
#
#   Batch deployment (all agents from openclaw.json):
#     ./deploy-agent.sh --batch
#     ./deploy-agent.sh --batch --target local
#
# Options:
#   --target <target>    Deployment target: "openclaw" (default) or "local"
#                        - openclaw: Deploys to ~/.openclaw/agents/<agent>/workspace/
#                        - local: Deploys to ./deployed/<agent>/
#   --batch              Deploy all agents defined in openclaw.json
#   --help, -h           Show this help message
#
# Examples:
#   # Deploy single agent to ~/.openclaw/agents/steward/workspace/ (default)
#   ./deploy-agent.sh steward Steward orchestrator
#
#   # Deploy single agent to local deployed/ directory
#   ./deploy-agent.sh steward Steward orchestrator --target local
#
#   # Deploy all agents to ~/.openclaw/agents/ (default)
#   ./deploy-agent.sh --batch
#
#   # Deploy all agents to local deployed/ directory
#   ./deploy-agent.sh --batch --target local
#
# ==============================================================================

set -euo pipefail

# ==============================================================================
# Configuration
# ==============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CORE_DIR="$(dirname "$SCRIPT_DIR")"
TEMPLATE_DIR="$SCRIPT_DIR/templates"
OPENCLAW_JSON="$CORE_DIR/openclaw.json"

# Default deployment target: ~/.openclaw/agents/
DEFAULT_TARGET="openclaw"

# ==============================================================================
# Helper Functions
# ==============================================================================

# Show usage information
show_help() {
    head -30 "$0" | tail -28 | sed 's/^# \?//'
    exit 0
}

# Log error message and exit
log_error() {
    echo "ERROR: $1" >&2
    exit 1
}

# Log info message
log_info() {
    echo "INFO: $1"
}

# Log success message
log_success() {
    echo "SUCCESS: $1"
}

# Validate that a command exists
require_command() {
    if ! command -v "$1" &> /dev/null; then
        log_error "Required command '$1' not found. Please install it."
    fi
}

# Validate template directory exists
validate_templates() {
    if [[ ! -d "$TEMPLATE_DIR" ]]; then
        log_error "Template directory not found: $TEMPLATE_DIR"
    fi
}

# Validate openclaw.json exists
validate_openclaw_json() {
    if [[ ! -f "$OPENCLAW_JSON" ]]; then
        log_error "openclaw.json not found: $OPENCLAW_JSON"
    fi
}

# Get deployment directory based on target
get_deploy_dir() {
    local target="$1"
    local agent_id="$2"
    
    case "$target" in
        openclaw)
            echo "$HOME/.openclaw/agents/$agent_id/workspace"
            ;;
        local)
            echo "$SCRIPT_DIR/deployed/$agent_id"
            ;;
        *)
            log_error "Unknown target: $target. Valid targets: openclaw, local"
            ;;
    esac
}

# Deploy a single agent
deploy_agent() {
    local agent_id="$1"
    local agent_name="$2"
    local agent_role="$3"
    local target="$4"
    
    local deploy_dir
    deploy_dir="$(get_deploy_dir "$target" "$agent_id")"
    
    # Create output directory
    mkdir -p "$deploy_dir"
    
    log_info "Deploying agent: $agent_name ($agent_id) - Role: $agent_role"
    log_info "Target directory: $deploy_dir"
    
    # Copy template files
    for template in SOUL.md IDENTITY.md AGENTS.md USER.md; do
        if [[ -f "$TEMPLATE_DIR/$template" ]]; then
            sed "s/{{AGENT_NAME}}/$agent_name/g; s/{{AGENT_ROLE}}/$agent_role/g" \
                "$TEMPLATE_DIR/$template" > "$deploy_dir/$template"
            echo "  Created $template"
        else
            echo "  WARNING: Template not found: $template"
        fi
    done
    
    # Copy and customize config
    if [[ -f "$TEMPLATE_DIR/config.json" ]]; then
        sed "s/AGENT_ID_PLACEHOLDER/$agent_id/g; s/Agent Name/$agent_name/g; s/role_name/$agent_role/g" \
            "$TEMPLATE_DIR/config.json" > "$deploy_dir/config.json"
        echo "  Created config.json"
    else
        echo "  WARNING: Template config.json not found"
    fi
    
    log_success "Agent deployed to: $deploy_dir/"
    echo ""
    echo "Files created:"
    ls -la "$deploy_dir/"
    echo ""
}

# Extract agents from openclaw.json and deploy them
deploy_batch() {
    local target="$1"
    
    validate_openclaw_json
    validate_templates
    require_command "jq"
    
    log_info "Reading agent configurations from: $OPENCLAW_JSON"
    
    # Extract agents from openclaw.json
    # The agents are in .agents.list array
    local agents_json
    agents_json=$(jq -c '.agents.list[] | select(.id != null and .workspace != null)' "$OPENCLAW_JSON")
    
    if [[ -z "$agents_json" ]]; then
        log_error "No agents found in openclaw.json"
    fi
    
    local count=0
    local success=0
    local failed=0
    
    # Process each agent
    while IFS= read -r agent_line; do
        [[ -z "$agent_line" ]] && continue
        
        local agent_id agent_name agent_workspace
        agent_id=$(echo "$agent_line" | jq -r '.id // empty')
        agent_name=$(echo "$agent_line" | jq -r '.name // .id')
        agent_workspace=$(echo "$agent_line" | jq -r '.workspace // empty')
        
        # Skip if no id or workspace
        if [[ -z "$agent_id" ]]; then
            log_info "Skipping agent with no id"
            continue
        fi
        
        # For batch deployment, we use the workspace path from openclaw.json
        # if target is openclaw, otherwise use local
        local deploy_dir
        if [[ "$target" == "openclaw" && -n "$agent_workspace" ]]; then
            deploy_dir="$agent_workspace"
        else
            deploy_dir="$(get_deploy_dir "$target" "$agent_id")"
        fi
        
        ((count++)) || true
        
        log_info "[$count] Deploying agent: $agent_name ($agent_id)"
        
        # Create output directory
        mkdir -p "$deploy_dir"
        
        # Copy template files
        local agent_success=true
        for template in SOUL.md IDENTITY.md AGENTS.md USER.md; do
            if [[ -f "$TEMPLATE_DIR/$template" ]]; then
                sed "s/{{AGENT_NAME}}/$agent_name/g; s/{{AGENT_ROLE}}/$agent_id/g" \
                    "$TEMPLATE_DIR/$template" > "$deploy_dir/$template"
                echo "  Created $template"
            else
                echo "  WARNING: Template not found: $template"
            fi
        done
        
        # Copy and customize config
        if [[ -f "$TEMPLATE_DIR/config.json" ]]; then
            sed "s/AGENT_ID_PLACEHOLDER/$agent_id/g; s/Agent Name/$agent_name/g; s/role_name/$agent_id/g" \
                "$TEMPLATE_DIR/config.json" > "$deploy_dir/config.json"
            echo "  Created config.json"
        else
            echo "  WARNING: Template config.json not found"
        fi
        
        if [[ "$agent_success" == true ]]; then
            ((success++)) || true
            log_success "Agent $agent_id deployed to: $deploy_dir/"
        else
            ((failed++)) || true
            log_error "Failed to deploy agent: $agent_id"
        fi
        
        echo ""
    done <<< "$agents_json"
    
    # Summary
    echo "=============================================="
    echo "Batch Deployment Summary"
    echo "=============================================="
    echo "Total agents processed: $count"
    echo "Successful: $success"
    echo "Failed: $failed"
    echo "=============================================="
    
    if [[ $failed -gt 0 ]]; then
        exit 1
    fi
}

# ==============================================================================
# Main Script
# ==============================================================================

# Parse command line arguments
TARGET="$DEFAULT_TARGET"
BATCH_MODE=false

# Check for help flag first
if [[ "${1:-}" == "--help" ]] || [[ "${1:-}" == "-h" ]]; then
    show_help
fi

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --target)
            TARGET="$2"
            if [[ "$TARGET" != "openclaw" && "$TARGET" != "local" ]]; then
                log_error "Invalid target: $TARGET. Valid targets: openclaw, local"
            fi
            shift 2
            ;;
        --batch)
            BATCH_MODE=true
            shift
            ;;
        --help|-h)
            show_help
            ;;
        -*)
            log_error "Unknown option: $1. Use --help for usage information."
            ;;
        *)
            # Positional arguments for single agent deployment
            break
            ;;
    esac
done

# Validate templates exist
validate_templates

# Execute deployment
if [[ "$BATCH_MODE" == true ]]; then
    # Batch deployment mode
    deploy_batch "$TARGET"
else
    # Single agent deployment mode (backward compatible)
    AGENT_ID="${1:-steward}"
    AGENT_NAME="${2:-Steward}"
    AGENT_ROLE="${3:-orchestrator}"
    
    deploy_agent "$AGENT_ID" "$AGENT_NAME" "$AGENT_ROLE" "$TARGET"
fi
