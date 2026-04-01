#!/bin/bash
# ==============================================================================
# Heretek OpenClaw Core - Patch Status Script
# ==============================================================================
# Shows the status of all patches listed in .patchestoo file.
# Indicates which patches are applied, pending, or failed.
#
# Usage:
#   ./scripts/patch-status.sh [--verbose]
#
# Options:
#   --verbose   - Show detailed information about each patch
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
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Parse arguments
VERBOSE=false

for arg in "$@"; do
    case $arg in
        --verbose|-v)
            VERBOSE=true
            shift
            ;;
    esac
done

echo -e "${BLUE}=============================================================================="
echo -e "Heretek OpenClaw Core - Patch Status"
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

# Check if git is available
GIT_AVAILABLE=false
if git rev-parse --git-dir > /dev/null 2>&1; then
    GIT_AVAILABLE=true
fi

# Read patches from patchlist file
PATCHES=()
while IFS= read -r line || [ -n "$line" ]; do
    # Skip empty lines and comments
    [[ -z "$line" || "$line" =~ ^# ]] && continue
    PATCHES+=("$line")
done < "$PATCHLIST_FILE"

if [ ${#PATCHES[@]} -eq 0 ]; then
    echo -e "${YELLOW}No patches registered (patchlist is empty)${NC}"
    exit 0
fi

echo -e "${CYAN}Total patches: ${#PATCHES[@]}${NC}"
echo ""

# Status counters
APPLIED=0
PENDING=0
FAILED=0
NEW_FILE=0

# Check each patch
for patch in "${PATCHES[@]}"; do
    PATCH_FILE="$ROOT_DIR/$patch"
    
    # Handle patch file path
    if [ ! -f "$PATCH_FILE" ]; then
        PATCH_FILE="$PATCHES_DIR/$(basename "$patch")"
    fi
    
    PATCH_NAME=$(basename "$patch" .patch)
    
    echo -e "${BLUE}Patch: $PATCH_NAME${NC}"
    
    # Check if patch file exists
    if [ ! -f "$PATCH_FILE" ]; then
        echo -e "  Status: ${RED}MISSING${NC} - Patch file not found"
        ((FAILED++))
        continue
    fi
    
    # Check patch type
    if grep -q "^new file mode" "$PATCH_FILE" 2>/dev/null || grep -q "^diff --git.*new file" "$PATCH_FILE" 2>/dev/null; then
        # This is a new file patch - check if files exist
        echo -e "  Type:   ${CYAN}New Files${NC}"
        
        # Extract expected file paths
        FILES_CREATED=$(grep -E "^\+\+\+ b/" "$PATCH_FILE" 2>/dev/null | sed 's/+++ b\///' || true)
        
        if [ -n "$FILES_CREATED" ]; then
            ALL_EXIST=true
            while IFS= read -r file; do
                if [ ! -f "$ROOT_DIR/$file" ]; then
                    ALL_EXIST=false
                    break
                fi
            done <<< "$FILES_CREATED"
            
            if [ "$ALL_EXIST" = true ]; then
                echo -e "  Status: ${GREEN}APPLIED${NC} - All files exist"
                ((APPLIED++))
                ((NEW_FILE++))
            else
                echo -e "  Status: ${YELLOW}PENDING${NC} - Files not yet created"
                ((PENDING++))
            fi
        else
            echo -e "  Status: ${GREEN}APPLIED${NC}"
            ((APPLIED++))
            ((NEW_FILE++))
        fi
    else
        # Standard patch - check if already applied
        if [ "$GIT_AVAILABLE" = true ]; then
            # Use git to check if patch would apply cleanly
            if git apply --check "$PATCH_FILE" 2>/dev/null; then
                echo -e "  Status: ${YELLOW}PENDING${NC} - Not yet applied (applies cleanly)"
                ((PENDING++))
            else
                # Patch might already be applied or have conflicts
                # Check if the changes are already in the working tree
                if git diff --quiet HEAD; then
                    echo -e "  Status: ${GREEN}APPLIED${NC} - Working tree clean"
                    ((APPLIED++))
                else
                    echo -e "  Status: ${YELLOW}MIXED${NC} - Some changes may be applied"
                    ((PENDING++))
                fi
            fi
        else
            # Can't check without git - assume pending
            echo -e "  Status: ${YELLOW}UNKNOWN${NC} - Git not available for verification"
            ((PENDING++))
        fi
    fi
    
    # Verbose output
    if [ "$VERBOSE" = true ]; then
        echo -e "  File:   $PATCH_FILE"
        echo -e "  Size:   $(wc -c < "$PATCH_FILE") bytes"
        echo -e "  Lines:  $(wc -l < "$PATCH_FILE")"
        
        # Show patch description if available
        DESCRIPTION=$(grep -m1 "^# " "$PATCH_FILE" 2>/dev/null | sed 's/^# //' || echo "No description")
        echo -e "  Desc:   $DESCRIPTION"
    fi
    
    echo ""
done

# Summary
echo -e "${BLUE}=============================================================================="
echo -e "Summary"
echo -e "==============================================================================${NC}"
echo -e "${GREEN}Applied:  $APPLIED${NC}"
echo -e "${YELLOW}Pending:  $PENDING${NC}"
echo -e "${RED}Failed:   $FAILED${NC}"

if [ $NEW_FILE -gt 0 ]; then
    echo -e "${CYAN}New Files: $NEW_FILE${NC}"
fi

echo ""

# Overall status
if [ $FAILED -gt 0 ]; then
    echo -e "${RED}⚠ Some patches are missing or failed${NC}"
    exit 1
elif [ $PENDING -gt 0 ]; then
    echo -e "${YELLOW}⚠ Some patches are pending application${NC}"
    echo "Run: ./scripts/patch-apply.sh"
    exit 0
else
    echo -e "${GREEN}✓ All patches are applied${NC}"
    exit 0
fi
