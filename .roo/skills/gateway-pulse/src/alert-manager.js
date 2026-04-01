/**
 * Alert Manager - Alert Generation and Management
 * ==============================================================================
 * Manages alert thresholds, generates alerts, and handles auto-remediation.
 * Supports warning and critical severity levels.
 */

const EventEmitter = require('events');

// Alert severity levels
const AlertSeverity = {
    INFO: 'info',
    WARNING: 'warning',
    CRITICAL: 'critical'
};

// Alert types
const AlertType = {
    LATENCY_HIGH: 'latency_high',
    SERVICE_DOWN: 'service_down',
    ERROR_RATE_HIGH: 'error_rate_high',
    WEBSOCKET_DISCONNECTED: 'websocket_disconnected',
    MEMORY_HIGH: 'memory_high',
    CPU_HIGH: 'cpu_high',
    DISK_LOW: 'disk_low'
};

// Default thresholds
const DEFAULT_THRESHOLDS = {
    latency: {
        warning: 5000,    // 5 seconds
        critical: 10000   // 10 seconds
    },
    errorRate: {
        warning: 5,       // 5%
        critical: 20      // 20%
    },
    memory: {
        warning: 80,      // 80%
        critical: 95      // 95%
    },
    cpu: {
        warning: 80,      // 80%
        critical: 95      // 95%
    },
    disk: {
        warning: 80,      // 80%
        critical: 95      // 95%
    }
};

class AlertManager extends EventEmitter {
    constructor(config = {}) {
        super();
        this.thresholds = { ...DEFAULT_THRESHOLDS, ...config.thresholds };
        this.alerts = [];
        this.maxAlerts = config.maxAlerts || 1000;
        this.alertHistory = [];
        this.autoRemediate = config.autoRemediate || false;
        this.remediationActions = config.remediationActions || [];
        this.suppressedAlerts = new Set();
    }

    /**
     * Check health result against thresholds and generate alerts
     * @param {Object} healthResult - Health check result
     * @returns {Array<Object>} Generated alerts
     */
    checkThresholds(healthResult) {
        const alerts = [];

        // Check latency
        if (healthResult.latency !== null) {
            if (healthResult.latency >= this.thresholds.latency.critical) {
                alerts.push(this._createAlert({
                    type: AlertType.LATENCY_HIGH,
                    severity: AlertSeverity.CRITICAL,
                    service: healthResult.service || 'unknown',
                    message: `Critical latency: ${healthResult.latency}ms (threshold: ${this.thresholds.latency.critical}ms)`,
                    value: healthResult.latency,
                    threshold: this.thresholds.latency.critical
                }));
            } else if (healthResult.latency >= this.thresholds.latency.warning) {
                alerts.push(this._createAlert({
                    type: AlertType.LATENCY_HIGH,
                    severity: AlertSeverity.WARNING,
                    service: healthResult.service || 'unknown',
                    message: `High latency: ${healthResult.latency}ms (threshold: ${this.thresholds.latency.warning}ms)`,
                    value: healthResult.latency,
                    threshold: this.thresholds.latency.warning
                }));
            }
        }

        // Check service health
        if (!healthResult.healthy && !healthResult.error?.includes('timeout')) {
            alerts.push(this._createAlert({
                type: AlertType.SERVICE_DOWN,
                severity: AlertSeverity.CRITICAL,
                service: healthResult.service || 'unknown',
                message: `Service unhealthy: ${healthResult.error || 'Health check failed'}`,
                error: healthResult.error
            }));
        }

        // Process each alert
        for (const alert of alerts) {
            this._processAlert(alert);
        }

        return alerts;
    }

    /**
     * Check error rate against thresholds
     * @param {number} errorRate - Current error rate percentage
     * @param {string} service - Service name
     * @returns {Array<Object>} Generated alerts
     */
    checkErrorRate(errorRate, service) {
        const alerts = [];

        if (errorRate >= this.thresholds.errorRate.critical) {
            alerts.push(this._createAlert({
                type: AlertType.ERROR_RATE_HIGH,
                severity: AlertSeverity.CRITICAL,
                service,
                message: `Critical error rate: ${errorRate.toFixed(1)}% (threshold: ${this.thresholds.errorRate.critical}%)`,
                value: errorRate,
                threshold: this.thresholds.errorRate.critical
            }));
        } else if (errorRate >= this.thresholds.errorRate.warning) {
            alerts.push(this._createAlert({
                type: AlertType.ERROR_RATE_HIGH,
                severity: AlertSeverity.WARNING,
                service,
                message: `High error rate: ${errorRate.toFixed(1)}% (threshold: ${this.thresholds.errorRate.warning}%)`,
                value: errorRate,
                threshold: this.thresholds.errorRate.warning
            }));
        }

        for (const alert of alerts) {
            this._processAlert(alert);
        }

        return alerts;
    }

    /**
     * Create alert object
     * @private
     */
    _createAlert(alertData) {
        return {
            id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            timestamp: new Date().toISOString(),
            acknowledged: false,
            resolved: false,
            ...alertData
        };
    }

    /**
     * Process alert (store, emit, remediate)
     * @private
     */
    _processAlert(alert) {
        // Check if suppressed
        if (this.suppressedAlerts.has(alert.type)) {
            return;
        }

        // Store alert
        this.alerts.push(alert);
        this.alertHistory.push(alert);

        // Trim if needed
        if (this.alerts.length > this.maxAlerts) {
            this.alerts.shift();
        }
        if (this.alertHistory.length > this.maxAlerts) {
            this.alertHistory.shift();
        }

        // Emit event
        this.emit('alert:generated', alert);

        // Auto-remediate if enabled and critical
        if (this.autoRemediate && alert.severity === AlertSeverity.CRITICAL) {
            this._triggerRemediation(alert);
        }
    }

