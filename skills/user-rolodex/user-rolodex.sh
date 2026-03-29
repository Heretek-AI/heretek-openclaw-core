#!/bin/bash
# User Rolodex — Multi-User Management System
# Usage: ./user-rolodex.sh <command> [options]
#
# Commands:
#   create    - Add new user to rolodex
#   update    - Update user information
#   lookup    - Retrieve user by name/id
#   search    - Find users by attribute
#   note      - Add interaction note
#   prefer    - Learn/update preference
#   merge     - Merge duplicate profiles
#   list      - List all users
#   help      - Show this help message

set -e

# =============================================================================
# Configuration
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE_ROOT="${WORKSPACE_ROOT:-$(dirname "$(dirname "$SCRIPT_DIR")")}"
USERS_DIR="${USERS_DIR:-$WORKSPACE_ROOT/users}"
USER_SCHEMA="$USERS_DIR/_schema.json"
USER_INDEX="$USERS_DIR/index.json"
TEMPLATES_DIR="$USERS_DIR/_templates"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# =============================================================================
# Utility Functions
# =============================================================================

# Check if jq is available
has_jq() {
    command -v jq &> /dev/null
}

# Generate a unique ID for a user
generate_user_id() {
    local prefix="user"
    local random=$(openssl rand -hex 4 2>/dev/null || echo "$RANDOM$RANDOM")
    echo "${prefix}-${random}"
}

# Generate a slug from a name (URL-safe identifier)
slugify() {
    local name="$1"
    echo "$name" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/--*/-/g' | sed 's/^-\|-$//g'
}

# Get current ISO 8601 timestamp
get_timestamp() {
    date -u +"%Y-%m-%dT%H:%M:%SZ"
}

# Get today's date for note files
get_date() {
    date +"%Y-%m-%d"
}

# Print colored output
print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}" >&2
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_header() {
    echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${CYAN}  $1${NC}"
    echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
}

# =============================================================================
# JSON Helper Functions (with jq fallback)
# =============================================================================

# Read JSON file
json_read() {
    local file="$1"
    if [[ ! -f "$file" ]]; then
        print_error "File not found: $file"
        return 1
    fi
    
    if has_jq; then
        cat "$file"
    else
        cat "$file"
    fi
}

# Write JSON to file (pretty-printed)
json_write() {
    local file="$1"
    local content="$2"
    
    if has_jq; then
        echo "$content" | jq '.' > "$file"
    else
        echo "$content" > "$file"
    fi
}

# Get JSON value by path
json_get() {
    local file="$1"
    local path="$2"
    
    if has_jq; then
        jq -r "$path // empty" "$file" 2>/dev/null
    else
        # Basic fallback using grep/sed (limited functionality)
        local key=$(echo "$path" | sed 's/\.//g')
        grep -o "\"$key\"[[:space:]]*:[[:space:]]*\"[^\"]*\"" "$file" | head -1 | sed 's/.*:.*"\([^"]*\)".*/\1/'
    fi
}

# Set JSON value (requires jq)
json_set() {
    local file="$1"
    local path="$2"
    local value="$3"
    
    if has_jq; then
        local tmp=$(mktemp)
        jq "$path = $value" "$file" > "$tmp" && mv "$tmp" "$file"
    else
        print_error "jq is required for modifying JSON. Please install jq."
        return 1
    fi
}

# =============================================================================
# User Directory Management
# =============================================================================

# Ensure user directory structure exists
ensure_user_dir() {
    local slug="$1"
    local user_dir="$USERS_DIR/$slug"
    
    mkdir -p "$user_dir/notes"
    
    # Create default files if they don't exist
    if [[ ! -f "$user_dir/preferences.json" ]]; then
        echo '{}' > "$user_dir/preferences.json"
    fi
    if [[ ! -f "$user_dir/history.json" ]]; then
        echo '{"interactions": []}' > "$user_dir/history.json"
    fi
    if [[ ! -f "$user_dir/projects.json" ]]; then
        echo '{"projects": []}' > "$user_dir/projects.json"
    fi
}

# Check if user exists
user_exists() {
    local slug="$1"
    [[ -f "$USERS_DIR/$slug/profile.json" ]]
}

