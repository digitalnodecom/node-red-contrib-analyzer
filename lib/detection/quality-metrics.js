const { detectDebuggingTraits } = require('./detector');

class QualityMetrics {
    constructor() {
        // Quality scoring weights - STRICT SCORING
        this.weights = {
            // Critical issues (Level 1) - SEVERELY PENALIZED
            'top-level-return': 60,        // Critical: worst possible score impact
            'debugger-statement': 50,       // Critical: debug code in production
            
            // Important issues (Level 2) - HEAVILY PENALIZED
            'console-log': 25,             // Major: logging clutter
            'node-warn': 30,               // Major: debug output
            'todo-comment': 15,            // Important: unfinished work
            'unused-variable': 10,         // Important: code quality
            
            // Minor issues (Level 3) - MODERATELY PENALIZED
            'hardcoded-test': 12,          // Moderate: test artifacts
            'multiple-empty-lines': 3      // Minor: formatting
        };
        
        // Complexity factors
        this.complexityFactors = {
            linesOfCode: 0.1,
            cyclomaticComplexity: 2.0,
            nestingDepth: 1.5,
            functionCount: 0.5
        };
    }

    // Calculate quality score for a single node - STRICT SCORING
    calculateNodeQualityScore(issues, linesOfCode = 0) {
        let baseScore = 100;
        let totalDeduction = 0;
        let hasCriticalIssues = false;

        // Deduct points based on issues found
        issues.forEach(issue => {
            const weight = this.weights[issue.type] || 1;
            const severity = this.getIssueSeverity(issue.type);
            
            if (severity.level === 'critical') {
                hasCriticalIssues = true;
                // Critical issues get exponential penalty
                totalDeduction += weight * 1.5; // 1.5x multiplier for critical
            } else {
                totalDeduction += weight;
            }
        });

        // Critical penalty: Any critical issue caps score at 40 maximum
        if (hasCriticalIssues) {
            baseScore = Math.min(baseScore, 40);
        }

        // Apply penalty scaling based on lines of code
        const sizeMultiplier = Math.min(1 + (linesOfCode / 150), 2.5); // More aggressive scaling
        totalDeduction *= sizeMultiplier;

        // Multiple critical issues = near-zero score
        const criticalCount = issues.filter(issue => 
            this.getIssueSeverity(issue.type).level === 'critical').length;
        if (criticalCount >= 2) {
            baseScore = Math.min(baseScore, 15); // Maximum 15 points with 2+ critical issues
        }

        const qualityScore = Math.max(0, baseScore - totalDeduction);
        return Math.round(qualityScore * 100) / 100;
    }

