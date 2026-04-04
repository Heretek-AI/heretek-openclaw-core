#!/bin/bash
# ==============================================================================
# Heretek OpenClaw — Audit Cleanup Cron Installer
# ==============================================================================
# Installs automated audit log cleanup schedule into system crontab
#
# Usage:
#   ./install-audit-cron.sh install    # Install cron schedule
#   ./install-audit-cron.sh remove     # Remove cron schedule
#   ./install-audit-cron.sh list       # Show current schedule
#   ./install-audit-cron.sh test       # Test cleanup script
# ==============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AUDIT_CLEANUP_SCRIPT="$SCRIPT_DIR/audit-cleanup.sh"
LOG_DIR="${LOG_DIR:-/var/log/openclaw}"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $*"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }
log_error() { echo -e "${RED}[ERROR]${NC} $*"; }

ensure_log_dir() {
    mkdir -p "$LOG_DIR" 2>/dev/null || true
    chmod 755 "$LOG_DIR" 2>/dev/null || true
}

install_cron() {
    echo ""
    echo "=============================================="
    echo "  Heretek OpenClaw — Audit Cleanup Cron Installer"
    echo "=============================================="
    echo ""
    
    # Ensure log directory exists
    ensure_log_dir
    log_info "Log directory: $LOG_DIR"
    
    # Get current crontab
    current_crontab=$(crontab -l 2>/dev/null || echo "")
    
    # Check if already installed
    if echo "$current_crontab" | grep -q "audit-cleanup"; then
        log_warn "Audit cleanup cron schedule already installed"
        echo ""
        echo "Current schedule:"
        echo "$current_crontab" | grep "audit-cleanup"
        echo ""
        read -p "Do you want to reinstall? (y/N) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 0
        fi
        
        # Remove existing entries
        echo "$current_crontab" | grep -v "audit-cleanup" | crontab -
        log_info "Removed existing schedule"
    fi
    
    # Create new cron entry (every 2 hours)
    new_crontab="$current_crontab
# ==============================================================================
# Heretek OpenClaw — Audit Log Cleanup
# ==============================================================================
# Clean up old audit log entries based on retention policies
# Runs every 2 hours at minute 0
0 */2 * * * $AUDIT_CLEANUP_SCRIPT >> $LOG_DIR/audit-cleanup.log 2>&1
# ==============================================================================
"
    
    # Install new crontab
    echo "$new_crontab" | crontab -
    
    log_info "Audit cleanup cron schedule installed successfully!"
    echo ""
    echo "Installed schedule:"
    echo "  - Audit log cleanup: Every 2 hours (at :00)"
    echo ""
    echo "View logs:"
    echo "  tail -f $LOG_DIR/audit-cleanup.log"
    echo ""
    echo "Run manual cleanup:"
    echo "  $AUDIT_CLEANUP_SCRIPT --dry-run"
    echo ""
    
    # Verify installation
    echo "Verifying installation..."
    crontab -l | grep "audit-cleanup" || echo "  Warning: Could not verify installation"
    echo ""
    log_info "Installation complete!"
}

remove_cron() {
    echo ""
    echo "=============================================="
    echo "  Heretek OpenClaw — Audit Cleanup Cron Remover"
    echo "=============================================="
    echo ""
    
    # Get current crontab
    current_crontab=$(crontab -l 2>/dev/null || echo "")
    
    # Check if installed
    if ! echo "$current_crontab" | grep -q "audit-cleanup"; then
        log_warn "No audit cleanup cron schedule found"
        exit 0
    fi
    
    # Remove audit cleanup entries
    echo "$current_crontab" | grep -v "audit-cleanup" | crontab -
    
    log_info "Audit cleanup cron schedule removed successfully!"
    echo ""
    echo "Remaining schedules:"
    crontab -l 2>/dev/null | head -10 || echo "  No other schedules found"
    echo ""
}

list_cron() {
    echo ""
    echo "=============================================="
    echo "  Heretek OpenClaw — Current Cron Schedules"
    echo "=============================================="
    echo ""
    
    current_crontab=$(crontab -l 2>/dev/null || echo "No crontab installed")
    
    echo "Current crontab:"
    echo "$current_crontab"
    echo ""
    
    echo "Audit cleanup schedules:"
    echo "$current_crontab" | grep "audit-cleanup" || echo "  None found"
    echo ""
}

test_script() {
    echo ""
    echo "=============================================="
    echo "  Heretek OpenClaw — Audit Cleanup Script Test"
    echo "=============================================="
    echo ""
    
    ensure_log_dir
    
    # Test audit cleanup script
    log_info "Testing audit cleanup script..."
    if [ -x "$AUDIT_CLEANUP_SCRIPT" ]; then
        echo "  Audit cleanup script: Executable ✓"
        
        # Run dry-run test
        echo ""
        log_info "Running dry-run test..."
        if "$AUDIT_CLEANUP_SCRIPT" --dry-run; then
            echo "  Dry-run test: Passed ✓"
        else
            log_error "Dry-run test: Failed ✗"
        fi
    else
        log_error "Audit cleanup script not found or not executable: $AUDIT_CLEANUP_SCRIPT"
    fi
    
    echo ""
    log_info "Test complete!"
}

# Main
case "${1:-}" in
    install)
        install_cron
        ;;
    remove)
        remove_cron
        ;;
    list)
        list_cron
        ;;
    test)
        test_script
        ;;
    *)
        echo "Usage: $0 {install|remove|list|test}"
        echo ""
        echo "Commands:"
        echo "  install  - Install automated audit cleanup schedule (every 2 hours)"
        echo "  remove   - Remove audit cleanup cron schedule"
        echo "  list     - Show current cron schedules"
        echo "  test     - Test audit cleanup script with dry-run"
        ;;
esac
