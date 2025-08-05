const PerformanceMonitor = require('../../lib/performance-monitor');

// Mock os module
jest.mock('os', () => ({
    totalmem: jest.fn(() => 8 * 1024 * 1024 * 1024) // 8GB
}));

// Mock the database module
jest.mock('../../lib/performance-db', () => {
    return jest.fn().mockImplementation(() => {
        return {
            setRetentionDays: jest.fn(),
            storeMetrics: jest.fn().mockResolvedValue(1),
            getAverages: jest.fn().mockResolvedValue({ cpu: 0, memory: 0, eventLoop: 0 }),
            checkSustainedMetric: jest.fn().mockResolvedValue({ sustained: false, ratio: 0, totalReadings: 0, exceedingReadings: 0 }),
            recordAlert: jest.fn().mockResolvedValue(1),
            getRecentMetrics: jest.fn().mockResolvedValue([]),
            clearAll: jest.fn().mockResolvedValue({ message: 'All data cleared' }),
            getTrend: jest.fn().mockResolvedValue('stable'),
            getAlertHistory: jest.fn().mockResolvedValue([]),
            getStats: jest.fn().mockResolvedValue({ totalMetrics: 0, totalAlerts: 0 }),
            pruneOldData: jest.fn().mockResolvedValue({ message: 'Pruned successfully' }),
            close: jest.fn()
        };
    });
});

