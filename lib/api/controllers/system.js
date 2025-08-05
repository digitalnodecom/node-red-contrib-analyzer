const { getDatabase } = require('../../database/db');
const PerformanceDatabase = require('../../database/performance-db');

const performanceDb = new PerformanceDatabase();

// Get database status
async function getDatabaseStatus(req, res) {
    try {
        const db = getDatabase();
        const stats = await performanceDb.getStats();
        
        res.json({
            status: 'connected',
            path: performanceDb.dbPath,
            initialized: true,
            statistics: stats
        });
    } catch (error) {
        console.error('Error getting database status:', error);
        res.status(500).json({ 
            status: 'error',
            error: 'Database not available',
            initialized: false
        });
    }
}

// Get flow variables map for a specific flow
async function getFlowVariables(req, res) {
    try {
        const { flowId } = req.params;
        const RED = req.app.get('RED');

        if (!RED || !RED.flowVariableMaps || !RED.flowVariableMaps[flowId]) {
            return res.json({ variables: {} });
        }

        const flowVariableMap = RED.flowVariableMaps[flowId];
        
        res.json({
            flowId,
            variables: flowVariableMap
        });
    } catch (error) {
        console.error('Error getting flow variables:', error);
        res.status(500).json({ error: 'Failed to get flow variables' });
    }
}

// Get the value of a specific flow variable
async function getFlowVariableValue(req, res) {
    try {
        const { flowId, variableName } = req.params;
        const RED = req.app.get('RED');

        if (!RED) {
            return res.status(500).json({ error: 'Node-RED instance not available' });
        }

        let value = null;
        let found = false;

        // Find any runtime node in the target flow to access its flow context
        RED.nodes.eachNode(function(nodeConfig) {
            if (nodeConfig.z === flowId && !found) {
                const runtimeNode = RED.nodes.getNode(nodeConfig.id);
                if (runtimeNode && runtimeNode.context) {
                    try {
                        const flowContext = runtimeNode.context().flow;
                        if (flowContext) {
                            const contextValue = flowContext.get(variableName);
                            if (contextValue !== undefined) {
                                value = contextValue;
                                found = true;
                            }
                        }
                    } catch (error) {
                        // Continue to next node
                    }
                }
            }
        });

        if (found) {
            res.json({
                variableName,
                value,
                type: typeof value,
                found: true
            });
        } else {
            res.json({
                variableName,
                value: null,
                type: 'undefined',
                found: false
            });
        }
    } catch (error) {
        console.error('Error getting flow variable value:', error);
        res.status(500).json({ error: 'Failed to get flow variable value' });
    }
}

// Get the value of a specific environment variable
async function getEnvVariableValue(req, res) {
    try {
        const { flowId, variableName } = req.params;
        const RED = req.app.get('RED');

        if (!RED) {
            return res.status(500).json({ error: 'Node-RED instance not available' });
        }

        let value = null;
        let found = false;

        // First, try to get the environment variable from the flow's configuration
        let flowNode = null;
        RED.nodes.eachNode(function(nodeConfig) {
            if (nodeConfig.type === 'tab' && nodeConfig.id === flowId) {
                flowNode = nodeConfig;
            }
        });

        // Check if the flow has environment variables defined
        if (flowNode && flowNode.env) {
            for (const envVar of flowNode.env) {
                if (envVar.name === variableName) {
                    value = envVar.value;
                    found = true;
                    break;
                }
            }
        }

        // If not found in flow env, try accessing through Node-RED's env context
        if (!found) {
            RED.nodes.eachNode(function(nodeConfig) {
                if (!found && nodeConfig.z === flowId) {
                    const runtimeNode = RED.nodes.getNode(nodeConfig.id);
                    if (runtimeNode && runtimeNode.context) {
                        try {
                            const envContext = runtimeNode.context().env;
                            if (envContext) {
                                const envValue = envContext.get(variableName);
                                if (envValue !== undefined) {
                                    value = envValue;
                                    found = true;
                                }
                            }
                        } catch (error) {
                            // Continue to next node
                        }
                    }
                }
            });
        }

        res.json({
            variableName,
            value,
            type: typeof value,
            found
        });
    } catch (error) {
        console.error('Error getting environment variable value:', error);
        res.status(500).json({ error: 'Failed to get environment variable value' });
    }
}

module.exports = {
    getDatabaseStatus,
    getFlowVariables,
    getFlowVariableValue,
    getEnvVariableValue
};