<template>
  <div class="space-y-6">
    <!-- Status Cards -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
      <div class="bg-white border border-gray-200 shadow rounded-lg p-6 card-hover">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm font-medium text-gray-600">Service Status</p>
            <p class="text-2xl font-bold" :class="serviceStatus.database ? 'text-green-600' : 'text-red-600'">
              {{ serviceStatus.database ? 'Online' : 'Offline' }}
            </p>
          </div>
          <div class="p-3 rounded-full" :class="serviceStatus.database ? 'bg-green-100' : 'bg-red-100'">
            <svg class="w-6 h-6" :class="serviceStatus.database ? 'text-green-600' : 'text-red-600'" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
          </div>
        </div>
      </div>
      
      <div 
        @click="navigateToPerformance"
        class="bg-white border border-gray-200 shadow rounded-lg p-6 card-hover cursor-pointer transition-transform hover:scale-105"
      >
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm font-medium text-gray-600">Total Issues</p>
            <p class="text-2xl font-bold text-yellow-600">{{ summary.totalIssues || 0 }}</p>
          </div>
          <div class="p-3 rounded-full bg-yellow-100">
            <svg class="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 15.5c-.77.833.192 2.5 1.732 2.5z"></path>
            </svg>
          </div>
        </div>
      </div>
      
      <div class="bg-white border border-gray-200 shadow rounded-lg p-6 card-hover">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm font-medium text-gray-600">Quality Score</p>
            <p class="text-2xl font-bold" :class="getQualityScoreColor(summary.averageQualityScore)">
              {{ summary.averageQualityScore ? summary.averageQualityScore.toFixed(1) : 'N/A' }}
            </p>
          </div>
          <div class="p-3 rounded-full" :class="getQualityScoreBgColor(summary.averageQualityScore)">
            <svg class="w-6 h-6" :class="getQualityScoreColor(summary.averageQualityScore)" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Recent Activity -->
    <div class="bg-white border border-gray-200 shadow rounded-lg p-6 mb-6">
      <h3 class="text-lg font-medium text-gray-900 mb-4">System Information</h3>
      <div class="space-y-4">
        <div class="flex justify-between">
          <span class="text-gray-600">Code Analysis:</span>
          <span class="font-medium">{{ settings.codeAnalysis ? 'Enabled' : 'Disabled' }}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-gray-600">Scan Interval:</span>
          <span class="font-medium">{{ settings.scanInterval || 'N/A' }}s</span>
        </div>
        <div class="flex justify-between">
          <span class="text-gray-600">Performance Monitoring:</span>
          <span class="font-medium">{{ settings.performanceMonitoring ? 'Enabled' : 'Disabled' }}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-gray-600">Last Updated:</span>
          <span class="font-medium">{{ lastUpdated }}</span>
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
          <span class="text-gray-700">Loading...</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import axios from 'axios'

export default {
  name: 'Dashboard',
  data() {
    return {
      loading: false,
      notification: {
        show: false,
        type: 'success',
        message: ''
      },
      serviceStatus: {
        database: false,
        scanning: false,
        performanceMonitoring: false,
        isScanning: false
      },
      settings: {},
      summary: {},
      lastUpdated: 'Never',
      pollingInterval: null
    }
  },
  
  async mounted() {
    await this.fetchData()
    // Start polling for status updates
    this.startPolling()
  },
  
  beforeUnmount() {
    // Clean up polling when component is destroyed
    this.stopPolling()
  },
  
  methods: {
    async fetchData() {
      this.loading = true
      try {
        const [statusResponse, settingsResponse, qualityResponse] = await Promise.all([
          axios.get('/analyzer/api/status'),
          axios.get('/analyzer/api/settings'),
          axios.get('/analyzer/api/quality-summary')
        ])
        
        this.serviceStatus = statusResponse.data.services
        this.settings = statusResponse.data.settings
        this.summary = qualityResponse.data.summary || {}
        
        if (settingsResponse.data.settings) {
          Object.assign(this.settings, settingsResponse.data.settings)
        }
        
        this.lastUpdated = new Date().toLocaleString()
      } catch (error) {
        console.error('Failed to fetch data:', error)
        this.showError('Failed to load dashboard data')
      } finally {
        this.loading = false
      }
    },
    
    
    showSuccess(message) {
      this.notification = {
        show: true,
        type: 'success',
        message: message
      }
      // Auto-hide after 3 seconds
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
      // Auto-hide after 5 seconds for errors
      setTimeout(() => {
        this.notification.show = false
      }, 5000)
    },
    
    startPolling() {
      // Poll every 2 seconds for status updates
      this.pollingInterval = setInterval(async () => {
        try {
          const response = await axios.get('/analyzer/api/status')
          this.serviceStatus = response.data.services
          // Stop polling if not scanning
          if (!this.serviceStatus.isScanning && this.pollingInterval) {
            this.stopPolling()
            // Do a final fetch to get complete data
            await this.fetchData()
          }
        } catch (error) {
          console.error('Status polling error:', error)
        }
      }, 2000)
    },
    
    stopPolling() {
      if (this.pollingInterval) {
        clearInterval(this.pollingInterval)
        this.pollingInterval = null
      }
    },
    
    navigateToPerformance() {
      this.$router.push('/analyzer/performance')
    },
    
    getQualityScoreColor(score) {
      if (!score) return 'text-gray-600'
      if (score >= 80) return 'text-green-600'
      if (score >= 60) return 'text-yellow-600'
      return 'text-red-600'
    },
    
    getQualityScoreBgColor(score) {
      if (!score) return 'bg-gray-100'
      if (score >= 80) return 'bg-green-100'
      if (score >= 60) return 'bg-yellow-100'
      return 'bg-red-100'
    }
  }
}
</script>