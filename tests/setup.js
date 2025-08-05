// Jest setup file for global test configuration

// Mock console methods to avoid noise in tests
global.console = {
    ...console,
    // Suppress specific console methods during tests
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
};

// Mock fetch globally for all tests
global.fetch = jest.fn();

// Helper function to reset all mocks
global.resetAllMocks = () => {
    jest.clearAllMocks();
    fetch.mockClear();
};

// Common test utilities
global.testUtils = {
    // Helper to create mock Node-RED instance
    createMockRED: (overrides = {}) => {
        return {
            settings: {
                uiPort: 1880,
                httpNodeRoot: '',
                ...overrides.settings
            },
            nodes: {
                eachNode: jest.fn(),
                getNode: jest.fn(),
                createNode: jest.fn(),
                ...overrides.nodes
            },
            events: {
                on: jest.fn(),
                emit: jest.fn(),
                ...overrides.events
            },
            ...overrides
        };
    },
    
    // Helper to create sample queue alerts
    createSampleQueueAlerts: (count = 2) => {
        const alerts = {};
        for (let i = 1; i <= count; i++) {
            alerts[`queue${i}`] = {
                queueName: `TestQueue${i}`,
                flowName: `TestFlow${i}`,
                queueLength: 10 + i,
                timestamp: Date.now()
            };
        }
        return alerts;
    },
    
    // Helper to create sample code analysis data
    createSampleCodeAnalysis: (flowId = 'flow123', issues = 3) => {
        return {
            flowId,
            totalIssues: issues,
            nodesWithIssues: Math.ceil(issues / 2),
            mockNodes: [
                {
                    type: 'function',
                    z: flowId,
                    name: 'TestNode1',
                    id: 'node1',
                    _debugIssues: [
                        { type: 'top-level-return', message: 'Remove return' },
                        { type: 'node-warn', message: 'Remove warn' }
                    ]
                },
                {
                    type: 'function',
                    z: flowId,
                    name: 'TestNode2',
                    id: 'node2',
                    _debugIssues: [
                        { type: 'todo-comment', message: 'Resolve TODO' }
                    ]
                }
            ]
        };
    }
};

// Set up global test timeout
jest.setTimeout(10000);

// Clean up after each test
afterEach(() => {
    global.resetAllMocks();
    // Clear environment variables that might be set during tests
    delete process.env.NODE_RED_BASE_URL;
});