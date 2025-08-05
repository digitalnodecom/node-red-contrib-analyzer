const { detectDebuggingTraits } = require('../../lib/detection/detector');
const SlackNotifier = require('../../lib/monitoring/slack-notifier');

describe('Integration Tests - Code Analyzer End-to-End', () => {
    
    let mockRED;
    let slackNotifier;
    
    beforeEach(() => {
        // Arrange - Create comprehensive mock Node-RED environment
        mockRED = {
            settings: {
                uiPort: 1880,
                httpNodeRoot: '/api'
            },
            nodes: {
                eachNode: jest.fn()
            }
        };
        
        slackNotifier = new SlackNotifier('https://hooks.slack.com/test', mockRED);
        fetch.mockResolvedValue({ ok: true });
    });
    
    describe('End-to-End Detection and Notification Flow', () => {
        
        test('should detect issues and send appropriate Slack notifications', async () => {
            // Arrange
            const problematicCode = `return; // Level 1 issue
node.warn("debugging"); // Level 2 issue
const mode = "test"; // Level 3 issue
// TODO: optimize this // Level 2 issue`;
            
            const queueAlerts = {
                'queue1': { queueName: 'TestQueue1', flowName: 'TestFlow1', queueLength: 11 },
                'queue2': { queueName: 'TestQueue2', flowName: 'TestFlow2', queueLength: 12 }
            };
            const analysisData = {
                flowId: 'flow123',
                totalIssues: 4,
                nodesWithIssues: 2,
                mockNodes: [
                    { type: 'function', id: 'func1', name: 'TestFunc1', z: 'flow123' },
                    { type: 'function', id: 'func2', name: 'TestFunc2', z: 'flow123' }
                ]
            };
            
            // Mock Node-RED flow structure
            mockRED.nodes.eachNode.mockImplementation((callback) => {
                // Flow tab
                callback({ type: 'tab', id: 'flow123', label: 'ProductionFlow' });
                
                // Function nodes with issues
                analysisData.mockNodes.forEach(node => callback(node));
            });
            
            // Act - Run detection
            const detectedIssues = detectDebuggingTraits(problematicCode, 3);
            
            // Act - Send notifications
            await slackNotifier.sendQueueAlert(queueAlerts);
            await slackNotifier.sendCodeAnalysisAlert(
                analysisData.flowId, 
                analysisData.totalIssues, 
                analysisData.nodesWithIssues
            );
            
            // Assert - Verify detection results (now includes unused-variable)
            expect(detectedIssues).toHaveLength(5);
            expect(detectedIssues.map(i => i.type)).toEqual(
                expect.arrayContaining([
                    'top-level-return',
                    'node-warn', 
                    'hardcoded-test',
                    'todo-comment',
                    'unused-variable'
                ])
            );
            
            // Assert - Verify both notifications were sent
            expect(fetch).toHaveBeenCalledTimes(2);
            
            // Assert - Verify queue alert format
            const queueCall = fetch.mock.calls[0];
            const queuePayload = JSON.parse(queueCall[1].body);
            expect(queuePayload.text).toContain('Queue Alert Summary');
            expect(queuePayload.text).toContain('2 Queues Need Attention');
            expect(queuePayload.text).toContain('Total Items in Queues:** 23');
            
            // Assert - Verify code analysis alert format
            const codeCall = fetch.mock.calls[1];
            const codePayload = JSON.parse(codeCall[1].body);
            expect(codePayload.text).toContain('Code Analysis Alert');
            expect(codePayload.text).toContain('4 Issues Found');
            expect(codePayload.text).toContain('ProductionFlow');
        });
        
        test('should handle empty/clean code gracefully', async () => {
            // Arrange
            const cleanCode = `
function processMessage(msg) {
    if (!msg.payload) {
        node.error("No payload provided");
        return null;
    }
    
    const result = processPayload(msg.payload);
    node.log("Processing completed");
    return result;
}`;
            
            // Act
            const detectedIssues = detectDebuggingTraits(cleanCode, 3);
            
            // Assert
            expect(detectedIssues).toHaveLength(0);
        });
        
        test('should handle different detection levels correctly', async () => {
            // Arrange
            const multiLevelCode = `return; // Level 1
node.warn("debug"); // Level 2
const mode = "test"; // Level 3`;
            
            // Act & Assert - Level 1 only
            const level1Issues = detectDebuggingTraits(multiLevelCode, 1);
            expect(level1Issues).toHaveLength(1);
            expect(level1Issues[0].type).toBe('top-level-return');
            
            // Act & Assert - Level 2 includes Level 1 + unused variables
            const level2Issues = detectDebuggingTraits(multiLevelCode, 2);
            expect(level2Issues).toHaveLength(3);
            expect(level2Issues.map(i => i.type)).toEqual(
                expect.arrayContaining(['top-level-return', 'node-warn', 'unused-variable'])
            );
            
            // Act & Assert - Level 3 includes all
            const level3Issues = detectDebuggingTraits(multiLevelCode, 3);
            expect(level3Issues).toHaveLength(4);
            expect(level3Issues.map(i => i.type)).toEqual(
                expect.arrayContaining(['top-level-return', 'node-warn', 'hardcoded-test'])
            );
        });
        
    });
    
    describe('Error Handling and Resilience', () => {
        
        test('should handle Slack API failures gracefully', async () => {
            // Arrange
            const mockFallback = jest.fn();
            fetch.mockRejectedValueOnce(new Error('Network error'));
            
            const queueAlerts = {
                'queue1': { queueName: 'TestQueue1', flowName: 'TestFlow1', queueLength: 5 }
            };
            
            // Act
            await slackNotifier.sendQueueAlert(queueAlerts, mockFallback);
            
            // Assert
            expect(fetch).toHaveBeenCalledTimes(1);
            expect(mockFallback).toHaveBeenCalledWith(
                expect.stringContaining('Queue Alert Summary')
            );
        });
        
        test('should handle malformed code input', async () => {
            // Arrange
            const malformedInputs = [
                null,
                undefined,
                '',
                '   ',
                'incomplete function {',
                'function() { /* no closing brace'
            ];
            
            // Act & Assert
            malformedInputs.forEach(input => {
                expect(() => detectDebuggingTraits(input, 3)).not.toThrow();
                const issues = detectDebuggingTraits(input, 3);
                expect(Array.isArray(issues)).toBe(true);
            });
        });
        
        test('should handle missing Node-RED environment gracefully', async () => {
            // Arrange
            const emptyRED = {
                settings: {},
                nodes: {
                    eachNode: jest.fn()
                }
            };
            
            const notifier = new SlackNotifier('https://test.com', emptyRED);
            
            // Act & Assert
            expect(() => notifier.getNodeRedUrl()).not.toThrow();
            
            const url = notifier.getNodeRedUrl();
            expect(url).toBe('http://localhost:1880');
        });
        
    });
    
    describe('Performance and Scalability', () => {
        
        test('should handle large code files efficiently', async () => {
            // Arrange
            const largeCode = Array(1000).fill(`
function test${Date.now()}() {
    const value = processData();
    return value;
}`).join('\n');
            
            const startTime = Date.now();
            
            // Act
            const issues = detectDebuggingTraits(largeCode, 3);
            
            const endTime = Date.now();
            const processingTime = endTime - startTime;
            
            // Assert
            expect(Array.isArray(issues)).toBe(true);
            expect(processingTime).toBeLessThan(1000); // Should process within 1 second
        });
        
        test('should handle many queue alerts efficiently', async () => {
            // Arrange
            const manyQueues = {};
            for (let i = 1; i <= 50; i++) {
                manyQueues[`queue${i}`] = { 
                    queueName: `TestQueue${i}`, 
                    flowName: 'TestFlow', 
                    queueLength: 10 
                };
            }
            
            const startTime = Date.now();
            
            // Act
            await slackNotifier.sendQueueAlert(manyQueues);
            
            const endTime = Date.now();
            const processingTime = endTime - startTime;
            
            // Assert
            expect(fetch).toHaveBeenCalledTimes(1);
            expect(processingTime).toBeLessThan(500); // Should process within 0.5 seconds
            
            const payload = JSON.parse(fetch.mock.calls[0][1].body);
            expect(payload.text).toContain('50 Queues Need Attention');
        });
        
    });
    
});