# Get user profile path
get_user_profile() {
    local slug="$1"
    echo "$USERS_DIR/$slug/profile.json"
}

# =============================================================================
# Index Management
# =============================================================================

# Initialize index if it doesn't exist
init_index() {
    if [[ ! -f "$USER_INDEX" ]]; then
        mkdir -p "$(dirname "$USER_INDEX")"
        cat > "$USER_INDEX" << 'EOF'
{
  "$schema": "user-index-v1",
  "version": "1.0.0",
  "updated": "",
  "description": "Index of all users in the rolodex for quick lookup",
  "users": [],
  "stats": {
    "total_users": 0,
    "primary_users": 0,
    "collaborators": 0,
    "occasional_users": 0
  }
}
EOF
        update_index_timestamp
    fi
}

# Update index timestamp
update_index_timestamp() {
    if has_jq; then
        local tmp=$(mktemp)
        jq ".updated = \"$(get_timestamp)\"" "$USER_INDEX" > "$tmp" && mv "$tmp" "$USER_INDEX"
    fi
}

# Add user to index
add_user_to_index() {
    local slug="$1"
    local name="$2"
    local type="${3:-collaborator}"
    local trust_level="${4:-0.5}"
    
    init_index
    
    if has_jq; then
        local tmp=$(mktemp)
        local new_user=$(cat <<EOF
{
  "slug": "$slug",
  "name": "$name",
  "type": "$type",
  "since": "$(get_date)",
  "trust_level": $trust_level,
  "projects": []
}
EOF
)
        jq ".users += [$new_user] | .stats.total_users += 1" "$USER_INDEX" > "$tmp" && mv "$tmp" "$USER_INDEX"
        
        # Update type-specific counter
        case "$type" in
            primary)
                jq ".stats.primary_users += 1" "$USER_INDEX" > "$tmp" && mv "$tmp" "$USER_INDEX"
                ;;
            collaborator)
                jq ".stats.collaborators += 1" "$USER_INDEX" > "$tmp" && mv "$tmp" "$USER_INDEX"
                ;;
            occasional)
                jq ".stats.occasional_users += 1" "$USER_INDEX" > "$tmp" && mv "$tmp" "$USER_INDEX"
                ;;
        esac
        
        update_index_timestamp
    fi
}

# Remove user from index
remove_user_from_index() {
    local slug="$1"
    
    if has_jq; then
        local type=$(jq -r ".users[] | select(.slug == \"$slug\") | .type" "$USER_INDEX" 2>/dev/null)
        local tmp=$(mktemp)
        jq ".users = [.users[] | select(.slug != \"$slug\")] | .stats.total_users -= 1" "$USER_INDEX" > "$tmp" && mv "$tmp" "$USER_INDEX"
        
        # Update type-specific counter
        case "$type" in
            primary)
                jq ".stats.primary_users -= 1" "$USER_INDEX" > "$tmp" && mv "$tmp" "$USER_INDEX"
                ;;
            collaborator)
                jq ".stats.collaborators -= 1" "$USER_INDEX" > "$tmp" && mv "$tmp" "$USER_INDEX"
                ;;
            occasional)
                jq ".stats.occasional_users -= 1" "$USER_INDEX" > "$tmp" && mv "$tmp" "$USER_INDEX"
                ;;
        esac
        
        update_index_timestamp
    fi
}

# Update user in index
update_user_in_index() {
    local slug="$1"
    local field="$2"
    local value="$3"
    
    if has_jq; then
        local tmp=$(mktemp)
        jq "(.users[] | select(.slug == \"$slug\") | .$field) = $value" "$USER_INDEX" > "$tmp" && mv "$tmp" "$USER_INDEX"
        update_index_timestamp
    fi
}

# =============================================================================
# Command: Create User
# =============================================================================

