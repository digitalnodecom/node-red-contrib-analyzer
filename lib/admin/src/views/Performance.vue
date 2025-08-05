<template>
  <div class="space-y-6">
    <!-- Performance Summary Cards -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
      <div class="bg-white border border-gray-200 shadow rounded-lg p-6 card-hover">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm font-medium text-gray-600">CPU Usage</p>
            <p class="text-2xl font-bold" :class="getCpuColor(summary.cpu)">
              {{ summary.cpu ? summary.cpu.toFixed(1) + '%' : 'N/A' }}
            </p>
          </div>
          <div class="p-3 rounded-full" :class="getCpuBgColor(summary.cpu)">
            <svg class="w-6 h-6" :class="getCpuColor(summary.cpu)" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"></path>
            </svg>
          </div>
        </div>
      </div>

      <div class="bg-white border border-gray-200 shadow rounded-lg p-6 card-hover">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm font-medium text-gray-600">Memory Usage</p>
            <p class="text-2xl font-bold" :class="getMemoryColor(summary.memory)">
              {{ summary.memory ? summary.memory.toFixed(1) + '%' : 'N/A' }}
            </p>
          </div>
          <div class="p-3 rounded-full" :class="getMemoryBgColor(summary.memory)">
            <svg class="w-6 h-6" :class="getMemoryColor(summary.memory)" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"></path>
            </svg>
          </div>
        </div>
      </div>

      <div class="bg-white border border-gray-200 shadow rounded-lg p-6 card-hover">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm font-medium text-gray-600">Event Loop Lag</p>
            <p class="text-2xl font-bold" :class="getEventLoopColor(summary.eventLoopLag)">
              {{ summary.eventLoopLag ? summary.eventLoopLag.toFixed(1) + 'ms' : 'N/A' }}
            </p>
          </div>
          <div class="p-3 rounded-full" :class="getEventLoopBgColor(summary.eventLoopLag)">
            <svg class="w-6 h-6" :class="getEventLoopColor(summary.eventLoopLag)" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
          </div>
        </div>
      </div>
    </div>

    <!-- Page Action Bar -->
    <PageActionBar 
      title="Performance Monitoring"
      :status="{
        text: monitoringStatus.isRunning ? 'Monitoring Active' : 'Monitoring Stopped',
        textColor: monitoringStatus.isRunning ? 'text-green-600' : 'text-red-600',
        indicator: {
          color: monitoringStatus.isRunning ? 'bg-green-500' : 'bg-red-500'
        },
        subtitle: monitoringSubtitle
      }"
    >
      <template #actions>
        <button
          @click="refreshData"
          :disabled="loading"
          class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {{ loading ? 'Loading...' : 'Refresh Data' }}
        </button>
        <button
          v-if="!monitoringStatus.isRunning"
          @click="startMonitoring"
          :disabled="loading || monitoringStatus.starting"
          class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {{ monitoringStatus.starting ? 'Starting...' : 'Start Monitoring' }}
        </button>
        <button
          v-if="monitoringStatus.isRunning"
          @click="stopMonitoring"
          :disabled="loading || monitoringStatus.stopping"
          class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {{ monitoringStatus.stopping ? 'Stopping...' : 'Stop Monitoring' }}
        </button>
      </template>
    </PageActionBar>

    <!-- Performance Charts -->
    <div class="bg-white border border-gray-200 shadow rounded-lg p-6 mb-6">
      <h3 class="text-lg font-medium text-gray-900 mb-4">Performance Charts</h3>

      <div v-if="history.length === 0" class="text-center py-8 text-gray-500">
        <svg class="w-12 h-12 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2-2V7a2 2 0 012-2h2a2 2 0 002 2v2a2 2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 00-2 2h-2a2 2 0 00-2 2v6a2 2 0 01-2 2H9z"></path>
        </svg>
        <p>No performance history available</p>
        <p class="text-sm mt-1">Click "Start Monitoring" above to begin collecting performance data</p>
      </div>
      
      <div v-else class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- CPU Usage Chart -->
        <div class="bg-gray-50 rounded-lg p-4">
          <h4 class="text-sm font-medium text-gray-900 mb-3">CPU Usage (%)</h4>
          <div class="relative h-64">
            <canvas ref="cpuChart" class="w-full h-full"></canvas>
          </div>
        </div>
        
        <!-- Memory Usage Chart -->
        <div class="bg-gray-50 rounded-lg p-4">
          <h4 class="text-sm font-medium text-gray-900 mb-3">Memory Usage (%)</h4>
          <div class="relative h-64">
            <canvas ref="memoryChart" class="w-full h-full"></canvas>
          </div>
        </div>
        
        <!-- Memory RSS Chart -->
        <div class="bg-gray-50 rounded-lg p-4">
          <h4 class="text-sm font-medium text-gray-900 mb-3">Memory RSS (MB)</h4>
          <div class="relative h-64">
            <canvas ref="memoryRssChart" class="w-full h-full"></canvas>
          </div>
        </div>
        
        <!-- Event Loop Lag Chart -->
        <div class="bg-gray-50 rounded-lg p-4">
          <h4 class="text-sm font-medium text-gray-900 mb-3">Event Loop Lag (ms)</h4>
          <div class="relative h-64">
            <canvas ref="eventLoopChart" class="w-full h-full"></canvas>
          </div>
        </div>
      </div>
    </div>

    <!-- Performance History Table -->
    <div class="bg-white border border-gray-200 shadow rounded-lg p-6 mb-6">
      <h3 class="text-lg font-medium text-gray-900 mb-4">Performance History Table</h3>
      
      <div v-if="history.length === 0" class="text-center py-8 text-gray-500">
        <svg class="w-12 h-12 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2-2V7a2 2 0 012-2h2a2 2 0 002 2v2a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 00-2 2h-2a2 2 0 00-2 2v6a2 2 0 01-2 2H9z"></path>
        </svg>
        <p>No performance history available</p>
        <p class="text-sm mt-1">Enable performance monitoring in settings to start collecting data</p>
      </div>
      
      <div v-else class="overflow-x-auto">
        <table class="min-w-full">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Timestamp</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">CPU %</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Memory %</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Memory RSS</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Event Loop Lag</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200">
            <tr v-for="entry in history.slice().reverse().slice(0, 20)" :key="entry.id" class="hover:bg-gray-50">
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                {{ formatDate(entry.created_at) }}
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="flex items-center">
                  <span class="text-sm font-medium" :class="getCpuColor(entry.cpu_usage)">
                    {{ entry.cpu_usage.toFixed(1) }}%
                  </span>
                  <div class="ml-2 w-16 bg-gray-200 rounded-full h-2">
                    <div 
                      class="h-2 rounded-full" 
                      :class="getCpuBgClass(entry.cpu_usage)"
                      :style="{ width: Math.min(entry.cpu_usage, 100) + '%' }"
                    ></div>
                  </div>
                </div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="flex items-center">
                  <span class="text-sm font-medium" :class="getMemoryColor(entry.memory_usage)">
                    {{ entry.memory_usage.toFixed(1) }}%
                  </span>
                  <div class="ml-2 w-16 bg-gray-200 rounded-full h-2">
                    <div 
                      class="h-2 rounded-full" 
                      :class="getMemoryBgClass(entry.memory_usage)"
                      :style="{ width: Math.min(entry.memory_usage, 100) + '%' }"
                    ></div>
                  </div>
                </div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                {{ formatBytes(entry.memory_rss) }}
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <span class="text-sm font-medium" :class="getEventLoopColor(entry.event_loop_lag)">
                  {{ entry.event_loop_lag.toFixed(1) }}ms
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Performance Alerts -->
    <div class="bg-white border border-gray-200 shadow rounded-lg p-6 mb-6">
      <h3 class="text-lg font-medium text-gray-900 mb-4">Recent Alerts</h3>
      
      <div v-if="alerts.length === 0" class="text-center py-8 text-gray-500">
        <svg class="w-12 h-12 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
        <p>No performance alerts</p>
        <p class="text-sm mt-1">System performance is within normal thresholds</p>
      </div>
      
      <div v-else class="space-y-4">
        <div 
          v-for="alert in alerts.slice(0, 10)" 
          :key="alert.id"
          class="flex items-start p-4 bg-red-50 border border-red-200 rounded-lg"
        >
          <svg class="w-5 h-5 text-red-600 mt-0.5 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          <div class="flex-1">
            <div class="flex items-center justify-between">
              <h4 class="text-sm font-medium text-red-800">
                {{ getAlertTitle(alert.metric_type) }}
              </h4>
              <span class="text-xs text-red-600">
                {{ formatDate(alert.created_at) }}
              </span>
            </div>
            <p class="mt-1 text-sm text-red-700">
              {{ getAlertDescription(alert) }}
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- System Information -->
    <div class="bg-white border border-gray-200 shadow rounded-lg p-6 mb-6">
      <h3 class="text-lg font-medium text-gray-900 mb-4">System Information</h3>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div class="space-y-4">
          <div class="flex justify-between">
            <span class="text-gray-600">Monitoring Status:</span>
            <div class="flex items-center gap-2">
              <div 
                class="w-2 h-2 rounded-full"
                :class="monitoringStatus.isRunning ? 'bg-green-500' : 'bg-red-500'"
              ></div>
              <span class="font-medium" :class="monitoringStatus.isRunning ? 'text-green-600' : 'text-red-600'">
                {{ monitoringStatus.isRunning ? 'Active' : 'Stopped' }}
              </span>
            </div>
          </div>
          <div class="flex justify-between">
            <span class="text-gray-600">Check Interval:</span>
            <span class="font-medium">{{ monitoringStatus.interval || 'N/A' }}s</span>
          </div>
          <div class="flex justify-between">
            <span class="text-gray-600">CPU Threshold:</span>
            <span class="font-medium">{{ summary.cpuThreshold || 'N/A' }}%</span>
          </div>
        </div>
        <div class="space-y-4">
          <div class="flex justify-between">
            <span class="text-gray-600">Memory Threshold:</span>
            <span class="font-medium">{{ summary.memoryThreshold || 'N/A' }}%</span>
          </div>
          <div class="flex justify-between">
            <span class="text-gray-600">Event Loop Threshold:</span>
            <span class="font-medium">{{ summary.eventLoopThreshold || 'N/A' }}ms</span>
          </div>
          <div class="flex justify-between">
            <span class="text-gray-600">Data Retention:</span>
            <span class="font-medium">{{ summary.retentionDays || 7 }} days</span>
          </div>
        </div>
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
          <span class="text-gray-700">Loading performance data...</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import axios from 'axios'
