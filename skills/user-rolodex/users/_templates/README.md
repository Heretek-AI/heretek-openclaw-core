# User Profile Templates

This directory contains templates for different user types in the User Rolodex system.

## Template Types

| Template | Type | Trust Level | Communication Style | Use Case |
|----------|------|-------------|---------------------|----------|
| `primary-user.json` | primary | 0.9 | adaptive | Main project owner/leader |
| `collaborator-user.json` | collaborator | 0.7 | technical | Active development partner |
| `partner-user.json` | partner | 0.6 | formal | Strategic partnership organization |
| `observer-user.json` | observer | 0.3 | casual | Passive viewer, limited access |
| `client-user.json` | client | 0.5 | formal | External customer or stakeholder |

## Template Variables

Templates use the following placeholder variables:

| Variable | Description | Example |
|----------|-------------|---------|
| `{{UUID}}` | Generated UUID v4 | `550e8400-e29b-41d4-a716-446655440000` |
| `{{SLUG}}` | URL-safe identifier | `john-doe` |
| `{{USERNAME}}` | System username | `johnd` |
| `{{FULL_NAME}}` | Full display name | `John Doe` |
| `{{PREFERRED_NAME}}` | Preferred name | `John` |
| `{{PRONOUNS}}` | Pronouns (or null) | `he/him` |
| `{{TIMEZONE}}` | IANA timezone | `America/New_York` |
| `{{CREATED_AT}}` | ISO 8601 timestamp | `2026-03-31T00:00:00Z` |

## Relationship Types

### Primary
- Full access to all systems
- Highest trust level (0.9+)
- Can modify other user profiles
- Direct control over agent behavior

### Collaborator
- Development access
- Good trust level (0.6-0.8)
- Can contribute to projects
- Technical communication style

### Partner
- Strategic collaboration
- Moderate trust level (0.5-0.7)
- Limited system access
- Formal communication

### Observer
- Read-only access
- Low trust level (0.2-0.4)
- No modification rights
- Casual, brief interactions

### Client
- Project-specific access
- Standard trust level (0.4-0.6)
- Limited to assigned projects
- Formal, standard responses

## Usage

To create a new user from a template:

```bash
# Using the shell script
./user-rolodex.sh create --name "John Doe" --type collaborator

# Using the JavaScript module
node user-rolodex.js create --name "John Doe" --type collaborator --trust 0.7
```

The system automatically selects the appropriate template based on the `--type` parameter.
