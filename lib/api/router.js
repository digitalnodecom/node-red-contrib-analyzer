const express = require('express');
const router = express.Router();
const qualityController = require('./controllers/quality');
const performanceController = require('./controllers/performance');
const systemController = require('./controllers/system');
const settingsController = require('./controllers/settings');

// Quality routes
router.get('/quality-summary', qualityController.getQualitySummary);
router.get('/quality-history', qualityController.getQualityHistory);
router.get('/flow-quality/:flowId', qualityController.getFlowQuality);
router.get('/flow-issues/:flowId', qualityController.getFlowIssues);
router.get('/node-quality/:flowId/:nodeId', qualityController.getNodeQuality);

// Performance routes
router.get('/performance-summary', performanceController.getPerformanceSummary);
router.get('/performance-history', performanceController.getPerformanceHistory);
router.get('/alerts', performanceController.getAlerts);

// System routes
router.get('/database-status', systemController.getDatabaseStatus);
router.get('/flow-variables/:flowId', systemController.getFlowVariables);
router.get('/flow-variables/:flowId/:variableName', systemController.getFlowVariableValue);
router.get('/env-variables/:flowId/:variableName', systemController.getEnvVariableValue);

// Settings routes
router.get('/settings', settingsController.getSettings);
router.get('/settings/:key', settingsController.getSetting);
router.put('/settings/:key', settingsController.updateSetting);
router.patch('/settings', settingsController.updateSettings);
router.post('/settings/reset', settingsController.resetSettings);

module.exports = router;