    /**
     * Trigger remediation for an alert
     * @private
     */
    _triggerRemediation(alert) {
        const remediation = {
            alertId: alert.id,
            alertType: alert.type,
            service: alert.service,
            timestamp: new Date().toISOString(),
            actions: []
        };

        // Determine remediation action based on alert type and service
        if (alert.type === AlertType.SERVICE_DOWN) {
            remediation.actions.push({
                type: 'restart_service',
                service: alert.service,
                reason: 'Service down - attempting restart'
            });
        } else if (alert.type === AlertType.WEBSOCKET_DISCONNECTED) {
            remediation.actions.push({
                type: 'reconnect_websocket',
                service: alert.service,
                reason: 'WebSocket disconnected - attempting reconnect'
            });
        }

        // Execute remediation actions
        for (const action of remediation.actions) {
            this.emit('remediation:execute', { alert, action });
        }

        this.emit('remediation:triggered', remediation);
    }

    /**
     * Acknowledge an alert
     * @param {string} alertId - Alert ID
     * @param {string} acknowledgedBy - User/system acknowledging
     */
    acknowledgeAlert(alertId, acknowledgedBy = 'system') {
        const alert = this.alerts.find(a => a.id === alertId);

        if (alert) {
            alert.acknowledged = true;
            alert.acknowledgedBy = acknowledgedBy;
            alert.acknowledgedAt = new Date().toISOString();
            this.emit('alert:acknowledged', alert);
        }
    }

    /**
     * Resolve an alert
     * @param {string} alertId - Alert ID
     * @param {string} resolution - Resolution notes
     */
    resolveAlert(alertId, resolution = '') {
        const alert = this.alerts.find(a => a.id === alertId);

        if (alert) {
            alert.resolved = true;
            alert.resolution = resolution;
            alert.resolvedAt = new Date().toISOString();
            this.emit('alert:resolved', alert);
        }
    }

    /**
     * Get active (unacknowledged) alerts
     * @returns {Array<Object>} Active alerts
     */
    getActiveAlerts() {
        return this.alerts.filter(a => !a.acknowledged && !a.resolved);
    }

    /**
     * Get all alerts
     * @param {Object} filter - Filter options
     * @returns {Array<Object>} Filtered alerts
     */
    getAlerts(filter = {}) {
        let alerts = [...this.alerts];

        if (filter.severity) {
            alerts = alerts.filter(a => a.severity === filter.severity);
        }
        if (filter.type) {
            alerts = alerts.filter(a => a.type === filter.type);
        }
        if (filter.service) {
            alerts = alerts.filter(a => a.service === filter.service);
        }
        if (filter.acknowledged !== undefined) {
            alerts = alerts.filter(a => a.acknowledged === filter.acknowledged);
        }
        if (filter.resolved !== undefined) {
            alerts = alerts.filter(a => a.resolved === filter.resolved);
        }

        return alerts;
    }

    /**
     * Get alert history
     * @param {number} limit - Maximum alerts to return
     * @returns {Array<Object>} Alert history
     */
    getHistory(limit = 100) {
        return this.alertHistory.slice(-limit);
    }

    /**
     * Get alert summary
     * @returns {Object} Alert summary
     */
    getSummary() {
        const alerts = this.alerts;
        const now = new Date();
        const oneHourAgo = new Date(now.getTime() - 3600000);

        const recentAlerts = alerts.filter(a => new Date(a.timestamp) > oneHourAgo);

        return {
            total: alerts.length,
            active: this.getActiveAlerts().length,
            acknowledged: alerts.filter(a => a.acknowledged && !a.resolved).length,
            resolved: alerts.filter(a => a.resolved).length,
            bySeverity: {
                critical: alerts.filter(a => a.severity === AlertSeverity.CRITICAL).length,
                warning: alerts.filter(a => a.severity === AlertSeverity.WARNING).length,
                info: alerts.filter(a => a.severity === AlertSeverity.INFO).length
            },
            lastHour: recentAlerts.length,
            thresholds: this.thresholds
        };
    }

    /**
     * Suppress alert type
     * @param {string} type - Alert type to suppress
     */
    suppressAlertType(type) {
        this.suppressedAlerts.add(type);
    }

    /**
     * Unsuppress alert type
     * @param {string} type - Alert type to unsuppress
     */
    unsuppressAlertType(type) {
        this.suppressedAlerts.delete(type);
    }

    /**
     * Update thresholds
     * @param {Object} newThresholds - New threshold values
     */
    updateThresholds(newThresholds) {
        this.thresholds = { ...this.thresholds, ...newThresholds };
        this.emit('thresholds:updated', this.thresholds);
    }

    /**
     * Enable/disable auto-remediation
     * @param {boolean} enabled - Enable state
     */
    setAutoRemediate(enabled) {
        this.autoRemediate = enabled;
        this.emit('autoRemediate:changed', enabled);
    }

    /**
     * Clear all alerts
     */
    clearAlerts() {
        this.alerts = [];
        this.emit('alerts:cleared');
    }
}

module.exports = {
    AlertManager,
    AlertSeverity,
    AlertType,
    DEFAULT_THRESHOLDS
};
