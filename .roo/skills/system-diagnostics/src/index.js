/**
 * Heretek OpenClaw — System Diagnostics
 * ==============================================================================
 * Comprehensive system diagnostics for OpenClaw multi-agent architecture.
 * 
 * Features:
 *   - One-command full system health check
 *   - Log aggregation and analysis
 *   - Configuration validation
 *   - Dependency verification
 *   - Health score calculation (0-100)
 * 
 * Usage:
 *   const Diagnostics = require('./src/index');
 *   const diagnostics = new Diagnostics({ gatewayUrl: 'ws://127.0.0.1:18789' });
 *   
 *   // Run full diagnostics
 *   const result = await diagnostics.runFull();
 *   
 *   // Check specific component
 *   const gatewayHealth = await diagnostics.checkComponent('gateway');
 *   
 *   // Calculate health score
 *   const score = await diagnostics.calculateHealthScore();
 * ==============================================================================
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const fetch = require('node-fetch');
const WebSocket = require('ws');
const ConfigValidator = require('./config-validator');
const DependencyChecker = require('./dependency-checker');
const HealthScorer = require('./health-scorer');

class SystemDiagnostics {
    constructor(config = {}) {
        this.gatewayUrl = config.gatewayUrl || process.env.GATEWAY_URL || 'ws://127.0.0.1:18789';
        this.litellmHost = config.litellmHost || process.env.LITELLM_HOST || 'http://litellm:4000';
        this.workspaceRoot = config.workspaceRoot || process.cwd();
        this.logDir = config.logDir || '/var/log/openclaw';
        this.configFile = config.configFile || path.join(this.workspaceRoot, 'openclaw.json');
        
        this.ws = null;
        this.connected = false;
        
        // Initialize sub-modules
        this.configValidator = new ConfigValidator({ workspaceRoot: this.workspaceRoot });
        this.dependencyChecker = new DependencyChecker();
        this.healthScorer = new HealthScorer();
        
        // Results storage
        this.results = {
            timestamp: new Date().toISOString(),
            components: {},
            healthScore: null,
            issues: [],
            recommendations: []
        };
    }

    /**
     * Run full system diagnostics
     * @returns {Promise<Object>} Full diagnostic results
     */
    async runFull() {
        console.log('Running full system diagnostics...\n');
        
        try {
            // Check all components
            await this.checkGateway();
            await this.checkLiteLLM();
            await this.checkDatabase();
            await this.checkAgents();
            await this.checkSystem();
            
            // Validate configuration
            this.results.config = await this.configValidator.validateAll();
            
            // Check dependencies
            this.results.dependencies = await this.dependencyChecker.checkAll();
            
            // Aggregate logs
            this.results.logs = await this.aggregateLogs();
            
            // Calculate health score
            this.results.healthScore = await this.calculateHealthScore();
            
            // Generate recommendations
            this.results.recommendations = this.generateRecommendations();
            
            return this.results;
        } catch (error) {
            console.error('Diagnostics failed:', error.message);
            this.results.issues.push({
                severity: 'critical',
                component: 'diagnostics',
                message: error.message
            });
            return this.results;
        }
    }

    /**
     * Check Gateway health
     */
    async checkGateway() {
        const result = {
            name: 'gateway',
            status: 'unknown',
            details: {}
        };
        
        try {
            // Check HTTP health endpoint
            const healthUrl = this.gatewayUrl.replace('ws://', 'http://').replace('wss://', 'https://');
            const response = await fetch(`${healthUrl}/health`, { 
                method: 'GET',
                timeout: 5000
            });
            
            if (response.ok) {
                const data = await response.json();
                result.status = 'healthy';
                result.details = {
                    responseTime: response.headers.get('x-response-time') || 'unknown',
                    version: data.version || 'unknown',
                    agentsConnected: data.agentsConnected || 0,
                    websocketStatus: data.websocketStatus || 'unknown'
                };
            } else {
                result.status = 'degraded';
                result.details.error = `HTTP ${response.status}`;
            }
            
            // Check WebSocket connectivity
            result.details.websocket = await this.checkWebSocket();
            
        } catch (error) {
            result.status = 'unhealthy';
            result.details.error = error.message;
            this.results.issues.push({
                severity: 'critical',
                component: 'gateway',
                message: `Gateway health check failed: ${error.message}`
            });
        }
        
        this.results.components.gateway = result;
        return result;
    }

    /**
     * Check WebSocket connectivity
     */
    async checkWebSocket() {
        return new Promise((resolve) => {
            const timeout = setTimeout(() => {
                ws.close();
                resolve({ connected: false, error: 'Connection timeout' });
            }, 5000);
            
            const ws = new WebSocket(this.gatewayUrl);
            
            ws.on('open', () => {
                clearTimeout(timeout);
                ws.close();
                resolve({ connected: true, latency: Date.now() - startTime });
            });
            
            ws.on('error', (error) => {
                clearTimeout(timeout);
                resolve({ connected: false, error: error.message });
            });
            
            const startTime = Date.now();
        });
    }

    /**
     * Check LiteLLM health
     */
    async checkLiteLLM() {
        const result = {
            name: 'litellm',
            status: 'unknown',
            details: {}
        };
        
        try {
            // Check health endpoint
            const response = await fetch(`${this.litellmHost}/health`, {
                method: 'GET',
                timeout: 5000
            });
            
            if (response.ok) {
                const data = await response.json();
                result.status = 'healthy';
                result.details = {
                    responseTime: response.headers.get('x-response-time') || 'unknown',
                    modelsAvailable: data.models?.length || 0,
                    version: data.version || 'unknown'
                };
                
                // Check model availability
                const modelsResponse = await fetch(`${this.litellmHost}/v1/models`, {
                    method: 'GET',
                    timeout: 5000,
                    headers: { 'Authorization': `Bearer ${process.env.LITELLM_API_KEY || ''}` }
                });
                
                if (modelsResponse.ok) {
                    const modelsData = await modelsResponse.json();
                    result.details.models = modelsData.data?.length || 0;
                }
            } else {
                result.status = 'degraded';
                result.details.error = `HTTP ${response.status}`;
            }
            
        } catch (error) {
            result.status = 'unhealthy';
            result.details.error = error.message;
            this.results.issues.push({
                severity: 'critical',
                component: 'litellm',
                message: `LiteLLM health check failed: ${error.message}`
            });
        }
        
        this.results.components.litellm = result;
        return result;
    }

    /**
     * Check database health
     */
    async checkDatabase() {
        const result = {
            name: 'database',
            status: 'unknown',
            details: {}
        };
        
        try {
            // Check PostgreSQL
            const pgResult = await this.checkPostgreSQL();
            result.details.postgresql = pgResult;
            
            // Check Redis
            const redisResult = await this.checkRedis();
            result.details.redis = redisResult;
            
            // Overall status
            if (pgResult.status === 'healthy' && redisResult.status === 'healthy') {
                result.status = 'healthy';
            } else if (pgResult.status === 'unhealthy' || redisResult.status === 'unhealthy') {
                result.status = 'unhealthy';
            } else {
                result.status = 'degraded';
            }
            
        } catch (error) {
            result.status = 'unhealthy';
            result.details.error = error.message;
            this.results.issues.push({
                severity: 'critical',
                component: 'database',
                message: `Database health check failed: ${error.message}`
            });
        }
        
        this.results.components.database = result;
        return result;
    }

    /**
     * Check PostgreSQL connectivity
     */
    async checkPostgreSQL() {
        try {
            execSync('pg_isready -h localhost -p 5432', { 
                encoding: 'utf8',
                stdio: 'pipe',
                timeout: 5000
            });
            return { status: 'healthy', type: 'postgresql' };
        } catch (error) {
            return { status: 'unhealthy', type: 'postgresql', error: error.message };
        }
    }

    /**
     * Check Redis connectivity
     */
    async checkRedis() {
        try {
            const result = execSync('redis-cli ping', {
                encoding: 'utf8',
                stdio: 'pipe',
                timeout: 5000
            });
            
            if (result.trim() === 'PONG') {
                return { status: 'healthy', type: 'redis' };
            }
            return { status: 'unhealthy', type: 'redis', error: 'Unexpected response' };
        } catch (error) {
            return { status: 'unhealthy', type: 'redis', error: error.message };
        }
    }

    /**
     * Check agent status
     */
    async checkAgents() {
        const result = {
            name: 'agents',
            status: 'unknown',
            details: {
                total: 0,
                running: 0,
                healthy: 0,
                unhealthy: 0,
                agents: []
            }
        };
        
        try {
            // Get agent list from Gateway
            const agentStatus = await this.getAgentStatus();
            result.details.agents = agentStatus;
            result.details.total = agentStatus.length;
            result.details.running = agentStatus.filter(a => a.running).length;
            result.details.healthy = agentStatus.filter(a => a.healthy).length;
            result.details.unhealthy = agentStatus.filter(a => !a.healthy && a.running).length;
            
            // Determine overall status
            if (result.details.healthy === result.details.total && result.details.total > 0) {
                result.status = 'healthy';
            } else if (result.details.healthy === 0 && result.details.total > 0) {
                result.status = 'unhealthy';
            } else {
                result.status = 'degraded';
            }
            
        } catch (error) {
            result.status = 'unknown';
            result.details.error = error.message;
            this.results.issues.push({
                severity: 'warning',
                component: 'agents',
                message: `Agent status check failed: ${error.message}`
            });
        }
        
        this.results.components.agents = result;
        return result;
    }

    /**
     * Get agent status from Gateway
     */
    async getAgentStatus() {
        // Try to get status from Gateway
        try {
            const healthUrl = this.gatewayUrl.replace('ws://', 'http://').replace('wss://', 'https://');
            const response = await fetch(`${healthUrl}/agents`, {
                method: 'GET',
                timeout: 5000
            });
            
            if (response.ok) {
                return await response.json();
            }
        } catch (error) {
            // Fall back to Docker-based check
        }
        
        // Fallback: Check Docker containers
        try {
            const output = execSync('docker ps --filter "name=openclaw" --format "{{.Names}}\\t{{.Status}}"', {
                encoding: 'utf8',
                timeout: 10000
            });
            
            const lines = output.trim().split('\n').filter(l => l);
            return lines.map(line => {
                const [name, status] = line.split('\t');
                const isRunning = status.includes('Up');
                const isHealthy = status.includes('healthy');
                return {
                    name: name.replace('heretek-openclaw-core-', ''),
                    running: isRunning,
                    healthy: isHealthy || isRunning,
                    status: status
                };
            });
        } catch (error) {
            return [];
        }
    }

    /**
     * Check system resources
     */
    async checkSystem() {
        const result = {
            name: 'system',
            status: 'healthy',
            details: {}
        };
        
        try {
            // CPU usage
            result.details.cpu = await this.checkCPU();
            
            // Memory usage
            result.details.memory = await this.checkMemory();
            
            // Disk usage
            result.details.disk = await this.checkDisk();
            
            // Docker status
            result.details.docker = await this.checkDocker();
            
        } catch (error) {
            result.status = 'degraded';
            result.details.error = error.message;
        }
        
        this.results.components.system = result;
        return result;
    }

    /**
     * Check CPU usage
     */
    async checkCPU() {
        try {
            const output = execSync("top -bn1 | grep 'Cpu(s)' | awk '{print $2}'", {
                encoding: 'utf8',
                timeout: 5000
            });
            const usage = parseFloat(output) || 0;
            return {
                usage: usage,
                status: usage < 80 ? 'healthy' : 'warning'
            };
        } catch (error) {
            return { usage: 0, status: 'unknown', error: error.message };
        }
    }

    /**
     * Check memory usage
     */
    async checkMemory() {
        try {
            const output = execSync("free | grep Mem | awk '{printf \"%.1f\", $3/$2 * 100.0}'", {
                encoding: 'utf8',
                timeout: 5000
            });
            const usage = parseFloat(output) || 0;
            return {
                usage: usage,
                status: usage < 80 ? 'healthy' : 'warning'
            };
        } catch (error) {
            return { usage: 0, status: 'unknown', error: error.message };
        }
    }

    /**
     * Check disk usage
     */
    async checkDisk() {
        try {
            const output = execSync("df -h / | awk 'NR==2 {print $5}'", {
                encoding: 'utf8',
                timeout: 5000
            });
            const usage = parseFloat(output) || 0;
            return {
                usage: usage,
                status: usage < 80 ? 'healthy' : 'warning'
            };
        } catch (error) {
            return { usage: 0, status: 'unknown', error: error.message };
        }
    }

    /**
     * Check Docker status
     */
    async checkDocker() {
        try {
            execSync('docker info', {
                encoding: 'utf8',
                stdio: 'pipe',
                timeout: 5000
            });
            return { status: 'healthy', running: true };
        } catch (error) {
            return { status: 'unhealthy', running: false, error: error.message };
        }
    }

    /**
     * Aggregate logs from all components
     */
    async aggregateLogs(options = {}) {
        const { filter = 'all', since = '1h', limit = 100 } = options;
        const aggregated = {
            timestamp: new Date().toISOString(),
            entries: [],
            errors: [],
            warnings: []
        };
        
        const components = ['gateway', 'litellm', 'steward', 'alpha', 'beta', 'gamma'];
        
        for (const component of components) {
            try {
                const output = execSync(
                    `docker logs heretek-openclaw-core-${component}-1 --tail ${limit} 2>&1`,
                    { encoding: 'utf8', timeout: 10000 }
                );
                
                const lines = output.split('\n').filter(l => l);
                lines.forEach(line => {
                    const entry = {
                        component,
                        line,
                        timestamp: new Date().toISOString()
                    };
                    
                    aggregated.entries.push(entry);
                    
                    if (line.toLowerCase().includes('error')) {
                        aggregated.errors.push(entry);
                    } else if (line.toLowerCase().includes('warn')) {
                        aggregated.warnings.push(entry);
                    }
                });
            } catch (error) {
                // Container may not exist, skip
            }
        }
        
        // Apply filter
        if (filter === 'errors') {
            return { ...aggregated, entries: aggregated.errors };
        } else if (filter === 'warnings') {
            return { ...aggregated, entries: [...aggregated.errors, ...aggregated.warnings] };
        }
        
        return aggregated;
    }

    /**
     * Calculate health score
     */
    async calculateHealthScore() {
        return this.healthScorer.calculate(this.results);
    }

    /**
     * Generate recommendations based on results
     */
    generateRecommendations() {
        const recommendations = [];
        
        // Check each component and add recommendations
        if (this.results.components.gateway?.status === 'unhealthy') {
            recommendations.push({
                priority: 'high',
                component: 'gateway',
                action: 'Restart Gateway service',
                command: 'docker restart heretek-openclaw-core-gateway-1'
            });
        }
        
        if (this.results.components.litellm?.status === 'unhealthy') {
            recommendations.push({
                priority: 'high',
                component: 'litellm',
                action: 'Restart LiteLLM service',
                command: 'docker restart heretek-openclaw-core-litellm-1'
            });
        }
        
        if (this.results.components.agents?.details?.unhealthy > 0) {
            recommendations.push({
                priority: 'medium',
                component: 'agents',
                action: 'Restart unhealthy agents',
                command: './scripts/lifecycle-manager.sh restart --agents <agent-id>'
            });
        }
        
        if (this.results.config?.issues?.length > 0) {
            recommendations.push({
                priority: 'medium',
                component: 'config',
                action: 'Fix configuration issues',
                command: './scripts/diagnostics.sh config --all --auto-fix'
            });
        }
        
        return recommendations;
    }
}

