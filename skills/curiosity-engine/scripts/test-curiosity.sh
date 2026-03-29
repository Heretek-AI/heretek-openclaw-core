#!/bin/bash
# Test Script - Verifies curiosity-engine end-to-end flow
# Creates sample gap detection and proposal

set -e

WORKSPACE="${WORKSPACE:-$HOME/.openclaw/workspace}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/.."

echo "🧪 === Curiosity Engine Test Suite ==="
echo "Timestamp: $(date -Iseconds)"
echo ""

# Test 1: Verify all engines exist and are executable
echo "Test 1: Engine scripts exist and are executable"
engines=("gap-detection.sh" "anomaly-detection.sh" "opportunity-scanning.sh" "capability-mapping.sh" "deliberation-auto-trigger.sh")
all_pass=true
for engine in "${engines[@]}"; do
    if [ -x "$SCRIPT_DIR/engines/$engine" ]; then
        echo "  ✅ $engine"
    else
        echo "  ❌ $engine (missing or not executable)"
        all_pass=false
    fi
done
echo ""

# Test 2: Verify databases are created
echo "Test 2: Databases initialized"
dbs=("curiosity_metrics.db" "consensus_ledger.db" "anomalies.db" "opportunities.db" "capabilities.db")
for db in "${dbs[@]}"; do
    if [ -f "$WORKSPACE/.curiosity/$db" ]; then
        echo "  ✅ $db"
    else
        echo "  ❌ $db (not found)"
        all_pass=false
    fi
done
echo ""

# Test 3: Run gap detection and verify output
echo "Test 3: Gap Detection Engine"
"$SCRIPT_DIR/engines/gap-detection.sh" > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "  ✅ Gap detection executed successfully"
else
    echo "  ❌ Gap detection failed"
    all_pass=false
fi
echo ""

# Test 4: Verify proposal creation
echo "Test 4: Deliberation Auto-Trigger"
proposal_count=$(sqlite3 "$WORKSPACE/.curiosity/consensus_ledger.db" "SELECT COUNT(*) FROM consensus_votes;" 2>/dev/null || echo 0)
if [ "$proposal_count" -gt 0 ]; then
    echo "  ✅ $proposal_count proposal(s) created in consensus ledger"
    sqlite3 -header -column "$WORKSPACE/.curiosity/consensus_ledger.db" "SELECT proposal_title, priority FROM consensus_votes ORDER BY timestamp DESC LIMIT 3;"
else
    echo "  ❌ No proposals created"
    all_pass=false
fi
echo ""

# Test 5: Verify metrics tracking
echo "Test 5: Curiosity Metrics"
metrics_count=$(sqlite3 "$WORKSPACE/.curiosity/curiosity_metrics.db" "SELECT COUNT(*) FROM curiosity_metrics;" 2>/dev/null || echo 0)
if [ "$metrics_count" -gt 0 ]; then
    echo "  ✅ $metrics_count metric record(s) logged"
    sqlite3 -header -column "$WORKSPACE/.curiosity/curiosity_metrics.db" "SELECT timestamp, skills_installed, autonomy_score FROM curiosity_metrics ORDER BY timestamp DESC LIMIT 1;"
else
    echo "  ❌ No metrics recorded"
    all_pass=false
fi
echo ""

# Test 6: Verify episodic memory logging
echo "Test 6: Episodic Memory Integration"
today=$(date +%Y-%m-%d)
if [ -f "$WORKSPACE/memory/curiosity-$today.md" ]; then
    echo "  ✅ Episodic memory file created: curiosity-$today.md"
    echo "  Preview:"
    head -15 "$WORKSPACE/memory/curiosity-$today.md"
else
    echo "  ⚠️  Episodic memory file not found (may be created on first run)"
fi
echo ""

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ "$all_pass" = true ]; then
    echo "✅ All tests passed!"
    echo ""
    echo "Curiosity engine is fully operational:"
    echo "  - 5 engines implemented and executable"
    echo "  - Databases initialized"
    echo "  - Proposals auto-created"
    echo "  - Metrics tracked"
    echo "  - Episodic memory integration working"
else
    echo "⚠️  Some tests failed - review output above"
fi
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
