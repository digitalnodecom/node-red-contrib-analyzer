const os = require('os');
const PerformanceDatabase = require('../database/performance-db');

class PerformanceMonitor {
    constructor() {
        this.isMonitoring = false;
        this.config = {
            cpuThreshold: 75, // CPU usage percentage
            memoryThreshold: 80, // Memory usage percentage
            eventLoopThreshold: 20, // Event loop lag in milliseconds
            sustainedAlertDuration: 5 * 60 * 1000, // 5 minutes in milliseconds
            alertCooldown: 30 * 60 * 1000, // 30 minutes cooldown between alerts
            dbRetentionDays: 7, // Keep data for 7 days
            pruneInterval: 24 * 60 * 60 * 1000 // Prune every 24 hours
        };
        this.lastCpuUsage = process.cpuUsage();
        this.lastCheck = Date.now();
        this.lastAlertTimes = {
            cpu: 0,
            memory: 0,
            eventLoop: 0
        };
        this.lastPruneTime = 0;
        this.pruningScheduled = false;
        this.db = new PerformanceDatabase();
        this.db.setRetentionDays(this.config.dbRetentionDays);
    }

    // Start monitoring performance metrics
    start() {
        this.isMonitoring = true;
        this.collectMetrics();
        
        // Schedule pruning only once at startup
        if (!this.pruningScheduled) {
            this.schedulePeriodicPruning();
            this.pruningScheduled = true;
        }
    }

    // Stop monitoring
    stop() {
        this.isMonitoring = false;
        if (this.db) {
            this.db.close();
        }
    }

    // Schedule periodic pruning of old data
    schedulePeriodicPruning() {
        const now = Date.now();
        if (now - this.lastPruneTime > this.config.pruneInterval) {
            this.pruneOldData();
            this.lastPruneTime = now;
        }
        
        // Schedule next pruning check in 1 hour (skip in test environment)
        if (process.env.NODE_ENV !== 'test') {
            setTimeout(() => {
                if (this.isMonitoring && this.pruningScheduled) {
                    this.schedulePeriodicPruning();
                }
            }, 60 * 60 * 1000); // 1 hour
        }
    }

    // Prune old data using the database class
    async pruneOldData() {
        try {
            const result = await this.db.pruneOldData(this.config.dbRetentionDays);
            // eslint-disable-next-line no-console
            console.log('Performance monitoring:', result.message);
        } catch (error) {
            // eslint-disable-next-line no-console
            console.error('Error pruning old performance data:', error);
        }
    }

    // Collect current performance metrics
    collectMetrics() {
        const now = Date.now();
        const currentCpuUsage = process.cpuUsage();
        const memoryUsage = process.memoryUsage();
        
        // Calculate CPU usage percentage
        const cpuPercent = this.calculateCpuPercent(currentCpuUsage);
        
        // Calculate memory usage percentage
        const memoryPercent = this.calculateMemoryPercent(memoryUsage);
        
        // Measure event loop lag
        const eventLoopStart = process.hrtime();
        setImmediate(() => {
            if (!this.isMonitoring) return; // Exit if monitoring stopped
            
            const eventLoopLag = process.hrtime(eventLoopStart);
            const lagMs = eventLoopLag[0] * 1000 + eventLoopLag[1] / 1000000;
            
            // Store all metrics in database
            this.storeMetricsInDb(cpuPercent, memoryPercent, memoryUsage.rss, lagMs);
        });
        
        // Update last values
        this.lastCpuUsage = currentCpuUsage;
        this.lastCheck = now;
        
        return {
            cpu: cpuPercent,
            memory: memoryPercent,
            memoryDetails: memoryUsage,
            timestamp: now
        };
    }

    // Store metrics in database
    async storeMetricsInDb(cpuUsage, memoryUsage, memoryRss, eventLoopLag) {
        try {
            await this.db.storeMetrics(cpuUsage, memoryUsage, memoryRss, eventLoopLag);
        } catch (error) {
            console.error('Error storing performance metrics:', error);
        }
    }

    // Calculate CPU usage percentage
    calculateCpuPercent(currentCpuUsage) {
        const timeDiff = Date.now() - this.lastCheck;
        if (timeDiff === 0) return 0;
        
        const userDiff = currentCpuUsage.user - this.lastCpuUsage.user;
        const systemDiff = currentCpuUsage.system - this.lastCpuUsage.system;
        const totalDiff = userDiff + systemDiff;
        
        // Convert microseconds to percentage
        const cpuPercent = (totalDiff / (timeDiff * 1000)) * 100;
        return Math.min(Math.max(cpuPercent, 0), 100);
    }

    // Calculate memory usage percentage
    calculateMemoryPercent(memoryUsage) {
        // Use RSS (Resident Set Size) as the primary memory metric
        const totalMemory = os.totalmem();
        return (memoryUsage.rss / totalMemory) * 100;
    }

    // Get current performance summary with time-based alerting
    async getPerformanceSummary() {
        const current = this.collectMetrics();
        const averages = await this.calculateAverages();
        const alerts = await this.checkSustainedThresholds(current);
        
        return {
            current,
            averages,
            alerts,
            uptime: this.getUptime(),
            processInfo: this.getProcessInfo()
        };
    }

