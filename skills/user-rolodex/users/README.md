# Users Directory

This directory contains all user profiles and related data for the User Rolodex system.

## Structure

```
users/
├── README.md                 # This file
├── _schema.json              # JSON schema for user profiles
├── _identity-index.json      # Fast lookup identity index
├── index.json                # Quick user index
│
├── _templates/               # User profile templates
│   ├── README.md
│   ├── primary-user.json
│   ├── collaborator-user.json
│   ├── partner-user.json
│   ├── observer-user.json
│   ├── client-user.json
│   └── sample-users.json     # Sample profiles for testing
│
├── _relationships/           # Relationship tracking data
│   ├── graph.json            # Relationship graph
│   └── history.json          # Relationship history
│
└── <user-slug>/              # Individual user directories
    ├── profile.json          # User profile
    ├── preferences.json      # Learned preferences
    └── history.json          # Interaction history
```

## Current Users

| Slug | Name | Type | Trust Level |
|------|------|------|-------------|
| `derek` | Derek | primary | 1.0 |
| `test-user` | Test User | primary | 0.8 |

## Adding New Users

### Via Command Line

```bash
# Create new user
node ../user-rolodex.js create --name "John Doe" --type collaborator --trust 0.7

# Link identities
node ../identity-resolution.js link john-doe --discord 123456789
node ../identity-resolution.js link john-doe --email john@example.com

# Build identity index
node ../identity-resolution.js build-index
```

### Via JavaScript

```javascript
const { UserRolodex } = require('./user-rolodex.js');
const rolodex = new UserRolodex();

const user = rolodex.createUser({
    name: "John Doe",
    type: "collaborator",
    trust: 0.7,
    timezone: "America/New_York"
});
```

## User Types

| Type | Description | Default Trust |
|------|-------------|---------------|
| `primary` | Project owner/leader | 0.9 |
| `collaborator` | Active development partner | 0.7 |
| `partner` | Strategic organization | 0.6 |
| `observer` | Passive viewer | 0.3 |
| `client` | External customer | 0.5 |
| `vendor` | Service provider | 0.4 |

## Identity Resolution

Users can be looked up by any linked identity:

- **Discord ID/Username**
- **Phone Number**
- **Email Address**
- **GitHub Username**
- **Slack ID/Username**
- **Telegram ID/Username**
- **System Username/Slug**
- **UUID**

## Documentation

- [User Management Guide](../../docs/users/USER_MANAGEMENT.md)
- [Skill Documentation](../SKILL.md)
