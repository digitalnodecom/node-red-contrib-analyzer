const { detectDebuggingTraitsAST, parseIgnoreDirectives, shouldIgnoreLine } = require('../../lib/detection/ast-detector');

describe('AST-based Detector', () => {
    describe('detectDebuggingTraitsAST', () => {
        describe('Level 1 - Critical Issues', () => {
            test('should detect top-level return statements', () => {
                const code = `
                    console.log("start");
                    return;
                    console.log("end");
                `;
                
                const issues = detectDebuggingTraitsAST(code, 1);
                
                expect(issues).toHaveLength(1);
                expect(issues[0].type).toBe('top-level-return');
                expect(issues[0].line).toBe(3);
                expect(issues[0].severity).toBe('warning');
            });
            
            test('should NOT detect return statements inside functions', () => {
                const code = `
                    function test() {
                        return 42;
                    }
                    
                    const arrow = () => {
                        return 'hello';
                    };
                `;
                
                const issues = detectDebuggingTraitsAST(code, 1);
                
                expect(issues).toHaveLength(0);
            });
            
            test('should NOT detect return statements inside control structures', () => {
                const code = `
                    if (condition) {
                        return;
                    }
                    
                    for (let i = 0; i < 10; i++) {
                        if (i === 5) {
                            return;
                        }
                    }
                `;
                
                const issues = detectDebuggingTraitsAST(code, 1);
                
                expect(issues).toHaveLength(0);
            });
            
            test('should handle return with values', () => {
                const code = `
                    const result = calculate();
                    return result;
                `;
                
                const issues = detectDebuggingTraitsAST(code, 1);
                
                // Should NOT detect returns with values
                expect(issues).toHaveLength(0);
            });
        });
        
        describe('Level 2 - Standard Issues', () => {
            test('should detect console.log statements', () => {
                const code = `
                    console.log("debug message");
                    console.warn("warning");
                    console.error("error");
                `;
                
                const issues = detectDebuggingTraitsAST(code, 2);
                
                expect(issues).toHaveLength(3);
                expect(issues[0].type).toBe('console-log');
                expect(issues[0].message).toContain('console.log');
                expect(issues[1].type).toBe('console-log');
                expect(issues[1].message).toContain('console.warn');
                expect(issues[2].type).toBe('console-log');
                expect(issues[2].message).toContain('console.error');
            });
            
            test('should detect node.warn statements', () => {
                const code = `
                    node.warn("This is a warning");
                    node.error("This is an error");
                `;
                
                const issues = detectDebuggingTraitsAST(code, 2);
                
                expect(issues).toHaveLength(1);
                expect(issues[0].type).toBe('node-warn');
                expect(issues[0].line).toBe(2);
            });
            
            test('should detect debugger statements', () => {
                const code = `
                    const x = 5;
                    debugger;
                    const y = 10;
                    console.log(x, y);
                `;
                
                const issues = detectDebuggingTraitsAST(code, 2);
                const debuggerIssues = issues.filter(issue => issue.type === 'debugger-statement');
                
                expect(debuggerIssues).toHaveLength(1);
                expect(debuggerIssues[0].type).toBe('debugger-statement');
                expect(debuggerIssues[0].line).toBe(3);
                expect(debuggerIssues[0].severity).toBe('warning');
            });
            
            test('should detect TODO and FIXME comments', () => {
                const code = `
                    // TODO: Implement this feature
                    const x = 5;
                    // FIXME: This is broken
                    const y = 10;
                    console.log(x, y);
                `;
                
                const issues = detectDebuggingTraitsAST(code, 2);
                const todoIssues = issues.filter(issue => issue.type === 'todo-comment');
                
                expect(todoIssues).toHaveLength(2);
                expect(todoIssues.some(issue => issue.message.includes('TODO'))).toBe(true);
                expect(todoIssues.some(issue => issue.message.includes('FIXME'))).toBe(true);
            });
        });
        
        describe('Level 3 - Comprehensive Issues', () => {
            test('should detect hardcoded test values in variable declarations', () => {
                const code = `
                    const testValue = "test";
                    const debugFlag = "debug";
                    const tempData = "temp";
                    const testNumber = 123;
                    console.log(testValue, debugFlag, tempData, testNumber);
                `;
                
                const issues = detectDebuggingTraitsAST(code, 3);
                const hardcodedIssues = issues.filter(issue => issue.type.startsWith('hardcoded-'));
                
                expect(hardcodedIssues).toHaveLength(4);
                expect(hardcodedIssues.some(issue => issue.type === 'hardcoded-test')).toBe(true);
                expect(hardcodedIssues.some(issue => issue.type === 'hardcoded-debug')).toBe(true);
                expect(hardcodedIssues.some(issue => issue.type === 'hardcoded-temp')).toBe(true);
                expect(hardcodedIssues.some(issue => issue.type === 'hardcoded-number')).toBe(true);
            });
            
            test('should detect hardcoded test values in assignments', () => {
                const code = `
                    let value;
                    value = "test";
                    value = "debug";
                    value = "temp";
                `;
                
                const issues = detectDebuggingTraitsAST(code, 3);
                
                expect(issues).toHaveLength(3);
                expect(issues[0].type).toBe('hardcoded-test');
                expect(issues[1].type).toBe('hardcoded-debug');
                expect(issues[2].type).toBe('hardcoded-temp');
            });
            
            test('should detect multiple empty lines', () => {
                const code = `
                    const x = 5;
                    

                    const y = 10;
                    console.log(x, y);
                `;
                
                const issues = detectDebuggingTraitsAST(code, 3);
                const emptyLineIssues = issues.filter(issue => issue.type === 'multiple-empty-lines');
                
                expect(emptyLineIssues).toHaveLength(1);
                expect(emptyLineIssues[0].type).toBe('multiple-empty-lines');
                expect(emptyLineIssues[0].line).toBe(3);
            });
            
            test('should NOT detect legitimate values that happen to match patterns', () => {
                const code = `
                    const productionValue = "production";
                    const environmentType = "development";
                    const validNumber = 456;
                    console.log(productionValue, environmentType, validNumber);
                `;
                
                const issues = detectDebuggingTraitsAST(code, 3);
                const hardcodedIssues = issues.filter(issue => issue.type.startsWith('hardcoded-'));
                
                expect(hardcodedIssues).toHaveLength(0);
            });
        });
        
        describe('Ignore Directives', () => {
            test('should ignore issues in ignore regions', () => {
                const code = `
                    console.log("normal");
                    // @nr-analyzer-ignore-start
                    return;
                    console.log("debug");
                    // @nr-analyzer-ignore-end
                    console.log("normal again");
                `;
                
                const issues = detectDebuggingTraitsAST(code, 2);
                
                expect(issues).toHaveLength(2);
                expect(issues[0].line).toBe(2);
                expect(issues[1].line).toBe(7);
            });
            
            test('should ignore issues with ignore-line directive', () => {
                const code = `
                    console.log("normal");
                    return; // @nr-analyzer-ignore-line
                    console.log("debug");
                `;
                
                const issues = detectDebuggingTraitsAST(code, 2);
                
                expect(issues).toHaveLength(2);
                expect(issues[0].line).toBe(2);
                expect(issues[1].line).toBe(4);
            });
            
            test('should ignore issues with ignore-next directive', () => {
                const code = `
                    console.log("normal");
                    // @nr-analyzer-ignore-next
                    return;
                    console.log("debug");
                `;
                
                const issues = detectDebuggingTraitsAST(code, 2);
                
                expect(issues).toHaveLength(2);
                expect(issues[0].line).toBe(2);
                expect(issues[1].line).toBe(5);
            });
        });
        
        describe('Complex Code Scenarios', () => {
            test('should handle nested functions and closures', () => {
                const code = `
                    function outer() {
                        console.log("outer");
                        return function inner() {
                            console.log("inner");
                            return 42;
                        };
                    }
                    return; // This should be detected
                `;
                
                const issues = detectDebuggingTraitsAST(code, 2);
                
                expect(issues).toHaveLength(3);
                expect(issues[0].type).toBe('console-log');
                expect(issues[1].type).toBe('console-log');
                expect(issues[2].type).toBe('top-level-return');
                expect(issues[2].line).toBe(9);
            });
            
            test('should handle arrow functions', () => {
                const code = `
                    const test = () => {
                        console.log("arrow function");
                        return "result";
                    };
                    
                    const inline = () => console.log("inline");
                    
                    return; // This should be detected
                `;
                
                const issues = detectDebuggingTraitsAST(code, 2);
                
                expect(issues).toHaveLength(3);
                expect(issues[0].type).toBe('console-log');
                expect(issues[1].type).toBe('console-log');
                expect(issues[2].type).toBe('top-level-return');
                expect(issues[2].line).toBe(9);
            });
            
            test('should handle try-catch blocks', () => {
                const code = `
                    try {
                        console.log("trying");
                        if (error) {
                            return; // Should not be detected - inside control structure
                        }
                    } catch (e) {
                        console.error("caught");
                        return; // Should not be detected - inside control structure
                    }
                    
                    return; // This should be detected
                `;
                
                const issues = detectDebuggingTraitsAST(code, 2);
                
                expect(issues).toHaveLength(3);
                expect(issues[0].type).toBe('console-log');
                expect(issues[1].type).toBe('console-log');
                expect(issues[2].type).toBe('top-level-return');
                expect(issues[2].line).toBe(12);
            });
        });
        
        describe('Error Handling', () => {
            test('should handle null/undefined code', () => {
                expect(detectDebuggingTraitsAST(null, 1)).toEqual([]);
                expect(detectDebuggingTraitsAST(undefined, 1)).toEqual([]);
                expect(detectDebuggingTraitsAST('', 1)).toEqual([]);
            });
            
            test('should handle invalid JavaScript code gracefully', () => {
                const invalidCode = `
                    const x = ;
                    function ( {
                        return;
                    }
                `;
                
                // Should not throw an error, should fall back to regex detection
                const issues = detectDebuggingTraitsAST(invalidCode, 1);
                
                expect(Array.isArray(issues)).toBe(true);
            });
        });
    });
    
    describe('parseIgnoreDirectives', () => {
        test('should parse ignore directives correctly', () => {
            const lines = [
                'console.log("normal");',
                '// @nr-analyzer-ignore-start',
                'return;',
                '// @nr-analyzer-ignore-end',
                'console.log("normal again");'
            ];
            
            const result = parseIgnoreDirectives(lines);
            
            expect(result.ignoreRegions).toEqual([{ start: 2, end: 4 }]);
            expect(result.ignoreLines.size).toBe(0);
            expect(result.ignoreNextLines.size).toBe(0);
        });
    });
    
    describe('unused variables detection', () => {
        test('should detect unused variables at level 2', () => {
            const code = `
                let unusedVar = 10;
                let usedVar = 20;
                console.log(usedVar);
                function testFunc() {
                    let anotherUnused = 30;
                    return 42;
                }
            `;
            
            const issues = detectDebuggingTraitsAST(code, 2);
            const unusedIssues = issues.filter(issue => issue.type === 'unused-variable');
            
            expect(unusedIssues).toHaveLength(2);
            expect(unusedIssues.some(issue => issue.message.includes('unusedVar'))).toBe(true);
            expect(unusedIssues.some(issue => issue.message.includes('anotherUnused'))).toBe(true);
        });
        
        test('should not flag Node-RED globals as unused', () => {
            const code = `
                let msg = {};
                let node = {};
                let context = {};
                let flow = {};
                let global = {};
                let env = {};
                let RED = {};
            `;
            
            const issues = detectDebuggingTraitsAST(code, 2);
            const unusedIssues = issues.filter(issue => issue.type === 'unused-variable');
            
            expect(unusedIssues).toHaveLength(0);
        });
        
        test('should not flag variables with underscore prefix as unused', () => {
            const code = `
                let _unused = 10;
                let _temp = 20;
            `;
            
            const issues = detectDebuggingTraitsAST(code, 2);
            const unusedIssues = issues.filter(issue => issue.type === 'unused-variable');
            
            expect(unusedIssues).toHaveLength(0);
        });
        
        test('should highlight only the variable name, not the whole declaration', () => {
            const code = 'let unusedVariable = "some long value";';
            
            const issues = detectDebuggingTraitsAST(code, 2);
            const unusedIssues = issues.filter(issue => issue.type === 'unused-variable');
            
            expect(unusedIssues).toHaveLength(1);
            expect(unusedIssues[0].column).toBe(5); // Start of "unusedVariable"
            expect(unusedIssues[0].endColumn).toBe(19); // End of "unusedVariable"
        });
        
        test('should handle multiple variables declared on one line', () => {
            const code = `let used = 1, unused = 2, alsoUsed = 3;
                          console.log(used, alsoUsed);`;
            
            const issues = detectDebuggingTraitsAST(code, 2);
            const unusedIssues = issues.filter(issue => issue.type === 'unused-variable');
            
            expect(unusedIssues).toHaveLength(1);
            expect(unusedIssues[0].message).toContain('unused');
        });
        
        test('should not flag function parameters as unused', () => {
            const code = `
                function testFunc(param1, param2) {
                    return param1;
                }
                
                const arrowFunc = (arg1, arg2) => {
                    return arg1;
                };
            `;
            
            const issues = detectDebuggingTraitsAST(code, 2);
            const unusedIssues = issues.filter(issue => issue.type === 'unused-variable');
            
            expect(unusedIssues).toHaveLength(0);
        });
    });
    
    describe('shouldIgnoreLine', () => {
        test('should correctly identify ignored lines', () => {
            const ignoreRegions = [{ start: 2, end: 4 }];
            const ignoreLines = new Set([6]);
            const ignoreNextLines = new Set([8]);
            
            expect(shouldIgnoreLine(2, ignoreRegions, ignoreLines, ignoreNextLines)).toBe(true);
            expect(shouldIgnoreLine(3, ignoreRegions, ignoreLines, ignoreNextLines)).toBe(true);
            expect(shouldIgnoreLine(4, ignoreRegions, ignoreLines, ignoreNextLines)).toBe(true);
            expect(shouldIgnoreLine(6, ignoreRegions, ignoreLines, ignoreNextLines)).toBe(true);
            expect(shouldIgnoreLine(8, ignoreRegions, ignoreLines, ignoreNextLines)).toBe(true);
            expect(shouldIgnoreLine(1, ignoreRegions, ignoreLines, ignoreNextLines)).toBe(false);
            expect(shouldIgnoreLine(5, ignoreRegions, ignoreLines, ignoreNextLines)).toBe(false);
        });
    });
});