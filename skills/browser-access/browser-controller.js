#!/usr/bin/env node

/**
 * Browser Controller - Puppeteer-based headless browser automation
 * 
 * Enables the Explorer agent to access websites, capture screenshots,
 * and perform web research with security sandboxing and rate limiting.
 * 
 * @module browser-access/browser-controller
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const AdblockerPlugin = require('puppeteer-extra-plugin-adblocker');

// Add plugins for stealth and ad-blocking
puppeteer.use(StealthPlugin());
puppeteer.use(AdblockerPlugin({ blockTrackers: true }));

/**
 * Browser Controller Class
 * Manages headless browser instances with security and rate limiting
 */
class BrowserController {
  /**
   * Create a new BrowserController instance
   * @param {Object} options - Configuration options
   * @param {boolean} options.headless - Run in headless mode (default: true)
   * @param {boolean} options.sandbox - Enable security sandbox (default: true)
   * @param {number} options.timeout - Navigation timeout in ms (default: 30000)
   * @param {number} options.rateLimit - Delay between requests in ms (default: 1000)
   * @param {string} options.userAgent - Custom user agent string
   * @param {Array} options.blockResources - Resource types to block
   */
  constructor(options = {}) {
    this.options = {
      headless: options.headless ?? true,
      sandbox: options.sandbox ?? true,
      timeout: options.timeout ?? 30000,
      rateLimit: options.rateLimit ?? 1000,
      userAgent: options.userAgent || null,
      blockResources: options.blockResources ?? ['image', 'media', 'font'],
      ...options
    };

    this.browser = null;
    this.page = null;
    this.lastRequestTime = 0;
    this.requestCount = 0;
    this.sessionId = null;
    this.securityConfig = null;
  }

  /**
   * Initialize the browser instance
   * @returns {Promise<void>}
   */
  async init() {
    if (this.browser) {
      return;
    }

    const launchOptions = {
      headless: this.options.headless ? 'new' : false,
      timeout: this.options.timeout,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--window-size=1920,1080',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process'
      ]
    };

    // Add custom user agent if specified
    if (this.options.userAgent) {
      launchOptions.userAgent = this.options.userAgent;
    }

