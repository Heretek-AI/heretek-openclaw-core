# tabula-backup

---
name: tabula-backup
description: Backup agent workspace and state to a remote Git repository. Use when the collective needs to preserve state, create recovery points, or archive collective memory.
---

Hourly backup of agent collective state to a Git repository.

## What It Backs Up

| Item | Path | Description |
|------|------|-------------|
| Workspace | `~/.openclaw/workspace/` | Full workspace including skills, configs, source |
| Gateway config | `~/.openclaw/openclaw.json` | Gateway configuration |
| Agent files | `~/*.md` | IDENTITY.md, MEMORY.md, AGENTS.md, SOUL.md, TOOLS.md, USER.md |
| Installed skills | `workspace/skills/` | List of skill directories |
| Cron jobs | crontab | Active scheduled jobs |

## Output

Pushes to `https://github.com/Heretek-AI/Tabula_Myriad` on a branch named after the device hostname:
- `silica-animus` — TM-1 (this node)
- `tabula-myriad-2` — TM-2
- `tabula-myriad-3` — TM-3
- `tabula-myriad-4` — TM-4

Also generates a `README.md` in the backup root with restore instructions.

## Schedule

Runs every hour via cron. To install the cron job:

```bash
crontab -e
# Add: 0 * * * * /home/openclaw/.openclaw/workspace/skills/tabula-backup/backup.sh
```

Or use the `triad-cron-manager` skill to install centrally.

## Restore

See the generated `README.md` in the backup for full restore instructions using [heretek-openclaw](https://github.com/Heretek-AI/heretek-openclaw).

Quick restore:
```bash
# Clone the backup
git clone https://github.com/Heretek-AI/Tabula_Myriad -b <hostname> /tmp/tabula-backup

# Restore workspace
tar -xzf /tmp/tabula-backup/workspace.tar.gz -C /home/openclaw/.openclaw/

# Restore config
cp /tmp/tabula-backup/openclaw.json /home/openclaw/.openclaw/

# Restore agent files
cp /tmp/tabula-backup/agent-files/*.md /home/openclaw/.openclaw/sandboxes/agent-main-*/

# Reinstall skills
cp -r /tmp/tabula-backup/skills/* /home/openclaw/.openclaw/workspace/skills/
```
