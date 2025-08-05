const { detectDebuggingTraits } = require('../../lib/detector');

describe('Return Statement Detection - Values vs Empty', () => {
    test('should NOT detect return statements with values', () => {
        const code = `flow.set("romanelliAllProducts", msg.payload);
return msg;`;
        
        const issues = detectDebuggingTraits(code, 1);
        const topLevelReturns = issues.filter(issue => issue.type === 'top-level-return');
        
        expect(topLevelReturns).toHaveLength(0);
    });
    
    test('should NOT detect return with object literal', () => {
        const code = 'return { status: \'success\', data: msg.payload };';
        
        const issues = detectDebuggingTraits(code, 1);
        const topLevelReturns = issues.filter(issue => issue.type === 'top-level-return');
        
        expect(topLevelReturns).toHaveLength(0);
    });
    
    test('should NOT detect return with expression', () => {
        const code = `const result = process(data);
return result + 1;`;
        
        const issues = detectDebuggingTraits(code, 1);
        const topLevelReturns = issues.filter(issue => issue.type === 'top-level-return');
        
        expect(topLevelReturns).toHaveLength(0);
    });
    
    test('should NOT detect return with function call', () => {
        const code = 'return processMessage(msg);';
        
        const issues = detectDebuggingTraits(code, 1);
        const topLevelReturns = issues.filter(issue => issue.type === 'top-level-return');
        
        expect(topLevelReturns).toHaveLength(0);
    });
    
    test('should DETECT empty return statements', () => {
        const code = `console.log("debug");
return;`;
        
        const issues = detectDebuggingTraits(code, 1);
        const topLevelReturns = issues.filter(issue => issue.type === 'top-level-return');
        
        expect(topLevelReturns).toHaveLength(1);
        expect(topLevelReturns[0].line).toBe(2);
    });
    
    test('should DETECT empty return with just semicolon', () => {
        const code = `const x = 5;
return;`;
        
        const issues = detectDebuggingTraits(code, 1);
        const topLevelReturns = issues.filter(issue => issue.type === 'top-level-return');
        
        expect(topLevelReturns).toHaveLength(1);
        expect(topLevelReturns[0].line).toBe(2);
    });
    
    test('should NOT detect empty returns inside control structures', () => {
        const code = `if (msg.url)
    return;`;
        
        const issues = detectDebuggingTraits(code, 1);
        const topLevelReturns = issues.filter(issue => issue.type === 'top-level-return');
        
        expect(topLevelReturns).toHaveLength(0);
    });
    
    test('should NOT detect empty returns in for loops', () => {
        const code = `for (let i = 0; i < 10; i++) {
    if (i === 5) return;
}`;
        
        const issues = detectDebuggingTraits(code, 1);
        const topLevelReturns = issues.filter(issue => issue.type === 'top-level-return');
        
        expect(topLevelReturns).toHaveLength(0);
    });
    
    test('should NOT detect returns inside nested functions', () => {
        const code = `function inner() {
    return; // Should NOT be detected (nested function)
}
const arrow = () => {
    return; // Should NOT be detected (arrow function)
};`;
        
        const issues = detectDebuggingTraits(code, 1);
        const topLevelReturns = issues.filter(issue => issue.type === 'top-level-return');
        
        expect(topLevelReturns).toHaveLength(0);
    });
    
    test('should handle mixed cases correctly', () => {
        const code = `const data = processInput();
if (error) {
    return; // This should NOT be detected (inside if statement)
}
return data; // This should NOT be detected (has value)`;
        
        const issues = detectDebuggingTraits(code, 1);
        const topLevelReturns = issues.filter(issue => issue.type === 'top-level-return');
        
        expect(topLevelReturns).toHaveLength(0);
    });
    
    test('should DETECT truly top-level empty returns', () => {
        const code = `const data = processInput();
console.log("debug");
return; // This SHOULD be detected (truly top-level)
console.log("unreachable");`;
        
        const issues = detectDebuggingTraits(code, 1);
        const topLevelReturns = issues.filter(issue => issue.type === 'top-level-return');
        
        expect(topLevelReturns).toHaveLength(1);
        expect(topLevelReturns[0].line).toBe(3);
    });
});