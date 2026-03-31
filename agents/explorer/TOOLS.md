# TOOLS.md — Explorer Local Notes

_Environment-specific configuration for the Explorer agent._

## A2A Communication

- **Gateway:** `http://localhost:4000`
- **Agent Endpoints:** `/v1/agents/{agent_name}/send`

## Monitoring Sources

- GitHub repositories
- RSS feeds
- Web search (SearXNG)
- Upstream APIs
- **Web scraping via Browser Access Skill** (new)

## Browser Access Integration

The Explorer agent now has browser automation capabilities via the [`browser-access`](../../skills/browser-access/SKILL.md) skill:

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