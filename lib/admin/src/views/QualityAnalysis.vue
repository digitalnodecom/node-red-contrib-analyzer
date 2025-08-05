<template>
  <div class="space-y-6">
    <!-- Quality Summary Cards -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
      <div class="bg-white border border-gray-200 shadow rounded-lg p-6 card-hover">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm font-medium text-gray-600">Total Issues</p>
            <p class="text-2xl font-bold text-red-600">{{ summary.totalIssues || 0 }}</p>
          </div>
          <div class="p-3 rounded-full bg-red-100">
            <svg class="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
          </div>
        </div>
      </div>

      <div class="bg-white border border-gray-200 shadow rounded-lg p-6 card-hover">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm font-medium text-gray-600">Quality Score</p>
            <p class="text-2xl font-bold" :class="getScoreColor(summary.averageQualityScore)">
              {{ summary.averageQualityScore ? summary.averageQualityScore.toFixed(1) : 'N/A' }}
            </p>
          </div>
          <div class="p-3 rounded-full" :class="getScoreBgColor(summary.averageQualityScore)">
            <svg class="w-6 h-6" :class="getScoreColor(summary.averageQualityScore)" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
          </div>
        </div>
      </div>

      <div class="bg-white border border-gray-200 shadow rounded-lg p-6 card-hover">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm font-medium text-gray-600">Flows Analyzed</p>
            <p class="text-2xl font-bold text-blue-600">{{ summary.totalFlows || 0 }}</p>
          </div>
          <div class="p-3 rounded-full bg-blue-100">
            <svg class="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2"></path>
            </svg>
          </div>
        </div>
      </div>
    </div>

    <!-- Page Action Bar -->
    <PageActionBar 
      title="Code Quality Analysis"
      :status="{
        text: scanning ? 'Scanning...' : 'Ready',
        textColor: scanning ? 'text-yellow-600' : 'text-green-600',
        indicator: {
          color: scanning ? 'bg-yellow-500' : 'bg-green-500'
        },
        subtitle: flows.length > 0 ? `Last scan: ${formatDate(flows[0].created_at)}` : null
      }"
    >
      <template #actions>
        <button
          @click="triggerScan"
          :disabled="loading || scanning"
          class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {{ scanning ? 'Scanning...' : 'Trigger Scan' }}
        </button>
        <button
          @click="refreshData"
          :disabled="loading"
          class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {{ loading ? 'Loading...' : 'Refresh Data' }}
        </button>
      </template>
    </PageActionBar>

    <!-- Quality History Chart -->
    <div class="bg-white border border-gray-200 shadow rounded-lg p-6 mb-6">
      <h3 class="text-lg font-medium text-gray-900 mb-4">Quality Trends</h3>
      <div v-if="history.length === 0" class="text-center py-8 text-gray-500">
        <svg class="w-12 h-12 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2-2V7a2 2 0 012-2h2a2 2 0 002 2v2a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 00-2 2h-2a2 2 0 00-2 2v6a2 2 0 01-2 2H9z"></path>
        </svg>
        <p>No quality history data available</p>
        <p class="text-sm mt-1">Run a scan to start collecting quality metrics</p>
      </div>
      <div v-else class="space-y-4">
        <div class="overflow-x-auto">
          <table class="min-w-full">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quality Score</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Issues</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Flows</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200">
              <tr v-for="entry in history.slice(0, 10)" :key="entry.id">
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {{ formatDate(entry.created_at) }}
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <span class="text-sm font-medium" :class="getScoreColor(entry.quality_score)">
                    {{ entry.quality_score.toFixed(1) }}
                  </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {{ entry.total_issues }}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {{ entry.flow_name }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Flow Quality Breakdown -->
    <div class="bg-white border border-gray-200 shadow rounded-lg p-6 mb-6">
      <h3 class="text-lg font-medium text-gray-900 mb-4">Flow Quality Breakdown</h3>
      
      <div v-if="flows.length === 0" class="text-center py-8 text-gray-500">
        <svg class="w-12 h-12 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
        </svg>
        <p>No flow data available</p>
        <p class="text-sm mt-1">Run a scan to analyze your flows</p>
      </div>
      
      <div v-else class="overflow-x-auto">
        <table class="min-w-full">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Flow Name</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quality Score</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Issues</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Critical Issues</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Function Nodes</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last Scan</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200">
            <tr v-for="flow in flows" :key="flow.flow_id" class="hover:bg-gray-50">
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="text-sm font-medium">
                  <button 
                    @click="loadFlowIssues(flow.flow_id, flow.flow_name)"
                    class="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                  >
                    {{ flow.flow_name }}
                  </button>
                </div>
                <div class="text-sm text-gray-500">{{ flow.flow_id }}</div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="flex items-center">
                  <span class="text-sm font-medium" :class="getScoreColor(flow.quality_score)">
                    {{ flow.quality_score.toFixed(1) }}
                  </span>
                  <div class="ml-2 w-16 bg-gray-200 rounded-full h-2">
                    <div 
                      class="h-2 rounded-full" 
                      :class="getScoreBgClass(flow.quality_score)"
                      :style="{ width: flow.quality_score + '%' }"
                    ></div>
                  </div>
                </div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium" 
                      :class="flow.total_issues > 0 ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'">
                  {{ flow.total_issues }}
                </span>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium" 
                      :class="flow.nodes_with_critical_issues > 0 ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'">
                  {{ flow.nodes_with_critical_issues }}
                </span>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                {{ flow.total_function_nodes }}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {{ formatDate(flow.created_at) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Flow Issues Detail Section -->
    <div v-if="showIssuesSection && flowIssues" class="bg-white border border-gray-200 shadow rounded-lg p-6 mb-6">
      <div class="flex justify-between items-center mb-4">
        <h3 class="text-lg font-medium text-gray-900">
          Issues in "{{ flowIssues.flowName }}"
        </h3>
        <button
          @click="closeIssuesSection"
          class="text-gray-400 hover:text-gray-600"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </button>
      </div>
      
      <!-- Flow Summary -->
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
        <div class="text-center">
          <div class="text-2xl font-bold" :class="getScoreColor(flowIssues.qualityScore)">
            {{ flowIssues.qualityScore }}
          </div>
          <div class="text-sm text-gray-600">Quality Score</div>
        </div>
        <div class="text-center">
          <div class="text-2xl font-bold text-red-600">{{ flowIssues.totalIssues }}</div>
          <div class="text-sm text-gray-600">Total Issues</div>
        </div>
        <div class="text-center">
          <div class="text-2xl font-bold text-orange-600">{{ flowIssues.criticalIssues }}</div>
          <div class="text-sm text-gray-600">Critical Issues</div>
        </div>
        <div class="text-center">
          <div class="text-2xl font-bold text-blue-600">{{ flowIssues.totalNodes }}</div>
          <div class="text-sm text-gray-600">Function Nodes</div>
        </div>
      </div>

      <!-- Issues by Node -->
      <div v-if="flowIssues.nodeDetails && flowIssues.nodeDetails.length > 0">
        <h4 class="text-md font-medium text-gray-800 mb-4">Issues by Node</h4>
        <div class="space-y-4">
          <div 
            v-for="node in flowIssues.nodeDetails.filter(node => node.issues && node.issues.length > 0)" 
            :key="node.nodeId"
            class="border border-gray-200 rounded-lg p-4"
          >
            <div class="flex justify-between items-start mb-3">
              <div>
                <h5 class="font-medium text-gray-900">{{ node.nodeName }}</h5>
                <p class="text-sm text-gray-500">{{ node.nodeId }}</p>
              </div>
              <div class="text-right">
                <div class="text-sm">
                  <span class="font-medium" :class="getScoreColor(node.qualityScore)">
                    Quality: {{ node.qualityScore }}
                  </span>
                </div>
                <div class="text-sm text-gray-600">
                  {{ node.issuesCount }} issues, {{ node.linesOfCode }} lines
                </div>
              </div>
            </div>
            
            <!-- Node Issues -->
            <div v-if="node.issues && node.issues.length > 0" class="space-y-2">
              <div 
                v-for="(issue, index) in node.issues" 
                :key="index"
                class="flex items-start gap-3 p-3 rounded border-l-4"
                :class="[getIssueBgClass(issue.severity), getIssueBorderClass(issue.severity)]"
              >
                <div class="flex-shrink-0 mt-0.5">
                  <div 
                    class="w-3 h-3 rounded-full flex items-center justify-center"
                    :class="getIssueColorClass(issue.severity)"
                  >
                    <div class="w-1.5 h-1.5 bg-white rounded-full"></div>
                  </div>
                </div>
                <div class="flex-1">
                  <div class="flex justify-between items-start">
                    <div>
                      <p class="text-sm font-medium" :class="getIssueTextColor(issue.severity)">{{ issue.message }}</p>
                      <p class="text-xs mt-1" :class="getIssueSubtextColor(issue.severity)">
                        <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono bg-gray-100 text-gray-700 mr-2">
                          {{ issue.type }}
                        </span>
                        <span v-if="issue.line">Line {{ issue.line }}</span>
                      </p>
                    </div>
                    <div class="flex items-center gap-2">
                      <button
                        @click="openNodeInEditor(flowIssues.flowId, node.nodeId)"
                        class="inline-flex items-center px-2 py-1 text-xs font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors"
                        title="Open node in Node-RED editor"
                      >
                        <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path>
                        </svg>
                        Open Node
                      </button>
                      <div 
                        class="w-2 h-2 rounded-full"
                        :class="getIssueIndicatorClass(issue.severity)"
                      ></div>
                      <span 
                        class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize"
                        :class="getIssueBadgeClass(issue.severity)"
                      >
                        {{ issue.severity }}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div v-else class="text-center py-8 text-gray-500">
        <p>No detailed node information available for this flow</p>
      </div>
    </div>

    <!-- Notification Toast -->
    <transition
      enter-active-class="transition ease-out duration-300"
      enter-from-class="transform opacity-0 translate-y-2"
      enter-to-class="transform opacity-100 translate-y-0"
      leave-active-class="transition ease-in duration-200"
      leave-from-class="transform opacity-100 translate-y-0"
      leave-to-class="transform opacity-0 translate-y-2"
    >
      <div v-if="notification.show" class="fixed top-4 right-4 z-40">
        <div 
          :class="[
            'flex items-center gap-3 px-6 py-4 rounded-lg shadow-lg min-w-[300px]',
            notification.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'
          ]"
        >
          <svg v-if="notification.type === 'success'" class="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          <svg v-else class="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          <span class="font-medium">{{ notification.message }}</span>
          <button @click="notification.show = false" class="ml-auto text-current opacity-70 hover:opacity-100">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>
      </div>
    </transition>

    <!-- Loading Overlay -->
    <div v-if="loading" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-white p-6 rounded-lg shadow-lg">
        <div class="flex items-center space-x-3">
          <svg class="animate-spin h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" class="opacity-25"></circle>
            <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" class="opacity-75"></path>
          </svg>
          <span class="text-gray-700">Loading quality data...</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import axios from 'axios'
import PageActionBar from '../components/PageActionBar.vue'

export default {
  name: 'QualityAnalysis',
  data() {
    return {
      loading: false,
      scanning: false,
      notification: {
        show: false,
        type: 'success',
        message: ''
      },
      summary: {
        totalIssues: 0,
        averageQualityScore: 0,
        totalFlows: 0
      },
      history: [],
      flows: [],
      selectedFlow: null,
      flowIssues: null,
      showIssuesSection: false
    }
  },
  
  async mounted() {
    await this.fetchData()
  },
  
  methods: {
    async fetchData() {
      this.loading = true
      try {
        const [summaryResponse, historyResponse] = await Promise.all([
          axios.get('/analyzer/api/quality-summary'),
          axios.get('/analyzer/api/quality-history')
        ])
        
        this.summary = summaryResponse.data.summary || {}
        this.flows = summaryResponse.data.flows || []
        this.history = historyResponse.data.history || []
        
      } catch (error) {
        console.error('Failed to fetch quality data:', error)
        this.showError('Failed to load quality data')
      } finally {
        this.loading = false
      }
    },
    
    async refreshData() {
      await this.fetchData()
      this.showSuccess('Quality data refreshed')
    },
    
    async triggerScan() {
      this.scanning = true
      try {
        const response = await axios.post('/analyzer/api/scan/trigger')
        if (response.data.success) {
          this.showSuccess('Quality scan triggered successfully')
          // Wait a moment for scan to process, then refresh data
          setTimeout(async () => {
            await this.fetchData()
          }, 2000)
        } else {
          this.showError(response.data.message || 'Failed to trigger scan')
        }
      } catch (error) {
        console.error('Failed to trigger scan:', error)
        this.showError('Failed to trigger scan')
      } finally {
        this.scanning = false
      }
    },
    
    getScoreColor(score) {
      if (!score) return 'text-gray-600'
      if (score >= 80) return 'text-green-600'
      if (score >= 60) return 'text-yellow-600'
      return 'text-red-600'
    },
    
    getScoreBgColor(score) {
      if (!score) return 'bg-gray-100'
      if (score >= 80) return 'bg-green-100'
      if (score >= 60) return 'bg-yellow-100'
      return 'bg-red-100'
    },
    
    getScoreBgClass(score) {
      if (!score) return 'bg-gray-400'
      if (score >= 80) return 'bg-green-400'
      if (score >= 60) return 'bg-yellow-400'
      return 'bg-red-400'
    },
    
    formatDate(dateString) {
      return new Date(dateString).toLocaleString()
    },
    
    showSuccess(message) {
      this.notification = {
        show: true,
        type: 'success',
        message: message
      }
      setTimeout(() => {
        this.notification.show = false
      }, 3000)
    },
    
    showError(message) {
      this.notification = {
        show: true,
        type: 'error',
        message: message
      }
      setTimeout(() => {
        this.notification.show = false
      }, 5000)
    },
    
    async loadFlowIssues(flowId, flowName) {
      this.loading = true
      try {
        const response = await axios.get(`/analyzer/api/flow-issues/${flowId}`)
        this.flowIssues = response.data
        this.selectedFlow = { id: flowId, name: flowName }
        this.showIssuesSection = true
        
        // Scroll to issues section
        this.$nextTick(() => {
          const issuesSection = document.querySelector('.bg-white.border.border-gray-200.shadow.rounded-lg.p-6.mb-6:last-of-type')
          if (issuesSection) {
            issuesSection.scrollIntoView({ behavior: 'smooth', block: 'start' })
          }
        })
      } catch (error) {
        console.error('Failed to load flow issues:', error)
        this.showError('Failed to load flow issues')
      } finally {
        this.loading = false
      }
    },
    
    closeIssuesSection() {
      this.showIssuesSection = false
      this.flowIssues = null
      this.selectedFlow = null
    },
    
    getIssueBgClass(severity) {
      switch (severity) {
        case 'critical': return 'bg-red-50'
        case 'warning': return 'bg-yellow-50'
        case 'info': return 'bg-blue-50'
        default: return 'bg-gray-50'
      }
    },
    
    getIssueColorClass(severity) {
      switch (severity) {
        case 'critical': return 'bg-red-500'
        case 'warning': return 'bg-yellow-500'
        case 'info': return 'bg-blue-500'
        default: return 'bg-gray-500'
      }
    },
    
    getIssueBadgeClass(severity) {
      switch (severity) {
        case 'critical': return 'bg-red-100 text-red-800'
        case 'warning': return 'bg-yellow-100 text-yellow-800'
        case 'info': return 'bg-blue-100 text-blue-800'
        default: return 'bg-gray-100 text-gray-800'
      }
    },

    getIssueBorderClass(severity) {
      switch (severity) {
        case 'critical': return 'border-l-red-500'
        case 'warning': return 'border-l-yellow-500'
        case 'info': return 'border-l-blue-500'
        default: return 'border-l-gray-500'
      }
    },

    getIssueTextColor(severity) {
      switch (severity) {
        case 'critical': return 'text-red-900'
        case 'warning': return 'text-yellow-900'
        case 'info': return 'text-blue-900'
        default: return 'text-gray-900'
      }
    },

    getIssueSubtextColor(severity) {
      switch (severity) {
        case 'critical': return 'text-red-700'
        case 'warning': return 'text-yellow-700'
        case 'info': return 'text-blue-700'
        default: return 'text-gray-600'
      }
    },

    getIssueIndicatorClass(severity) {
      switch (severity) {
        case 'critical': return 'bg-red-500'
        case 'warning': return 'bg-yellow-500'
        case 'info': return 'bg-blue-500'
        default: return 'bg-gray-500'
      }
    },

    openNodeInEditor(flowId, nodeId) {
      // Construct URL to open the specific node in Node-RED editor
      // This will open in the parent window (Node-RED editor)
      const nodeRedUrl = `/#flow/${flowId}/${nodeId}`
      
      try {
        // Try to post message to parent window (if opened in iframe/popup)
        if (window.parent && window.parent !== window) {
          window.parent.postMessage({
            type: 'open-node',
            flowId: flowId,
            nodeId: nodeId
          }, '*')
        } else {
          // Fallback: open in same window
          window.location.href = nodeRedUrl
        }
      } catch (error) {
        console.error('Error opening node in editor:', error)
        // Last resort: try to open in new tab
        window.open(nodeRedUrl, '_blank')
      }
    }
  },
  
  components: {
    PageActionBar
  }
}
</script>