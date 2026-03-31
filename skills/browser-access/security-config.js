#!/usr/bin/env node

/**
 * Security Configuration - Sandboxing and rate limiting for browser automation
 * 
 * Provides security configurations for safe browser automation including:
 * - Domain whitelisting/blacklisting
 * - Rate limiting with jitter
 * - Resource blocking
 * - Session isolation
 * 
 * @module browser-access/security-config
 */

const path = require('path');
const fs = require('fs');

/**
 * Default security configuration
 */
const DEFAULT_CONFIG = {
  // Domain restrictions
  allowedDomains: [],  // Empty means all domains allowed
  deniedDomains: [
    'malware.com',
    'phishing.com',
    'evil.com'
  ],

  // URL patterns to block (regex patterns as strings)
  deniedPatterns: [
    '.*\\.exe$',
    '.*\\.msi$',
    '.*malware.*',
    '.*phishing.*',
    '.*download.*\\.zip$'
  ],

  // Resource types to block
  blockResources: [
    'image',      // Block images for faster loading
    'media',      // Block audio/video
    'font',       // Block fonts
    'websocket',  // Block WebSocket connections
    'manifest',   // Block manifest files
    'other'       // Block other resources
  ],

  // Rate limiting
  rateLimit: {
    enabled: true,
    delayMs: 1000,           // Base delay between requests
    randomizeDelay: true,    // Add random jitter
    jitterMs: 500,           // Max random jitter in ms
    maxRequestsPerSession: 100,
    maxRequestsPerMinute: 60,
    backoffMultiplier: 2,    // Multiply delay on rate limit detection
    maxBackoffMs: 30000      // Maximum backoff delay
  },

  // Cookie handling
  cookies: {
    acceptCookies: false,
    clearCookiesOnClose: true,
    blockThirdPartyCookies: true
  },

  // JavaScript execution
  javascript: {
    enabled: true,
    sandboxMode: true  // Restricted JS context
  },

  // Storage paths
  storage: {
    screenshotsDir: path.join(__dirname, 'screenshots'),
    exportsDir: path.join(__dirname, 'exports'),
    sessionsDir: path.join(__dirname, 'sessions'),
    cacheDir: path.join(__dirname, 'cache')
  },

  // Privacy settings
  privacy: {
    blockTrackers: true,
    blockAds: true,
    disableWebRTC: true,
    disableNotifications: true,
    clearCacheOnClose: true
  },

  // Timeout settings
  timeouts: {
    navigation: 30000,
    action: 10000,
    selector: 5000,
    networkIdle: 30000
  },

  // User agent settings
  userAgent: {
    useDefault: true,
    custom: null,
    rotate: false,
    rotateInterval: 10  // Requests before rotation
  }
};

/**
 * Security Configuration Class
 * Manages security settings for browser automation
 */
