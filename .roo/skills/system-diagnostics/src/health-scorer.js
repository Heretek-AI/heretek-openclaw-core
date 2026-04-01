/**
 * Heretek OpenClaw — Health Scorer
 * ==============================================================================
 * Calculates overall system health score (0-100) based on component status.
 * 
 * Scoring weights:
 *   - Gateway: 25%
 *   - LiteLLM: 25%
 *   - Database: 20%
 *   - Agents: 20%
 *   - System: 10%
 */

class HealthScorer {
    constructor(config = {}) {
        this.weights = config.weights || {
            gateway: 0.25,
            litellm: 0.25,
            database: 0.20,
            agents: 0.20,
            system: 0.10
        };

        this.statusScores = {
            healthy: 100,
            degraded: 50,
            unhealthy: 0,
            unknown: 25
        };
    }

    /**
     * Calculate health score from diagnostic results
     * @param {Object} results - Diagnostic results
     * @returns {Object} Health score with breakdown
     */
    calculate(results) {
        const breakdown = {};
        let totalScore = 0;
        let totalWeight = 0;

        // Score each component
        for (const [component, weight] of Object.entries(this.weights)) {
            const componentResult = results.components?.[component];
            if (componentResult) {
                const score = this.scoreComponent(componentResult);
                breakdown[component] = {
                    score: score,
                    weight: weight,
                    weightedScore: score * weight
                };
                totalScore += score * weight;
                totalWeight += weight;
            }
        }

        // Normalize score
        const finalScore = totalWeight > 0 ? Math.round(totalScore / totalWeight) : 0;

        return {
            score: finalScore,
            rating: this.getRating(finalScore),
            breakdown: this.formatBreakdown(breakdown),
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Score an individual component
     */
    scoreComponent(component) {
        const status = component.status || 'unknown';
        
        // Base score from status
        let score = this.statusScores[status] || 25;

        // Apply modifiers based on component details
        if (component.name === 'gateway') {
            // Modifier: WebSocket connectivity
            if (component.details?.websocket?.connected === false) {
                score -= 25;
            }
            // Modifier: Response time
            const responseTime = parseFloat(component.details?.responseTime) || 0;
            if (responseTime > 5000) {
                score -= 10;
            }
        } else if (component.name === 'litellm') {
            // Modifier: Model availability
            if ((component.details?.models || 0) === 0) {
                score -= 20;
            }
        } else if (component.name === 'database') {
            // Modifier: Both PostgreSQL and Redis must be healthy
            const pgStatus = component.details?.postgresql?.status;
            const redisStatus = component.details?.redis?.status;
            if (pgStatus === 'unhealthy' || redisStatus === 'unhealthy') {
                score = 0;
            } else if (pgStatus !== 'healthy' || redisStatus !== 'healthy') {
                score -= 25;
            }
        } else if (component.name === 'agents') {
            // Modifier: Agent health ratio
            const total = component.details?.total || 0;
            const healthy = component.details?.healthy || 0;
            if (total > 0) {
                const healthRatio = healthy / total;
                score = Math.round(score * healthRatio);
            }
        } else if (component.name === 'system') {
            // Modifier: Resource usage
            const cpu = component.details?.cpu?.usage || 0;
            const memory = component.details?.memory?.usage || 0;
            const disk = component.details?.disk?.usage || 0;
            
            if (cpu > 90) score -= 20;
            else if (cpu > 80) score -= 10;
            
            if (memory > 90) score -= 20;
            else if (memory > 80) score -= 10;
            
            if (disk > 90) score -= 20;
            else if (disk > 80) score -= 10;
        }

        return Math.max(0, Math.min(100, score));
    }

    /**
     * Get rating label from score
     */
    getRating(score) {
        if (score >= 90) return 'Excellent';
        if (score >= 75) return 'Good';
        if (score >= 50) return 'Degraded';
        if (score >= 25) return 'Critical';
        return 'Failed';
    }

    /**
     * Format breakdown for display
     */
    formatBreakdown(breakdown) {
        const formatted = {};
        for (const [key, value] of Object.entries(breakdown)) {
            formatted[key] = `${value.weightedScore.toFixed(0)}/${(value.weight * 100).toFixed(0)}`;
        }
        return formatted;
    }
}

module.exports = HealthScorer;
