# Node-RED Code Analyzer

[![CI/CD Pipeline](https://github.com/your-username/node-red-contrib-code-analyzer/actions/workflows/ci.yml/badge.svg)](https://github.com/your-username/node-red-contrib-code-analyzer/actions/workflows/ci.yml)
[![Coverage Status](https://codecov.io/gh/your-username/node-red-contrib-code-analyzer/branch/main/graph/badge.svg)](https://codecov.io/gh/your-username/node-red-contrib-code-analyzer)

A comprehensive Node-RED package that provides static code analysis, performance monitoring, queue monitoring, and IDE-like development helpers to enhance your Node-RED development experience with intelligent debugging and observability features.

## Features

- **🔍 Static Code Analysis**: Detects debugging artifacts, code quality issues, and potential problems in function nodes
- **🎯 IDE-like Click Navigation**: Click on flow.get() variables to instantly navigate to where they were set
- **💡 IDE-like Variable Inspection**: Hover over flow.get() calls to see current variable values in real-time
- **📊 Queue Monitoring**: Monitors delay node queues and sends intelligent alerts for bottlenecks
- **⚡ Performance Monitoring**: Tracks CPU, memory, and event loop metrics with sustained alerting
- **📈 Historical Dashboard**: Web-based dashboard for error observability, trends, analytics, and performance metrics over time
- **🔔 Slack Integration**: Sends formatted alerts to Slack channels with rich context
- **🖥️ Monaco Editor Integration**: Real-time highlighting and problem markers in the Node-RED editor
- **🎛️ Configurable Detection**: Multiple detection levels, thresholds, and customizable rules
- **📊 Real-time Monitoring**: Continuous background scanning with minimal performance impact

## Detection Levels

The analyzer provides 3 levels of detection strictness:

### Level 1: Critical Issues
Detects only the most critical debugging artifacts:
- **Top-level return statements**: `return;` statements at the function's top level (not inside blocks)

### Level 2: Standard Issues
Includes Level 1 plus:
- **console.log() statements**: Console logging debugging statements
- **debugger statements**: JavaScript debugger breakpoints
- **node.warn() statements**: Debugging output using Node-RED's warning system
- **TODO/FIXME comments**: Development reminders with colon syntax (`TODO:`, `FIXME:`)
- **unused variables**: Variables declared but never referenced in the code

### Level 3: Comprehensive Issues
Includes Level 2 plus:
- **Hardcoded test values**: Common test patterns like `= "test"`, `= "debug"`, `= "temp"`, `= 123`
- **Multiple empty lines**: 2 or more consecutive empty lines

## Unused Variables Detection

The analyzer includes intelligent unused variable detection that identifies variables declared but never referenced in your code. This feature helps keep your Node-RED functions clean and performant by flagging potential dead code.

### Features

- **Smart exemptions**: Automatically excludes Node-RED globals (`msg`, `node`, `context`, `flow`, `global`, `env`, `RED`)
- **Intentional ignoring**: Variables prefixed with underscore (`_unused`) are ignored
- **Function parameters**: Function parameters are never flagged as unused
- **Function declarations**: Function declarations are excluded (may be for external use)
- **Precise highlighting**: Only highlights the variable name, not the entire declaration line

### Examples

```javascript
// ❌ Will be flagged as unused
let unusedVariable = "some value";
let data = fetchData();

// ✅ Will NOT be flagged (Node-RED globals)
let msg = {}; 
let node = RED.nodes.getNode(this);

// ✅ Will NOT be flagged (underscore prefix)
let _temp = "intentionally unused";
 
// ✅ Will NOT be flagged (function parameters)
function processData(input, options) {
    return input.value; // 'options' is not flagged
}

// Usage example that avoids unused variable warnings
let data = fetchData();
let result = processData(data);
node.send({payload: result});
```

### Multiple Variable Declarations

When multiple variables are declared on one line, only the unused ones are highlighted:

```javascript
let used = 1, unused = 2, alsoUsed = 3;
console.log(used, alsoUsed); 
// Only 'unused' will be flagged and highlighted
```

## Flow Variable Navigation

The analyzer provides IDE-like navigation for flow variables, allowing you to instantly jump from `flow.get()` calls to their corresponding `flow.set()` definitions within the same flow.

### 🎯 Click-to-Find-Source

Navigate from any `flow.get()` call to its definition:

1. **Ctrl+Click** (or **Cmd+Click** on Mac) on any variable name in `flow.get('variableName')` calls
2. **Instantly navigate** to the corresponding `flow.set('variableName', value)` location
3. **Automatic highlighting** of the target line with temporary visual feedback

```javascript
// Click on 'userData' in this line:
let user = flow.get('userData');

// Automatically navigates to:
flow.set('userData', { name: 'John', id: 123 });
```

### 🎨 Multiple Location Selector

When multiple `flow.set()` calls exist for the same variable, a beautiful dropdown selector appears:

- **Elegant modal interface** with hover effects and smooth animations
- **Clear location information**: Node name, line number, and node ID preview
- **Multiple interaction options**: Click selection, Escape to cancel, or click outside
- **Smart navigation**: Opens target node editor and highlights exact line

### ✨ Smart Features

- **Flow-scoped search**: Only searches within the current flow for better organization
- **Real-time AST parsing**: Accurately detects flow variables using JavaScript AST analysis
- **Graceful error handling**: User-friendly messages when definitions aren't found
- **Non-intrusive**: Only appears when analyzer node is present in the flow

### 🔧 Setup Requirements

- **Code Analyzer node** must be deployed in the same flow as your function nodes
- **Automatic scanning** runs in the background (configurable interval)
- **No manual setup** required - works immediately after deployment

### 💡 Usage Tips

- **Group related flows**: Keep `flow.set()` and `flow.get()` calls in the same flow for best navigation
- **Descriptive node names**: Use clear function node names for better navigation experience
- **Recent scanning**: The analyzer scans automatically, but you can trigger manual scans by sending messages to the analyzer node

### 🎯 Keyboard Shortcuts

- **Ctrl+Click** / **Cmd+Click**: Navigate to flow variable source
- **Ctrl+F12** / **Cmd+F12**: Alternative keyboard shortcut (place cursor on flow.get() call)
- **Escape**: Cancel multi-location selector

## Real-time Quality Dashboard

The analyzer includes a comprehensive web-based dashboard that provides real-time insights into code quality trends, technical debt accumulation, and system performance metrics.

### 🚀 Dashboard Features

- **Live Quality Metrics**: Real-time overall quality score with letter grades (A+ to F)
- **Technical Debt Tracking**: Visual representation of code quality degradation over time
- **Flow-by-Flow Analysis**: Detailed breakdown of quality metrics for each Node-RED flow
- **Most Problematic Nodes**: Identify the function nodes requiring immediate attention
- **Performance Monitoring**: CPU, memory, and event loop lag visualization
- **Historical Trends**: 24-hour and 7-day trend analysis with smart change detection
- **Alert Management**: Real-time display of system alerts and threshold violations

### 📈 Quality Scoring System

The dashboard uses a sophisticated scoring algorithm that considers:

- **Issue Severity**: Critical issues (return statements, debugger) heavily penalized
- **Code Complexity**: Cyclomatic complexity, nesting depth, and function length
- **Technical Debt Ratio**: Issues per node across your entire Node-RED instance
- **Trend Analysis**: Quality improvement or degradation over time

### 🎯 Dashboard Sections

1. **Overview Cards**: At-a-glance system health with quality score, technical debt, flow count, and complexity
2. **Quality Trends Chart**: Time-series visualization of quality score changes
3. **Performance Metrics**: Real-time system performance with CPU and memory usage
4. **Flow Quality Breakdown**: Per-flow analysis with health percentages and issue counts
5. **Problematic Nodes**: Ranked list of nodes requiring immediate attention
6. **Recent Alerts**: System alerts and performance threshold violations

### 🔧 Dashboard Access

Access the dashboard through:

1. **Node Configuration**: Click "Open Real-time Code Quality Dashboard" in the Code Analyzer node settings
2. **Direct URL**: Navigate to `/code-analyzer/dashboard` in your Node-RED instance
3. **Auto-refresh**: Dashboard automatically updates every 5 minutes with latest data

### ⚡ Performance Impact

The dashboard is designed for minimal performance impact:

- **Efficient Database**: SQLite storage with automatic data pruning
- **Smart Caching**: API endpoints cache expensive calculations
- **Background Processing**: Quality calculations run during normal scan cycles
- **Configurable Retention**: Adjustable data retention (1-30 days)

## Variable Value Tooltips

The analyzer provides intelligent hover tooltips that display the actual runtime values of flow and environment variables directly in your code editor, similar to modern IDEs like VS Code.

### 🔍 Real-time Value Inspection

Simply hover over any `flow.get()` or `env.get()` call to see its current value:

```javascript
// Hover over these to see their values:
let userData = flow.get('userProfile');    // Shows: Flow variable: userProfile
let apiKey = env.get('api_secret');        // Shows: Env variable: api_secret
```

### 📊 Smart Object Display

The tooltips intelligently format different data types:

- **Strings**: `"user@example.com"`
- **Numbers**: `42`
- **Booleans**: `true`
- **Objects**: 📦 **Object{5}** with property previews and expandable JSON
- **Arrays**: 🔢 **Array[1467]** with item previews and expandable JSON

### 🗂️ Rich Object Inspection

For complex objects and arrays, tooltips provide:

- **Structure overview**: Quick preview of object properties and array items
- **Type indicators**: Visual emoji indicators (📦 for objects, 🔢 for arrays)
- **Smart truncation**: Shows first few items/properties with counts
- **Expandable JSON**: Click "📋 View Full JSON" to see complete formatted data
- **Performance optimized**: Handles large objects gracefully with intelligent truncation

### 💡 Context-Aware Access

- **Flow variables**: Retrieved from the current flow's context
- **Environment variables**: Retrieved from flow-level environment configuration
- **Current values**: Shows actual runtime values, not configuration defaults
- **Flow-scoped**: Only shows variables accessible within the current flow

### ✨ Example Tooltip Display

```
Flow variable: global-mappings

📦 Object{5} - Click to expand in console

brands: 🔢 Array[1]
blacklist_brands: 🔢 Array[0]
colors: 🔢 Array[5]
countries: 🔢 Array[3]
materials: 🔢 Array[1]
version: 📦 Object{3}

📋 View Full JSON
{
  "brands": [...],
  "colors": [...],
  // ... complete JSON structure
}
```

### 🔧 Setup Requirements

- **Code Analyzer node** must be deployed in the same flow
- **Automatic operation**: No configuration needed, works immediately
- **Monaco editor**: Integrates with Node-RED's built-in code editor


## Ignore Directives

Sometimes you need to intentionally use debugging code or patterns that the analyzer would normally flag. You can use comment-based ignore directives to exclude specific lines or regions from analysis:

### Region Ignoring
```javascript
// @nr-analyzer-ignore-start
return; // This will be ignored
node.warn("This debug statement is intentional");
const test = "test"; // This hardcoded value is ignored
// @nr-analyzer-ignore-end
```

### Single Line Ignoring
```javascript
return; // @nr-analyzer-ignore-line
node.warn("debug"); // This line will be flagged
```

### Next Line Ignoring
```javascript
// @nr-analyzer-ignore-next
return; // This line will be ignored
node.warn("debug"); // This line will be flagged
```

### Supported Directive Formats
- `@nr-analyzer-ignore-*` (required spelling)
- Case insensitive: `@NR-ANALYZER-IGNORE-START` works the same
- Flexible spacing: `// @nr-analyzer-ignore-start` and `//   @nr-analyzer-ignore-start` both work

### What Gets Ignored
All detection levels respect ignore directives:
- **Level 1**: Top-level return statements
- **Level 2**: console.log(), debugger statements, node.warn() calls, TODO/FIXME comments, and unused variables
- **Level 3**: Hardcoded values and excessive empty lines

## Performance Monitoring

The performance monitoring feature continuously tracks your Node-RED instance's system metrics and provides intelligent alerting based on sustained threshold violations. Unlike traditional monitoring that alerts on momentary spikes, this system only triggers alerts when metrics remain above thresholds for a configured duration (e.g., CPU above 75% for 5+ minutes), preventing false alarms from temporary load spikes. All metrics are stored in a local SQLite database with automatic data retention management, and alerts include average values over the sustained period rather than instantaneous readings for more accurate performance insights.

### Performance Monitoring Configuration

| Field | Description | Recommended Value |
|-------|-------------|------------------|
| **Performance Monitoring** | Enable/disable system performance tracking | `Enabled` for production systems |
| **Performance Check Interval** | How often to collect metrics (seconds) | `10-30 seconds` |
| **CPU Threshold** | CPU usage percentage that triggers alerts | `70-80%` |
| **Memory Threshold** | Memory usage percentage that triggers alerts | `75-85%` |
| **Event Loop Lag Threshold** | Event loop delay in milliseconds | `10-50ms` |
| **Sustained Alert Duration** | Time metrics must exceed thresholds before alerting | `300 seconds (5 minutes)` |
| **Alert Cooldown** | Wait time between repeated alerts for same issue | `1800 seconds (30 minutes)` |
| **Database Retention** | Days to keep performance metrics in database | `7 days` |

### How It Works

1. **Continuous Monitoring**: Collects CPU, memory, and event loop metrics at regular intervals
2. **Sustained Analysis**: Only alerts when metrics exceed thresholds for the configured duration
3. **Smart Alerting**: Prevents notification spam with configurable cooldown periods
4. **Data Storage**: Uses SQLite database for historical data and trend analysis
5. **Automatic Cleanup**: Prunes old data based on retention settings

## Installation

```bash
npm install node-red-contrib-code-analyzer
```

## Usage

1. Add the "Code Analyzer" node to your Node-RED flow
2. Configure the detection settings in the node properties
3. Deploy the flow to start monitoring
4. **Flow Variable Navigation**: Ctrl+Click on any `flow.get('variableName')` call to navigate to its `flow.set()` definition

## Development

### Prerequisites

- Node.js 16.x or higher
- npm 7.x or higher

### Installation

```bash
git clone https://github.com/your-username/node-red-contrib-code-analyzer.git
cd node-red-contrib-code-analyzer
npm install
```

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run linter
npm run lint
```

### Test Structure

Our test suite follows the **AAA pattern** (Arrange, Act, Assert) and includes:

- **Unit Tests**: Test individual components in isolation
- **Integration Tests**: Test end-to-end functionality
- **Edge Cases**: Handle malformed inputs and error conditions
- **Performance Tests**: Ensure scalability with large codebases

### Test Coverage

We maintain **80%+ test coverage** across all modules:

- `lib/detector.js` - Core detection logic
- `lib/slack-notifier.js` - Notification system
- `nodes/analyzer.js` - Node-RED integration

### Continuous Integration

GitHub Actions automatically runs:

- ✅ **Multi-Node Testing**: Tests on Node.js 16, 18, and 20
- 🔍 **Code Quality**: ESLint and formatting checks
- 🛡️ **Security Audit**: Vulnerability scanning
- 📊 **Coverage Reports**: Automatic coverage reporting
- 🚀 **Build Validation**: Ensures deployability

### Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Add tests for your changes
5. Ensure all tests pass (`npm test`)
6. Commit your changes (`git commit -m 'Add amazing feature'`)
7. Push to the branch (`git push origin feature/amazing-feature`)
8. Open a Pull Request

### Pull Request Requirements

- ✅ All tests must pass
- 📊 Coverage must remain above 80%
- 🔍 Code must pass linting
- 🛡️ No high-severity security vulnerabilities
- 📝 Include relevant tests for new features

## Configuration

### Detection Levels

- **Level 1**: Critical issues (top-level returns)
- **Level 2**: Important issues (console.log, debugger, node.warn, TODO comments, unused variables)
- **Level 3**: Minor issues (hardcoded values, formatting)

### Code Analysis

- **Detection Levels**: Choose between 3 levels of strictness
- **Scan Interval**: Configurable automatic scanning frequency
- **Auto Start**: Automatically begin scanning on deployment
- **Monaco Integration**: Real-time editor highlighting and markers
- **Flow Variable Navigation**: Click-to-find-source for flow variables with multi-location selector

### Queue Monitoring

- **Scan Interval**: Fixed at 3 seconds for optimal performance
- **Message Frequency**: Configurable notification throttling
- **Queue Selection**: Monitor all queues or specific selections
- **Threshold Settings**: Customizable queue length alerts

### Performance Monitoring

- **Sustained Alerting**: Only alerts on prolonged threshold violations
- **SQLite Storage**: Local database for metrics history and trends
- **Configurable Thresholds**: Set CPU, memory, and event loop limits
- **Automatic Cleanup**: Intelligent data retention management

### Slack Integration

Configure your Slack webhook URL to receive formatted alerts:

```javascript
{
  "slackWebhookUrl": "https://hooks.slack.com/services/YOUR/WEBHOOK/URL"
}
```

## License

ISC License - see the [LICENSE](LICENSE) file for details.

## Support

- 📖 [Documentation](https://github.com/your-username/node-red-contrib-code-analyzer/wiki)
- 🐛 [Issue Tracker](https://github.com/your-username/node-red-contrib-code-analyzer/issues)
- 💬 [Discussions](https://github.com/your-username/node-red-contrib-code-analyzer/discussions)