/**
 * @fileoverview Analytics store for managing task metrics and real-time updates
 * @module stores/analyticsStore
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import apiClient from '../api/client.js'
import socket from '../plugins/socket.js'

/**
 * Pinia store for analytics data, notifications, and real-time Socket.IO updates
 * @function useAnalyticsStore
 * @returns {Object} Analytics store with reactive state and methods
 */
export const useAnalyticsStore = defineStore('analytics', () => {
  const analytics = ref({
    totalTasks: 0,
    tasksByStatus: { pending: 0, 'in-progress': 0, completed: 0 },
    tasksByPriority: { low: 0, medium: 0, high: 0 },
    completionRate: 0,
    averageCompletionTime: 0,
    tasksCreatedToday: 0,
    tasksCompletedToday: 0,
    recentActivity: [],
    unifiedActivity: [],
    exportMetrics: {
      totalExports: 0,
      completedExports: 0,
      failedExports: 0,
      successRate: 0,
      todayExports: 0,
      recentExports: []
    },
    lastUpdated: null
  })

  const loading = ref(false)
  const error = ref(null)
  const notifications = ref([])
  const connected = ref(false)

  const statusData = computed(() => [
    {
      name: 'Pending',
      value: analytics.value.tasksByStatus.pending,
      color: '#FFC107'
    },
    {
      name: 'In Progress',
      value: analytics.value.tasksByStatus['in-progress'],
      color: '#2196F3'
    },
    {
      name: 'Completed',
      value: analytics.value.tasksByStatus.completed,
      color: '#4CAF50'
    }
  ])

  const priorityData = computed(() => [
    {
      name: 'Low',
      value: analytics.value.tasksByPriority.low,
      color: '#4CAF50'
    },
    {
      name: 'Medium',
      value: analytics.value.tasksByPriority.medium,
      color: '#FFC107'
    },
    {
      name: 'High',
      value: analytics.value.tasksByPriority.high,
      color: '#FF5252'
    }
  ])

  const exportStatusData = computed(() => [
    {
      name: 'Completed',
      value: analytics.value.exportMetrics.completedExports,
      color: '#4CAF50'
    },
    {
      name: 'Failed',
      value: analytics.value.exportMetrics.failedExports,
      color: '#FF5252'
    }
  ])

  /**
   * Fetches analytics data from API
   * @async
   * @function fetchAnalytics
   * @returns {Promise<void>}
   */
  async function fetchAnalytics() {
    loading.value = true
    error.value = null

    try {
      const response = await apiClient.getAnalytics()
      analytics.value = response.data
    } catch (err) {
      error.value = err.message
      console.error('Error fetching analytics:', err)
    } finally {
      loading.value = false
    }
  }

  /**
   * Updates analytics data with new values
   * @function updateAnalytics
   * @param {Object} newData - New analytics data to merge
   */
  function updateAnalytics(newData) {
    analytics.value = { ...analytics.value, ...newData }
  }

  /**
   * Adds notification to the notifications list
   * @function addNotification
   * @param {Object} notification - Notification object
   */
  function addNotification(notification) {
    const id = Date.now().toString()
    notifications.value.unshift({
      id,
      ...notification,
      timestamp: notification.timestamp || new Date().toISOString()
    })

    if (notifications.value.length > 50) {
      notifications.value = notifications.value.slice(0, 50)
    }
  }

  /**
   * Removes notification by ID
   * @function removeNotification
   * @param {string} id - Notification ID
   */
  function removeNotification(id) {
    const index = notifications.value.findIndex((n) => n.id === id)
    if (index !== -1) {
      notifications.value.splice(index, 1)
    }
  }

  /**
   * Clears all notifications
   * @function clearNotifications
   */
  function clearNotifications() {
    notifications.value = []
  }

  /**
   * Sets up Socket.IO event listeners for real-time updates
   * @function initializeSocketListeners
   */
  function initializeSocketListeners() {
    socket.on('connect', () => {
      connected.value = true
      socket.emit('join-analytics')
      socket.emit('request-analytics')
    })

    socket.on('disconnect', () => {
      connected.value = false
    })

    socket.on('analytics-update', (data) => {
      updateAnalytics(data)
    })

    socket.on('analytics-error', (error) => {
      console.error('Analytics error:', error)
      addNotification({
        message: error.message || 'Failed to update analytics',
        type: 'error'
      })
    })

    socket.on('notification', (notification) => {
      addNotification(notification)
    })

    socket.on('task-update', (data) => {
      console.log(
        '📊 Task update detected, refreshing analytics...',
        data.action
      )
      // Immediately request fresh analytics when a task is updated
      socket.emit('request-analytics')
    })
  }

  /**
   * Removes Socket.IO event listeners
   * @function cleanup
   */
  function cleanup() {
    socket.off('connect')
    socket.off('disconnect')
    socket.off('analytics-update')
    socket.off('analytics-error')
    socket.off('notification')
    socket.off('task-update')
  }

  /**
   * Connects to Socket.IO server
   * @function connect
   */
  function connect() {
    if (!socket.connected) {
      socket.connect()
    }
  }

  /**
   * Disconnects from Socket.IO server
   * @function disconnect
   */
  function disconnect() {
    if (socket.connected) {
      socket.disconnect()
    }
  }

  return {
    analytics,
    loading,
    error,
    notifications,
    connected,
    statusData,
    priorityData,
    exportStatusData,
    fetchAnalytics,
    updateAnalytics,
    addNotification,
    removeNotification,
    clearNotifications,
    initializeSocketListeners,
    cleanup,
    connect,
    disconnect
  }
})
