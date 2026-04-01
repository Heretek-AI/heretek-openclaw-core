/**
 * Heretek OpenClaw — Log Correlator
 * ==============================================================================
 * Correlates events across multiple component logs.
 */

class LogCorrelator {
    constructor() {
        this.correlationRules = [
            {
                name: 'cascade_failure',
                description: 'Cascade failure detection',
                condition: (events) => this.detectCascadeFailure(events)
            },
            {
                name: 'gateway_agent_disconnect',
                description: 'Gateway-agent disconnection correlation',
                condition: (events) => this.detectGatewayAgentDisconnect(events)
            },
            {
                name: 'litellm_propagation',
                description: 'LiteLLM error propagation',
                condition: (events) => this.detectLiteLLMPropagation(events)
            },
            {
                name: 'triad_deadlock',
                description: 'Triad deliberation deadlock',
                condition: (events) => this.detectTriadDeadlock(events)
            }
        ];
    }

    /**
     * Correlate events across logs
     * @param {Array} logs - Array of log entries
     * @param {Object} options - Correlation options
     * @returns {Object} Correlation results
     */
    correlate(logs, options = {}) {
        const { window = '10m', event = null } = options;
        
        // Sort logs by timestamp
        const sortedLogs = [...logs].sort((a, b) => 
            new Date(a.timestamp) - new Date(b.timestamp)
        );

        // Group by time window
        const timeGroups = this.groupByTimeWindow(sortedLogs, window);

        // Extract events
        const events = this.extractEvents(sortedLogs);

        // Filter by event type if specified
        const filteredEvents = event ? events.filter(e => e.type.includes(event)) : events;

        // Apply correlation rules
        const correlations = {};
        for (const rule of this.correlationRules) {
            const result = rule.condition(filteredEvents);
            if (result) {
                correlations[rule.name] = result;
            }
        }

        return {
            timestamp: new Date().toISOString(),
            events: filteredEvents,
            correlations,
            cascadeFailures: correlations.cascade_failure || null,
            timeWindow: window
        };
    }

    /**
     * Group logs by time window
     */
    groupByTimeWindow(logs, window) {
        const groups = new Map();
        const windowMs = this.parseWindow(window);

        for (const log of logs) {
            const timestamp = new Date(log.timestamp).getTime();
            const bucketStart = Math.floor(timestamp / windowMs) * windowMs;
            
            if (!groups.has(bucketStart)) {
                groups.set(bucketStart, []);
            }
            groups.get(bucketStart).push(log);
        }

        return groups;
    }

    /**
     * Extract significant events from logs
     */
    extractEvents(logs) {
        const events = [];
        const eventPatterns = [
            { type: 'error', regex: /\bERROR\b|\bFATAL\b/i },
            { type: 'warning', regex: /\bWARN(ING)?\b/i },
            { type: 'agent_offline', regex: /agent.*offline/i },
            { type: 'connection_lost', regex: /connection.*lost|WebSocket.*closed/i },
            { type: 'timeout', regex: /timeout|timed out/i },
            { type: 'auth_failure', regex: /unauthorized|invalid.*key|401|403/i },
            { type: 'consensus_failed', regex: /consensus.*failed|deliberation.*failed/i },
            { type: 'skill_error', regex: /skill.*(?:failed|error)/i },
            { type: 'gateway_error', regex: /Gateway.*error|RPC.*error/i },
            { type: 'litellm_error', regex: /LiteLLM.*error|model.*not.*found/i }
        ];

        for (const log of logs) {
            const message = log.message || log.raw || '';
            
            for (const pattern of eventPatterns) {
                if (pattern.regex.test(message)) {
                    events.push({
                        type: pattern.type,
                        timestamp: log.timestamp,
                        component: log.component,
                        message: log.message,
                        level: log.level
                    });
                    break;
                }
            }
        }

        return events.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    }

