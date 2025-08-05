const { getDatabase } = require('../../database/db');

// Get all settings grouped by category
async function getSettings(req, res) {
    try {
        const db = req.db || getDatabase();
        
        const settings = await db.all(`
            SELECT key, value, description, category, type 
            FROM settings 
            ORDER BY category, key
        `);

        // Create both grouped and flat formats
        const groupedSettings = settings.reduce((acc, setting) => {
            if (!acc[setting.category]) {
                acc[setting.category] = [];
            }
            
            // Convert value based on type
            let convertedValue = setting.value;
            if (setting.type === 'boolean') {
                convertedValue = setting.value === 'true';
            } else if (setting.type === 'number') {
                convertedValue = parseFloat(setting.value);
            }
            
            acc[setting.category].push({
                key: setting.key,
                value: convertedValue,
                description: setting.description,
                type: setting.type
            });
            return acc;
        }, {});

        // Also create a flat settings object for easier frontend consumption
        const flatSettings = settings.reduce((acc, setting) => {
            let convertedValue = setting.value;
            if (setting.type === 'boolean') {
                convertedValue = setting.value === 'true';
            } else if (setting.type === 'number') {
                convertedValue = parseFloat(setting.value);
            }
            acc[setting.key] = convertedValue;
            return acc;
        }, {});

        res.json({
            settings: flatSettings, // Use flat format for current Settings.vue
            grouped: groupedSettings, // Keep grouped format for future use
            categories: Object.keys(groupedSettings).sort()
        });
    } catch (error) {
        console.error('Error getting settings:', error);
        res.status(500).json({ error: 'Failed to get settings' });
    }
}

// Update a specific setting
async function updateSetting(req, res) {
    try {
        const { key } = req.params;
        const { value } = req.body;
        
        if (!key || value === undefined) {
            return res.status(400).json({ error: 'Key and value are required' });
        }
        
        const db = req.db || getDatabase();
        
        // Convert value to string for storage
        const stringValue = typeof value === 'boolean' ? value.toString() : value.toString();
        
        const result = await db.run(`
            UPDATE settings 
            SET value = ?, updated_at = CURRENT_TIMESTAMP 
            WHERE key = ?
        `, [stringValue, key]);

        if (result.changes === 0) {
            return res.status(404).json({ error: 'Setting not found' });
        }

        res.json({ 
            success: true, 
            key, 
            value,
            message: 'Setting updated successfully' 
        });
    } catch (error) {
        console.error('Error updating setting:', error);
        res.status(500).json({ error: 'Failed to update setting' });
    }
}

// Update multiple settings at once
async function updateSettings(req, res) {
    try {
        const { settings } = req.body;
        
        if (!settings || typeof settings !== 'object') {
            return res.status(400).json({ error: 'Settings object is required' });
        }
        
        const db = req.db || getDatabase();
        const results = [];
        
        for (const [key, value] of Object.entries(settings)) {
            try {
                const stringValue = typeof value === 'boolean' ? value.toString() : value.toString();
                
                // Use INSERT OR REPLACE to ensure settings are always saved
                const result = await db.run(`
                    UPDATE settings 
                    SET value = ?, updated_at = CURRENT_TIMESTAMP 
                    WHERE key = ?
                `, [stringValue, key]);
                
                // If no rows were updated, the key doesn't exist in the database
                if (result.changes === 0) {
                    console.warn(`Setting key '${key}' not found in database, skipping`);
                    results.push({ key, value, success: false, error: `Setting '${key}' not found` });
                } else {
                    results.push({ key, value, success: true });
                }
            } catch (error) {
                console.error(`Error updating setting ${key}:`, error);
                results.push({ key, value, success: false, error: error.message });
            }
        }

        const successCount = results.filter(r => r.success).length;
        const failureCount = results.filter(r => !r.success).length;
        
        res.json({ 
            success: failureCount === 0, // Only success if all updates succeeded
            results,
            message: `Updated ${successCount} settings${failureCount > 0 ? `, ${failureCount} failed` : ''}`,
            details: {
                total: results.length,
                successful: successCount,
                failed: failureCount,
                failures: results.filter(r => !r.success)
            }
        });
    } catch (error) {
        console.error('Error updating settings:', error);
        res.status(500).json({ error: 'Failed to update settings' });
    }
}

// Get a specific setting by key
async function getSetting(req, res) {
    try {
        const { key } = req.params;
        const db = req.db || getDatabase();
        
        const setting = await db.get(`
            SELECT key, value, description, category, type 
            FROM settings 
            WHERE key = ?
        `, [key]);

        if (!setting) {
            return res.status(404).json({ error: 'Setting not found' });
        }

        // Convert value based on type
        let convertedValue = setting.value;
        if (setting.type === 'boolean') {
            convertedValue = setting.value === 'true';
        } else if (setting.type === 'number') {
            convertedValue = parseFloat(setting.value);
        }

        res.json({
            key: setting.key,
            value: convertedValue,
            description: setting.description,
            category: setting.category,
            type: setting.type
        });
    } catch (error) {
        console.error('Error getting setting:', error);
        res.status(500).json({ error: 'Failed to get setting' });
    }
}

// Reset settings to defaults
async function resetSettings(req, res) {
    try {
        const db = req.db || getDatabase();
        
        // Get default settings (this would ideally be stored in the database or config)
        const defaultValues = {
            codeAnalysis: 'true',
            scanInterval: '30',
            detectionLevel: '1',
            autoStart: 'true',
            queueScanning: 'false',
            queueMessageFrequency: '1800',
            queueScanMode: 'all',
            queueLengthThreshold: '0',
            performanceMonitoring: 'false',
            performanceInterval: '10',
            cpuThreshold: '75',
            memoryThreshold: '80',
            eventLoopThreshold: '20',
            sustainedAlertDuration: '300',
            alertCooldown: '1800',
            dbRetentionDays: '7',
            slackWebhookUrl: ''
        };
        
        const results = [];
        for (const [key, value] of Object.entries(defaultValues)) {
            try {
                await db.run(`
                    UPDATE settings 
                    SET value = ?, updated_at = CURRENT_TIMESTAMP 
                    WHERE key = ?
                `, [value, key]);
                
                results.push({ key, success: true });
            } catch (error) {
                results.push({ key, success: false, error: error.message });
            }
        }

        res.json({ 
            success: true,
            results,
            message: 'Settings reset to defaults' 
        });
    } catch (error) {
        console.error('Error resetting settings:', error);
        res.status(500).json({ error: 'Failed to reset settings' });
    }
}

module.exports = {
    getSettings,
    updateSetting,
    updateSettings,
    getSetting,
    resetSettings
};