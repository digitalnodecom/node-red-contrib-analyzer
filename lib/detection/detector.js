// Parse ignore directives from code lines
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

function detectDebuggingTraits(code, level = 1, options = {}) {
    const { detectDebuggingTraitsAST } = require('./ast-detector');
    const result = detectDebuggingTraitsAST(code, level, options);
    
    // Add metadata to indicate which detector was used
    if (options.includeMetadata) {
        result._metadata = {
            detectorUsed: 'AST',
            parsingSuccess: true,
            library: 'meriyah'
        };
    }
    
    return result;
}


module.exports = {
    detectDebuggingTraits,
    parseIgnoreDirectives,
    shouldIgnoreLine
};