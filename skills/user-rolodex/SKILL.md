---
name: user-rolodex
description: Manages a rolodex of users for learning and adding new users. Provides tools for user profile management, preference tracking, and relationship building.
---

# User Rolodex — Multi-User Management

**Purpose:** Transform single USER.md into a learnable, extensible user rolodex.

**Status:** ✅ Implemented (2026-03-29)

**Location:** `~/.openclaw/workspace/skills/user-rolodex/`

---

## Features

- **User Profiles:** Structured user data storage
- **Preference Learning:** Implicit and explicit preference tracking
- **Interaction History:** Track all interactions with users
- **Multi-User Support:** Manage multiple user relationships
- **Search & Lookup:** Quick user retrieval by various attributes

## Configuration

```bash
# Environment Variables
USERS_DIR="${USERS_DIR:-./users}"
USER_SCHEMA="${USER_SCHEMA:-./users/_schema.json}"
USER_INDEX="${USER_INDEX:-./users/index.json}"
```

## Usage

```bash
# Create new user
./user-rolodex.sh create --name "John Doe" --preferred "John"

# Update user
./user-rolodex.sh update john-doe --timezone "America/New_York"

# Lookup user
./user-rolodex.sh lookup john-doe

# Search users
./user-rolodex.sh search --project "heretek-openclaw"

# Add interaction note
./user-rolodex.sh note john-doe "Discussed new agent architecture"

# Learn preference
./user-rolodex.sh prefer john-doe code_style "detailed comments"
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

## Integration Points

- **Empath Agent:** Primary consumer of user data
- **Memory System:** User data stored in episodic memory
- **A2A Protocol:** User context in agent communications

---

*User Rolodex - Building relationships, one interaction at a time.*
