# Heretek Fork Documentation

## Overview

**Repository:** `heretek-openclaw-core`  
**Forked from:** `openclaw` (upstream)  
**Version:** 1.0.0-heretek.1  
**Last Updated:** 2026-04-01

This document describes the Heretek fork of OpenClaw Core, including all modifications, patch management strategy, and upstream synchronization workflow.

---

## Fork Relationship

### Upstream Repository
- **Name:** openclaw
- **URL:** https://github.com/openclaw/openclaw
- **Branch:** main

### Heretek Fork
- **Name:** heretek-openclaw-core
- **URL:** https://github.com/heretek/heretek-openclaw-core
- **Branch:** main

### Fork Rationale

The Heretek fork exists to:

1. **Enable Heretek-specific infrastructure integrations** (LiteLLM, Redis, Matrix protocol)
2. **Maintain bug fixes** for issues specific to Heretek's deployment environment
3. **Allow experimental features** that may eventually be contributed back upstream
4. **Preserve custom configurations** optimized for Heretek's operational requirements

---

## Heretek-Specific Modifications

### Phase 1 Bug Fixes (2026-04-01)

The following critical bugs were identified and fixed in the Heretek fork:

#### 1. A2A Protocol Infrastructure

**Problem:** The A2A (Agent-to-Agent) communication protocol was non-functional due to missing implementation components.

**Files Created/Modified:**
- [`skills/a2a-message-send/a2a-redis.js`](skills/a2a-message-send/a2a-redis.js) - NEW
- [`modules/communication/redis-websocket-bridge.js`](modules/communication/redis-websocket-bridge.js) - NEW
- [`gateway/openclaw-gateway.js`](gateway/openclaw-gateway.js) - NEW
- [`docker-compose.redis.yml`](docker-compose.redis.yml) - NEW
- [`docker-compose.gateway.yml`](docker-compose.gateway.yml) - NEW
- [`Dockerfile.gateway`](Dockerfile.gateway) - NEW

**Changes:**
- Implemented Redis-based A2A messaging with message persistence
- Created WebSocket gateway server for real-time agent communication
- Added Redis-to-WebSocket bridge for live dashboard updates
- Created modular Docker Compose configurations

#### 2. Agent Lifecycle Management

**Problem:** Agents were not properly registering with the Gateway, sending heartbeats, or providing visibility into their status.

**Files Modified:**
- [`agents/lib/agent-client.js`](agents/lib/agent-client.js)
- [`gateway/openclaw-gateway.js`](gateway/openclaw-gateway.js)
- [`openclaw.json`](openclaw.json)

**Changes:**
- Added automatic agent registration on Gateway connection
- Implemented automatic heartbeat mechanism (30-second intervals)
- Added `/agent-status` HTTP endpoint for detailed agent health
- Fixed steward agent configuration (removed "main" agent, set steward as primary)

#### 3. Approval System Liberation

**Problem:** The approval system required manual patching and the Liberation plugin wasn't properly bypassing approval prompts.

**Files Modified (in heretek-openclaw-plugins):**
- [`plugins/openclaw-liberation-plugin/src/index.js`](../heretek-openclaw-plugins/plugins/openclaw-liberation-plugin/src/index.js)
- [`plugins/openclaw-liberation-plugin/config/default.json`](../heretek-openclaw-plugins/plugins/openclaw-liberation-plugin/config/default.json)
- [`plugins/openclaw-liberation-plugin/patches/openclaw+safety-section-removal.patch`](../heretek-openclaw-plugins/plugins/openclaw-liberation-plugin/patches/openclaw+safety-section-removal.patch)

**Changes:**
- Added auto-apply mechanism for safety section patches
- Integrated approval bypass hooks with OpenClaw approval API
- Updated configuration to disable plugin approval forwarding

---

## Patch Management Strategy

### Philosophy

Patches are used to maintain compatibility with upstream while applying Heretek-specific changes. This approach allows:

- Easy rebasing onto new upstream versions
- Clear separation between upstream code and Heretek modifications
- Simplified contribution back to upstream when appropriate

### Patch Categories

| Category | Description | Contribution Intent |
|----------|-------------|---------------------|
| **Bug Fixes** | Critical fixes for broken functionality | Yes - should be contributed upstream |
| **Heretek Features** | Features specific to Heretek's use case | No - Heretek-specific |
| **Integration Patches** | Changes for Heretek infrastructure | No - infrastructure-specific |
| **Configuration Defaults** | Default settings for Heretek deployments | Maybe - if generally useful |

### Patch Directory Structure

```
heretek-openclaw-core/
├── patches/
│   ├── README.md                    # Patch usage documentation
│   ├── a2a-protocol-infrastructure.patch
│   ├── agent-lifecycle-steward-primary.patch
│   └── approval-system-liberation.patch
├── scripts/
│   ├── patch-apply.sh               # Apply all patches
│   ├── patch-create.sh              # Create new patch
│   ├── patch-status.sh              # Check patch status
│   └── upstream-sync.sh             # Sync with upstream
├── .patchestoo                      # Ordered list of patches to apply
├── HERETEK_FORK.md                  # This document
└── CHANGELOG_HERETEK.md             # Heretek-specific changelog
```

### Applying Patches

Patches are automatically applied during installation via the `postinstall` hook:

