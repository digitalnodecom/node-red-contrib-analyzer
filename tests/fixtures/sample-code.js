// Sample code snippets for testing the detector

module.exports = {
    // Level 1 issues - Critical (only empty returns)
    topLevelReturn: {
        simple: `console.log("start");
return;`,
        withSemicolon: `console.log("start");
return;`,
        withSpaces: `console.log("start");
   return   ;`,
        validReturn: `
function test() {
    if (condition) {
        return result;
    }
}`,
        nestedReturn: `
function test() {
    if (condition) {
        return;
    }
}`
    },

    // Level 2 issues - Important
    nodeWarn: {
        simple: 'node.warn("debug message");',
        withVariable: 'node.warn(debugVariable);',
        multipleWarns: `
node.warn("first");
node.warn("second");`,
        validLog: 'node.log("info message");'
    },

    todoComments: {
        todoUppercase: '// TODO: fix this later',
        todoLowercase: '// todo: implement feature',
        fixmeUppercase: '// FIXME: broken logic',
        fixmeLowercase: '// fixme: needs work',
        validComment: '// Regular comment'
    },

    // Level 3 issues - Minor
    hardcodedValues: {
        testString: 'const value = "test"; console.log(value);',
        debugString: 'const mode = "debug"; console.log(mode);',
        tempString: 'const temp = "temp"; console.log(temp);',
        testNumber: 'const num = 123; console.log(num);',
        validValues: 'const name = "production"; console.log(name);'
    },

    // Multiple issues
    multipleIssues: `return; // Level 1
node.warn("debugging"); // Level 2
const mode = "test"; // Level 3
// TODO: optimize this // Level 2`,

    // Clean code
    cleanCode: `
function processMessage(msg) {
    if (!msg.payload) {
        node.error("No payload provided");
        return null;
    }
    
    const result = processPayload(msg.payload);
    node.log("Processing completed");
    return result;
}`,

    // Edge cases
    edgeCases: {
        emptyFunction: 'function test() {}',
        onlyComments: '// This is just a comment',
        multipleEmptyLines: `
function test() {


    return "value";
}`,
        complexNested: `
function complex() {
    if (condition) {
        try {
            return processData();
        } catch (error) {
            node.warn("Error occurred");
            return null;
        }
    }
}`
    }
};