#!/bin/bash
#===============================================================================
# User Rolodex - Multi-User Management System
#===============================================================================
# Manages user profiles, preferences, and interaction history.
#
# Usage:
#   ./user-rolodex.sh create --name "John Doe"
#   ./user-rolodex.sh update john-doe --timezone "America/New_York"
#   ./user-rolodex.sh lookup john-doe
#   ./user-rolodex.sh search --project "heretek-openclaw"
#
#===============================================================================

set -euo pipefail

# Configuration
USERS_DIR="${USERS_DIR:-./users}"
USER_SCHEMA="${USER_SCHEMA:-$USERS_DIR/_schema.json}"
USER_INDEX="${USER_INDEX:-$USERS_DIR/index.json}"

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Logging
log() {
    local timestamp
    timestamp="$(date -Iseconds 2>/dev/null || date '+%Y-%m-%dT%H:%M:%S')"
    echo "[$timestamp] [Rolodex] $*"
}

# Generate UUID
generate_uuid() {
    if command -v uuidgen &> /dev/null; then
        uuidgen | tr '[:upper:]' '[:lower:]'
    else
        echo "user-$(date +%s)-$RANDOM"
    fi
}

# Slugify name
slugify() {
    echo "$1" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/--*/-/g' | sed 's/^-\|-$//g'
}

# Initialize users directory
init_users_dir() {
    if [ ! -d "$USERS_DIR" ]; then
        mkdir -p "$USERS_DIR"
        mkdir -p "$USERS_DIR/_templates"
        log "Created users directory: $USERS_DIR"
    fi
    
    # Create schema if not exists
    if [ ! -f "$USER_SCHEMA" ]; then
        cat > "$USER_SCHEMA" <<'EOF'
{
  "$schema": "user-schema-v1",
  "type": "object",
  "required": ["id", "slug", "name"],
  "properties": {
    "id": { "type": "string" },
    "slug": { "type": "string" },
    "name": {
      "type": "object",
      "required": ["full"],
      "properties": {
        "full": { "type": "string" },
        "preferred": { "type": "string" },
        "phonetic": { "type": "string" }
      }
    },
    "pronouns": { "type": "string" },
    "timezone": { "type": "string" },
    "languages": {
      "type": "array",
      "items": { "type": "string" }
    },
    "created": { "type": "string", "format": "date-time" },
    "last_interaction": { "type": "string", "format": "date-time" },
    "relationship": {
      "type": "object",
      "properties": {
        "type": { "type": "string", "enum": ["primary", "collaborator", "occasional"] },
        "since": { "type": "string", "format": "date-time" },
        "trust_level": { "type": "number", "minimum": 0, "maximum": 1 }
      }
    },
    "preferences": {
      "type": "object",
      "properties": {
        "communication_style": { "type": "string" },
        "response_length": { "type": "string" },
        "code_style": { "type": "object" },
        "topics_of_interest": { "type": "array" }
      }
    },
    "projects": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "name": { "type": "string" },
          "role": { "type": "string" },
          "status": { "type": "string" }
        }
      }
    },
    "context_notes": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "date": { "type": "string", "format": "date-time" },
          "note": { "type": "string" },
          "importance": { "type": "number" }
        }
      }
    }
  }
}
EOF
        log "Created user schema"
    fi
    
    # Create index if not exists
    if [ ! -f "$USER_INDEX" ]; then
        cat > "$USER_INDEX" <<EOF
{
  "users": [],
  "last_updated": "$(date -Iseconds 2>/dev/null || date '+%Y-%m-%dT%H:%M:%S')"
}
EOF
        log "Created user index"
    fi
    
    # Create template
    if [ ! -f "$USERS_DIR/_templates/new-user.json" ]; then
        cat > "$USERS_DIR/_templates/new-user.json" <<'EOF'
{
  "id": "",
  "slug": "",
  "name": {
    "full": "",
    "preferred": "",
    "phonetic": null
  },
  "pronouns": null,
  "timezone": "UTC",
  "languages": ["en"],
  "created": "",
  "last_interaction": "",
  "relationship": {
    "type": "collaborator",
    "since": "",
    "trust_level": 0.5
  },
  "preferences": {
    "communication_style": "adaptive",
    "response_length": "adaptive",
    "code_style": {},
    "topics_of_interest": []
  },
  "projects": [],
  "context_notes": []
}
EOF
        log "Created new user template"
    fi
}