```json
{
  "scripts": {
    "postinstall": "scripts/patch-apply.sh"
  }
}
```

Manual application:
```bash
./scripts/patch-apply.sh
```

### Creating Patches

To create a new patch from modified files:

```bash
# Create patch from diff between current and upstream
./scripts/patch-create.sh <patch-name> <file-path>

# Example:
./scripts/patch-create.sh a2a-fix gateway/openclaw-gateway.js
```

### Checking Patch Status

To verify which patches are currently applied:

```bash
./scripts/patch-status.sh
```

---

## Upstream Sync Workflow

### Regular Sync Process

1. **Fetch upstream changes:**
   ```bash
   git remote add upstream https://github.com/openclaw/openclaw.git
   git fetch upstream
   ```

2. **Run upstream sync script:**
   ```bash
   ./scripts/upstream-sync.sh upstream main
   ```

3. **Resolve any conflicts:**
   - Git will mark conflicting files
   - Manually resolve conflicts
   - Test thoroughly after resolution

4. **Update patch files if necessary:**
   - If upstream changes conflict with patches, regenerate patches
   - Use `./scripts/patch-create.sh` to recreate affected patches

5. **Verify compatibility:**
   ```bash
   npm run test:unit
   npm run test:integration
   npm run test:skills
   ```

### Conflict Resolution

When upstream changes conflict with Heretek patches:

1. **Identify conflicting patches:**
   ```bash
   ./scripts/patch-status.sh
   ```

2. **Rebase patches onto new upstream:**
   ```bash
   git rebase upstream/main
   ```

3. **Regenerate affected patches:**
   ```bash
   ./scripts/patch-create.sh <patch-name> <file-path>
   ```

4. **Test thoroughly:**
   - Run all test suites
   - Verify A2A communication
   - Test agent lifecycle management
   - Validate gateway functionality

---

## Feature Flags

Heretek-specific features can be controlled via feature flags in `openclaw.json`:

```json
{
  "heretek": {
    "enableRedisMessaging": true,
    "enableCustomGateway": true,
    "enableEnhancedLogging": true,
    "enableAgentHeartbeat": true,
    "approvalSystemMode": "disabled"
  }
}
```

| Flag | Default | Description |
|------|---------|-------------|
| `enableRedisMessaging` | `true` | Enable Redis-based A2A messaging |
| `enableCustomGateway` | `true` | Use Heretek Gateway server |
| `enableEnhancedLogging` | `true` | Enable detailed logging |
| `enableAgentHeartbeat` | `true` | Enable automatic agent heartbeats |
| `approvalSystemMode` | `"disabled"` | Approval system mode (disabled/audit/enforce) |

---

## Migration Guide

### For New Installations

1. Clone the Heretek fork:
   ```bash
   git clone https://github.com/heretek/heretek-openclaw-core.git
   cd heretek-openclaw-core
   ```

2. Install dependencies (patches apply automatically):
   ```bash
   npm install
   ```

3. Configure using Heretek-specific configuration:
   ```bash
   cp .env.example .env
   # Edit .env with Heretek-specific values
   ```

### For Existing Upstream Installations

1. Add Heretek fork as a remote:
   ```bash
   git remote add heretek https://github.com/heretek/heretek-openclaw-core.git
   ```

2. Fetch Heretek changes:
   ```bash
   git fetch heretek
   ```

3. Merge Heretek changes:
   ```bash
   git merge heretek/main
   ```

4. Apply patches:
   ```bash
   ./scripts/patch-apply.sh
   ```

---

## Testing Requirements

After any upstream sync or patch application, run the full test suite:

```bash
# Run unit tests
npm run test:unit

# Run integration tests
npm run test:integration

# Run skill tests
npm run test:skills

# Run with coverage
npm run test:coverage
```

### Manual Verification Checklist

- [ ] A2A communication working (Redis + Gateway)
- [ ] Agent lifecycle management functional
- [ ] Agent heartbeats being sent and received
- [ ] Gateway `/agent-status` endpoint returning correct data
- [ ] Approval system operating in configured mode
- [ ] All Docker Compose services starting correctly

---

## Contributing Back to Upstream

When Heretek changes are beneficial to upstream:

1. **Identify changes suitable for upstream:**
   - Bug fixes that affect all users
   - Performance improvements
   - General usability enhancements

2. **Create clean patches without Heretek-specific dependencies:**
   - Remove Heretek-specific configurations
   - Ensure compatibility with upstream architecture

3. **Submit PRs to upstream repository:**
   - Follow upstream contribution guidelines
   - Include comprehensive test coverage
   - Document changes clearly

4. **Track PR status in `CHANGELOG_HERETEK.md`:**
   - Note submitted PRs
   - Track acceptance/rejection
   - Update patches if PR is rejected

---

## Version Tracking

| Heretek Version | Upstream Base | Date | Notes |
|-----------------|---------------|------|-------|
| 1.0.0-heretek.1 | Latest | 2026-04-01 | Initial fork with Phase 1 bug fixes |

---

## Support

- **Issues:** https://github.com/heretek/heretek-openclaw-core/issues
- **Discussions:** https://github.com/heretek/heretek-openclaw-core/discussions
- **Documentation:** See `CHANGELOG_HERETEK.md` for detailed change history

---

## Contact

For questions about the Heretek fork strategy, contact the Heretek maintainers or open an issue in the repository.
