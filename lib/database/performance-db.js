const { getDatabase } = require('./db');

class PerformanceDatabase {
    constructor() {
        this.retentionDays = 7;
        this.initialized = true; // Always initialized through main db
    }

    get db() {
        return getDatabase();
    }

    setRetentionDays(days) {
        this.retentionDays = days;
    }

    async storeMetrics(cpuUsage, memoryUsage, memoryRss, eventLoopLag) {
        const timestamp = Date.now();
        return new Promise((resolve, reject) => {
            const stmt = this.db.prepare(`
                INSERT INTO performance_metrics 
                (timestamp, cpu_usage, memory_usage, memory_rss, event_loop_lag) 
                VALUES (?, ?, ?, ?, ?)
            `);
            
            stmt.run([timestamp, cpuUsage, memoryUsage, memoryRss, eventLoopLag], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ id: this.lastID });
                }
            });
            
            stmt.finalize();
        });
    }

    async getAverages(windowMinutes = 10) {
        const windowMs = windowMinutes * 60 * 1000;
        const cutoffTime = Date.now() - windowMs;
        
        return new Promise((resolve, reject) => {
            this.db.get(`
                SELECT 
                    AVG(cpu_usage) as cpu,
                    AVG(memory_usage) as memory,
                    AVG(event_loop_lag) as eventLoop
                FROM performance_metrics 
                WHERE timestamp > ?
            `, [cutoffTime], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve({
                        cpu: row?.cpu || 0,
                        memory: row?.memory || 0,
                        eventLoop: row?.eventLoop || 0
                    });
                }
            });
        });
    }

    async checkSustainedMetric(metricColumn, threshold, duration) {
        const cutoffTime = Date.now() - duration;
        
        return new Promise((resolve, reject) => {
            this.db.get(`
                SELECT 
                    COUNT(*) as totalReadings,
                    SUM(CASE WHEN ${metricColumn} > ? THEN 1 ELSE 0 END) as exceedingReadings
                FROM performance_metrics 
                WHERE timestamp > ?
            `, [threshold, cutoffTime], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    const totalReadings = row?.totalReadings || 0;
                    const exceedingReadings = row?.exceedingReadings || 0;
                    const ratio = totalReadings > 0 ? exceedingReadings / totalReadings : 0;
                    
                    resolve({
                        sustained: ratio > 0.8, // 80% of readings exceed threshold
                        ratio,
                        totalReadings,
                        exceedingReadings
                    });
                }
            });
        });
    }

    async recordAlert(metricType, threshold, currentValue, durationMinutes) {
        return new Promise((resolve, reject) => {
            const stmt = this.db.prepare(`
                INSERT INTO performance_alerts 
                (metric_type, threshold_value, actual_value, duration_minutes) 
                VALUES (?, ?, ?, ?)
            `);
            
            stmt.run([metricType, threshold, currentValue, durationMinutes], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ id: this.lastID });
                }
            });
            
            stmt.finalize();
        });
    }

    async pruneOldData(retentionDays = this.retentionDays) {
        const cutoffTime = Date.now() - (retentionDays * 24 * 60 * 60 * 1000);
        
        return new Promise((resolve, reject) => {
            this.db.serialize(() => {
                this.db.run(`DELETE FROM performance_metrics WHERE timestamp < ?`, [cutoffTime], function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        const metricsDeleted = this.changes;
                        
                        this.db.run(`DELETE FROM performance_alerts WHERE created_at < datetime(?, 'unixepoch')`, [cutoffTime / 1000], function(err) {
                            if (err) {
                                reject(err);
                            } else {
                                const alertsDeleted = this.changes;
                                resolve({
                                    message: `Pruned ${metricsDeleted} performance metrics and ${alertsDeleted} alerts older than ${retentionDays} days`,
                                    metricsDeleted,
                                    alertsDeleted
                                });
                            }
                        });
                    }
                });
            });
        });
    }

    async storeCodeQualityMetrics(flowId, flowName, totalIssues, nodesWithIssues, nodesWithCriticalIssues, totalFunctionNodes, issueTypes, qualityScore, complexityScore) {
        return new Promise((resolve, reject) => {
            const stmt = this.db.prepare(`
                INSERT INTO code_quality_metrics 
                (flow_id, flow_name, total_issues, nodes_with_issues, nodes_with_critical_issues, 
                 total_function_nodes, issue_types, quality_score, complexity_score) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);
            
            stmt.run([
                flowId, flowName, totalIssues, nodesWithIssues, nodesWithCriticalIssues,
                totalFunctionNodes, JSON.stringify(issueTypes), qualityScore, complexityScore
            ], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ id: this.lastID });
                }
            });
            
            stmt.finalize();
        });
    }

    async getRecentMetrics(metricType, count = 10) {
        const columnMap = {
            cpu: 'cpu_usage',
            memory: 'memory_usage',
            eventLoop: 'event_loop_lag'
        };
        
        const column = columnMap[metricType] || 'cpu_usage';
        
        return new Promise((resolve, reject) => {
            this.db.all(`
                SELECT timestamp, ${column} as value 
                FROM performance_metrics 
                ORDER BY timestamp DESC 
                LIMIT ?
            `, [count], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows || []);
                }
            });
        });
    }

    async clearAll() {
        return new Promise((resolve, reject) => {
            this.db.serialize(() => {
                this.db.run(`DELETE FROM performance_metrics`, (err) => {
                    if (err) {
                        reject(err);
                    } else {
                        this.db.run(`DELETE FROM performance_alerts`, (err) => {
                            if (err) {
                                reject(err);
                            } else {
                                this.db.run(`DELETE FROM code_quality_metrics`, (err) => {
                                    if (err) {
                                        reject(err);
                                    } else {
                                        resolve({ message: 'All metrics cleared successfully' });
                                    }
                                });
                            }
                        });
                    }
                });
            });
        });
    }

    async getTrend(metricType, windowMinutes = 60) {
        const columnMap = {
            cpu: 'cpu_usage',
            memory: 'memory_usage',
            eventLoop: 'event_loop_lag'
        };
        
        const column = columnMap[metricType] || 'cpu_usage';
        const windowMs = windowMinutes * 60 * 1000;
        const cutoffTime = Date.now() - windowMs;
        
        return new Promise((resolve, reject) => {
            this.db.all(`
                SELECT ${column} as value 
                FROM performance_metrics 
                WHERE timestamp > ? 
                ORDER BY timestamp ASC
            `, [cutoffTime], (err, rows) => {
                if (err) {
                    reject(err);
                } else if (!rows || rows.length < 2) {
                    resolve('insufficient_data');
                } else {
                    const values = rows.map(r => r.value);
                    const firstHalf = values.slice(0, Math.floor(values.length / 2));
                    const secondHalf = values.slice(Math.floor(values.length / 2));
                    
                    const firstAvg = firstHalf.reduce((a, b) => a + b) / firstHalf.length;
                    const secondAvg = secondHalf.reduce((a, b) => a + b) / secondHalf.length;
                    
                    const percentChange = ((secondAvg - firstAvg) / firstAvg) * 100;
                    
                    if (Math.abs(percentChange) < 5) {
                        resolve('stable');
                    } else if (percentChange > 0) {
                        resolve('increasing');
                    } else {
                        resolve('decreasing');
                    }
                }
            });
        });
    }

    async getAlertHistory(limitCount = 50) {
        return new Promise((resolve, reject) => {
            this.db.all(`
                SELECT * FROM performance_alerts 
                ORDER BY created_at DESC 
                LIMIT ?
            `, [limitCount], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows || []);
                }
            });
        });
    }

    async getStats() {
        return new Promise((resolve, reject) => {
            this.db.serialize(() => {
                this.db.get(`SELECT COUNT(*) as metricsCount FROM performance_metrics`, (err, metricsRow) => {
                    if (err) {
                        reject(err);
                    } else {
                        this.db.get(`SELECT COUNT(*) as alertsCount FROM performance_alerts`, (err, alertsRow) => {
                            if (err) {
                                reject(err);
                            } else {
                                this.db.get(`SELECT COUNT(*) as qualityCount FROM code_quality_metrics`, (err, qualityRow) => {
                                    if (err) {
                                        reject(err);
                                    } else {
                                        resolve({
                                            performanceMetrics: metricsRow?.metricsCount || 0,
                                            performanceAlerts: alertsRow?.alertsCount || 0,
                                            qualityMetrics: qualityRow?.qualityCount || 0
                                        });
                                    }
                                });
                            }
                        });
                    }
                });
            });
        });
    }

    get dbPath() {
        return 'analyzer-quality.db (Node-RED data folder)';
    }

    close() {
        // Database is managed centrally, don't close here
        return Promise.resolve();
    }

    databaseExists() {
        return true; // Always exists through central initialization
    }

    async initDatabase() {
        return Promise.resolve(); // Already initialized
    }
}

module.exports = PerformanceDatabase;