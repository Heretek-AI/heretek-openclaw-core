#!/bin/bash
#
# Triad Orchestrator - Status CLI Wrapper
# ==============================================================================
# Provides CLI interface for triad deliberation operations.
# Supports proposal management, voting, and deadlock resolution.
#
# Usage:
#   ./triad-status.sh <command> [options]
#

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_DIR="$(dirname "$SCRIPT_DIR")"
STATE_DIR="${OPENCLAW_STATE_DIR:-/app/state}"
PROPOSALS_DIR="${STATE_DIR}/proposals"
LEDGER_FILE="${STATE_DIR}/triad-ledger.json"
GATEWAY_URL="${GATEWAY_URL:-ws://127.0.0.1:18789}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Triad members
TRIAD_MEMBERS=("steward" "alpha" "beta" "gamma")

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

# Ensure state directories exist
ensure_state_dir() {
    if [ ! -d "$STATE_DIR" ]; then
        mkdir -p "$STATE_DIR"
    fi
    if [ ! -d "$PROPOSALS_DIR" ]; then
        mkdir -p "$PROPOSALS_DIR"
    fi
}

# Generate UUID
generate_uuid() {
    if command -v uuidgen &> /dev/null; then
        uuidgen
    else
        cat /proc/sys/kernel/random/uuid 2>/dev/null || echo "$(date +%s)-$$-$RANDOM"
    fi
}

# Create proposal
create_proposal() {
    local title="$1"
    local type="${2:-custom}"
    local description="${3:-}"
    local creator="${4:-cli}"
    
    ensure_state_dir
    
    local id=$(generate_uuid)
    local now=$(date -Iseconds)
    local timeout=$(date -Iseconds -d "+1 hour" 2>/dev/null || date -v+1H -Iseconds 2>/dev/null || echo "$now")
    
    cat > "${PROPOSALS_DIR}/${id}.json" << EOF
{
  "id": "$id",
  "title": "$title",
  "description": "$description",
  "type": "$type",
  "state": "pending",
  "creator": "$creator",
  "createdAt": "$now",
  "updatedAt": "$now",
  "timeoutAt": "$timeout",
  "votes": {},
  "voteHistory": [],
  "metadata": {}
}
EOF
    
    log_success "Proposal created: $id"
    echo ""
    echo "Title: $title"
    echo "Type:  $type"
    echo "State: pending"
}

# Get proposal
get_proposal() {
    local id="$1"
    local file="${PROPOSALS_DIR}/${id}.json"
    
    if [ -f "$file" ]; then
        cat "$file" | jq .
    else
        log_error "Proposal not found: $id"
        exit 1
    fi
}

