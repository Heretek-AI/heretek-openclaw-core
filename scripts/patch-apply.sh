#!/bin/bash
# ==============================================================================
# Heretek OpenClaw Core - Patch Apply Script
# ==============================================================================
# Applies all patches listed in .patchestoo file in order.
# 
# Usage:
#   ./scripts/patch-apply.sh [--force] [--dry-run]
#
# Options:
#   --force     - Apply patches even if some fail
#   --dry-run   - Show what would be applied without making changes
# ==============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
PATCHES_DIR="$ROOT_DIR/patches"
PATCHLIST_FILE="$ROOT_DIR/.patchestoo"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Parse arguments
FORCE=false
DRY_RUN=false

for arg in "$@"; do
    case $arg in
        --force)
            FORCE=true
            shift
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
    esac
done

echo -e "${BLUE}=============================================================================="
echo -e "Heretek OpenClaw Core - Patch Apply"
echo -e "==============================================================================${NC}"
echo ""

# Check if patchlist file exists
if [ ! -f "$PATCHLIST_FILE" ]; then
    echo -e "${RED}Error: .patchestoo file not found at $PATCHLIST_FILE${NC}"
    echo "Please create a .patchestoo file listing patches to apply (one per line)."
    exit 1
fi

# Check if patches directory exists
if [ ! -d "$PATCHES_DIR" ]; then
    echo -e "${RED}Error: Patches directory not found at $PATCHES_DIR${NC}"
    exit 1
fi

# Read patches from patchlist file
PATCHES=()
while IFS= read -r line || [ -n "$line" ]; do
    # Skip empty lines and comments
    [[ -z "$line" || "$line" =~ ^# ]] && continue
    PATCHES+=("$line")
done < "$PATCHLIST_FILE"

if [ ${#PATCHES[@]} -eq 0 ]; then
    echo -e "${YELLOW}No patches to apply (patchlist is empty)${NC}"
    exit 0
fi

echo -e "${BLUE}Patches to apply: ${#PATCHES[@]}${NC}"
for patch in "${PATCHES[@]}"; do
    echo "  - $patch"
done
echo ""

# Apply each patch
APPLIED=0
FAILED=0

for patch in "${PATCHES[@]}"; do
    PATCH_FILE="$ROOT_DIR/$patch"
    
    # Handle patch file path
    if [ ! -f "$PATCH_FILE" ]; then
        PATCH_FILE="$PATCHES_DIR/$(basename "$patch")"
    fi
    
    if [ ! -f "$PATCH_FILE" ]; then
        echo -e "${RED}✗ Patch file not found: $patch${NC}"
        ((FAILED++))
        if [ "$FORCE" = false ]; then
            echo -e "${RED}Aborting due to missing patch file${NC}"
            exit 1
        fi
        continue
    fi
    
    if [ "$DRY_RUN" = true ]; then
        echo -e "${YELLOW}Would apply: $patch${NC}"
        continue
    fi
    
    echo -e "${BLUE}Applying: $patch${NC}"
    
    # Try to apply patch
    # First, check if it's a new file creation patch (has "new file" in diff)
    if grep -q "^new file mode" "$PATCH_FILE" 2>/dev/null || grep -q "^diff --git.*new file" "$PATCH_FILE" 2>/dev/null; then
        # This is a new file patch - extract and create files
        echo "  Creating new files..."
        
        # Extract file paths and content from the patch
        CURRENT_FILE=""
        IN_FILE=false
        
        while IFS= read -r line; do
            if [[ "$line" =~ ^diff\ --git ]]; then
                # Extract the file path from the diff line
                CURRENT_FILE=$(echo "$line" | sed -n 's/.*b\/\(.*\)/\1/p')
                IN_FILE=false
            elif [[ "$line" =~ ^\+\+\+.*b/ ]]; then
                # This confirms the file path
                CURRENT_FILE=$(echo "$line" | sed -n 's/.*b\/\(.*\)/\1/p')
                IN_FILE=true
            elif [[ "$line" =~ ^new\ file\ mode ]]; then
                # New file marker
                continue
            elif [[ "$line" =~ ^---\ /dev/null ]]; then
                # From /dev/null - new file
                continue
            elif [[ "$line" =~ ^\+ ]] && [ -n "$CURRENT_FILE" ] && [ "$IN_FILE" = true ]; then
                # Content line (starts with +)
                # Create directory if needed
                FILE_DIR=$(dirname "$ROOT_DIR/$CURRENT_FILE")
                mkdir -p "$FILE_DIR"
                
                # Append content (remove leading +)
                echo "${line:1}" >> "$ROOT_DIR/$CURRENT_FILE"
            fi
        done < "$PATCH_FILE"
        
        echo -e "${GREEN}✓ Created files from patch: $patch${NC}"
        ((APPLIED++))
    else
        # Standard patch - use patch command
        if patch -p1 -d "$ROOT_DIR" < "$PATCH_FILE" 2>/dev/null; then
            echo -e "${GREEN}✓ Applied: $patch${NC}"
            ((APPLIED++))
        else
            echo -e "${RED}✗ Failed to apply: $patch${NC}"
            ((FAILED++))
            
            if [ "$FORCE" = false ]; then
                echo -e "${RED}Aborting due to patch failure${NC}"
                echo "Use --force to continue applying remaining patches"
                exit 1
            fi
        fi
    fi
done

echo ""
echo -e "${BLUE}=============================================================================="
echo -e "Patch Apply Summary"
echo -e "==============================================================================${NC}"
echo -e "Applied: ${GREEN}$APPLIED${NC}"
echo -e "Failed:  ${RED}$FAILED${NC}"

if [ $FAILED -gt 0 ]; then
    echo ""
    echo -e "${YELLOW}Some patches failed to apply. Review the errors above.${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}All patches applied successfully!${NC}"
exit 0
