<template>
  <div class="space-y-6">
    <div class="bg-white border border-gray-200 shadow rounded-lg p-6">
      <h3 class="text-lg font-medium text-gray-900 mb-4">Configuration Settings</h3>
      
      <form @submit.prevent="saveSettings" class="space-y-6">
        <!-- Code Analysis Settings -->
        <div class="border-b border-gray-200 pb-6">
          <h4 class="text-md font-medium text-gray-800 mb-4">Code Analysis</h4>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label class="flex items-center">
                <input 
                  type="checkbox" 
                  v-model="settings.codeAnalysis"
                  class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                >
                <span class="ml-2 text-sm text-gray-700">Enable Code Analysis</span>
              </label>
            </div>
            
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Scan Interval (seconds)</label>
              <input 
                type="number" 
                v-model.number="settings.scanInterval"
                min="10"
                class="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              >
            </div>
            
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Detection Level</label>
              <select 
                v-model.number="settings.detectionLevel"
                class="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              >
                <option value="1">Level 1 (Basic)</option>
                <option value="2">Level 2 (Standard)</option>
                <option value="3">Level 3 (Comprehensive)</option>
              </select>
            </div>
          </div>
        </div>
        
        <!-- Performance Monitoring Settings -->
        <div class="border-b border-gray-200 pb-6">
          <h4 class="text-md font-medium text-gray-800 mb-4">Performance Monitoring</h4>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label class="flex items-center">
                <input 
                  type="checkbox" 
                  v-model="settings.performanceMonitoring"
                  class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                >
                <span class="ml-2 text-sm text-gray-700">Enable Performance Monitoring</span>
              </label>
            </div>
            
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Check Interval (seconds)</label>
              <input 
                type="number" 
                v-model.number="settings.performanceInterval"
                min="1"
                class="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              >
            </div>
            
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">CPU Threshold (%)</label>
              <input 
                type="number" 
                v-model.number="settings.cpuThreshold"
                min="1" max="100"
                class="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              >
            </div>
            
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Memory Threshold (%)</label>
              <input 
                type="number" 
                v-model.number="settings.memoryThreshold"
                min="1" max="100"
                class="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              >
            </div>
          </div>
        </div>
        
        <!-- Queue Monitoring Settings -->
        <div class="border-b border-gray-200 pb-6">
          <h4 class="text-md font-medium text-gray-800 mb-4">Queue Monitoring</h4>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label class="flex items-center">
                <input 
                  type="checkbox" 
                  v-model="settings.queueScanning"
                  class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                >
                <span class="ml-2 text-sm text-gray-700">Enable Queue Monitoring</span>
              </label>
            </div>
            
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Queue Length Threshold</label>
              <input 
                type="number" 
                v-model.number="settings.queueLengthThreshold"
                min="0"
                class="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              >
            </div>
          </div>
        </div>
        
        <!-- Notification Settings -->
        <div class="pb-6">
          <h4 class="text-md font-medium text-gray-800 mb-4">Notifications</h4>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Slack Webhook URL</label>
            <input 
              type="url" 
              v-model="settings.slackWebhookUrl"
              placeholder="https://hooks.slack.com/services/..."
              class="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
            <p class="mt-1 text-sm text-gray-500">Leave empty to disable Slack notifications</p>
          </div>
        </div>
        
        <!-- Actions -->
        <div class="flex justify-end space-x-4">
          <button
            type="button"
            @click="resetSettings"
            class="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            :disabled="loading"
          >
            Reset to Defaults
          </button>
          
          <button
            type="submit"
            class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            :disabled="loading"
          >
            {{ loading ? 'Saving...' : 'Save Settings' }}
          </button>
        </div>
      </form>
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
          <span class="text-gray-700">{{ loading }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import axios from 'axios'

export default {
  name: 'Settings',
  data() {
    return {
      loading: false,
      notification: {
        show: false,
        type: 'success',
        message: ''
      },
      settings: {
        codeAnalysis: true,
        scanInterval: 30,
        detectionLevel: 1,
        autoStart: true,
        queueScanning: false,
        queueLengthThreshold: 0,
        performanceMonitoring: false,
        performanceInterval: 10,
        cpuThreshold: 75,
        memoryThreshold: 80,
        eventLoopThreshold: 20,
        slackWebhookUrl: ''
      }
    }
  },
  
  async mounted() {
    await this.loadSettings()
  },
  
  methods: {
    async loadSettings() {
      this.loading = 'Loading settings...'
      try {
        const response = await axios.get('/analyzer/api/settings')
        if (response.data.settings) {
          Object.assign(this.settings, response.data.settings)
        }
      } catch (error) {
        console.error('Failed to load settings:', error)
        this.showError('Failed to load settings')
      } finally {
        this.loading = false
      }
    },
    
    async saveSettings() {
      this.loading = 'Saving settings...'
      try {
        const response = await axios.patch('/analyzer/api/settings', {
          settings: this.settings
        })
        
        if (response.data.success) {
          this.showSuccess('Settings saved successfully')
        } else {
          const errorDetails = response.data.details?.failures?.map(f => `${f.key}: ${f.error}`).join(', ') || 'Unknown error'
          this.showError(`Failed to save settings: ${errorDetails}`)
        }
      } catch (error) {
        console.error('Failed to save settings:', error)
        this.showError('Failed to save settings')
      } finally {
        this.loading = false
      }
    },
    
    async resetSettings() {
      if (confirm('Are you sure you want to reset all settings to defaults?')) {
        this.loading = 'Resetting settings...'
        try {
          const response = await axios.post('/analyzer/api/settings/reset')
          if (response.data.success) {
            await this.loadSettings()
            this.showSuccess('Settings reset to defaults')
          } else {
            this.showError('Failed to reset settings')
          }
        } catch (error) {
          console.error('Failed to reset settings:', error)
          this.showError('Failed to reset settings')
        } finally {
          this.loading = false
        }
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
    }
  }
}
</script>