const SlackNotifier = require('../../lib/slack-notifier');

// Mock fetch globally
global.fetch = jest.fn();

// Mock Node-RED
const mockRED = {
    settings: {
        uiPort: 1880,
        httpNodeRoot: '/test'
    },
    nodes: {
        eachNode: jest.fn()
    }
};

describe('SlackNotifier', () => {
    
    let slackNotifier;
    let mockFallbackCallback;
    
    beforeEach(() => {
        // Arrange - Reset mocks before each test
        jest.clearAllMocks();
        fetch.mockClear();
        mockFallbackCallback = jest.fn();
        slackNotifier = new SlackNotifier('https://hooks.slack.com/test', mockRED);
    });
    
    describe('Constructor', () => {
        
        test('should initialize with webhook URL and RED instance', () => {
            // Arrange
            const webhookUrl = 'https://hooks.slack.com/test';
            
            // Act
            const notifier = new SlackNotifier(webhookUrl, mockRED);
            
            // Assert
            expect(notifier.webhookUrl).toBe(webhookUrl);
            expect(notifier.RED).toBe(mockRED);
        });
        
    });
    
    describe('sendMessage', () => {
        
        test('should send message to Slack when webhook URL is provided', async () => {
            // Arrange
            const message = 'Test message';
            const expectedPayload = {
                text: message,
                username: 'Node-RED Queue Monitor',
                icon_emoji: ':warning:'
            };
            fetch.mockResolvedValueOnce({ ok: true });
            
            // Act
            await slackNotifier.sendMessage(message);
            
            // Assert
            expect(fetch).toHaveBeenCalledWith(
                'https://hooks.slack.com/test',
                expect.objectContaining({
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(expectedPayload)
                })
            );
        });
        
        test('should call fallback callback when no webhook URL provided', async () => {
            // Arrange
            const message = 'Test message';
            const notifierWithoutUrl = new SlackNotifier('', mockRED);
            
            // Act
            await notifierWithoutUrl.sendMessage(message, mockFallbackCallback);
            
            // Assert
            expect(mockFallbackCallback).toHaveBeenCalledWith(message);
            expect(fetch).not.toHaveBeenCalled();
        });
        
        test('should call fallback callback when fetch fails', async () => {
            // Arrange
            const message = 'Test message';
            const errorMessage = 'Network error';
            fetch.mockRejectedValueOnce(new Error(errorMessage));
            
            // Act
            await slackNotifier.sendMessage(message, mockFallbackCallback);
            
            // Assert
            expect(mockFallbackCallback).toHaveBeenCalledWith(message);
            expect(fetch).toHaveBeenCalled();
        });
        
        test('should not throw error when no fallback callback provided and fetch fails', async () => {
            // Arrange
            const message = 'Test message';
            fetch.mockRejectedValueOnce(new Error('Network error'));
            
            // Act & Assert
            await expect(slackNotifier.sendMessage(message)).resolves.not.toThrow();
        });
        
    });
    
    describe('sendQueueAlert', () => {
        
        test('should format and send queue alert message correctly', async () => {
            // Arrange
            const alerts = {
                'queue1': {
                    queueName: 'TestQueue1',
                    flowName: 'TestFlow',
                    queueLength: 15,
                    timestamp: Date.now()
                },
                'queue2': {
                    queueName: 'TestQueue2',
                    flowName: 'TestFlow',
                    queueLength: 10,
                    timestamp: Date.now()
                }
            };
            fetch.mockResolvedValueOnce({ ok: true });
            
            // Act
            await slackNotifier.sendQueueAlert(alerts);
            
            // Assert
            expect(fetch).toHaveBeenCalledWith(
                'https://hooks.slack.com/test',
                expect.objectContaining({
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: expect.stringContaining('Queue Alert Summary - 2 Queues Need Attention')
                })
            );
            
            const callArgs = fetch.mock.calls[0];
            const payload = JSON.parse(callArgs[1].body);
            expect(payload.text).toContain('Total Items in Queues:** 25');
            expect(payload.text).toContain('TestQueue1: 15 items');
            expect(payload.text).toContain('TestQueue2: 10 items');
        });
        
        test('should handle single queue alert', async () => {
            // Arrange
            const alerts = {
                'queue1': {
                    queueName: 'SingleQueue',
                    flowName: 'TestFlow',
                    queueLength: 5,
                    timestamp: Date.now()
                }
            };
            fetch.mockResolvedValueOnce({ ok: true });
            
            // Act
            await slackNotifier.sendQueueAlert(alerts);
            
            // Assert
            const callArgs = fetch.mock.calls[0];
            const payload = JSON.parse(callArgs[1].body);
            expect(payload.text).toContain('1 Queue Need Attention');
            expect(payload.text).toContain('Total Items in Queues:** 5');
        });
        
        test('should group alerts by flow name', async () => {
            // Arrange
            const alerts = {
                'queue1': {
                    queueName: 'Queue1',
                    flowName: 'Flow1',
                    queueLength: 5,
                    timestamp: Date.now()
                },
                'queue2': {
                    queueName: 'Queue2',
                    flowName: 'Flow2',
                    queueLength: 10,
                    timestamp: Date.now()
                }
            };
            fetch.mockResolvedValueOnce({ ok: true });
            
            // Act
            await slackNotifier.sendQueueAlert(alerts);
            
            // Assert
            const callArgs = fetch.mock.calls[0];
            const payload = JSON.parse(callArgs[1].body);
            expect(payload.text).toContain('Flow: Flow1');
            expect(payload.text).toContain('Flow: Flow2');
        });
        
        test('should use fallback callback when no webhook URL', async () => {
            // Arrange
            const alerts = { 'queue1': { queueName: 'Test', flowName: 'Test', queueLength: 5 } };
            const notifierWithoutUrl = new SlackNotifier('', mockRED);
            
            // Act
            await notifierWithoutUrl.sendQueueAlert(alerts, mockFallbackCallback);
            
            // Assert
            expect(mockFallbackCallback).toHaveBeenCalledWith(expect.stringContaining('Queue Alert Summary'));
            expect(fetch).not.toHaveBeenCalled();
        });
        
    });
    
    describe('sendCodeAnalysisAlert', () => {
        
        test('should format and send code analysis alert correctly', async () => {
            // Arrange
            const flowId = 'flow123';
            const totalIssues = 5;
            const nodesWithIssues = 2;
            
            // Mock flow name lookup
            mockRED.nodes.eachNode.mockImplementation((callback) => {
                callback({ type: 'tab', id: flowId, label: 'TestFlow' });
                callback({
                    type: 'function',
                    z: flowId,
                    name: 'TestNode1',
                    id: 'node1',
                    func: 'return; node.warn("test");',
                    _debugIssues: [
                        { type: 'top-level-return', message: 'Remove return' },
                        { type: 'node-warn', message: 'Remove warn' }
                    ]
                });
                callback({
                    type: 'function',
                    z: flowId,
                    name: 'TestNode2',
                    id: 'node2',
                    func: '// TODO: implement',
                    _debugIssues: [
                        { type: 'todo-comment', message: 'Resolve TODO' }
                    ]
                });
            });
            
            fetch.mockResolvedValueOnce({ ok: true });
            
            // Act
            await slackNotifier.sendCodeAnalysisAlert(flowId, totalIssues, nodesWithIssues);
            
            // Assert
            expect(fetch).toHaveBeenCalledWith(
                'https://hooks.slack.com/test',
                expect.objectContaining({
                    method: 'POST'
                })
            );
            
            const callArgs = fetch.mock.calls[0];
            const payload = JSON.parse(callArgs[1].body);
            expect(payload.text).toContain('Code Analysis Alert - 5 Issues Found');
            expect(payload.text).toContain('2 function nodes in flow "TestFlow"');
            expect(payload.text).toContain('TestNode1');
            expect(payload.text).toContain('TestNode2');
        });
        
        test('should send performance alert with CPU and memory violations', async () => {
            // Arrange
            const performanceSummary = {
                current: { cpu: 85.5, memory: 90.2, eventLoopLag: 15.3 },
                averages: { cpu: 82.1, memory: 88.7, eventLoop: 12.5 },
                alerts: [
                    { type: 'cpu', threshold: 75, current: 85.5, sustainedDuration: 300000, severity: 'warning' },
                    { type: 'memory', threshold: 80, current: 90.2, sustainedDuration: 300000, severity: 'warning' }
                ]
            };
            
            fetch.mockResolvedValueOnce({ ok: true });
            
            // Act
            await slackNotifier.sendPerformanceAlert(performanceSummary);
            
            // Assert
            expect(fetch).toHaveBeenCalledWith(
                'https://hooks.slack.com/test',
                expect.objectContaining({
                    method: 'POST'
                })
            );
            
            const callArgs = fetch.mock.calls[0];
            const payload = JSON.parse(callArgs[1].body);
            expect(payload.text).toContain('CRITICAL PERFORMANCE ALERT');
            expect(payload.text).toContain('CPU usage** threshold of 75%');
            expect(payload.text).toContain('memory usage** threshold of 80%');
            expect(payload.text).toContain('5 minutes');
            expect(payload.text).toContain('**CPU**: Identify and optimize');
            expect(payload.text).toContain('**Memory**: Investigate memory leaks');
        });
        
        test('should not send performance alert when no alerts exist', async () => {
            // Arrange
            const performanceSummary = {
                current: { cpu: 50, memory: 60, eventLoopLag: 5 },
                alerts: []
            };
            
            // Act
            await slackNotifier.sendPerformanceAlert(performanceSummary);
            
            // Assert
            expect(fetch).not.toHaveBeenCalled();
        });
        
        test('should handle event loop lag alerts', async () => {
            // Arrange
            const performanceSummary = {
                current: { cpu: 50, memory: 60, eventLoopLag: 150 },
                averages: { cpu: 48.2, memory: 58.9, eventLoop: 145.3 },
                alerts: [
                    { type: 'eventLoop', threshold: 100, current: 150, sustainedDuration: 180000, severity: 'info' }
                ]
            };
            
            fetch.mockResolvedValueOnce({ ok: true });
            
            // Act
            await slackNotifier.sendPerformanceAlert(performanceSummary);
            
            // Assert
            const callArgs = fetch.mock.calls[0];
            const payload = JSON.parse(callArgs[1].body);
            expect(payload.text).toContain('event loop delay** threshold of 100ms');
            expect(payload.text).toContain('3 minutes');
            expect(payload.text).toContain('**Event Loop**: Eliminate blocking operations');
        });
        
        test('should handle fetch errors gracefully', async () => {
            // Arrange
            const mockCallback = jest.fn();
            const testMessage = 'Test message';
            fetch.mockRejectedValueOnce(new Error('Network error'));
            
            // Act
            await slackNotifier.sendMessage(testMessage, mockCallback);
            
            // Assert
            expect(mockCallback).toHaveBeenCalledWith(testMessage);
        });
        
        test('should categorize issues by severity level', async () => {
            // Arrange
            const flowId = 'flow123';
            
            mockRED.nodes.eachNode.mockImplementation((callback) => {
                callback({ type: 'tab', id: flowId, label: 'TestFlow' });
                callback({
                    type: 'function',
                    z: flowId,
                    name: 'TestNode',
                    id: 'node1',
                    func: 'return; node.warn("debug"); const test = "test";',
                    _debugIssues: [
                        { type: 'top-level-return', message: 'Critical issue' },
                        { type: 'node-warn', message: 'Warning issue' },
                        { type: 'hardcoded-test', message: 'Minor issue' }
                    ]
                });
            });
            
            fetch.mockResolvedValueOnce({ ok: true });
            
            // Act
            await slackNotifier.sendCodeAnalysisAlert(flowId, 3, 1);
            
            // Assert
            const callArgs = fetch.mock.calls[0];
            const payload = JSON.parse(callArgs[1].body);
            expect(payload.text).toContain('**Critical**');
            expect(payload.text).toContain('**Warning**');
            expect(payload.text).toContain('**Info**');
        });
        
        test('should use fallback callback when no webhook URL', async () => {
            // Arrange
            const notifierWithoutUrl = new SlackNotifier('', mockRED);
            
            // Act
            await notifierWithoutUrl.sendCodeAnalysisAlert('flow123', 1, 1, mockFallbackCallback);
            
            // Assert
            expect(mockFallbackCallback).toHaveBeenCalledWith(expect.stringContaining('Code Analysis Alert'));
            expect(fetch).not.toHaveBeenCalled();
        });
        
    });
    
    describe('getNodeRedUrl', () => {
        
        test('should return environment variable URL when available', () => {
            // Arrange
            const envUrl = 'https://custom-node-red.com';
            process.env.NODE_RED_BASE_URL = envUrl;
            
            // Act
            const url = slackNotifier.getNodeRedUrl();
            
            // Assert
            expect(url).toBe(envUrl);
            
            // Cleanup
            delete process.env.NODE_RED_BASE_URL;
        });
        
        test('should construct URL from RED settings', () => {
            // Arrange
            delete process.env.NODE_RED_BASE_URL;
            
            // Act
            const url = slackNotifier.getNodeRedUrl();
            
            // Assert
            expect(url).toBe('http://localhost:1880/test');
        });
        
        test('should use default URL when no settings available', () => {
            // Arrange
            delete process.env.NODE_RED_BASE_URL;
            const notifierWithoutSettings = new SlackNotifier('https://test', { settings: {} });
            
            // Act
            const url = notifierWithoutSettings.getNodeRedUrl();
            
            // Assert
            expect(url).toBe('http://localhost:1880');
        });

        test('should use default port when uiPort is not set', () => {
            // Arrange
            delete process.env.NODE_RED_BASE_URL;
            const notifierWithoutPort = new SlackNotifier('https://test', { 
                settings: { 
                    httpNodeRoot: '/api' 
                } 
            });
            
            // Act
            const url = notifierWithoutPort.getNodeRedUrl();
            
            // Assert
            expect(url).toBe('http://localhost:1880/api');
        });
        
    });
    
});