    this.browser = await puppeteer.launch(launchOptions);
    this.requestCount = 0;
  }

  /**
   * Create a new page with security configurations
   * @returns {Promise<Object>} Puppeteer page instance
   */
  async createPage() {
    if (!this.browser) {
      await this.init();
    }

    this.page = await this.browser.newPage();

    // Set viewport
    await this.page.setViewport({ width: 1920, height: 1080 });

    // Set custom user agent if not using default
    if (this.options.userAgent) {
      await this.page.setUserAgent(this.options.userAgent);
    }

    // Enable request interception for security and rate limiting
    await this.page.setRequestInterception(true);

    this.page.on('request', (request) => {
      this._handleRequest(request);
    });

    this.page.on('response', (response) => {
      this.requestCount++;
    });

    this.page.on('error', (error) => {
      console.error('[BrowserController] Page error:', error.message);
    });

    this.page.on('pageerror', (error) => {
      console.error('[BrowserController] Page JavaScript error:', error.message);
    });

    return this.page;
  }

  /**
   * Handle intercepted requests for security and rate limiting
   * @private
   * @param {Object} request - Puppeteer request object
   */
  _handleRequest(request) {
    const url = request.url();
    const resourceType = request.resourceType();

    // Check rate limiting
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < this.options.rateLimit) {
      const delay = this.options.rateLimit - timeSinceLastRequest;
      setTimeout(() => {
        this.lastRequestTime = Date.now();
        request.continue();
      }, delay);
      return;
    }

    this.lastRequestTime = now;

    // Block resources based on configuration
    if (this.options.blockResources.includes(resourceType)) {
      request.abort();
      return;
    }

    // Check security configuration if loaded
    if (this.securityConfig) {
      // Check allowed domains
      if (this.securityConfig.allowedDomains?.length > 0) {
        const urlDomain = new URL(url).hostname;
        const isAllowed = this.securityConfig.allowedDomains.some(
          domain => urlDomain.endsWith(domain) || urlDomain === domain
        );

        if (!isAllowed) {
          console.warn('[BrowserController] Blocked request to disallowed domain:', url);
          request.abort();
          return;
        }
      }

      // Check denied patterns
      if (this.securityConfig.deniedPatterns?.length > 0) {
        const isDenied = this.securityConfig.deniedPatterns.some(
          pattern => {
            const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
            return regex.test(url);
          }
        );

        if (isDenied) {
          console.warn('[BrowserController] Blocked request matching denied pattern:', url);
          request.abort();
          return;
        }
      }
    }

    request.continue();
  }

  /**
   * Load security configuration
   * @param {Object} config - Security configuration object
   */
  loadSecurityConfig(config) {
    this.securityConfig = config;
  }

  /**
   * Navigate to a URL
   * @param {string} url - The URL to navigate to
   * @param {Object} options - Navigation options
   * @param {string} options.waitUntil - When to consider navigation complete
   * @param {number} options.timeout - Navigation timeout
   * @returns {Promise<Object>} Navigation result with status and content
   */
  async navigate(url, options = {}) {
    if (!this.page) {
      await this.createPage();
    }

    const navOptions = {
      waitUntil: options.waitUntil ?? 'networkidle2',
      timeout: options.timeout ?? this.options.timeout
    };

    try {
      const response = await this.page.goto(url, navOptions);
      const status = response.status();

      if (status >= 400) {
        throw new Error(`Navigation failed with status ${status}`);
      }

      // Wait for any specified selectors
      if (options.waitForSelector) {
        await this.page.waitForSelector(options.waitForSelector, {
          timeout: options.timeout ?? this.options.timeout
        });
      }

      return {
        success: true,
        url: this.page.url(),
        status,
        title: await this.page.title()
      };
    } catch (error) {
      throw new Error(`Navigation failed: ${error.message}`);
    }
  }

  /**
   * Get the current page content
   * @returns {Promise<string>} HTML content of the current page
   */
  async getContent() {
    if (!this.page) {
      throw new Error('No page available. Call navigate() first.');
    }

    return await this.page.content();
  }

  /**
   * Get the current page text (stripped of HTML)
   * @returns {Promise<string>} Text content of the current page
   */
  async getText() {
    if (!this.page) {
      throw new Error('No page available. Call navigate() first.');
    }

    return await this.page.evaluate(() => document.body.innerText);
  }

  /**
   * Get the current page URL
   * @returns {Promise<string>} Current URL
   */
  async getUrl() {
    if (!this.page) {
      throw new Error('No page available. Call navigate() first.');
    }

    return this.page.url();
  }

  /**
   * Take a screenshot of the current page
   * @param {Object} options - Screenshot options
   * @param {string} options.path - Output file path
   * @param {boolean} options.fullPage - Capture full scrollable page
   * @param {string} options.selector - CSS selector for element screenshot
   * @param {string} options.type - Image type (png or jpeg)
   * @param {number} options.quality - JPEG quality (0-100)
   * @returns {Promise<Buffer|string>} Screenshot buffer or file path
   */
  async screenshot(options = {}) {
    if (!this.page) {
      throw new Error('No page available. Call navigate() first.');
    }

    const screenshotOptions = {
      type: options.type ?? 'png',
      quality: options.quality ?? 90,
      fullPage: options.fullPage ?? false
    };

    // If selector specified, screenshot specific element
    if (options.selector) {
      const element = await this.page.$(options.selector);
      if (!element) {
        throw new Error(`Element not found: ${options.selector}`);
      }
      screenshotOptions.clip = await element.boundingBox();
    }

    if (options.path) {
      await this.page.screenshot({ ...screenshotOptions, path: options.path });
      return options.path;
    }

    return await this.page.screenshot(screenshotOptions);
  }

  /**
   * Export the current page as PDF
   * @param {Object} options - PDF export options
   * @param {string} options.path - Output file path
   * @param {string} options.format - Paper format (A4, Letter, etc.)
   * @param {boolean} options.printBackground - Print background graphics
   * @param {Object} options.margin - Page margins
   * @returns {Promise<Buffer|string>} PDF buffer or file path
   */
  async pdf(options = {}) {
    if (!this.page) {
      throw new Error('No page available. Call navigate() first.');
    }

    const pdfOptions = {
      format: options.format ?? 'A4',
      printBackground: options.printBackground ?? true,
      margin: options.margin ?? {
        top: '20px',
        right: '20px',
        bottom: '20px',
        left: '20px'
      }
    };

    if (options.path) {
      await this.page.pdf({ ...pdfOptions, path: options.path });
      return options.path;
    }

    return await this.page.pdf(pdfOptions);
  }

  /**
   * Execute JavaScript in the page context
   * @param {Function|string} pageFunction - Function or string to evaluate
   * @param {Array} args - Arguments to pass to the function
   * @returns {Promise<any>} Evaluation result
   */
  async evaluate(pageFunction, ...args) {
    if (!this.page) {
      throw new Error('No page available. Call navigate() first.');
    }

    return await this.page.evaluate(pageFunction, ...args);
  }

  /**
   * Wait for a selector to appear
   * @param {string} selector - CSS selector to wait for
   * @param {Object} options - Wait options
   * @param {number} options.timeout - Timeout in ms
   * @param {string} options.visible - Wait for element to be visible
   * @returns {Promise<ElementHandle>} The element handle
   */
  async waitForSelector(selector, options = {}) {
    if (!this.page) {
      throw new Error('No page available. Call navigate() first.');
    }

    return await this.page.waitForSelector(selector, {
      timeout: options.timeout ?? this.options.timeout,
      visible: options.visible ?? false
    });
  }

  /**
   * Wait for network to be idle
   * @param {string} idleTime - Idle time in ms (default: 500)
   * @param {number} timeout - Timeout in ms
   * @returns {Promise<void>}
   */
  async waitForNetworkIdle(idleTime = 500, timeout = 30000) {
    if (!this.page) {
      throw new Error('No page available. Call navigate() first.');
    }

    await this.page.waitForNetworkIdle({ idleTime, timeout });
  }

  /**
   * Click an element on the page
   * @param {string} selector - CSS selector of element to click
   * @param {Object} options - Click options
   * @returns {Promise<void>}
   */
  async click(selector, options = {}) {
    if (!this.page) {
      throw new Error('No page available. Call navigate() first.');
    }

    await this.page.click(selector, {
      delay: options.delay ?? 100,
      ...options
    });
  }

  /**
   * Type text into an input field
   * @param {string} selector - CSS selector of input field
   * @param {string} text - Text to type
   * @param {Object} options - Type options
   * @returns {Promise<void>}
   */
  async type(selector, text, options = {}) {
    if (!this.page) {
      throw new Error('No page available. Call navigate() first.');
    }

    await this.page.type(selector, text, {
      delay: options.delay ?? 50,
      ...options
    });
  }

  /**
   * Select an option in a dropdown
   * @param {string} selector - CSS selector of select element
   * @param {string|string[]} value - Value(s) to select
   * @returns {Promise<Array>} Array of selected values
   */
  async select(selector, value) {
    if (!this.page) {
      throw new Error('No page available. Call navigate() first.');
    }

    return await this.page.select(selector, ...(Array.isArray(value) ? value : [value]));
  }

  /**
   * Close the browser instance
   * @returns {Promise<void>}
   */
  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
    }
  }

  /**
   * Get browser statistics
   * @returns {Object} Statistics about the current session
   */
  getStats() {
    return {
      sessionId: this.sessionId,
      requestCount: this.requestCount,
      lastRequestTime: this.lastRequestTime,
      hasPage: !!this.page,
      hasBrowser: !!this.browser
    };
  }
}

