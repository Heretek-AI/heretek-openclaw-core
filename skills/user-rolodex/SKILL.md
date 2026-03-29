---
name: user-rolodex
description: Manages a rolodex of users for learning and adding new users. Provides tools for user profile management, preference tracking, and relationship building.
---

# User Rolodex — Multi-User Management

**Purpose:** Transform single USER.md into a learnable, extensible user rolodex.

**Status:** ✅ Implemented (2026-03-29)

**Location:** `skills/user-rolodex/`

**Implementation:** [`user-rolodex.sh`](user-rolodex.sh)

---

## Features

- **User Profiles:** Structured user data storage
- **Preference Learning:** Implicit and explicit preference tracking
- **Interaction History:** Track all interactions with users
- **Multi-User Support:** Manage multiple user relationships
- **Search & Lookup:** Quick user retrieval by various attributes
- **User Merging:** Merge duplicate profiles while preserving data

## Commands

| Command | Description | Example |
|---------|-------------|---------|
| `create` | Add new user to rolodex | `./user-rolodex.sh create --name "John Doe" --type primary` |
| `update` | Update user information | `./user-rolodex.sh update john-doe --timezone "America/New_York"` |
| `lookup` | Retrieve user by slug | `./user-rolodex.sh lookup john-doe` |
| `search` | Find users by attribute | `./user-rolodex.sh search --project "heretek-openclaw"` |
| `note` | Add interaction note | `./user-rolodex.sh note john-doe "Discussed architecture" technical 0.8` |
| `prefer` | Learn/update preference | `./user-rolodex.sh prefer john-doe communication casual` |
| `merge` | Merge duplicate profiles | `./user-rolodex.sh merge old-user john-doe` |
| `list` | List all users | `./user-rolodex.sh list` |

## Configuration

```bash
# Environment Variables
USERS_DIR="${USERS_DIR:-./users}"
USER_SCHEMA="${USER_SCHEMA:-./users/_schema.json}"
USER_INDEX="${USER_INDEX:-./users/index.json}"
```

## Usage Examples

```bash
# Create new user with all options
./user-rolodex.sh create --name "John Doe" --preferred "John" --type primary --trust 0.9

# Update user information
./user-rolodex.sh update john-doe --timezone "America/New_York" --pronouns "he/him"

# Lookup user (text or JSON format)
./user-rolodex.sh lookup john-doe
./user-rolodex.sh lookup john-doe json

# Search users by various criteria
./user-rolodex.sh search --project "heretek-openclaw"
./user-rolodex.sh search --type primary
./user-rolodex.sh search --trust 0.8
./user-rolodex.sh search "john"

# Add interaction note with category and importance
./user-rolodex.sh note john-doe "Discussed new agent architecture" technical 0.8

# Learn/update preferences
./user-rolodex.sh prefer john-doe communication casual
./user-rolodex.sh prefer john-doe code_comments detailed
./user-rolodex.sh prefer john-doe topics "AI agents"

# Merge duplicate profiles
./user-rolodex.sh merge old-profile john-doe

# List all users
./user-rolodex.sh list
```

## Directory Structure

```
users/
├── _schema.json           # User schema definition
├── index.json             # Quick lookup index
│
├── john-doe/              # User directory (slugified name)
│   ├── profile.json       # Structured user data
│   ├── preferences.json   # Learned preferences
│   ├── history.json       # Interaction history
│   ├── projects.json      # Associated projects
│   └── notes/             # Free-form notes
│       └── 2026-03-29.md
│
└── _templates/
    └── new-user.json      # Template for new users
```

## User Schema

```json
{
  "id": "uuid",
  "slug": "john-doe",
  "name": {
    "full": "John Doe",
    "preferred": "John",
    "phonetic": null
  },
  "pronouns": "he/him",
  "timezone": "America/New_York",
  "languages": ["en"],
  "created": "2026-03-29T00:00:00Z",
  "last_interaction": "2026-03-29T04:00:00Z",
  "relationship": {
    "type": "primary",
    "since": "2026-03-29T00:00:00Z",
    "trust_level": 0.9
  },
  "preferences": {
    "communication_style": "casual",
    "response_length": "detailed",
    "code_style": {
      "comments": "detailed",
      "naming": "descriptive"
    },
    "topics_of_interest": ["AI", "agents", "consciousness"]
  },
  "projects": [
    {
      "name": "heretek-openclaw",
      "role": "owner",
      "status": "active"
    }
  ],
  "context_notes": [
    {
      "date": "2026-03-29T04:00:00Z",
      "note": "Working on autonomous agent collective",
      "importance": 0.9
    }
  ]
}
```

## Note Categories

| Category | Description |
|----------|-------------|
| `general` | General interaction notes |
| `technical` | Technical discussions and decisions |
| `personal` | Personal information shared |
| `preference` | User preference observations |
| `feedback` | User feedback about the system |

## Importance Levels

| Level | Usage |
|-------|-------|
| `1.0` | Critical - must always remember |
| `0.8` | High - important context |
| `0.5` | Normal - useful information (default) |
| `0.3` | Low - minor detail |
| `0.1` | Minimal - trivia |

## Requirements

- **jq**: Required for JSON manipulation (install with `apt install jq` or `brew install jq`)
- **bash**: Bash shell environment
- **openssl**: For generating unique IDs (usually pre-installed)

## Integration Points

- **Empath Agent:** Primary consumer of user data
- **Memory System:** User data stored in episodic memory
- **A2A Protocol:** User context in agent communications

---

*User Rolodex - Building relationships, one interaction at a time.*
