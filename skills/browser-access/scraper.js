#!/usr/bin/env node

/**
 * Web Scraper - Content extraction utilities for browser automation
 * 
 * Provides CSS selector, XPath, and custom extraction methods
 * for structured data extraction from web pages.
 * 
 * @module browser-access/scraper
 */

const { BrowserController } = require('./browser-controller');

/**
 * Web Scraper Class
 * Provides structured content extraction capabilities
 */
class WebScraper {
  /**
   * Create a new WebScraper instance
   * @param {BrowserController} browser - BrowserController instance to use
   */
  constructor(browser) {
    this.browser = browser instanceof BrowserController 
      ? browser 
      : new BrowserController();
  }

  /**
   * Initialize the browser if not already initialized
   * @returns {Promise<void>}
   */
  async init() {
    await this.browser.init();
  }

  /**
   * Navigate to a URL and prepare for scraping
   * @param {string} url - The URL to navigate to
   * @param {Object} options - Navigation options
   * @returns {Promise<this>}
   */
  async load(url, options = {}) {
    await this.init();
    await this.browser.navigate(url, options);
    return this;
  }

  /**
   * Extract text content by CSS selector
   * @param {string} selector - CSS selector
   * @param {Object} options - Extraction options
   * @param {boolean} options.trim - Trim whitespace (default: true)
   * @param {boolean} options.all - Get all matches as array (default: false)
   * @returns {Promise<string|string[]|null>} Extracted text content
   */
  async extractText(selector, options = {}) {
    return await this.browser.evaluate((sel, opts) => {
      const elements = document.querySelectorAll(sel);
      if (!elements || elements.length === 0) {
        return null;
      }

      const getText = (el) => {
        const text = el.textContent || '';
        return opts.trim !== false ? text.trim() : text;
      };

      if (opts.all) {
        return Array.from(elements).map(getText);
      }

      return getText(elements[0]);
    }, selector, options);
  }

  /**
   * Extract HTML content by CSS selector
   * @param {string} selector - CSS selector
   * @param {Object} options - Extraction options
   * @param {boolean} options.all - Get all matches as array (default: false)
   * @param {string} options.attribute - Extract specific attribute instead of HTML
   * @returns {Promise<string|string[]|null>} Extracted HTML content
   */
  async extractHTML(selector, options = {}) {
    return await this.browser.evaluate((sel, opts) => {
      const elements = document.querySelectorAll(sel);
      if (!elements || elements.length === 0) {
        return null;
      }

      if (opts.attribute) {
        if (opts.all) {
          return Array.from(elements).map(el => el.getAttribute(opts.attribute));
        }
        return elements[0].getAttribute(opts.attribute);
      }

      if (opts.all) {
        return Array.from(elements).map(el => el.innerHTML);
      }

      return elements[0].innerHTML;
    }, selector, options);
  }

  /**
   * Extract all links from the page or a specific selector
   * @param {string} selector - CSS selector for link container (optional)
   * @returns {Promise<Array>} Array of link objects with href and text
   */
  async extractLinks(selector = 'a') {
    return await this.browser.evaluate((sel) => {
      const elements = document.querySelectorAll(sel);
      return Array.from(elements).map(el => ({
        href: el.href,
        text: (el.textContent || '').trim(),
        title: el.title || null,
        target: el.target || null
      }));
    }, selector);
  }

  /**
   * Extract images from the page
   * @param {string} selector - CSS selector for images (default: 'img')
   * @returns {Promise<Array>} Array of image objects
   */
  async extractImages(selector = 'img') {
    return await this.browser.evaluate((sel) => {
      const elements = document.querySelectorAll(sel);
      return Array.from(elements).map(el => ({
        src: el.src,
        alt: el.alt || null,
        title: el.title || null,
        width: el.width,
        height: el.height
      }));
    }, selector);
  }

  /**
   * Extract data from a table
   * @param {string} selector - CSS selector for the table
   * @param {Object} options - Table extraction options
   * @returns {Promise<Array>} Array of row objects with column data
   */
  async extractTable(selector, options = {}) {
    return await this.browser.evaluate((sel, opts) => {
      const table = document.querySelector(sel);
      if (!table) {
        return null;
      }

      const rows = table.querySelectorAll('tr');
      if (!rows || rows.length === 0) {
        return null;
      }

      // Determine if first row is header
      const hasHeader = opts.hasHeader ?? true;
      const headers = hasHeader && rows[0] 
        ? Array.from(rows[0].querySelectorAll('th, td')).map(th => 
            (th.textContent || '').trim()
          )
        : null;

      const dataRows = hasHeader 
        ? Array.from(rows).slice(1) 
        : Array.from(rows);

      return dataRows.map(row => {
        const cells = row.querySelectorAll('td, th');
        const rowData = {};

        Array.from(cells).forEach((cell, index) => {
          const key = headers ? headers[index] : `col${index}`;
          rowData[key] = (cell.textContent || '').trim();
        });

        return rowData;
      });
    }, selector, options);
  }

