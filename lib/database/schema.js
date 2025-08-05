async function initSchema(database) {
    try {
        // Performance metrics table
        await database.run(`CREATE TABLE IF NOT EXISTS performance_metrics (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp INTEGER NOT NULL,
            cpu_usage REAL NOT NULL,
            memory_usage REAL NOT NULL,
            memory_rss INTEGER NOT NULL,
            event_loop_lag REAL NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Performance alerts table
        await database.run(`CREATE TABLE IF NOT EXISTS performance_alerts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            metric_type TEXT NOT NULL,
            threshold_value REAL NOT NULL,
            actual_value REAL NOT NULL,
            duration_minutes REAL NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Code quality metrics table
        await database.run(`CREATE TABLE IF NOT EXISTS code_quality_metrics (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            flow_id TEXT NOT NULL,
            flow_name TEXT NOT NULL,
            total_issues INTEGER NOT NULL,
            nodes_with_issues INTEGER NOT NULL,
            nodes_with_critical_issues INTEGER NOT NULL,
            total_function_nodes INTEGER NOT NULL,
            issue_types TEXT, -- JSON string
            quality_score REAL NOT NULL,
            complexity_score REAL NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Node quality metrics table
        await database.run(`CREATE TABLE IF NOT EXISTS node_quality_metrics (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            flow_id TEXT NOT NULL,
            node_id TEXT NOT NULL,
            node_name TEXT,
            issues_count INTEGER NOT NULL,
            issue_details TEXT, -- JSON string
            quality_score REAL NOT NULL,
            complexity_score REAL NOT NULL,
            lines_of_code INTEGER NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Settings table for dashboard configuration
        await database.run(`CREATE TABLE IF NOT EXISTS settings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            key TEXT UNIQUE NOT NULL,
            value TEXT NOT NULL,
            description TEXT,
            category TEXT,
            type TEXT DEFAULT 'string',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Create indexes for better performance
        await database.run(`CREATE INDEX IF NOT EXISTS idx_performance_metrics_timestamp 
                           ON performance_metrics(timestamp)`);
        
        await database.run(`CREATE INDEX IF NOT EXISTS idx_performance_alerts_created_at 
                           ON performance_alerts(created_at)`);
        
        await database.run(`CREATE INDEX IF NOT EXISTS idx_code_quality_flow_id 
                           ON code_quality_metrics(flow_id)`);
        
        await database.run(`CREATE INDEX IF NOT EXISTS idx_code_quality_created_at 
                           ON code_quality_metrics(created_at)`);
        
        await database.run(`CREATE INDEX IF NOT EXISTS idx_node_quality_flow_id 
                           ON node_quality_metrics(flow_id)`);
        
        await database.run(`CREATE INDEX IF NOT EXISTS idx_node_quality_node_id 
                           ON node_quality_metrics(node_id)`);
        
        await database.run(`CREATE INDEX IF NOT EXISTS idx_settings_key 
                           ON settings(key)`);
        
        // Initialize default settings
        await initializeDefaultSettings(database);
        console.log('Code Analyzer database schema initialized successfully');
    } catch (error) {
        console.error('Error initializing database schema:', error);
        throw error;
    }
}

async function initializeDefaultSettings(database) {
    const defaultSettings = [
        // Code Analysis Settings
        { key: 'codeAnalysis', value: 'true', description: 'Enable code analysis scanning', category: 'analysis', type: 'boolean' },
        { key: 'scanInterval', value: '30', description: 'Scan interval in seconds', category: 'analysis', type: 'number' },
        { key: 'detectionLevel', value: '1', description: 'Detection level (1-3)', category: 'analysis', type: 'number' },
        { key: 'autoStart', value: 'true', description: 'Auto start scanning on deployment', category: 'analysis', type: 'boolean' },
        
        // Queue Monitoring Settings
        { key: 'queueScanning', value: 'false', description: 'Enable queue monitoring', category: 'queue', type: 'boolean' },
        { key: 'queueMessageFrequency', value: '1800', description: 'Queue message frequency in seconds', category: 'queue', type: 'number' },
        { key: 'queueScanMode', value: 'all', description: 'Queue scan mode (all/specific)', category: 'queue', type: 'string' },
        { key: 'queueLengthThreshold', value: '0', description: 'Queue length alert threshold', category: 'queue', type: 'number' },
        
        // Performance Monitoring Settings
        { key: 'performanceMonitoring', value: 'false', description: 'Enable performance monitoring', category: 'performance', type: 'boolean' },
        { key: 'performanceInterval', value: '10', description: 'Performance check interval in seconds', category: 'performance', type: 'number' },
        { key: 'cpuThreshold', value: '75', description: 'CPU usage threshold percentage', category: 'performance', type: 'number' },
        { key: 'memoryThreshold', value: '80', description: 'Memory usage threshold percentage', category: 'performance', type: 'number' },
        { key: 'eventLoopThreshold', value: '20', description: 'Event loop lag threshold in ms', category: 'performance', type: 'number' },
        { key: 'sustainedAlertDuration', value: '300', description: 'Sustained alert duration in seconds', category: 'performance', type: 'number' },
        { key: 'alertCooldown', value: '1800', description: 'Alert cooldown period in seconds', category: 'performance', type: 'number' },
        { key: 'dbRetentionDays', value: '7', description: 'Database retention in days', category: 'performance', type: 'number' },
        
        // Slack Integration Settings
        { key: 'slackWebhookUrl', value: '', description: 'Slack webhook URL for notifications', category: 'notifications', type: 'string' }
    ];
    
    // Insert default settings if they don't exist
    for (const setting of defaultSettings) {
        try {
            await database.run(`INSERT OR IGNORE INTO settings (key, value, description, category, type) VALUES (?, ?, ?, ?, ?)`, 
                [setting.key, setting.value, setting.description, setting.category, setting.type]
            );
        } catch (err) {
            console.error(`Error inserting default setting ${setting.key}:`, err);
        }
    }
}

module.exports = {
    initSchema,
    initializeDefaultSettings
};