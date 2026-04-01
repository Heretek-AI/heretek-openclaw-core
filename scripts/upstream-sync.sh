#!/bin/bash
# ==============================================================================
# Heretek OpenClaw Core - Upstream Sync Script
# ==============================================================================
# Syncs the Heretek fork with the upstream OpenClaw repository.
# This script fetches upstream changes, rebases the current branch,
# and re-applies Heretek patches.
#
# Usage:
#   ./scripts/upstream-sync.sh [upstream-remote] [upstream-branch]
#
# Examples:
#   ./scripts/upstream-sync.sh upstream main
#   ./scripts/upstream-sync.sh openclaw main
# ==============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Default values
UPSTREAM_REMOTE="${1:-upstream}"
UPSTREAM_BRANCH="${2:-main}"

echo -e "${BLUE}=============================================================================="
echo -e "Heretek OpenClaw Core - Upstream Sync"
echo -e "==============================================================================${NC}"
echo ""
echo -e "Upstream remote: ${YELLOW}$UPSTREAM_REMOTE${NC}"
echo -e "Upstream branch: ${YELLOW}$UPSTREAM_BRANCH${NC}"
echo ""

# Check if we're in a git repository
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    echo -e "${RED}Error: Not in a git repository${NC}"
    exit 1
fi

# Check for uncommitted changes
if ! git diff --quiet HEAD || ! git diff --cached --quiet; then
    echo -e "${RED}Error: You have uncommitted changes${NC}"
    echo "Please commit or stash your changes before syncing:"
    echo "  git stash push -m 'Before upstream sync'"
    exit 1
fi

# Get current branch
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
echo -e "Current branch: ${CYAN}$CURRENT_BRANCH${NC}"
echo ""

# Step 1: Check if upstream remote exists
echo -e "${BLUE}Step 1: Checking upstream remote...${NC}"
if ! git remote | grep -q "^${UPSTREAM_REMOTE}$"; then
    echo -e "${YELLOW}Upstream remote '$UPSTREAM_REMOTE' not found${NC}"
    echo ""
    echo "Please add the upstream remote:"
    echo "  git remote add $UPSTREAM_REMOTE https://github.com/openclaw/openclaw.git"
    echo ""
    echo "Or specify a different remote name:"
    echo "  ./scripts/upstream-sync.sh <remote-name> <branch>"
    exit 1
fi
echo -e "${GREEN}✓ Upstream remote found${NC}"
echo ""

# Step 2: Fetch upstream changes
echo -e "${BLUE}Step 2: Fetching upstream changes...${NC}"
git fetch "$UPSTREAM_REMOTE" "$UPSTREAM_BRANCH"
echo -e "${GREEN}✓ Upstream changes fetched${NC}"
echo ""

# Step 3: Check for upstream changes
UPSTREAM_COMMIT="$UPSTREAM_REMOTE/$UPSTREAM_BRANCH"
LOCAL_COMMIT="$CURRENT_BRANCH"

if [ "$UPSTREAM_COMMIT" = "$LOCAL_COMMIT" ]; then
    echo -e "${GREEN}Already up to date with upstream${NC}"
    exit 0
fi

# Show what will be synced
echo -e "${BLUE}Upstream sync summary:${NC}"
git log --oneline --graph "$CURRENT_BRANCH".."$UPSTREAM_COMMIT" | head -20
echo ""

# Step 4: Rebase onto upstream
echo -e "${BLUE}Step 3: Rebasing onto upstream...${NC}"
echo -e "${YELLOW}This may require manual conflict resolution${NC}"
echo ""

if git rebase "$UPSTREAM_COMMIT"; then
    echo -e "${GREEN}✓ Rebase completed successfully${NC}"
else
    echo -e "${RED}✗ Rebase failed - conflicts detected${NC}"
    echo ""
    echo -e "${YELLOW}To resolve conflicts:${NC}"
    echo "  1. Edit the conflicted files"
    echo "  2. git add <resolved-files>"
    echo "  3. git rebase --continue"
    echo "  4. Run this script again after resolving"
    echo ""
    echo "To abort the rebase:"
    echo "  git rebase --abort"
    exit 1
fi
echo ""

# Step 5: Re-apply patches
echo -e "${BLUE}Step 4: Re-applying Heretek patches...${NC}"

PATCH_APPLY_SCRIPT="$SCRIPT_DIR/patch-apply.sh"
if [ -x "$PATCH_APPLY_SCRIPT" ]; then
    if "$PATCH_APPLY_SCRIPT" --force; then
        echo -e "${GREEN}✓ Patches re-applied successfully${NC}"
    else
        echo -e "${YELLOW}⚠ Some patches may have failed to apply${NC}"
        echo "Review the patch application output above"
        echo "You may need to manually regenerate affected patches"
    fi
else
    echo -e "${RED}Error: patch-apply.sh not found or not executable${NC}"
    echo "Please ensure scripts/patch-apply.sh exists and is executable"
    exit 1
fi
echo ""

# Step 6: Run tests
echo -e "${BLUE}Step 5: Running verification tests...${NC}"
echo -e "${YELLOW}Note: Skipping automated tests - run manually to verify${NC}"
echo ""
echo "Recommended test commands:"
echo "  npm run test:unit"
echo "  npm run test:integration"
echo "  npm run test:skills"
echo ""

# Summary
echo -e "${BLUE}=============================================================================="
echo -e "Upstream Sync Complete"
echo -e "==============================================================================${NC}"
echo ""
echo -e "Branch: ${CYAN}$CURRENT_BRANCH${NC}"
echo -e "Synced with: ${GREEN}$UPSTREAM_REMOTE/$UPSTREAM_BRANCH${NC}"
echo ""

# Show new commits from upstream
echo -e "${BLUE}New commits from upstream:${NC}"
git log --oneline "$UPSTREAM_COMMIT"..HEAD | head -10 || echo "  (none)"
echo ""

echo -e "${GREEN}✓ Upstream sync completed successfully!${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "  1. Review changes: git log --oneline -10"
echo "  2. Run tests: npm test"
echo "  3. Commit changes if needed"
echo "  4. Push to Heretek remote: git push origin $CURRENT_BRANCH"
echo ""

exit 0
