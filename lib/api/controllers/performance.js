const PerformanceDatabase = require('../../database/performance-db');

const performanceDb = new PerformanceDatabase();

// Get current performance summary
async function getPerformanceSummary(req, res) {
    try {
        const db = req.db || require('../../database/db').getDatabase();
        
        // Get most recent performance metrics
        const recentMetrics = await db.get(`
            SELECT * FROM performance_metrics 
            ORDER BY timestamp DESC 
            LIMIT 1
        `);

        // Get recent averages (10 minutes)
        const windowMs = 10 * 60 * 1000;
        const cutoffTime = Date.now() - windowMs;
        
        const averages = await db.get(`
            SELECT 
                AVG(cpu_usage) as cpu,
                AVG(memory_usage) as memory,
                AVG(event_loop_lag) as eventLoopLag
            FROM performance_metrics 
            WHERE timestamp > ?
        `, [cutoffTime]);

        // Get any recent alerts
        const recentAlerts = await db.all(`
            SELECT * FROM performance_alerts 
            ORDER BY created_at DESC 
            LIMIT 5
        `);

        // Get database stats
        const dbStats = await db.get(`
            SELECT 
                COUNT(*) as totalMetrics,
                MIN(timestamp) as oldestMetric,
                MAX(timestamp) as newestMetric
            FROM performance_metrics
        `);

        const currentMetrics = recentMetrics ? {
            cpu: recentMetrics.cpu_usage,
            memory: recentMetrics.memory_usage,
            eventLoopLag: recentMetrics.event_loop_lag,
            timestamp: recentMetrics.timestamp
        } : {
            cpu: 0,
            memory: 0,
            eventLoopLag: 0,
            timestamp: Date.now()
        };

        res.json({
            summary: {
                cpu: currentMetrics.cpu,
                memory: currentMetrics.memory,
                eventLoopLag: currentMetrics.eventLoopLag,
                monitoring: true, // Assume monitoring is enabled if we have data
                interval: 10,
                cpuThreshold: 75,
                memoryThreshold: 80,
                eventLoopThreshold: 20,
                retentionDays: 7
            },
            current: currentMetrics,
            averages: {
                cpu: Math.round((averages?.cpu || 0) * 100) / 100,
                memory: Math.round((averages?.memory || 0) * 100) / 100,
                eventLoop: Math.round((averages?.eventLoopLag || 0) * 100) / 100
            },
            recentAlerts: recentAlerts || [],
            statistics: {
                totalMetrics: dbStats?.totalMetrics || 0,
                oldestMetric: dbStats?.oldestMetric,
                newestMetric: dbStats?.newestMetric
            }
        });
    } catch (error) {
        console.error('Error getting performance summary:', error);
        res.status(500).json({ error: 'Failed to get performance summary' });
    }
}

// Get performance history for charts
async function getPerformanceHistory(req, res) {
    try {
        const db = req.db || require('../../database/db').getDatabase();
        const count = parseInt(req.query.count) || 20;

        const metrics = await db.all(`
            SELECT 
                id,
                timestamp,
                cpu_usage,
                memory_usage,
                memory_rss,
                event_loop_lag,
                created_at
            FROM performance_metrics 
            ORDER BY timestamp DESC 
            LIMIT ?
        `, [count]);

        // Format for frontend consumption
        const formattedMetrics = (metrics || []).reverse().map(metric => ({
            id: metric.id,
            created_at: metric.created_at,
            cpu_usage: Math.round(metric.cpu_usage * 100) / 100,
            memory_usage: Math.round(metric.memory_usage * 100) / 100,
            memory_rss: metric.memory_rss,
            event_loop_lag: Math.round(metric.event_loop_lag * 100) / 100
        }));

        res.json({
            history: formattedMetrics,
            count: formattedMetrics.length
        });
    } catch (error) {
        console.error('Error getting performance history:', error);
        res.status(500).json({ error: 'Failed to get performance history' });
    }
}

// Get recent alerts
async function getAlerts(req, res) {
    try {
        const db = req.db || require('../../database/db').getDatabase();
        const limit = parseInt(req.query.limit) || 10;
        
        const alerts = await db.all(`
            SELECT * FROM performance_alerts 
            ORDER BY created_at DESC 
            LIMIT ?
        `, [limit]);

        const formattedAlerts = (alerts || []).map(alert => ({
            id: alert.id,
            metric_type: alert.metric_type,
            threshold_value: alert.threshold_value,
            actual_value: Math.round(alert.actual_value * 100) / 100,
            duration_minutes: alert.duration_minutes,
            created_at: alert.created_at,
            severity: getSeverityLevel(alert.metric_type, alert.actual_value, alert.threshold_value)
        }));

        res.json({
            alerts: formattedAlerts,
            count: formattedAlerts.length
        });
    } catch (error) {
        console.error('Error getting alerts:', error);
        res.status(500).json({ error: 'Failed to get alerts' });
    }
}

// Helper function to determine alert severity
function getSeverityLevel(metricType, actualValue, threshold) {
    const ratio = actualValue / threshold;
    
    if (ratio >= 1.5) return 'critical';
    if (ratio >= 1.2) return 'warning';
    return 'info';
}

module.exports = {
    getPerformanceSummary,
    getPerformanceHistory,
    getAlerts
};