describe('PerformanceMonitor', () => {
    let performanceMonitor;
    
    beforeEach(() => {
        jest.clearAllMocks();
        performanceMonitor = new PerformanceMonitor();
        
        // Fast forward time to avoid CPU calculation issues
        jest.spyOn(Date, 'now').mockReturnValue(1000000);
        
        // Reset all mock implementations
        performanceMonitor.db.checkSustainedMetric.mockReset();
        performanceMonitor.db.recordAlert.mockReset();
        performanceMonitor.db.getAverages.mockReset();
        
        // Set default mock values
        performanceMonitor.db.checkSustainedMetric.mockResolvedValue({ sustained: false, ratio: 0, totalReadings: 0, exceedingReadings: 0 });
        performanceMonitor.db.recordAlert.mockResolvedValue(1);
        performanceMonitor.db.getAverages.mockResolvedValue({ cpu: 0, memory: 0, eventLoop: 0 });
    });
    
    afterEach(() => {
        if (performanceMonitor) {
            performanceMonitor.stop();
        }
        jest.restoreAllMocks();
    });

    describe('Constructor', () => {
        it('should initialize with default configuration', () => {
            expect(performanceMonitor.config).toEqual({
                cpuThreshold: 75,
                memoryThreshold: 80,
                eventLoopThreshold: 20,
                sustainedAlertDuration: 300000,
                alertCooldown: 1800000,
                dbRetentionDays: 7,
                pruneInterval: 86400000
            });
        });

        it('should initialize with monitoring state', () => {
            expect(performanceMonitor.isMonitoring).toBe(false);
            expect(performanceMonitor.lastAlertTimes).toHaveProperty('cpu');
            expect(performanceMonitor.lastAlertTimes).toHaveProperty('memory');
            expect(performanceMonitor.lastAlertTimes).toHaveProperty('eventLoop');
            expect(performanceMonitor.db).toBeDefined();
        });
    });

    describe('collectMetrics', () => {
        it('should collect CPU and memory metrics', () => {
            // Fast forward time to allow CPU calculation
            jest.spyOn(Date, 'now').mockReturnValueOnce(1000000).mockReturnValueOnce(1001000);
            
            const metrics = performanceMonitor.collectMetrics();
            
            expect(metrics).toHaveProperty('cpu');
            expect(metrics).toHaveProperty('memory');
            expect(metrics).toHaveProperty('memoryDetails');
            expect(metrics).toHaveProperty('timestamp');
            expect(metrics.cpu).toBeGreaterThanOrEqual(0);
            expect(metrics.memory).toBeGreaterThanOrEqual(0);
        });

        it('should store metrics in database', async () => {
            performanceMonitor.isMonitoring = true; // Ensure monitoring is active
            performanceMonitor.collectMetrics();
            
            // Wait for async storage with longer timeout
            await new Promise(resolve => setTimeout(resolve, 100));
            
            expect(performanceMonitor.db.storeMetrics).toHaveBeenCalled();
        });

        it('should handle database storage errors', async () => {
            performanceMonitor.db.storeMetrics.mockRejectedValue(new Error('Database error'));
            
            expect(() => performanceMonitor.collectMetrics()).not.toThrow();
        });

        it('should calculate memory percentage correctly', () => {
            const memoryUsage = {
                rss: 1024 * 1024 * 1024, // 1GB
                heapTotal: 500 * 1024 * 1024,
                heapUsed: 300 * 1024 * 1024,
                external: 100 * 1024 * 1024
            };
            
            const memoryPercent = performanceMonitor.calculateMemoryPercent(memoryUsage);
            
            expect(memoryPercent).toBeCloseTo(12.5, 1); // 1GB out of 8GB = 12.5%
        });
    });

    describe('checkSustainedThresholds', () => {
        it('should return no alerts when metrics are below thresholds', async () => {
            const metrics = { cpu: 50, memory: 60 };
            
            const alerts = await performanceMonitor.checkSustainedThresholds(metrics);
            
            expect(alerts).toEqual([]);
        });

        it('should return no alerts when metrics exceed thresholds but are not sustained', async () => {
            const metrics = { cpu: 85, memory: 60 };
            performanceMonitor.db.checkSustainedMetric.mockResolvedValue({ sustained: false });
            
            const alerts = await performanceMonitor.checkSustainedThresholds(metrics);
            
            expect(alerts).toEqual([]);
        });

        it('should call database methods for sustained threshold checking', async () => {
            const metrics = { cpu: 85, memory: 60 };
            
            // Mock calculateAverages to return values above threshold
            performanceMonitor.calculateAverages = jest.fn().mockResolvedValue({ cpu: 85, memory: 60, eventLoop: 5 });
            
            // Mock the database to return sustained: true
            performanceMonitor.db.checkSustainedMetric.mockResolvedValueOnce({ sustained: true });
            performanceMonitor.db.recordAlert.mockResolvedValueOnce(1);
            
            // Reset last alert time to ensure it's past the cooldown period
            performanceMonitor.lastAlertTimes.cpu = 0;
            
            await performanceMonitor.checkSustainedThresholds(metrics);
            
            expect(performanceMonitor.db.checkSustainedMetric).toHaveBeenCalledWith('cpu_usage', 75, 300000);
        });

        it('should call database methods for memory threshold checking', async () => {
            const metrics = { cpu: 50, memory: 90 };
            
            // Mock calculateAverages to return values above threshold
            performanceMonitor.calculateAverages = jest.fn().mockResolvedValue({ cpu: 50, memory: 90, eventLoop: 5 });
            
            // Mock the database to return sustained: true
            performanceMonitor.db.checkSustainedMetric.mockResolvedValueOnce({ sustained: true });
            performanceMonitor.db.recordAlert.mockResolvedValueOnce(1);
            
            // Reset last alert time to ensure it's past the cooldown period
            performanceMonitor.lastAlertTimes.memory = 0;
            
            await performanceMonitor.checkSustainedThresholds(metrics);
            
            expect(performanceMonitor.db.checkSustainedMetric).toHaveBeenCalledWith('memory_usage', 80, 300000);
        });

        it('should respect alert cooldown periods', async () => {
            const metrics = { cpu: 85, memory: 60 };
            performanceMonitor.db.checkSustainedMetric.mockResolvedValue({ sustained: true });
            
            // Set last alert time to recent past
            performanceMonitor.lastAlertTimes.cpu = Date.now() - 1000; // 1 second ago
            
            const alerts = await performanceMonitor.checkSustainedThresholds(metrics);
            
            expect(alerts).toEqual([]); // Should be suppressed due to cooldown
        });
    });

    describe('getPerformanceSummary', () => {
        it('should return performance summary with current and average metrics', async () => {
            const summary = await performanceMonitor.getPerformanceSummary();
            
            expect(summary).toHaveProperty('current');
            expect(summary).toHaveProperty('averages');
            expect(summary).toHaveProperty('alerts');
            expect(summary).toHaveProperty('uptime');
            expect(summary).toHaveProperty('processInfo');
        });

        it('should calculate averages from database', async () => {
            const mockAverages = { cpu: 75, memory: 65, eventLoop: 60 };
            performanceMonitor.db.getAverages.mockResolvedValue(mockAverages);
            
            const summary = await performanceMonitor.getPerformanceSummary();
            
            expect(summary.averages).toEqual(mockAverages);
            expect(performanceMonitor.db.getAverages).toHaveBeenCalledWith(10);
        });

        it('should handle database errors gracefully', async () => {
            performanceMonitor.db.getAverages.mockRejectedValue(new Error('Database error'));
            
            const summary = await performanceMonitor.getPerformanceSummary();
            
            expect(summary.averages).toEqual({ cpu: 0, memory: 0, eventLoop: 0 });
        });
    });

    describe('updateConfig', () => {
        it('should update configuration', () => {
            const newConfig = {
                cpuThreshold: 90,
                memoryThreshold: 95,
                eventLoopThreshold: 150
            };
            
            performanceMonitor.updateConfig(newConfig);
            
            expect(performanceMonitor.config.cpuThreshold).toBe(90);
            expect(performanceMonitor.config.memoryThreshold).toBe(95);
            expect(performanceMonitor.config.eventLoopThreshold).toBe(150);
        });

        it('should maintain other config values when partially updating', () => {
            const partialConfig = { cpuThreshold: 90 };
            
            performanceMonitor.updateConfig(partialConfig);
            
            expect(performanceMonitor.config.cpuThreshold).toBe(90);
            expect(performanceMonitor.config.memoryThreshold).toBe(80);
            expect(performanceMonitor.config.eventLoopThreshold).toBe(20);
        });
    });

    describe('start and stop', () => {
        it('should start monitoring', () => {
            const spy = jest.spyOn(performanceMonitor, 'collectMetrics');
            
            performanceMonitor.start();
            
            expect(performanceMonitor.isMonitoring).toBe(true);
            expect(spy).toHaveBeenCalled();
        });

        it('should stop monitoring', () => {
            performanceMonitor.start();
            performanceMonitor.stop();
            
            expect(performanceMonitor.isMonitoring).toBe(false);
        });

        it('should handle stop without start', () => {
            expect(() => performanceMonitor.stop()).not.toThrow();
        });
    });

    describe('utility methods', () => {
        it('should get uptime information', () => {
            const uptime = performanceMonitor.getUptime();
            
            expect(uptime).toHaveProperty('seconds');
            expect(uptime).toHaveProperty('formatted');
            expect(typeof uptime.seconds).toBe('number');
            expect(typeof uptime.formatted).toBe('string');
        });

        it('should get process information', () => {
            const processInfo = performanceMonitor.getProcessInfo();
            
            expect(processInfo).toHaveProperty('pid');
            expect(processInfo).toHaveProperty('nodeVersion');
            expect(processInfo).toHaveProperty('platform');
            expect(processInfo).toHaveProperty('arch');
        });

        it('should check if monitoring is healthy', async () => {
            const isHealthy = await performanceMonitor.isHealthy();
            
            expect(typeof isHealthy).toBe('boolean');
        });

        it('should get recent metrics from database', async () => {
            const mockMetrics = [{ timestamp: 1000, value: 50 }];
            performanceMonitor.db.getRecentMetrics.mockResolvedValue(mockMetrics);
            
            const recentMetrics = await performanceMonitor.getRecentMetrics('cpu', 5);
            
            expect(recentMetrics).toEqual(mockMetrics);
            expect(performanceMonitor.db.getRecentMetrics).toHaveBeenCalledWith('cpu', 5);
        });

        it('should clear history via database', async () => {
            await performanceMonitor.clearHistory();
            
            expect(performanceMonitor.db.clearAll).toHaveBeenCalled();
        });

        it('should get database statistics', async () => {
            const mockStats = { totalMetrics: 100, totalAlerts: 5 };
            performanceMonitor.db.getStats.mockResolvedValue(mockStats);
            
            const stats = await performanceMonitor.getDatabaseStats();
            
            expect(stats).toEqual(mockStats);
            expect(performanceMonitor.db.getStats).toHaveBeenCalled();
        });

        it('should prune old data', async () => {
            const mockResult = { message: 'Pruned successfully' };
            performanceMonitor.db.pruneOldData.mockResolvedValue(mockResult);
            
            await performanceMonitor.pruneOldData();
            
            expect(performanceMonitor.db.pruneOldData).toHaveBeenCalledWith(7);
        });
    });
});