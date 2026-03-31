---
name: user-rolodex
description: Multi-user management system with identity resolution, relationship tracking, and preference learning for personalized agent interactions.
---

# User Rolodex — Multi-User Management System

**Purpose:** Comprehensive multi-user management with identity resolution, relationship tracking, and preference learning.

**Status:** ✅ Multi-User Enabled (Phase 8 Complete)

**Location:** `skills/user-rolodex/`

**Core Modules:**
- [`user-rolodex.js`](user-rolodex.js) - User profile management
- [`identity-resolution.js`](identity-resolution.js) - Multi-platform identity resolution
- [`relationship-tracker.js`](relationship-tracker.js) - Trust and relationship tracking

---

## Features

### User Profile Management
- **Structured Profiles:** UUID-based canonical identifiers with full metadata
- **User Types:** Primary, Collaborator, Partner, Observer, Client, Vendor, Agent
- **Preference Learning:** Communication style, response length, code style, topics of interest
- **Project Associations:** Track user roles across multiple projects
- **Context Notes:** Categorized notes with importance scoring

### Identity Resolution
- **Multi-Platform Support:** Discord, Phone, Email, GitHub, Slack, Telegram
- **Universal Lookup:** Resolve any identifier to user profile
- **Cross-Platform Linking:** Link multiple identities to single UUID
- **Fast Index:** Pre-built identity index for O(1) lookups
- **Verification Status:** Track identity verification per platform

### Relationship Tracking
- **Trust Levels:** 0.0 - 1.0 scale with type-based constraints
- **Relationship Graph:** Visualize connections between users and agents
- **History Tracking:** Complete audit trail of relationship changes
- **Agent Relations:** Track user-agent interaction patterns
- **Trust Adjustments:** Automatic adjustments based on interaction outcomes

---

## Commands

### User Management (`user-rolodex.js`)

| Command | Description | Example |
|---------|-------------|---------|
| `create` | Add new user to rolodex | `node user-rolodex.js create --name "John Doe" --type collaborator` |
| `lookup <slug>` | Retrieve user by slug | `node user-rolodex.js lookup john-doe --json` |
| `update <slug>` | Update user information | `node user-rolodex.js update john-doe --timezone "America/New_York"` |
| `search` | Find users by attribute | `node user-rolodex.js search --project "heretek-openclaw"` |
| `note <slug> <note>` | Add interaction note | `node user-rolodex.js note john-doe "Discussed architecture" --category technical` |
| `prefer <slug>` | Learn/update preference | `node user-rolodex.js prefer john-doe communication technical` |
| `merge <src> <tgt>` | Merge duplicate profiles | `node user-rolodex.js merge old-profile john-doe` |
| `list` | List all users | `node user-rolodex.js list --json` |

### Identity Resolution (`identity-resolution.js`)

| Command | Description | Example |
|---------|-------------|---------|
| `lookup-discord <id>` | Find user by Discord ID | `node identity-resolution.js lookup-discord 123456789` |
| `lookup-email <email>` | Find user by email | `node identity-resolution.js lookup-email user@example.com` |
| `lookup-phone <phone>` | Find user by phone | `node identity-resolution.js lookup-phone +15551234567` |
| `lookup-github <user>` | Find user by GitHub | `node identity-resolution.js lookup-github johnd` |
| `resolve <identifier>` | Universal lookup | `node identity-resolution.js resolve 123456789` |
| `link <slug>` | Link platform identity | `node identity-resolution.js link john-doe --discord 123456789` |
| `unlink <slug> <platform>` | Remove identity | `node identity-resolution.js unlink john-doe discord` |
| `identities <slug>` | Show all identities | `node identity-resolution.js identities john-doe` |
| `build-index` | Build fast lookup index | `node identity-resolution.js build-index` |
| `fast-lookup <id>` | Indexed lookup | `node identity-resolution.js fast-lookup john@example.com` |

### Relationship Tracking (`relationship-tracker.js`)

| Command | Description | Example |
|---------|-------------|---------|
| `set-trust <slug> <level>` | Set trust level (0.0-1.0) | `node relationship-tracker.js set-trust john-doe 0.85` |
| `get-trust <slug>` | Get current trust | `node relationship-tracker.js get-trust john-doe` |
| `adjust-trust <slug> <delta>` | Adjust trust by delta | `node relationship-tracker.js adjust-trust john-doe 0.05` |
| `set-type <slug>` | Set relationship type | `node relationship-tracker.js set-type john-doe --type collaborator` |
| `add-relation <s1> <s2>` | Add user relationship | `node relationship-tracker.js add-relation john-doe jane-doe` |
| `add-agent <slug> <agent>` | Add agent relationship | `node relationship-tracker.js add-agent john-doe agent-alpha` |
| `history <slug>` | Get relationship history | `node relationship-tracker.js history john-doe` |
| `graph` | Show relationship graph | `node relationship-tracker.js graph --json` |
| `types` | List relationship types | `node relationship-tracker.js types` |

