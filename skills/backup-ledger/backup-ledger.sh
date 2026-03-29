#!/bin/bash
# Backup Ledger — Consensus History Preservation
# Usage: ./backup-ledger.sh [--daily|--manual|--restore]

set -e

WORKSPACE_ROOT="${WORKSPACE_ROOT:-/home/openclaw/.openclaw/workspace}"
AURA_DIR="$WORKSPACE_ROOT/.aura"
BACKUP_DIR="$WORKSPACE_ROOT/.secure/ledger-backups"

# Ensure backup directory exists
mkdir -p "$BACKUP_DIR"

# Backup consensus database
function backup_consensus() {
  local db="$AURA_DIR/consensus.db"
  local backup="$BACKUP_DIR/consensus-$(date +%Y%m%d-%H%M%S).db"
  
  if [[ -f "$db" ]]; then
    cp "$db" "$backup"
    echo "✅ Consensus backed up: $backup"
    
    # Compress
    gzip "$backup" && echo "✅ Compressed: ${backup}.gz"
  else
    echo "⚠️  Consensus DB not found"
  fi
}

# Backup curiosity metrics
function backup_metrics() {
  local db="$WORKSPACE_ROOT/.curiosity/curiosity_metrics.db"
  local backup="$BACKUP_DIR/curiosity-$(date +%Y%m%d-%H%M%S).db"
  
  if [[ -f "$db" ]]; then
    cp "$db" "$backup"
    echo "✅ Metrics backed up: $backup"
    
    gzip "$backup" && echo "✅ Compressed: ${backup}.gz"
  else
    echo "⚠️  Metrics DB not found"
  fi
}

# Daily backup (cron job)
function daily_backup() {
  echo "=== Daily Ledger Backup ==="
  backup_consensus
  backup_metrics
  
  # Prune old backups (keep last 7 days)
  find "$BACKUP_DIR" -name "*.db.gz" -mtime +7 -delete
  echo "✅ Old backups pruned (7+ days)"
}

# Restore from backup
function restore() {
  local latest
  latest=$(ls -t "$BACKUP_DIR"/consensus-*.db.gz 2>/dev/null | head -1)
  
  if [[ -n "$latest" ]]; then
    gunzip -c "$latest" > "$AURA_DIR/consensus.db"
    echo "✅ Restored from: $latest"
  else
    echo "⚠️  No backup found"
  fi
}

# CLI
case "${1:-daily}" in
  --daily) daily_backup ;;
  --manual) backup_consensus && backup_metrics ;;
  --restore) restore ;;
  *) echo "Usage: $0 [--daily|--manual|--restore]"; exit 1 ;;
esac
