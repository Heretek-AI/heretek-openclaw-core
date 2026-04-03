# Adapters — Heretek OpenClaw Core

Adapter layer for connecting legacy Heretek modules to the npm OpenClaw gateway.

## Architecture

```
Heretek Modules
    │
    ├── acp-adapter.js          ← WS + HMAC auth for npm gateway
    ├── bft-consensus-adapter.js ← BFT consensus → npm gateway bridge
    └── [future adapters]
             │
             ▼
    npm OpenClaw Gateway (port 18789)
    ACP over WebSocket + Redis pub/sub
```

## Adapters

### `acp-adapter.js` ✅ Active

Primary adapter for connecting to the npm OpenClaw gateway.

```javascript
const { ACPAdapter } = require('./acp-adapter');

// Connect to npm gateway (handles HMAC nonce auth)
const adapter = await ACPAdapter.connect({
    agentId: 'alpha',
    token: process.env.OPENCLAW_GATEWAY_TOKEN,
    gatewayUrl: 'ws://localhost:18789/a2a'
});

// Send messages
await adapter.sendMessage('beta', 'Hello Beta');
await adapter.broadcast({ type: 'alert', content: 'Phase 3 starting' });

// Listen
adapter.on('message', (msg) => console.log(`${msg.from}: ${msg.content}`));

await adapter.close();
```

**Also includes:** `LiteLLMGatewayAdapter` — REST adapter for LiteLLM proxy (used by some legacy skills).

### `bft-consensus-adapter.js` ✅ Active

Bridges BFT consensus events to npm gateway ACP broadcast.

```javascript
const { BFTConsensusAdapter } = require('./bft-consensus-adapter');

const bft = new BFTConsensusAdapter({ nodeId: 'alpha' });
await bft.connect();
await bft.connectACP({ agentId: 'alpha' });

bft.onCommitted = (result) => {
    console.log('Consensus reached!', result);
};

await bft.propose({ action: 'approve_phase_3', reason: '...' });
```

## For Module Writers

If your module needs to send/receive messages from other agents via the npm gateway:

```javascript
// Option 1: Direct Redis (simplest, always works)
// Uses openclaw:a2a: prefix — npm gateway reads this too
const Redis = require('ioredis');
const client = new Redis('redis://localhost:6379');
await client.lpush('openclaw:a2a:inbox:alpha', JSON.stringify(msg));

// Option 2: ACP adapter (real-time, requires HMAC auth)
// See acp-adapter.js
const { ACPAdapter } = require('./modules/adapters/acp-adapter');
const adapter = await ACPAdapter.connect({ agentId: '...', token: '...' });
await adapter.sendMessage('alpha', 'urgent!');
```

## Compatibility Notes

- Redis prefix `openclaw:a2a:` — shared with npm gateway, **no migration needed**
- Redis prefix `heretek:event:` — Heretek-only, does not conflict
- ACP adapter uses bundled `@agentclientprotocol/sdk` from npm openclaw package
- HMAC auth: nonce is signed with gateway token from `openclaw.json` → `gateway.auth.token`