  /**
   * Extract data using XPath expression
   * @param {string} xpath - XPath expression
   * @param {Object} options - Extraction options
   * @param {string} options.property - Property to extract (textContent, href, etc.)
   * @returns {Promise<Array>} Array of extracted values
   */
  async extractByXPath(xpath, options = {}) {
    return await this.browser.evaluate((path, opts) => {
      const result = document.evaluate(
        path,
        document,
        null,
        XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
        null
      );

      const values = [];
      for (let i = 0; i < result.snapshotLength; i++) {
        const node = result.snapshotItem(i);
        if (!node) continue;

        let value;
        if (opts.property) {
          value = node[opts.property];
        } else if (node.nodeType === Node.TEXT_NODE) {
          value = node.textContent?.trim();
        } else if (node.nodeType === Node.ELEMENT_NODE) {
          value = node.textContent?.trim();
        }

        if (value) {
          values.push(value);
        }
      }

      return values;
    }, xpath, options);
  }

  /**
   * Extract multiple fields from a page using a configuration
   * @param {Object} config - Extraction configuration
   * @returns {Promise<Object>} Extracted data object
   * 
   * @example
   * await scraper.extractMultiple({
   *   title: { selector: 'h1', type: 'text' },
   *   description: { selector: '.meta-desc', type: 'text' },
   *   links: { selector: 'a', type: 'links' },
   *   image: { selector: '.hero img', type: 'attribute', attribute: 'src' }
   * });
   */
  async extractMultiple(config) {
    const results = {};

    for (const [key, fieldConfig] of Object.entries(config)) {
      const { type = 'text', selector, attribute, all = false } = fieldConfig;

      switch (type) {
        case 'text':
          results[key] = await this.extractText(selector, { all });
          break;
        case 'html':
          results[key] = await this.extractHTML(selector, { all });
          break;
        case 'attribute':
          results[key] = await this.extractHTML(selector, { 
            attribute, 
            all 
          });
          break;
        case 'links':
          results[key] = await this.extractLinks(selector);
          break;
        case 'images':
          results[key] = await this.extractImages(selector);
          break;
        case 'table':
          results[key] = await this.extractTable(selector, fieldConfig);
          break;
        case 'xpath':
          results[key] = await this.extractByXPath(selector, fieldConfig);
          break;
        case 'evaluate':
          results[key] = await this.evaluate(fieldConfig.script);
          break;
        default:
          results[key] = await this.extractText(selector, { all });
      }
    }

    return results;
  }

  /**
   * Extract structured data from repeated elements (e.g., product cards)
   * @param {string} containerSelector - Selector for repeating container
   * @param {Object} fields - Field definitions for extraction
   * @returns {Promise<Array>} Array of extracted objects
   * 
   * @example
   * await scraper.extractList('.product-card', {
   *   name: '.product-name',
   *   price: '.product-price',
   *   image: { selector: 'img', type: 'attribute', attribute: 'src' }
   * });
   */
  async extractList(containerSelector, fields) {
    return await this.browser.evaluate((container, fieldDefs) => {
      const containers = document.querySelectorAll(container);
      
      return Array.from(containers).map(container => {
        const item = {};

        for (const [key, fieldDef] of Object.entries(fieldDefs)) {
          let selector, type = 'text', attribute = null;

          if (typeof fieldDef === 'string') {
            selector = fieldDef;
          } else {
            selector = fieldDef.selector || fieldDef;
            type = fieldDef.type || 'text';
            attribute = fieldDef.attribute;
          }

          const element = container.querySelector(selector);
          if (!element) {
            item[key] = null;
            continue;
          }

          switch (type) {
            case 'text':
              item[key] = (element.textContent || '').trim();
              break;
            case 'attribute':
              item[key] = element.getAttribute(attribute);
              break;
            case 'html':
              item[key] = element.innerHTML;
              break;
            default:
              item[key] = (element.textContent || '').trim();
          }
        }

        return item;
      });
    }, containerSelector, fields);
  }

  /**
   * Execute custom JavaScript in the page context
   * @param {Function|string} pageFunction - Function or code to evaluate
   * @param {Array} args - Arguments to pass to the function
   * @returns {Promise<any>} Evaluation result
   */
  async evaluate(pageFunction, ...args) {
    return await this.browser.evaluate(pageFunction, ...args);
  }

