const { detectDebuggingTraits } = require('../../detection/detector');
const QualityMetrics = require('../../detection/quality-metrics');
const { getDatabase } = require('../../database/db');

const qualityMetrics = new QualityMetrics();

// Get overall quality summary
async function getQualitySummary(req, res) {
    try {
        const db = req.db || getDatabase();
        
        // Get latest quality metrics for all flows
        const flowMetrics = await db.all(`
            SELECT 
                flow_id,
                flow_name,
                total_issues,
                nodes_with_issues,
                nodes_with_critical_issues,
                total_function_nodes,
                quality_score,
                complexity_score,
                created_at
            FROM code_quality_metrics 
            WHERE id IN (
                SELECT MAX(id) 
                FROM code_quality_metrics 
                GROUP BY flow_id
            )
            ORDER BY created_at DESC
        `);

        // Calculate overall metrics
        let totalIssues = 0;
        let totalNodes = 0;
        let totalNodesWithIssues = 0;
        let totalCriticalIssues = 0;
        let weightedQualityScore = 0;
        let totalWeight = 0;

        flowMetrics.forEach(flow => {
            totalIssues += flow.total_issues;
            totalNodes += flow.total_function_nodes;
            totalNodesWithIssues += flow.nodes_with_issues;
            totalCriticalIssues += flow.nodes_with_critical_issues;
            
            const weight = flow.total_function_nodes;
            weightedQualityScore += flow.quality_score * weight;
            totalWeight += weight;
        });

        const overallQualityScore = totalWeight > 0 ? weightedQualityScore / totalWeight : 100;
        const qualityGrade = qualityMetrics.getQualityGrade(overallQualityScore);
        const technicalDebtRatio = totalNodes > 0 ? (totalIssues / totalNodes) : 0;

        res.json({
            summary: {
                averageQualityScore: Math.round(overallQualityScore * 100) / 100,
                totalIssues,
                totalFlows: flowMetrics.length,
                totalFunctionNodes: totalNodes,
                qualityGrade,
                nodesWithIssues: totalNodesWithIssues,
                criticalIssues: totalCriticalIssues,
                technicalDebtRatio: Math.round(technicalDebtRatio * 1000) / 1000
            },
            flows: flowMetrics.map(flow => ({
                flow_id: flow.flow_id,
                flow_name: flow.flow_name,
                quality_score: Math.round(flow.quality_score * 100) / 100,
                qualityGrade: qualityMetrics.getQualityGrade(flow.quality_score),
                total_issues: flow.total_issues,
                nodes_with_issues: flow.nodes_with_issues,
                nodes_with_critical_issues: flow.nodes_with_critical_issues,
                total_function_nodes: flow.total_function_nodes,
                created_at: flow.created_at
            }))
        });
    } catch (error) {
        console.error('Error getting quality summary:', error);
        res.status(500).json({ error: 'Failed to get quality summary' });
    }
}

// Get quality history for trends
async function getQualityHistory(req, res) {
    try {
        const db = req.db || getDatabase();
        const hours = parseInt(req.query.hours) || 24;
        const cutoffTime = new Date(Date.now() - (hours * 60 * 60 * 1000)).toISOString();

        const history = await db.all(`
            SELECT 
                strftime('%Y-%m-%d %H:00:00', created_at) as hour,
                AVG(quality_score) as avg_quality_score,
                SUM(total_issues) as total_issues,
                SUM(total_function_nodes) as total_nodes,
                COUNT(DISTINCT flow_id) as active_flows
            FROM code_quality_metrics 
            WHERE created_at >= ?
            GROUP BY strftime('%Y-%m-%d %H:00:00', created_at)
            ORDER BY hour ASC
        `, [cutoffTime]);

        res.json({
            timeRange: `${hours} hours`,
            history: (history || []).map(point => ({
                id: `${point.hour}`,
                created_at: point.hour,
                quality_score: Math.round((point.avg_quality_score || 0) * 100) / 100,
                total_issues: point.total_issues || 0,
                total_nodes: point.total_nodes || 0,
                active_flows: point.active_flows || 0
            }))
        });
    } catch (error) {
        console.error('Error getting quality history:', error);
        res.status(500).json({ error: 'Failed to get quality history' });
    }
}

// Get quality details for a specific flow
async function getFlowQuality(req, res) {
    try {
        const { flowId } = req.params;
        const db = req.db || getDatabase();

        // Get latest quality metrics for the flow
        const flowMetrics = await db.get(`
            SELECT * FROM code_quality_metrics 
            WHERE flow_id = ? 
            ORDER BY created_at DESC 
            LIMIT 1
        `, [flowId]);

        if (!flowMetrics) {
            return res.status(404).json({ error: 'Flow not found or no quality data available' });
        }

        // Parse issue types
        let issueTypes = {};
        try {
            issueTypes = JSON.parse(flowMetrics.issue_types || '{}');
        } catch (e) {
            console.error('Error parsing issue types:', e);
        }

        res.json({
            flowId: flowMetrics.flow_id,
            flowName: flowMetrics.flow_name,
            qualityScore: Math.round(flowMetrics.quality_score * 100) / 100,
            qualityGrade: qualityMetrics.getQualityGrade(flowMetrics.quality_score),
            complexityScore: Math.round(flowMetrics.complexity_score * 100) / 100,
            totalIssues: flowMetrics.total_issues,
            nodesWithIssues: flowMetrics.nodes_with_issues,
            criticalIssues: flowMetrics.nodes_with_critical_issues,
            totalNodes: flowMetrics.total_function_nodes,
            issueTypes,
            lastUpdated: flowMetrics.created_at
        });
    } catch (error) {
        console.error('Error getting flow quality:', error);
        res.status(500).json({ error: 'Failed to get flow quality data' });
    }
}