# Create new user
create_user() {
    local name="$1"
    local preferred="${2:-$name}"
    local slug
    slug=$(slugify "$name")
    
    local user_dir="$USERS_DIR/$slug"
    
    # Check if user already exists
    if [ -d "$user_dir" ]; then
        log "User already exists: $slug"
        return 1
    fi
    
    # Create user directory
    mkdir -p "$user_dir"
    mkdir -p "$user_dir/notes"
    
    local timestamp
    timestamp="$(date -Iseconds 2>/dev/null || date '+%Y-%m-%dT%H:%M:%S')"
    
    # Create profile
    cat > "$user_dir/profile.json" <<EOF
{
  "id": "$(generate_uuid)",
  "slug": "$slug",
  "name": {
    "full": "$name",
    "preferred": "$preferred",
    "phonetic": null
  },
  "pronouns": null,
  "timezone": "UTC",
  "languages": ["en"],
  "created": "$timestamp",
  "last_interaction": "$timestamp",
  "relationship": {
    "type": "collaborator",
    "since": "$timestamp",
    "trust_level": 0.5
  },
  "preferences": {
    "communication_style": "adaptive",
    "response_length": "adaptive",
    "code_style": {},
    "topics_of_interest": []
  },
  "projects": [],
  "context_notes": []
}
EOF
    
    # Create empty preferences file
    echo '{}' > "$user_dir/preferences.json"
    
    # Create empty history file
    echo '{"interactions": []}' > "$user_dir/history.json"
    
    # Create empty projects file
    echo '{"projects": []}' > "$user_dir/projects.json"
    
    # Update index
    update_index "$slug" "$name"
    
    log "Created user: $slug ($name)"
    echo "$user_dir/profile.json"
}

# Update user index
update_index() {
    local slug="$1"
    local name="$2"
    
    if [ -f "$USER_INDEX" ] && command -v jq &> /dev/null; then
        local temp_file="/tmp/user-index-$$.json"
        jq --arg slug "$slug" --arg name "$name" \
            '.users += [{"slug": $slug, "name": $name}] | .last_updated = "'"$(date -Iseconds 2>/dev/null || date '+%Y-%m-%dT%H:%M:%S')"'"' \
            "$USER_INDEX" > "$temp_file" && mv "$temp_file" "$USER_INDEX"
    fi
}

# Update user
update_user() {
    local slug="$1"
    shift
    
    local user_dir="$USERS_DIR/$slug"
    
    if [ ! -d "$user_dir" ]; then
        log "User not found: $slug"
        return 1
    fi
    
    local profile="$user_dir/profile.json"
    
    # Parse update arguments
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --timezone)
                if [ -f "$profile" ] && command -v jq &> /dev/null; then
                    local temp_file="/tmp/profile-$$.json"
                    jq --arg tz "$2" '.timezone = $tz' "$profile" > "$temp_file" && mv "$temp_file" "$profile"
                    log "Updated timezone for $slug: $2"
                fi
                shift 2
                ;;
            --pronouns)
                if [ -f "$profile" ] && command -v jq &> /dev/null; then
                    local temp_file="/tmp/profile-$$.json"
                    jq --arg pn "$2" '.pronouns = $pn' "$profile" > "$temp_file" && mv "$temp_file" "$profile"
                    log "Updated pronouns for $slug: $2"
                fi
                shift 2
                ;;
            --preferred)
                if [ -f "$profile" ] && command -v jq &> /dev/null; then
                    local temp_file="/tmp/profile-$$.json"
                    jq --arg pref "$2" '.name.preferred = $pref' "$profile" > "$temp_file" && mv "$temp_file" "$profile"
                    log "Updated preferred name for $slug: $2"
                fi
                shift 2
                ;;
            --trust)
                if [ -f "$profile" ] && command -v jq &> /dev/null; then
                    local temp_file="/tmp/profile-$$.json"
                    jq --argjson trust "$2" '.relationship.trust_level = $trust' "$profile" > "$temp_file" && mv "$temp_file" "$profile"
                    log "Updated trust level for $slug: $2"
                fi
                shift 2
                ;;
            *)
                shift
                ;;
        esac
    done
    
    # Update last_interaction
    if [ -f "$profile" ] && command -v jq &> /dev/null; then
        local temp_file="/tmp/profile-$$.json"
        jq '.last_interaction = "'"$(date -Iseconds 2>/dev/null || date '+%Y-%m-%dT%H:%M:%S')"'"' "$profile" > "$temp_file" && mv "$temp_file" "$profile"
    fi
}

# Lookup user
lookup_user() {
    local slug="$1"
    local user_dir="$USERS_DIR/$slug"
    
    if [ ! -d "$user_dir" ]; then
        log "User not found: $slug"
        return 1
    fi
    
    echo "=== User: $slug ==="
    if [ -f "$user_dir/profile.json" ]; then
        if command -v jq &> /dev/null; then
            jq '.' "$user_dir/profile.json"
        else
            cat "$user_dir/profile.json"
        fi
    fi
}

