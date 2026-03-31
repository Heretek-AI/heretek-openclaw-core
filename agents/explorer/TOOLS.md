# TOOLS.md — Explorer Local Notes

_Environment-specific configuration for the Explorer agent._

## A2A Communication

### Gateway WebSocket RPC

- **Gateway Endpoint:** `ws://127.0.0.1:18789`
- **WebSocket Subprotocol:** `a2a-v1`
- **Message Format:** A2A Protocol v1.0.0

### Connection Example

```javascript
const WebSocket = require('ws');

const ws = new WebSocket('ws://127.0.0.1:18789', ['a2a-v1']);

ws.on('open', () => {
  // Send handshake
  ws.send(JSON.stringify({
    type: 'handshake',
    content: {
      action: 'advertise',
      capabilities: {
        supportedMessageTypes: ['message', 'status', 'error', 'request', 'response'],
        version: '1.0.0'
      }
    }
  }));
});
```

### Message Types Used

| Type | Code | Purpose |
|------|------|---------|
| `message` | 0x01 | Send/receive agent messages |
| `status` | 0x02 | Broadcast status updates |
| `request` | 0x33 | Request data from other agents |
| `response` | 0x34 | Respond to data requests |
| `broadcast` | 0x35 | Share discoveries with collective |

### LiteLLM Integration (Model Routing Only)

- **LiteLLM Gateway:** `http://localhost:4000`
- **Agent Passthrough Endpoint:** `/v1/agents/explorer/send`
- **Health Check:** `/health`

**Note:** LiteLLM is used for model routing only, NOT for A2A communication.

## Monitoring Sources

- GitHub repositories
- RSS feeds
- Web search (SearXNG)
- Upstream APIs
- **Web scraping via Browser Access Skill** (new)

## Browser Access Integration

The Explorer agent has browser automation capabilities via the [`browser-access`](../../skills/browser-access/SKILL.md) skill:

### Capabilities

- **Web Navigation:** Access any URL with security sandboxing
- **Content Extraction:** Scrape data using CSS selectors, XPath, or custom JavaScript
- **Screenshots:** Capture full-page or element-level screenshots
- **PDF Export:** Save pages as PDF documents
- **Form Interaction:** Fill forms, click buttons, select options

### Usage Pattern

```javascript
const { BrowserController } = require('../../skills/browser-access/browser-controller');
const { WebScraper } = require('../../skills/browser-access/scraper');

async function researchTopic(topic) {
  const browser = new BrowserController({
    headless: true,
    rateLimit: 2000,  // Be respectful to target sites
    blockResources: ['image', 'media', 'font']
  });
  const scraper = new WebScraper(browser);

  try {
    await scraper.load(`https://github.com/search?q=${encodeURIComponent(topic)}`);
    
    const results = await scraper.extractList('.repo-list-item', {
      name: 'h3 a',
      description: '.repo-list-item p',
      stars: '[aria-label="stars"]'
    });

    // Document findings with screenshot
    await browser.screenshot({
      path: `./skills/browser-access/screenshots/${topic}-${Date.now()}.png`,
      fullPage: true
    });

    return results;
  } finally {
    await browser.close();
  }
}
```

### Security Guidelines

- Always use rate limiting (minimum 1000ms delay)
- Respect robots.txt and site terms of service
- Use domain whitelisting for production use
- Clear sessions after sensitive operations
- Block unnecessary resources (images, fonts, media)

### Configuration

See [`skills/browser-access/.env.example`](../../skills/browser-access/.env.example) for configuration options.

## Scan Intervals

- Standard scan: Every 5 minutes
- Deep scan: Every hour

---

🧭

*Explorer — Scout*