    /**
     * Detect cascade failure
     */
    detectCascadeFailure(events) {
        // Look for sequential failures across components
        const failureSequence = [];
        const components = new Set();

        for (const event of events.filter(e => e.type === 'error' || e.type.includes('error'))) {
            failureSequence.push(event);
            components.add(event.component);
        }

        // Cascade if 3+ components affected in sequence
        if (components.size >= 3 && failureSequence.length >= 5) {
            const timeSpan = new Date(failureSequence[failureSequence.length - 1].timestamp) - 
                            new Date(failureSequence[0].timestamp);
            
            return {
                detected: true,
                componentsAffected: Array.from(components),
                failureCount: failureSequence.length,
                timeSpanMs: timeSpan,
                firstFailure: failureSequence[0],
                propagation: failureSequence.slice(0, 5)
            };
        }

        return null;
    }

    /**
     * Detect gateway-agent disconnection
     */
    detectGatewayAgentDisconnect(events) {
        const gatewayErrors = events.filter(e => 
            e.component === 'gateway' && e.type.includes('error')
        );
        const agentDisconnects = events.filter(e => 
            e.type === 'agent_offline' || e.type === 'connection_lost'
        );

        // Check for temporal correlation
        const correlated = [];
        for (const gwError of gatewayErrors) {
            const gwTime = new Date(gwError.timestamp).getTime();
            
            for (const disconnect of agentDisconnects) {
                const discTime = new Date(disconnect.timestamp).getTime();
                const timeDiff = Math.abs(gwTime - discTime);
                
                if (timeDiff < 60000) { // Within 1 minute
                    correlated.push({
                        gatewayError: gwError,
                        agentDisconnect: disconnect,
                        timeDiffMs: timeDiff
                    });
                }
            }
        }

        if (correlated.length > 0) {
            return {
                detected: true,
                correlationCount: correlated.length,
                correlations: correlated.slice(0, 5)
            };
        }

        return null;
    }

    /**
     * Detect LiteLLM error propagation
     */
    detectLiteLLMPropagation(events) {
        const litellmErrors = events.filter(e => 
            e.component === 'litellm' || e.type === 'litellm_error'
        );
        
        const downstreamErrors = events.filter(e => 
            e.component !== 'litellm' && 
            e.type.includes('error') &&
            (e.message?.includes('model') || e.message?.includes('completion'))
        );

        const correlated = [];
        for (const llmError of litellmErrors) {
            const llmTime = new Date(llmError.timestamp).getTime();
            
            for (const downstream of downstreamErrors) {
                const downTime = new Date(downstream.timestamp).getTime();
                const timeDiff = downTime - llmTime;
                
                if (timeDiff > 0 && timeDiff < 30000) { // Within 30s after
                    correlated.push({
                        litellmError: llmError,
                        downstreamError: downstream,
                        delayMs: timeDiff
                    });
                }
            }
        }

        if (correlated.length > 0) {
            return {
                detected: true,
                propagationCount: correlated.length,
                propagations: correlated.slice(0, 5)
            };
        }

        return null;
    }

    /**
     * Detect triad deliberation deadlock
     */
    detectTriadDeadlock(events) {
        const triadComponents = ['steward', 'alpha', 'beta', 'gamma'];
        const triadEvents = events.filter(e => triadComponents.includes(e.component));
        
        // Look for consensus failures or repeated deliberation attempts
        const consensusFailures = triadEvents.filter(e => 
            e.type === 'consensus_failed' || e.message?.includes('deadlock')
        );

        if (consensusFailures.length >= 2) {
            return {
                detected: true,
                failureCount: consensusFailures.length,
                components: [...new Set(consensusFailures.map(e => e.component))],
                failures: consensusFailures.slice(0, 5)
            };
        }

        return null;
    }

    /**
     * Parse time window string
     */
    parseWindow(window) {
        const match = window.match(/(\d+)([mhd])/);
        if (!match) return 600000; // Default 10 minutes

        const value = parseInt(match[1]);
        const unit = match[2];

        switch (unit) {
            case 's': return value * 1000;
            case 'm': return value * 60000;
            case 'h': return value * 3600000;
            case 'd': return value * 86400000;
            default: return value * 60000;
        }
    }
}

module.exports = LogCorrelator;
