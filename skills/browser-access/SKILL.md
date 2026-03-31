---
name: browser-access
description: Headless browser automation for web research and intelligence gathering. Enables the Explorer agent to access websites, extract content, capture screenshots, and interact with web forms.
---

# Browser Access Skill

**Purpose:** Enable headless browser automation for web research and intelligence gathering, allowing the Explorer agent to access websites, extract content, capture screenshots, and interact with web forms.

**Status:** 🟡 In Development

**Location:** `skills/browser-access/`

**Implementation:** [`browser-controller.js`](browser-controller.js), [`scraper.js`](scraper.js)

---

## Features

- **Headless Browser Automation:** Puppeteer-based Chrome/Chromium control
- **Web Scraping:** Content extraction with CSS selectors and XPath
- **Screenshot Capture:** Full page and element-level screenshots
- **Form Interaction:** Fill forms, click buttons, navigate pages
- **Security Sandboxing:** Isolated browser context with restricted permissions
- **Rate Limiting:** Configurable request throttling to avoid detection
- **Session Management:** Persistent and ephemeral browsing sessions
- **PDF Export:** Save pages as PDF documents
- **Navigation Control:** Wait for selectors, network idle, custom conditions

---

## Commands

| Command | Description | Example |
|---------|-------------|---------|
| `navigate` | Navigate to URL | `node browser-controller.js --navigate https://example.com` |
| `scrape` | Extract content from URL | `node browser-controller.js --scrape https://example.com` |
| `screenshot` | Capture screenshot | `node browser-controller.js --screenshot https://example.com` |
| `pdf` | Export page as PDF | `node browser-controller.js --pdf https://example.com` |
| `interact` | Perform interactions | `node browser-controller.js --interact` (JSON config) |
| `session` | Manage browsing sessions | `node browser-controller.js --session list` |

---

## API Methods

### Browser Controller

```javascript
const browser = new BrowserController({
  headless: true,
  sandbox: true,
  rateLimit: 1000,  // ms between requests
  timeout: 30000
});

// Navigate to URL
await browser.navigate('https://example.com');

// Get page content
const content = await browser.getContent();

// Take screenshot
await browser.screenshot({ path: './screenshots/example.png', fullPage: true });

// Export PDF
await browser.pdf({ path: './exports/example.pdf' });

// Close browser
await browser.close();
```

### Web Scraper

```javascript
const scraper = new WebScraper(browser);

// Extract text by CSS selector
const title = await scraper.extractText('h1');

// Extract HTML by CSS selector
const mainContent = await scraper.extractHTML('.main-content');

// Extract links
const links = await scraper.extractLinks('a');

// Extract with XPath
const items = await scraper.extractByXPath('//div[@class="item"]');

// Execute custom evaluation
const data = await scraper.evaluate(() => {
  return document.querySelectorAll('.item').length;
});
```

### Form Interaction

```javascript
const form = new FormInteractor(browser);

// Fill text input
await form.fill('input[name="username"]', 'john_doe');

// Fill multiple fields
await form.fillMultiple([
  { selector: 'input[name="email"]', value: 'john@example.com' },
  { selector: 'input[name="password"]', value: 'secret123' }
]);

// Click element
await form.click('button[type="submit"]');

// Select dropdown option
await form.select('select[name="country"]', 'US');

// Check checkbox
await form.check('input[name="terms"]');

// Submit form
await form.submit('form#login-form');
```

### Session Management

```javascript
const sessions = new SessionManager();

// Create new session
const sessionId = await sessions.create({ persistent: true });

// Get session
const session = await sessions.get(sessionId);

// List all sessions
const allSessions = await sessions.list();

// Close session
await sessions.close(sessionId);

// Clear all sessions
await sessions.clear();
```

---

## Configuration

### Environment Variables

```bash
# Browser Configuration
BROWSER_HEADLESS=true                    # Run in headless mode
BROWSER_SANDBOX=true                     # Enable security sandbox
BROWSER_TIMEOUT=30000                    # Navigation timeout (ms)
BROWSER_USER_AGENT=                      # Custom user agent (optional)

# Rate Limiting
RATE_LIMIT_DELAY=1000                    # Delay between requests (ms)
RATE_LIMIT_MAX_REQUESTS=100              # Max requests per session
RATE_LIMIT_RANDOMIZE=true                # Add random jitter

# Security
SECURITY_BLOCK_ADS=true                  # Block advertisements
SECURITY_BLOCK_TRACKERS=true             # Block tracking scripts
SECURITY_ALLOWED_DOMAINS=                # Comma-separated allowed domains
SECURITY_DENIED_PATTERNS=                # Comma-separated denied URL patterns

# Storage
SCREENSHOT_DIR="./skills/browser-access/screenshots"
PDF_DIR="./skills/browser-access/exports"
SESSION_DIR="./skills/browser-access/sessions"
```

### Security Configuration

```javascript
const securityConfig = {
  // Domain restrictions
  allowedDomains: ['github.com', 'npmjs.com', 'example.com'],
  
  // URL patterns to block
  deniedPatterns: [
    /.*\.exe$/,
    /.*malware.*/,
    /.*phishing.*/
  ],
  
  // Resource blocking
  blockResources: [
    'image',      // Block images
    'media',      // Block audio/video
    'font',       // Block fonts
    'stylesheet'  // Block CSS (optional)
  ],
  
  // Cookie handling
  acceptCookies: false,
  clearCookiesOnClose: true,
  
  // JavaScript execution
  allowJavaScript: true,
  sandboxJavaScript: true  // Restricted JS context
};
```

