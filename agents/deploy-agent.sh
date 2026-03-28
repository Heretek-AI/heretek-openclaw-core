#!/bin/bash
# ==============================================================================
# Agent Deployment Script
# ==============================================================================
# Generates agent workspaces from templates for docker-compose deployment
# Usage: ./deploy-agent.sh <agent-id> <agent-name> <agent-role>
# Example: ./deploy-agent.sh steward Steward orchestrator
# ==============================================================================

set -euo pipefail

AGENT_ID="${1:-steward}"
AGENT_NAME="${2:-Steward}"
AGENT_ROLE="${3:-orchestrator}"

TEMPLATE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/templates"
OUTPUT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/deployed"

# Create output directory
mkdir -p "$OUTPUT_DIR/$AGENT_ID"

echo "Deploying agent: $AGENT_NAME ($AGENT_ID) - Role: $AGENT_ROLE"

# Copy template files
for template in SOUL.md IDENTITY.md AGENTS.md USER.md; do
    if [[ -f "$TEMPLATE_DIR/$template" ]]; then
        sed "s/{{AGENT_NAME}}/$AGENT_NAME/g; s/{{AGENT_ROLE}}/$AGENT_ROLE/g" "$TEMPLATE_DIR/$template" > "$OUTPUT_DIR/$AGENT_ID/$template"
        echo "  Created $template"
    fi
done

# Copy and customize config
if [[ -f "$TEMPLATE_DIR/config.json" ]]; then
    sed "s/AGENT_ID_PLACEHOLDER/$AGENT_ID/g; s/Agent Name/$AGENT_NAME/g; s/role_name/$AGENT_ROLE/g" "$TEMPLATE_DIR/config.json" > "$OUTPUT_DIR/$AGENT_ID/config.json"
    echo "  Created config.json"
fi

echo ""
echo "Agent deployed to: $OUTPUT_DIR/$AGENT_ID/"
echo ""
echo "Files created:"
ls -la "$OUTPUT_DIR/$AGENT_ID/"
