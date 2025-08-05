const { detectDebuggingTraits } = require('../../lib/detection/detector');
const sampleCode = require('../fixtures/sample-code');

describe('Detector - detectDebuggingTraits', () => {
    
    describe('Level 1 Detection - Critical Issues', () => {
        
        test('should detect simple top-level return statement', () => {
            // Arrange
            const code = sampleCode.topLevelReturn.simple;
            const expectedIssueType = 'top-level-return';
            
            // Act
            const issues = detectDebuggingTraits(code, 1);
            
            // Assert
            expect(issues).toHaveLength(1);
            expect(issues[0].type).toBe(expectedIssueType);
            expect(issues[0].message).toContain('top-level return');
            expect(issues[0].line).toBe(2);
        });
        
        test('should detect top-level return with semicolon', () => {
            // Arrange
            const code = sampleCode.topLevelReturn.withSemicolon;
            const expectedIssueType = 'top-level-return';
            
            // Act
            const issues = detectDebuggingTraits(code, 1);
            
            // Assert
            expect(issues).toHaveLength(1);
            expect(issues[0].type).toBe(expectedIssueType);
        });
        
        test('should detect top-level return with extra spaces', () => {
            // Arrange
            const code = sampleCode.topLevelReturn.withSpaces;
            const expectedIssueType = 'top-level-return';
            
            // Act
            const issues = detectDebuggingTraits(code, 1);
            
            // Assert
            expect(issues).toHaveLength(1);
            expect(issues[0].type).toBe(expectedIssueType);
        });
        
        test('should NOT detect valid return statement with value', () => {
            // Arrange
            const code = sampleCode.topLevelReturn.validReturn;
            
            // Act
            const issues = detectDebuggingTraits(code, 1);
            
            // Assert
            expect(issues).toHaveLength(0);
        });
        
        test('should NOT detect return statement inside nested block', () => {
            // Arrange
            const code = sampleCode.topLevelReturn.nestedReturn;
            
            // Act
            const issues = detectDebuggingTraits(code, 1);
            
            // Assert
            expect(issues).toHaveLength(0);
        });
        
    });
    
    describe('Level 2 Detection - Important Issues', () => {
        
        test('should detect simple node.warn statement', () => {
            // Arrange
            const code = sampleCode.nodeWarn.simple;
            const expectedIssueType = 'node-warn';
            
            // Act
            const issues = detectDebuggingTraits(code, 2);
            
            // Assert
            expect(issues).toHaveLength(1);
            expect(issues[0].type).toBe(expectedIssueType);
            expect(issues[0].message).toContain('node.warn()');
            expect(issues[0].line).toBe(1);
        });
        
        test('should detect node.warn with variable', () => {
            // Arrange
            const code = sampleCode.nodeWarn.withVariable;
            const expectedIssueType = 'node-warn';
            
            // Act
            const issues = detectDebuggingTraits(code, 2);
            
            // Assert
            expect(issues).toHaveLength(1);
            expect(issues[0].type).toBe(expectedIssueType);
        });
        
        test('should detect multiple node.warn statements', () => {
            // Arrange
            const code = sampleCode.nodeWarn.multipleWarns;
            const expectedIssueType = 'node-warn';
            
            // Act
            const issues = detectDebuggingTraits(code, 2);
            
            // Assert
            expect(issues).toHaveLength(2);
            expect(issues[0].type).toBe(expectedIssueType);
            expect(issues[1].type).toBe(expectedIssueType);
        });
        
        test('should NOT detect valid node.log statement', () => {
            // Arrange
            const code = sampleCode.nodeWarn.validLog;
            
            // Act
            const issues = detectDebuggingTraits(code, 2);
            
            // Assert
            expect(issues).toHaveLength(0);
        });
        
        test('should detect TODO comment (uppercase)', () => {
            // Arrange
            const code = sampleCode.todoComments.todoUppercase;
            const expectedIssueType = 'todo-comment';
            
            // Act
            const issues = detectDebuggingTraits(code, 2);
            
            // Assert
            expect(issues).toHaveLength(1);
            expect(issues[0].type).toBe(expectedIssueType);
            expect(issues[0].message).toContain('TODO');
        });
        
        test('should detect FIXME comment (lowercase)', () => {
            // Arrange
            const code = sampleCode.todoComments.fixmeLowercase;
            const expectedIssueType = 'todo-comment';
            
            // Act
            const issues = detectDebuggingTraits(code, 2);
            
            // Assert
            expect(issues).toHaveLength(1);
            expect(issues[0].type).toBe(expectedIssueType);
            expect(issues[0].message).toContain('FIXME');
        });
        
        test('should NOT detect regular comment', () => {
            // Arrange
            const code = sampleCode.todoComments.validComment;
            
            // Act
            const issues = detectDebuggingTraits(code, 2);
            
            // Assert
            expect(issues).toHaveLength(0);
        });
        
    });
    
    describe('Level 3 Detection - Minor Issues', () => {
        
        test('should detect multiple consecutive empty lines in middle of code', () => {
            // Arrange
            const code = 'var x = 1;\n\n\n\nvar y = 2;\nconsole.log(x, y);';
            
            // Act
            const issues = detectDebuggingTraits(code, 3);
            const emptyLineIssues = issues.filter(issue => issue.type === 'multiple-empty-lines');
            
            // Assert
            expect(emptyLineIssues).toHaveLength(1);
            expect(emptyLineIssues[0].type).toBe('multiple-empty-lines');
            expect(emptyLineIssues[0].message).toContain('3 consecutive empty lines');
        });
        
        test('should detect multiple consecutive empty lines at end of code', () => {
            // Arrange
            const code = 'var x = 1;\nconsole.log(x);\n\n\n\n';
            
            // Act
            const issues = detectDebuggingTraits(code, 3);
            const emptyLineIssues = issues.filter(issue => issue.type === 'multiple-empty-lines');
            
            // Assert
            expect(emptyLineIssues).toHaveLength(1);
            expect(emptyLineIssues[0].type).toBe('multiple-empty-lines');
            expect(emptyLineIssues[0].message).toContain('4 consecutive empty lines');
        });
        
        test('should detect hardcoded test string', () => {
            // Arrange
            const code = sampleCode.hardcodedValues.testString;
            const expectedIssueType = 'hardcoded-test';
            
            // Act
            const issues = detectDebuggingTraits(code, 3);
            const hardcodedIssues = issues.filter(issue => issue.type.startsWith('hardcoded-'));
            
            // Assert
            expect(hardcodedIssues).toHaveLength(1);
            expect(hardcodedIssues[0].type).toBe(expectedIssueType);
            expect(hardcodedIssues[0].message).toContain('hardcoded test');
        });
        
        test('should detect hardcoded debug string', () => {
            // Arrange
            const code = sampleCode.hardcodedValues.debugString;
            const expectedIssueType = 'hardcoded-debug';
            
            // Act
            const issues = detectDebuggingTraits(code, 3);
            const hardcodedIssues = issues.filter(issue => issue.type.startsWith('hardcoded-'));
            
            // Assert
            expect(hardcodedIssues).toHaveLength(1);
            expect(hardcodedIssues[0].type).toBe(expectedIssueType);
        });
        
        test('should detect hardcoded temp string', () => {
            // Arrange
            const code = sampleCode.hardcodedValues.tempString;
            const expectedIssueType = 'hardcoded-temp';
            
            // Act
            const issues = detectDebuggingTraits(code, 3);
            const hardcodedIssues = issues.filter(issue => issue.type.startsWith('hardcoded-'));
            
            // Assert
            expect(hardcodedIssues).toHaveLength(1);
            expect(hardcodedIssues[0].type).toBe(expectedIssueType);
        });
        
        test('should detect hardcoded test number', () => {
            // Arrange
            const code = sampleCode.hardcodedValues.testNumber;
            const expectedIssueType = 'hardcoded-number';
            
            // Act
            const issues = detectDebuggingTraits(code, 3);
            const hardcodedIssues = issues.filter(issue => issue.type.startsWith('hardcoded-'));
            
            // Assert
            expect(hardcodedIssues).toHaveLength(1);
            expect(hardcodedIssues[0].type).toBe(expectedIssueType);
        });
        
        test('should NOT detect valid production values', () => {
            // Arrange
            const code = sampleCode.hardcodedValues.validValues;
            
            // Act
            const issues = detectDebuggingTraits(code, 3);
            const hardcodedIssues = issues.filter(issue => issue.type.startsWith('hardcoded-'));
            
            // Assert
            expect(hardcodedIssues).toHaveLength(0);
        });
        
    });
    
    describe('Detection Level Filtering', () => {
        
        test('should only detect level 1 issues when level=1', () => {
            // Arrange
            const code = sampleCode.multipleIssues;
            const level = 1;
            
            // Act
            const issues = detectDebuggingTraits(code, level);
            
            // Assert
            expect(issues).toHaveLength(1);
            expect(issues[0].type).toBe('top-level-return');
        });
        
        test('should detect level 1 and 2 issues when level=2', () => {
            // Arrange
            const code = sampleCode.multipleIssues;
            const level = 2;
            
            // Act
            const issues = detectDebuggingTraits(code, level);
            
            // Assert
            expect(issues.length).toBeGreaterThan(1);
            const issueTypes = issues.map(issue => issue.type);
            expect(issueTypes).toContain('top-level-return');
            expect(issueTypes).toContain('node-warn');
            expect(issueTypes).toContain('todo-comment');
        });
        
        test('should detect all issues when level=3', () => {
            // Arrange
            const code = sampleCode.multipleIssues;
            const level = 3;
            
            // Act
            const issues = detectDebuggingTraits(code, level);
            
            // Assert
            expect(issues.length).toBeGreaterThan(2);
            const issueTypes = issues.map(issue => issue.type);
            expect(issueTypes).toContain('top-level-return');
            expect(issueTypes).toContain('node-warn');
            expect(issueTypes).toContain('todo-comment');
            expect(issueTypes).toContain('hardcoded-test');
        });
        
    });
    
    describe('Edge Cases', () => {
        
        test('should handle empty function', () => {
            // Arrange
            const code = sampleCode.edgeCases.emptyFunction;
            
            // Act
            const issues = detectDebuggingTraits(code, 3);
            
            // Assert
            expect(issues).toHaveLength(0);
        });
        
        test('should handle only comments', () => {
            // Arrange
            const code = sampleCode.edgeCases.onlyComments;
            
            // Act
            const issues = detectDebuggingTraits(code, 3);
            
            // Assert
            expect(issues).toHaveLength(0);
        });
        
        test('should handle null/undefined input', () => {
            // Arrange
            const code = null;
            
            // Act & Assert
            expect(() => detectDebuggingTraits(code, 1)).not.toThrow();
        });
        
        test('should handle empty string input', () => {
            // Arrange
            const code = '';
            
            // Act
            const issues = detectDebuggingTraits(code, 3);
            
            // Assert
            expect(issues).toHaveLength(0);
        });
        
        test('should return empty array for clean code', () => {
            // Arrange
            const code = sampleCode.cleanCode;
            
            // Act
            const issues = detectDebuggingTraits(code, 3);
            
            // Assert
            expect(issues).toHaveLength(0);
        });
        
    });
    
    describe('Issue Properties', () => {
        
        test('should return issues with correct structure', () => {
            // Arrange
            const code = sampleCode.nodeWarn.simple;
            
            // Act
            const issues = detectDebuggingTraits(code, 2);
            const issue = issues[0];
            
            // Assert
            expect(issue).toHaveProperty('type');
            expect(issue).toHaveProperty('message');
            expect(issue).toHaveProperty('line');
            expect(issue).toHaveProperty('column');
            expect(issue).toHaveProperty('severity');
            expect(typeof issue.type).toBe('string');
            expect(typeof issue.message).toBe('string');
            expect(typeof issue.line).toBe('number');
            expect(typeof issue.column).toBe('number');
            expect(typeof issue.severity).toBe('string');
        });
        
        test('should return correct line numbers', () => {
            // Arrange
            const code = `const x = 1;
const y = 2;
node.warn("debug");
const z = 4;
console.log(x, y, z);`;
            
            // Act
            const issues = detectDebuggingTraits(code, 2);
            const nodeWarnIssues = issues.filter(issue => issue.type === 'node-warn');
            
            // Assert
            expect(nodeWarnIssues).toHaveLength(1);
            expect(nodeWarnIssues[0].line).toBe(3);
        });
        
    });
    
});