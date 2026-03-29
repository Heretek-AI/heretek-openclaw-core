#!/bin/bash
# Validate vote against 2/3 threshold
# Usage: ./validate-vote.sh <proposal-id> <alpha-vote> <beta-vote> <charlie-vote>

PROPOSAL="$1"
ALPHA_VOTE="$2"
BETA_VOTE="$3"
CHARLIE_VOTE="$4"

if [[ -z "$PROPOSAL" ]] || [[ -z "$ALPHA_VOTE" ]] || [[ -z "$BETA_VOTE" ]] || [[ -z "$CHARLIE_VOTE" ]]; then
    echo "Usage: $0 <proposal-id> <alpha-vote> <beta-vote> <charlie-vote>"
    echo "Votes: YES, NO, SUPPORT, ABSTAIN"
    exit 1
fi

# Count YES votes
YES_COUNT=0
for vote in "$ALPHA_VOTE" "$BETA_VOTE" "$CHARLIE_VOTE"; do
    if [[ "$vote" == "YES" ]]; then
        ((YES_COUNT++))
    fi
done

# Check 2/3 threshold (minimum 2 of 3)
if [[ $YES_COUNT -ge 2 ]]; then
    echo "VALIDATED: $PROPOSAL ratified with $YES_COUNT/3 YES votes"
    exit 0
else
    echo "REJECTED: $PROPOSAL failed with $YES_COUNT/3 YES votes"
    exit 1
fi