class SecurityConfig {
  /**
   * Create a new SecurityConfig instance
   * @param {Object} options - Configuration options to override defaults
   */
  constructor(options = {}) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...this._mergeDeep(DEFAULT_CONFIG, options)
    };

    this._ensureDirectories();
    this._loadEnvironmentConfig();
  }

  /**
   * Deep merge objects
   * @private
   * @param {Object} target - Target object
   * @param {Object} source - Source object
   * @returns {Object} Merged object
   */
  _mergeDeep(target, source) {
    const output = { ...target };

    for (const key of Object.keys(source)) {
      if (source[key] instanceof Object && key in target) {
        output[key] = this._mergeDeep(target[key], source[key]);
      } else {
        output[key] = source[key];
      }
    }

    return output;
  }

  /**
   * Ensure storage directories exist
   * @private
   */
  _ensureDirectories() {
    const dirs = [
      this.config.storage.screenshotsDir,
      this.config.storage.exportsDir,
      this.config.storage.sessionsDir,
      this.config.storage.cacheDir
    ];

    for (const dir of dirs) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
  }

  /**
   * Load configuration from environment variables
   * @private
   */
  _loadEnvironmentConfig() {
    // Browser settings
    if (process.env.BROWSER_HEADLESS) {
      this.config.browser = {
        ...this.config.browser,
        headless: process.env.BROWSER_HEADLESS === 'true'
      };
    }

    if (process.env.BROWSER_TIMEOUT) {
      this.config.timeouts.navigation = parseInt(process.env.BROWSER_TIMEOUT, 10);
    }

    // Rate limiting
    if (process.env.RATE_LIMIT_DELAY) {
      this.config.rateLimit.delayMs = parseInt(process.env.RATE_LIMIT_DELAY, 10);
    }

    if (process.env.RATE_LIMIT_MAX_REQUESTS) {
      this.config.rateLimit.maxRequestsPerSession = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10);
    }

    if (process.env.RATE_LIMIT_RANDOMIZE) {
      this.config.rateLimit.randomizeDelay = process.env.RATE_LIMIT_RANDOMIZE === 'true';
    }

    // Security
    if (process.env.SECURITY_BLOCK_ADS) {
      this.config.privacy.blockAds = process.env.SECURITY_BLOCK_ADS === 'true';
    }

    if (process.env.SECURITY_BLOCK_TRACKERS) {
      this.config.privacy.blockTrackers = process.env.SECURITY_BLOCK_TRACKERS === 'true';
    }

    if (process.env.SECURITY_ALLOWED_DOMAINS) {
      this.config.allowedDomains = process.env.SECURITY_ALLOWED_DOMAINS
        .split(',')
        .map(d => d.trim());
    }

    if (process.env.SECURITY_DENIED_PATTERNS) {
      this.config.deniedPatterns = process.env.SECURITY_DENIED_PATTERNS
        .split(',')
        .map(p => p.trim());
    }

    // Storage
    if (process.env.SCREENSHOT_DIR) {
      this.config.storage.screenshotsDir = process.env.SCREENSHOT_DIR;
    }

    if (process.env.PDF_DIR) {
      this.config.storage.exportsDir = process.env.PDF_DIR;
    }

    if (process.env.SESSION_DIR) {
      this.config.storage.sessionsDir = process.env.SESSION_DIR;
    }
  }

  /**
   * Get the full configuration
   * @returns {Object} Complete configuration object
   */
  getConfig() {
    return { ...this.config };
  }

  /**
   * Get a specific configuration section
   * @param {string} section - Section name (e.g., 'rateLimit', 'cookies')
   * @returns {Object} Section configuration
   */
  getSection(section) {
    return this.config[section] ? { ...this.config[section] } : null;
  }

  /**
   * Check if a domain is allowed
   * @param {string} domain - Domain to check
   * @returns {boolean} True if domain is allowed
   */
  isDomainAllowed(domain) {
    // If no allowed domains specified, all are allowed (except denied)
    if (!this.config.allowedDomains || this.config.allowedDomains.length === 0) {
      return !this.isDomainDenied(domain);
    }

    // Check if domain is in allowed list
    const isAllowed = this.config.allowedDomains.some(
      allowed => domain.endsWith(allowed) || domain === allowed
    );

    // Also check if denied
    if (isAllowed && this.isDomainDenied(domain)) {
      return false;
    }

    return isAllowed;
  }

  /**
   * Check if a domain is denied
   * @param {string} domain - Domain to check
   * @returns {boolean} True if domain is denied
   */
  isDomainDenied(domain) {
    return this.config.deniedDomains.some(
      denied => domain.endsWith(denied) || domain === denied
    );
  }

  /**
   * Check if a URL matches any denied pattern
   * @param {string} url - URL to check
   * @returns {boolean} True if URL matches a denied pattern
   */
  isUrlDenied(url) {
    return this.config.deniedPatterns.some(pattern => {
      const regex = typeof pattern === 'string' ? new RegExp(pattern, 'i') : pattern;
      return regex.test(url);
    });
  }

  /**
   * Check if a resource type should be blocked
   * @param {string} resourceType - Resource type to check
   * @returns {boolean} True if resource should be blocked
   */
  shouldBlockResource(resourceType) {
    return this.config.blockResources.includes(resourceType);
  }

  /**
   * Get the rate limit delay with optional jitter
   * @returns {number} Delay in milliseconds
   */
  getRateLimitDelay() {
    if (!this.config.rateLimit.enabled) {
      return 0;
    }

    let delay = this.config.rateLimit.delayMs;

    if (this.config.rateLimit.randomizeDelay) {
      const jitter = Math.floor(Math.random() * this.config.rateLimit.jitterMs);
      delay += jitter;
    }

    return delay;
  }

  /**
   * Get backoff delay for rate limiting
   * @param {number} attempt - Current attempt number
   * @returns {number} Backoff delay in milliseconds
   */
  getBackoffDelay(attempt) {
    const delay = this.config.rateLimit.delayMs * 
                  Math.pow(this.config.rateLimit.backoffMultiplier, attempt - 1);
    return Math.min(delay, this.config.rateLimit.maxBackoffMs);
  }

  /**
   * Get timeout for a specific operation
   * @param {string} operation - Operation type ('navigation', 'action', 'selector', 'networkIdle')
   * @returns {number} Timeout in milliseconds
   */
  getTimeout(operation) {
    return this.config.timeouts[operation] || this.config.timeouts.navigation;
  }

  /**
   * Get user agent string
   * @param {number} requestCount - Current request count (for rotation)
   * @returns {string|null} User agent string or null for default
   */
  getUserAgent(requestCount = 0) {
    if (!this.config.userAgent.useDefault && this.config.userAgent.custom) {
      return this.config.userAgent.custom;
    }

    // Return null to use Puppeteer default
    return null;
  }

  /**
   * Get storage directory path
   * @param {string} type - Storage type ('screenshots', 'exports', 'sessions', 'cache')
   * @returns {string} Directory path
   */
  getStorageDir(type) {
    const dirMap = {
      screenshots: 'screenshotsDir',
      exports: 'exportsDir',
      sessions: 'sessionsDir',
      cache: 'cacheDir'
    };

    const key = dirMap[type];
    return key ? this.config.storage[key] : null;
  }

  /**
   * Validate the configuration
   * @returns {Object} Validation result with valid flag and errors
   */
  validate() {
    const errors = [];

    // Validate rate limit settings
    if (this.config.rateLimit.delayMs < 0) {
      errors.push('Rate limit delay must be non-negative');
    }

    if (this.config.rateLimit.jitterMs < 0) {
      errors.push('Rate limit jitter must be non-negative');
    }

    // Validate timeouts
    for (const [key, value] of Object.entries(this.config.timeouts)) {
      if (value <= 0) {
        errors.push(`Timeout for ${key} must be positive`);
      }
    }

    // Validate storage directories
    for (const [key, value] of Object.entries(this.config.storage)) {
      if (!value) {
        errors.push(`Storage directory for ${key} is not set`);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Create a preset configuration for common use cases
   * @param {string} preset - Preset name ('stealth', 'fast', 'secure', 'default')
   * @returns {SecurityConfig} New SecurityConfig with preset settings
   */
  static createPreset(preset) {
    const presets = {
      stealth: {
        rateLimit: {
          delayMs: 2000,
          randomizeDelay: true,
          jitterMs: 1000
        },
        blockResources: [
          'image', 'media', 'font', 'websocket', 'manifest', 'other'
        ],
        privacy: {
          blockTrackers: true,
          blockAds: true,
          disableWebRTC: true,
          disableNotifications: true
        },
        userAgent: {
          useDefault: true,
          rotate: true
        }
      },
      fast: {
        rateLimit: {
          delayMs: 100,
          randomizeDelay: false
        },
        blockResources: [
          'image', 'media', 'font'
        ],
        privacy: {
          blockTrackers: false,
          blockAds: false
        }
      },
      secure: {
        allowedDomains: [],  // Must be set explicitly
        deniedPatterns: [
          '.*\\.exe$', '.*\\.msi$', '.*\\.bat$', '.*\\.cmd$',
          '.*download.*', '.*attachment.*'
        ],
        rateLimit: {
          delayMs: 3000,
          randomizeDelay: true,
          jitterMs: 2000,
          maxRequestsPerSession: 50
        },
        cookies: {
          acceptCookies: false,
          clearCookiesOnClose: true,
          blockThirdPartyCookies: true
        },
        javascript: {
          enabled: false,
          sandboxMode: true
        },
        privacy: {
          blockTrackers: true,
          blockAds: true,
          disableWebRTC: true,
          disableNotifications: true
        }
      }
    };

    const presetConfig = presets[preset] || {};
    return new SecurityConfig(presetConfig);
  }
}

// Export singleton instance and class
const securityConfig = new SecurityConfig();

module.exports = {
  SecurityConfig,
  securityConfig,
  DEFAULT_CONFIG
};
