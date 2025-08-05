const { parseScript } = require('meriyah');

// Parse ignore directives from code lines (reused from regex implementation)
function parseIgnoreDirectives(lines) {
    const ignoreRegions = [];
    const ignoreLines = new Set();
    const ignoreNextLines = new Set();
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();
        
        // Check for ignore-start directive
        if (trimmed.match(/\/\/\s*@nr-analyzer-ignore-start/i)) {
            // Find the corresponding end directive
            for (let j = i + 1; j < lines.length; j++) {
                const endLine = lines[j].trim();
                if (endLine.match(/\/\/\s*@nr-analyzer-ignore-end/i)) {
                    ignoreRegions.push({ start: i + 1, end: j + 1 }); // 1-based line numbers
                    break;
                }
            }
        }
        
        // Check for single line ignore
        if (trimmed.match(/\/\/\s*@nr-analyzer-ignore-line/i)) {
            ignoreLines.add(i + 1); // 1-based line numbers
        }
        
        // Check for ignore-next directive
        if (trimmed.match(/\/\/\s*@nr-analyzer-ignore-next/i)) {
            if (i + 1 < lines.length) {
                ignoreNextLines.add(i + 2); // 1-based line numbers (next line)
            }
        }
    }
    
    return { ignoreRegions, ignoreLines, ignoreNextLines };
}

// Check if a line should be ignored based on ignore directives
function shouldIgnoreLine(lineNumber, ignoreRegions, ignoreLines, ignoreNextLines) {
    // Check if line is in ignore regions
    for (const region of ignoreRegions) {
        if (lineNumber >= region.start && lineNumber <= region.end) {
            return true;
        }
    }
    
    // Check if line is explicitly ignored
    if (ignoreLines.has(lineNumber)) {
        return true;
    }
    
    // Check if line is marked as ignore-next
    if (ignoreNextLines.has(lineNumber)) {
        return true;
    }
    
    return false;
}

// Adjust line numbers in AST after wrapping code
function adjustLineNumbers(node, offset) {
    if (!node || typeof node !== 'object') return;
    
    if (node.loc && node.loc.start) {
        node.loc.start.line += offset;
        node.loc.end.line += offset;
    }
    
    for (let key in node) {
        if (Object.prototype.hasOwnProperty.call(node, key)) {
            let child = node[key];
            if (Array.isArray(child)) {
                child.forEach(item => adjustLineNumbers(item, offset));
            } else if (child && typeof child === 'object') {
                adjustLineNumbers(child, offset);
            }
        }
    }
}

