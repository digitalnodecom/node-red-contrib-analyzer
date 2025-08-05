<template>
  <header class="bg-gray-900 text-white px-4 py-2 border-b border-gray-700 shadow-sm">
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-4">
        <div class="flex items-center gap-3">
          <img :src="analyzerLogo" alt="Code Analyzer" style="width:30px;height:30px;" />
          <h1 class="text-base font-medium text-white">Code Analyzer</h1>
        </div>
        <div class="text-xs text-gray-500">|</div>
        <div class="text-sm text-gray-300">{{ pageTitle }}</div>
      </div>
      <div class="flex items-center gap-2">
        <a
          href="/"
          class="p-2 text-gray-300 hover:text-white hover:bg-gray-800 transition-colors rounded inline-flex items-center justify-center"
          title="Back to Node-RED"
          style="width:40px;height:40px;padding:5px;"
        >
          <img :src="nodeRedLogo" alt="Node-RED" style="width:30px;height:30px;" />
        </a>
        <button
          @click="refresh"
          class="p-2 text-gray-300 hover:text-white hover:bg-gray-800 transition-colors rounded"
          title="Refresh"
        >
          <i class="ph ph-arrow-clockwise text-sm"></i>
        </button>
      </div>
    </div>
  </header>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'

// Import assets using Vite's asset handling
import analyzerLogoUrl from '@/assets/images/node-red-analyzer.svg'
import nodeRedLogoUrl from '@/assets/images/node-red.svg'

const route = useRoute()

// Make logos reactive for proper binding
const analyzerLogo = computed(() => analyzerLogoUrl)
const nodeRedLogo = computed(() => nodeRedLogoUrl)

const pageTitle = computed(() => {
  const titles = {
    'Dashboard': 'Dashboard',
    'Settings': 'Settings',
    'QualityAnalysis': 'Quality Analysis',
    'Performance': 'Performance Monitoring'
  }
  return titles[route.name] || 'Code Analyzer'
})

const refresh = () => {
  window.location.reload()
}
</script>