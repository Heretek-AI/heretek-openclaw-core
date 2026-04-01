/**
 * Heretek OpenClaw — Dependency Checker
 * ==============================================================================
 * Verifies system and application dependencies for OpenClaw.
 * 
 * Features:
 *   - System dependency verification (Docker, Node.js, etc.)
 *   - Network connectivity checks
 *   - Port availability verification
 *   - Service dependency validation
 */

const { execSync } = require('child_process');
const fetch = require('node-fetch');

class DependencyChecker {
    constructor(config = {}) {
        this.ports = config.ports || {
            gateway: 18789,
            litellm: 4000,
            postgresql: 5432,
            redis: 6379
        };
    }

    /**
     * Check all dependencies
     * @returns {Promise<Object>} Dependency check results
     */
    async checkAll() {
        const results = {
            timestamp: new Date().toISOString(),
            system: await this.checkSystemDeps(),
            node: await this.checkNodeDeps(),
            docker: await this.checkDockerDeps(),
            network: await this.checkNetworkDeps(),
            services: await this.checkServices()
        };

        results.valid = this.isAllValid(results);
        return results;
    }

    /**
     * Check system dependencies
     */
    async checkSystemDeps() {
        const result = {
            valid: true,
            dependencies: []
        };

        // Check Node.js
        try {
            const nodeVersion = execSync('node --version', { encoding: 'utf8' }).trim();
            result.dependencies.push({
                name: 'node',
                required: true,
                installed: true,
                version: nodeVersion
            });
        } catch (error) {
            result.dependencies.push({
                name: 'node',
                required: true,
                installed: false,
                error: 'Node.js not found'
            });
            result.valid = false;
        }

        // Check npm
        try {
            const npmVersion = execSync('npm --version', { encoding: 'utf8' }).trim();
            result.dependencies.push({
                name: 'npm',
                required: true,
                installed: true,
                version: npmVersion
            });
        } catch (error) {
            result.dependencies.push({
                name: 'npm',
                required: true,
                installed: false,
                error: 'npm not found'
            });
        }

        // Check git
        try {
            const gitVersion = execSync('git --version', { encoding: 'utf8' }).trim();
            result.dependencies.push({
                name: 'git',
                required: false,
                installed: true,
                version: gitVersion
            });
        } catch (error) {
            result.dependencies.push({
                name: 'git',
                required: false,
                installed: false
            });
        }

        return result;
    }

    /**
     * Check Node.js dependencies
     */
    async checkNodeDeps() {
        const result = {
            valid: true,
            dependencies: []
        };

        try {
            // Check for package.json
            const pkgPath = process.cwd() + '/package.json';
            const fs = require('fs');
            
            if (!fs.existsSync(pkgPath)) {
                result.dependencies.push({
                    name: 'package.json',
                    required: true,
                    installed: false
                });
                result.valid = false;
                return result;
            }

            const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
            const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };

            // Check key dependencies
            const keyDeps = ['ws', 'node-fetch'];
            keyDeps.forEach(dep => {
                try {
                    require.resolve(dep);
                    result.dependencies.push({
                        name: dep,
                        required: true,
                        installed: true,
                        version: allDeps[dep] || 'unknown'
                    });
                } catch (error) {
                    result.dependencies.push({
                        name: dep,
                        required: true,
                        installed: false
                    });
                    result.valid = false;
                }
            });

        } catch (error) {
            result.valid = false;
            result.error = error.message;
        }

