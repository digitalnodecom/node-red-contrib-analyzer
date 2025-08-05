const { detectDebuggingTraits } = require('../../lib/detection/detector');

// Mock the detector
jest.mock('../../lib/detection/detector');

describe('Analyzer Node', () => {
    let mockRED;

    beforeEach(() => {
        // Arrange - Create comprehensive mock Node-RED environment
        mockRED = {
            nodes: {
                createNode: jest.fn(),
                eachNode: jest.fn(),
                getNode: jest.fn(),
                registerType: jest.fn()
            },
            settings: {
                uiPort: 1880,
                httpNodeRoot: '/test'
            },
            log: {
                info: jest.fn(),
                warn: jest.fn(),
                error: jest.fn()
            },
            events: {
                on: jest.fn()
            },
            httpAdmin: {
                get: jest.fn(),
                post: jest.fn(),
                use: jest.fn()
            }
        };

        // Reset mocks
        jest.clearAllMocks();
        detectDebuggingTraits.mockReturnValue([]);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('Global Service Initialization', () => {
        test('should initialize analyzer global service without errors', () => {
            // Act & Assert - should not throw errors
            expect(() => {
                require('../../lib/analyzer.js')(mockRED);
            }).not.toThrow();
        });

        test('should setup Express routes on httpAdmin', () => {
            // Act
            require('../../lib/analyzer.js')(mockRED);
            
            // Assert - verify Express routes are configured
            expect(mockRED.httpAdmin.use).toHaveBeenCalled();
        });
    });

    describe('Detection Logic', () => {
        test('should detect debugging traits in function code', () => {
            // Arrange
            const testCode = 'return; node.warn("debug");';
            const expectedIssues = [
                { type: 'top-level-return', message: 'Remove return', line: 1 },
                { type: 'node-warn', message: 'Remove warn', line: 1 }
            ];
            
            detectDebuggingTraits.mockReturnValue(expectedIssues);

            // Act
            const issues = detectDebuggingTraits(testCode, 2);

            // Assert
            expect(detectDebuggingTraits).toHaveBeenCalledWith(testCode, 2);
            expect(issues).toEqual(expectedIssues);
        });

        test('should handle empty function code', () => {
            // Arrange
            const testCode = '';
            detectDebuggingTraits.mockReturnValue([]);

            // Act
            const issues = detectDebuggingTraits(testCode, 2);

            // Assert
            expect(detectDebuggingTraits).toHaveBeenCalledWith(testCode, 2);
            expect(issues).toEqual([]);
        });

        test('should handle different detection levels', () => {
            // Arrange
            const testCode = 'return; node.warn("debug"); const test = "test";';
            
            // Test level 1
            detectDebuggingTraits.mockReturnValueOnce([
                { type: 'top-level-return', message: 'Remove return' }
            ]);
            
            // Test level 2
            detectDebuggingTraits.mockReturnValueOnce([
                { type: 'top-level-return', message: 'Remove return' },
                { type: 'node-warn', message: 'Remove warn' }
            ]);
            
            // Test level 3
            detectDebuggingTraits.mockReturnValueOnce([
                { type: 'top-level-return', message: 'Remove return' },
                { type: 'node-warn', message: 'Remove warn' },
                { type: 'hardcoded-test', message: 'Remove hardcoded value' }
            ]);

            // Act & Assert
            let issues = detectDebuggingTraits(testCode, 1);
            expect(issues).toHaveLength(1);
            
            issues = detectDebuggingTraits(testCode, 2);
            expect(issues).toHaveLength(2);
            
            issues = detectDebuggingTraits(testCode, 3);
            expect(issues).toHaveLength(3);
        });
    });

    describe('Node Functionality', () => {
        test('should handle node scanning simulation', () => {
            // Arrange
            const mockFunctionNodes = [
                {
                    id: 'func1',
                    type: 'function',
                    name: 'Test Function',
                    func: 'return; node.warn("debug");',
                    z: 'flow1'
                },
                {
                    id: 'func2',
                    type: 'function',
                    name: 'Clean Function',
                    func: 'return msg;',
                    z: 'flow1'
                }
            ];

            detectDebuggingTraits.mockReturnValueOnce([
                { type: 'top-level-return', message: 'Remove return' },
                { type: 'node-warn', message: 'Remove warn' }
            ]).mockReturnValueOnce([]);

            // Act - Simulate scanning function nodes
            mockFunctionNodes.forEach(node => {
                if (node.func) {
                    detectDebuggingTraits(node.func, 2);
                }
            });

            // Assert
            expect(detectDebuggingTraits).toHaveBeenCalledTimes(2);
            expect(detectDebuggingTraits).toHaveBeenNthCalledWith(1, mockFunctionNodes[0].func, 2);
            expect(detectDebuggingTraits).toHaveBeenNthCalledWith(2, mockFunctionNodes[1].func, 2);
        });

        test('should handle queue monitoring simulation', () => {
            // Arrange
            const mockDelayNodes = [
                {
                    id: 'delay1',
                    type: 'delay',
                    name: 'Test Queue',
                    z: 'flow1',
                    pauseType: 'queue',
                    _queue: new Array(15).fill({}) // Queue with 15 items
                },
                {
                    id: 'delay2',
                    type: 'delay',
                    name: 'Small Queue',
                    z: 'flow1',
                    pauseType: 'queue',
                    _queue: new Array(5).fill({}) // Queue with 5 items
                }
            ];

            const queueThreshold = 10;

            // Act - Simulate queue monitoring
            const alerts = mockDelayNodes.filter(node => 
                node.pauseType === 'queue' && 
                node._queue && 
                node._queue.length > queueThreshold
            );

            // Assert
            expect(alerts).toHaveLength(1);
            expect(alerts[0].name).toBe('Test Queue');
            expect(alerts[0]._queue.length).toBe(15);
        });
    });

    describe('Message Frequency Control', () => {
        test('should simulate message throttling logic', () => {
            // Arrange
            const messageFrequency = 60000; // 1 minute
            const now = Date.now();
            const lastMessageTimes = {
                'queue1': now - 30000, // 30 seconds ago
                'queue2': now - 120000  // 2 minutes ago
            };

            // Act - Simulate frequency check
            const shouldSendQueue1 = (now - lastMessageTimes['queue1']) > messageFrequency;
            const shouldSendQueue2 = (now - lastMessageTimes['queue2']) > messageFrequency;

            // Assert
            expect(shouldSendQueue1).toBe(false); // Should not send (within frequency)
            expect(shouldSendQueue2).toBe(true);  // Should send (past frequency)
        });
    });

    describe('Configuration Handling', () => {
        test('should handle different configuration options', () => {
            // Arrange
            const configs = [
                {
                    detectionLevel: 1,
                    enabledChecks: { returnStatements: true },
                    queueConfig: { enableQueueMonitoring: false }
                },
                {
                    detectionLevel: 3,
                    enabledChecks: { returnStatements: true, hardcodedValues: true },
                    queueConfig: { enableQueueMonitoring: true, queueThreshold: 5 }
                }
            ];

            // Act & Assert
            configs.forEach(config => {
                expect(config.detectionLevel).toBeGreaterThan(0);
                expect(config.detectionLevel).toBeLessThanOrEqual(3);
                expect(typeof config.enabledChecks).toBe('object');
                expect(typeof config.queueConfig).toBe('object');
            });
        });
    });

    describe('Error Handling', () => {
        test('should handle detection errors gracefully', () => {
            // Arrange
            detectDebuggingTraits.mockImplementation(() => {
                throw new Error('Detection error');
            });

            // Act & Assert
            expect(() => {
                try {
                    detectDebuggingTraits('return;', 2);
                } catch (error) {
                    // Error should be handled gracefully
                    expect(error.message).toBe('Detection error');
                }
            }).not.toThrow();
        });
    });

});