cmd_create() {
    local name=""
    local preferred=""
    local pronouns=""
    local timezone="America/New_York"
    local type="collaborator"
    local trust_level="0.5"
    
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --name|-n)
                name="$2"
                shift 2
                ;;
            --preferred|-p)
                preferred="$2"
                shift 2
                ;;
            --pronouns)
                pronouns="$2"
                shift 2
                ;;
            --timezone|-t)
                timezone="$2"
                shift 2
                ;;
            --type)
                type="$2"
                shift 2
                ;;
            --trust)
                trust_level="$2"
                shift 2
                ;;
            *)
                print_error "Unknown option: $1"
                show_create_help
                exit 1
                ;;
        esac
    done
    
    # Validate required fields
    if [[ -z "$name" ]]; then
        print_error "Name is required. Use --name 'Full Name'"
        show_create_help
        exit 1
    fi
    
    # Generate slug
    local slug=$(slugify "$name")
    
    # Check if user already exists
    if user_exists "$slug"; then
        print_error "User '$slug' already exists. Use 'update' to modify."
        exit 1
    fi
    
    # Set preferred name default
    [[ -z "$preferred" ]] && preferred="$name"
    
    # Create user directory
    ensure_user_dir "$slug"
    
    # Generate user ID
    local user_id=$(generate_user_id)
    local timestamp=$(get_timestamp)
    
    # Create profile.json
    cat > "$USERS_DIR/$slug/profile.json" << EOF
{
  "id": "$user_id",
  "slug": "$slug",
  "name": {
    "full": "$name",
    "preferred": "$preferred",
    "phonetic": null
  },
  "pronouns": $( [[ -n "$pronouns" ]] && echo "\"$pronouns\"" || echo "null" ),
  "timezone": "$timezone",
  "languages": ["en"],
  "created": "$timestamp",
  "last_interaction": "$timestamp",
  "relationship": {
    "type": "$type",
    "since": "$timestamp",
    "trust_level": $trust_level
  },
  "preferences": {
    "communication_style": "adaptive",
    "response_length": "adaptive",
    "code_style": {
      "comments": "standard",
      "naming": "descriptive",
      "formatting": null
    },
    "topics_of_interest": []
  },
  "projects": [],
  "context_notes": []
}
EOF
    
    # Add to index
    add_user_to_index "$slug" "$preferred" "$type" "$trust_level"
    
    print_success "Created user: $slug"
    print_info "Profile: $USERS_DIR/$slug/profile.json"
    
    # Show summary
    echo ""
    print_header "User Profile"
    echo "  ID:           $user_id"
    echo "  Slug:         $slug"
    echo "  Name:         $name"
    echo "  Preferred:    $preferred"
    echo "  Type:         $type"
    echo "  Trust Level:  $trust_level"
}

show_create_help() {
    echo ""
    echo "Usage: user-rolodex.sh create --name 'Full Name' [options]"
    echo ""
    echo "Options:"
    echo "  --name, -n       Full name (required)"
    echo "  --preferred, -p  Preferred name/nickname"
    echo "  --pronouns       User's pronouns (e.g., 'he/him')"
    echo "  --timezone, -t   IANA timezone (default: America/New_York)"
    echo "  --type           Relationship type: primary, collaborator, occasional"
    echo "  --trust          Initial trust level 0.0-1.0 (default: 0.5)"
    echo ""
    echo "Example:"
    echo "  ./user-rolodex.sh create --name 'John Doe' --preferred 'John' --type primary"
}

# =============================================================================
# Command: Update User
# =============================================================================