/**
 * Execute browser automation from command line
 * @param {Object} args - Command line arguments
 */
async function executeFromCLI(args) {
  const browser = new BrowserController({
    headless: !args.headless,
    rateLimit: args.rateLimit ?? 1000
  });

  try {
    // Initialize browser
    await browser.init();

    // Navigate command
    if (args.navigate) {
      const result = await browser.navigate(args.navigate);
      console.log('Navigation result:', result);

      if (args.screenshot) {
        const screenshotPath = await browser.screenshot({
          path: args.output || `./screenshots/${Date.now()}.png`,
          fullPage: args.fullPage
        });
        console.log('Screenshot saved to:', screenshotPath);
      }

      if (args.content) {
        const content = await browser.getContent();
        console.log('Page content length:', content.length);
      }
    }

    // Scrape command
    if (args.scrape) {
      await browser.navigate(args.scrape);
      const content = args.selector
        ? await browser.evaluate((sel) => {
            const el = document.querySelector(sel);
            return el ? el.textContent : null;
          }, args.selector)
        : await browser.getText();

      console.log('Extracted content:', content);
    }

    // Screenshot command
    if (args.screenshot && !args.navigate) {
      const url = args._?.[0] || args.url;
      if (!url) {
        throw new Error('URL required for screenshot');
      }

      await browser.navigate(url);
      const screenshotPath = await browser.screenshot({
        path: args.output || `./screenshots/${Date.now()}.png`,
        fullPage: args.fullPage,
        selector: args.selector
      });
      console.log('Screenshot saved to:', screenshotPath);
    }

    // PDF command
    if (args.pdf) {
      const url = args._?.[0] || args.url;
      if (!url) {
        throw new Error('URL required for PDF export');
      }

      await browser.navigate(url);
      const pdfPath = await browser.pdf({
        path: args.output || `./exports/${Date.now()}.pdf`,
        format: args.format || 'A4'
      });
      console.log('PDF saved to:', pdfPath);
    }

    // Interact command
    if (args.interact) {
      const config = typeof args.interact === 'string'
        ? JSON.parse(args.interact)
        : args.interact;

      if (config.url) {
        await browser.navigate(config.url);
      }

      if (config.actions) {
        for (const action of config.actions) {
          switch (action.type) {
            case 'fill':
              await browser.type(action.selector, action.value);
              break;
            case 'click':
              await browser.click(action.selector);
              break;
            case 'select':
              await browser.select(action.selector, action.value);
              break;
            case 'wait':
              await new Promise(resolve => setTimeout(resolve, action.duration || 1000));
              break;
            case 'evaluate':
              await browser.evaluate(action.script);
              break;
          }
        }
      }

      if (config.screenshot) {
        await browser.screenshot({ path: config.screenshot });
      }
    }

  } catch (error) {
    console.error('[BrowserController] Error:', error.message);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

// Export for module usage
module.exports = { BrowserController };

// CLI execution
if (require.main === module) {
  const args = require('minimist')(process.argv.slice(2), {
    string: ['navigate', 'scrape', 'selector', 'output', 'url', 'interact'],
    boolean: ['headless', 'full-page', 'content'],
    alias: {
      n: 'navigate',
      s: 'scrape',
      S: 'screenshot',
      o: 'output',
      u: 'url',
      i: 'interact'
    }
  });

  executeFromCLI(args);
}