// Get quality details for a specific node
async function getNodeQuality(req, res) {
    try {
        const { flowId, nodeId } = req.params;
        const RED = req.RED; // RED instance should be injected via middleware

        if (!RED) {
            return res.status(500).json({ error: 'Node-RED instance not available' });
        }

        // Find the node
        let nodeConfig = null;
        try {
            RED.nodes.eachNode(function(n) {
                if (n.id === nodeId && n.z === flowId) {
                    nodeConfig = n;
                }
            });
        } catch (err) {
            console.error('Error accessing Node-RED nodes:', err);
            return res.status(500).json({ error: 'Failed to access Node-RED nodes' });
        }

        if (!nodeConfig || nodeConfig.type !== 'function') {
            return res.status(404).json({ error: 'Function node not found' });
        }

        // Analyze the node's code
        const issues = detectDebuggingTraits(nodeConfig.func || '', 3);
        const linesOfCode = (nodeConfig.func || '').split('\n').length;
        const complexityScore = qualityMetrics.calculateComplexityScore(nodeConfig.func || '');
        const nodeQualityScore = qualityMetrics.calculateNodeQualityScore(issues, linesOfCode);

        // Categorize issues by severity
        const issuesBySeverity = {
            critical: issues.filter(issue => ['top-level-return', 'debugger-statement'].includes(issue.type)),
            warning: issues.filter(issue => ['console-log', 'node-warn', 'todo-comment'].includes(issue.type)),
            info: issues.filter(issue => ['unused-variable', 'hardcoded-test', 'multiple-empty-lines'].includes(issue.type))
        };

        res.json({
            nodeId,
            nodeName: nodeConfig.name || `Function Node ${nodeId.substring(0, 8)}`,
            flowId,
            qualityScore: Math.round(nodeQualityScore * 100) / 100,
            qualityGrade: qualityMetrics.getQualityGrade(nodeQualityScore),
            complexityScore: Math.round(complexityScore * 100) / 100,
            linesOfCode,
            totalIssues: issues.length,
            issues: issues.map(issue => ({
                ...issue,
                severity: qualityMetrics.getIssueSeverity(issue.type)
            })),
            issuesBySeverity: {
                critical: issuesBySeverity.critical.length,
                warning: issuesBySeverity.warning.length,
                info: issuesBySeverity.info.length
            }
        });
    } catch (error) {
        console.error('Error getting node quality:', error);
        res.status(500).json({ error: 'Failed to get node quality data' });
    }
}

// Get detailed issues for a specific flow
async function getFlowIssues(req, res) {
    try {
        const { flowId } = req.params;
        const db = req.db || getDatabase();

        // Get latest flow metrics
        const flowMetrics = await db.get(`
            SELECT * FROM code_quality_metrics 
            WHERE flow_id = ? 
            ORDER BY created_at DESC 
            LIMIT 1
        `, [flowId]);

        if (!flowMetrics) {
            return res.status(404).json({ error: 'Flow not found or no quality data available' });
        }

        // Get detailed node issues for this flow (latest entry per node)
        const nodeIssues = await db.all(`
            SELECT 
                node_id,
                node_name,
                issues_count,
                issue_details,
                quality_score,
                complexity_score,
                lines_of_code
            FROM node_quality_metrics 
            WHERE flow_id = ? 
            AND id IN (
                SELECT MAX(id) 
                FROM node_quality_metrics 
                WHERE flow_id = ? 
                GROUP BY node_id
            )
            ORDER BY issues_count DESC, quality_score ASC
        `, [flowId, flowId]);

        // Parse issue details for each node
        const detailedIssues = nodeIssues.map(node => {
            let issues = [];
            try {
                issues = JSON.parse(node.issue_details || '[]');
            } catch (e) {
                console.error('Error parsing issue details for node:', node.node_id, e);
            }

            return {
                nodeId: node.node_id,
                nodeName: node.node_name || `Node ${node.node_id.substring(0, 8)}`,
                issuesCount: node.issues_count,
                qualityScore: Math.round(node.quality_score * 100) / 100,
                complexityScore: Math.round(node.complexity_score * 100) / 100,
                linesOfCode: node.lines_of_code,
                issues: issues.map(issue => ({
                    type: issue.type,
                    message: issue.message,
                    line: issue.line,
                    severity: qualityMetrics.getIssueSeverity ? qualityMetrics.getIssueSeverity(issue.type) : 'info'
                }))
            };
        });

        // Parse issue types from flow metrics
        let issueTypesSummary = {};
        try {
            issueTypesSummary = JSON.parse(flowMetrics.issue_types || '{}');
        } catch (e) {
            console.error('Error parsing flow issue types:', e);
        }

        res.json({
            flowId: flowMetrics.flow_id,
            flowName: flowMetrics.flow_name,
            qualityScore: Math.round(flowMetrics.quality_score * 100) / 100,
            totalIssues: flowMetrics.total_issues,
            nodesWithIssues: flowMetrics.nodes_with_issues,
            criticalIssues: flowMetrics.nodes_with_critical_issues,
            totalNodes: flowMetrics.total_function_nodes,
            issueTypesSummary,
            lastUpdated: flowMetrics.created_at,
            nodeDetails: detailedIssues
        });
    } catch (error) {
        console.error('Error getting flow issues:', error);
        res.status(500).json({ error: 'Failed to get flow issues' });
    }
}

module.exports = {
    getQualitySummary,
    getQualityHistory,
    getFlowQuality,
    getNodeQuality,
    getFlowIssues
};