        return result;
    }

    /**
     * Check Docker dependencies
     */
    async checkDockerDeps() {
        const result = {
            valid: true,
            dependencies: []
        };

        // Check Docker
        try {
            const dockerVersion = execSync('docker --version', { encoding: 'utf8' }).trim();
            result.dependencies.push({
                name: 'docker',
                required: true,
                installed: true,
                version: dockerVersion
            });

            // Check Docker is running
            try {
                execSync('docker info', { encoding: 'utf8', stdio: 'pipe' });
                result.dependencies.push({
                    name: 'docker-daemon',
                    required: true,
                    running: true
                });
            } catch (error) {
                result.dependencies.push({
                    name: 'docker-daemon',
                    required: true,
                    running: false,
                    error: 'Docker daemon not running'
                });
                result.valid = false;
            }

        } catch (error) {
            result.dependencies.push({
                name: 'docker',
                required: true,
                installed: false,
                error: 'Docker not found'
            });
            result.valid = false;
        }

        // Check docker-compose
        try {
            const composeVersion = execSync('docker compose version', { encoding: 'utf8' }).trim();
            result.dependencies.push({
                name: 'docker-compose',
                required: true,
                installed: true,
                version: composeVersion
            });
        } catch (error) {
            // Try old docker-compose command
            try {
                const composeVersion = execSync('docker-compose --version', { encoding: 'utf8' }).trim();
                result.dependencies.push({
                    name: 'docker-compose',
                    required: true,
                    installed: true,
                    version: composeVersion
                });
            } catch (error2) {
                result.dependencies.push({
                    name: 'docker-compose',
                    required: true,
                    installed: false,
                    error: 'docker-compose not found'
                });
            }
        }

        return result;
    }

    /**
     * Check network dependencies
     */
    async checkNetworkDeps() {
        const result = {
            valid: true,
            connections: []
        };

        // Check localhost connectivity
        const hosts = [
            { name: 'localhost', host: '127.0.0.1' },
            { name: 'gateway', host: '127.0.0.1', port: this.ports.gateway },
            { name: 'litellm', host: '127.0.0.1', port: this.ports.litellm }
        ];

        for (const target of hosts) {
            const connResult = await this.checkConnectivity(target.host, target.port);
            result.connections.push({
                name: target.name,
                host: target.host,
                port: target.port,
                ...connResult
            });
            
            if (!connResult.reachable && target.port) {
                result.valid = false;
            }
        }

        return result;
    }

    /**
     * Check connectivity to a host:port
     */
    async checkConnectivity(host, port) {
        if (!port) {
            // Just ping the host
            try {
                execSync(`ping -c 1 -W 2 ${host}`, { encoding: 'utf8', stdio: 'pipe' });
                return { reachable: true, latency: 'unknown' };
            } catch (error) {
                return { reachable: false, error: 'Host unreachable' };
            }
        }

        // Check port
        try {
            const response = await fetch(`http://${host}:${port}/health`, {
                method: 'GET',
                timeout: 3000
            });
            return {
                reachable: true,
                latency: response.headers.get('x-response-time') || 'unknown',
                status: response.status
            };
        } catch (error) {
            return {
                reachable: false,
                error: error.message
            };
        }
    }

    /**
     * Check service dependencies
     */
    async checkServices() {
        const result = {
            valid: true,
            services: []
        };

        const services = [
            { name: 'postgresql', port: this.ports.postgresql, check: 'pg_isready' },
            { name: 'redis', port: this.ports.redis, check: 'redis-cli ping' },
            { name: 'gateway', port: this.ports.gateway, check: null },
            { name: 'litellm', port: this.ports.litellm, check: null }
        ];

        for (const service of services) {
            let status = { name: service.name, port: service.port };

            if (service.check === 'pg_isready') {
                try {
                    execSync(`pg_isready -h localhost -p ${service.port}`, {
                        encoding: 'utf8',
                        stdio: 'pipe'
                    });
                    status.running = true;
                } catch (error) {
                    status.running = false;
                    status.error = 'PostgreSQL not ready';
                }
            } else if (service.check === 'redis-cli ping') {
                try {
                    const result = execSync(`redis-cli -p ${service.port} ping`, {
                        encoding: 'utf8',
                        stdio: 'pipe'
                    });
                    status.running = result.trim() === 'PONG';
                } catch (error) {
                    status.running = false;
                    status.error = 'Redis not responding';
                }
            } else {
                // HTTP health check
                try {
                    const response = await fetch(`http://127.0.0.1:${service.port}/health`, {
                        method: 'GET',
                        timeout: 3000
                    });
                    status.running = response.ok;
                    status.status = response.status;
                } catch (error) {
                    status.running = false;
                    status.error = error.message;
                }
            }

            result.services.push(status);
            if (!status.running) {
                result.valid = false;
            }
        }

        return result;
    }

    /**
     * Check if all results are valid
     */
    isAllValid(results) {
        return results.system?.valid && 
               results.node?.valid && 
               results.docker?.valid && 
               results.network?.valid && 
               results.services?.valid;
    }
}

module.exports = DependencyChecker;
