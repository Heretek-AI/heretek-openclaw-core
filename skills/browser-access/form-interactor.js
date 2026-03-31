#!/usr/bin/env node

/**
 * Form Interactor - Form filling and page interaction utilities
 * 
 * Provides methods for filling forms, clicking elements, selecting options,
 * and navigating through web pages programmatically.
 * 
 * @module browser-access/form-interactor
 */

const { BrowserController } = require('./browser-controller');

/**
 * Form Interactor Class
 * Provides form filling and page interaction capabilities
 */
class FormInteractor {
  /**
   * Create a new FormInteractor instance
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
   * Navigate to a URL
   * @param {string} url - The URL to navigate to
   * @returns {Promise<this>}
   */
  async goTo(url) {
    await this.init();
    await this.browser.navigate(url);
    return this;
  }

  /**
   * Fill a text input field
   * @param {string} selector - CSS selector for the input field
   * @param {string} value - Value to type
   * @param {Object} options - Type options
   * @param {number} options.delay - Delay between keystrokes in ms
   * @param {boolean} options.clear - Clear field before typing (default: true)
   * @returns {Promise<this>}
   */
  async fill(selector, value, options = {}) {
    const page = await this.browser.page;
    
    // Clear field if requested
    if (options.clear !== false) {
      await this.browser.click(selector, { clickCount: 3 });
    }

    await this.browser.type(selector, value, {
      delay: options.delay ?? 50
    });

    return this;
  }

  /**
   * Fill multiple fields at once
   * @param {Array} fields - Array of field configurations
   * @returns {Promise<this>}
   * 
   * @example
   * await form.fillMultiple([
   *   { selector: 'input[name="email"]', value: 'test@example.com' },
   *   { selector: 'input[name="password"]', value: 'secret' }
   * ]);
   */
  async fillMultiple(fields) {
    for (const field of fields) {
      await this.fill(field.selector, field.value, field.options);
    }
    return this;
  }

  /**
   * Click an element
   * @param {string} selector - CSS selector for the element to click
   * @param {Object} options - Click options
   * @param {number} options.delay - Delay after click in ms
   * @param {number} options.clickCount - Number of clicks (for double-click)
   * @returns {Promise<this>}
   */
  async click(selector, options = {}) {
    await this.browser.click(selector, {
      delay: options.delay ?? 100,
      clickCount: options.clickCount ?? 1
    });
    return this;
  }

  /**
   * Select an option in a dropdown/select element
   * @param {string} selector - CSS selector for the select element
   * @param {string|string[]} value - Value(s) to select
   * @returns {Promise<this>}
   */
  async select(selector, value) {
    await this.browser.select(selector, value);
    return this;
  }

  /**
   * Select by visible text in a dropdown
   * @param {string} selector - CSS selector for the select element
   * @param {string} text - Visible text to match
   * @returns {Promise<this>}
   */
  async selectByText(selector, text) {
    const page = await this.browser.page;
    
    await page.evaluate((sel, txt) => {
      const select = document.querySelector(sel);
      if (!select) {
        throw new Error(`Select element not found: ${sel}`);
      }
      
      const options = Array.from(select.options);
      const matchingOption = options.find(opt => 
        opt.text.toLowerCase().includes(txt.toLowerCase())
      );
      
      if (!matchingOption) {
        throw new Error(`No option found with text: ${txt}`);
      }
      
      select.value = matchingOption.value;
      select.dispatchEvent(new Event('change'));
    }, selector, text);

    return this;
  }

  /**
   * Check a checkbox
   * @param {string} selector - CSS selector for the checkbox
   * @param {boolean} checked - Whether to check or uncheck (default: true)
   * @returns {Promise<this>}
   */
  async check(selector, checked = true) {
    const page = await this.browser.page;
    
    await page.evaluate((sel, isChecked) => {
      const element = document.querySelector(sel);
      if (!element) {
        throw new Error(`Checkbox not found: ${sel}`);
      }
      element.checked = isChecked;
      element.dispatchEvent(new Event('change'));
    }, selector, checked);

    return this;
  }

  /**
   * Uncheck a checkbox
   * @param {string} selector - CSS selector for the checkbox
   * @returns {Promise<this>}
   */
  async uncheck(selector) {
    return await this.check(selector, false);
  }