// Find unused variables in the AST
function findUnusedVariables(ast) {
    const issues = [];
    const scopes = [];
    const globalScope = new Map(); // variable name -> { declared: Set, used: Set }
    scopes.push(globalScope);
    
    function getCurrentScope() {
        return scopes[scopes.length - 1];
    }
    
    function enterScope() {
        scopes.push(new Map());
    }
    
    function exitScope() {
        const currentScope = scopes.pop();
        
        // Check for unused variables in this scope
        for (const [varName, info] of currentScope.entries()) {
            for (const declNode of info.declared) {
                // Skip if variable is used anywhere in this scope
                if (info.used.size > 0) continue;
                
                // Skip function parameters and certain variable names
                if (isExemptVariable(varName, declNode)) continue;
                
                // Create issue for unused variable with precise highlighting
                const issue = createUnusedVariableIssue(varName, declNode);
                if (issue) {
                    issues.push(issue);
                }
            }
        }
    }
    
    function isExemptVariable(varName, declNode) {
        // Skip common exempt patterns
        if (varName.startsWith('_')) return true; // Underscore prefix indicates intentionally unused
        if (['msg', 'node', 'context', 'flow', 'global', 'env', 'RED'].includes(varName)) return true; // Node-RED globals
        
        // Skip function parameters - check if this is a parameter by looking at parent context
        if (declNode.type === 'Identifier') {
            let currentNode = declNode;
            while (currentNode && currentNode.parent) {
                const parentNode = currentNode.parent;
                if ((parentNode.type === 'FunctionDeclaration' || 
                     parentNode.type === 'ArrowFunctionExpression' || 
                     parentNode.type === 'FunctionExpression') &&
                    parentNode.params && parentNode.params.includes(currentNode)) {
                    return true;
                }
                currentNode = parentNode;
            }
        }
        
        // Skip function declarations that are never called (they might be intended for external use)
        if (declNode.type === 'FunctionDeclaration') {
            return true;
        }
        
        // Skip variable declarations assigned to functions (like arrow functions)
        if (declNode.type === 'VariableDeclarator' && 
            declNode.init && 
            (declNode.init.type === 'FunctionExpression' || 
             declNode.init.type === 'ArrowFunctionExpression')) {
            return true;
        }
        
        return false;
    }
    
    function createUnusedVariableIssue(varName, declNode) {
        if (!declNode.loc) return null;
        
        let startColumn = declNode.loc.start.column + 1;
        let endColumn = declNode.loc.end.column + 1;
        
        // For variable declarations, highlight only the variable name, not the whole declaration
        if (declNode.type === 'VariableDeclarator' && declNode.id) {
            startColumn = declNode.id.loc.start.column + 1;
            endColumn = declNode.id.loc.end.column + 1;
        }
        
        return {
            type: 'unused-variable',
            message: `Variable '${varName}' is declared but never used`,
            line: declNode.loc.start.line,
            column: startColumn,
            endColumn: endColumn,
            severity: 'info'
        };
    }
    
    function addVariableDeclaration(varName, node) {
        const currentScope = getCurrentScope();
        if (!currentScope.has(varName)) {
            currentScope.set(varName, { declared: new Set(), used: new Set() });
        }
        currentScope.get(varName).declared.add(node);
    }
    
    function addVariableUsage(varName, node) {
        // Look for variable in current scope chain (from innermost to outermost)
        for (let i = scopes.length - 1; i >= 0; i--) {
            const scope = scopes[i];
            if (scope.has(varName)) {
                scope.get(varName).used.add(node);
                return;
            }
        }
    }
    
    function analyzeNode(node, parent = null) {
        if (!node || typeof node !== 'object' || !node.type) return;
        
        node.parent = parent;
        
        // Handle scope creation
        if (node.type === 'FunctionDeclaration' || 
            node.type === 'FunctionExpression' || 
            node.type === 'ArrowFunctionExpression' ||
            node.type === 'BlockStatement' ||
            node.type === 'Program') {
            
            enterScope();
            
            // Add function parameters as declarations
            if (node.params) {
                for (const param of node.params) {
                    if (param.type === 'Identifier') {
                        addVariableDeclaration(param.name, param);
                    }
                }
            }
        }
        
        // Handle variable declarations
        if (node.type === 'VariableDeclarator' && node.id && node.id.type === 'Identifier') {
            addVariableDeclaration(node.id.name, node);
        }
        
        // Handle function declarations
        if (node.type === 'FunctionDeclaration' && node.id && node.id.type === 'Identifier') {
            addVariableDeclaration(node.id.name, node);
        }
        
        // Handle variable usage (identifier references)
        if (node.type === 'Identifier' && parent) {
            // Skip if this identifier is a declaration context
            const isDeclaration = (
                (parent.type === 'VariableDeclarator' && parent.id === node) ||
                (parent.type === 'FunctionDeclaration' && parent.id === node) ||
                (parent.type === 'Property' && parent.key === node && !parent.computed) ||
                (parent.type === 'MemberExpression' && parent.property === node && !parent.computed)
            );
            
            if (!isDeclaration) {
                addVariableUsage(node.name, node);
            }
        }
        
        // Recursively analyze child nodes
        for (let key in node) {
            if (Object.prototype.hasOwnProperty.call(node, key) && key !== 'parent' && key !== 'loc' && key !== 'range') {
                let child = node[key];
                if (Array.isArray(child)) {
                    child.forEach(item => {
                        if (item && typeof item === 'object' && item.type) {
                            analyzeNode(item, node);
                        }
                    });
                } else if (child && typeof child === 'object' && child.type) {
                    analyzeNode(child, node);
                }
            }
        }
        
        // Handle scope exit
        if (node.type === 'FunctionDeclaration' || 
            node.type === 'FunctionExpression' || 
            node.type === 'ArrowFunctionExpression' ||
            node.type === 'BlockStatement' ||
            node.type === 'Program') {
            
            exitScope();
        }
    }
    
    analyzeNode(ast);
    
    return issues;
}