# Search users
search_users() {
    local query="$1"
    
    echo "=== User Search: $query ==="
    
    if [ -f "$USER_INDEX" ] && command -v jq &> /dev/null; then
        jq -r --arg q "$query" '.users[] | select(.name | test($q; "i") or .slug | test($q; "i")) | "- \(.slug): \(.name)"' "$USER_INDEX" 2>/dev/null
    else
        log "Index not available or jq not installed"
    fi
}

# Add note to user
add_note() {
    local slug="$1"
    local note="$2"
    local importance="${3:-0.5}"
    
    local user_dir="$USERS_DIR/$slug"
    
    if [ ! -d "$user_dir" ]; then
        log "User not found: $slug"
        return 1
    fi
    
    local profile="$user_dir/profile.json"
    local timestamp
    timestamp="$(date -Iseconds 2>/dev/null || date '+%Y-%m-%dT%H:%M:%S')"
    
    if [ -f "$profile" ] && command -v jq &> /dev/null; then
        local temp_file="/tmp/profile-$$.json"
        jq --arg date "$timestamp" --arg note "$note" --argjson importance "$importance" \
            '.context_notes += [{"date": $date, "note": $note, "importance": $importance}]' \
            "$profile" > "$temp_file" && mv "$temp_file" "$profile"
        log "Added note to $slug: $note"
    fi
}

# Learn preference
learn_preference() {
    local slug="$1"
    local category="$2"
    local preference="$3"
    
    local user_dir="$USERS_DIR/$slug"
    
    if [ ! -d "$user_dir" ]; then
        log "User not found: $slug"
        return 1
    fi
    
    local prefs="$user_dir/preferences.json"
    
    if [ -f "$prefs" ] && command -v jq &> /dev/null; then
        local temp_file="/tmp/prefs-$$.json"
        jq --arg cat "$category" --arg pref "$preference" \
            '.[$cat] = $pref' "$prefs" > "$temp_file" && mv "$temp_file" "$prefs"
        log "Learned preference for $slug: $category = $preference"
    fi
}

# List all users
list_users() {
    echo "=== All Users ==="
    
    if [ -f "$USER_INDEX" ] && command -v jq &> /dev/null; then
        jq -r '.users[] | "- \(.slug): \(.name)"' "$USER_INDEX" 2>/dev/null
    else
        # Fallback: list directories
        for dir in "$USERS_DIR"/*/; do
            if [ -d "$dir" ] && [ "$(basename "$dir")" != "_templates" ]; then
                local slug
                slug=$(basename "$dir")
                echo "- $slug"
            fi
        done
    fi
}

# Main entry point
init_users_dir

case "${1:-help}" in
    create)
        shift
        local name=""
        local preferred=""
        while [[ $# -gt 0 ]]; do
            case "$1" in
                --name) name="$2"; shift 2 ;;
                --preferred) preferred="$2"; shift 2 ;;
                *) shift ;;
            esac
        done
        if [ -n "$name" ]; then
            create_user "$name" "$preferred"
        else
            echo "Usage: $0 create --name \"Full Name\" [--preferred \"Preferred\"]"
        fi
        ;;
    update)
        shift
        if [ $# -ge 1 ]; then
            update_user "$@"
        else
            echo "Usage: $0 update <slug> [--timezone TZ] [--pronouns PN] [--preferred NAME] [--trust 0-1]"
        fi
        ;;
    lookup)
        shift
        if [ $# -ge 1 ]; then
            lookup_user "$1"
        else
            echo "Usage: $0 lookup <slug>"
        fi
        ;;
    search)
        shift
        if [ $# -ge 1 ]; then
            search_users "$1"
        else
            echo "Usage: $0 search <query>"
        fi
        ;;
    note)
        shift
        if [ $# -ge 2 ]; then
            add_note "$1" "$2" "$3"
        else
            echo "Usage: $0 note <slug> <note> [importance]"
        fi
        ;;
    prefer)
        shift
        if [ $# -ge 3 ]; then
            learn_preference "$1" "$2" "$3"
        else
            echo "Usage: $0 prefer <slug> <category> <preference>"
        fi
        ;;
    list)
        list_users
        ;;
    init)
        init_users_dir
        log "Users directory initialized"
        ;;
    help|*)
        echo "User Rolodex - Multi-User Management"
        echo ""
        echo "Usage:"
        echo "  $0 create --name \"Full Name\" [--preferred \"Preferred\"]"
        echo "  $0 update <slug> [--timezone TZ] [--pronouns PN] [--trust 0-1]"
        echo "  $0 lookup <slug>"
        echo "  $0 search <query>"
        echo "  $0 note <slug> <note> [importance 0-1]"
        echo "  $0 prefer <slug> <category> <preference>"
        echo "  $0 list"
        echo "  $0 init"
        ;;
esac
