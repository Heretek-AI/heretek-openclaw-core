# Heretek Provider Abstraction Layer

Unified LLM provider interface with **triad-aware routing**, **consensus-based failover**, and **cost optimization** across 17+ providers.

## Features

- 🔄 **Triad-Aware Routing** - Provider selection influenced by triad consensus
- 🚨 **Automatic Failover** - Seamless fallback with triad notification
- 💰 **Cost Optimization** - Track and optimize costs across providers
- 🔌 **17+ Providers** - Support for Ollama, Anthropic, OpenAI, Google, Groq, and more
- 📊 **Metrics Tracking** - Redis-backed latency, success rate, cost analytics

## Installation

```bash
cd heretek-openclaw-core/modules/provider-abstraction
npm install
```

## Quick Start

```javascript
const { HeretekProviderRouter } = require('./modules/provider-abstraction');

// Create router instance
const router = new HeretekProviderRouter({
  redisUrl: 'redis://localhost:6379'
});

// Route a request (auto-selects best provider)
const response = await router.route({
  model: 'claude-3-5-sonnet',
  messages: [{ role: 'user', content: 'Hello!' }]
}, { sessionId: 'triad-session-123' });

console.log(response.choices[0].message.content);
```

## Triad Integration

### Set Provider Preference (Requires Consensus)

```javascript
await router.setTriadPreference('session-123', 'anthropic', {
  approved: true,
  votes: { alpha: 'anthropic', beta: 'anthropic', charlie: 'openai' }, // 2/3 consensus
  triad: 'deliberation-round-456'
});
```

### Automatic Failover Notification

When preferred provider fails, triad is notified via Redis pub/sub:

```javascript
redis.subscribe('triad:notifications', (message) => {
  const { type, originalProvider, sessionId } = JSON.parse(message);
  if (type === 'provider_failover') {
    console.log(`Failover from ${originalProvider} in session ${sessionId}`);
  }
});
```

## Available Connectors

| Provider | Connector | Models | Status |
|----------|-----------|--------|--------|
| **Anthropic** | `AnthropicConnector` | Claude 3.5 Sonnet, Opus, Haiku | ✅ |
| **OpenAI** | `OpenAIConnector` | GPT-4o, GPT-4o Mini, o1 | ✅ |
| **Ollama** | Built-in | Local models | ✅ |
| **Google** | _Coming soon_ | Gemini Pro, Ultra | ⏳ |
| **Groq** | _Coming soon_ | Llama, Mixtral | ⏳ |

## Configuration

### Environment Variables

```bash
# API Keys
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
GOOGLE_API_KEY=...
GROQ_API_KEY=gsk_...

# Redis (optional, defaults to localhost)
REDIS_URL=redis://localhost:6379
```

### Provider Registration

```javascript
router.providers.set('google', {
  id: 'google',
  baseUrl: 'https://generativelanguage.googleapis.com',
  type: 'cloud',
  status: 'available'
});
```

## Cost Tracking

Automatic cost estimation for all requests:

```javascript
const connector = new AnthropicConnector();
const cost = connector.estimateCost(1000, 500, 'claude-3-5-sonnet-20241022');
// { input: 0.003, output: 0.0075, total: 0.0105 } USD
```

## Metrics

Provider metrics tracked in Redis:

```bash
# Today's metrics for Anthropic
HGETALL metrics:provider:anthropic:2026-04-01
# → successes: 142, failures: 3, total_latency: 45230
```

## Architecture

```
┌─────────────┐
│   Request   │
└──────┬──────┘
       │
       ▼
┌─────────────────────┐
│ Triad Preference?   │ ──Yes──► Use Preferred
└─────────────────────┘          │
       │ No                      ▼
       ▼                  ┌──────────────┐
┌─────────────────┐       │   Dispatch   │
│ Select Best     │──────►│   Request    │
│ Available       │       └──────────────┘
└─────────────────┘                │
       │                           ▼
       │                    ┌──────────────┐
       └────On Failure─────►│ Notify Triad │
                            │   Failover   │
                            └──────────────┘
```

## Error Handling

All connectors implement standardized error handling:

- **401** → Invalid API key
- **429** → Rate limit exceeded
- **500** → Provider internal error
- **Timeout** → 60s default, configurable

## Testing

```bash
npm test
```

## License

MIT - Part of Heretek OpenClaw Core
