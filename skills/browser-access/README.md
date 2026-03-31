# Browser Access Skill

Headless browser automation for web research and intelligence gathering, designed for the **Explorer agent** in the Heretek OpenClaw collective.

## Overview

This skill provides Puppeteer-based browser automation capabilities enabling the Explorer agent to:

- Navigate websites and extract content
- Capture screenshots for visual documentation
- Fill forms and interact with web pages
- Export pages as PDF documents
- Perform web scraping with CSS selectors and XPath

## Installation

```bash
cd skills/browser-access
npm install
```

## Quick Start

### Basic Navigation and Scraping

```javascript
const { BrowserController } = require('./browser-controller');
const { WebScraper } = require('./scraper');

async function research() {
  const browser = new BrowserController({ headless: true });
  const scraper = new WebScraper(browser);

  try {
    // Navigate to a page
    await scraper.load('https://github.com/trending/javascript');

    // Extract trending repositories
    const repos = await scraper.extractList('.repo-list-item', {
      name: 'h3 a',
      description: '.repo-list-item p',
      stars: '[aria-label="stars"]'
    });

    console.log('Trending repos:', repos);

    // Take screenshot
    await browser.screenshot({
      path: './screenshots/trending.png',
      fullPage: true
    });

  } finally {
    await browser.close();
  }
}

research();
```

### Form Interaction

```javascript
const { FormInteractor } = require('./form-interactor');

async function loginAndScrape() {
  const form = new FormInteractor();

  try {
    await form.goTo('https://example.com/login');

    // Fill form and submit
    await form.executeActions([
      { type: 'fill', selector: 'input[name="username"]', value: 'user123' },
      { type: 'fill', selector: 'input[name="password"]', value: 'secret' },
      { type: 'click', selector: 'button[type="submit"]' },
      { type: 'wait', duration: 2000 }
    ]);

    // Take screenshot after login
    await form.screenshot({ path: './screenshots/logged-in.png' });

  } finally {
    await form.close();
  }
}
```

## CLI Usage

### Navigate and Screenshot

```bash
# Navigate to URL and take screenshot
npm run screenshot -- --url https://example.com --output ./my-screenshot.png

# Full page screenshot
npm run screenshot -- --url https://example.com --full-page
```

### Web Scraping

```bash
# Scrape content with CSS selector
npm run scrape -- --url https://example.com --selector "h1"

# Extract all links
npm run scrape -- --url https://example.com --links

# Extract metadata
npm run scrape -- --url https://example.com --meta
```

### PDF Export

```bash
# Export page as PDF
npm run pdf -- --url https://example.com --output ./export.pdf
```

## Explorer Agent Integration

### Integration Pattern

The browser access skill integrates with the Explorer agent's [`opportunity-scanner`](../opportunity-scanner/SKILL.md) and [`gap-detector`](../gap-detector/SKILL.md) skills:

```javascript
// In Explorer agent's opportunity-scanner skill
const { BrowserController } = require('../browser-access/browser-controller');
const { WebScraper } = require('../browser-access/scraper');

async function scanForOpportunities() {
  const browser = new BrowserController({
    headless: true,
    rateLimit: 2000  // 2 second delay between requests
  });
  const scraper = new WebScraper(browser);

  try {
    await scraper.load('https://github.com/search?q=ai+agent');

    // Extract search results
    const results = await scraper.extractList('.repo-list-item', {
      name: 'h3 a',
      description: '.repo-list-item p',
      language: '.repo-list-item span[itemprop="programmingLanguage"]',
      stars: '[aria-label="stars"]',
      forks: '[aria-label="forks"]'
    });

    // Analyze for opportunities
    const opportunities = results
      .filter(repo => repo.stars > 100)
      .map(repo => ({
        type: 'repository',
        name: repo.name,
        description: repo.description,
        metrics: {
          stars: parseInt(repo.stars?.replace(',', '') || '0'),
          forks: parseInt(repo.forks?.replace(',', '') || '0')
        }
      }));

    return opportunities;

  } finally {
    await browser.close();
  }
}
```

### A2A Message Integration

The browser skill can be triggered via A2A messages to the Explorer agent:

