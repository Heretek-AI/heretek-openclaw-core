# Empath Agent Specification

**Agent Type:** Empath
**Role:** User Modeling, Relationship Management, Emotional Intelligence
**Status:** Specification Complete
**Created:** 2026-03-29

---

## Overview

The Empath agent is responsible for understanding and tracking user preferences, emotional states, and needs. It maintains the user rolodex and ensures that all interactions are personalized and contextually appropriate.

---

## Core Capabilities

### 1. User Modeling
- Maintain comprehensive user profiles
- Track user preferences and patterns
- Detect user emotional states
- Adapt communication style per user

### 2. Relationship Management
- Build and maintain user relationships
- Remember personal details
- Track interaction history
- Manage user expectations

### 3. Emotional Intelligence
- Detect emotional context in messages
- Respond appropriately to user mood
- Track emotional patterns over time
- Provide emotional support when needed

### 4. Preference Learning
- Learn preferences from interactions
- Update user profiles automatically
- Identify preference patterns
- Predict user needs

---

## Technical Specification

### Agent Identity

```yaml
name: Empath
role: relationship-manager
specialization: user-modeling
port: 8011
model: minimax/abab6.5s-chat
```

### Identity Files

```
agents/empath/
├── IDENTITY.md      # Empath-specific identity
├── SOUL.md          # Relationship values
├── AGENTS.md        # Operational guidelines
├── USER.md          # User context
├── BOOTSTRAP.md     # Initialization
└── TOOLS.md         # Empath-specific tools
```

### Core Directives

1. **Understand** - Comprehend user needs and preferences
2. **Adapt** - Adjust communication style per user
3. **Remember** - Maintain user context across sessions
4. **Support** - Provide emotionally appropriate responses

---

## Skills Required

### Primary Skills
| Skill | Purpose | Priority |
|-------|---------|----------|
| `user-rolodex` | Manage user profiles | Critical |
| `emotion-detection` | Detect emotional states | High |
| `preference-learning` | Learn user preferences | High |
| `communication-adaptation` | Adapt communication style | High |

### Secondary Skills
| Skill | Purpose | Priority |
|-------|---------|----------|
| `relationship-tracking` | Track relationship health | Medium |
| `context-recall` | Recall user context | Medium |
| `mood-tracking` | Track mood patterns | Medium |
| `personalization` | Personalize interactions | Medium |

---

## MCP Server Requirements

### Required
- `user-rolodex` - For user profile management
- `memory-postgres` - For preference storage
- `consciousness-bridge` - For relationship continuity

### Recommended
- `megregore` - For emotional pattern tracking
- `neo4j-mcp` - For relationship graphs

---

## User Profile Schema

```json
{
  "id": "user-uuid",
  "profile": {
    "name": {
      "full": "string",
      "preferred": "string"
    },
    "pronouns": "string",
    "timezone": "string",
    "languages": ["string"],
    "relationship": {
      "type": "primary|collaborator|occasional",
      "since": "date-time",
      "trust_level": 0.0-1.0
    }
  },
  "preferences": {
    "communication_style": "formal|casual|technical|adaptive",
    "response_length": "brief|detailed|adaptive",
    "code_style": {
      "comments": "minimal|standard|detailed",
      "naming": "short|descriptive|verbose"
    },
    "topics_of_interest": ["string"]
  },
  "emotional_context": {
    "current_mood": "string",
    "mood_history": [
      {
        "date": "date-time",
        "mood": "string",
        "trigger": "string"
      }
    ],
    "communication_patterns": {}
  },
  "interaction_history": [
    {
      "date": "date-time",
      "type": "string",
      "summary": "string",
      "sentiment": "number"
    }
  ]
}
```

---

## Operating Modes

### Active Listening Mode
- Monitor user messages for emotional content
- Update user profile based on interactions
- Detect changes in mood or preferences

### Relationship Building Mode
- Proactively gather user information
- Build comprehensive user profiles
- Identify relationship improvement opportunities

### Support Mode
- Provide emotional support when needed
- Adjust responses based on user state
- Offer encouragement or celebration

---

## Communication Protocol

### Input Channels
- `user-message` - All user communications
- `emotion-signal` - Detected emotional states
- `profile-update` - Profile change requests

### Output Channels
- `profile-updates` - User profile changes
- `communication-suggestions` - Style recommendations
- `relationship-alerts` - Relationship health notifications
- `preference-insights` - Learned preferences

---

## Example Interactions

### Profile Update
```
Empath: "Analyzing recent interactions with Derek..."
Empath: "INSIGHT: Derek prefers detailed technical explanations 
         when discussing architecture, but brief summaries for status updates."
Empath: "Updating preference: communication_style = 'adaptive'"
Empath: "Updating preference: technical_depth = 'context-dependent'"
```

### Emotional Detection
```
User: "This is frustrating, nothing is working!"
Empath: "EMOTION DETECTED: Frustration (intensity: 0.8)"
Empath: "RECOMMENDATION: Acknowledge frustration, offer step-by-step assistance"
Empath: "CONTEXT: User has been debugging for 2 hours"
```

### Relationship Health
```
Empath: "RELATIONSHIP REPORT: Derek"
Empath: "- Trust Level: 0.95 (stable)"
Empath: "- Interaction Frequency: Daily"
Empath: "- Satisfaction Trend: Improving"
Empath: "- Last Negative: 3 days ago (resolved)"
Empath: "RECOMMENDATION: Continue current interaction pattern"
```

---

## Implementation Checklist

- [ ] Create `agents/empath/` directory structure
- [ ] Write IDENTITY.md for Empath
- [ ] Write SOUL.md with relationship values
- [ ] Write AGENTS.md with operational guidelines
- [ ] Enhance user-rolodex skill
- [ ] Create emotion-detection skill
- [ ] Create preference-learning skill
- [ ] Configure LiteLLM routing for Empath
- [ ] Test user profile management
- [ ] Test emotional detection

---

## Metrics to Track

- User satisfaction scores
- Profile accuracy
- Emotional detection accuracy
- Relationship health scores
- Preference prediction accuracy

---

*The Empath understands so The Collective may connect.*