    // Calculate averages from database for recent metrics
    async calculateAverages(windowMinutes = 10) {
        try {
            return await this.db.getAverages(windowMinutes);
        } catch (error) {
            console.error('Error calculating averages:', error);
            return { cpu: 0, memory: 0, eventLoop: 0 };
        }
    }

    // Check if metrics have been above thresholds for sustained periods
    async checkSustainedThresholds(current) {
        const alerts = [];
        const now = Date.now();
        
        // Get average values for the sustained period duration
        const durationMinutes = this.config.sustainedAlertDuration / 60000;
        const averages = await this.calculateAverages(durationMinutes);
        
        // Check CPU sustained threshold
        if (averages.cpu > this.config.cpuThreshold) {
            const sustainedResult = await this.checkSustainedMetric('cpu_usage', this.config.cpuThreshold, this.config.sustainedAlertDuration);
            if (sustainedResult.sustained && (now - this.lastAlertTimes.cpu) > this.config.alertCooldown) {
                alerts.push({
                    type: 'cpu',
                    message: `High CPU usage sustained for ${durationMinutes.toFixed(1)} minutes: ${averages.cpu.toFixed(1)}%`,
                    severity: 'warning',
                    threshold: this.config.cpuThreshold,
                    current: averages.cpu,
                    sustainedDuration: this.config.sustainedAlertDuration
                });
                this.lastAlertTimes.cpu = now;
                await this.recordAlert('cpu', this.config.cpuThreshold, averages.cpu, durationMinutes);
            }
        }
        
        // Check Memory sustained threshold
        if (averages.memory > this.config.memoryThreshold) {
            const sustainedResult = await this.checkSustainedMetric('memory_usage', this.config.memoryThreshold, this.config.sustainedAlertDuration);
            if (sustainedResult.sustained && (now - this.lastAlertTimes.memory) > this.config.alertCooldown) {
                alerts.push({
                    type: 'memory',
                    message: `High memory usage sustained for ${durationMinutes.toFixed(1)} minutes: ${averages.memory.toFixed(1)}%`,
                    severity: 'warning',
                    threshold: this.config.memoryThreshold,
                    current: averages.memory,
                    sustainedDuration: this.config.sustainedAlertDuration
                });
                this.lastAlertTimes.memory = now;
                await this.recordAlert('memory', this.config.memoryThreshold, averages.memory, durationMinutes);
            }
        }
        
        return alerts;
    }

    // Check if a specific metric has been above threshold for sustained duration
    async checkSustainedMetric(metricColumn, threshold, duration) {
        try {
            return await this.db.checkSustainedMetric(metricColumn, threshold, duration);
        } catch (error) {
            console.error('Error checking sustained metric:', error);
            return { sustained: false, ratio: 0, totalReadings: 0, exceedingReadings: 0 };
        }
    }

    // Record alert in database
    async recordAlert(metricType, threshold, currentValue, durationMinutes) {
        try {
            await this.db.recordAlert(metricType, threshold, currentValue, durationMinutes);
        } catch (error) {
            console.error('Error recording alert:', error);
        }
    }

    // Get process uptime
    getUptime() {
        const uptime = process.uptime();
        const hours = Math.floor(uptime / 3600);
        const minutes = Math.floor((uptime % 3600) / 60);
        const seconds = Math.floor(uptime % 60);
        
        return {
            seconds: uptime,
            formatted: `${hours}h ${minutes}m ${seconds}s`
        };
    }

    // Get process information
    getProcessInfo() {
        return {
            pid: process.pid,
            nodeVersion: process.version,
            platform: process.platform,
            arch: process.arch,
            title: process.title
        };
    }

    // Update configuration
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
    }

    // Get recent metrics from database
    async getRecentMetrics(metricType, count = 10) {
        try {
            return await this.db.getRecentMetrics(metricType, count);
        } catch (error) {
            console.error('Error getting recent metrics:', error);
            return [];
        }
    }

    // Clear all metrics history
    async clearHistory() {
        try {
            await this.db.clearAll();
        } catch (error) {
            console.error('Error clearing metrics history:', error);
        }
    }

    // Check if performance monitoring is healthy
    async isHealthy() {
        const summary = await this.getPerformanceSummary();
        return summary.alerts.length === 0;
    }

    // Get performance trend from database
    async getTrend(metricType, windowMinutes = 60) {
        try {
            return await this.db.getTrend(metricType, windowMinutes);
        } catch (error) {
            console.error('Error calculating trend:', error);
            return 'insufficient_data';
        }
    }

    // Get alert history from database
    async getAlertHistory(limitCount = 50) {
        try {
            return await this.db.getAlertHistory(limitCount);
        } catch (error) {
            console.error('Error getting alert history:', error);
            return [];
        }
    }

    // Get database statistics
    async getDatabaseStats() {
        try {
            return await this.db.getStats();
        } catch (error) {
            console.error('Error getting database stats:', error);
            return null;
        }
    }

    // Get database path
    getDatabasePath() {
        return this.db ? this.db.dbPath : null;
    }
}

module.exports = PerformanceMonitor;