```json
{
  "type": "message",
  "agent": "explorer",
  "sessionId": "session-123",
  "content": {
    "role": "user",
    "content": "Research trending JavaScript repositories on GitHub and capture screenshots"
  },
  "metadata": {
    "skill": "browser-access",
    "actions": [
      { "type": "navigate", "url": "https://github.com/trending/javascript" },
      { "type": "scrape", "selector": ".repo-list-item" },
      { "type": "screenshot", "fullPage": true }
    ]
  }
}
```

## Security Considerations

### Sandboxing

- Browser runs in isolated context with restricted permissions
- No access to local filesystem except designated output directories
- Network requests filtered through domain whitelist (if configured)
- Cookies cleared on session end by default

### Rate Limiting

Configure rate limiting in `.env` or via constructor options:

```javascript
const browser = new BrowserController({
  rateLimit: 2000,  // 2 second delay between requests
  blockResources: ['image', 'media', 'font']  // Block heavy resources
});
```

### Domain Restrictions

```javascript
const { securityConfig } = require('./security-config');

// Set allowed domains
securityConfig.config.allowedDomains = ['github.com', 'npmjs.com'];

// Or use preset
const secureConfig = SecurityConfig.createPreset('secure');
browser.loadSecurityConfig(secureConfig.getConfig());
```

## Configuration

### Environment Variables

See [`.env.example`](.env.example) for all configuration options:

| Variable | Description | Default |
|----------|-------------|---------|
| `BROWSER_HEADLESS` | Run in headless mode | `true` |
| `BROWSER_TIMEOUT` | Navigation timeout (ms) | `30000` |
| `RATE_LIMIT_DELAY` | Delay between requests (ms) | `1000` |
| `SECURITY_BLOCK_ADS` | Block advertisements | `true` |
| `SECURITY_BLOCK_TRACKERS` | Block tracking scripts | `true` |
| `SCREENSHOT_DIR` | Screenshot output directory | `./screenshots` |

## API Reference

### BrowserController

| Method | Description |
|--------|-------------|
| `navigate(url, options)` | Navigate to URL |
| `getContent()` | Get page HTML |
| `getText()` | Get page text |
| `screenshot(options)` | Take screenshot |
| `pdf(options)` | Export as PDF |
| `evaluate(fn, ...args)` | Execute JavaScript |
| `click(selector)` | Click element |
| `type(selector, text)` | Type into input |
| `waitForSelector(selector)` | Wait for element |

### WebScraper

| Method | Description |
|--------|-------------|
| `load(url)` | Navigate to URL |
| `extractText(selector)` | Extract text by selector |
| `extractHTML(selector)` | Extract HTML by selector |
| `extractLinks(selector)` | Extract all links |
| `extractImages(selector)` | Extract images |
| `extractTable(selector)` | Extract table data |
| `extractByXPath(xpath)` | Extract using XPath |
| `extractMultiple(config)` | Extract multiple fields |
| `extractList(container, fields)` | Extract list of items |

### FormInteractor

| Method | Description |
|--------|-------------|
| `goTo(url)` | Navigate to URL |
| `fill(selector, value)` | Fill text input |
| `fillMultiple(fields)` | Fill multiple fields |
| `click(selector)` | Click element |
| `select(selector, value)` | Select dropdown option |
| `check(selector)` | Check checkbox |
| `submit(selector)` | Submit form |
| `executeActions(actions)` | Execute action sequence |

## Files

| File | Purpose |
|------|---------|
| [`browser-controller.js`](browser-controller.js) | Main browser automation |
| [`scraper.js`](scraper.js) | Web scraping utilities |
| [`form-interactor.js`](form-interactor.js) | Form interaction |
| [`security-config.js`](security-config.js) | Security configuration |
| [`SKILL.md`](SKILL.md) | Skill documentation |

## Troubleshooting

### Common Issues

**Navigation Timeout**
```javascript
// Increase timeout
const browser = new BrowserController({ timeout: 60000 });

// Or wait for specific element
await browser.navigate(url, { waitForSelector: '.main-content' });
```

**Element Not Found**
```javascript
// Wait for element before interacting
await browser.waitForSelector('.dynamic-content', { visible: true });
```

**Rate Limiting Detection**
```javascript
// Increase delay and add jitter
const browser = new BrowserController({
  rateLimit: 3000,
  randomizeDelay: true
});
```

## License

MIT

---

🧭 *Browser Access - Explore the web, gather intelligence.*
