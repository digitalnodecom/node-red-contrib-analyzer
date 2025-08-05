const path = require('path');
const express = require('express');
const cors = require('cors');
const { initDatabase } = require('./database/db');
const apiRouter = require('./api/router');
const { detectDebuggingTraits } = require('./detection/detector');
const QualityMetrics = require('./detection/quality-metrics');
const PerformanceMonitor = require('./monitoring/performance-monitor');

module.exports = function(RED) {
    // Global state
    let db = null;
    let scanTimer = null;
    let performanceTimer = null;
    let settings = {};
    let isScanning = false;
    
    // Initialize database on Node-RED startup - but don't start services yet
    (async () => {
        if (!db) {
            const userDir = RED.settings.userDir || process.cwd();
            const dbPath = path.join(userDir, 'analyzer.db');
            try {
                db = await initDatabase(dbPath);
                console.log('Code Analyzer global service initialized at:', dbPath);
                
                // Load settings from database
                await loadSettings();
                
                console.log('Code Analyzer: Database and settings loaded, waiting for proper startup trigger...');
            } catch (error) {
                console.error('Failed to initialize Code Analyzer:', error);
            }
        }
    })();
    
    // Load settings from database
    async function loadSettings() {
        if (!db) return;
        
        try {
            const settingsRows = await db.all('SELECT key, value, type FROM settings');
            settings = {};
            
            settingsRows.forEach(row => {
                let value = row.value;
                if (row.type === 'boolean') {
                    value = row.value === 'true';
                } else if (row.type === 'number') {
                    value = parseFloat(row.value);
                }
                settings[row.key] = value;
            });
            
            console.log('Code Analyzer settings loaded:', Object.keys(settings).length, 'settings');
        } catch (error) {
            console.error('Failed to load settings:', error);
            // Set default values
            settings = {
                codeAnalysis: true,
                scanInterval: 0, // Disabled - on-demand only
                detectionLevel: 1,
                autoStart: false, // No automatic startup
                performanceMonitoring: false,
                performanceInterval: 10
            };
        }
    }
    
    // Global background scanning service
    async function performGlobalScan() {
        if (isScanning || !settings.codeAnalysis) return;
        
        // Check if Node-RED runtime is ready
        if (!RED.nodes || !RED.nodes.eachNode) {
            console.log('Code Analyzer: Node-RED runtime not ready, skipping scan');
            return;
        }
        
        isScanning = true;
        try {
            const qualityMetrics = new QualityMetrics();
            const flowResults = new Map();
            
            // Safety check before scanning flows
            let nodeCount = 0;
            try {
                RED.nodes.eachNode(() => nodeCount++);
            } catch (error) {
                console.log('Code Analyzer: Node-RED flows not ready, skipping scan');
                isScanning = false;
                return;
            }
            
            if (nodeCount === 0) {
                console.log('Code Analyzer: No nodes found, skipping scan');
                isScanning = false;
                return;
            }
            
            // Scan all flows
            RED.nodes.eachNode(function(nodeConfig) {
                if (nodeConfig.type === 'tab') {
                    flowResults.set(nodeConfig.id, {
                        flowId: nodeConfig.id,
                        flowName: nodeConfig.label || nodeConfig.name || `Flow ${nodeConfig.id.substring(0, 8)}`,
                        functionNodes: [],
                        totalIssues: 0,
                        nodesWithIssues: 0
                    });
                }
            });
            
            // Scan all function nodes
            RED.nodes.eachNode(async function(nodeConfig) {
                if (nodeConfig.type === 'function' && nodeConfig.func && nodeConfig.z) {
                    const flowResult = flowResults.get(nodeConfig.z);
                    if (!flowResult) return;
                    
                    const issues = detectDebuggingTraits(nodeConfig.func, settings.detectionLevel || 1);
                    const linesOfCode = nodeConfig.func.split('\n').length;
                    const complexityScore = qualityMetrics.calculateComplexityScore(nodeConfig.func);
                    const nodeQualityScore = qualityMetrics.calculateNodeQualityScore(issues, linesOfCode);
                    
                    flowResult.functionNodes.push({
                        nodeId: nodeConfig.id,
                        nodeName: nodeConfig.name || `Function Node ${nodeConfig.id.substring(0, 8)}`,
                        linesOfCode,
                        complexityScore,
                        qualityScore: nodeQualityScore,
                        issues,
                        issuesCount: issues.length
                    });
                    
                    if (issues.length > 0) {
                        flowResult.totalIssues += issues.length;
                        flowResult.nodesWithIssues += 1;
                        
                        // Update node status if possible
                        const runtimeNode = RED.nodes.getNode(nodeConfig.id);
                        if (runtimeNode && runtimeNode.status) {
                            const hasLevel1 = issues.some(issue => issue.type === 'top-level-return');
                            const hasLevel2 = issues.some(issue => 
                                issue.type === 'node-warn' || 
                                issue.type === 'todo-comment' || 
                                issue.type === 'console-log' || 
                                issue.type === 'debugger-statement'
                            );
                            
                            let statusColor = 'blue';
                            let text = 'Minor debug traits noticed';
                            
                            if (hasLevel1) {
                                statusColor = 'red';
                                text = 'Severe debugging traits';
                            } else if (hasLevel2) {
                                statusColor = 'yellow';
                                text = 'Important debugging traits';
                            }
                            
                            runtimeNode.status({
                                fill: statusColor,
                                shape: 'dot',
                                text
                            });
                        }
                        
                    } else {
                        // Clear node status for clean nodes
                        const runtimeNode = RED.nodes.getNode(nodeConfig.id);
                        if (runtimeNode && runtimeNode.status) {
                            runtimeNode.status({});
                        }
                    }
                    
                    // Store node quality metrics for ALL nodes (with or without issues)
                    if (db) {
                        try {
                            await db.run(`INSERT INTO node_quality_metrics 
                                (flow_id, node_id, node_name, issues_count, issue_details, quality_score, complexity_score, lines_of_code)
                                VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [
                                nodeConfig.z,
                                nodeConfig.id,
                                nodeConfig.name || `Function Node ${nodeConfig.id.substring(0, 8)}`,
                                issues.length,
                                JSON.stringify(issues),
                                nodeQualityScore,
                                complexityScore,
                                linesOfCode
                            ]);
                        } catch (err) {
                            console.error('Failed to store node quality metrics:', err);
                        }
                    }
                }
            });
            
            // Store flow-level quality metrics
            if (db) {
                for (const [flowId, flowResult] of flowResults) {
                    if (flowResult.functionNodes.length > 0) {
                        try {
                            // Calculate flow quality metrics from node results directly
                            const totalIssues = flowResult.functionNodes.reduce((sum, n) => sum + n.issuesCount, 0);
                            const nodesWithIssues = flowResult.functionNodes.filter(n => n.issuesCount > 0).length;
                            const nodesWithCriticalIssues = flowResult.functionNodes.filter(n => 
                                n.issues.some(i => ['top-level-return', 'debugger-statement'].includes(i.type))
                            ).length;
                            const totalFunctionNodes = flowResult.functionNodes.length;
                            
                            // Calculate weighted average quality score
                            const totalWeightedQuality = flowResult.functionNodes.reduce((sum, n) => sum + n.qualityScore, 0);
                            let flowQualityScore = totalWeightedQuality / totalFunctionNodes;
                            
                            // Apply penalties for critical issues
                            if (nodesWithCriticalIssues > 0) {
                                flowQualityScore = Math.min(flowQualityScore, 50);
                            }
                            
                            // Calculate weighted average complexity
                            const avgComplexity = flowResult.functionNodes.reduce((sum, n) => sum + n.complexityScore, 0) / totalFunctionNodes;
                            
                            await db.run(`INSERT INTO code_quality_metrics 
                                (flow_id, flow_name, total_issues, nodes_with_issues, nodes_with_critical_issues, 
                                 total_function_nodes, issue_types, quality_score, complexity_score)
                                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
                                flowId,
                                flowResult.flowName,
                                totalIssues,
                                nodesWithIssues,
                                nodesWithCriticalIssues,
                                totalFunctionNodes,
                                JSON.stringify({}) /* Issue types aggregation */,
                                Math.max(0, Math.round(flowQualityScore * 100) / 100),
                                Math.round(avgComplexity * 100) / 100
                            ]);
                        } catch (err) {
                            console.error('Failed to store flow quality metrics:', err);
                        }
                    }
                }
            }
            
            console.log(`Code Analyzer global scan completed: ${flowResults.size} flows processed`);
        } catch (error) {
            console.error('Global scan error:', error);
        } finally {
            isScanning = false;
        }
    }
    
    // Global performance monitor instance
    let performanceMonitor = null;
    
    // Performance monitoring service
    async function performPerformanceCheck() {
        if (!settings.performanceMonitoring) return;
        
        try {
            // Get current system metrics directly
            const now = Date.now();
            const memoryUsage = process.memoryUsage();
            const totalMemory = require('os').totalmem();
            
            // Calculate CPU usage (simplified)
            const currentCpu = process.cpuUsage();
            let cpuPercent = 0;
            if (performanceMonitor && performanceMonitor.lastCpuUsage) {
                const cpuDelta = process.cpuUsage(performanceMonitor.lastCpuUsage);
                const totalTime = (cpuDelta.user + cpuDelta.system) / 1000; // microseconds to milliseconds
                const timeDelta = now - (performanceMonitor.lastCheck || now);
                cpuPercent = Math.min(100, (totalTime / timeDelta) * 100);
            }
            
            // Calculate memory percentage
            const memoryPercent = (memoryUsage.rss / totalMemory) * 100;
            
            // Simple event loop lag measurement
            const start = process.hrtime.bigint();
            await new Promise(resolve => setImmediate(resolve));
            const end = process.hrtime.bigint();
            const eventLoopLag = Number(end - start) / 1000000; // nanoseconds to milliseconds
            
            // Store metrics in database
            if (db) {
                try {
                    await db.run(`INSERT INTO performance_metrics 
                        (timestamp, cpu_usage, memory_usage, memory_rss, event_loop_lag)
                        VALUES (?, ?, ?, ?, ?)`, [
                        now,
                        cpuPercent,
                        memoryPercent,
                        memoryUsage.rss,
                        eventLoopLag
                    ]);
                    
                    console.log(`Performance metrics stored: CPU ${cpuPercent.toFixed(1)}%, Memory ${memoryPercent.toFixed(1)}%, Event Loop ${eventLoopLag.toFixed(1)}ms`);
                } catch (err) {
                    console.error('Failed to store performance metrics:', err);
                }
            }
            
            // Update for next calculation
            if (!performanceMonitor) {
                performanceMonitor = {};
            }
            performanceMonitor.lastCpuUsage = currentCpu;
            performanceMonitor.lastCheck = now;
            
        } catch (error) {
            console.error('Performance monitoring error:', error);
        }
    }
    
    // Start global background services
    function startGlobalServices() {
        // Code analysis is now on-demand only - no automatic scanning
        console.log('Code Analyzer: Services ready - scanning will be performed on-demand via dashboard');
        
        // Start performance monitoring only if enabled
        if (settings.performanceMonitoring && settings.performanceInterval > 0) {
            console.log(`Starting Code Analyzer performance monitoring every ${settings.performanceInterval} seconds`);
            performanceTimer = setInterval(performPerformanceCheck, (settings.performanceInterval || 10) * 1000);
        }
    }
    
    // Stop global services
    function stopGlobalServices() {
        if (scanTimer) {
            clearInterval(scanTimer);
            scanTimer = null;
        }
        if (performanceTimer) {
            clearInterval(performanceTimer);
            performanceTimer = null;
        }
    }
    
    // Setup Express middleware for /analyzer route
    const app = RED.httpAdmin || RED.httpNode;
    
    // CORS configuration
    app.use('/analyzer/api', cors());
    
    // API routes with database injection - BEFORE static routes
    app.use('/analyzer/api', async (req, res, next) => {
        // Ensure database is initialized
        if (!db) {
            const userDir = RED.settings.userDir || process.cwd();
            const dbPath = path.join(userDir, 'analyzer.db');
            try {
                db = await initDatabase(dbPath);
                console.log('Code Analyzer database initialized at:', dbPath);
            } catch (error) {
                console.error('Failed to initialize Code Analyzer database:', error);
                return res.status(500).json({ error: 'Database initialization failed' });
            }
        }
        
        req.db = db;
        req.settings = settings;
        req.RED = RED;
        next();
    }, apiRouter);
    
    // Vue admin UI routes - AFTER API routes
    const adminPath = path.join(__dirname, 'admin', 'dist');
    
    // Serve built assets from dist folder (JS, CSS, etc.)
    app.use('/analyzer/assets', express.static(path.join(adminPath, 'assets')));
    
    // Serve the main dashboard route
    app.get('/analyzer', (req, res) => {
        const indexPath = path.join(adminPath, 'index.html');
        if (require('fs').existsSync(indexPath)) {
            res.sendFile(indexPath);
        } else {
            res.status(404).send(`
                <h1>Code Analyzer Dashboard</h1>
                <p>Vue.js admin interface is not built yet. Run <code>npm run build</code> to build the dashboard.</p>
                <p>For now, you can access the API directly at <a href="/analyzer/api">/analyzer/api</a></p>
            `);
        }
    });
    
    // Catch-all route for Vue SPA routes (but NOT /api routes)
    app.get('/analyzer*', (req, res, next) => {
        // Skip API routes - let them be handled by the API router
        if (req.path.startsWith('/analyzer/api')) {
            return next();
        }
        
        // Serve Vue SPA for all other /analyzer routes
        const indexPath = path.join(adminPath, 'index.html');
        if (require('fs').existsSync(indexPath)) {
            res.sendFile(indexPath);
        } else {
            res.status(404).send('Vue.js admin interface not found');
        }
    });
    
    // Settings reload API endpoint
    app.post('/analyzer/api/settings/reload', async (req, res) => {
        try {
            await loadSettings();
            
            // Always restart services with new settings
            stopGlobalServices();
            startGlobalServices();
            
            res.json({ 
                success: true, 
                message: 'Settings reloaded and services restarted',
                settings: Object.keys(settings),
                performanceMonitoring: settings.performanceMonitoring,
                performanceInterval: settings.performanceInterval
            });
        } catch (error) {
            res.status(500).json({ 
                error: 'Failed to reload settings', 
                details: error.message 
            });
        }
    });
    
    // Manual performance check trigger for testing
    app.post('/analyzer/api/performance/test', async (req, res) => {
        try {
            console.log('Manual performance check triggered');
            await performPerformanceCheck();
            res.json({ 
                success: true, 
                message: 'Performance check executed',
                monitoringEnabled: settings.performanceMonitoring,
                interval: settings.performanceInterval
            });
        } catch (error) {
            console.error('Manual performance check failed:', error);
            res.status(500).json({ 
                error: 'Failed to execute performance check', 
                details: error.message 
            });
        }
    });
    
    // Start performance monitoring endpoint
    app.post('/analyzer/api/performance/start', async (req, res) => {
        try {
            if (performanceTimer) {
                return res.json({ 
                    success: false, 
                    message: 'Performance monitoring is already running',
                    status: 'running'
                });
            }
            
            // Update settings
            settings.performanceMonitoring = true;
            
            // Persist setting to database
            if (db) {
                await db.run('INSERT OR REPLACE INTO settings (key, value, type) VALUES (?, ?, ?)', 
                    ['performanceMonitoring', 'true', 'boolean']);
            }
            
            // Start monitoring
            console.log(`Starting performance monitoring every ${settings.performanceInterval} seconds`);
            performanceTimer = setInterval(performPerformanceCheck, (settings.performanceInterval || 10) * 1000);
            
            res.json({ 
                success: true, 
                message: 'Performance monitoring started',
                status: 'running',
                interval: settings.performanceInterval,
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            console.error('Failed to start performance monitoring:', error);
            res.status(500).json({ 
                error: 'Failed to start performance monitoring', 
                details: error.message 
            });
        }
    });
    
    // Stop performance monitoring endpoint
    app.post('/analyzer/api/performance/stop', async (req, res) => {
        try {
            if (!performanceTimer) {
                return res.json({ 
                    success: false, 
                    message: 'Performance monitoring is not running',
                    status: 'stopped'
                });
            }
            
            // Stop monitoring
            clearInterval(performanceTimer);
            performanceTimer = null;
            
            // Update settings
            settings.performanceMonitoring = false;
            
            // Persist setting to database
            if (db) {
                await db.run('INSERT OR REPLACE INTO settings (key, value, type) VALUES (?, ?, ?)', 
                    ['performanceMonitoring', 'false', 'boolean']);
            }
            
            console.log('Performance monitoring stopped');
            
            res.json({ 
                success: true, 
                message: 'Performance monitoring stopped',
                status: 'stopped',
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            console.error('Failed to stop performance monitoring:', error);
            res.status(500).json({ 
                error: 'Failed to stop performance monitoring', 
                details: error.message 
            });
        }
    });
    
    // Performance monitoring status endpoint
    app.get('/analyzer/api/performance/status', (req, res) => {
        const isRunning = !!performanceTimer;
        res.json({
            status: isRunning ? 'running' : 'stopped',
            monitoring: isRunning,
            interval: settings.performanceInterval || 10,
            enabled: settings.performanceMonitoring,
            uptime: isRunning ? 'Active' : 'Inactive',
            timestamp: new Date().toISOString()
        });
    });
    
    // Manual scan trigger endpoint
    app.post('/analyzer/api/scan/trigger', async (req, res) => {
        try {
            if (isScanning) {
                return res.json({ 
                    success: false, 
                    message: 'Scan already in progress' 
                });
            }
            
            // Trigger manual scan
            performGlobalScan();
            
            res.json({ 
                success: true, 
                message: 'Manual scan triggered',
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            res.status(500).json({ 
                error: 'Failed to trigger scan', 
                details: error.message 
            });
        }
    });
    
    // Service status endpoint
    app.get('/analyzer/api/status', (req, res) => {
        res.json({
            services: {
                database: !!db,
                scanning: isScanning,
                performanceMonitoring: !!performanceTimer,
                isScanning
            },
            settings: {
                codeAnalysis: settings.codeAnalysis,
                scanInterval: settings.scanInterval,
                performanceMonitoring: settings.performanceMonitoring,
                performanceInterval: settings.performanceInterval
            },
            timestamp: new Date().toISOString()
        });
    });
    
    // Use a more reliable approach - wait for Node-RED to be fully ready
    let startupCheckTimer = null;
    let startupAttempts = 0;
    const maxStartupAttempts = 30; // 30 attempts * 2 seconds = 1 minute max wait
    
    function checkNodeRedReadiness() {
        startupAttempts++;
        
        try {
            // Try to access Node-RED runtime safely
            if (RED.nodes && RED.nodes.eachNode) {
                let testCount = 0;
                RED.nodes.eachNode(() => testCount++);
                
                // If we can count nodes without error, Node-RED is ready
                console.log(`Code Analyzer: Node-RED is ready! Found ${testCount} nodes.`);
                clearInterval(startupCheckTimer);
                
                // Always start services now (but they won't auto-scan)
                setTimeout(startGlobalServices, 1000);
                return;
            }
        } catch (error) {
            // Node-RED not ready yet, will try again
        }
        
        if (startupAttempts >= maxStartupAttempts) {
            console.log('Code Analyzer: Timeout waiting for Node-RED to become ready. Services will be started manually.');
            clearInterval(startupCheckTimer);
        }
    }
    
    // Start checking for Node-RED readiness after a short delay
    setTimeout(() => {
        console.log('Code Analyzer: Starting Node-RED readiness checks...');
        startupCheckTimer = setInterval(checkNodeRedReadiness, 2000);
    }, 3000);
    
    // Still listen for shutdown events
    RED.events.on('runtime-event', function(event) {
        if (event.id === 'runtime-state' && event.payload && event.payload.state === 'stop') {
            console.log('Code Analyzer shutting down...');
            stopGlobalServices();
            if (startupCheckTimer) {
                clearInterval(startupCheckTimer);
            }
        }
    });
    
    // No longer registering a draggable node - analyzer runs as global service only
    
    console.log('Code Analyzer global service registered successfully');
    console.log('Dashboard will be served from:', adminPath);
    console.log('Dashboard index.html exists:', require('fs').existsSync(path.join(adminPath, 'index.html')));
};