import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import App from './App.vue'
import Dashboard from './views/Dashboard.vue'
import Settings from './views/Settings.vue'
import QualityAnalysis from './views/QualityAnalysis.vue'
import Performance from './views/Performance.vue'
import './style.css'

const routes = [
  { path: '/', redirect: '/analyzer' },
  { path: '/analyzer', name: 'Dashboard', component: Dashboard },
  { path: '/analyzer/settings', name: 'Settings', component: Settings },
  { path: '/analyzer/quality', name: 'QualityAnalysis', component: QualityAnalysis },
  { path: '/analyzer/performance', name: 'Performance', component: Performance }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

const app = createApp(App)
app.use(router)
app.mount('#app')