cmd_update() {
    local slug="$1"
    shift
    
    if [[ -z "$slug" ]]; then
        print_error "User slug is required."
        echo "Usage: user-rolodex.sh update <slug> --field value"
        exit 1
    fi
    
    if ! user_exists "$slug"; then
        print_error "User '$slug' not found."
        exit 1
    fi
    
    local profile="$USERS_DIR/$slug/profile.json"
    
    # Parse and apply updates
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --name)
                if has_jq; then
                    local tmp=$(mktemp)
                    jq ".name.full = \"$2\"" "$profile" > "$tmp" && mv "$tmp" "$profile"
                    update_user_in_index "$slug" "name" "\"$2\""
                fi
                shift 2
                ;;
            --preferred)
                if has_jq; then
                    local tmp=$(mktemp)
                    jq ".name.preferred = \"$2\"" "$profile" > "$tmp" && mv "$tmp" "$profile"
                    update_user_in_index "$slug" "name" "\"$2\""
                fi
                shift 2
                ;;
            --pronouns)
                if has_jq; then
                    local tmp=$(mktemp)
                    jq ".pronouns = \"$2\"" "$profile" > "$tmp" && mv "$tmp" "$profile"
                fi
                shift 2
                ;;
            --timezone)
                if has_jq; then
                    local tmp=$(mktemp)
                    jq ".timezone = \"$2\"" "$profile" > "$tmp" && mv "$tmp" "$profile"
                fi
                shift 2
                ;;
            --type)
                if has_jq; then
                    local tmp=$(mktemp)
                    jq ".relationship.type = \"$2\"" "$profile" > "$tmp" && mv "$tmp" "$profile"
                    update_user_in_index "$slug" "type" "\"$2\""
                fi
                shift 2
                ;;
            --trust)
                if has_jq; then
                    local tmp=$(mktemp)
                    jq ".relationship.trust_level = $2" "$profile" > "$tmp" && mv "$tmp" "$profile"
                    update_user_in_index "$slug" "trust_level" "$2"
                fi
                shift 2
                ;;
            --language)
                if has_jq; then
                    local tmp=$(mktemp)
                    jq ".languages += [\"$2\"] | .languages |= unique" "$profile" > "$tmp" && mv "$tmp" "$profile"
                fi
                shift 2
                ;;
            *)
                print_error "Unknown option: $1"
                exit 1
                ;;
        esac
    done
    
    # Update last_interaction timestamp
    if has_jq; then
        local tmp=$(mktemp)
        jq ".last_interaction = \"$(get_timestamp)\"" "$profile" > "$tmp" && mv "$tmp" "$profile"
    fi
    
    print_success "Updated user: $slug"
}

# =============================================================================
# Command: Lookup User
# =============================================================================

cmd_lookup() {
    local slug="$1"
    local format="${2:-text}"
    
    if [[ -z "$slug" ]]; then
        print_error "User slug is required."
        echo "Usage: user-rolodex.sh lookup <slug> [json|text]"
        exit 1
    fi
    
    if ! user_exists "$slug"; then
        print_error "User '$slug' not found."
        exit 1
    fi
    
    local profile="$USERS_DIR/$slug/profile.json"
    
    if [[ "$format" == "json" ]]; then
        cat "$profile"
    else
        print_header "User: $slug"
        
        if has_jq; then
            echo ""
            echo -e "${CYAN}Basic Information${NC}"
            echo "  ID:            $(jq -r '.id' "$profile")"
            echo "  Full Name:     $(jq -r '.name.full' "$profile")"
            echo "  Preferred:     $(jq -r '.name.preferred // "N/A"' "$profile")"
            echo "  Pronouns:      $(jq -r '.pronouns // "N/A"' "$profile")"
            echo "  Timezone:      $(jq -r '.timezone' "$profile")"
            echo "  Languages:     $(jq -r '.languages | join(", ")' "$profile")"
            
            echo ""
            echo -e "${CYAN}Relationship${NC}"
            echo "  Type:          $(jq -r '.relationship.type' "$profile")"
            echo "  Since:         $(jq -r '.relationship.since' "$profile")"
            echo "  Trust Level:   $(jq -r '.relationship.trust_level' "$profile")"
            
            echo ""
            echo -e "${CYAN}Preferences${NC}"
            echo "  Communication: $(jq -r '.preferences.communication_style' "$profile")"
            echo "  Response:      $(jq -r '.preferences.response_length' "$profile")"
            echo "  Code Style:    $(jq -r '.preferences.code_style.comments // "standard"' "$profile") comments"
            
            echo ""
            echo -e "${CYAN}Activity${NC}"
            echo "  Created:       $(jq -r '.created' "$profile")"
            echo "  Last Active:   $(jq -r '.last_interaction' "$profile")"
            
            # Show projects
            local project_count=$(jq '.projects | length' "$profile")
            if [[ "$project_count" -gt 0 ]]; then
                echo ""
                echo -e "${CYAN}Projects ($project_count)${NC}"
                jq -r '.projects[] | "  - \(.name) (\(.role), \(.status))"' "$profile"
            fi
            
            # Show recent notes
            local note_count=$(jq '.context_notes | length' "$profile")
            if [[ "$note_count" -gt 0 ]]; then
                echo ""
                echo -e "${CYAN}Recent Notes ($note_count)${NC}"
                jq -r '.context_notes[-3:][] | "  [\(.date)] \(.note)"' "$profile"
            fi
        else
            cat "$profile"
        fi
    fi
}