// Find flow variable usage in the AST
function findFlowVariables(ast) {
    const flowVariables = [];
    
    function traverse(node) {
        if (!node || typeof node !== 'object' || !node.type) return;
        
        // Detect flow.get('variableName') calls
        if (node.type === 'CallExpression' && 
            node.callee && node.callee.type === 'MemberExpression' &&
            node.callee.object && node.callee.object.name === 'flow' &&
            node.callee.property && node.callee.property.name === 'get' &&
            node.arguments && node.arguments.length > 0 &&
            node.arguments[0].type === 'Literal' &&
            typeof node.arguments[0].value === 'string') {
            
            const variableName = node.arguments[0].value;
            const lineNumber = node.loc ? node.loc.start.line : null;
            
            if (lineNumber) {
                flowVariables.push({
                    type: 'flow-get',
                    variableName: variableName,
                    line: lineNumber,
                    column: node.arguments[0].loc.start.column + 1,
                    endColumn: node.arguments[0].loc.end.column + 1,
                    fullCallStart: node.loc.start.column + 1,
                    fullCallEnd: node.loc.end.column + 1
                });
            }
        }
        
        // Detect flow.set('variableName', value) calls
        if (node.type === 'CallExpression' && 
            node.callee && node.callee.type === 'MemberExpression' &&
            node.callee.object && node.callee.object.name === 'flow' &&
            node.callee.property && node.callee.property.name === 'set' &&
            node.arguments && node.arguments.length >= 2 &&
            node.arguments[0].type === 'Literal' &&
            typeof node.arguments[0].value === 'string') {
            
            const variableName = node.arguments[0].value;
            const lineNumber = node.loc ? node.loc.start.line : null;
            
            if (lineNumber) {
                flowVariables.push({
                    type: 'flow-set',
                    variableName: variableName,
                    line: lineNumber,
                    column: node.arguments[0].loc.start.column + 1,
                    endColumn: node.arguments[0].loc.end.column + 1,
                    fullCallStart: node.loc.start.column + 1,
                    fullCallEnd: node.loc.end.column + 1
                });
            }
        }
        
        // Recursively traverse child nodes
        for (let key in node) {
            if (Object.prototype.hasOwnProperty.call(node, key) && key !== 'parent' && key !== 'loc' && key !== 'range') {
                let child = node[key];
                if (Array.isArray(child)) {
                    child.forEach(item => {
                        if (item && typeof item === 'object' && item.type) {
                            traverse(item, node);
                        }
                    });
                } else if (child && typeof child === 'object' && child.type) {
                    traverse(child, node);
                }
            }
        }
    }
    
    traverse(ast);
    
    return flowVariables;
}

