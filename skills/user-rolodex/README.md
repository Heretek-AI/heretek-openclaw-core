# User Rolodex Skill

Multi-platform user identity resolution and preference learning for the OpenClaw agent collective.

## Overview

The User Rolodex skill manages user profiles, preferences, and relationships:

1. **User Profiles** - Structured user data storage with UUID and multi-platform support
2. **Preference Learning** - Track implicit and explicit preferences
3. **Interaction History** - Record all interactions with users
4. **Multi-User Support** - Manage multiple user relationships
5. **Search & Lookup** - Quick user retrieval by various attributes
6. **User Merging** - Merge duplicate profiles while preserving data

## Installation

```bash
cd skills/user-rolodex
npm install  # No external dependencies required
```

## Usage

### Command Line

```bash
# Create new user
node user-rolodex.js create --name "John Doe" --type primary --trust 0.9

# Lookup user
node user-rolodex.js lookup john-doe
node user-rolodex.js lookup john-doe --json

# Update user
node user-rolodex.js update john-doe --timezone "America/New_York"

# Search users
node user-rolodex.js search --project "heretek-openclaw"
node user-rolodex.js search --type primary

# Add interaction note
node user-rolodex.js note john-doe "Discussed architecture" technical 0.8

# Learn preference
node user-rolodex.js prefer john-doe communication casual

# List all users
node user-rolodex.js list
```

### Programmatic Usage

```javascript
const { UserRolodex } = require('./user-rolodex');

const rolodex = new UserRolodex();

// Create user
const user = rolodex.createUser({
  name: 'John Doe',
  preferred: 'John',
  type: 'primary',
  trust: 0.9,
  timezone: 'America/New_York'
});

// Lookup user
const profile = rolodex.lookupUser('john-doe');

// Add note
rolodex.addNote('john-doe', 'Discussed new architecture', 'technical', 0.8);

// Set preference
rolodex.setPreference('john-doe', 'communication', 'style', 'casual');

// Search users
const results = rolodex.searchUsers({ project: 'heretek-openclaw' });
```

## User Profile Structure

```json
{
  "uuid": "550e8400-e29b-41d4-a716-446655440000",
  "slug": "john-doe",
  "username": "john-doe",
  "name": {
    "full": "John Doe",
    "preferred": "John",
    "phonetic": null
  },
  "pronouns": "he/him",
  "timezone": "America/New_York",
  "languages": ["en"],
  "platforms": {
    "discord": { "id": "123456789", "username": "johndoe" },
    "phone": { "number": "+15551234567", "verified": true },
    "web": { "email": "john@example.com", "sessions": [] },
    "github": { "id": 12345, "username": "johndoe" }
  },
  "preferences": {
    "communicationStyle": "casual",
    "response_length": "detailed",
    "code_style": {
      "comments": "detailed",
      "naming": "descriptive"
    },
    "topics_of_interest": ["AI", "agents"]
  },
  "relationship": {
    "type": "primary",
    "since": "2026-03-31T00:00:00Z",
    "trust_level": 0.9
  },
  "projects": [
    {
      "name": "heretek-openclaw",
      "role": "owner",
      "status": "active"
    }
  ],
  "context_notes": [],
  "sessions": []
}
```

## Relationship Types

| Type | Description |
|------|-------------|
| `primary` | Primary user/owner |
| `collaborator` | Regular collaborator |
| `occasional` | Occasional user |

## Trust Levels

| Level | Description |
|-------|-------------|
| `1.0` | Complete trust |
| `0.8-0.9` | High trust |
| `0.5-0.7` | Moderate trust |
| `0.3-0.4` | Low trust |
| `0.0-0.2` | Minimal trust |

## Note Categories

| Category | Description |
|----------|-------------|
| `general` | General interaction notes |
| `technical` | Technical discussions |
| `personal` | Personal information |
| `preference` | Preference observations |
| `feedback` | User feedback |

## Configuration

```bash
# Environment Variables
USERS_DIR="./users"           # Users directory
USER_SCHEMA="./users/_schema.json"  # Schema file
USER_INDEX="./users/index.json"     # Index file
```

## Directory Structure

```
users/
├── _schema.json           # User schema definition
├── index.json             # Quick lookup index
│
├── john-doe/              # User directory
│   ├── profile.json       # Structured user data
│   ├── preferences.json   # Learned preferences
│   └── history.json       # Interaction history
│
└── _templates/
    └── new-user.json      # Template for new users
```

## Integration

The User Rolodex skill integrates with:

- **Empath Agent** - Primary consumer of user data
- **Memory System** - User data stored in episodic memory
- **A2A Protocol** - User context in agent communications

## License

MIT
