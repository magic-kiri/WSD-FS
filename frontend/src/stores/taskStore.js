/**
 * @fileoverview Task store for managing task data, CRUD operations, and real-time updates
 * @module stores/taskStore
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import apiClient from '../api/client.js'
import socket from '../plugins/socket.js'

/**
 * Pinia store for task management with pagination, filtering, and real-time updates
 * @function useTaskStore
 * @returns {Object} Task store with reactive state and methods
 */
export const useTaskStore = defineStore('tasks', () => {
  const tasks = ref([])
  const loading = ref(false)
  const error = ref(null)
  const pagination = ref({
    page: 1,
    limit: 10,
    total: 0,
    pages: 0
  })

  const filters = ref({
    status: [],
    priority: [],
    createdFrom: null,
    createdTo: null,
    completedFrom: null,
    completedTo: null,
    sortBy: 'createdAt',
    sortOrder: 'desc'
  })

  // Filter presets for quick access
  const filterPresets = ref([
    {
      name: 'Overdue Tasks',
      filters: {
        status: ['pending', 'in-progress'],
        createdTo: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0]
      }
    },
    {
      name: 'This Week Completed',
      filters: {
        status: ['completed'],
        completedFrom: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0],
        completedTo: new Date().toISOString().split('T')[0]
      }
    },
    {
      name: 'High Priority Pending',
      filters: {
        status: ['pending'],
        priority: ['high']
      }
    },
    {
      name: 'Recently Created',
      filters: {
        createdFrom: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0],
        sortBy: 'createdAt',
        sortOrder: 'desc'
      }
    }
  ])

  // Active filter tracking
  const activeFilterCount = computed(() => {
    let count = 0
    if (filters.value.status?.length > 0) count++
    if (filters.value.priority?.length > 0) count++
    if (filters.value.createdFrom) count++
    if (filters.value.createdTo) count++
    if (filters.value.completedFrom) count++
    if (filters.value.completedTo) count++
    return count
  })

  // Active filter chips for display
  const activeFilterChips = computed(() => {
    const chips = []

    if (filters.value.status?.length > 0) {
      chips.push({
        key: 'status',
        label: `Status: ${filters.value.status.join(', ')}`,
        value: filters.value.status
      })
    }

    if (filters.value.priority?.length > 0) {
      chips.push({
        key: 'priority',
        label: `Priority: ${filters.value.priority.join(', ')}`,
        value: filters.value.priority
      })
    }

    if (filters.value.createdFrom || filters.value.createdTo) {
      const from = filters.value.createdFrom
        ? new Date(filters.value.createdFrom).toLocaleDateString()
        : 'any'
      const to = filters.value.createdTo
        ? new Date(filters.value.createdTo).toLocaleDateString()
        : 'any'
      chips.push({
        key: 'created',
        label: `Created: ${from} - ${to}`,
        value: {
          createdFrom: filters.value.createdFrom,
          createdTo: filters.value.createdTo
        }
      })
    }

    if (filters.value.completedFrom || filters.value.completedTo) {
      const from = filters.value.completedFrom
        ? new Date(filters.value.completedFrom).toLocaleDateString()
        : 'any'
      const to = filters.value.completedTo
        ? new Date(filters.value.completedTo).toLocaleDateString()
        : 'any'
      chips.push({
        key: 'completed',
        label: `Completed: ${from} - ${to}`,
        value: {
          completedFrom: filters.value.completedFrom,
          completedTo: filters.value.completedTo
        }
      })
    }

    return chips
  })

  const pendingTasks = computed(() =>
    tasks.value.filter((task) => task.status === 'pending')
  )

  const inProgressTasks = computed(() =>
    tasks.value.filter((task) => task.status === 'in-progress')
  )

  const completedTasks = computed(() =>
    tasks.value.filter((task) => task.status === 'completed')
  )

  const highPriorityTasks = computed(() =>
    tasks.value.filter((task) => task.priority === 'high')
  )

  const tasksByStatus = computed(() => ({
    pending: pendingTasks.value.length,
    'in-progress': inProgressTasks.value.length,
    completed: completedTasks.value.length
  }))

  const tasksByPriority = computed(() => ({
    low: tasks.value.filter((task) => task.priority === 'low').length,
    medium: tasks.value.filter((task) => task.priority === 'medium').length,
    high: tasks.value.filter((task) => task.priority === 'high').length
  }))

  /**
   * Fetches tasks with pagination and filtering
   * @async
   * @function fetchTasks
   * @param {Object} [params={}] - Query parameters
   * @returns {Promise<void>}
   */
  async function fetchTasks(params = {}) {
    loading.value = true
    error.value = null

    try {
      const queryParams = {
        page: pagination.value.page,
        limit: pagination.value.limit,
        ...filters.value,
        ...params
      }

      // Clean up empty arrays and falsy values
      Object.keys(queryParams).forEach((key) => {
        if (
          !queryParams[key] ||
          (Array.isArray(queryParams[key]) && queryParams[key].length === 0)
        ) {
          delete queryParams[key]
        }
      })

      const response = await apiClient.getTasks(queryParams)

      tasks.value = response.data.tasks
      pagination.value = response.data.pagination
    } catch (err) {
      error.value = err.message
      console.error('Error fetching tasks:', err)
    } finally {
      loading.value = false
    }
  }

  /**
   * Fetches a single task by ID
   * @async
   * @function getTask
   * @param {string} id - Task ID
   * @returns {Promise<Object>} Task data
   */
  async function getTask(id) {
    loading.value = true
    error.value = null

    try {
      const response = await apiClient.getTask(id)
      return response.data
    } catch (err) {
      error.value = err.message
      console.error('Error fetching task:', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Creates a new task
   * @async
   * @function createTask
   * @param {Object} taskData - Task data
   * @returns {Promise<Object>} Created task
   */
  async function createTask(taskData) {
    loading.value = true
    error.value = null

    try {
      const response = await apiClient.createTask(taskData)

      tasks.value.unshift(response.data)
      pagination.value.total++

      return response.data
    } catch (err) {
      error.value = err.message
      console.error('Error creating task:', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Updates an existing task
   * @async
   * @function updateTask
   * @param {string} id - Task ID
   * @param {Object} updates - Update data
   * @returns {Promise<Object>} Updated task
   */
  async function updateTask(id, updates) {
    loading.value = true
    error.value = null

    try {
      const response = await apiClient.updateTask(id, updates)

      const index = tasks.value.findIndex((task) => task._id === id)
      if (index !== -1) {
        tasks.value[index] = response.data
      }

      return response.data
    } catch (err) {
      error.value = err.message
      console.error('Error updating task:', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Deletes a task by ID
   * @async
   * @function deleteTask
   * @param {string} id - Task ID
   * @returns {Promise<void>}
   */
  async function deleteTask(id) {
    loading.value = true
    error.value = null

    try {
      await apiClient.deleteTask(id)

      const index = tasks.value.findIndex((task) => task._id === id)
      if (index !== -1) {
        tasks.value.splice(index, 1)
        pagination.value.total--
      }
    } catch (err) {
      error.value = err.message
      console.error('Error deleting task:', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Updates task filters and refetches data
   * @function updateFilters
   * @param {Object} newFilters - New filter values
   */
  function updateFilters(newFilters) {
    filters.value = { ...filters.value, ...newFilters }
    pagination.value.page = 1
    fetchTasks()
  }

  /**
   * Applies a filter preset
   * @function applyFilterPreset
   * @param {Object} preset - Filter preset to apply
   */
  function applyFilterPreset(preset) {
    updateFilters(preset.filters)
  }

  /**
   * Clears all active filters
   * @function clearAllFilters
   */
  function clearAllFilters() {
    filters.value = {
      status: [],
      priority: [],
      createdFrom: null,
      createdTo: null,
      completedFrom: null,
      completedTo: null,
      sortBy: 'createdAt',
      sortOrder: 'desc'
    }
    pagination.value.page = 1
    fetchTasks()
  }

  /**
   * Removes a specific filter
   * @function removeFilter
   * @param {string} filterKey - Key of the filter to remove
   */
  function removeFilter(filterKey) {
    if (filterKey === 'created') {
      filters.value.createdFrom = null
      filters.value.createdTo = null
    } else if (filterKey === 'completed') {
      filters.value.completedFrom = null
      filters.value.completedTo = null
    } else {
      filters.value[filterKey] = Array.isArray(filters.value[filterKey])
        ? []
        : null
    }
    pagination.value.page = 1
    fetchTasks()
  }

  /**
   * Gets current filter state for URL serialization
   * @function getFilterState
   * @returns {Object} Current filter state
   */
  function getFilterState() {
    return JSON.parse(JSON.stringify(filters.value))
  }

  /**
   * Sets filter state from URL parameters
   * @function setFilterState
   * @param {Object} state - Filter state to set
   */
  function setFilterState(state) {
    filters.value = { ...filters.value, ...state }
    fetchTasks()
  }

  /**
   * Sets pagination page and refetches data
   * @function setPage
   * @param {number} page - Page number
   */
  function setPage(page) {
    pagination.value.page = page
    fetchTasks()
  }

  /**
   * Handles real-time task updates from Socket.IO
   * @function handleTaskUpdate
   * @param {Object} data - Task update data
   */
  function handleTaskUpdate(data) {
    const { action, task } = data

    switch (action) {
      case 'created':
        if (!tasks.value.find((t) => t._id === task._id)) {
          tasks.value.unshift(task)
          pagination.value.total++
        }
        break
      case 'updated': {
        const index = tasks.value.findIndex((t) => t._id === task._id)
        if (index !== -1) {
          tasks.value[index] = task
        }
        break
      }
      case 'deleted': {
        const deleteIndex = tasks.value.findIndex((t) => t._id === task._id)
        if (deleteIndex !== -1) {
          tasks.value.splice(deleteIndex, 1)
          pagination.value.total--
        }
        break
      }
    }
  }

  /**
   * Sets up Socket.IO event listeners
   * @function initializeSocketListeners
   */
  function initializeSocketListeners() {
    socket.on('task-update', handleTaskUpdate)
  }

  /**
   * Removes Socket.IO event listeners
   * @function cleanup
   */
  function cleanup() {
    socket.off('task-update', handleTaskUpdate)
  }

  return {
    tasks,
    loading,
    error,
    pagination,
    filters,
    filterPresets,
    activeFilterCount,
    activeFilterChips,
    pendingTasks,
    inProgressTasks,
    completedTasks,
    highPriorityTasks,
    tasksByStatus,
    tasksByPriority,
    fetchTasks,
    getTask,
    createTask,
    updateTask,
    deleteTask,
    updateFilters,
    applyFilterPreset,
    clearAllFilters,
    removeFilter,
    getFilterState,
    setFilterState,
    setPage,
    handleTaskUpdate,
    initializeSocketListeners,
    cleanup
  }
})