  /**
   * Check if an element exists on the page
   * @param {string} selector - CSS selector to check
   * @returns {Promise<boolean>} True if element exists
   */
  async exists(selector) {
    return await this.browser.evaluate((sel) => {
      return document.querySelector(sel) !== null;
    }, selector);
  }

  /**
   * Count elements matching a selector
   * @param {string} selector - CSS selector
   * @returns {Promise<number>} Count of matching elements
   */
  async count(selector) {
    return await this.browser.evaluate((sel) => {
      return document.querySelectorAll(sel).length;
    }, selector);
  }

  /**
   * Get the current page URL
   * @returns {Promise<string>} Current URL
   */
  async getUrl() {
    return await this.browser.getUrl();
  }

  /**
   * Get the current page title
   * @returns {Promise<string>} Page title
   */
  async getTitle() {
    return await this.browser.evaluate(() => document.title);
  }

  /**
   * Get meta tags from the page
   * @param {string} selector - Meta tag selector (optional)
   * @returns {Promise<Object>} Meta tag data
   */
  async extractMeta(selector = 'meta') {
    return await this.browser.evaluate((sel) => {
      const metas = document.querySelectorAll(sel);
      const result = {};

      Array.from(metas).forEach(meta => {
        const name = meta.getAttribute('name') || 
                     meta.getAttribute('property') || 
                     meta.getAttribute('http-equiv');
        const content = meta.getAttribute('content');

        if (name && content) {
          result[name] = content;
        }
      });

      // Also get standard meta info
      result.title = document.title;
      
      const canonical = document.querySelector('link[rel="canonical"]');
      if (canonical) {
        result.canonical = canonical.href;
      }

      return result;
    }, selector);
  }

  /**
   * Extract OpenGraph data
   * @returns {Promise<Object>} OpenGraph metadata
   */
  async extractOpenGraph() {
    return await this.extractMeta('meta[property^="og:"]');
  }

  /**
   * Extract Twitter Card data
   * @returns {Promise<Object>} Twitter Card metadata
   */
  async extractTwitterCard() {
    return await this.extractMeta('meta[name^="twitter:"]');
  }

  /**
   * Extract JSON-LD structured data
   * @returns {Promise<Array>} Array of JSON-LD objects
   */
  async extractJsonLd() {
    return await this.browser.evaluate(() => {
      const scripts = document.querySelectorAll('script[type="application/ld+json"]');
      return Array.from(scripts).map(script => {
        try {
          return JSON.parse(script.textContent);
        } catch (e) {
          return null;
        }
      }).filter(Boolean);
    });
  }

  /**
   * Close the browser
   * @returns {Promise<void>}
   */
  async close() {
    await this.browser.close();
  }
}

/**
 * Execute scraping from command line
 * @param {Object} args - Command line arguments
 */
async function executeFromCLI(args) {
  const scraper = new WebScraper();

  try {
    const url = args.url || args._?.[0];
    if (!url) {
      throw new Error('URL is required');
    }

    await scraper.load(url);

    // Extract based on arguments
    if (args.selector) {
      const result = await scraper.extractText(args.selector);
      console.log('Extracted:', result);
    } else if (args.links) {
      const links = await scraper.extractLinks();
      console.log('Links:', JSON.stringify(links, null, 2));
    } else if (args.images) {
      const images = await scraper.extractImages();
      console.log('Images:', JSON.stringify(images, null, 2));
    } else if (args.meta) {
      const meta = await scraper.extractMeta();
      console.log('Meta:', JSON.stringify(meta, null, 2));
    } else if (args.jsonld) {
      const jsonld = await scraper.extractJsonLd();
      console.log('JSON-LD:', JSON.stringify(jsonld, null, 2));
    } else if (args.config) {
      const config = require(args.config);
      const result = await scraper.extractMultiple(config);
      console.log('Extracted:', JSON.stringify(result, null, 2));
    } else {
      // Default: extract main content
      const text = await scraper.browser.getText();
      console.log('Page text:', text.substring(0, 1000) + '...');
    }

  } catch (error) {
    console.error('[WebScraper] Error:', error.message);
    process.exit(1);
  } finally {
    await scraper.close();
  }
}

// Export for module usage
module.exports = { WebScraper };

// CLI execution
if (require.main === module) {
  const args = require('minimist')(process.argv.slice(2), {
    string: ['url', 'selector', 'config'],
    boolean: ['links', 'images', 'meta', 'jsonld'],
    alias: {
      u: 'url',
      s: 'selector',
      l: 'links',
      i: 'images',
      m: 'meta',
      c: 'config'
    }
  });

  executeFromCLI(args);
}