# =============================================================================
# Command: Search Users
# =============================================================================

cmd_search() {
    local query=""
    local field=""
    
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --project)
                query="$2"
                field="project"
                shift 2
                ;;
            --type)
                query="$2"
                field="type"
                shift 2
                ;;
            --name)
                query="$2"
                field="name"
                shift 2
                ;;
            --trust)
                query="$2"
                field="trust"
                shift 2
                ;;
            *)
                query="$1"
                shift
                ;;
        esac
    done
    
    if [[ -z "$query" ]]; then
        print_error "Search query is required."
        echo "Usage: user-rolodex.sh search <query|options>"
        exit 1
    fi
    
    init_index
    
    print_header "Search Results"
    
    if has_jq; then
        case "$field" in
            project)
                jq -r ".users[] | select(.projects[]? | contains(\"$query\")) | \"  \(.slug) - \(.name)\"" "$USER_INDEX" 2>/dev/null || echo "  No results found"
                ;;
            type)
                jq -r ".users[] | select(.type == \"$query\") | \"  \(.slug) - \(.name) (\(.type))\"" "$USER_INDEX" 2>/dev/null || echo "  No results found"
                ;;
            name)
                jq -r ".users[] | select(.name | test(\"$query\"; \"i\")) | \"  \(.slug) - \(.name)\"" "$USER_INDEX" 2>/dev/null || echo "  No results found"
                ;;
            trust)
                jq -r ".users[] | select(.trust_level >= ($query | tonumber)) | \"  \(.slug) - \(.name) (trust: \(.trust_level))\"" "$USER_INDEX" 2>/dev/null || echo "  No results found"
                ;;
            *)
                # General search across all fields
                jq -r ".users[] | select(tostring | test(\"$query\"; \"i\")) | \"  \(.slug) - \(.name) (\(.type))\"" "$USER_INDEX" 2>/dev/null || echo "  No results found"
                ;;
        esac
    else
        # Fallback: grep through index
        grep -i "$query" "$USER_INDEX" || echo "  No results found"
    fi
}

# =============================================================================
# Command: Add Note
# =============================================================================

cmd_note() {
    local slug="$1"
    local note="$2"
    local category="${3:-general}"
    local importance="${4:-0.5}"
    
    if [[ -z "$slug" ]]; then
        print_error "User slug is required."
        echo "Usage: user-rolodex.sh note <slug> 'note text' [category] [importance]"
        exit 1
    fi
    
    if [[ -z "$note" ]]; then
        print_error "Note text is required."
        exit 1
    fi
    
    if ! user_exists "$slug"; then
        print_error "User '$slug' not found."
        exit 1
    fi
    
    local profile="$USERS_DIR/$slug/profile.json"
    local timestamp=$(get_timestamp)
    
    if has_jq; then
        local tmp=$(mktemp)
        local new_note=$(cat <<EOF
{
  "date": "$timestamp",
  "note": "$note",
  "importance": $importance,
  "category": "$category"
}
EOF
)
        jq ".context_notes += [$new_note]" "$profile" > "$tmp" && mv "$tmp" "$profile"
        
        # Also create a markdown note file
        local note_file="$USERS_DIR/$slug/notes/$(get_date).md"
        if [[ ! -f "$note_file" ]]; then
            echo "# Notes for $slug - $(get_date)" > "$note_file"
            echo "" >> "$note_file"
        fi
        echo "- **[$timestamp]** ($category) $note" >> "$note_file"
        
        # Update last_interaction
        jq ".last_interaction = \"$timestamp\"" "$profile" > "$tmp" && mv "$tmp" "$profile"
    fi
    
    print_success "Added note to user: $slug"
    print_info "Category: $category, Importance: $importance"
}

# =============================================================================
# Command: Set Preference
# =============================================================================

