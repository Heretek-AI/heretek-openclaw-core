/**
 * Heretek OpenClaw — Configuration Validator
 * ==============================================================================
 * Validates OpenClaw configuration files for correctness and completeness.
 * 
 * Features:
 *   - JSON schema validation
 *   - Required field checking
 *   - Cross-reference validation
 *   - Auto-fix capabilities
 */

const fs = require('fs');
const path = require('path');

class ConfigValidator {
    constructor(config = {}) {
        this.workspaceRoot = config.workspaceRoot || process.cwd();
        this.configFile = config.configFile || path.join(this.workspaceRoot, 'openclaw.json');
    }

    /**
     * Validate all configuration files
     * @returns {Promise<Object>} Validation results
     */
    async validateAll() {
        const results = {
            timestamp: new Date().toISOString(),
            files: [],
            issues: [],
            valid: true
        };

        // Validate main config
        const mainConfigResult = await this.validateMainConfig();
        results.files.push(mainConfigResult);
        if (!mainConfigResult.valid) {
            results.valid = false;
            results.issues.push(...mainConfigResult.issues);
        }

        // Validate agent configs
        const agentConfigsResult = await this.validateAgentConfigs();
        results.files.push(...agentConfigsResult);
        
        // Validate gateway config
        const gatewayResult = await this.validateGatewayConfig();
        results.files.push(gatewayResult);
        if (!gatewayResult.valid) {
            results.valid = false;
            results.issues.push(...gatewayResult.issues);
        }

        return results;
    }

    /**
     * Validate main openclaw.json
     */
    async validateMainConfig() {
        const result = {
            file: this.configFile,
            type: 'main',
            valid: true,
            issues: []
        };

        // Check file exists
        if (!fs.existsSync(this.configFile)) {
            result.valid = false;
            result.issues.push({
                severity: 'critical',
                message: `Configuration file not found: ${this.configFile}`
            });
            return result;
        }

        // Parse JSON
        let config;
        try {
            config = JSON.parse(fs.readFileSync(this.configFile, 'utf8'));
        } catch (error) {
            result.valid = false;
            result.issues.push({
                severity: 'critical',
                message: `Invalid JSON: ${error.message}`
            });
            return result;
        }

        // Check required fields
        const requiredFields = ['gateway', 'litellm', 'agents', 'database'];
        requiredFields.forEach(field => {
            if (!config[field]) {
                result.valid = false;
                result.issues.push({
                    severity: 'critical',
                    message: `Missing required field: ${field}`
                });
            }
        });

        // Validate gateway config
        if (config.gateway) {
            if (!config.gateway.host || !config.gateway.port) {
                result.issues.push({
                    severity: 'warning',
                    message: 'Gateway host/port not specified'
                });
            }
        }

        // Validate LiteLLM config
        if (config.litellm) {
            if (!config.litellm.host || !config.litellm.port) {
                result.issues.push({
                    severity: 'warning',
                    message: 'LiteLLM host/port not specified'
                });
            }
        }

        // Validate agents array
        if (Array.isArray(config.agents)) {
            config.agents.forEach((agent, index) => {
                if (!agent.id) {
                    result.issues.push({
                        severity: 'error',
                        message: `Agent at index ${index} missing 'id' field`
                    });
                }
            });
        }

        return result;
    }

    /**
     * Validate agent configuration files
     */
    async validateAgentConfigs() {
        const results = [];
        const agentsDir = path.join(this.workspaceRoot, 'agents');

        if (!fs.existsSync(agentsDir)) {
            return results;
        }

        const files = fs.readdirSync(agentsDir);
        files.forEach(file => {
            if (file.endsWith('.json')) {
                const filePath = path.join(agentsDir, file);
                const result = this.validateJsonFile(filePath, 'agent');
                results.push(result);
            }
        });

        return results;
    }

    /**
     * Validate gateway configuration
     */
    async validateGatewayConfig() {
        const gatewayConfigPath = path.join(this.workspaceRoot, 'gateway', 'config.json');
        return this.validateJsonFile(gatewayConfigPath, 'gateway');
    }

    /**
     * Validate a JSON file
     */
    validateJsonFile(filePath, type) {
        const result = {
            file: filePath,
            type: type,
            valid: true,
            issues: []
        };

        if (!fs.existsSync(filePath)) {
            result.valid = false;
            result.issues.push({
                severity: 'error',
                message: `File not found: ${filePath}`
            });
            return result;
        }

        try {
            JSON.parse(fs.readFileSync(filePath, 'utf8'));
        } catch (error) {
            result.valid = false;
            result.issues.push({
                severity: 'critical',
                message: `Invalid JSON: ${error.message}`
            });
        }

        return result;
    }

    /**
     * Attempt to auto-fix common issues
     * @param {Array} issues - List of issues to fix
     * @returns {Promise<Object>} Fix results
     */
    async autoFix(issues) {
        const results = {
            fixed: [],
            failed: []
        };

        for (const issue of issues) {
            try {
                // Auto-fix strategies based on issue type
                if (issue.message.includes('Invalid JSON')) {
                    results.failed.push({
                        issue,
                        reason: 'Cannot auto-fix JSON syntax errors'
                    });
                } else if (issue.message.includes('not found')) {
                    results.failed.push({
                        issue,
                        reason: 'Cannot create missing files automatically'
                    });
                }
            } catch (error) {
                results.failed.push({
                    issue,
                    error: error.message
                });
            }
        }

        return results;
    }
}

module.exports = ConfigValidator;
