/**
 * Heretek OpenClaw — Timeline Builder
 * ==============================================================================
 * Reconstructs event timelines from log entries.
 */

class TimelineBuilder {
    constructor() {
        this.eventTypes = {
            critical: ['error', 'fatal', 'critical'],
            warning: ['warn', 'warning'],
            info: ['info', 'notice'],
            debug: ['debug', 'trace']
        };
    }

    /**
     * Build timeline from log entries
     * @param {Array} logs - Array of log entries
     * @param {Object} options - Timeline options
     * @returns {Object} Timeline data
     */
    build(logs, options = {}) {
        const { filter = null, groupBy = 'component', format = 'list' } = options;
        
        // Filter logs
        let filteredLogs = logs;
        if (filter) {
            filteredLogs = this.filterLogs(logs, filter);
        }

        // Sort by timestamp
        const sortedLogs = [...filteredLogs].sort((a, b) => 
            new Date(a.timestamp) - new Date(b.timestamp)
        );

        // Build timeline
        const timeline = {
            startTime: sortedLogs[0]?.timestamp || null,
            endTime: sortedLogs[sortedLogs.length - 1]?.timestamp || null,
            totalEvents: sortedLogs.length,
            events: [],
            groups: {}
        };

        // Create event entries
        for (const log of sortedLogs) {
            const event = this.createEventEntry(log);
            timeline.events.push(event);

            // Group by specified field
            if (groupBy === 'component') {
                if (!timeline.groups[log.component]) {
                    timeline.groups[log.component] = [];
                }
                timeline.groups[log.component].push(event);
            } else if (groupBy === 'level') {
                if (!timeline.groups[log.level]) {
                    timeline.groups[log.level] = [];
                }
                timeline.groups[log.level].push(event);
            }
        }

        // Format output
        if (format === 'summary') {
            return this.formatSummary(timeline);
        }

        return timeline;
    }

    /**
     * Filter logs by type
     */
    filterLogs(logs, filter) {
        switch (filter) {
            case 'errors':
                return logs.filter(l => this.eventTypes.critical.includes(l.level));
            case 'warnings':
                return logs.filter(l => 
                    this.eventTypes.critical.includes(l.level) || 
                    this.eventTypes.warning.includes(l.level)
                );
            case 'critical':
                return logs.filter(l => l.level === 'error' || l.level === 'fatal');
            default:
                return logs;
        }
    }

    /**
     * Create event entry
     */
    createEventEntry(log) {
        return {
            timestamp: log.timestamp,
            level: log.level,
            component: log.component,
            message: this.truncateMessage(log.message),
            type: this.classifyEvent(log.message),
            raw: log.raw
        };
    }

    /**
     * Truncate long messages
     */
    truncateMessage(message, maxLength = 200) {
        if (!message) return '';
        if (message.length <= maxLength) return message;
        return message.substring(0, maxLength - 3) + '...';
    }

    /**
     * Classify event type based on message content
     */
    classifyEvent(message) {
        if (!message) return 'unknown';
        
        const classifications = [
            { type: 'connection', patterns: [/connect/i, /disconnect/i, /WebSocket/i] },
            { type: 'authentication', patterns: [/auth/i, /unauthorized/i, /permission/i] },
            { type: 'timeout', patterns: [/timeout/i, /timed out/i] },
            { type: 'resource', patterns: [/memory/i, /disk/i, /resource/i] },
            { type: 'configuration', patterns: [/config/i, /invalid/i, /missing/i] },
            { type: 'skill', patterns: [/skill/i, /plugin/i, /execute/i] },
            { type: 'gateway', patterns: [/gateway/i, /RPC/i, /A2A/i] },
            { type: 'litellm', patterns: [/LiteLLM/i, /model/i, /completion/i] },
            { type: 'agent', patterns: [/agent/i, /steward/i, /alpha/i, /beta/i] }
        ];

        for (const classification of classifications) {
            for (const pattern of classification.patterns) {
                if (pattern.test(message)) {
                    return classification.type;
                }
            }
        }

        return 'general';
    }

    /**
     * Format as summary
     */
    formatSummary(timeline) {
        const summary = {
            timeRange: {
                start: timeline.startTime,
                end: timeline.endTime,
                duration: this.calculateDuration(timeline.startTime, timeline.endTime)
            },
            totalEvents: timeline.totalEvents,
            byLevel: {},
            byComponent: {},
            byType: {},
            criticalEvents: timeline.events.filter(e => 
                this.eventTypes.critical.includes(e.level)
            ).slice(0, 10)
        };

        // Count by level
        for (const event of timeline.events) {
            summary.byLevel[event.level] = (summary.byLevel[event.level] || 0) + 1;
            summary.byComponent[event.component] = (summary.byComponent[event.component] || 0) + 1;
            summary.byType[event.type] = (summary.byType[event.type] || 0) + 1;
        }

        return summary;
    }

    /**
     * Calculate duration
     */
    calculateDuration(start, end) {
        if (!start || !end) return 'unknown';
        const duration = new Date(end) - new Date(start);
        
        if (duration < 60000) return `${Math.round(duration / 1000)}s`;
        if (duration < 3600000) return `${Math.round(duration / 60000)}m`;
        return `${Math.round(duration / 3600000)}h`;
    }

    /**
     * Export timeline in various formats
     */
    export(timeline, format = 'json') {
        switch (format) {
            case 'json':
                return JSON.stringify(timeline, null, 2);
            case 'csv':
                return this.exportCSV(timeline);
            case 'markdown':
                return this.exportMarkdown(timeline);
            default:
                return JSON.stringify(timeline, null, 2);
        }
    }

    /**
     * Export as CSV
     */
    exportCSV(timeline) {
        const headers = ['timestamp', 'level', 'component', 'type', 'message'];
        const lines = [headers.join(',')];

        for (const event of timeline.events) {
            lines.push([
                event.timestamp,
                event.level,
                event.component,
                event.type,
                `"${(event.message || '').replace(/"/g, '""')}"`
            ].join(','));
        }

        return lines.join('\n');
    }

    /**
     * Export as Markdown
     */
    exportMarkdown(timeline) {
        let md = `# Event Timeline\n\n`;
        md += `**Time Range:** ${timeline.startTime} - ${timeline.endTime}\n`;
        md += `**Total Events:** ${timeline.totalEvents}\n\n`;

        md += `## Events\n\n`;
        md += `| Time | Level | Component | Type | Message |\n`;
        md += `|------|-------|-----------|------|---------|\n`;

        for (const event of timeline.events.slice(0, 50)) {
            md += `| ${event.timestamp} | ${event.level} | ${event.component} | ${event.type} | ${event.message} |\n`;
        }

        return md;
    }
}

module.exports = TimelineBuilder;
