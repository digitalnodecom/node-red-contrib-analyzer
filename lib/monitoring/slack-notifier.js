class SlackNotifier {
    constructor(webhookUrl, RED) {
        this.webhookUrl = webhookUrl;
        this.RED = RED;
    }

    // Base function to send any Slack message
    async sendMessage(message, fallbackCallback = null) {
        if (!this.webhookUrl) {
            // Fallback to provided callback if no Slack URL configured
            if (fallbackCallback) {
                fallbackCallback(message);
            }
            return;
        }

        const payload = {
            text: message,
            username: 'Node-RED Queue Monitor',
            icon_emoji: ':warning:'
        };

        const options = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        };

        try {
            await fetch(this.webhookUrl, options);
        } catch (error) {
            // Silent error handling for Slack webhook failures
            // Fallback to provided callback on error
            if (fallbackCallback) {
                fallbackCallback(message);
            }
        }
    }

    // Send grouped queue message
    async sendQueueAlert(alerts, fallbackCallback = null) {
        const nodeRedUrl = this.getNodeRedUrl();
        
        const alertCount = Object.keys(alerts).length;
        const totalItems = Object.values(alerts).reduce((sum, alert) => sum + alert.queueLength, 0);

        // Group alerts by flow
        const flowGroups = {};
        Object.entries(alerts).forEach(([, alert]) => {
            if (!flowGroups[alert.flowName]) {
                flowGroups[alert.flowName] = [];
            }
            flowGroups[alert.flowName].push(alert);
        });

        let message = `⚠️ **Queue Alert Summary - ${alertCount} Queue${alertCount > 1 ? 's' : ''} Need Attention**\n\n`;
        message += `**Total Items in Queues:** ${totalItems}\n\n`;

        // Add details for each flow
        Object.entries(flowGroups).forEach(([flowName, flowAlerts]) => {
            message += `**Flow: ${flowName}**\n`;
            flowAlerts.forEach(alert => {
                message += `   • ${alert.queueName}: ${alert.queueLength} items\n`;
            });
            message += '\n';
        });

        message += '**Recommended Action:** Please review and optimize queue processing or increase rate limits to prevent bottlenecks.\n\n';
        message += `**Node-RED Instance:** ${nodeRedUrl}`;

        await this.sendMessage(message, fallbackCallback);
    }

    // Send code analysis message
    async sendCodeAnalysisAlert(flowId, totalIssues, nodesWithIssues, fallbackCallback = null) {
        const nodeRedUrl = this.getNodeRedUrl();
        
        // Get flow information
        let flowName = `Flow ${flowId.substring(0, 8)}`;
        this.RED.nodes.eachNode(function(n) {
            if (n.type === 'tab' && n.id === flowId) {
                flowName = n.label || n.name || flowName;
            }
        });

        // Collect all problematic nodes with their issues
        const problematicNodes = [];
        this.RED.nodes.eachNode(function (nodeConfig) {
            if (nodeConfig.type === 'function' && nodeConfig.func && nodeConfig.z === flowId && nodeConfig._debugIssues) {
                const issues = nodeConfig._debugIssues;
                const nodeName = nodeConfig.name || `Function ${nodeConfig.id.substring(0, 8)}`;

                // Group issues by level
                const level1Issues = issues.filter(issue => issue.type === 'top-level-return');
                const level2Issues = issues.filter(issue => issue.type === 'node-warn' || issue.type === 'todo-comment');
                const level3Issues = issues.filter(issue => !level1Issues.includes(issue) && !level2Issues.includes(issue));

                let nodeIssues = [];
                if (level1Issues.length > 0) {
                    nodeIssues.push(`**Critical**: ${level1Issues.length} top-level return statement${level1Issues.length > 1 ? 's' : ''}`);
                }
                if (level2Issues.length > 0) {
                    const warnCount = issues.filter(i => i.type === 'node-warn').length;
                    const todoCount = issues.filter(i => i.type === 'todo-comment').length;
                    if (warnCount > 0) nodeIssues.push(`**Warning**: ${warnCount} node.warn() statement${warnCount > 1 ? 's' : ''}`);
                    if (todoCount > 0) nodeIssues.push(`**Todo**: ${todoCount} TODO/FIXME comment${todoCount > 1 ? 's' : ''}`);
                }
                if (level3Issues.length > 0) {
                    nodeIssues.push(`**Info**: ${level3Issues.length} minor issue${level3Issues.length > 1 ? 's' : ''} (hardcoded values, formatting)`);
                }

                if (nodeIssues.length > 0) {
                    problematicNodes.push({
                        name: nodeName,
                        issues: nodeIssues,
                        totalIssues: issues.length
                    });
                }
            }
        });

        let message = `⚠️ **Code Analysis Alert - ${totalIssues} Issue${totalIssues > 1 ? 's' : ''} Found**\n\n`;
        message += `**Summary**: ${nodesWithIssues} function node${nodesWithIssues > 1 ? 's' : ''} in flow "${flowName}" need${nodesWithIssues === 1 ? 's' : ''} attention\n\n`;

        // List each problematic node
        problematicNodes.forEach(node => {
            message += `**${node.name}** (${node.totalIssues} issue${node.totalIssues > 1 ? 's' : ''})\n`;
            node.issues.forEach(issue => {
                message += `   ${issue}\n`;
            });
            message += '\n';
        });

        message += '**Recommended Action**: Review and clean up debugging code before production deployment\n\n';
        message += `**Node-RED Instance**: ${nodeRedUrl}`;

        await this.sendMessage(message, fallbackCallback);
    }

    // Send performance monitoring alert
    async sendPerformanceAlert(performanceSummary, fallbackCallback = null) {
        const nodeRedUrl = this.getNodeRedUrl();
        const { alerts } = performanceSummary;
        
        if (alerts.length === 0) {
            return; // No alerts to send
        }
        
        let message = '🚨 **CRITICAL PERFORMANCE ALERT - IMMEDIATE ATTENTION REQUIRED**\n\n';
        
        // Build threshold violation message
        const thresholdViolations = [];
        const sustainedDurationMinutes = Math.round(alerts[0].sustainedDuration / 60000);
        
        alerts.forEach(alert => {
            let metricName = '';
            let unit = '';
            
            switch(alert.type) {
            case 'cpu':
                metricName = 'CPU usage';
                unit = '%';
                break;
            case 'memory':
                metricName = 'memory usage';
                unit = '%';
                break;
            case 'eventLoop':
                metricName = 'event loop delay';
                unit = 'ms';
                break;
            }
            
            thresholdViolations.push(`**${metricName}** threshold of ${alert.threshold}${unit} (average: ${alert.current.toFixed(1)}${unit})`);
        });
        
        message += 'Your system has exceeded the following performance thresholds:\n';
        thresholdViolations.forEach(violation => {
            message += `   • ${violation}\n`;
        });
        message += '\n';
        
        message += `**ALERT REASON**: These metrics have remained above their configured thresholds for your specified duration of **${sustainedDurationMinutes} minutes**, indicating a sustained performance issue that requires immediate investigation.\n\n`;
        
        // Add average performance metrics for context (showing sustained values)
        message += '**Average System State (Sustained Period)**\n';
        message += `   • CPU Usage: ${performanceSummary.averages.cpu.toFixed(1)}%\n`;
        message += `   • Memory Usage: ${performanceSummary.averages.memory.toFixed(1)}%\n`;
        message += `   • Event Loop Lag: ${performanceSummary.averages.eventLoop ? performanceSummary.averages.eventLoop.toFixed(1) : 'N/A'}ms\n\n`;
        
        // Add critical recommendations
        message += '**REQUIRED IMMEDIATE ACTIONS**\n';
        if (alerts.some(a => a.type === 'cpu')) {
            message += '   🔥 **CPU**: Identify and optimize CPU-intensive operations immediately\n';
        }
        if (alerts.some(a => a.type === 'memory')) {
            message += '   🔥 **Memory**: Investigate memory leaks and excessive memory consumption\n';
        }
        if (alerts.some(a => a.type === 'eventLoop')) {
            message += '   🔥 **Event Loop**: Eliminate blocking operations and implement async patterns\n';
        }
        message += '\n';
        
        message += `**Node-RED Instance**: ${nodeRedUrl}\n`;
        message += `**Alert Generated**: ${new Date().toISOString()}`;
        
        await this.sendMessage(message, fallbackCallback);
    }

    // Helper function to get Node-RED URL
    getNodeRedUrl() {
        return process.env.NODE_RED_BASE_URL || 
               (this.RED.settings && this.RED.settings.httpNodeRoot ? 
                   `http://localhost:${this.RED.settings.uiPort || 1880}${this.RED.settings.httpNodeRoot}` : 
                   `http://localhost:${this.RED.settings.uiPort || 1880}`);
    }
}

module.exports = SlackNotifier;