# List proposals
list_proposals() {
    local status_filter="$1"
    
    ensure_state_dir
    
    echo ""
    echo "=== Proposals ==="
    echo ""
    printf "%-36s %-30s %-12s %s\n" "ID" "TITLE" "STATE" "CREATED"
    echo "----------------------------------------------------------------------------------------------------"
    
    for file in "${PROPOSALS_DIR}"/*.json; do
        [ -f "$file" ] || continue
        
        local id=$(basename "$file" .json)
        local title=$(jq -r '.title' "$file" | cut -c1-28)
        local state=$(jq -r '.state' "$file")
        local created=$(jq -r '.createdAt' "$file" | cut -dT1)
        
        if [ -n "$status_filter" ] && [ "$state" != "$status_filter" ]; then
            continue
        fi
        
        printf "%-36s %-30s %-12s %s\n" "$id" "$title" "$state" "$created"
    done
    
    echo ""
}

# Submit vote
submit_vote() {
    local proposal_id="$1"
    local voter="$2"
    local vote="$3"
    local file="${PROPOSALS_DIR}/${proposal_id}.json"
    
    if [ ! -f "$file" ]; then
        log_error "Proposal not found: $proposal_id"
        exit 1
    fi
    
    local valid_votes=("approve" "reject" "abstain")
    if [[ ! " ${valid_votes[@]} " =~ " ${vote} " ]]; then
        log_error "Invalid vote: $vote. Must be one of: approve, reject, abstain"
        exit 1
    fi
    
    local now=$(date -Iseconds)
    local tmp_file=$(mktemp)
    
    # Update proposal with vote
    jq --arg voter "$voter" --arg vote "$vote" --arg ts "$now" \
       '.votes[$voter] = {"value": $vote, "timestamp": $ts} | .updatedAt = $now | .voteHistory += [{"voter": $voter, "vote": $vote, "timestamp": $ts}]' \
       "$file" > "$tmp_file" && mv "$tmp_file" "$file"
    
    log_success "Vote recorded: $voter -> $vote for proposal $proposal_id"
}

# Get vote tally
get_vote_tally() {
    local proposal_id="$1"
    local file="${PROPOSALS_DIR}/${proposal_id}.json"
    
    if [ ! -f "$file" ]; then
        log_error "Proposal not found: $proposal_id"
        exit 1
    fi
    
    echo ""
    echo "=== Vote Tally for $proposal_id ==="
    echo ""
    
    local approve=$(jq '[.votes[] | select(.value == "approve")] | length' "$file")
    local reject=$(jq '[.votes[] | select(.value == "reject")] | length' "$file")
    local abstain=$(jq '[.votes[] | select(.value == "abstain")] | length' "$file")
    local total=$((approve + reject + abstain))
    
    echo "Approve:  $approve"
    echo "Reject:   $reject"
    echo "Abstain:  $abstain"
    echo "Total:    $total"
    
    # Check missing voters
    echo ""
    echo "Voting status:"
    for member in "${TRIAD_MEMBERS[@]}"; do
        local has_voted=$(jq --arg m "$member" '.votes[$m] != null' "$file")
        if [ "$has_voted" = "true" ]; then
            local vote=$(jq -r --arg m "$member" '.votes[$m].value' "$file")
            echo "  $member: $vote"
        else
            echo "  $member: (not voted)"
        fi
    done
    
    echo ""
}

# Check deadlock
check_deadlock() {
    local proposal_id="$1"
    local file="${PROPOSALS_DIR}/${proposal_id}.json"
    
    if [ ! -f "$file" ]; then
        log_error "Proposal not found: $proposal_id"
        exit 1
    fi
    
    local approve=$(jq '[.votes[] | select(.value == "approve")] | length' "$file")
    local reject=$(jq '[.votes[] | select(.value == "reject")] | length' "$file")
    
    if [ "$approve" -eq "$reject" ] && [ "$approve" -gt 0 ]; then
        log_warning "DEADLOCK DETECTED: Equal votes ($approve approve, $reject reject)"
        echo ""
        echo "Recommended resolution: steward-tiebreak"
        return 0
    fi
    
    log_success "No deadlock detected"
}

# Show dashboard
show_dashboard() {
    ensure_state_dir
    
    echo ""
    echo "╔══════════════════════════════════════════════════════════╗"
    echo "║           TRIAD DELIBERATION DASHBOARD                   ║"
    echo "╚══════════════════════════════════════════════════════════╝"
    echo ""
    
    # Count proposals by state
    echo "=== Proposal States ==="
    echo ""
    
    local draft=0 pending=0 voting=0 approved=0 rejected=0 deadlocked=0 executed=0
    
    for file in "${PROPOSALS_DIR}"/*.json; do
        [ -f "$file" ] || continue
        local state=$(jq -r '.state' "$file")
        case "$state" in
            draft) ((draft++)) ;;
            pending) ((pending++)) ;;
            voting) ((voting++)) ;;
            approved) ((approved++)) ;;
            rejected) ((rejected++)) ;;
            deadlocked) ((deadlocked++)) ;;
            executed) ((executed++)) ;;
        esac
    done
    
    printf "%-15s %s\n" "Draft:" "$draft"
    printf "%-15s %s\n" "Pending:" "$pending"
    printf "%-15s %s\n" "Voting:" "$voting"
    printf "%-15s %s\n" "Approved:" "$approved"
    printf "%-15s %s\n" "Rejected:" "$rejected"
    printf "%-15s %s\n" "Deadlocked:" "$deadlocked"
    printf "%-15s %s\n" "Executed:" "$executed"
    
    echo ""
    echo "=== Triad Members ==="
    echo ""
    printf "%-15s %-10s\n" "MEMBER" "STATUS"
    echo "----------------------------"
    
    for member in "${TRIAD_MEMBERS[@]}"; do
        printf "%-15s %-10s\n" "$member" "active"
    done
    
    echo ""
}

# Parse arguments
parse_args() {
    COMMAND="$1"
    shift
    
    while [ $# -gt 0 ]; do
        case "$1" in
            --id|--proposal)
                PROPOSAL_ID="$2"
                shift 2
                ;;
            --title)
                TITLE="$2"
                shift 2
                ;;
            --type)
                TYPE="$2"
                shift 2
                ;;
            --vote)
                VOTE="$2"
                shift 2
                ;;
            --voter)
                VOTER="$2"
                shift 2
                ;;
            --method)
                METHOD="$2"
                shift 2
                ;;
            --status)
                STATUS_FILTER="$2"
                shift 2
                ;;
            --json)
                JSON_OUTPUT="true"
                shift
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
        propose)
            create_proposal "${TITLE:-Untitled}" "${TYPE:-custom}" "" "cli"
            ;;
        proposal)
            get_proposal "${PROPOSAL_ID:-}"
            ;;
        proposals)
            list_proposals "${STATUS_FILTER:-}"
            ;;
        vote)
            submit_vote "${PROPOSAL_ID:-}" "${VOTER:-cli}" "${VOTE:-}"
            ;;
        votes|tabulate)
            get_vote_tally "${PROPOSAL_ID:-}"
            ;;
        check-deadlock)
            check_deadlock "${PROPOSAL_ID:-}"
            ;;
        dashboard|status)
            show_dashboard
            ;;
        *)
            echo "
Triad Orchestrator - Status CLI

Usage: $0 <command> [options]

Commands:
  propose          Create a new proposal (--title required)
  proposal         View proposal details (--id required)
  proposals        List all proposals
  vote             Submit a vote (--proposal, --vote required)
  votes            View vote status (--proposal required)
  tabulate         Show vote tally (--proposal required)
  check-deadlock   Check for deadlock (--proposal required)
  dashboard        Show triad dashboard
  status           Show triad status

Options:
  --id <id>        Proposal ID
  --proposal <id>  Proposal ID
  --title <title>  Proposal title
  --type <type>    Proposal type (config, deployment, governance)
  --vote <vote>    Vote value (approve, reject, abstain)
  --voter <id>     Voter ID
  --method <method> Resolution method
  --status <state> Filter by status
  --json           Output in JSON format

Examples:
  $0 propose --title \"Deploy update\" --type deployment
  $0 proposal --id <proposal-id>
  $0 vote --proposal <id> --vote approve --voter alpha
  $0 tabulate --proposal <id>
  $0 check-deadlock --proposal <id>
  $0 dashboard
"
            exit 1
            ;;
    esac
}

main "$@"