  /**
   * Select a radio button
   * @param {string} selector - CSS selector for the radio button
   * @returns {Promise<this>}
   */
  async radio(selector) {
    const page = await this.browser.page;
    
    await page.evaluate((sel) => {
      const element = document.querySelector(sel);
      if (!element) {
        throw new Error(`Radio button not found: ${sel}`);
      }
      element.checked = true;
      element.dispatchEvent(new Event('change'));
    }, selector);

    return this;
  }

  /**
   * Upload a file
   * @param {string} selector - CSS selector for the file input
   * @param {string|string[]} filePath - Path(s) to file(s) to upload
   * @returns {Promise<this>}
   */
  async upload(selector, filePath) {
    const page = await this.browser.page;
    
    const input = await page.$(selector);
    if (!input) {
      throw new Error(`File input not found: ${selector}`);
    }

    await input.uploadFile(...(Array.isArray(filePath) ? filePath : [filePath]));
    return this;
  }

  /**
   * Submit a form
   * @param {string} selector - CSS selector for the form
   * @param {Object} options - Submit options
   * @param {string} options.waitUntil - Navigation wait condition
   * @returns {Promise<this>}
   */
  async submit(selector, options = {}) {
    const page = await this.browser.page;
    
    // Try to find submit button first
    const submitButton = await page.$(`${selector} button[type="submit"], ${selector} input[type="submit"]`);
    
    if (submitButton) {
      await submitButton.click();
    } else {
      // Fall back to form submission
      await page.evaluate((sel) => {
        const form = document.querySelector(sel);
        if (form) {
          form.submit();
        }
      }, selector);
    }

    // Wait for navigation if requested
    if (options.waitUntil) {
      await page.waitForNavigation({ waitUntil: options.waitUntil });
    }

    return this;
  }

  /**
   * Press a key
   * @param {string} key - Key to press (e.g., 'Enter', 'Tab', 'Escape')
   * @param {Object} options - Key press options
   * @returns {Promise<this>}
   */
  async pressKey(key, options = {}) {
    const page = await this.browser.page;
    
    await page.keyboard.press(key, {
      delay: options.delay ?? 50
    });

    return this;
  }

  /**
   * Focus an element
   * @param {string} selector - CSS selector for the element
   * @returns {Promise<this>}
   */
  async focus(selector) {
    const page = await this.browser.page;
    
    await page.evaluate((sel) => {
      const element = document.querySelector(sel);
      if (element) {
        element.focus();
      }
    }, selector);

    return this;
  }

  /**
   * Blur an element
   * @param {string} selector - CSS selector for the element
   * @returns {Promise<this>}
   */
  async blur(selector) {
    const page = await this.browser.page;
    
    await page.evaluate((sel) => {
      const element = document.querySelector(sel);
      if (element) {
        element.blur();
      }
    }, selector);

    return this;
  }

  /**
   * Hover over an element
   * @param {string} selector - CSS selector for the element
   * @returns {Promise<this>}
   */
  async hover(selector) {
    const page = await this.browser.page;
    
    await page.hover(selector);
    return this;
  }

  /**
   * Wait for a response after an action
   * @param {Object} options - Wait options
   * @param {number} options.timeout - Timeout in ms
   * @param {string} options.selector - Wait for selector to appear
   * @param {string} options.url - Wait for URL change
   * @returns {Promise<this>}
   */
  async waitForResponse(options = {}) {
    const page = await this.browser.page;

    if (options.selector) {
      await page.waitForSelector(options.selector, {
        timeout: options.timeout ?? 30000
      });
    }

    if (options.url) {
      await page.waitForNavigation({
        url: options.url,
        timeout: options.timeout ?? 30000
      });
    }

    if (options.timeout && !options.selector && !options.url) {
      await new Promise(resolve => setTimeout(resolve, options.timeout));
    }

    return this;
  }