cmd_prefer() {
    local slug="$1"
    local key="$2"
    local value="$3"
    
    if [[ -z "$slug" ]]; then
        print_error "User slug is required."
        echo "Usage: user-rolodex.sh prefer <slug> <key> <value>"
        exit 1
    fi
    
    if [[ -z "$key" ]]; then
        print_error "Preference key is required."
        exit 1
    fi
    
    if [[ -z "$value" ]]; then
        print_error "Preference value is required."
        exit 1
    fi
    
    if ! user_exists "$slug"; then
        print_error "User '$slug' not found."
        exit 1
    fi
    
    local profile="$USERS_DIR/$slug/profile.json"
    local prefs_file="$USERS_DIR/$slug/preferences.json"
    
    if has_jq; then
        local timestamp=$(get_timestamp)
        local tmp=$(mktemp)
        
        # Map common keys to proper paths
        local path=""
        case "$key" in
            communication|communication_style)
                path=".preferences.communication_style"
                ;;
            response|response_length)
                path=".preferences.response_length"
                ;;
            code_comments|comments)
                path=".preferences.code_style.comments"
                ;;
            code_naming|naming)
                path=".preferences.code_style.naming"
                ;;
            topics|interests)
                # Add to array
                jq ".preferences.topics_of_interest += [\"$value\"] | .preferences.topics_of_interest |= unique" "$profile" > "$tmp" && mv "$tmp" "$profile"
                jq ".last_interaction = \"$timestamp\"" "$profile" > "$tmp" && mv "$tmp" "$profile"
                print_success "Added topic of interest '$value' to user: $slug"
                return
                ;;
            *)
                # Try as direct path under preferences
                path=".preferences.$key"
                ;;
        esac
        
        # Update the preference
        if [[ -n "$path" ]]; then
            jq "$path = \"$value\"" "$profile" > "$tmp" && mv "$tmp" "$profile"
            jq ".last_interaction = \"$timestamp\"" "$profile" > "$tmp" && mv "$tmp" "$profile"
        fi
        
        # Also update standalone preferences file
        jq ".${key//-/_} = {\"value\": \"$value\", \"learned\": \"$timestamp\"}" "$prefs_file" > "$tmp" 2>/dev/null && mv "$tmp" "$prefs_file" || true
    fi
    
    print_success "Set preference '$key' = '$value' for user: $slug"
}

# =============================================================================
# Command: Merge Users
# =============================================================================

