---
name: user-context-resolve
description: Resolve user identity from discord ID, phone number, or username. Returns full user context for agent personalization.
version: 1.0.0
author: Heretek OpenClaw Collective
---

# User Context Resolution

Resolves user identity across multiple platforms and returns unified context for agent personalization.

## Overview

This skill provides a unified way to resolve user identity from various platform identifiers:
- Discord ID (snowflake)
- Phone number (E.164 format)
- Username (case-insensitive)
- UUID (canonical identifier)

## Usage

### Resolve by Discord ID
```bash
node skills/user-context-resolve/resolve.js --discord-id=123456789
```

### Resolve by Phone Number
```bash
node skills/user-context-resolve/resolve.js --phone="+15551234567"
```

### Resolve by Username
```bash
node skills/user-context-resolve/resolve.js --username="johndoe"
```

### Resolve by UUID
```bash
node skills/user-context-resolve/resolve.js --uuid="550e8400-e29b-41d4-a716-446655440000"
```

### Resolve by Email
```bash
node skills/user-context-resolve/resolve.js --email="user@example.com"
```

## Output

Returns JSON with:

```json
{
  "success": true,
  "user": {
    "uuid": "550e8400-e29b-41d4-a716-446655440000",
    "username": "johndoe",
    "name": {
      "full": "John Doe",
      "preferred": "John"
    },
    "platforms": {
      "discord": { "id": "123456789", "username": "johndoe" },
      "phone": { "number": "+15551234567", "verified": true }
    },
    "preferences": {
      "communicationStyle": "adaptive",
      "preferredAgents": ["alpha", "coder"]
    },
    "timezone": "America/New_York"
  }
}
```

### Error Response

```json
{
  "error": "User not found",
  "params": { "username": "nonexistent" }
}
```

## Integration

Agents should call this skill at session start to personalize interactions:

```javascript
// In agent initialization
const userResult = await resolveUser({ discordId: message.author.id });
if (userResult.success) {
  const user = userResult.user;
  // Personalize responses based on user preferences
  const style = user.preferences?.communicationStyle || 'adaptive';
}
```

## Files

- `resolve.js` - Main resolution script
- `lib/indexer.js` - Index management utilities
- `lib/validator.js` - Input validation utilities

## Index Structure

The user index (`users/index.json`) maintains lookup maps for fast resolution:

```json
{
  "version": "2.0",
  "users": ["derek"],
  "byDiscord": {
    "123456789": "derek"
  },
  "byPhone": {
    "15551234567": "derek"
  },
  "byUsername": {
    "derek": "derek",
    "dereksmith": "derek"
  },
  "byUuid": {
    "550e8400-e29b-41d4-a716-446655440000": "derek"
  },
  "byEmail": {
    "derek@example.com": "derek"
  }
}
```

## Adding New Users

When creating a new user profile, ensure:
1. Generate a valid UUID v4
2. Add all platform identifiers to the profile
3. Update the index with all lookup mappings

## Error Handling

| Error | Description |
|-------|-------------|
| `User not found` | No user matches the provided identifier |
| `User profile not found` | Index points to non-existent profile file |
| `Invalid identifier` | Malformed identifier (e.g., invalid UUID format) |
| `No identifier provided` | No resolution parameter was specified |

## Dependencies

- Node.js >= 14.0.0 (uses built-in modules only)
- No external dependencies required
