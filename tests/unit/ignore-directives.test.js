const { detectDebuggingTraits, parseIgnoreDirectives, shouldIgnoreLine } = require('../../lib/detection/detector');

describe('Ignore Directives', () => {
    describe('parseIgnoreDirectives', () => {
        test('should parse ignore-start and ignore-end directives', () => {
            const lines = [
                'console.log("normal");',
                '// @nr-analyzer-ignore-start',
                'return;',
                'node.warn("debug");',
                '// @nr-analyzer-ignore-end',
                'console.log("normal again");'
            ];
            
            const result = parseIgnoreDirectives(lines);
            
            expect(result.ignoreRegions).toEqual([
                { start: 2, end: 5 }
            ]);
            expect(result.ignoreLines.size).toBe(0);
            expect(result.ignoreNextLines.size).toBe(0);
        });

        test('should parse ignore-line directive', () => {
            const lines = [
                'console.log("normal");',
                'return; // @nr-analyzer-ignore-line',
                'console.log("normal again");'
            ];
            
            const result = parseIgnoreDirectives(lines);
            
            expect(result.ignoreRegions).toEqual([]);
            expect(result.ignoreLines.has(2)).toBe(true);
            expect(result.ignoreNextLines.size).toBe(0);
        });

        test('should parse ignore-next directive', () => {
            const lines = [
                'console.log("normal");',
                '// @nr-analyzer-ignore-next',
                'return;',
                'console.log("normal again");'
            ];
            
            const result = parseIgnoreDirectives(lines);
            
            expect(result.ignoreRegions).toEqual([]);
            expect(result.ignoreLines.size).toBe(0);
            expect(result.ignoreNextLines.has(3)).toBe(true);
        });

        test('should handle multiple ignore regions', () => {
            const lines = [
                'console.log("normal");',
                '// @nr-analyzer-ignore-start',
                'return;',
                '// @nr-analyzer-ignore-end',
                'console.log("normal");',
                '// @nr-analyzer-ignore-start',
                'node.warn("debug");',
                '// @nr-analyzer-ignore-end',
                'console.log("normal again");'
            ];
            
            const result = parseIgnoreDirectives(lines);
            
            expect(result.ignoreRegions).toEqual([
                { start: 2, end: 4 },
                { start: 6, end: 8 }
            ]);
        });

        test('should handle mixed directive types', () => {
            const lines = [
                'console.log("normal");',
                '// @nr-analyzer-ignore-start',
                'return;',
                '// @nr-analyzer-ignore-end',
                'node.warn("debug"); // @nr-analyzer-ignore-line',
                '// @nr-analyzer-ignore-next',
                'const test = "test";',
                'console.log("normal again");'
            ];
            
            const result = parseIgnoreDirectives(lines);
            
            expect(result.ignoreRegions).toEqual([
                { start: 2, end: 4 }
            ]);
            expect(result.ignoreLines.has(5)).toBe(true);
            expect(result.ignoreNextLines.has(7)).toBe(true);
        });


        test('should handle case insensitive directives', () => {
            const lines = [
                'console.log("normal");',
                '// @NR-ANALYZER-IGNORE-START',
                'return;',
                '// @nr-analyzer-ignore-END',
                'console.log("normal again");'
            ];
            
            const result = parseIgnoreDirectives(lines);
            
            expect(result.ignoreRegions).toEqual([
                { start: 2, end: 4 }
            ]);
        });

        test('should handle unmatched ignore-start (no corresponding end)', () => {
            const lines = [
                'console.log("normal");',
                '// @nr-analyzer-ignore-start',
                'return;',
                'node.warn("debug");',
                'console.log("normal again");'
            ];
            
            const result = parseIgnoreDirectives(lines);
            
            expect(result.ignoreRegions).toEqual([]);
        });
    });

    describe('shouldIgnoreLine', () => {
        test('should return true for lines in ignore regions', () => {
            const ignoreRegions = [{ start: 2, end: 4 }];
            const ignoreLines = new Set();
            const ignoreNextLines = new Set();
            
            expect(shouldIgnoreLine(2, ignoreRegions, ignoreLines, ignoreNextLines)).toBe(true);
            expect(shouldIgnoreLine(3, ignoreRegions, ignoreLines, ignoreNextLines)).toBe(true);
            expect(shouldIgnoreLine(4, ignoreRegions, ignoreLines, ignoreNextLines)).toBe(true);
            expect(shouldIgnoreLine(1, ignoreRegions, ignoreLines, ignoreNextLines)).toBe(false);
            expect(shouldIgnoreLine(5, ignoreRegions, ignoreLines, ignoreNextLines)).toBe(false);
        });

        test('should return true for explicitly ignored lines', () => {
            const ignoreRegions = [];
            const ignoreLines = new Set([3, 7]);
            const ignoreNextLines = new Set();
            
            expect(shouldIgnoreLine(3, ignoreRegions, ignoreLines, ignoreNextLines)).toBe(true);
            expect(shouldIgnoreLine(7, ignoreRegions, ignoreLines, ignoreNextLines)).toBe(true);
            expect(shouldIgnoreLine(1, ignoreRegions, ignoreLines, ignoreNextLines)).toBe(false);
            expect(shouldIgnoreLine(5, ignoreRegions, ignoreLines, ignoreNextLines)).toBe(false);
        });

        test('should return true for ignore-next lines', () => {
            const ignoreRegions = [];
            const ignoreLines = new Set();
            const ignoreNextLines = new Set([3, 7]);
            
            expect(shouldIgnoreLine(3, ignoreRegions, ignoreLines, ignoreNextLines)).toBe(true);
            expect(shouldIgnoreLine(7, ignoreRegions, ignoreLines, ignoreNextLines)).toBe(true);
            expect(shouldIgnoreLine(1, ignoreRegions, ignoreLines, ignoreNextLines)).toBe(false);
            expect(shouldIgnoreLine(5, ignoreRegions, ignoreLines, ignoreNextLines)).toBe(false);
        });
    });

    describe('detectDebuggingTraits with ignore directives', () => {
        test('should ignore issues in ignore regions', () => {
            const code = `
console.log("normal");
// @nr-analyzer-ignore-start
return;
node.warn("debug");
// @nr-analyzer-ignore-end
console.log("normal again");
            `.trim();
            
            const issues = detectDebuggingTraits(code, 2);
            
            // Should detect the 2 console.log statements outside ignore region
            expect(issues).toHaveLength(2);
            expect(issues[0].type).toBe('console-log');
            expect(issues[0].line).toBe(1);
            expect(issues[1].type).toBe('console-log');
            expect(issues[1].line).toBe(6);
        });

        test('should ignore issues with ignore-line directive', () => {
            const code = `
console.log("normal");
return; // @nr-analyzer-ignore-line
node.warn("debug");
            `.trim();
            
            const issues = detectDebuggingTraits(code, 2);
            
            // Should detect console.log and node.warn, but not the return (ignored)
            expect(issues).toHaveLength(2);
            expect(issues[0].type).toBe('console-log');
            expect(issues[0].line).toBe(1);
            expect(issues[1].type).toBe('node-warn');
            expect(issues[1].line).toBe(3);
        });

        test('should ignore issues with ignore-next directive', () => {
            const code = `
console.log("normal");
// @nr-analyzer-ignore-next
return;
node.warn("debug");
            `.trim();
            
            const issues = detectDebuggingTraits(code, 2);
            
            // Should detect console.log and node.warn, but not return (ignored by ignore-next)
            expect(issues).toHaveLength(2);
            expect(issues[0].type).toBe('console-log');
            expect(issues[0].line).toBe(1);
            expect(issues[1].type).toBe('node-warn');
            expect(issues[1].line).toBe(4);
        });

        test('should handle multiple ignore types together', () => {
            const code = `
console.log("normal");
// @nr-analyzer-ignore-start
return;
const debug = "debug";
// @nr-analyzer-ignore-end
node.warn("debug1"); // @nr-analyzer-ignore-line
// @nr-analyzer-ignore-next
node.warn("debug2");
node.warn("debug3");
            `.trim();
            
            const issues = detectDebuggingTraits(code, 3);
            
            // Should detect console.log and the last node.warn only
            expect(issues).toHaveLength(2);
            expect(issues[0].type).toBe('console-log');
            expect(issues[0].line).toBe(1);
            expect(issues[1].type).toBe('node-warn');
            expect(issues[1].line).toBe(9);
        });

        test('should ignore hardcoded values in ignore regions', () => {
            const code = `
console.log("normal");
// @nr-analyzer-ignore-start
const test = "test";
const debug = "debug";
const temp = "temp";
const num = 123;
// @nr-analyzer-ignore-end
const realTest = "test";
node.log(realTest);
            `.trim();
            
            const issues = detectDebuggingTraits(code, 3);
            
            // Should detect only console.log and hardcoded test outside ignore region
            const relevantIssues = issues.filter(issue => 
                issue.type === 'console-log' || issue.type.startsWith('hardcoded-')
            );
            expect(relevantIssues).toHaveLength(2);
            expect(relevantIssues.some(issue => issue.type === 'console-log' && issue.line === 1)).toBe(true);
            expect(relevantIssues.some(issue => issue.type === 'hardcoded-test' && issue.line === 8)).toBe(true);
        });

        test('should ignore TODO comments in ignore regions', () => {
            const code = `
console.log("normal");
// @nr-analyzer-ignore-start
// TODO: This is ignored
// FIXME: This is also ignored
// @nr-analyzer-ignore-end
// TODO: This should be detected
            `.trim();
            
            const issues = detectDebuggingTraits(code, 2);
            
            // Should detect console.log and the TODO outside ignore region
            expect(issues).toHaveLength(2);
            expect(issues[0].type).toBe('console-log');
            expect(issues[0].line).toBe(1);
            expect(issues[1].type).toBe('todo-comment');
            expect(issues[1].line).toBe(6);
        });

        test('should ignore multiple empty lines in ignore regions', () => {
            const code = `
console.log("normal");
// @nr-analyzer-ignore-start


// Multiple empty lines above should be ignored
// @nr-analyzer-ignore-end


console.log("normal again");
            `.trim();
            
            const issues = detectDebuggingTraits(code, 3);
            
            // Should detect both console.log statements and the empty lines outside ignore region
            expect(issues).toHaveLength(3);
            expect(issues[0].type).toBe('console-log');
            expect(issues[0].line).toBe(1);
            expect(issues[1].type).toBe('console-log');
            expect(issues[1].line).toBe(9);
            expect(issues[2].type).toBe('multiple-empty-lines');
            expect(issues[2].line).toBe(7);
        });

        test('should handle nested ignore directives gracefully', () => {
            const code = `
console.log("normal");
// @nr-analyzer-ignore-start
return;
// @nr-analyzer-ignore-start (nested, should be ignored)
node.warn("debug");
// @nr-analyzer-ignore-end
// @nr-analyzer-ignore-end
console.log("normal again");
            `.trim();
            
            const issues = detectDebuggingTraits(code, 2);
            
            // Should detect both console.log statements outside ignore region
            expect(issues).toHaveLength(2);
            expect(issues[0].type).toBe('console-log');
            expect(issues[0].line).toBe(1);
            expect(issues[1].type).toBe('console-log');
            expect(issues[1].line).toBe(8);
        });
    });
});