cmd_merge() {
    local source_slug="$1"
    local target_slug="$2"
    
    if [[ -z "$source_slug" ]] || [[ -z "$target_slug" ]]; then
        print_error "Both source and target user slugs are required."
        echo "Usage: user-rolodex.sh merge <source-slug> <target-slug>"
        exit 1
    fi
    
    if ! user_exists "$source_slug"; then
        print_error "Source user '$source_slug' not found."
        exit 1
    fi
    
    if ! user_exists "$target_slug"; then
        print_error "Target user '$target_slug' not found."
        exit 1
    fi
    
    if [[ "$source_slug" == "$target_slug" ]]; then
        print_error "Cannot merge a user with itself."
        exit 1
    fi
    
    local source_profile="$USERS_DIR/$source_slug/profile.json"
    local target_profile="$USERS_DIR/$target_slug/profile.json"
    
    if has_jq; then
        local tmp=$(mktemp)
        
        # Merge context_notes
        local source_notes=$(jq '.context_notes' "$source_profile")
        jq ".context_notes += $source_notes" "$target_profile" > "$tmp" && mv "$tmp" "$target_profile"
        
        # Merge projects (unique by name)
        local source_projects=$(jq '.projects' "$source_profile")
        jq ".projects = (.projects + $source_projects | unique_by(.name))" "$target_profile" > "$tmp" && mv "$tmp" "$target_profile"
        
        # Merge topics_of_interest
        local source_topics=$(jq '.preferences.topics_of_interest' "$source_profile")
        jq ".preferences.topics_of_interest = (.preferences.topics_of_interest + $source_topics | unique)" "$target_profile" > "$tmp" && mv "$tmp" "$target_profile"
        
        # Copy note files
        if [[ -d "$USERS_DIR/$source_slug/notes" ]]; then
            for note_file in "$USERS_DIR/$source_slug/notes"/*.md; do
                if [[ -f "$note_file" ]]; then
                    local filename=$(basename "$note_file")
                    cp "$note_file" "$USERS_DIR/$target_slug/notes/${source_slug}-$filename"
                fi
            done
        fi
        
        # Remove source user from index
        remove_user_from_index "$source_slug"
        
        # Archive source directory
        mv "$USERS_DIR/$source_slug" "$USERS_DIR/.archived-${source_slug}-$(get_date)"
        
        print_success "Merged '$source_slug' into '$target_slug'"
        print_info "Source user archived: .archived-${source_slug}-$(get_date)"
    fi
}

# =============================================================================
# Command: List Users
# =============================================================================

cmd_list() {
    init_index
    
    print_header "User Rolodex"
    
    if has_jq; then
        local total=$(jq -r '.stats.total_users' "$USER_INDEX")
        local primary=$(jq -r '.stats.primary_users' "$USER_INDEX")
        local collaborators=$(jq -r '.stats.collaborators' "$USER_INDEX")
        local occasional=$(jq -r '.stats.occasional_users' "$USER_INDEX")
        
        echo ""
        echo "  Total Users:      $total"
        echo "  Primary:          $primary"
        echo "  Collaborators:    $collaborators"
        echo "  Occasional:       $occasional"
        echo ""
        
        if [[ "$total" -gt 0 ]]; then
            echo -e "${CYAN}Users:${NC}"
            jq -r '.users[] | "  \(.slug) - \(.name) [\(.type)] (trust: \(.trust_level))"' "$USER_INDEX"
        fi
    else
        cat "$USER_INDEX"
    fi
}

# =============================================================================
# Command: Help
# =============================================================================

show_help() {
    echo ""
    echo "User Rolodex — Multi-User Management System"
    echo ""
    echo "Usage: ./user-rolodex.sh <command> [options]"
    echo ""
    echo "Commands:"
    echo "  create    Add new user to rolodex"
    echo "  update    Update user information"
    echo "  lookup    Retrieve user by slug"
    echo "  search    Find users by attribute"
    echo "  note      Add interaction note"
    echo "  prefer    Learn/update preference"
    echo "  merge     Merge duplicate profiles"
    echo "  list      List all users"
    echo "  help      Show this help message"
    echo ""
    echo "Command Details:"
    echo ""
    echo "  create --name 'Full Name' [options]"
    echo "    Options: --preferred, --pronouns, --timezone, --type, --trust"
    echo ""
    echo "  update <slug> [options]"
    echo "    Options: --name, --preferred, --pronouns, --timezone, --type, --trust, --language"
    echo ""
    echo "  lookup <slug> [json|text]"
    echo "    Retrieve user profile"
    echo ""
    echo "  search <query|options>"
    echo "    Options: --project, --type, --name, --trust"
    echo ""
    echo "  note <slug> 'note text' [category] [importance]"
    echo "    Categories: general, technical, personal, preference, feedback"
    echo ""
    echo "  prefer <slug> <key> <value>"
    echo "    Keys: communication, response, code_comments, code_naming, topics"
    echo ""
    echo "  merge <source-slug> <target-slug>"
    echo "    Merge source into target, archive source"
    echo ""
    echo "  list"
    echo "    Show all users and statistics"
    echo ""
    echo "Examples:"
    echo "  ./user-rolodex.sh create --name 'John Doe' --preferred 'John' --type primary"
    echo "  ./user-rolodex.sh lookup john-doe"
    echo "  ./user-rolodex.sh note john-doe 'Discussed new architecture' technical 0.8"
    echo "  ./user-rolodex.sh prefer john-doe communication casual"
    echo "  ./user-rolodex.sh search --project heretek-openclaw"
    echo ""
}

# =============================================================================
# Main Entry Point
# =============================================================================

# Ensure users directory exists
mkdir -p "$USERS_DIR"
mkdir -p "$TEMPLATES_DIR"

# Parse command
command="${1:-help}"
shift || true

case "$command" in
    create)
        cmd_create "$@"
        ;;
    update)
        cmd_update "$@"
        ;;
    lookup)
        cmd_lookup "$@"
        ;;
    search)
        cmd_search "$@"
        ;;
    note)
        cmd_note "$@"
        ;;
    prefer|preference)
        cmd_prefer "$@"
        ;;
    merge)
        cmd_merge "$@"
        ;;
    list)
        cmd_list
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        print_error "Unknown command: $command"
        show_help
        exit 1
        ;;
esac