// CLI execution
if (require.main === module) {
    const { program } = require('commander');
    
    program
        .name('system-diagnostics')
        .description('Comprehensive system diagnostics for OpenClaw')
        .version('1.0.0');
    
    program
        .command('full')
        .description('Run full system diagnostics')
        .option('-v, --verbose', 'Verbose output')
        .option('-j, --json', 'JSON output')
        .option('-o, --output <file>', 'Output to file')
        .action(async (options) => {
            const diagnostics = new SystemDiagnostics();
            const results = await diagnostics.runFull();
            
            if (options.json) {
                console.log(JSON.stringify(results, null, 2));
            } else {
                console.log('\n=== System Diagnostics Report ===\n');
                console.log(`Timestamp: ${results.timestamp}`);
                console.log(`Health Score: ${results.healthScore?.score || 'N/A'}/100`);
                console.log('\nComponent Status:');
                Object.values(results.components).forEach(c => {
                    console.log(`  ${c.name}: ${c.status}`);
                });
                if (results.issues.length > 0) {
                    console.log('\nIssues Found:');
                    results.issues.forEach(i => {
                        console.log(`  [${i.severity}] ${i.component}: ${i.message}`);
                    });
                }
            }
            
            if (options.output) {
                fs.writeFileSync(options.output, JSON.stringify(results, null, 2));
                console.log(`\nReport saved to: ${options.output}`);
            }
        });
    
    program
        .command('health-score')
        .description('Calculate health score')
        .option('-b, --breakdown', 'Show breakdown')
        .action(async (options) => {
            const diagnostics = new SystemDiagnostics();
            await diagnostics.runFull();
            const score = await diagnostics.calculateHealthScore();
            
            console.log(`\nHealth Score: ${score.score}/100 (${score.rating})`);
            
            if (options.breakdown) {
                console.log('\nBreakdown:');
                Object.entries(score.breakdown || {}).forEach(([k, v]) => {
                    console.log(`  ${k}: ${v}`);
                });
            }
        });
    
    program.parse(process.argv);
}

module.exports = SystemDiagnostics;