---

## Relationship Types

| Type | Default Trust | Range | Description |
|------|---------------|-------|-------------|
| `primary` | 0.9 | 0.8-1.0 | Main project owner/leader |
| `collaborator` | 0.7 | 0.5-0.9 | Active development partner |
| `partner` | 0.6 | 0.4-0.8 | Strategic organization |
| `observer` | 0.3 | 0.1-0.5 | Passive viewer |
| `client` | 0.5 | 0.3-0.7 | External customer |
| `vendor` | 0.4 | 0.2-0.6 | Service provider |
| `agent` | 0.8 | 0.5-1.0 | AI agent in collective |

---

## Directory Structure

```
skills/user-rolodex/
├── SKILL.md
├── user-rolodex.js              # Core user management
├── identity-resolution.js       # Identity resolution
├── relationship-tracker.js      # Relationship tracking
├── package.json
├── README.md
│
└── users/
    ├── _schema.json             # User schema
    ├── _identity-index.json     # Fast lookup index
    ├── index.json               # User index
    │
    ├── _templates/              # Profile templates
    │   ├── README.md
    │   ├── primary-user.json
    │   ├── collaborator-user.json
    │   ├── partner-user.json
    │   ├── observer-user.json
    │   └── client-user.json
    │
    ├── _relationships/          # Relationship data
    │   ├── graph.json
    │   └── history.json
    │
    └── <user-slug>/
        ├── profile.json
        ├── preferences.json
        └── history.json
```

---

## Usage Examples

### Create and Configure User

```bash
# Create collaborator with full setup
node user-rolodex.js create --name "Jane Smith" --type collaborator --trust 0.7
node identity-resolution.js link jane-smith --discord 987654321 --discord-username janes
node identity-resolution.js link jane-smith --email jane@example.com
node identity-resolution.js link jane-smith --github janesmith
node identity-resolution.js build-index

# Set preferences
node user-rolodex.js prefer jane-smith communication technical
node user-rolodex.js prefer jane-smith code_comments detailed
node user-rolodex.js prefer jane-smith topic "distributed systems"

# Add context note
node user-rolodex.js note jane-smith "Lead developer on microservices project" --category technical --importance 0.8
```

### Identity Resolution

```bash
# Find user by any identifier
node identity-resolution.js resolve 987654321           # Discord ID
node identity-resolution.js resolve jane@example.com     # Email
node identity-resolution.js resolve janesmith            # GitHub

# Fast lookup after building index
node identity-resolution.js fast-lookup jane@example.com
```

### Trust Management

```bash
# Set initial trust
node relationship-tracker.js set-trust jane-smith 0.75

# Adjust based on interactions
node relationship-tracker.js adjust-trust jane-smith 0.05 --reason "valuable_contribution"
node relationship-tracker.js adjust-trust bob -0.1 --reason "policy_violation"

# View trust history
node relationship-tracker.js history jane-smith --json
```

---

## Programmatic API

```javascript
const { UserRolodex } = require('./user-rolodex.js');
const { IdentityResolver } = require('./identity-resolution.js');
const { RelationshipTracker } = require('./relationship-tracker.js');

// User Management
const rolodex = new UserRolodex();
const user = rolodex.createUser({ 
    name: "John Doe", 
    type: "collaborator",
    trust: 0.7 
});

// Identity Resolution
const resolver = new IdentityResolver();
resolver.linkDiscord("john-doe", "123456789", "johnd");
resolver.linkEmail("john-doe", "john@example.com");
const result = resolver.findByEmail("john@example.com");

// Relationship Tracking
const tracker = new RelationshipTracker();
tracker.setTrustLevel("john-doe", 0.85, "promoted");
tracker.addAgentRelationship("john-doe", "agent-alpha");
const graph = tracker.getGraph();
```

---

## Integration Points

- **Empath Agent:** Primary consumer of user data for personalized interactions
- **Memory System:** User profiles and interaction history in episodic memory
- **A2A Protocol:** User context in agent-to-agent communications
- **Security Module:** Trust-based permission enforcement

---

## Requirements

- **Node.js:** v14+ for JavaScript modules
- **jq:** For shell script JSON manipulation
- **openssl:** For UUID generation (usually pre-installed)

---

## Documentation

- [User Management Guide](../../docs/users/USER_MANAGEMENT.md)
- [User Profile Templates](users/_templates/README.md)

---

*User Rolodex - Building personalized agent interactions through comprehensive user understanding.*