  /**
   * Execute a sequence of actions
   * @param {Array} actions - Array of action configurations
   * @returns {Promise<this>}
   * 
   * @example
   * await form.executeActions([
   *   { type: 'fill', selector: '#email', value: 'test@example.com' },
   *   { type: 'fill', selector: '#password', value: 'secret' },
   *   { type: 'click', selector: '#submit' },
   *   { type: 'wait', duration: 1000 }
   * ]);
   */
  async executeActions(actions) {
    for (const action of actions) {
      switch (action.type) {
        case 'fill':
          await this.fill(action.selector, action.value, action.options);
          break;
        case 'click':
          await this.click(action.selector, action.options);
          break;
        case 'select':
          await this.select(action.selector, action.value);
          break;
        case 'selectByText':
          await this.selectByText(action.selector, action.value);
          break;
        case 'check':
          await this.check(action.selector, action.checked);
          break;
        case 'uncheck':
          await this.uncheck(action.selector);
          break;
        case 'radio':
          await this.radio(action.selector);
          break;
        case 'upload':
          await this.upload(action.selector, action.filePath);
          break;
        case 'submit':
          await this.submit(action.selector, action.options);
          break;
        case 'pressKey':
          await this.pressKey(action.key, action.options);
          break;
        case 'focus':
          await this.focus(action.selector);
          break;
        case 'blur':
          await this.blur(action.selector);
          break;
        case 'hover':
          await this.hover(action.selector);
          break;
        case 'wait':
          await new Promise(resolve => setTimeout(resolve, action.duration ?? 1000));
          break;
        case 'evaluate':
          await this.browser.evaluate(action.script);
          break;
        case 'waitForSelector':
          await this.browser.waitForSelector(action.selector, action.options);
          break;
        case 'waitForResponse':
          await this.waitForResponse(action.options);
          break;
      }

      // Add delay between actions if specified
      if (action.delay) {
        await new Promise(resolve => setTimeout(resolve, action.delay));
      }
    }

    return this;
  }

  /**
   * Get form field value
   * @param {string} selector - CSS selector for the field
   * @returns {Promise<any>} Field value
   */
  async getFieldValue(selector) {
    return await this.browser.evaluate((sel) => {
      const element = document.querySelector(sel);
      if (!element) {
        return null;
      }

      if (element.type === 'checkbox' || element.type === 'radio') {
        return element.checked;
      }

      return element.value;
    }, selector);
  }

  /**
   * Get all form values
   * @param {string} formSelector - CSS selector for the form
   * @returns {Promise<Object>} Form data object
   */
  async getFormData(formSelector) {
    return await this.browser.evaluate((sel) => {
      const form = document.querySelector(sel);
      if (!form) {
        return null;
      }

      const formData = {};
      const elements = form.querySelectorAll('input, select, textarea');

      Array.from(elements).forEach(el => {
        const name = el.name;
        if (!name) return;

        if (el.type === 'checkbox' || el.type === 'radio') {
          if (el.checked) {
            formData[name] = el.value;
          }
        } else if (el.tagName === 'SELECT' && el.multiple) {
          formData[name] = Array.from(el.selectedOptions).map(opt => opt.value);
        } else {
          formData[name] = el.value;
        }
      });

      return formData;
    }, formSelector);
  }

  /**
   * Take a screenshot after interactions
   * @param {Object} options - Screenshot options
   * @returns {Promise<string|Buffer>} Screenshot path or buffer
   */
  async screenshot(options = {}) {
    return await this.browser.screenshot(options);
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
 * Execute form interactions from command line
 * @param {Object} args - Command line arguments
 */
async function executeFromCLI(args) {
  const form = new FormInteractor();

  try {
    const url = args.url || args._?.[0];
    if (!url) {
      throw new Error('URL is required');
    }

    await form.goTo(url);

    // Load actions from config file or parse from command line
    if (args.actions) {
      const actions = typeof args.actions === 'string'
        ? JSON.parse(args.actions)
        : args.actions;

      await form.executeActions(actions);
    }

    // Take screenshot if requested
    if (args.screenshot) {
      const path = args.output || `./screenshots/${Date.now()}.png`;
      await form.screenshot({ path, fullPage: args.fullPage });
      console.log('Screenshot saved to:', path);
    }

  } catch (error) {
    console.error('[FormInteractor] Error:', error.message);
    process.exit(1);
  } finally {
    await form.close();
  }
}

// Export for module usage
module.exports = { FormInteractor };

// CLI execution
if (require.main === module) {
  const args = require('minimist')(process.argv.slice(2), {
    string: ['url', 'actions', 'output'],
    boolean: ['screenshot', 'full-page'],
    alias: {
      u: 'url',
      a: 'actions',
      S: 'screenshot',
      o: 'output'
    }
  });

  executeFromCLI(args);
}