// AST-based debugging traits detector
function detectDebuggingTraitsAST(code, level = 1, options = {}) {
    const issues = [];
    
    // Handle null, undefined, or empty input
    if (!code || typeof code !== 'string') {
        return issues;
    }
    
    const lines = code.split('\n');
    
    // Parse ignore directives
    const { ignoreRegions, ignoreLines, ignoreNextLines } = parseIgnoreDirectives(lines);
    
    let ast;
    try {
        // Try parsing as a script first (allows top-level returns in Node-RED context)
        try {
            ast = parseScript(code, {
                loc: true,
                ranges: true,
                module: false,
                webcompat: true
            });
        } catch (scriptError) {
            // If script parsing fails due to top-level return, wrap in function
            if (scriptError.message.includes('Illegal return statement')) {
                const wrappedCode = `function nodeRedWrapper() {\n${code}\n}`;
                ast = parseScript(wrappedCode, {
                    loc: true,
                    ranges: true,
                    module: false,
                    webcompat: true
                });
                // Adjust line numbers for wrapped code
                adjustLineNumbers(ast, -1);
            } else {
                throw scriptError;
            }
        }
    } catch (error) {
        // If AST parsing fails, return empty array
        if (options.verbose) {
            // eslint-disable-next-line no-console
            console.warn('AST parsing failed:', error.message);
        }
        return [];
    }
    
    // Traverse the AST to find issues
    function traverse(node, parent = null, depth = 0) {
        if (!node || typeof node !== 'object' || !node.type) return;
        
        const nodeLineNumber = node.loc ? node.loc.start.line : null;
        
        // Skip if this line should be ignored
        if (nodeLineNumber && shouldIgnoreLine(nodeLineNumber, ignoreRegions, ignoreLines, ignoreNextLines)) {
            return;
        }
        
        // Level 1: Detect top-level return statements (ONLY empty returns)
        if (level >= 1 && node.type === 'ReturnStatement') {
            // IMPORTANT: Only flag empty returns (debugging artifacts), not returns with values
            const isEmptyReturn = !node.argument || node.argument === null;
            
            if (isEmptyReturn) {
                // Check if this return is TRULY at the top level (not inside any control structures)
                let currentNode = node;
                let isInNestedFunction = false;
                let isInControlStructure = false;
                let isAtTopLevel = false;
                
                while (currentNode && currentNode.parent) {
                    const parentNode = currentNode.parent;
                    
                    // If we find a function declaration/expression that's not our wrapper, we're nested
                    if ((parentNode.type === 'FunctionDeclaration' || 
                         parentNode.type === 'FunctionExpression' || 
                         parentNode.type === 'ArrowFunctionExpression') &&
                        !(parentNode.type === 'FunctionDeclaration' && 
                          parentNode.id && parentNode.id.name === 'nodeRedWrapper')) {
                        isInNestedFunction = true;
                        break;
                    }
                    
                    // Check if we're inside any control structure
                    if (parentNode.type === 'IfStatement' || 
                        parentNode.type === 'ForStatement' || 
                        parentNode.type === 'WhileStatement' || 
                        parentNode.type === 'DoWhileStatement' || 
                        parentNode.type === 'ForInStatement' || 
                        parentNode.type === 'ForOfStatement' || 
                        parentNode.type === 'SwitchStatement' || 
                        parentNode.type === 'TryStatement' || 
                        parentNode.type === 'CatchClause' || 
                        parentNode.type === 'WithStatement') {
                        isInControlStructure = true;
                    }
                    
                    // If we reach the Program or our wrapper function, we're at top level
                    if (parentNode.type === 'Program' || 
                        (parentNode.type === 'FunctionDeclaration' && 
                         parentNode.id && parentNode.id.name === 'nodeRedWrapper')) {
                        isAtTopLevel = true;
                        break;
                    }
                    
                    currentNode = parentNode;
                }
                
                // Debug logging (if enabled)
                if (options && options.debug) {
                    // eslint-disable-next-line no-console
                    console.log('Return statement found:', {
                        line: nodeLineNumber,
                        parentType: parent ? parent.type : 'no parent',
                        isEmptyReturn,
                        hasArgument: !!node.argument,
                        isInNestedFunction,
                        isInControlStructure,
                        isAtTopLevel,
                        parentParentType: parent && parent.parent ? parent.parent.type : 'no grandparent'
                    });
                }
                
                // Only flag empty returns that are at top level AND not in control structures AND not in nested functions
                if (isAtTopLevel && !isInControlStructure && !isInNestedFunction) {
                    if (nodeLineNumber) {
                        issues.push({
                            type: 'top-level-return',
                            message: 'Remove this top-level return statement',
                            line: nodeLineNumber,
                            column: node.loc.start.column + 1,
                            endColumn: node.loc.end.column + 1,
                            severity: 'warning'
                        });
                    }
                }
            }
        }
        
        // Level 2: Detect console.log, node.warn, debugger statements, and unused variables
        if (level >= 2) {
            // Detect console.log and console.* calls
            if (node.type === 'CallExpression' && 
                node.callee && node.callee.type === 'MemberExpression' &&
                node.callee.object && node.callee.object.name === 'console') {
                
                if (nodeLineNumber) {
                    issues.push({
                        type: 'console-log',
                        message: `Remove this console.${node.callee.property.name}() debugging statement`,
                        line: nodeLineNumber,
                        column: node.loc.start.column + 1,
                        endColumn: node.loc.end.column + 1,
                        severity: 'info'
                    });
                }
            }
            
            // Detect node.warn calls
            if (node.type === 'CallExpression' && 
                node.callee && node.callee.type === 'MemberExpression' &&
                node.callee.object && node.callee.object.name === 'node' &&
                node.callee.property && node.callee.property.name === 'warn') {
                
                if (nodeLineNumber) {
                    issues.push({
                        type: 'node-warn',
                        message: 'Remove this node.warn() debugging statement',
                        line: nodeLineNumber,
                        column: node.loc.start.column + 1,
                        endColumn: node.loc.end.column + 1,
                        severity: 'info'
                    });
                }
            }
            
            // Detect debugger statements
            if (node.type === 'DebuggerStatement') {
                if (nodeLineNumber) {
                    issues.push({
                        type: 'debugger-statement',
                        message: 'Remove this debugger statement',
                        line: nodeLineNumber,
                        column: node.loc.start.column + 1,
                        endColumn: node.loc.end.column + 1,
                        severity: 'warning'
                    });
                }
            }
        }
        
        // Level 3: Detect hardcoded test values
        if (level >= 3) {
            // Detect hardcoded string assignments
            if (node.type === 'AssignmentExpression' && 
                node.right && node.right.type === 'Literal' && 
                typeof node.right.value === 'string') {
                
                const value = node.right.value.toLowerCase();
                if (value === 'test' || value === 'debug' || value === 'temp') {
                    if (nodeLineNumber) {
                        issues.push({
                            type: `hardcoded-${value}`,
                            message: `Remove hardcoded ${value} value`,
                            line: nodeLineNumber,
                            column: node.right.loc.start.column + 1,
                            endColumn: node.right.loc.end.column + 1,
                            severity: 'warning'
                        });
                    }
                }
            }
            
            // Detect hardcoded variable declarations
            if (node.type === 'VariableDeclarator' && 
                node.init && node.init.type === 'Literal') {
                
                if (typeof node.init.value === 'string') {
                    const value = node.init.value.toLowerCase();
                    if (value === 'test' || value === 'debug' || value === 'temp') {
                        if (nodeLineNumber) {
                            issues.push({
                                type: `hardcoded-${value}`,
                                message: `Remove hardcoded ${value} value`,
                                line: nodeLineNumber,
                                column: node.init.loc.start.column + 1,
                                endColumn: node.init.loc.end.column + 1,
                                severity: 'warning'
                            });
                        }
                    }
                } else if (typeof node.init.value === 'number' && node.init.value === 123) {
                    if (nodeLineNumber) {
                        issues.push({
                            type: 'hardcoded-number',
                            message: 'Remove hardcoded test number',
                            line: nodeLineNumber,
                            column: node.init.loc.start.column + 1,
                            endColumn: node.init.loc.end.column + 1,
                            severity: 'warning'
                        });
                    }
                }
            }
        }
        
        // Recursively traverse child nodes (avoid infinite recursion)
        const visited = new Set();
        for (let key in node) {
            if (Object.prototype.hasOwnProperty.call(node, key) && key !== 'parent' && key !== 'loc' && key !== 'range') {
                let child = node[key];
                if (Array.isArray(child)) {
                    child.forEach(item => {
                        if (item && typeof item === 'object' && item.type && !visited.has(item)) {
                            visited.add(item);
                            item.parent = node; // Set parent reference
                            traverse(item, node, depth + 1);
                        }
                    });
                } else if (child && typeof child === 'object' && child.type && !visited.has(child)) {
                    visited.add(child);
                    child.parent = node; // Set parent reference
                    traverse(child, node, depth + 1);
                }
            }
        }
    }
    
    traverse(ast);
    
    // Level 2: Detect unused variables after AST traversal
    if (level >= 2) {
        const unusedVars = findUnusedVariables(ast);
        issues.push(...unusedVars.filter(issue => 
            !shouldIgnoreLine(issue.line, ignoreRegions, ignoreLines, ignoreNextLines)
        ));
    }
    
    // Level 3: Check for multiple empty lines (still needs line-by-line analysis)
    if (level >= 3) {
        let consecutiveEmptyLines = 0;
        let emptyLineStart = -1;
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            if (line.trim() === '') {
                if (consecutiveEmptyLines === 0) {
                    emptyLineStart = i;
                }
                consecutiveEmptyLines++;
            } else {
                if (consecutiveEmptyLines >= 2) {
                    // Check if the empty line region overlaps with any ignore regions
                    const regionStart = emptyLineStart + 1;
                    const regionEnd = emptyLineStart + consecutiveEmptyLines;
                    
                    let shouldIgnoreRegion = false;
                    for (let lineNum = regionStart; lineNum <= regionEnd; lineNum++) {
                        if (shouldIgnoreLine(lineNum, ignoreRegions, ignoreLines, ignoreNextLines)) {
                            shouldIgnoreRegion = true;
                            break;
                        }
                    }
                    
                    if (!shouldIgnoreRegion) {
                        issues.push({
                            type: 'multiple-empty-lines',
                            message: `Remove excessive empty lines (${consecutiveEmptyLines} consecutive empty lines)`,
                            line: regionStart,
                            endLine: regionEnd,
                            column: 1,
                            endColumn: 1,
                            severity: 'info'
                        });
                    }
                }
                consecutiveEmptyLines = 0;
            }
        }
        
        if (consecutiveEmptyLines >= 2) {
            // Check if the empty line region overlaps with any ignore regions
            const regionStart = emptyLineStart + 1;
            const regionEnd = emptyLineStart + consecutiveEmptyLines;
            
            let shouldIgnoreRegion = false;
            for (let lineNum = regionStart; lineNum <= regionEnd; lineNum++) {
                if (shouldIgnoreLine(lineNum, ignoreRegions, ignoreLines, ignoreNextLines)) {
                    shouldIgnoreRegion = true;
                    break;
                }
            }
            
            if (!shouldIgnoreRegion) {
                issues.push({
                    type: 'multiple-empty-lines',
                    message: `Remove excessive empty lines (${consecutiveEmptyLines} consecutive empty lines)`,
                    line: regionStart,
                    endLine: regionEnd,
                    column: 1,
                    endColumn: 1,
                    severity: 'info'
                });
            }
        }
    }
    
    // Level 2: Check for TODO/FIXME comments and consecutive inline comments
    if (level >= 2) {
        let consecutiveInlineComments = [];
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const lineNumber = i + 1;
            
            // Check for TODO/FIXME comments
            const todoMatch = line.match(/(TODO|FIXME):/i);
            if (todoMatch && !shouldIgnoreLine(lineNumber, ignoreRegions, ignoreLines, ignoreNextLines)) {
                issues.push({
                    type: 'todo-comment',
                    message: `${todoMatch[1].toUpperCase()} comment found - consider resolving`,
                    line: lineNumber,
                    column: todoMatch.index + 1,
                    endColumn: line.length + 1,
                    severity: 'info'
                });
            }
            
            // Check for consecutive inline comments (// style only, not /* */ style)
            const trimmedLine = line.trim();
            const inlineCommentMatch = trimmedLine.match(/^\/\/(.*)$/);
            
            if (inlineCommentMatch) {
                // This is an inline comment, add it to our consecutive tracker
                consecutiveInlineComments.push({
                    line: lineNumber,
                    content: inlineCommentMatch[1].trim(),
                    originalLine: line
                });
            } else if (trimmedLine === '' && consecutiveInlineComments.length > 0) {
                // Empty line - continue tracking but don't reset (allows for spacing)
                continue;
            } else {
                // Non-comment, non-empty line - check if we have consecutive comments to report
                if (consecutiveInlineComments.length >= 2) {
                    // Check if any of these lines should be ignored
                    let shouldIgnoreGroup = false;
                    for (const comment of consecutiveInlineComments) {
                        if (shouldIgnoreLine(comment.line, ignoreRegions, ignoreLines, ignoreNextLines)) {
                            shouldIgnoreGroup = true;
                            break;
                        }
                    }
                    
                    if (!shouldIgnoreGroup) {
                        const firstComment = consecutiveInlineComments[0];
                        const lastComment = consecutiveInlineComments[consecutiveInlineComments.length - 1];
                        
                        issues.push({
                            type: 'consecutive-inline-comments',
                            message: `Consider removing this commented-out code if no longer needed (${consecutiveInlineComments.length} lines)`,
                            line: firstComment.line,
                            endLine: lastComment.line,
                            column: 1,
                            endColumn: lastComment.originalLine.length + 1,
                            severity: 'info',
                            count: consecutiveInlineComments.length
                        });
                    }
                }
                
                // Reset the consecutive comments tracker
                consecutiveInlineComments = [];
            }
        }
        
        // Handle case where file ends with consecutive inline comments
        if (consecutiveInlineComments.length >= 2) {
            let shouldIgnoreGroup = false;
            for (const comment of consecutiveInlineComments) {
                if (shouldIgnoreLine(comment.line, ignoreRegions, ignoreLines, ignoreNextLines)) {
                    shouldIgnoreGroup = true;
                    break;
                }
            }
            
            if (!shouldIgnoreGroup) {
                const firstComment = consecutiveInlineComments[0];
                const lastComment = consecutiveInlineComments[consecutiveInlineComments.length - 1];
                
                issues.push({
                    type: 'consecutive-inline-comments',
                    message: `Consider removing this commented-out code if no longer needed (${consecutiveInlineComments.length} lines)`,
                    line: firstComment.line,
                    endLine: lastComment.line,
                    column: 1,
                    endColumn: lastComment.originalLine.length + 1,
                    severity: 'info',
                    count: consecutiveInlineComments.length
                });
            }
        }
    }
    
    return issues;
}


module.exports = {
    detectDebuggingTraitsAST,
    parseIgnoreDirectives,
    shouldIgnoreLine,
    findFlowVariables,
    adjustLineNumbers
};