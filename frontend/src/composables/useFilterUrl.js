/**
 * @fileoverview Composable for managing filter state in URL parameters
 * @module composables/useFilterUrl
 */

import { ref, watch, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useTaskStore } from '../stores/taskStore.js'

/**
 * Composable for URL-based filter state management
 * @function useFilterUrl
 * @returns {Object} URL filter state management functions
 */
export function useFilterUrl() {
  const router = useRouter()
  const route = useRoute()
  const taskStore = useTaskStore()

  const isInitialized = ref(false)

  /**
   * Serializes filter state to URL query parameters
   * @function serializeFilters
   * @param {Object} filters - Filter state object
   * @returns {Object} URL query parameters
   */
  const serializeFilters = (filters) => {
    const query = {}

    // Handle text search
    if (filters.text && filters.text.trim()) {
      query.text = filters.text.trim()
    }

    // Handle arrays (status, priority)
    if (filters.status?.length > 0) {
      query.status = filters.status.join(',')
    }

    if (filters.priority?.length > 0) {
      query.priority = filters.priority.join(',')
    }

    // Handle date ranges
    if (filters.createdFrom) {
      query.createdFrom = filters.createdFrom
    }

    if (filters.createdTo) {
      query.createdTo = filters.createdTo
    }

    if (filters.completedFrom) {
      query.completedFrom = filters.completedFrom
    }

    if (filters.completedTo) {
      query.completedTo = filters.completedTo
    }

    // Handle sorting
    if (filters.sortBy && filters.sortBy !== 'createdAt') {
      query.sortBy = filters.sortBy
    }

    if (filters.sortOrder && filters.sortOrder !== 'desc') {
      query.sortOrder = filters.sortOrder
    }

    // Handle pagination
    if (taskStore.pagination.page > 1) {
      query.page = taskStore.pagination.page.toString()
    }

    return query
  }

  /**
   * Deserializes URL query parameters to filter state
   * @function deserializeFilters
   * @param {Object} query - URL query parameters
   * @returns {Object} Filter state object
   */
  const deserializeFilters = (query) => {
    const filters = {
      text: '',
      status: [],
      priority: [],
      createdFrom: null,
      createdTo: null,
      completedFrom: null,
      completedTo: null,
      sortBy: 'createdAt',
      sortOrder: 'desc'
    }

    // Parse text search
    if (query.text) {
      filters.text = query.text
    }

    // Parse arrays
    if (query.status) {
      filters.status = query.status.split(',').filter(Boolean)
    }

    if (query.priority) {
      filters.priority = query.priority.split(',').filter(Boolean)
    }

    // Parse dates
    if (query.createdFrom) {
      filters.createdFrom = query.createdFrom
    }

    if (query.createdTo) {
      filters.createdTo = query.createdTo
    }

    if (query.completedFrom) {
      filters.completedFrom = query.completedFrom
    }

    if (query.completedTo) {
      filters.completedTo = query.completedTo
    }

    // Parse sorting
    if (query.sortBy) {
      filters.sortBy = query.sortBy
    }

    if (query.sortOrder) {
      filters.sortOrder = query.sortOrder
    }

    return filters
  }

  /**
   * Updates URL with current filter state
   * @function updateUrl
   * @param {Object} filters - Current filter state
   */
  const updateUrl = (filters) => {
    if (!isInitialized.value) return

    const query = serializeFilters(filters)

    // Only update if query has changed
    const currentQuery = route.query
    const queryChanged = JSON.stringify(query) !== JSON.stringify(currentQuery)

    if (queryChanged) {
      router
        .push({
          path: '/tasks',
          query
        })
        .catch(() => {
          // Ignore navigation failures (same route)
        })
    }
  }

  /**
   * Initializes filters from URL parameters
   * @function initializeFromUrl
   */
  const initializeFromUrl = () => {
    const filters = deserializeFilters(route.query)

    // Set pagination if present in URL
    if (route.query.page) {
      const page = parseInt(route.query.page, 10)
      if (page > 0) {
        taskStore.pagination.page = page
      }
    }

    // Update store with URL filters
    taskStore.setFilterState(filters)
    isInitialized.value = true
  }

  /**
   * Clears all URL parameters
   * @function clearUrl
   */
  const clearUrl = () => {
    if (!isInitialized.value) return

    router
      .push({
        path: '/tasks',
        query: {}
      })
      .catch(() => {
        // Ignore navigation failures
      })
  }

  /**
   * Gets shareable URL with current filters
   * @function getShareableUrl
   * @returns {string} Complete URL with current filters
   */
  const getShareableUrl = () => {
    const query = serializeFilters(taskStore.filters)
    const url = new URL(window.location.origin + route.path)

    Object.entries(query).forEach(([key, value]) => {
      url.searchParams.set(key, value)
    })

    return url.toString()
  }

  // Watch store filters and update URL
  watch(
    () => taskStore.filters,
    (newFilters) => {
      updateUrl(newFilters)
    },
    { deep: true }
  )

  // Watch pagination and update URL
  watch(
    () => taskStore.pagination.page,
    (newPage) => {
      if (isInitialized.value && newPage > 1) {
        const query = { ...route.query, page: newPage.toString() }
        router.push({ path: route.path, query }).catch(() => {})
      } else if (isInitialized.value && newPage === 1 && route.query.page) {
        const query = { ...route.query }
        delete query.page
        router.push({ path: route.path, query }).catch(() => {})
      }
    }
  )

  // Initialize on mount
  onMounted(() => {
    initializeFromUrl()
  })

  return {
    initializeFromUrl,
    updateUrl,
    clearUrl,
    getShareableUrl,
    serializeFilters,
    deserializeFilters
  }
}
