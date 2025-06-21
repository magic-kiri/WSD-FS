<template>
  <v-app>
    <v-navigation-drawer v-model="drawer" app temporary :width="280">
      <v-list>
        <v-list-item
          prepend-avatar="https://randomuser.me/api/portraits/men/85.jpg"
          title="Task Analytics"
          subtitle="Dashboard"
        ></v-list-item>
      </v-list>

      <v-divider></v-divider>

      <v-list nav>
        <v-list-item
          v-for="item in menuItems"
          :key="item.title"
          :to="item.to"
          :prepend-icon="item.icon"
          :title="item.title"
          color="primary"
        ></v-list-item>
      </v-list>
    </v-navigation-drawer>

    <v-app-bar app color="primary" dark>
      <v-app-bar-nav-icon @click="drawer = !drawer"></v-app-bar-nav-icon>
      <v-toolbar-title>Task Analytics Dashboard</v-toolbar-title>
      <v-spacer></v-spacer>

      <v-btn icon @click="toggleTheme">
        <v-icon>{{ themeIcon }}</v-icon>
      </v-btn>

      <v-badge
        :content="unreadNotifications"
        :model-value="unreadNotifications > 0"
        color="error"
      >
        <v-btn icon @click="showNotifications = !showNotifications">
          <v-icon>mdi-bell</v-icon>
        </v-btn>
      </v-badge>

      <!-- User Menu -->
      <v-menu offset-y>
        <template #activator="{ props }">
          <v-btn icon v-bind="props">
            <v-avatar size="32">
              <img src="https://randomuser.me/api/portraits/men/85.jpg" alt="User Avatar">
            </v-avatar>
          </v-btn>
        </template>
        <v-list>
          <v-list-item>
            <v-list-item-title class="font-weight-medium">User Menu</v-list-item-title>
            <v-list-item-subtitle>Quick Actions</v-list-item-subtitle>
          </v-list-item>
          
          <v-divider></v-divider>
          
          <v-list-item @click="navigateToExportHistory">
            <template #prepend>
              <v-icon>mdi-download-multiple</v-icon>
            </template>
            <v-list-item-title>Export History</v-list-item-title>
            <v-list-item-subtitle>View and manage exports</v-list-item-subtitle>
          </v-list-item>
          
          <v-list-item @click="navigateToTasks">
            <template #prepend>
              <v-icon>mdi-format-list-checks</v-icon>
            </template>
            <v-list-item-title>My Tasks</v-list-item-title>
            <v-list-item-subtitle>Manage your tasks</v-list-item-subtitle>
          </v-list-item>
          
          <v-list-item @click="navigateToAnalytics">
            <template #prepend>
              <v-icon>mdi-chart-line</v-icon>
            </template>
            <v-list-item-title>Analytics</v-list-item-title>
            <v-list-item-subtitle>View detailed reports</v-list-item-subtitle>
          </v-list-item>
          
          <v-divider></v-divider>
          
          <v-list-item @click="toggleTheme">
            <template #prepend>
              <v-icon>{{ themeIcon }}</v-icon>
            </template>
            <v-list-item-title>
              {{ theme.global.name.value === 'dark' ? 'Light Mode' : 'Dark Mode' }}
            </v-list-item-title>
            <v-list-item-subtitle>Toggle appearance</v-list-item-subtitle>
          </v-list-item>
        </v-list>
      </v-menu>
    </v-app-bar>

    <v-main class="app-container">
      <v-container fluid>
        <router-view />
      </v-container>
    </v-main>

    <connection-status />

    <notification-drawer
      v-model="showNotifications"
      :notifications="notifications"
      @clear-all="clearAllNotifications"
      @remove="removeNotification"
    />
  </v-app>
</template>

<!--
/**
 * @fileoverview Main application component with navigation, theme control, and notifications
 * @component App
 * @description Root Vue component providing layout structure, navigation drawer, app bar,
 * theme toggle, notification management, and Socket.IO connection handling
 */
-->

<script setup>
/**
 * @module App
 * @description Main application component with navigation and real-time features
 */

import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useTheme } from 'vuetify'
import { useRouter } from 'vue-router'
import { useAnalyticsStore } from './stores/analyticsStore.js'
import { useTaskStore } from './stores/taskStore.js'
import { useExportStore } from './stores/exportStore.js'
import ConnectionStatus from './components/ConnectionStatus.vue'
import NotificationDrawer from './components/NotificationDrawer.vue'

const theme = useTheme()
const router = useRouter()
const analyticsStore = useAnalyticsStore()
const taskStore = useTaskStore()
const exportStore = useExportStore()

const drawer = ref(false)
const showNotifications = ref(false)

const menuItems = [
  { title: 'Dashboard', icon: 'mdi-view-dashboard', to: '/' },
  { title: 'Tasks', icon: 'mdi-format-list-checks', to: '/tasks' },
  { title: 'Analytics', icon: 'mdi-chart-line', to: '/analytics' },
  {
    title: 'Export History',
    icon: 'mdi-download-multiple',
    to: '/export-history'
  }
]

const themeIcon = computed(() =>
  theme.global.name.value === 'dark' ? 'mdi-weather-sunny' : 'mdi-weather-night'
)

const notifications = computed(() => analyticsStore.notifications)

const unreadNotifications = computed(() =>
  notifications.value.length > 10
    ? '10+'
    : notifications.value.length.toString()
)

function toggleTheme() {
  theme.global.name.value =
    theme.global.name.value === 'light' ? 'dark' : 'light'
}

function clearAllNotifications() {
  analyticsStore.clearNotifications()
  showNotifications.value = false
}

function removeNotification(id) {
  analyticsStore.removeNotification(id)
}

// Navigation methods for user menu
function navigateToExportHistory() {
  router.push('/export-history')
}

function navigateToTasks() {
  router.push('/tasks')
}

function navigateToAnalytics() {
  router.push('/analytics')
}

onMounted(() => {
  analyticsStore.initializeSocketListeners()
  taskStore.initializeSocketListeners()
  analyticsStore.connect()
  analyticsStore.fetchAnalytics()
  // Initialize export store for dashboard metrics
  exportStore.fetchExportHistory({ limit: 10 })
})

onUnmounted(() => {
  analyticsStore.cleanup()
  taskStore.cleanup()
  analyticsStore.disconnect()
})
</script>

<style lang="scss">
// Global styles are imported in main.js
</style>
