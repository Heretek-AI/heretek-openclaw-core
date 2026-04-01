# Heretek Patch Management

This directory contains patch files for maintaining Heretek-specific modifications while preserving upstream compatibility.

---

## Overview

The patch system allows Heretek to:

1. Apply bug fixes and features on top of upstream OpenClaw
2. Easily rebase onto new upstream versions
3. Track and manage Heretek-specific changes
4. Contribute fixes back to upstream when appropriate

---

## Quick Start

### Applying Patches

Patches are automatically applied during `npm install` via the `postinstall` hook.

Manual application:
```bash
./scripts/patch-apply.sh
```

### Creating a New Patch

```bash
# Create patch from modified files
./scripts/patch-create.sh <patch-name> <file-path>

# Example:
./scripts/patch-create.sh my-fix gateway/openclaw-gateway.js
```

### Checking Patch Status

```bash
./scripts/patch-status.sh
```

---

## Patch Files

| Patch File | Description | Category |
|------------|-------------|----------|
| `a2a-protocol-infrastructure.patch` | A2A messaging, Gateway, Redis bridge | Bug Fix |
| `agent-lifecycle-steward-primary.patch` | Agent registration, heartbeat, steward config | Bug Fix |
| `approval-system-liberation.patch` | Approval bypass, safety section removal | Heretek Feature |

---

## Patch Format

All patches use unified diff format:

```diff
--- a/path/to/file.js
+++ b/path/to/file.js
@@ -1,5 +1,6 @@
 // Modified line
+// New line added
 // Unchanged line
-// Removed line
+// Replaced line
```

---

## .patchestoo File

The `.patchestoo` file at the repository root lists patches in the order they should be applied:

```
patches/a2a-protocol-infrastructure.patch
patches/agent-lifecycle-steward-primary.patch
patches/approval-system-liberation.patch
```

---

## Patch Categories

### Bug Fixes

Patches that fix broken functionality. These should be contributed back to upstream.

- `a2a-protocol-infrastructure.patch`
- `agent-lifecycle-steward-primary.patch`

### Heretek Features

Patches specific to Heretek's deployment or requirements.

- `approval-system-liberation.patch`

---

## Workflow

### 1. Making Changes

1. Modify files as needed
2. Test thoroughly
3. Create patch:
   ```bash
   ./scripts/patch-create.sh <patch-name> <file-path>
   ```

### 2. Applying Patches

1. Fresh checkout or after upstream sync
2. Run:
   ```bash
   ./scripts/patch-apply.sh
   ```

### 3. Checking Status

```bash
./scripts/patch-status.sh
```

Output shows:
- ✅ Applied patches
- ❌ Failed patches
- ⚠️ Patches with warnings

### 4. Upstream Sync

1. Fetch upstream:
   ```bash
   git fetch upstream
   ```

2. Rebase:
   ```bash
   git rebase upstream/main
   ```

3. Resolve conflicts if any

4. Re-apply patches:
   ```bash
   ./scripts/patch-apply.sh
   ```

5. Regenerate patches if needed:
   ```bash
   ./scripts/patch-create.sh <patch-name> <file-path>
   ```

---

## Troubleshooting

### Patch Failed to Apply

1. Check if file exists:
   ```bash
   ls -la <file-path>
   ```

2. Check patch format:
   ```bash
   cat patches/<patch-name>.patch
   ```

3. Try manual application:
   ```bash
   patch -p1 < patches/<patch-name>.patch
   ```

4. If still failing, regenerate patch:
   ```bash
   ./scripts/patch-create.sh <patch-name> <file-path>
   ```

### Conflicts After Upstream Sync

1. Identify conflicting patches:
   ```bash
   ./scripts/patch-status.sh
   ```

2. Manually resolve conflicts in affected files

3. Regenerate patches:
   ```bash
   ./scripts/patch-create.sh <patch-name> <file-path>
   ```

---

## Best Practices

1. **Keep patches focused** - Each patch should address a single issue or feature
2. **Document changes** - Include clear commit messages and comments
3. **Test thoroughly** - Always test after applying patches
4. **Contribute upstream** - Submit bug fixes to upstream when possible
5. **Version patches** - Include version info in patch names for major changes

---

## Scripts Reference

| Script | Description |
|--------|-------------|
| `scripts/patch-apply.sh` | Apply all patches from `.patchestoo` |
| `scripts/patch-create.sh` | Create a new patch from diff |
| `scripts/patch-status.sh` | Show patch application status |
| `scripts/upstream-sync.sh` | Sync with upstream repository |

---

## Related Documentation

- [`HERETEK_FORK.md`](../HERETEK_FORK.md) - Fork strategy and upstream sync
- [`CHANGELOG_HERETEK.md`](../CHANGELOG_HERETEK.md) - Heretek-specific changelog
- [`DEBUG_A2A.md`](../DEBUG_A2A.md) - A2A protocol debug report
- [`DEBUG_AGENT_LIFECYCLE.md`](../DEBUG_AGENT_LIFECYCLE.md) - Agent lifecycle debug report