---

## Usage Examples

### Basic Web Scraping

```bash
# Scrape content from a URL
node browser-controller.js --scrape https://github.com/trending

# Scrape with CSS selector
node browser-controller.js --scrape https://example.com --selector ".main-content"

# Extract all links
node browser-controller.js --scrape https://example.com --extract links
```

### Screenshot Capture

```bash
# Full page screenshot
node browser-controller.js --screenshot https://example.com --full-page

# Element screenshot
node browser-controller.js --screenshot https://example.com --selector "#hero"

# Custom output path
node browser-controller.js --screenshot https://example.com --output ./my-screenshot.png
```

### Form Interaction

```bash
# Interactive form filling (JSON config)
node browser-controller.js --interact << EOF
{
  "url": "https://example.com/login",
  "actions": [
    { "type": "fill", "selector": "input[name=username]", "value": "user" },
    { "type": "fill", "selector": "input[name=password]", "value": "pass" },
    { "type": "click", "selector": "button[type=submit]" }
  ]
}
EOF
```

### PDF Export

```bash
# Export page as PDF
node browser-controller.js --pdf https://example.com

# Custom PDF options
node browser-controller.js --pdf https://example.com --options '{"format": "A4", "printBackground": true}'
```

---

## Integration with Explorer Agent

The browser access skill integrates with the Explorer agent for autonomous web research:

```javascript
// Explorer agent usage pattern
const explorer = new ExplorerAgent();
const browser = new BrowserController();

// Research task
async function researchTopic(topic) {
  // Search for information
  await browser.navigate(`https://github.com/search?q=${encodeURIComponent(topic)}`);
  
  // Extract relevant repositories
  const repos = await scraper.extractMultiple([
    { name: 'title', selector: '.repo-list-item h3 a' },
    { name: 'description', selector: '.repo-list-item p' },
    { name: 'stars', selector: '.stars' }
  ]);
  
  // Take screenshot for documentation
  await browser.screenshot({
    path: `./research/${topic}-${Date.now()}.png`
  });
  
  return repos;
}
```

### Explorer Agent Commands

```javascript
// In Explorer agent's opportunity-scanner skill
const browserSkill = require('../browser-access/browser-controller');

// Scan for new projects
async function scanGitHub() {
  const results = await browserSkill.execute({
    command: 'scrape',
    url: 'https://github.com/trending/javascript',
    extract: {
      repositories: {
        selector: '.repo-list-item',
        fields: [
          { name: 'name', selector: 'h3 a' },
          { name: 'description', selector: 'p' },
          { name: 'stars', selector: '[aria-label="stars"]' }
        ]
      }
    }
  });
  
  return results.repositories;
}
```

---

## Security Considerations

### Sandboxing

- Browser runs in isolated context with restricted permissions
- No access to local filesystem except designated output directories
- Network requests filtered through domain whitelist
- Cookies cleared on session end

### Rate Limiting

- Configurable delay between requests (default: 1000ms)
- Maximum requests per session (default: 100)
- Random jitter added to avoid detection patterns
- Automatic backoff on rate limit detection

### Content Security

- JavaScript execution can be disabled for untrusted sites
- Resource blocking for ads, trackers, and unnecessary content
- URL pattern matching to block malicious sites
- Screenshot and PDF output sanitization

---

## Error Handling

```javascript
try {
  await browser.navigate('https://example.com');
} catch (error) {
  if (error.name === 'TimeoutError') {
    // Navigation timeout - retry or report
  } else if (error.name === 'NavigationError') {
    // Invalid URL or blocked domain
  } else if (error.name === 'RateLimitError') {
    // Too many requests - wait and retry
  }
}
```

---

## Performance Optimization

- **Request Interception:** Block unnecessary resources (images, fonts, CSS)
- **Connection Reuse:** Keep browser instance alive for multiple operations
- **Lazy Loading:** Wait for content to load before extraction
- **Concurrent Tabs:** Multiple pages in same browser instance
- **Memory Management:** Automatic cleanup of closed sessions

---

## Dependencies

- `puppeteer` - Headless Chrome/Chromium control
- `puppeteer-extra` - Extended Puppeteer with plugins
- `puppeteer-extra-plugin-stealth` - Avoid bot detection
- `puppeteer-extra-plugin-adblocker` - Block ads and trackers

---

## Files

| File | Purpose |
|------|---------|
| [`browser-controller.js`](browser-controller.js) | Main browser automation controller |
| [`scraper.js`](scraper.js) | Web scraping utilities |
| [`form-interactor.js`](form-interactor.js) | Form filling and interaction |
| [`session-manager.js`](session-manager.js) | Browsing session management |
| [`security-config.js`](security-config.js) | Security and rate limiting configuration |
| `screenshots/` | Screenshot output directory |
| `exports/` | PDF export directory |
| `sessions/` | Session storage directory |

---

*Browser Access - Explore the web, gather intelligence.*
