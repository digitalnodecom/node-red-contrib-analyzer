<template>
  <div class="bg-white border border-gray-200 shadow rounded-lg p-4 mb-6">
    <div class="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
      <!-- Left side: Title and Status -->
      <div class="flex items-center gap-3">
        <h2 class="text-xl font-semibold text-gray-900">{{ title }}</h2>
        <div v-if="status" class="flex items-center gap-2">
          <div 
            v-if="status.indicator"
            class="w-2 h-2 rounded-full"
            :class="status.indicator.color"
          ></div>
          <span 
            class="text-sm font-medium"
            :class="status.textColor"
          >
            {{ status.text }}
          </span>
          <span v-if="status.subtitle" class="text-xs text-gray-500">
            {{ status.subtitle }}
          </span>
        </div>
      </div>
      
      <!-- Right side: Action Buttons -->
      <div class="flex gap-2">
        <slot name="actions"></slot>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'PageActionBar',
  props: {
    title: {
      type: String,
      required: true
    },
    status: {
      type: Object,
      default: null,
      validator(value) {
        if (!value) return true
        return typeof value.text === 'string'
      }
    }
  }
}
</script>