import PageActionBar from '../components/PageActionBar.vue'

export default {
  name: 'Performance',
  data() {
    return {
      loading: false,
      notification: {
        show: false,
        type: 'success',
        message: ''
      },
      summary: {
        cpu: 0,
        memory: 0,
        eventLoopLag: 0,
        monitoring: false,
        interval: 10,
        cpuThreshold: 75,
        memoryThreshold: 80,
        eventLoopThreshold: 20,
        retentionDays: 7
      },
      monitoringStatus: {
        isRunning: false,
        interval: 10,
        starting: false,
        stopping: false
      },
      history: [],
      alerts: [],
      charts: {
        cpu: null,
        memory: null,
        memoryRss: null,
        eventLoop: null
      },
      metrics: [
        { 
          key: 'cpu', 
          label: 'CPU Usage', 
          color: 'rgb(239, 68, 68)', 
          unit: '%',
          field: 'cpu_usage',
          ref: 'cpuChart'
        },
        { 
          key: 'memory', 
          label: 'Memory Usage', 
          color: 'rgb(34, 197, 94)', 
          unit: '%',
          field: 'memory_usage',
          ref: 'memoryChart'
        },
        { 
          key: 'memory_rss', 
          label: 'Memory RSS', 
          color: 'rgb(59, 130, 246)', 
          unit: 'MB',
          field: 'memory_rss',
          ref: 'memoryRssChart'
        },
        { 
          key: 'event_loop_lag', 
          label: 'Event Loop Lag', 
          color: 'rgb(245, 158, 11)', 
          unit: 'ms',
          field: 'event_loop_lag',
          ref: 'eventLoopChart'
        }
      ]
    }
  },
  
  async mounted() {
    await this.fetchData()
    // Charts are initialized in fetchData, no need to initialize again
  },

  activated() {
    // For keep-alive components when navigating between routes
    this.$nextTick(() => {
      if (this.history.length > 0) {
        this.initChart()
      }
    })
  },

  beforeUnmount() {
    Object.values(this.charts).forEach(chart => {
      if (chart) {
        chart.destroy()
      }
    })
  },
  
  computed: {
    monitoringSubtitle() {
      if (this.history.length === 0) {
        return this.monitoringStatus.isRunning ? `Interval: ${this.monitoringStatus.interval}s` : null
      }
      
      // Get the oldest and newest entries from history
      // Note: history array is sorted oldest first (index 0 = oldest)
      const oldestEntry = this.history[0]
      const newestEntry = this.history[this.history.length - 1]
      
      if (!oldestEntry || !newestEntry) {
        return this.monitoringStatus.isRunning ? `Interval: ${this.monitoringStatus.interval}s` : null
      }
      
      // Show from oldest to newest
      const from = this.formatTime(oldestEntry.created_at)
      const to = this.formatTime(newestEntry.created_at)
      
      // Include interval if monitoring is running
      const intervalText = this.monitoringStatus.isRunning ? ` • Interval: ${this.monitoringStatus.interval}s` : ''
      
      return `Data: ${from} - ${to}${intervalText}`
    }
  },
  
  methods: {
    async fetchData() {
      this.loading = true
      try {
        const [summaryResponse, historyResponse, alertsResponse, statusResponse] = await Promise.all([
          axios.get('/analyzer/api/performance-summary'),
          axios.get('/analyzer/api/performance-history'),
          axios.get('/analyzer/api/alerts'),
          axios.get('/analyzer/api/performance/status')
        ])
        
        this.summary = {
          ...this.summary,
          ...summaryResponse.data.summary
        }
        this.history = historyResponse.data.history || []
        this.alerts = alertsResponse.data.alerts || []
        this.monitoringStatus = {
          ...this.monitoringStatus,
          isRunning: statusResponse.data.monitoring,
          interval: statusResponse.data.interval
        }
        
        // Initialize or update charts after data is loaded
        this.$nextTick(() => {
          if (this.history.length > 0) {
            if (Object.values(this.charts).some(chart => chart === null)) {
              this.initChart()
            } else {
              this.updateCharts()
            }
          }
        })
        
      } catch (error) {
        console.error('Failed to fetch performance data:', error)
        this.showError('Failed to load performance data')
      } finally {
        this.loading = false
      }
    },
    
    async refreshData() {
      try {
        await this.fetchData()
        // Charts are already updated in fetchData, no need to update again
        this.showSuccess('Performance data refreshed')
      } catch (error) {
        console.error('Failed to refresh performance data:', error)
        this.showError('Failed to refresh performance data')
      }
    },
    
    async startMonitoring() {
      this.monitoringStatus.starting = true
      try {
        const response = await axios.post('/analyzer/api/performance/start')
        if (response.data.success) {
          this.monitoringStatus.isRunning = true
          this.monitoringStatus.interval = response.data.interval
          this.showSuccess('Performance monitoring started successfully')
          // Refresh data after a short delay to start seeing metrics
          setTimeout(async () => {
            await this.fetchData()
          }, 2000)
        } else {
          this.showError(response.data.message || 'Failed to start monitoring')
        }
      } catch (error) {
        console.error('Failed to start monitoring:', error)
        this.showError('Failed to start performance monitoring')
      } finally {
        this.monitoringStatus.starting = false
      }
    },
    
    async stopMonitoring() {
      this.monitoringStatus.stopping = true
      try {
        const response = await axios.post('/analyzer/api/performance/stop')
        if (response.data.success) {
          this.monitoringStatus.isRunning = false
          this.showSuccess('Performance monitoring stopped successfully')
        } else {
          this.showError(response.data.message || 'Failed to stop monitoring')
        }
      } catch (error) {
        console.error('Failed to stop monitoring:', error)
        this.showError('Failed to stop performance monitoring')
      } finally {
        this.monitoringStatus.stopping = false
      }
    },
    
    getCpuColor(cpu) {
      if (!cpu) return 'text-gray-600'
      if (cpu >= 90) return 'text-red-600'
      if (cpu >= 75) return 'text-yellow-600'
      return 'text-green-600'
    },
    
    getCpuBgColor(cpu) {
      if (!cpu) return 'bg-gray-100'
      if (cpu >= 90) return 'bg-red-100'
      if (cpu >= 75) return 'bg-yellow-100'
      return 'bg-green-100'
    },
    
    getCpuBgClass(cpu) {
      if (!cpu) return 'bg-gray-400'
      if (cpu >= 90) return 'bg-red-400'
      if (cpu >= 75) return 'bg-yellow-400'
      return 'bg-green-400'
    },
    
    getMemoryColor(memory) {
      if (!memory) return 'text-gray-600'
      if (memory >= 90) return 'text-red-600'
      if (memory >= 80) return 'text-yellow-600'
      return 'text-green-600'
    },
    
    getMemoryBgColor(memory) {
      if (!memory) return 'bg-gray-100'
      if (memory >= 90) return 'bg-red-100'
      if (memory >= 80) return 'bg-yellow-100'
      return 'bg-green-100'
    },
    
    getMemoryBgClass(memory) {
      if (!memory) return 'bg-gray-400'
      if (memory >= 90) return 'bg-red-400'
      if (memory >= 80) return 'bg-yellow-400'
      return 'bg-green-400'
    },
    
    getEventLoopColor(lag) {
      if (!lag) return 'text-gray-600'
      if (lag >= 50) return 'text-red-600'
      if (lag >= 20) return 'text-yellow-600'
      return 'text-green-600'
    },
    
    getEventLoopBgColor(lag) {
      if (!lag) return 'bg-gray-100'
      if (lag >= 50) return 'bg-red-100'
      if (lag >= 20) return 'bg-yellow-100'
      return 'bg-green-100'
    },
    
    getAlertTitle(metricType) {
      const titles = {
        'cpu': 'High CPU Usage',
        'memory': 'High Memory Usage',
        'eventloop': 'High Event Loop Lag'
      }
      return titles[metricType] || 'Performance Alert'
    },
    
    getAlertDescription(alert) {
      return `${alert.metric_type.toUpperCase()} reached ${alert.actual_value.toFixed(1)}${alert.metric_type === 'eventloop' ? 'ms' : '%'} (threshold: ${alert.threshold_value}${alert.metric_type === 'eventloop' ? 'ms' : '%'}) for ${alert.duration_minutes.toFixed(1)} minutes`
    },
    
    formatDate(dateString) {
      return new Date(dateString).toLocaleString()
    },
    
    formatTime(dateString) {
      return new Date(dateString).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
      })
    },
    
    formatBytes(bytes) {
      if (bytes === 0) return '0 B'
      const k = 1024
      const sizes = ['B', 'KB', 'MB', 'GB']
      const i = Math.floor(Math.log(bytes) / Math.log(k))
      return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
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

    initChart() {
      if (this.history.length === 0) {
        return
      }

      this.metrics.forEach(metric => {
        this.createIndividualChart(metric)
      })
    },

    createIndividualChart(metric) {
      const refName = metric.ref
      if (!this.$refs[refName]) {
        console.warn('Chart ref not available for', metric.key)
        return
      }

      try {
        const ctx = this.$refs[refName].getContext('2d')
        
        // Destroy existing chart if it exists
        const chartKey = metric.key === 'memory_rss' ? 'memoryRss' : 
                        metric.key === 'event_loop_lag' ? 'eventLoop' : 
                        metric.key
        
        if (this.charts[chartKey]) {
          this.charts[chartKey].destroy()
        }

        const data = this.getChartDataForMetric(metric)
        
        this.charts[chartKey] = new Chart(ctx, {
          type: 'line',
          data: data,
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                display: false
              }
            },
            scales: {
              x: {
                display: true,
                grid: {
                  display: false
                },
                ticks: {
                  maxTicksLimit: 6,
                  font: {
                    size: 10
                  }
                }
              },
              y: {
                display: true,
                beginAtZero: true,
                grid: {
                  color: 'rgba(0, 0, 0, 0.1)'
                },
                ticks: {
                  font: {
                    size: 10
                  },
                  callback: function(value) {
                    return value.toFixed(1) + metric.unit
                  }
                }
              }
            },
            interaction: {
              mode: 'index',
              intersect: false,
            },
            elements: {
              point: {
                radius: 2,
                hoverRadius: 4
              }
            }
          }
        })
      } catch (error) {
        console.error('Error creating chart for', metric.key, ':', error)
      }
    },

    getChartDataForMetric(metric) {
      const labels = this.history.slice(-30).map(entry => {
        return new Date(entry.created_at).toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit'
        })
      })

      let data = this.history.slice(-30).map(entry => {
        let value = entry[metric.field]
        // Convert memory RSS from bytes to MB for better readability
        if (metric.key === 'memory_rss') {
          value = value / (1024 * 1024)
        }
        return value.toFixed(2)
      })

      return {
        labels,
        datasets: [{
          label: metric.label,
          data: data,
          borderColor: metric.color,
          backgroundColor: this.getRgbaColor(metric.color, 0.2),
          fill: true,
          tension: 0.4,
          pointRadius: 1,
          pointHoverRadius: 4,
          borderWidth: 2
        }]
      }
    },

    updateCharts() {
      if (this.history.length > 0) {
        this.metrics.forEach((metric) => {
          this.updateIndividualChart(metric)
        })
      }
    },

    updateIndividualChart(metric) {
      const chartKey = metric.key === 'memory_rss' ? 'memoryRss' : 
                      metric.key === 'event_loop_lag' ? 'eventLoop' : 
                      metric.key
                      
      if (this.charts[chartKey]) {
        try {
          const newData = this.getChartDataForMetric(metric)
          // Update labels and dataset data separately to avoid circular reference issues
          this.charts[chartKey].data.labels = newData.labels
          this.charts[chartKey].data.datasets[0].data = newData.datasets[0].data
          this.charts[chartKey].update('none')
        } catch (error) {
          console.error(`Error updating chart ${metric.key}:`, error)
        }
      } else {
        this.createIndividualChart(metric)
      }
    },

    getRgbaColor(rgbColor, opacity) {
      // Convert 'rgb(245, 158, 11)' to 'rgba(245, 158, 11, 0.2)'
      if (rgbColor.startsWith('rgb(')) {
        return rgbColor.replace('rgb', 'rgba').replace(')', `, ${opacity})`)
      }
      // Fallback for hex colors or other formats
      return rgbColor + '33' // 33 is roughly 0.2 opacity in hex
    }
  },
  
  components: {
    PageActionBar
  }
}
</script>