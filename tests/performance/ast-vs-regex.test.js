const { detectDebuggingTraits } = require('../../lib/detector');
const { detectDebuggingTraitsAST } = require('../../lib/ast-detector');

describe('Performance Comparison: AST vs Regex', () => {
    const sampleCode = `
        function processData(data) {
            console.log("Processing data:", data);
            
            if (!data) {
                return;
            }
            
            try {
                const result = data.map(item => {
                    if (item.type === "test") {
                        console.warn("Test item found");
                        return;
                    }
                    
                    return {
                        id: item.id,
                        name: item.name,
                        status: "processed"
                    };
                });
                
                // TODO: Add validation here
                node.warn("Processing completed");
                
                return result;
            } catch (error) {
                console.error("Error processing data:", error);
                debugger;
                return null;
            }
        }
        
        const testData = "test";
        const debugMode = "debug";
        const tempValue = "temp";
        const testNumber = 123;
        
        return; // Top-level return
    `;
    
    test('AST detector should find all issues correctly', () => {
        const issues = detectDebuggingTraitsAST(sampleCode, 3);
        
        console.log('AST Issues found:', issues.map(i => `${i.type} at line ${i.line}`));
        
        // Should detect: console.log, console.warn, console.error, debugger, 
        // node.warn, TODO comment, hardcoded values, top-level return
        expect(issues.length).toBeGreaterThan(5);
        
        // Check for top-level return
        const topLevelReturn = issues.find(issue => issue.type === 'top-level-return');
        expect(topLevelReturn).toBeDefined();
        expect(topLevelReturn.line).toBe(39);
        
        // Check for console.log statements
        const consoleIssues = issues.filter(issue => issue.type === 'console-log');
        expect(consoleIssues.length).toBeGreaterThan(0);
        
        // Check for debugger statement
        const debuggerIssue = issues.find(issue => issue.type === 'debugger-statement');
        expect(debuggerIssue).toBeDefined();
        
        // Check for hardcoded values
        const hardcodedIssues = issues.filter(issue => 
            issue.type.startsWith('hardcoded-'));
        expect(hardcodedIssues.length).toBeGreaterThan(0);
    });
    
    test('Regex detector should find similar issues', () => {
        const issues = detectDebuggingTraits(sampleCode, 3);
        
        // Should detect similar patterns
        expect(issues.length).toBeGreaterThan(5);
        
        // Check for top-level return
        const topLevelReturn = issues.find(issue => issue.type === 'top-level-return');
        expect(topLevelReturn).toBeDefined();
        expect(topLevelReturn.line).toBe(39);
    });
    
    test('Performance comparison with complex code', () => {
        // Generate a larger code sample
        const largeCode = Array(100).fill(sampleCode).join('\n\n');
        
        const startRegex = Date.now();
        const regexIssues = detectDebuggingTraits(largeCode, 3);
        const regexTime = Date.now() - startRegex;
        
        const startAST = Date.now();
        const astIssues = detectDebuggingTraitsAST(largeCode, 3);
        const astTime = Date.now() - startAST;
        
        console.log(`Regex detection took: ${regexTime}ms`);
        console.log(`AST detection took: ${astTime}ms`);
        console.log(`AST found ${astIssues.length} issues`);
        console.log(`Regex found ${regexIssues.length} issues`);
        
        // Both should find issues
        expect(regexIssues.length).toBeGreaterThan(0);
        expect(astIssues.length).toBeGreaterThan(0);
        
        // Performance comparison is informational
        const improvement = astTime < regexTime ? 
            `AST is ${((regexTime - astTime) / regexTime * 100).toFixed(1)}% faster` :
            `Regex is ${((astTime - regexTime) / astTime * 100).toFixed(1)}% faster`;
        
        console.log(improvement);
    });
    
    test('AST should handle edge cases better than regex', () => {
        const complexCode = `
            // This should NOT be detected as top-level return
            function complexFunction() {
                if (condition) {
                    for (let i = 0; i < 10; i++) {
                        if (i === 5) {
                            return; // NOT top-level
                        }
                    }
                }
                
                try {
                    if (error) {
                        return; // NOT top-level
                    }
                } catch (e) {
                    return; // NOT top-level
                }
                
                return "result"; // NOT top-level
            }
            
            // This SHOULD be detected as top-level return
            return;
        `;
        
        const astIssues = detectDebuggingTraitsAST(complexCode, 1);
        const regexIssues = detectDebuggingTraits(complexCode, 1);
        
        // AST should only find the actual top-level return
        const astTopLevelReturns = astIssues.filter(issue => issue.type === 'top-level-return');
        expect(astTopLevelReturns.length).toBe(1);
        expect(astTopLevelReturns[0].line).toBe(24);
        
        // Regex might have more false positives/negatives
        const regexTopLevelReturns = regexIssues.filter(issue => issue.type === 'top-level-return');
        
        console.log(`AST found ${astTopLevelReturns.length} top-level returns`);
        console.log(`Regex found ${regexTopLevelReturns.length} top-level returns`);
    });
});