    // Calculate complexity score for code
    calculateComplexityScore(code) {
        if (!code || typeof code !== 'string') {
            return 0;
        }

        let complexity = 0;
        const lines = code.split('\n');
        const linesOfCode = lines.filter(line => line.trim() && !line.trim().startsWith('//')).length;

        // Lines of code factor
        complexity += linesOfCode * this.complexityFactors.linesOfCode;

        // Cyclomatic complexity indicators
        const cyclomaticKeywords = [
            /\bif\s*\(/g, /\bwhile\s*\(/g, /\bfor\s*\(/g, 
            /\bcatch\s*\(/g, /\bswitch\s*\(/g, /\bcase\s+/g,
            /&&|\|\|/g, /\?.*:/g  // Logical operators and ternary
        ];

        cyclomaticKeywords.forEach(pattern => {
            const matches = (code.match(pattern) || []).length;
            complexity += matches * this.complexityFactors.cyclomaticComplexity;
        });

        // Nesting depth (approximate by counting braces)
        let maxNesting = 0;
        let currentNesting = 0;
        for (const char of code) {
            if (char === '{') {
                currentNesting++;
                maxNesting = Math.max(maxNesting, currentNesting);
            } else if (char === '}') {
                currentNesting--;
            }
        }
        complexity += maxNesting * this.complexityFactors.nestingDepth;

        // Function count
        const functionCount = (code.match(/function\s+\w+\s*\(/g) || []).length;
        complexity += functionCount * this.complexityFactors.functionCount;

        return Math.round(complexity * 100) / 100;
    }

    // Calculate flow-level quality metrics - STRICT FAULTY NODE WEIGHTING
    calculateFlowQualityMetrics(nodeConfigs, detectionLevel = 2) {
        let totalIssues = 0;
        let nodesWithIssues = 0;
        let nodesWithCriticalIssues = 0;
        let totalFunctionNodes = 0;
        let totalComplexity = 0;
        const issueTypes = new Set();
        const nodeMetrics = [];
        let totalQualityScore = 0;

        nodeConfigs.forEach(nodeConfig => {
            if (nodeConfig.type === 'function' && nodeConfig.func) {
                totalFunctionNodes++;
                
                const issues = detectDebuggingTraits(nodeConfig.func, detectionLevel);
                const linesOfCode = nodeConfig.func.split('\n').length;
                const complexityScore = this.calculateComplexityScore(nodeConfig.func);
                const qualityScore = this.calculateNodeQualityScore(issues, linesOfCode);

                totalComplexity += complexityScore;
                totalIssues += issues.length;
                totalQualityScore += qualityScore;
                
                const hasCriticalIssues = issues.some(issue => 
                    this.getIssueSeverity(issue.type).level === 'critical');
                
                if (issues.length > 0) {
                    nodesWithIssues++;
                    if (hasCriticalIssues) {
                        nodesWithCriticalIssues++;
                    }
                    issues.forEach(issue => issueTypes.add(issue.type));
                }

                nodeMetrics.push({
                    nodeId: nodeConfig.id,
                    nodeName: nodeConfig.name || `Function Node ${nodeConfig.id.substring(0, 8)}`,
                    issuesCount: issues.length,
                    issueDetails: issues,
                    complexityScore: complexityScore,
                    linesOfCode: linesOfCode,
                    qualityScore: qualityScore,
                    hasCriticalIssues: hasCriticalIssues
                });
            }
        });

        // STRICT FLOW QUALITY CALCULATION - based on faulty nodes with critical weighting
        let flowQualityScore = 100;
        
        if (totalFunctionNodes > 0) {
            // Use weighted average of individual node scores
            const avgNodeQuality = totalQualityScore / totalFunctionNodes;
            flowQualityScore = avgNodeQuality;
            
            // HEAVY PENALTY for nodes with critical issues
            const criticalNodeRatio = nodesWithCriticalIssues / totalFunctionNodes;
            flowQualityScore -= (criticalNodeRatio * 60); // Up to 60 point deduction
            
            // MODERATE PENALTY for general faulty nodes
            const faultyNodeRatio = nodesWithIssues / totalFunctionNodes;
            flowQualityScore -= (faultyNodeRatio * 25); // Additional penalty
            
            // COMPLEXITY PENALTY (only apply if there are actual issues)
            if (nodesWithIssues > 0) {
                const avgComplexityScore = totalComplexity / totalFunctionNodes;
                const complexityPenalty = Math.min(avgComplexityScore / 1.5, 40); // More aggressive
                flowQualityScore -= complexityPenalty;
            }
        }
        
        // Any flow with critical issues cannot exceed 50 points
        if (nodesWithCriticalIssues > 0) {
            flowQualityScore = Math.min(flowQualityScore, 50);
        }
        
        // Flows with >50% faulty nodes cannot exceed 30 points
        if (totalFunctionNodes > 0 && (nodesWithIssues / totalFunctionNodes) > 0.5) {
            flowQualityScore = Math.min(flowQualityScore, 30);
        }

        return {
            totalIssues,
            nodesWithIssues,
            nodesWithCriticalIssues,
            totalFunctionNodes,
            issueTypes: Array.from(issueTypes),
            qualityScore: Math.max(0, Math.round(flowQualityScore * 100) / 100),
            complexityScore: Math.round((totalFunctionNodes > 0 ? totalComplexity / totalFunctionNodes : 0) * 100) / 100,
            nodeMetrics
        };
    }

    // Calculate overall system quality trends - STRICT CRITICAL WEIGHTING
    calculateSystemQualityTrends(allFlowMetrics) {
        if (!allFlowMetrics || allFlowMetrics.length === 0) {
            return {
                overallQuality: 100,
                technicalDebt: 0,
                complexity: 0,
                flowCount: 0,
                affectedNodes: 0,
                criticalNodes: 0
            };
        }

        const totalFlows = allFlowMetrics.length;
        const totalNodes = allFlowMetrics.reduce((sum, flow) => sum + flow.totalFunctionNodes, 0);
        const totalIssues = allFlowMetrics.reduce((sum, flow) => sum + flow.totalIssues, 0);
        const totalAffectedNodes = allFlowMetrics.reduce((sum, flow) => sum + flow.nodesWithIssues, 0);
        const totalCriticalNodes = allFlowMetrics.reduce((sum, flow) => sum + (flow.nodesWithCriticalIssues || 0), 0);

        // Overall quality (weighted average of flow qualities)
        const totalWeightedQuality = allFlowMetrics.reduce((sum, flow) => {
            return sum + (flow.qualityScore * flow.totalFunctionNodes);
        }, 0);
        let overallQuality = totalNodes > 0 ? totalWeightedQuality / totalNodes : 100;
        
        // CRITICAL SYSTEM PENALTIES
        if (totalNodes > 0) {
            // Any critical nodes in system severely impact overall quality
            const criticalNodeRatio = totalCriticalNodes / totalNodes;
            overallQuality -= (criticalNodeRatio * 70); // Up to 70 point penalty
            
            // Systems with >25% faulty nodes get capped
            const faultyNodeRatio = totalAffectedNodes / totalNodes;
            if (faultyNodeRatio > 0.25) {
                overallQuality = Math.min(overallQuality, 60);
            }
            
            // Systems with any critical nodes cannot exceed 65 points
            if (totalCriticalNodes > 0) {
                overallQuality = Math.min(overallQuality, 65);
            }
        }

        // Technical debt metric - MORE AGGRESSIVE SCALING
        const technicalDebt = totalNodes > 0 ? Math.min((totalIssues / totalNodes) * 35, 100) : 0;
        
        // Add critical node weighting to technical debt
        const criticalDebtBonus = totalNodes > 0 ? (totalCriticalNodes / totalNodes) * 40 : 0;
        const finalTechnicalDebt = Math.min(technicalDebt + criticalDebtBonus, 100);

        // Overall complexity (weighted average)
        const totalWeightedComplexity = allFlowMetrics.reduce((sum, flow) => {
            return sum + (flow.complexityScore * flow.totalFunctionNodes);
        }, 0);
        const overallComplexity = totalNodes > 0 ? totalWeightedComplexity / totalNodes : 0;

        return {
            overallQuality: Math.max(0, Math.round(overallQuality * 100) / 100),
            technicalDebt: Math.round(finalTechnicalDebt * 100) / 100,
            complexity: Math.round(overallComplexity * 100) / 100,
            flowCount: totalFlows,
            affectedNodes: totalAffectedNodes,
            criticalNodes: totalCriticalNodes
        };
    }

    // Get quality grade based on score - STRICT GRADING
    getQualityGrade(score) {
        if (score >= 98) return { grade: 'A+', color: '#22c55e', description: 'Excellent' };
        if (score >= 95) return { grade: 'A', color: '#16a34a', description: 'Very Good' };
        if (score >= 90) return { grade: 'A-', color: '#65a30d', description: 'Good' };
        if (score >= 85) return { grade: 'B+', color: '#84cc16', description: 'Above Average' };
        if (score >= 80) return { grade: 'B', color: '#eab308', description: 'Average' };
        if (score >= 70) return { grade: 'B-', color: '#f59e0b', description: 'Below Average' };
        if (score >= 60) return { grade: 'C+', color: '#f97316', description: 'Fair' };
        if (score >= 50) return { grade: 'C', color: '#ea580c', description: 'Poor' };
        if (score >= 35) return { grade: 'D', color: '#dc2626', description: 'Very Poor' };
        if (score >= 20) return { grade: 'D-', color: '#b91c1c', description: 'Critical' };
        return { grade: 'F', color: '#991b1b', description: 'Failing' };
    }

    // Get issue severity classification
    getIssueSeverity(issueType) {
        if (['top-level-return', 'debugger-statement'].includes(issueType)) {
            return { level: 'critical', color: '#dc2626', priority: 1 };
        }
        if (['console-log', 'node-warn', 'unused-variable', 'todo-comment'].includes(issueType)) {
            return { level: 'warning', color: '#f59e0b', priority: 2 };
        }
        return { level: 'info', color: '#3b82f6', priority: 3 };
    }

    // Generate quality report for a flow
    generateFlowQualityReport(flowMetrics) {
        const grade = this.getQualityGrade(flowMetrics.qualityScore);
        const criticalIssues = flowMetrics.issueTypes.filter(type => 
            this.getIssueSeverity(type).level === 'critical'
        ).length;
        const warningIssues = flowMetrics.issueTypes.filter(type => 
            this.getIssueSeverity(type).level === 'warning'
        ).length;

        return {
            ...flowMetrics,
            grade: grade,
            criticalIssues,
            warningIssues,
            healthPercentage: Math.round((flowMetrics.totalFunctionNodes - flowMetrics.nodesWithIssues) / Math.max(1, flowMetrics.totalFunctionNodes) * 100),
            recommendations: this.generateRecommendations(flowMetrics)
        };
    }

    // Generate improvement recommendations
    generateRecommendations(flowMetrics) {
        const recommendations = [];

        if (flowMetrics.totalIssues === 0) {
            recommendations.push({
                type: 'success',
                message: 'Excellent! No code quality issues detected.',
                action: 'Maintain current coding standards'
            });
            return recommendations;
        }

        // Critical issues
        if (flowMetrics.issueTypes.includes('top-level-return')) {
            recommendations.push({
                type: 'critical',
                message: 'Remove top-level return statements',
                action: 'Refactor functions to use proper control flow'
            });
        }

        if (flowMetrics.issueTypes.includes('debugger-statement')) {
            recommendations.push({
                type: 'critical',
                message: 'Remove debugger statements',
                action: 'Clean up debugging code before deployment'
            });
        }

        // Warning issues
        if (flowMetrics.issueTypes.includes('console-log')) {
            recommendations.push({
                type: 'warning',
                message: 'Replace console.log with proper logging',
                action: 'Use node.log() or remove debugging statements'
            });
        }

        if (flowMetrics.issueTypes.includes('unused-variable')) {
            recommendations.push({
                type: 'info',
                message: 'Remove unused variables',
                action: 'Clean up variable declarations to improve readability'
            });
        }

        if (flowMetrics.complexityScore > 20) {
            recommendations.push({
                type: 'warning',
                message: 'High code complexity detected',
                action: 'Consider breaking down complex functions into smaller ones'
            });
        }

        if (flowMetrics.nodesWithIssues / flowMetrics.totalFunctionNodes > 0.5) {
            recommendations.push({
                type: 'warning',
                message: 'Many nodes have quality issues',
                action: 'Focus on systematic code review and refactoring'
            });
        }

        return recommendations;
    }
}

module.exports = QualityMetrics;